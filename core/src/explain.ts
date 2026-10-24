import type { AuthorizationStatus, Explanation, ReasonItem } from "./types.js";

export function buildExplanation(
  status: AuthorizationStatus,
  reasons: readonly ReasonItem[],
  decisionId: string,
): Explanation {
  if (status === "approved") {
    const match = reasons.find((r) => r.type === "policy_match");
    const limit = reasons.find((r) => r.type === "limit_check");
    // Every budget line, not the first: a rule's per-vendor remainder and the
    // agent's total remainder are different numbers, and both matter.
    const budgets = reasons.filter((r) => r.type === "budget_check").map((r) => r.text);
    const parts = [match?.text, limit?.text, ...budgets].filter(Boolean);
    return { summary: parts.length > 0 ? parts.join(". ") : "Approved." };
  }

  if (status === "denied") {
    // The reason that caused the denial is appended last by the policy engine
    // (the failing limit_check / budget_check / blocked check), after any
    // policy_match. Surface that, not the match.
    const cause = reasons.at(-1);
    return { summary: cause ? cause.text : "Denied." };
  }

  // pending_approval
  const first = reasons[0];
  return {
    summary: first ? first.text : "Requires human approval.",
    hint: `shotoku approve ${decisionId}`,
  };
}
