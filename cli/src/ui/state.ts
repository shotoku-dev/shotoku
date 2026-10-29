import {
  findMatchingRule,
  fromMicros,
  matchesPattern,
  toMicros,
  type ApprovalEntry,
  type AuthorizationStatus,
  type LedgerEntry,
  type LedgerSnapshot,
  type Policy,
} from "@shotoku/core";

/**
 * What the dashboard shows, computed from the ledger and the policy. Pure: the
 * server reads the files and passes them in, the page only renders.
 */

export type IntegrityState =
  | { readonly ok: true; readonly records: number }
  | { readonly ok: false; readonly message: string };

export interface DashboardInput {
  readonly decisions: readonly LedgerEntry[];
  readonly approvals: readonly ApprovalEntry[];
  /** Absent when the policy file could not be read; `policyError` says why. */
  readonly policy?: Policy;
  readonly policyError?: string;
  readonly snapshot: LedgerSnapshot;
  readonly integrity: IntegrityState;
  readonly now: Date;
}

export interface Resolution {
  readonly verdict: ApprovalEntry["verdict"];
  readonly approvalId: string;
  readonly via?: string;
  readonly timestamp: string;
}

export interface PendingRow {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly ageSeconds: number;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly amount?: number;
  readonly amountSource?: string;
  readonly summary: string;
  readonly reasons: readonly string[];
}

export interface HistoryRow {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly amount?: number;
  readonly amountSource?: string;
  readonly status: AuthorizationStatus;
  /** The human answer to a pending decision, if there is one. */
  readonly resolution?: Resolution;
  readonly summary: string;
  readonly reasons: readonly string[];
}

export interface BudgetRow {
  /** `agent`: a policy budget across resources. `resource`: one agent on one resource. */
  readonly kind: "agent" | "resource";
  readonly actor: string;
  readonly resource?: string;
  /** Dollars of approved spend in the rolling 24-hour window. */
  readonly spent: number;
  readonly limit?: number;
  readonly remaining?: number;
}

export interface DashboardState {
  readonly generatedAt: string;
  readonly pending: readonly PendingRow[];
  readonly history: readonly HistoryRow[];
  readonly budgets: readonly BudgetRow[];
  readonly totals: {
    readonly decisions: number;
    readonly approved: number;
    readonly denied: number;
    readonly pending: number;
    readonly spent24h: number;
  };
  readonly integrity: IntegrityState;
  readonly policyError?: string;
}

function amountFields(entry: LedgerEntry): { amount?: number; amountSource?: string } {
  const source = entry.request.context?.["amountSource"];
  return {
    ...(entry.request.amount !== undefined ? { amount: entry.request.amount } : {}),
    ...(typeof source === "string" ? { amountSource: source } : {}),
  };
}

function withLimit(row: Omit<BudgetRow, "limit" | "remaining">, limit: number | undefined): BudgetRow {
  if (limit === undefined) return row;
  return { ...row, limit, remaining: fromMicros(Math.max(0, toMicros(limit) - toMicros(row.spent))) };
}

function agentBudgetRows(policy: Policy, actorTotals: Readonly<Record<string, number>>): BudgetRow[] {
  const rows: BudgetRow[] = [];
  for (const budget of policy.budgets ?? []) {
    const covered = Object.entries(actorTotals).filter(([actor]) =>
      matchesPattern(budget.actor, actor),
    );

    if (budget.scope === "shared") {
      const spentMicros = covered.reduce((sum, [, micros]) => sum + micros, 0);
      rows.push(
        withLimit(
          { kind: "agent", actor: `${budget.actor} (shared)`, spent: fromMicros(spentMicros) },
          budget.maxDailyAmount,
        ),
      );
      continue;
    }

    // An exact name gets a row before it spends anything; a pattern only
    // for the agents it has actually seen.
    const actors = covered.length > 0 || budget.actor.includes("*")
      ? covered
      : [[budget.actor, 0] as const];
    for (const [actor, micros] of actors) {
      rows.push(withLimit({ kind: "agent", actor, spent: fromMicros(micros) }, budget.maxDailyAmount));
    }
  }
  return rows;
}

function resourceRows(
  policy: Policy | undefined,
  dailyTotals: Readonly<Record<string, number>>,
  latestByKey: ReadonlyMap<string, LedgerEntry>,
): BudgetRow[] {
  return Object.entries(dailyTotals).map(([key, micros]) => {
    const separator = key.indexOf("|");
    const actor = key.slice(0, separator);
    const resource = key.slice(separator + 1);
    // The limit shown is the one the last request for this pair matched;
    // action and rail can narrow a rule, so the request is needed, not just
    // the resource.
    const latest = latestByKey.get(key);
    const rule = policy && latest ? findMatchingRule(latest.request, policy) : undefined;
    return withLimit({ kind: "resource", actor, resource, spent: fromMicros(micros) }, rule?.maxDailyAmount);
  });
}

export function buildDashboardState(input: DashboardInput): DashboardState {
  const approvalFor = new Map(input.approvals.map((a) => [a.decisionId, a]));
  const latestByKey = new Map<string, LedgerEntry>();
  for (const entry of input.decisions) {
    latestByKey.set(`${entry.request.actor}|${entry.request.resource}`, entry);
  }

  const pending: PendingRow[] = input.decisions
    .filter((d) => d.response.status === "pending_approval" && !approvalFor.has(d.decisionId))
    .map((d) => ({
      decisionId: d.decisionId,
      timestamp: d.timestamp,
      ageSeconds: Math.max(0, Math.round((input.now.getTime() - Date.parse(d.timestamp)) / 1000)),
      actor: d.request.actor,
      action: d.request.action,
      resource: d.request.resource,
      ...amountFields(d),
      summary: d.response.explanation.summary,
      reasons: d.response.reasons.map((r) => r.text),
    }));

  const history: HistoryRow[] = [...input.decisions].reverse().map((d) => {
    const approval = approvalFor.get(d.decisionId);
    return {
      decisionId: d.decisionId,
      timestamp: d.timestamp,
      actor: d.request.actor,
      action: d.request.action,
      resource: d.request.resource,
      ...amountFields(d),
      status: d.response.status,
      ...(approval
        ? {
            resolution: {
              verdict: approval.verdict,
              approvalId: approval.approvalId,
              ...(approval.via ? { via: approval.via } : {}),
              timestamp: approval.timestamp,
            },
          }
        : {}),
      summary: d.response.explanation.summary,
      reasons: d.response.reasons.map((r) => r.text),
    };
  });

  const actorTotals = input.snapshot.actorTotals ?? {};
  const budgets = [
    ...(input.policy ? agentBudgetRows(input.policy, actorTotals) : []),
    ...resourceRows(input.policy, input.snapshot.dailyTotals, latestByKey),
  ];

  const count = (status: AuthorizationStatus) =>
    input.decisions.filter((d) => d.response.status === status).length;

  return {
    generatedAt: input.now.toISOString(),
    pending,
    history,
    budgets,
    totals: {
      decisions: input.decisions.length,
      approved: count("approved"),
      denied: count("denied"),
      pending: pending.length,
      spent24h: fromMicros(Object.values(actorTotals).reduce((sum, micros) => sum + micros, 0)),
    },
    integrity: input.integrity,
    ...(input.policyError ? { policyError: input.policyError } : {}),
  };
}
