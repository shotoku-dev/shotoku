import { describe, it, expect } from "vitest";
import { formatResponse, formatError } from "../format.js";
import type { AuthorizeResponse } from "@shotoku/core";

const base: AuthorizeResponse = {
  decisionId: "dec_abc123",
  timestamp: new Date("2026-06-18T14:05:22.000Z").toISOString(),
  approved: true,
  status: "approved",
  reasons: [
    { type: "policy_match", text: "openai.com matched rule" },
    { type: "budget_check", text: "Daily budget remaining: $80" },
  ],
};

describe("formatResponse", () => {
  it("approved output starts with ✓ APPROVED and includes decisionId", () => {
    const out = formatResponse(base);
    expect(out).toContain("✓ APPROVED");
    expect(out).toContain("dec_abc123");
    expect(out).toContain("• openai.com matched rule");
    expect(out).toContain("Recorded at");
  });

  it("denied output starts with ✗ DENIED and includes approve hint", () => {
    const response: AuthorizeResponse = {
      ...base,
      approved: false,
      status: "denied",
      reasons: [{ type: "limit_check", text: "Amount $20 exceeds limit of $5" }],
    };
    const out = formatResponse(response);
    expect(out).toContain("✗ DENIED");
    expect(out).toContain("dec_abc123");
    expect(out).toContain("• Amount $20 exceeds limit of $5");
    expect(out).toContain("shotoku approve dec_abc123");
  });

  it("pending output starts with ◷ PENDING APPROVAL and includes approve hint", () => {
    const response: AuthorizeResponse = {
      ...base,
      approved: false,
      status: "pending_approval",
      reasons: [{ type: "escalated", text: "vendor-xyz.com is not on the allowlist" }],
    };
    const out = formatResponse(response);
    expect(out).toContain("◷ PENDING APPROVAL");
    expect(out).toContain("shotoku approve dec_abc123");
  });
});

describe("formatError", () => {
  it("prefixes the message with ✗ Error:", () => {
    expect(formatError("policy file not found")).toBe(
      "✗ Error: policy file not found",
    );
  });
});
