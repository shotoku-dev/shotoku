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

  /**
   * Who receives the money — an x402 `payTo` address, for example. Rules with
   * `recipients` match only when this is one of them, and a human approval is
   * bound to it, so approving a payment to one address does not approve the
   * same payment to another.
   */
  readonly recipient?: string;

  /**
   * Digest of the request details that are not already in `resource` but that a
   * human approval should be bound to — MCP tool arguments, for example.
   *
   * A grant matches only when the fingerprint matches, so approving
   * `fs__write_file` for one path does not hand the agent a grant it can redeem
   * against another. Only the digest is recorded; the values themselves never
   * reach the ledger.
   */
  readonly fingerprint?: string;

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

  /**
   * Compact signed token present only on approved decisions when a receipt
   * secret is configured. Downstream infrastructure verifies it with
   * `verifyReceipt()` before executing the action.
   */
  readonly receipt?: string;
}

/** Claims carried inside a signed decision receipt. */
export interface ReceiptPayload {
  readonly v: 1;
  readonly decisionId: string;
  readonly actor: string;
  readonly action: AgentAction;
  readonly resource: string;
  readonly amount?: number;
  /** Present when the decision named a recipient; a payment proxy should check it. */
  readonly recipient?: string;
  /** Expiry, in seconds since the Unix epoch. */
  readonly exp: number;
}

export interface ReceiptVerification {
  readonly valid: boolean;
  /** Present only when the receipt is valid. */
  readonly payload?: ReceiptPayload;
  readonly reasons: readonly string[];
}

export interface LedgerIntegrity {
  readonly version: 1;
  readonly sequence: number;
  readonly previousHash: string;
  readonly hash: string;
}

/** The approval a decision redeemed, recorded on the decision that consumed it. */
export interface GrantReference {
  /** The approval record that created the grant. */
  readonly approvalId: string;

  /** The original pending decision a human approved. */
  readonly decisionId: string;
}

export interface LedgerEntry {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly request: AuthorizeRequest;
  readonly response: AuthorizeResponse;

  /**
   * Set when this decision was approved by redeeming a human approval of an
   * earlier, identical request. Its presence is also what marks that grant as
   * spent — a grant is open only while no decision references it.
   */
  readonly grant?: GrantReference;

  readonly integrity?: LedgerIntegrity;
}

/**
 * A human approval that has not been redeemed yet.
 *
 * Approvals used to be write-only audit data: `evaluatePolicy` never saw them,
 * so a human could approve a pending decision and the agent retrying would get
 * a fresh decision with the same pending verdict, forever. A grant is what makes
 * an approval mean something to the next request.
 */
export interface OpenGrant {
  readonly approvalId: string;
  readonly decisionId: string;

  /** When the human approved. Expiry runs from here, not from the decision. */
  readonly approvedAt: string;

  /** Signature of the request that was approved. See `grantSignature`. */
  readonly signature: string;
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
  /** Resource pattern; `*` is a wildcard (e.g. "openai.com/*", "*.openai.com"). */
  readonly resource: string;

  /** Restricts the rule to actors matching this pattern (`*` wildcard, e.g. "team-*"). Omit to match all actors. */
  readonly actor?: string;

  /** Limits which actions this rule applies to. Omit to match all actions. */
  readonly actions?: readonly AgentAction[];

  /** Limits which execution rails this rule applies to. Omit to match all rails. */
  readonly rails?: readonly ExecutionRail[];

  /**
   * Limits the rule to payments to these recipients (exact addresses; EVM `0x`
   * addresses compare case-insensitively). A request with no recipient does not
   * match. Omit to match any recipient.
   */
  readonly recipients?: readonly string[];

  /** Decision to issue when this rule matches. */
  readonly verdict: AuthorizationStatus;

  /** Maximum allowed amount per single transaction. */
  readonly maxAmount?: number;

  /** Maximum allowed total spend for this resource in a rolling 24-hour window. */
  readonly maxDailyAmount?: number;
}

/**
 * A spend ceiling across every resource, checked after the rules.
 *
 * Rule limits are keyed on actor + resource, so on their own they cap spend per
 * vendor, never in total: a `resource: "*"` rule with `maxDailyAmount: 200`
 * hands out 200 per distinct resource. A budget is what bounds an agent's total.
 */
export interface PolicyBudget {
  /** Actors this budget applies to (`*` wildcard, e.g. "*" or "research-*"). */
  readonly actor: string;

  /** Rolling 24-hour ceiling on approved spend, across all resources. */
  readonly maxDailyAmount: number;

  /**
   * `per_actor` (default): each matching actor has its own ceiling.
   * `shared`: all matching actors draw from one pool. A shared budget holds even
   * when an agent can choose its own actor name, which a per-actor one cannot.
   */
  readonly scope?: BudgetScope;
}

export type BudgetScope = "per_actor" | "shared";

export interface Policy {
  readonly rules: readonly PolicyRule[];

  /**
   * Spend ceilings across all resources. Every budget whose `actor` matches
   * applies, and an approved request must fit under all of them. A human
   * approval does not lift them either.
   */
  readonly budgets?: readonly PolicyBudget[];

  /** Verdict when no rule matches the request. Defaults to "pending_approval". */
  readonly defaultVerdict?: AuthorizationStatus;

  /**
   * How long a human approval stays redeemable, in seconds. Defaults to 900.
   *
   * Expiry runs from the approval, not from the decision: a decision may sit
   * pending for an hour before anyone looks at it, and anchoring on the decision
   * would make long-pending approvals expire the moment they are granted.
   */
  readonly grantTtlSeconds?: number;
}

/** Pre-computed daily totals passed into the policy evaluator. Key format: "${actor}|${resource}". */
export interface LedgerSnapshot {
  /** Approved spend per actor|resource, in integer micro-units (see money.ts). */
  readonly dailyTotals: Readonly<Record<string, number>>;

  /**
   * Approved spend per actor across all resources, in micro-units. Needed by
   * policy budgets; when absent, a request a budget applies to is denied rather
   * than checked against nothing.
   */
  readonly actorTotals?: Readonly<Record<string, number>>;

  readonly windowStart: string;

  /**
   * Human approvals not yet redeemed. Optional so that hand-built snapshots —
   * in tests and in embedding code — keep compiling.
   */
  readonly openGrants?: readonly OpenGrant[];
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
