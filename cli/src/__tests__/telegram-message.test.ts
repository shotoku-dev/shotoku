import { describe, it, expect } from "vitest";
import type { ApprovalEntry, LedgerEntry } from "@shotoku/core";
import {
  encodeCallback,
  parseCallback,
  pendingMessage,
  resolvedElsewhereMessage,
  resolvedMessage,
} from "../telegram/message.js";

function pending(overrides: Partial<LedgerEntry["request"]> = {}): LedgerEntry {
  const timestamp = "2026-10-26T14:05:22.000Z";
  return {
    decisionId: "dec_092405fc58b6",
    timestamp,
    request: {
      actor: "support-agent",
      action: "mcp_tool",
      resource: "paypal__create_refund",
      rail: "mcp",
      amount: 480,
      context: { amountSource: "full refund of capture 2PY84818WJ8069634" },
      ...overrides,
    },
    response: {
      approved: false,
      status: "pending_approval",
      reasons: [
        { type: "policy_match", text: "paypal__create_refund matched rule" },
        { type: "escalated", text: "Amount $480 exceeds per-transaction limit of $100" },
      ],
      explanation: {
        summary: "Amount $480 exceeds per-transaction limit of $100",
        hint: "shotoku approve dec_092405fc58b6",
      },
      decisionId: "dec_092405fc58b6",
      timestamp,
    },
  };
}

const approval: ApprovalEntry = {
  kind: "approval",
  approvalId: "apr_49da94a10d1e",
  decisionId: "dec_092405fc58b6",
  verdict: "approved",
  timestamp: "2026-10-26T14:06:01.000Z",
  via: "telegram:123456",
};

describe("pendingMessage", () => {
  it("says who wants to do what, for how much, and why a human is asked", () => {
    const { text } = pendingMessage(pending());

    expect(text.split("\n")[0]).toBe("◷ PENDING APPROVAL  dec_092405fc58b6");
    expect(text).toContain("support-agent → paypal__create_refund");
    expect(text).toContain("Amount: $480 · full refund of capture 2PY84818WJ8069634");
    expect(text).toContain("Amount $480 exceeds per-transaction limit of $100");
  });

  it("offers approve and deny buttons bound to this decision", () => {
    const { keyboard } = pendingMessage(pending());

    expect(keyboard).toEqual([
      [
        { text: "✓ Approve", callback_data: "approve:dec_092405fc58b6" },
        { text: "✗ Deny", callback_data: "deny:dec_092405fc58b6" },
      ],
    ]);
  });

  it("does not invent an amount the request did not have", () => {
    const { amount: _omitted, ...request } = pending().request;
    const { text } = pendingMessage({ ...pending(), request });

    expect(text).not.toMatch(/^Amount: /m);
    expect(text).toContain("support-agent → paypal__create_refund");
  });
});

describe("resolvedMessage", () => {
  it("replaces the prompt with the outcome and tells the human what happens next", () => {
    const text = resolvedMessage(pending(), approval);

    expect(text.split("\n")[0]).toBe("✓ APPROVED  dec_092405fc58b6");
    expect(text).toContain("apr_49da94a10d1e");
    expect(text).toContain("retry");
  });

  it("says denied for a denial", () => {
    const text = resolvedMessage(pending(), { ...approval, verdict: "denied" });

    expect(text.split("\n")[0]).toBe("✗ DENIED  dec_092405fc58b6");
  });
});

describe("resolvedElsewhereMessage", () => {
  it("names the approval made somewhere else", () => {
    const { via: _via, ...fromTerminal } = approval;
    const text = resolvedElsewhereMessage(pending(), fromTerminal);

    expect(text.split("\n")[0]).toBe("✓ APPROVED  dec_092405fc58b6");
    expect(text).toContain("elsewhere");
  });
});

describe("callback data", () => {
  it("round-trips a verdict and a decision ID", () => {
    expect(parseCallback(encodeCallback("approved", "dec_abc123"))).toEqual({
      verdict: "approved",
      decisionId: "dec_abc123",
    });
    expect(parseCallback(encodeCallback("denied", "dec_abc123"))).toEqual({
      verdict: "denied",
      decisionId: "dec_abc123",
    });
  });

  it("rejects anything it did not produce", () => {
    for (const data of [
      undefined,
      42,
      "",
      "approve",
      "approve:",
      "grant:dec_abc123",
      "approve:apr_abc123",
      "approve:dec_abc123:extra",
      `approve:dec_${"a".repeat(60)}`,
    ]) {
      expect(parseCallback(data)).toBeUndefined();
    }
  });
});
