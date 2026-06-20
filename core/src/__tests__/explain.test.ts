import { describe, it, expect } from "vitest";
import { buildExplanation } from "../explain.js";
import type { ReasonItem } from "../types.js";

const policyMatch: ReasonItem = { type: "policy_match", text: "openai.com matched rule" };
const limitCheck: ReasonItem = { type: "limit_check", text: "Amount $10 is within limit of $50" };
const budgetCheck: ReasonItem = { type: "budget_check", text: "Daily budget remaining: $190" };
const limitDenied: ReasonItem = { type: "limit_check", text: "Amount $100 exceeds limit of $50" };
const escalated: ReasonItem = { type: "escalated", text: "vendor-xyz.com is not on the allowlist" };

describe("buildExplanation — approved", () => {
  it("summary combines policy match and budget check", () => {
    const result = buildExplanation("approved", [policyMatch, limitCheck, budgetCheck], "dec_001");
    expect(result.summary).toContain("openai.com matched rule");
    expect(result.summary).toContain("Amount $10 is within limit of $50");
    expect(result.hint).toBeUndefined();
  });

  it("summary uses only policy match when no limit/budget reason present", () => {
    const result = buildExplanation("approved", [policyMatch], "dec_001");
    expect(result.summary).toBe("openai.com matched rule");
    expect(result.hint).toBeUndefined();
  });

  it("falls back to 'Approved.' when reasons are empty", () => {
    const result = buildExplanation("approved", [], "dec_001");
    expect(result.summary).toBe("Approved.");
  });
});

describe("buildExplanation — denied", () => {
  it("summary uses the first reason text", () => {
    const result = buildExplanation("denied", [policyMatch, limitDenied], "dec_001");
    expect(result.summary).toBe(policyMatch.text);
    expect(result.hint).toBeUndefined();
  });

  it("falls back to 'Denied.' when reasons are empty", () => {
    const result = buildExplanation("denied", [], "dec_001");
    expect(result.summary).toBe("Denied.");
  });
});

describe("buildExplanation — pending_approval", () => {
  it("summary uses the first reason and hint is the approve command", () => {
    const result = buildExplanation("pending_approval", [escalated], "dec_abc");
    expect(result.summary).toBe(escalated.text);
    expect(result.hint).toBe("shotoku approve dec_abc");
  });

  it("falls back to generic summary when reasons are empty", () => {
    const result = buildExplanation("pending_approval", [], "dec_abc");
    expect(result.summary).toBe("Requires human approval.");
    expect(result.hint).toBe("shotoku approve dec_abc");
  });
});
