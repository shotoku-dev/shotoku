import { describe, it, expect } from "vitest";
import type {
  ApprovalEntry,
  AuthorizationStatus,
  LedgerEntry,
  LedgerSnapshot,
  Policy,
} from "@shotoku/core";
import { buildDashboardState, type DashboardInput } from "../ui/state.js";

const NOW = new Date("2026-10-26T15:00:00.000Z");

function decision(
  decisionId: string,
  status: AuthorizationStatus,
  minutesAgo: number,
  overrides: Partial<LedgerEntry["request"]> = {},
): LedgerEntry {
  const timestamp = new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
  return {
    decisionId,
    timestamp,
    request: {
      actor: "support-agent",
      action: "mcp_tool",
      resource: "paypal__create_refund",
      rail: "mcp",
      amount: 89,
      ...overrides,
    },
    response: {
      approved: status === "approved",
      status,
      reasons: [{ type: "policy_match", text: "paypal__create_refund matched rule" }],
      explanation: { summary: `summary of ${decisionId}` },
      decisionId,
      timestamp,
    },
  };
}

const policy: Policy = {
  rules: [
    { resource: "paypal__create_refund", verdict: "approved", maxAmount: 100, maxDailyAmount: 1000 },
    { resource: "paypal__list_*", verdict: "approved" },
  ],
  budgets: [{ actor: "support-agent", maxDailyAmount: 1000 }],
};

function input(overrides: Partial<DashboardInput> = {}): DashboardInput {
  const snapshot: LedgerSnapshot = {
    dailyTotals: { "support-agent|paypal__create_refund": 569_000_000 },
    actorTotals: { "support-agent": 569_000_000 },
    windowStart: new Date(NOW.getTime() - 86_400_000).toISOString(),
  };
  return {
    decisions: [],
    approvals: [],
    policy,
    snapshot,
    integrity: { ok: true, records: 0 },
    now: NOW,
    ...overrides,
  };
}

describe("buildDashboardState — pending", () => {
  it("lists open pending decisions, oldest first, with their age and price source", () => {
    const state = buildDashboardState(
      input({
        decisions: [
          decision("dec_old", "pending_approval", 10, {
            amount: 480,
            context: { amountSource: "full refund of capture 2PY84818WJ8069634" },
          }),
          decision("dec_new", "pending_approval", 1),
          decision("dec_done", "approved", 5),
        ],
      }),
    );

    expect(state.pending.map((p) => p.decisionId)).toEqual(["dec_old", "dec_new"]);
    expect(state.pending[0]?.ageSeconds).toBe(600);
    expect(state.pending[0]?.amount).toBe(480);
    expect(state.pending[0]?.amountSource).toBe("full refund of capture 2PY84818WJ8069634");
    expect(state.pending[0]?.summary).toBe("summary of dec_old");
  });

  it("drops pending decisions a human already answered", () => {
    const approval: ApprovalEntry = {
      kind: "approval",
      approvalId: "apr_1",
      decisionId: "dec_old",
      verdict: "denied",
      timestamp: NOW.toISOString(),
    };

    const state = buildDashboardState(
      input({ decisions: [decision("dec_old", "pending_approval", 10)], approvals: [approval] }),
    );

    expect(state.pending).toEqual([]);
  });
});

describe("buildDashboardState — history", () => {
  it("lists every decision newest first, with the human answer and its channel", () => {
    const approval: ApprovalEntry = {
      kind: "approval",
      approvalId: "apr_1",
      decisionId: "dec_held",
      verdict: "approved",
      timestamp: NOW.toISOString(),
      via: "telegram:123456",
    };

    const state = buildDashboardState(
      input({
        decisions: [decision("dec_first", "approved", 20), decision("dec_held", "pending_approval", 10)],
        approvals: [approval],
      }),
    );

    expect(state.history.map((h) => h.decisionId)).toEqual(["dec_held", "dec_first"]);
    expect(state.history[0]?.status).toBe("pending_approval");
    expect(state.history[0]?.resolution).toEqual({
      verdict: "approved",
      approvalId: "apr_1",
      via: "telegram:123456",
      timestamp: NOW.toISOString(),
    });
    expect(state.history[1]?.resolution).toBeUndefined();
    expect(state.history[1]?.reasons).toEqual(["paypal__create_refund matched rule"]);
  });

  it("counts decisions by outcome", () => {
    const state = buildDashboardState(
      input({
        decisions: [
          decision("dec_a", "approved", 3),
          decision("dec_b", "denied", 2),
          decision("dec_c", "pending_approval", 1),
        ],
      }),
    );

    expect(state.totals).toEqual({ decisions: 3, approved: 1, denied: 1, pending: 1, spent24h: 569 });
  });
});

describe("buildDashboardState — budgets", () => {
  it("shows each agent budget against what the agent spent in 24 hours", () => {
    const state = buildDashboardState(input());

    expect(state.budgets).toContainEqual({
      kind: "agent",
      actor: "support-agent",
      spent: 569,
      limit: 1000,
      remaining: 431,
    });
  });

  it("shows a shared budget once, summed over the actors it covers", () => {
    const state = buildDashboardState(
      input({
        policy: { rules: [], budgets: [{ actor: "team-*", maxDailyAmount: 100, scope: "shared" }] },
        snapshot: {
          dailyTotals: {},
          actorTotals: { "team-a": 30_000_000, "team-b": 20_000_000, other: 99_000_000 },
          windowStart: "",
        },
      }),
    );

    expect(state.budgets).toEqual([
      { kind: "agent", actor: "team-* (shared)", spent: 50, limit: 100, remaining: 50 },
    ]);
  });

  it("shows a per-agent wildcard budget for each agent it covers", () => {
    const state = buildDashboardState(
      input({
        policy: { rules: [], budgets: [{ actor: "team-*", maxDailyAmount: 100 }] },
        snapshot: {
          dailyTotals: {},
          actorTotals: { "team-a": 30_000_000, "team-b": 20_000_000, other: 99_000_000 },
          windowStart: "",
        },
      }),
    );

    expect(state.budgets.map((b) => [b.actor, b.remaining])).toEqual([
      ["team-a", 70],
      ["team-b", 80],
    ]);
  });

  it("shows spend per agent and resource against the matched rule's daily limit", () => {
    const state = buildDashboardState(
      input({ decisions: [decision("dec_a", "approved", 3)] }),
    );

    expect(state.budgets).toContainEqual({
      kind: "resource",
      actor: "support-agent",
      resource: "paypal__create_refund",
      spent: 569,
      limit: 1000,
      remaining: 431,
    });
  });

  it("shows spend without a limit when no rule caps it", () => {
    const state = buildDashboardState(
      input({
        policy: { rules: [] },
        decisions: [decision("dec_a", "approved", 3)],
      }),
    );

    expect(state.budgets).toEqual([
      { kind: "resource", actor: "support-agent", resource: "paypal__create_refund", spent: 569 },
    ]);
  });

  it("never shows a negative remainder", () => {
    const state = buildDashboardState(
      input({ policy: { rules: [], budgets: [{ actor: "support-agent", maxDailyAmount: 100 }] } }),
    );

    expect(state.budgets.find((b) => b.kind === "agent")?.remaining).toBe(0);
  });

  it("still shows spend when the policy could not be loaded, and says why", () => {
    const { policy: _omitted, ...withoutPolicy } = input({
      decisions: [decision("dec_a", "approved", 3)],
    });

    const state = buildDashboardState({ ...withoutPolicy, policyError: "Policy file not found" });

    expect(state.policyError).toBe("Policy file not found");
    expect(state.budgets).toEqual([
      { kind: "resource", actor: "support-agent", resource: "paypal__create_refund", spent: 569 },
    ]);
  });
});

describe("buildDashboardState — integrity", () => {
  it("passes the ledger integrity report through", () => {
    const broken = buildDashboardState(
      input({ integrity: { ok: false, message: "hash chain broken at record 4" } }),
    );

    expect(broken.integrity).toEqual({ ok: false, message: "hash chain broken at record 4" });
  });
});
