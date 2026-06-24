import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendDecision,
  readDecisions,
  getLedgerSnapshot,
  getLedgerIntegrity,
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
      explanation: { summary: "openai.com matched rule" },
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
    expect(entries[0]!).toMatchObject(entry);
    expect(entries[0]!.integrity).toMatchObject({
      version: 1,
      sequence: 1,
    });
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

  it("creates the ledger directory when it does not exist", async () => {
    const nestedPath = join(ledgerPath, "..", "nested", "decisions.jsonl");

    await appendDecision(makeEntry(), nestedPath);

    const entries = await readDecisions(nestedPath);
    expect(entries).toHaveLength(1);
  });

  it("hash-chains appended records", async () => {
    await appendDecision(makeEntry({ decisionId: "dec_001" }), ledgerPath);
    await appendDecision(makeEntry({ decisionId: "dec_002" }), ledgerPath);

    const entries = await readDecisions(ledgerPath);

    expect(entries[0]!.integrity?.sequence).toBe(1);
    expect(entries[1]!.integrity?.sequence).toBe(2);
    expect(entries[1]!.integrity?.previousHash).toBe(
      entries[0]!.integrity?.hash,
    );

    const integrity = await getLedgerIntegrity(ledgerPath);
    expect(integrity.recordCount).toBe(2);
    expect(integrity.legacyRecordCount).toBe(0);
    expect(integrity.headHash).toBe(entries[1]!.integrity?.hash);
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
  it("fails closed when the ledger contains malformed lines", async () => {
    const { appendFile } = await import("node:fs/promises");
    await appendDecision(makeEntry({ decisionId: "dec_001" }), ledgerPath);
    await appendFile(ledgerPath, "not-valid-json\n", "utf8");

    await expect(readDecisions(ledgerPath)).rejects.toThrow(/corrupt/i);
  });

  it("fails closed when a hashed record is tampered with", async () => {
    await appendDecision(makeEntry({ decisionId: "dec_001" }), ledgerPath);

    const raw = await readFile(ledgerPath, "utf8");
    await writeFile(ledgerPath, raw.replace("openai.com", "evil.example"), "utf8");

    await expect(readDecisions(ledgerPath)).rejects.toThrow(/hash/i);
  });

  it("accepts legacy records but reports them as legacy", async () => {
    const legacy = makeEntry({ decisionId: "dec_legacy" });
    await writeFile(ledgerPath, `${JSON.stringify(legacy)}\n`, "utf8");

    const entries = await readDecisions(ledgerPath);
    const integrity = await getLedgerIntegrity(ledgerPath);

    expect(entries).toHaveLength(1);
    expect(integrity.recordCount).toBe(1);
    expect(integrity.legacyRecordCount).toBe(1);
  });
});

describe("getLedgerSnapshot", () => {
  it("returns zero totals when ledger is empty", async () => {
    const snapshot = await getLedgerSnapshot(ledgerPath, {
      now: new Date("2026-06-18T12:00:00.000Z"),
    });
    expect(snapshot.dailyTotals).toEqual({});
    expect(snapshot.windowStart).toBe("2026-06-17T12:00:00.000Z");
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
          explanation: { summary: "Denied." },
          decisionId: "dec_001",
          timestamp: now,
        },
      }),
      ledgerPath,
    );

    const snapshot = await getLedgerSnapshot(ledgerPath);
    expect(snapshot.dailyTotals["agent-1|openai.com"]).toBeUndefined();
  });

  it("uses a rolling 24-hour window instead of the calendar day", async () => {
    const withinWindow = new Date("2026-06-17T13:00:00.000Z").toISOString();
    const outsideWindow = new Date("2026-06-17T11:00:00.000Z").toISOString();

    await appendDecision(
      makeEntry({
        decisionId: "dec_inside",
        timestamp: withinWindow,
        response: {
          ...makeEntry().response,
          decisionId: "dec_inside",
          timestamp: withinWindow,
        },
      }),
      ledgerPath,
    );
    await appendDecision(
      makeEntry({
        decisionId: "dec_outside",
        timestamp: outsideWindow,
        response: {
          ...makeEntry().response,
          decisionId: "dec_outside",
          timestamp: outsideWindow,
        },
      }),
      ledgerPath,
    );

    const snapshot = await getLedgerSnapshot(ledgerPath, {
      now: new Date("2026-06-18T12:00:00.000Z"),
    });
    expect(snapshot.dailyTotals["agent-1|openai.com"]).toBe(20);
  });
});
