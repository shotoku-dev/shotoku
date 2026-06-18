import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "../policy.js";
import type {
  AuthorizeRequest,
  Policy,
  LedgerSnapshot,
} from "../types.js";

const emptyLedger: LedgerSnapshot = { dailyTotals: {} };

const baseRequest: AuthorizeRequest = {
  actor: "agent-1",
  action: "purchase",
  resource: "openai.com",
  amount: 10,
};

describe("evaluatePolicy", () => {
  it("approves a known vendor under the transaction limit", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved", maxAmount: 50 }],
    };

    const result = evaluatePolicy(baseRequest, policy, emptyLedger);

    expect(result.status).toBe("approved");
    expect(result.reasons.some((r) => r.type === "policy_match")).toBe(true);
  });

  it("denies a known vendor over the daily limit", () => {
    const policy: Policy = {
      rules: [
        {
          resource: "openai.com",
          verdict: "approved",
          maxAmount: 50,
          maxDailyAmount: 100,
        },
      ],
    };
    const ledger: LedgerSnapshot = {
      dailyTotals: { "agent-1|openai.com": 95 },
    };

    const result = evaluatePolicy(baseRequest, policy, ledger);

    expect(result.status).toBe("denied");
    expect(result.reasons.some((r) => r.type === "budget_check")).toBe(true);
  });

  it("denies when the single transaction exceeds maxAmount", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved", maxAmount: 5 }],
    };

    const result = evaluatePolicy(baseRequest, policy, emptyLedger);

    expect(result.status).toBe("denied");
    expect(result.reasons.some((r) => r.type === "limit_check")).toBe(true);
  });

  it("returns pending_approval for an unknown vendor", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved" }],
    };
    const request: AuthorizeRequest = {
      ...baseRequest,
      resource: "vendor-xyz.com",
    };

    const result = evaluatePolicy(request, policy, emptyLedger);

    expect(result.status).toBe("pending_approval");
    expect(result.reasons.some((r) => r.type === "escalated")).toBe(true);
  });

  it("denies when no policy is provided (empty rules)", () => {
    const policy: Policy = { rules: [], defaultVerdict: "denied" };

    const result = evaluatePolicy(baseRequest, policy, emptyLedger);

    expect(result.status).toBe("denied");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("wildcard rule matches unknown resource and returns its verdict", () => {
    const policy: Policy = {
      rules: [{ resource: "*", verdict: "pending_approval" }],
    };
    const request: AuthorizeRequest = {
      ...baseRequest,
      resource: "some-unknown-api.io",
    };

    const result = evaluatePolicy(request, policy, emptyLedger);

    expect(result.status).toBe("pending_approval");
    expect(result.reasons.some((r) => r.type === "policy_match")).toBe(true);
  });

  it("rule scoped to specific actions only matches those actions", () => {
    const policy: Policy = {
      rules: [
        {
          resource: "openai.com",
          actions: ["api_call"],
          verdict: "approved",
        },
      ],
    };
    const purchaseRequest: AuthorizeRequest = {
      ...baseRequest,
      action: "purchase",
    };

    const result = evaluatePolicy(purchaseRequest, policy, emptyLedger);

    expect(result.status).not.toBe("approved");
  });
});
