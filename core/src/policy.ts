import type {
  AuthorizeRequest,
  EvaluationResult,
  LedgerSnapshot,
  Policy,
  PolicyRule,
  ReasonItem,
} from "./types.js";

function ledgerKey(actor: string, resource: string): string {
  return `${actor}|${resource}`;
}

/**
 * Match a request resource against a rule pattern. `*` is a wildcard for any
 * run of characters (e.g. `api.openai.com/v1/*`, `*.openai.com`); every other
 * character is matched literally. A pattern with no `*` must match exactly.
 */
function resourceMatches(pattern: string, resource: string): boolean {
  if (!pattern.includes("*")) return pattern === resource;

  const regex = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex metacharacters (incl. *)
    .replace(/\\\*/g, ".*"); // then turn the escaped wildcards back into ".*"

  return new RegExp(`^${regex}$`).test(resource);
}

function matchesRule(request: AuthorizeRequest, rule: PolicyRule): boolean {
  if (!resourceMatches(rule.resource, request.resource)) return false;

  if (rule.actions && !rule.actions.includes(request.action)) return false;
  if (rule.rails && (request.rail === undefined || !rule.rails.includes(request.rail))) {
    return false;
  }

  return true;
}

export function evaluatePolicy(
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
    if (request.amount > matchedRule.maxAmount) {
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
    const spent = ledger.dailyTotals[key] ?? 0;
    const incoming = request.amount ?? 0;

    if (spent + incoming > matchedRule.maxDailyAmount) {
      return {
        status: "denied",
        reasons: [
          ...reasons,
          {
            type: "budget_check",
            text: `Daily total $${spent + incoming} would exceed daily limit of $${matchedRule.maxDailyAmount}`,
          },
        ],
      };
    }
    reasons.push({
      type: "budget_check",
      text: `Daily budget remaining: $${matchedRule.maxDailyAmount - spent - incoming}`,
    });
  }

  return { status: matchedRule.verdict, reasons };
}
