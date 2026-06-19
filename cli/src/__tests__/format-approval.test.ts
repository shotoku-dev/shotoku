import { describe, it, expect } from "vitest";
import { formatApproval, formatStatus, formatDecision } from "../format.js";
import type { ApprovalEntry, LedgerEntry } from "@shotoku/core";

function pending(id: string): LedgerEntry {
  const timestamp = new Date("2026-06-18T10:00:00.000Z").toISOString();
  return {
    decisionId: id,
    timestamp,
    request: { actor: "agent-1", action: "purchase", resource: "vendor-xyz.com", amount: 30 },
    response: {
      approved: false,
      status: "pending_approval",
      reasons: [{ type: "escalated", text: "vendor-xyz.com is not on the allowlist" }],
      decisionId: id,
      timestamp,
    },
  };
}

function approval(decisionId: string, verdict: "approved" | "denied"): ApprovalEntry {
  return {
    kind: "approval",
    approvalId: "apr_abc123",
    decisionId,
    verdict,
    timestamp: new Date("2026-06-18T11:00:00.000Z").toISOString(),
  };
}

describe("formatApproval", () => {
  it("renders an approved confirmation", () => {
    const out = formatApproval(approval("dec_p1", "approved"));
    expect(out).toContain("✓ Approved");
    expect(out).toContain("apr_abc123");
  });

  it("renders a denied confirmation", () => {
    const out = formatApproval(approval("dec_p1", "denied"));
    expect(out).toContain("✗ Denied");
    expect(out).toContain("apr_abc123");
  });
});

describe("formatStatus with approvals", () => {
  it("drops decisions that have been actioned", () => {
    const out = formatStatus([pending("dec_p1")], [approval("dec_p1", "approved")]);
    expect(out).toContain("No pending approvals.");
  });

  it("still lists decisions that have not been actioned", () => {
    const out = formatStatus([pending("dec_p1")], []);
    expect(out).toContain("1 pending approval");
    expect(out).toContain("dec_p1");
  });
});

describe("formatDecision with approval", () => {
  it("shows the resolution and hides the approve hint once actioned", () => {
    const out = formatDecision(pending("dec_p1"), approval("dec_p1", "approved"));
    expect(out).toContain("Resolution");
    expect(out).toContain("apr_abc123");
    expect(out).not.toContain("→ Run: shotoku approve");
  });
});
