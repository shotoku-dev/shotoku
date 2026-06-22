# API Reference

This document covers the core `authorize()` function and the types it uses. If you are building an agent and want to check whether an action is allowed before it runs, this is the right place to start.

Plain-English model:

- A **request** is what the agent wants to do.
- A **policy** is your local checklist for what is allowed.
- A **decision** is Shotoku's answer: approved, denied, or pending human approval.
- The **ledger** is the local audit log. It records what was asked, what Shotoku decided, and why.

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
2. Reads rolling 24-hour spend totals from the ledger
3. Evaluates the request against your rules
4. Writes the decision to the ledger
5. Returns the result

Shotoku fails closed. If a request is malformed, the policy file is missing or invalid, or the ledger is corrupt, Shotoku does not approve the action.

### Options

| Field | Required | What it does |
|---|---|---|
| `policyPath` | yes | Path to your `policy.yaml` rules file |
| `ledgerPath` | yes | Path to the local file where decisions are stored |

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

`context` must be JSON-serializable. In practical terms: strings, numbers, booleans, arrays, plain objects, or `null`. Do not put functions, symbols, circular objects, or private keys in context.

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
| `budget_check` | The rolling 24-hour spend total was checked against a daily cap |
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
    rails: [api]
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
  readonly rails?: readonly ExecutionRail[];
  readonly verdict: AuthorizationStatus;
  readonly maxAmount?: number;
  readonly maxDailyAmount?: number;
}
```

| Field | What it does |
|---|---|
| `resource` | The domain or service this rule applies to. Use `"*"` to match anything. |
| `actions` | Optional: limits this rule to specific action types. Omit to match all actions. |
| `rails` | Optional: limits this rule to specific execution rails. Omit to match all rails. |
| `verdict` | What to decide when this rule matches — `approved`, `denied`, or `pending_approval` |
| `maxAmount` | Optional: maximum allowed spend per single transaction. Requests above this are denied even if the rule would otherwise approve them. |
| `maxDailyAmount` | Optional: maximum allowed total spend for this resource in a rolling 24-hour window. Exceeding it denies the request. |

Rules are strict on purpose. Unknown policy fields are rejected instead of ignored, because a typo in an authorization policy should not silently weaken the policy.

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

If a ledger line is malformed, Shotoku reports the ledger as corrupt instead of skipping the bad line. Skipping would make budgets and approval state hard to trust.

Every new ledger record includes an `integrity` object. It links the record to the previous ledger hash:

```ts
interface LedgerIntegrity {
  readonly version: 1;
  readonly sequence: number;
  readonly previousHash: string;
  readonly hash: string;
}
```

Older ledgers without `integrity` can still be read, but they are reported as legacy records. Once a new hashed record is appended after them, editing an older line breaks the chain.

---

## `LedgerSnapshot`

A pre-computed view of recent approved spend used by the policy engine.

```ts
interface LedgerSnapshot {
  readonly dailyTotals: Readonly<Record<string, number>>;
  readonly windowStart: string;
}
```

`dailyTotals` is keyed as `"actor|resource"`. `windowStart` records the start of the rolling 24-hour window used to calculate those totals.

---

## Signed Snapshots

A signed snapshot records:

- the hash of the policy file
- the current ledger head hash
- the number of ledger records
- a keyed signature over those fields

Use snapshots when you want to prove later that the policy and ledger head have not changed since a point in time.

```ts
import {
  createSignedSnapshot,
  verifySignedSnapshot,
} from "@shotoku/core";

const snapshot = await createSignedSnapshot({
  policyPath: "./policy.yaml",
  ledgerPath: "./data/decisions.jsonl",
  secret: process.env.SHOTOKU_SNAPSHOT_SECRET!,
});

const result = await verifySignedSnapshot(snapshot, {
  secret: process.env.SHOTOKU_SNAPSHOT_SECRET!,
});
```

Shotoku uses HMAC-SHA256 for local snapshots. It does not create, store, or manage signing keys. The secret comes from the caller.
