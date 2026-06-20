import { describe, it, expect } from "vitest";
import { formatHistoryTable, formatStatus, formatDecision } from "../format.js";
import type { ApprovalEntry, LedgerEntry } from "@shotoku/core";

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    decisionId: "dec_001",
    timestamp: new Date("2026-06-18T10:00:00.000Z").toISOString(),
    request: { actor: "agent-1", action: "purchase", resource: "openai.com", amount: 20 },
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

describe("formatHistoryTable", () => {
  it("returns empty state message when no entries", () => {
    expect(formatHistoryTable([])).toBe("No decisions found.");
  });

  it("includes filter context in empty state message", () => {
    expect(formatHistoryTable([], { actor: "unknown-agent" })).toContain("unknown-agent");
    expect(formatHistoryTable([], { status: "denied" })).toContain("denied");
    expect(formatHistoryTable([], { since: "24h" })).toContain("24h");
  });

  it("shows resolution tag for actioned pending entries", () => {
    const pending = makeEntry({
      decisionId: "dec_p1",
      response: {
        ...makeEntry().response,
        approved: false,
        status: "pending_approval",
        decisionId: "dec_p1",
      },
    });
    const approval: ApprovalEntry = {
      kind: "approval",
      approvalId: "apr_001",
      decisionId: "dec_p1",
      verdict: "approved",
      timestamp: new Date().toISOString(),
    };
    const out = formatHistoryTable([pending], { approvals: [approval] });
    expect(out).toContain("[✓ approved]");
  });

  it("shows resolved count in summary when approvals present", () => {
    const pending = makeEntry({
      decisionId: "dec_p1",
      response: {
        ...makeEntry().response,
        approved: false,
        status: "pending_approval",
        decisionId: "dec_p1",
      },
    });
    const approval: ApprovalEntry = {
      kind: "approval",
      approvalId: "apr_001",
      decisionId: "dec_p1",
      verdict: "denied",
      timestamp: new Date().toISOString(),
    };
    const out = formatHistoryTable([pending], { approvals: [approval] });
    expect(out).toContain("1 resolved");
  });

  it("renders ✓ icon for approved entries", () => {
    const out = formatHistoryTable([makeEntry()]);
    expect(out).toContain("✓");
    expect(out).toContain("dec_001");
    expect(out).toContain("agent-1");
    expect(out).toContain("openai.com");
  });

  it("renders ✗ icon for denied entries", () => {
    const entry = makeEntry({
      decisionId: "dec_002",
      response: {
        ...makeEntry().response,
        approved: false,
        status: "denied",
        decisionId: "dec_002",
      },
    });
    expect(formatHistoryTable([entry])).toContain("✗");
  });

  it("renders ◷ icon for pending entries", () => {
    const entry = makeEntry({
      decisionId: "dec_003",
      response: {
        ...makeEntry().response,
        approved: false,
        status: "pending_approval",
        decisionId: "dec_003",
      },
    });
    expect(formatHistoryTable([entry])).toContain("◷");
  });

  it("renders summary line with counts", () => {
    const approved = makeEntry({ decisionId: "dec_001" });
    const denied = makeEntry({
      decisionId: "dec_002",
      response: { ...makeEntry().response, approved: false, status: "denied", decisionId: "dec_002" },
    });
    const out = formatHistoryTable([approved, denied]);
    expect(out).toContain("2 total");
    expect(out).toContain("1 approved");
    expect(out).toContain("1 denied");
    expect(out).toContain("0 pending");
  });
});

describe("formatStatus", () => {
  it("shows no pending message when empty", () => {
    expect(formatStatus([])).toContain("No pending approvals.");
  });

  it("shows pending count, entry detail, and approve/deny hints", () => {
    const pending = makeEntry({
      decisionId: "dec_p1",
      response: {
        ...makeEntry().response,
        approved: false,
        status: "pending_approval",
        decisionId: "dec_p1",
        reasons: [{ type: "escalated", text: "vendor not on allowlist" }],
        explanation: { summary: "vendor not on allowlist", hint: "shotoku approve dec_p1" },
      },
    });
    const out = formatStatus([pending]);
    expect(out).toContain("1 pending approval");
    expect(out).toContain("dec_p1");
    expect(out).toContain("agent-1");
    expect(out).toContain("purchase");
    expect(out).toContain("openai.com");
    expect(out).toContain("vendor not on allowlist");
    expect(out).toContain("shotoku approve dec_p1");
    expect(out).toContain("shotoku deny dec_p1");
  });

  it("hides actioned pending entries when approvals are passed", () => {
    const pending = makeEntry({
      decisionId: "dec_p1",
      response: {
        ...makeEntry().response,
        approved: false,
        status: "pending_approval",
        decisionId: "dec_p1",
      },
    });
    const approval: import("@shotoku/core").ApprovalEntry = {
      kind: "approval",
      approvalId: "apr_001",
      decisionId: "dec_p1",
      verdict: "approved",
      timestamp: new Date().toISOString(),
    };
    const out = formatStatus([pending], [approval]);
    expect(out).toContain("No pending approvals.");
  });

  it("shows last decision", () => {
    const out = formatStatus([makeEntry()]);
    expect(out).toContain("Last decision:");
    expect(out).toContain("dec_001");
  });
});

describe("formatDecision", () => {
  it("shows actor, action, resource, and reasons", () => {
    const out = formatDecision(makeEntry());
    expect(out).toContain("agent-1");
    expect(out).toContain("purchase");
    expect(out).toContain("openai.com");
    expect(out).toContain("openai.com matched rule");
  });

  it("shows amount when present", () => {
    expect(formatDecision(makeEntry())).toContain("$20");
  });

  it("shows approve hint for pending decisions", () => {
    const entry = makeEntry({
      decisionId: "dec_p1",
      response: {
        ...makeEntry().response,
        approved: false,
        status: "pending_approval",
        decisionId: "dec_p1",
        reasons: [{ type: "escalated", text: "vendor not on allowlist" }],
        explanation: { summary: "vendor not on allowlist", hint: "shotoku approve dec_p1" },
      },
    });
    const out = formatDecision(entry);
    expect(out).toContain("shotoku approve dec_p1");
  });
});
