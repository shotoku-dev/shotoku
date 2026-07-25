import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorize } from "../authorize.js";
import { approve } from "../approve.js";
import {
  appendDecision,
  getLedgerIntegrity,
  readDecisions,
  getPendingApprovals,
  withLedgerLock,
} from "../ledger.js";
import type { LedgerEntry } from "../types.js";

let tmpDir: string;
let policyPath: string;
let ledgerPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "shotoku-concurrency-test-"));
  policyPath = join(tmpDir, "policy.yaml");
  ledgerPath = join(tmpDir, "decisions.jsonl");
});

const WRITERS = 20;

function request(n: number) {
  return {
    actor: `agent-${n}`,
    action: "api_call" as const,
    resource: "openai.com",
    amount: 1,
  };
}

/**
 * The hash chain is positional: every append reads the file to compute its
 * `previousHash` and `sequence`. Two writers that do that concurrently produce
 * two records claiming the same position, and the chain is broken for good —
 * every reader (CLI history, TUI, MCP) fails with ledger_corrupt from then on.
 *
 * These cover the paths that used to append without holding the lock. Note both
 * are *failure* paths: they trigger hardest when a policy file is malformed,
 * which is exactly when every process on the machine takes them at once.
 */
describe("ledger stays intact under concurrent writers", () => {
  it("survives concurrent authorize() when the policy file is invalid", async () => {
    await writeFile(policyPath, "rules:\n  - resource: openai.com\n    verdict: nonsense\n");

    const responses = await Promise.all(
      Array.from({ length: WRITERS }, (_, n) =>
        authorize(request(n), { policyPath, ledgerPath }),
      ),
    );

    expect(responses.every((r) => r.status === "denied")).toBe(true);

    const report = await getLedgerIntegrity(ledgerPath);
    expect(report.recordCount).toBe(WRITERS);
    expect(await readDecisions(ledgerPath)).toHaveLength(WRITERS);
  });

  it("survives concurrent authorize() when the policy file is missing", async () => {
    const responses = await Promise.all(
      Array.from({ length: WRITERS }, (_, n) =>
        authorize(request(n), { policyPath, ledgerPath }),
      ),
    );

    expect(responses.every((r) => r.status === "denied")).toBe(true);
    expect((await getLedgerIntegrity(ledgerPath)).recordCount).toBe(WRITERS);
  });

  it("survives concurrent authorize() when the requests are invalid", async () => {
    await writeFile(policyPath, "rules:\n  - resource: openai.com\n    verdict: approved\n");

    const responses = await Promise.all(
      Array.from({ length: WRITERS }, () =>
        authorize(
          { actor: "", action: "api_call", resource: "openai.com" },
          { policyPath, ledgerPath },
        ),
      ),
    );

    expect(responses.every((r) => r.status === "denied")).toBe(true);
    expect((await getLedgerIntegrity(ledgerPath)).recordCount).toBe(WRITERS);
  });

  it("survives valid and invalid requests racing against each other", async () => {
    await writeFile(policyPath, "rules:\n  - resource: openai.com\n    verdict: approved\n");

    await Promise.all(
      Array.from({ length: WRITERS }, (_, n) =>
        n % 2 === 0
          ? authorize(request(n), { policyPath, ledgerPath })
          : authorize(
              { actor: "", action: "api_call", resource: "openai.com" },
              { policyPath, ledgerPath },
            ),
      ),
    );

    expect((await getLedgerIntegrity(ledgerPath)).recordCount).toBe(WRITERS);
  });

  /**
   * approve() runs its whole read-check-append cycle inside withLedgerLock, so
   * making the appends lock on their own behalf must not re-enter the lock.
   * withLedgerLock is not re-entrant: a nested acquire spins for 5s and throws.
   */
  it("does not deadlock when approve() races authorize()", async () => {
    await writeFile(
      policyPath,
      "rules:\n  - resource: openai.com\n    verdict: pending_approval\n",
    );

    const seeded = await Promise.all(
      Array.from({ length: 5 }, (_, n) =>
        authorize(request(n), { policyPath, ledgerPath }),
      ),
    );
    expect(seeded.every((r) => r.status === "pending_approval")).toBe(true);

    await Promise.all([
      ...seeded.map((r) => approve(r.decisionId, { ledgerPath })),
      ...Array.from({ length: 5 }, (_, n) =>
        authorize(request(100 + n), { policyPath, ledgerPath }),
      ),
    ]);

    const report = await getLedgerIntegrity(ledgerPath);
    expect(report.recordCount).toBe(15); // 5 seeded + 5 approvals + 5 racing
    expect(await getPendingApprovals(ledgerPath)).toHaveLength(5);
  }, 20_000);
});

/**
 * Lock ownership is scoped to the async call chain, not the process. Getting
 * this wrong in either direction is silent: too broad and sibling writers skip
 * the lock and corrupt the chain; too narrow and any nested append hangs for
 * the full lock timeout and then throws.
 */
describe("ledger lock re-entrancy", () => {
  function decision(id: string): LedgerEntry {
    return {
      decisionId: id,
      timestamp: new Date().toISOString(),
      request: { actor: "a", action: "api_call", resource: "openai.com" },
      response: {
        approved: true,
        status: "approved",
        reasons: [],
        explanation: { summary: "ok" },
        decisionId: id,
        timestamp: new Date().toISOString(),
      },
    };
  }

  it("lets a call chain that holds the lock append without deadlocking", async () => {
    await withLedgerLock(ledgerPath, async () => {
      await appendDecision(decision("dec_nested1"), ledgerPath);
      await appendDecision(decision("dec_nested2"), ledgerPath);
    });

    expect((await getLedgerIntegrity(ledgerPath)).recordCount).toBe(2);
  }, 15_000);

  it("still serialises writers that do not share a call chain", async () => {
    await Promise.all(
      Array.from({ length: WRITERS }, (_, n) =>
        appendDecision(decision(`dec_sibling${n}`), ledgerPath),
      ),
    );

    const report = await getLedgerIntegrity(ledgerPath);
    expect(report.recordCount).toBe(WRITERS);
    expect(await readDecisions(ledgerPath)).toHaveLength(WRITERS);
  }, 15_000);
});

/**
 * Readers take no lock, by design — the TUI polls every 3s and must not contend
 * with every authorize against a 5s lock timeout. So a read can catch an append
 * mid-write and see a truncated final line. That is transient and heals in
 * milliseconds; corruption anywhere else is real and must still be fatal.
 */
describe("torn writes are distinguished from real corruption", () => {
  beforeEach(async () => {
    await writeFile(policyPath, "rules:\n  - resource: openai.com\n    verdict: approved\n");
  });

  it("tolerates a truncated final line", async () => {
    for (let n = 0; n < 3; n += 1) {
      await authorize(request(n), { policyPath, ledgerPath });
    }

    const raw = await readFile(ledgerPath, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const torn = lines.slice(0, -1).join("\n") + "\n" + lines.at(-1)!.slice(0, 40);
    await writeFile(ledgerPath, torn);

    // The complete records are still readable; the partial tail is ignored.
    expect(await readDecisions(ledgerPath)).toHaveLength(2);
  });

  it("still refuses to read a corrupt record in the middle", async () => {
    for (let n = 0; n < 3; n += 1) {
      await authorize(request(n), { policyPath, ledgerPath });
    }

    const lines = (await readFile(ledgerPath, "utf8")).split("\n").filter(Boolean);
    const parsed = JSON.parse(lines[1]!) as { request: { actor: string } };
    parsed.request.actor = "tampered";
    lines[1] = JSON.stringify(parsed);
    await writeFile(ledgerPath, lines.join("\n") + "\n");

    await expect(readDecisions(ledgerPath)).rejects.toThrow(/corrupt/);
  });
});
