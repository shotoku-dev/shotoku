# API Reference

This document covers the core `authorize()` function and the types it uses. If you are building an agent and want to check whether an action is allowed before it runs, this is the right place to start.

---

## `authorize(request, options)`

The main function. You describe what the agent wants to do, point it at your policy file and ledger, and it returns a decision.

```ts
import { authorize } from "@shotoku/core";

const response = await authorize(
  {
    actor: "agent-001",
    action: "api_call",
    resource: "api.openai.com",
    amount: 0.02,
  },
  {
    policyPath: "./policy.yaml",
    ledgerPath: "./data/decisions.jsonl",
  },
);
```

Under the hood it:
1. Loads your policy file
2. Reads today's spend totals from the ledger
3. Evaluates the request against your rules
4. Writes the decision to the ledger
5. Returns the result

### Options

| Field | Required | What it does |
|---|---|---|
| `policyPath` | yes | Path to your `policy.yaml` rules file |
| `ledgerPath` | yes | Path to the local file where decisions are stored |

---

## `approve(decisionId, options)` and `deny(decisionId, options)`

Resolve a `pending_approval` decision. `approve` lets the action proceed; `deny` blocks it. Both **append a new record** to the ledger — the original decision is never modified, so the audit trail stays intact.

```ts
import { approve, deny } from "@shotoku/core";

const result = await approve("dec_abc123", { ledgerPath: "data/decisions.jsonl" });
// result.approvalId -> "apr_..."
// result.verdict    -> "approved"
```

They throw if the decision does not exist, is not pending, or has already been resolved. The CLI turns these into readable errors rather than stack traces.

| Field | Required | What it does |
|---|---|---|
| `ledgerPath` | yes | Path to the local ledger file |

Each returns an [`ApprovalEntry`](#approvalentry).

---

## `AuthorizeRequest`

Describes the action an agent wants to take.

```ts
interface AuthorizeRequest {
  readonly actor: string;
  readonly action: AgentAction;
  readonly resource: string;
  readonly rail?: ExecutionRail;
  readonly amount?: number;
  readonly context?: Record<string, unknown>;
}
```

| Field | What it means |
|---|---|
| `actor` | Who is requesting the action — a name or ID for your agent, e.g. `"agent-001"` |
| `action` | The category of action being requested — see `AgentAction` below |
| `resource` | What the agent is acting on — a domain, API endpoint, or service name |
| `rail` | Optional: the execution channel being used (`"x402"`, `"mcp"`, `"api"`, etc.) |
| `amount` | Optional: how much this action costs in USD, if it involves spending |
| `context` | Optional: any extra details you want recorded alongside the decision |

---

## `AuthorizeResponse`

What `authorize()` gives back.

```ts
interface AuthorizeResponse {
  readonly approved: boolean;
  readonly status: AuthorizationStatus;
  readonly reasons: readonly ReasonItem[];
  readonly explanation: Explanation;
  readonly decisionId: string;
  readonly timestamp: string;
}
```

| Field | What it means |
|---|---|
| `approved` | `true` if the action can proceed, `false` otherwise |
| `status` | The full verdict — see `AuthorizationStatus` below |
| `reasons` | A list of specific checks that were run and what they found |
| `explanation` | A plain-English summary of the decision, ready to show to a user |
| `decisionId` | A unique ID for this decision, e.g. `"dec_abc123"` — use it to look up or act on this decision later |
| `timestamp` | When the decision was made, in ISO 8601 format |

---

## `AuthorizationStatus`

The three possible outcomes of an authorization check.

```ts
type AuthorizationStatus = "approved" | "denied" | "pending_approval";
```

| Value | What it means |
|---|---|
| `approved` | The request passed all policy checks. The agent can proceed. |
| `denied` | The request was blocked by a policy rule. The agent should stop. |
| `pending_approval` | No rule automatically approved or denied this. A human must decide. Run `shotoku approve <decisionId>` or `shotoku deny <decisionId>`. |

---

## `Explanation`

A plain-English summary of a decision, ready to show to a user. Carried on every `AuthorizeResponse`.

```ts
interface Explanation {
  readonly summary: string;
  readonly hint?: string;
}
```

| Field | What it means |
|---|---|
| `summary` | One sentence describing the decision. For approvals it stitches together the matched rule and any limit checks; for denials it states the check that failed. |
| `hint` | An actionable next step when there is one — e.g. `"shotoku approve dec_abc123"` for a pending decision. |

---

## `AgentAction`

The type of thing an agent wants to do.

```ts
type AgentAction =
  | "purchase"
  | "api_call"
  | "execute_code"
  | "send_email"
  | "mcp_tool"
  | "custom";
```

Use `"custom"` for anything that does not fit the other categories.

---

## `ExecutionRail`

The channel through which an action would be executed. Optional — include it if you want to write rules that apply to a specific channel only.

```ts
type ExecutionRail = "x402" | "mcp" | "api" | "code" | "custom";
```

---

## `ReasonItem`

One specific check that ran during policy evaluation. A decision always includes one or more of these.

```ts
interface ReasonItem {
  readonly type:
    | "policy_match"
    | "budget_check"
    | "limit_check"
    | "blocked"
    | "escalated";

  readonly text: string;
}
```

| Type | What triggered it |
|---|---|
| `policy_match` | A rule in your policy file matched this request |
| `limit_check` | The amount was checked against a per-transaction cap |
| `budget_check` | Today's spend total was checked against a daily cap |
| `blocked` | The request was explicitly blocked — e.g. no policy file found |
| `escalated` | The request was sent for human review |

---

## `Policy`

The structure of your `policy.yaml` file. It contains a list of rules evaluated top-to-bottom, and a fallback verdict for requests that match nothing.

```ts
interface Policy {
  readonly rules: readonly PolicyRule[];
  readonly defaultVerdict?: AuthorizationStatus;
}
```

The first rule that matches a request wins. If nothing matches, `defaultVerdict` is used — and if you omit `defaultVerdict`, it defaults to `"pending_approval"`.

**Example `policy.yaml`:**

```yaml
defaultVerdict: pending_approval

rules:
  - resource: "openai.com"
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

  - resource: "stripe.com"
    actions: [purchase]
    verdict: pending_approval

  - resource: "*"
    verdict: denied
```

---

## `PolicyRule`

A single rule inside your policy file.

```ts
interface PolicyRule {
  readonly resource: string;
  readonly actions?: readonly AgentAction[];
  readonly verdict: AuthorizationStatus;
  readonly maxAmount?: number;
  readonly maxDailyAmount?: number;
}
```

| Field | What it does |
|---|---|
| `resource` | The domain or service this rule applies to. Use `"*"` to match anything. |
| `actions` | Optional: limits this rule to specific action types. Omit to match all actions. |
| `verdict` | What to decide when this rule matches — `approved`, `denied`, or `pending_approval` |
| `maxAmount` | Optional: maximum allowed spend per single transaction. Requests above this are denied even if the rule would otherwise approve them. |
| `maxDailyAmount` | Optional: maximum allowed total spend for this resource in a rolling 24-hour window. Exceeding it denies the request. |

---

## `LedgerEntry`

One recorded decision. Stored as a single line in `decisions.jsonl` — one JSON object per line, append-only.

```ts
interface LedgerEntry {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly request: AuthorizeRequest;
  readonly response: AuthorizeResponse;
}
```

You can inspect the ledger file directly in any text editor. Each line is a self-contained record of one decision.

---

## `ApprovalEntry`

A human approval or denial, appended to the ledger when you run `approve` or `deny`. It references the decision it resolves; the original decision record is left untouched.

```ts
interface ApprovalEntry {
  readonly kind: "approval";
  readonly approvalId: string;
  readonly decisionId: string;
  readonly verdict: "approved" | "denied";
  readonly timestamp: string;
}
```

---

## x402 helpers

For authorizing agent payments over the x402 protocol, `@shotoku/core` also exports `authorizeX402Payment()` and `parseX402Response()`. See the **[x402 integration guide](x402.md)** for the full flow and where these fit.
