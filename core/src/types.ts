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

/**
 * Synthesized human-readable explanation of a decision.
 * Intended for CLI output, MCP tool responses, TUI display, and SDK consumers.
 */
export interface Explanation {
  /** One-sentence summary of why the decision was made. */
  readonly summary: string;
  /** Actionable next step, if any (e.g. "shotoku approve dec_xxx" for pending). */
  readonly hint?: string;
}

export interface AuthorizeResponse {
  readonly approved: boolean;
  readonly status: AuthorizationStatus;
  readonly reasons: readonly ReasonItem[];
  readonly explanation: Explanation;
  readonly decisionId: string;
  readonly timestamp: string;
}

export interface LedgerIntegrity {
  readonly version: 1;
  readonly sequence: number;
  readonly previousHash: string;
  readonly hash: string;
}

export interface LedgerEntry {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly request: AuthorizeRequest;
  readonly response: AuthorizeResponse;
  readonly integrity?: LedgerIntegrity;
}

/**
 * A human approval or denial of a pending decision. Appended to the ledger as a
 * new record; the original decision is never mutated. The `kind` field
 * discriminates approval records from decision records in the JSONL file.
 */
export interface ApprovalEntry {
  readonly kind: "approval";

  /** Identifier for this approval action, e.g. "apr_abc123". */
  readonly approvalId: string;

  /** The decision this approval resolves. */
  readonly decisionId: string;

  /** Whether the human approved or denied the decision. */
  readonly verdict: "approved" | "denied";

  readonly timestamp: string;

  readonly integrity?: LedgerIntegrity;
}

export interface PolicyRule {
  /** Exact resource string or "*" to match any resource. */
  readonly resource: string;

  /** Limits which actions this rule applies to. Omit to match all actions. */
  readonly actions?: readonly AgentAction[];

  /** Limits which execution rails this rule applies to. Omit to match all rails. */
  readonly rails?: readonly ExecutionRail[];

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
  readonly windowStart: string;
}

export interface LedgerIntegrityReport {
  readonly recordCount: number;
  readonly legacyRecordCount: number;
  readonly headHash: string;
}

export interface SignedSnapshotSignature {
  readonly algorithm: "HMAC-SHA256";
  readonly value: string;
  readonly keyId?: string;
}

export interface SignedSnapshot {
  readonly version: 1;
  readonly createdAt: string;
  readonly policy: {
    readonly path: string;
    readonly hash: string;
  };
  readonly ledger: {
    readonly path: string;
    readonly headHash: string;
    readonly recordCount: number;
    readonly legacyRecordCount: number;
  };
  readonly signature: SignedSnapshotSignature;
}

export interface SnapshotVerification {
  readonly verified: boolean;
  readonly reasons: readonly string[];
}

/** What the policy engine returns before it is written to the ledger. */
export interface EvaluationResult {
  readonly status: AuthorizationStatus;
  readonly reasons: readonly ReasonItem[];
}
