export type ExecutionRail = "x402" | "mcp" | "api" | "code" | "custom";

export type AgentAction =
  | "purchase"
  | "api_call"
  | "execute_code"
  | "send_email"
  | "mcp_tool"
  | "custom";

export interface AuthorizeRequest {
  /** Agent requesting the action. */
  readonly actor: string;

  /** Action the agent wants to perform. */
  readonly action: AgentAction;

  /** Target resource. */
  readonly resource: string;

  /** Execution rail (x402, MCP, etc.). */
  readonly rail?: ExecutionRail;

  /** Monetary amount when applicable. */
  readonly amount?: number;

  /** Additional metadata. */
  readonly context?: Record<string, unknown>;
}

export interface ReasonItem {
  readonly type:
    | "policy_match"
    | "budget_check"
    | "limit_check"
    | "blocked"
    | "escalated";

  readonly text: string;
}

export type AuthorizationStatus = "approved" | "denied" | "pending_approval";

export interface AuthorizeResponse {
  readonly approved: boolean;
  readonly status: AuthorizationStatus;
  readonly reasons: readonly ReasonItem[];
  readonly decisionId: string;
  readonly timestamp: string;
}

export interface LedgerEntry {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly request: AuthorizeRequest;
  readonly response: AuthorizeResponse;
}

export interface PolicyRule {
  /** Exact resource string or "*" to match any resource. */
  readonly resource: string;

  /** Limits which actions this rule applies to. Omit to match all actions. */
  readonly actions?: readonly AgentAction[];

  /** Decision to issue when this rule matches. */
  readonly verdict: AuthorizationStatus;

  /** Maximum allowed amount per single transaction. */
  readonly maxAmount?: number;

  /** Maximum allowed total spend for this resource in a rolling 24-hour window. */
  readonly maxDailyAmount?: number;
}

export interface Policy {
  readonly rules: readonly PolicyRule[];

  /** Verdict when no rule matches the request. Defaults to "pending_approval". */
  readonly defaultVerdict?: AuthorizationStatus;
}

/** Pre-computed daily totals passed into the policy evaluator. Key format: "${actor}|${resource}". */
export interface LedgerSnapshot {
  readonly dailyTotals: Readonly<Record<string, number>>;
}

/** What the policy engine returns before it is written to the ledger. */
export interface EvaluationResult {
  readonly status: AuthorizationStatus;
  readonly reasons: readonly ReasonItem[];
}
