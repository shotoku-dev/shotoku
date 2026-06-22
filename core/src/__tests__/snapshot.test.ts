import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendDecision } from "../ledger.js";
import {
  createSignedSnapshot,
  parseSignedSnapshot,
  verifySignedSnapshot,
} from "../snapshot.js";
import type { LedgerEntry } from "../types.js";

const SECRET = "local-test-secret";

let dir: string;
let policyPath: string;
let ledgerPath: string;

function makeEntry(): LedgerEntry {
  const timestamp = new Date("2026-06-18T10:00:00.000Z").toISOString();
  return {
    decisionId: "dec_snapshot",
    timestamp,
    request: {
      actor: "agent-1",
      action: "api_call",
      resource: "openai.com",
      amount: 5,
    },
    response: {
      approved: true,
      status: "approved",
      reasons: [{ type: "policy_match", text: "openai.com matched rule" }],
      explanation: { summary: "openai.com matched rule" },
      decisionId: "dec_snapshot",
      timestamp,
    },
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "shotoku-snapshot-test-"));
  policyPath = join(dir, "policy.yaml");
  ledgerPath = join(dir, "decisions.jsonl");

  await writeFile(
    policyPath,
    `rules:\n  - resource: openai.com\n    verdict: approved\n`,
    "utf8",
  );
  await appendDecision(makeEntry(), ledgerPath);
});

describe("signed snapshots", () => {
  it("creates and verifies a policy/ledger snapshot", async () => {
    const snapshot = await createSignedSnapshot({
      policyPath,
      ledgerPath,
      secret: SECRET,
      keyId: "test-key",
      createdAt: new Date("2026-06-18T12:00:00.000Z"),
    });

    expect(snapshot.signature.algorithm).toBe("HMAC-SHA256");
    expect(snapshot.signature.keyId).toBe("test-key");

    const result = await verifySignedSnapshot(snapshot, {
      secret: SECRET,
    });

    expect(result.verified).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("detects policy changes after a snapshot is created", async () => {
    const snapshot = await createSignedSnapshot({
      policyPath,
      ledgerPath,
      secret: SECRET,
    });
    await writeFile(
      policyPath,
      `rules:\n  - resource: evil.example\n    verdict: approved\n`,
      "utf8",
    );

    const result = await verifySignedSnapshot(snapshot, {
      secret: SECRET,
    });

    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("Policy hash does not match snapshot.");
  });

  it("detects ledger changes after a snapshot is created", async () => {
    const snapshot = await createSignedSnapshot({
      policyPath,
      ledgerPath,
      secret: SECRET,
    });
    await appendDecision(
      {
        ...makeEntry(),
        decisionId: "dec_second",
        response: {
          ...makeEntry().response,
          decisionId: "dec_second",
        },
      },
      ledgerPath,
    );

    const result = await verifySignedSnapshot(snapshot, {
      secret: SECRET,
    });

    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("Ledger head hash does not match snapshot.");
  });

  it("parses a serialized snapshot", async () => {
    const snapshot = await createSignedSnapshot({
      policyPath,
      ledgerPath,
      secret: SECRET,
    });

    expect(parseSignedSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
  });
});
