import type { AuthorizationStatus, Explanation, ReasonItem } from "./types.js";

export function buildExplanation(
  status: AuthorizationStatus,
  reasons: readonly ReasonItem[],
  decisionId: string,
): Explanation {
  if (status === "approved") {
    const match = reasons.find((r) => r.type === "policy_match");
    const limit = reasons.find((r) => r.type === "limit_check" || r.type === "budget_check");
    const parts = [match?.text, limit?.text].filter(Boolean);
    return { summary: parts.length > 0 ? parts.join(". ") : "Approved." };
  }

  if (status === "denied") {
    const first = reasons[0];
    return { summary: first ? first.text : "Denied." };
  }

  // pending_approval
  const first = reasons[0];
  return {
    summary: first ? first.text : "Requires human approval.",
    hint: `shotoku approve ${decisionId}`,
  };
}
