  import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm as _rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendDecision,
  readDecisions,
  getLedgerSnapshot,
} from "../ledger.js";
import type { LedgerEntry } from "../types.js";

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    decisionId: "dec_001",
    timestamp: new Date("2026-06-18T10:00:00.000Z").toISOString(),
    request: {
      actor: "agent-1",
      action: "purchase",
      resource: "openai.com",
      amount: 20,
    },
    response: {
      approved: true,
      status: "approved",
      reasons: [{ type: "policy_match", text: "openai.com matched rule" }],
      decisionId: "dec_001",
      timestamp: new Date("2026-06-18T10:00:00.000Z").toISOString(),
    },
    ...overrides,
  };
}

let ledgerPath: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "shotoku-test-"));
  ledgerPath = join(dir, "decisions.jsonl");
});

describe("appendDecision", () => {
  it("writes a decision that can be read back", async () => {
    const entry = makeEntry();
    await appendDecision(entry, ledgerPath);
    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(1);
    expect(entries[0]!).toEqual(entry);
  });

  it("appends multiple decisions without overwriting", async () => {
    await appendDecision(makeEntry({ decisionId: "dec_001" }), ledgerPath);
    await appendDecision(makeEntry({ decisionId: "dec_002" }), ledgerPath);
    await appendDecision(makeEntry({ decisionId: "dec_003" }), ledgerPath);
    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.decisionId)).toEqual([
      "dec_001",
      "dec_002",
      "dec_003",
    ]);
  });
});

describe("readDecisions", () => {
  it("returns empty array when file does not exist", async () => {
    const entries = await readDecisions("/tmp/nonexistent-shotoku.jsonl");
    expect(entries).toEqual([]);
  });

  it("filters by status", async () => {
    await appendDecision(makeEntry({ decisionId: "dec_001" }), ledgerPath);
    await appendDecision(
      makeEntry({
        decisionId: "dec_002",
        response: {
          ...makeEntry().response,
          approved: false,
          status: "denied",
          decisionId: "dec_002",
        },
      }),
      ledgerPath,
    );

    const approved = await readDecisions(ledgerPath, { status: "approved" });
    expect(approved).toHaveLength(1);
    expect(approved[0]!.decisionId).toBe("dec_001");

    const denied = await readDecisions(ledgerPath, { status: "denied" });
    expect(denied).toHaveLength(1);
    expect(denied[0]!.decisionId).toBe("dec_002");
  });

  it("filters by actor", async () => {
    await appendDecision(makeEntry({ decisionId: "dec_001" }), ledgerPath);
    await appendDecision(
      makeEntry({ decisionId: "dec_002", request: { ...makeEntry().request, actor: "agent-2" } }),
      ledgerPath,
    );

    const results = await readDecisions(ledgerPath, { actor: "agent-2" });
    expect(results).toHaveLength(1);
    expect(results[0]!.decisionId).toBe("dec_002");
  });

  it("filters by time window (since)", async () => {
    const old = makeEntry({
      decisionId: "dec_old",
      timestamp: new Date("2026-06-17T00:00:00.000Z").toISOString(),
      response: {
        ...makeEntry().response,
        decisionId: "dec_old",
        timestamp: new Date("2026-06-17T00:00:00.000Z").toISOString(),
      },
    });
    const recent = makeEntry({
      decisionId: "dec_recent",
      timestamp: new Date("2026-06-18T10:00:00.000Z").toISOString(),
    });

    await appendDecision(old, ledgerPath);
    await appendDecision(recent, ledgerPath);

    const since = new Date("2026-06-18T00:00:00.000Z");
    const results = await readDecisions(ledgerPath, { since });
    expect(results).toHaveLength(1);
    expect(results[0]!.decisionId).toBe("dec_recent");
  });
});

describe("readDecisions with malformed data", () => {
  it("skips malformed lines and returns the valid ones", async () => {
    const { appendFile } = await import("node:fs/promises");
    await appendDecision(makeEntry({ decisionId: "dec_001" }), ledgerPath);
    await appendFile(ledgerPath, "not-valid-json\n", "utf8");
    await appendDecision(makeEntry({ decisionId: "dec_002" }), ledgerPath);

    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.decisionId)).toEqual(["dec_001", "dec_002"]);
  });
});

describe("getLedgerSnapshot", () => {
  it("returns zero totals when ledger is empty", async () => {
    const snapshot = await getLedgerSnapshot(ledgerPath);
    expect(snapshot.dailyTotals).toEqual({});
  });

  it("sums approved amounts for the same actor and resource today", async () => {
    const now = new Date().toISOString();
    await appendDecision(
      makeEntry({ decisionId: "dec_001", timestamp: now, response: { ...makeEntry().response, decisionId: "dec_001", timestamp: now } }),
      ledgerPath,
    );
    await appendDecision(
      makeEntry({ decisionId: "dec_002", timestamp: now, response: { ...makeEntry().response, decisionId: "dec_002", timestamp: now } }),
      ledgerPath,
    );

    const snapshot = await getLedgerSnapshot(ledgerPath);
    expect(snapshot.dailyTotals["agent-1|openai.com"]).toBe(40);
  });

  it("excludes denied decisions from daily totals", async () => {
    const now = new Date().toISOString();
    await appendDecision(
      makeEntry({
        decisionId: "dec_001",
        timestamp: now,
        response: {
          approved: false,
          status: "denied",
          reasons: [],
          decisionId: "dec_001",
          timestamp: now,
        },
      }),
      ledgerPath,
    );

    const snapshot = await getLedgerSnapshot(ledgerPath);
    expect(snapshot.dailyTotals["agent-1|openai.com"]).toBeUndefined();
  });

  it("excludes decisions from previous days", async () => {
    const yesterday = new Date("2026-06-17T10:00:00.000Z").toISOString();
    await appendDecision(
      makeEntry({
        decisionId: "dec_old",
        timestamp: yesterday,
        response: { ...makeEntry().response, decisionId: "dec_old", timestamp: yesterday },
      }),
      ledgerPath,
    );

    const snapshot = await getLedgerSnapshot(ledgerPath);
    expect(snapshot.dailyTotals["agent-1|openai.com"]).toBeUndefined();
  });
});
