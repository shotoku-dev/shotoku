import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { evaluatePolicy } from "../policy.js";
import { validatePolicy } from "../validation.js";
import type {
  AuthorizeRequest,
  Policy,
  LedgerSnapshot,
} from "../types.js";

/**
 * Builds a policy the way a user does — through YAML and the validator — rather
 * than as a TypeScript literal. The actor tests below use this deliberately:
 * hand-built `Policy` objects passed while `validatePolicy` rejected `actor`
 * outright, so the engine looked correct and every real policy file failed.
 */
function policyFromYaml(raw: string): Policy {
  return validatePolicy(parse(raw));
}

const emptyLedger: LedgerSnapshot = {
  dailyTotals: {},
  windowStart: new Date("2026-06-18T00:00:00.000Z").toISOString(),
};

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
      dailyTotals: { "agent-1|openai.com": 95_000_000 },
      windowStart: new Date("2026-06-18T00:00:00.000Z").toISOString(),
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

  it("explicit verdict: denied rule blocks without running limit checks", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "denied" }],
    };

    const result = evaluatePolicy(baseRequest, policy, emptyLedger);

    expect(result.status).toBe("denied");
    expect(result.reasons.some((r) => r.type === "policy_match")).toBe(true);
    expect(result.reasons.some((r) => r.type === "limit_check")).toBe(false);
    expect(result.reasons.some((r) => r.type === "budget_check")).toBe(false);
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

  it("rule scoped to specific rails only matches those rails", () => {
    const policy: Policy = {
      rules: [
        {
          resource: "openai.com",
          rails: ["mcp"],
          verdict: "approved",
        },
      ],
    };

    const result = evaluatePolicy(
      { ...baseRequest, rail: "x402" },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("pending_approval");
  });

  it("denies negative amounts before matching policy", () => {
    const policy: Policy = {
      rules: [{ resource: "*", verdict: "approved" }],
    };

    const result = evaluatePolicy(
      { ...baseRequest, amount: -1 },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("denied");
    expect(result.reasons[0]!.type).toBe("blocked");
  });
});

/**
 * A missing amount is not a zero amount. Wrapped MCP tools carry no amount, and
 * PayPal's `create_refund` without one refunds the whole capture — the most
 * expensive call, which used to sail through a $100 limit because the limit
 * checks were skipped and the daily total counted it as $0.
 */
describe("evaluatePolicy — unknown amount fails closed", () => {
  const { amount: _omitted, ...noAmount } = baseRequest;
  const unpriced: AuthorizeRequest = noAmount;

  it("holds a request with no amount against a maxAmount rule", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved", maxAmount: 100 }],
    };

    const result = evaluatePolicy(unpriced, policy, emptyLedger);

    expect(result.status).toBe("pending_approval");
    const escalated = result.reasons.find((r) => r.type === "escalated");
    expect(escalated?.text).toContain("Amount unknown");
    expect(escalated?.text).toContain("$100 per-transaction limit");
  });

  it("holds a request with no amount against a maxDailyAmount rule", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved", maxDailyAmount: 300 }],
    };

    const result = evaluatePolicy(unpriced, policy, emptyLedger);

    expect(result.status).toBe("pending_approval");
    const escalated = result.reasons.find((r) => r.type === "escalated");
    expect(escalated?.text).toContain("$300 daily limit");
  });

  it("names both limits when the rule has both", () => {
    const policy: Policy = {
      rules: [
        { resource: "openai.com", verdict: "approved", maxAmount: 100, maxDailyAmount: 300 },
      ],
    };

    const result = evaluatePolicy(unpriced, policy, emptyLedger);

    expect(result.status).toBe("pending_approval");
    const escalated = result.reasons.find((r) => r.type === "escalated");
    expect(escalated?.text).toContain("$100 per-transaction limit");
    expect(escalated?.text).toContain("$300 daily limit");
  });

  it("does not report a budget it never checked", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved", maxDailyAmount: 300 }],
    };

    const result = evaluatePolicy(unpriced, policy, emptyLedger);

    expect(result.reasons.some((r) => r.type === "budget_check")).toBe(false);
  });

  it("still approves a request with no amount when the rule has no limits", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved" }],
    };

    expect(evaluatePolicy(unpriced, policy, emptyLedger).status).toBe("approved");
  });

  it("treats an explicit zero as a known amount", () => {
    const policy: Policy = {
      rules: [
        { resource: "openai.com", verdict: "approved", maxAmount: 100, maxDailyAmount: 300 },
      ],
    };

    const result = evaluatePolicy({ ...baseRequest, amount: 0 }, policy, emptyLedger);

    expect(result.status).toBe("approved");
  });

  it("leaves a denied rule denied", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "denied", maxAmount: 100 }],
    };

    expect(evaluatePolicy(unpriced, policy, emptyLedger).status).toBe("denied");
  });

  it("applies to rules written in YAML", () => {
    const policy = policyFromYaml(`
rules:
  - resource: paypal__create_refund
    verdict: approved
    maxAmount: 100
    maxDailyAmount: 300
`);

    const result = evaluatePolicy(
      { actor: "support-agent", action: "mcp_tool", resource: "paypal__create_refund", rail: "mcp" },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("pending_approval");
  });
});

/**
 * Over a limit, the default is a denial. `overLimit: pending_approval` makes it
 * a question for a human instead: small refunds pass on their own, a big one
 * waits for someone to look at it.
 */
describe("evaluatePolicy — overLimit", () => {
  const ledgerWith = (micros: number): LedgerSnapshot => ({
    dailyTotals: { "agent-1|openai.com": micros },
    windowStart: new Date("2026-06-18T00:00:00.000Z").toISOString(),
  });

  it("holds a request over maxAmount for approval", () => {
    const policy: Policy = {
      rules: [
        { resource: "openai.com", verdict: "approved", maxAmount: 100, overLimit: "pending_approval" },
      ],
    };

    const result = evaluatePolicy({ ...baseRequest, amount: 480 }, policy, emptyLedger);

    expect(result.status).toBe("pending_approval");
    const escalated = result.reasons.find((r) => r.type === "escalated");
    expect(escalated?.text).toBe("Amount $480 exceeds per-transaction limit of $100");
  });

  it("holds a request over maxDailyAmount for approval", () => {
    const policy: Policy = {
      rules: [
        { resource: "openai.com", verdict: "approved", maxDailyAmount: 100, overLimit: "pending_approval" },
      ],
    };

    const result = evaluatePolicy(baseRequest, policy, ledgerWith(95_000_000));

    expect(result.status).toBe("pending_approval");
    const escalated = result.reasons.find((r) => r.type === "escalated");
    expect(escalated?.text).toContain("would exceed daily limit of $100");
  });

  it("still approves a request within the limits", () => {
    const policy: Policy = {
      rules: [
        {
          resource: "openai.com",
          verdict: "approved",
          maxAmount: 100,
          maxDailyAmount: 300,
          overLimit: "pending_approval",
        },
      ],
    };

    expect(evaluatePolicy(baseRequest, policy, emptyLedger).status).toBe("approved");
  });

  it("denies over the limit when overLimit says denied, as it does by default", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved", maxAmount: 5, overLimit: "denied" }],
    };

    const result = evaluatePolicy(baseRequest, policy, emptyLedger);

    expect(result.status).toBe("denied");
    expect(result.reasons.at(-1)?.type).toBe("limit_check");
  });

  it("does not soften a negative amount", () => {
    const policy: Policy = {
      rules: [
        { resource: "openai.com", verdict: "approved", maxAmount: 100, overLimit: "pending_approval" },
      ],
    };

    expect(evaluatePolicy({ ...baseRequest, amount: -1 }, policy, emptyLedger).status).toBe(
      "denied",
    );
  });

  it("does not soften an agent budget", () => {
    const policy = policyFromYaml(`
rules:
  - resource: openai.com
    verdict: approved
    maxAmount: 100
    overLimit: pending_approval
budgets:
  - actor: "*"
    maxDailyAmount: 20
`);
    const ledger: LedgerSnapshot = { ...emptyLedger, actorTotals: { "agent-1": 15_000_000 } };

    expect(evaluatePolicy(baseRequest, policy, ledger).status).toBe("denied");
  });
});

describe("evaluatePolicy — glob resource matching", () => {
  it("a trailing wildcard matches sub-paths of a resource", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com/*", verdict: "approved" }],
    };

    const result = evaluatePolicy(
      { ...baseRequest, resource: "openai.com/v1/chat" },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("approved");
    expect(result.reasons.some((r) => r.type === "policy_match")).toBe(true);
  });

  it("a wildcard rule does not match an unrelated resource", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com/*", verdict: "approved" }],
    };

    const result = evaluatePolicy(
      { ...baseRequest, resource: "evil.com/v1/chat" },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("pending_approval");
  });

  it("a leading wildcard matches subdomains", () => {
    const policy: Policy = {
      rules: [{ resource: "*.openai.com", verdict: "approved" }],
    };

    const result = evaluatePolicy(
      { ...baseRequest, resource: "api.openai.com" },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("approved");
  });

  it("an exact resource still matches exactly, not its sub-paths", () => {
    const policy: Policy = {
      rules: [{ resource: "openai.com", verdict: "approved" }],
    };

    const exact = evaluatePolicy(
      { ...baseRequest, resource: "openai.com" },
      policy,
      emptyLedger,
    );
    const subPath = evaluatePolicy(
      { ...baseRequest, resource: "openai.com/v1" },
      policy,
      emptyLedger,
    );

    expect(exact.status).toBe("approved");
    expect(subPath.status).toBe("pending_approval");
  });

  it("treats a dot in the pattern as a literal, not 'any character'", () => {
    const policy: Policy = {
      rules: [{ resource: "api.openai.com", verdict: "approved" }],
    };

    const result = evaluatePolicy(
      { ...baseRequest, resource: "apiXopenai.com" },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("pending_approval");
  });
});

describe("evaluatePolicy — actor matching", () => {
  it("a rule with an actor pattern only matches that actor", () => {
    const policy = policyFromYaml(
      "rules:\n  - resource: '*'\n    actor: billing-agent\n    verdict: approved\n",
    );

    const match = evaluatePolicy(
      { ...baseRequest, actor: "billing-agent" },
      policy,
      emptyLedger,
    );
    const other = evaluatePolicy(
      { ...baseRequest, actor: "other-agent" },
      policy,
      emptyLedger,
    );

    expect(match.status).toBe("approved");
    expect(other.status).toBe("pending_approval");
  });

  it("an actor wildcard matches a whole team", () => {
    const policy = policyFromYaml(
      "rules:\n  - resource: '*'\n    actor: team-*\n    verdict: approved\n",
    );

    const alpha = evaluatePolicy(
      { ...baseRequest, actor: "team-alpha" },
      policy,
      emptyLedger,
    );
    const outsider = evaluatePolicy(
      { ...baseRequest, actor: "rogue" },
      policy,
      emptyLedger,
    );

    expect(alpha.status).toBe("approved");
    expect(outsider.status).toBe("pending_approval");
  });

  it("a rule without an actor matches any actor", () => {
    const policy = policyFromYaml(
      "rules:\n  - resource: openai.com\n    verdict: approved\n",
    );

    const result = evaluatePolicy(
      { ...baseRequest, actor: "anyone" },
      policy,
      emptyLedger,
    );

    expect(result.status).toBe("approved");
  });
});
