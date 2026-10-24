import type {
  AuthorizeRequest,
  EvaluationResult,
  GrantReference,
  LedgerSnapshot,
  Policy,
  PolicyRule,
  ReasonItem,
} from "./types.js";
import { toMicros, fromMicros } from "./money.js";
import { findRedeemableGrant, grantTtlSeconds } from "./grant.js";
import { normalizeRecipient } from "./recipient.js";

function ledgerKey(actor: string, resource: string): string {
  return `${actor}|${resource}`;
}

/**
 * Match a value against a rule pattern. `*` is a wildcard for any run of
 * characters (e.g. `api.openai.com/v1/*`, `*.openai.com`, `team-*`); every other
 * character is matched literally. A pattern with no `*` must match exactly.
 */
function patternMatches(pattern: string, value: string): boolean {
  if (!pattern.includes("*")) return pattern === value;

  const regex = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex metacharacters (incl. *)
    .replace(/\\\*/g, ".*"); // then turn the escaped wildcards back into ".*"

  return new RegExp(`^${regex}$`).test(value);
}

function matchesRule(request: AuthorizeRequest, rule: PolicyRule): boolean {
  if (rule.actor !== undefined && !patternMatches(rule.actor, request.actor)) {
    return false;
  }
  if (!patternMatches(rule.resource, request.resource)) return false;

  if (rule.actions && !rule.actions.includes(request.action)) return false;
  if (rule.rails && (request.rail === undefined || !rule.rails.includes(request.rail))) {
    return false;
  }
  if (rule.recipients) {
    if (request.recipient === undefined) return false;
    const recipient = normalizeRecipient(request.recipient);
    if (!rule.recipients.some((allowed) => normalizeRecipient(allowed) === recipient)) {
      return false;
    }
  }

  return true;
}

export function evaluatePolicy(
  request: AuthorizeRequest,
  policy: Policy,
  ledger: LedgerSnapshot,
): EvaluationResult {
  return applyBudgets(evaluateRules(request, policy, ledger), request, policy, ledger);
}

function evaluateRules(
  request: AuthorizeRequest,
  policy: Policy,
  ledger: LedgerSnapshot,
): EvaluationResult {
  if (request.amount !== undefined) {
    if (!Number.isFinite(request.amount) || request.amount < 0) {
      return {
        status: "denied",
        reasons: [{ type: "blocked", text: "amount must be non-negative" }],
      };
    }
  }

  const matchedRule = policy.rules.find((rule) => matchesRule(request, rule));

  if (!matchedRule) {
    const defaultVerdict = policy.defaultVerdict ?? "pending_approval";
    const reason: ReasonItem =
      defaultVerdict === "pending_approval"
        ? { type: "escalated", text: `${request.resource} is not on the allowlist` }
        : { type: "blocked", text: `${request.resource} is not on the allowlist` };

    return { status: defaultVerdict, reasons: [reason] };
  }

  const reasons: ReasonItem[] = [
    { type: "policy_match", text: `${request.resource} matched rule` },
  ];

  if (matchedRule.verdict !== "approved") {
    return { status: matchedRule.verdict, reasons };
  }

  if (request.amount !== undefined && matchedRule.maxAmount !== undefined) {
    if (toMicros(request.amount) > toMicros(matchedRule.maxAmount)) {
      return {
        status: "denied",
        reasons: [
          ...reasons,
          {
            type: "limit_check",
            text: `Amount $${request.amount} exceeds per-transaction limit of $${matchedRule.maxAmount}`,
          },
        ],
      };
    }
    reasons.push({
      type: "limit_check",
      text: `Amount $${request.amount} is within per-transaction limit of $${matchedRule.maxAmount}`,
    });
  }

  if (matchedRule.maxDailyAmount !== undefined) {
    const key = ledgerKey(request.actor, request.resource);
    const spentMicros = ledger.dailyTotals[key] ?? 0;
    const incomingMicros = toMicros(request.amount ?? 0);
    const limitMicros = toMicros(matchedRule.maxDailyAmount);
    const totalMicros = spentMicros + incomingMicros;

    if (totalMicros > limitMicros) {
      return {
        status: "denied",
        reasons: [
          ...reasons,
          {
            type: "budget_check",
            text: `Daily total $${fromMicros(totalMicros)} would exceed daily limit of $${matchedRule.maxDailyAmount}`,
          },
        ],
      };
    }
    reasons.push({
      type: "budget_check",
      text: `Daily budget remaining: $${fromMicros(limitMicros - totalMicros)}`,
    });
  }

  return { status: matchedRule.verdict, reasons };
}

/**
 * Holds an approved request to every policy budget that applies to its actor.
 *
 * Runs on whatever the rules approved — including a `defaultVerdict: approved`
 * with no matching rule, which is exactly where a total ceiling matters most —
 * and again in `authorize()` after a grant upgrades a pending decision, because a
 * human clicking approve must not spend past a ceiling either. It only ever
 * turns `approved` into `denied`, never the reverse.
 */
export function applyBudgets(
  result: EvaluationResult,
  request: AuthorizeRequest,
  policy: Policy,
  ledger: LedgerSnapshot,
): EvaluationResult {
  if (result.status !== "approved" || request.amount === undefined) return result;

  const budgets = (policy.budgets ?? []).filter((budget) =>
    patternMatches(budget.actor, request.actor),
  );
  if (budgets.length === 0) return result;

  const actorTotals = ledger.actorTotals;
  if (actorTotals === undefined) {
    return {
      status: "denied",
      reasons: [
        ...result.reasons,
        {
          type: "budget_check",
          text: "Agent budget could not be checked: the ledger snapshot has no per-agent totals",
        },
      ],
    };
  }

  const incomingMicros = toMicros(request.amount);
  const reasons: ReasonItem[] = [...result.reasons];

  for (const budget of budgets) {
    const shared = budget.scope === "shared";
    const spentMicros = shared
      ? Object.entries(actorTotals)
          .filter(([actor]) => patternMatches(budget.actor, actor))
          .reduce((sum, [, micros]) => sum + micros, 0)
      : Object.hasOwn(actorTotals, request.actor)
        ? (actorTotals[request.actor] ?? 0)
        : 0;
    const totalMicros = spentMicros + incomingMicros;
    const limitMicros = toMicros(budget.maxDailyAmount);
    const label = shared
      ? `Shared daily budget for actors matching "${budget.actor}"`
      : `Daily budget for ${request.actor}`;

    if (totalMicros > limitMicros) {
      return {
        status: "denied",
        reasons: [
          ...reasons,
          {
            type: "budget_check",
            text: `${label}: total $${fromMicros(totalMicros)} would exceed $${budget.maxDailyAmount} across all resources`,
          },
        ],
      };
    }
    reasons.push({
      type: "budget_check",
      text: `${label}: $${fromMicros(limitMicros - totalMicros)} remaining across all resources`,
    });
  }

  return { status: "approved", reasons };
}

/**
 * Redeems a human approval, turning a `pending_approval` verdict into an
 * `approved` one.
 *
 * Deliberately a separate function composed after `evaluatePolicy` rather than a
 * branch inside it. Two reasons, both structural:
 *
 * A grant must never lift a `denied` verdict. A rule can say `approved` and
 * still deny because `maxDailyAmount` is exhausted, and no human clicking
 * approve should spend budget that is already gone. Keeping the upgrade in its
 * own function makes that invariant impossible to violate rather than a
 * convention buried in the evaluator branch order.
 *
 * And `evaluatePolicy` is a published export of `@shotoku/core`; changing its
 * signature would break every embedding caller. This also lets the clock arrive
 * as an explicit argument instead of being smuggled into `LedgerSnapshot`.
 */
export function applyGrant(
  result: EvaluationResult,
  request: AuthorizeRequest,
  policy: Policy,
  ledger: LedgerSnapshot,
  now: Date,
): GrantOutcome {
  if (result.status !== "pending_approval") return { result };

  const grants = ledger.openGrants ?? [];
  if (grants.length === 0) return { result };

  const grant = findRedeemableGrant(request, grants, grantTtlSeconds(policy), now);
  if (!grant) return { result };

  const reasons: ReasonItem[] = [
    ...result.reasons,
    {
      type: "policy_match",
      text: `Approved by a human as ${grant.decisionId}`,
    },
  ];

  return {
    result: { status: "approved", reasons },
    grant: { approvalId: grant.approvalId, decisionId: grant.decisionId },
  };
}

export interface GrantOutcome {
  readonly result: EvaluationResult;
  /** Present when a grant was redeemed; recorded on the resulting decision. */
  readonly grant?: GrantReference;
}
