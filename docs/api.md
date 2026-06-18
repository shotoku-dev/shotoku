# Shotoku API Reference

## `authorize(request, options)`

The main entrypoint. Loads a policy file, reads the ledger, evaluates the request, writes the decision, and returns the result.

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

### Options

| Field        | Type     | Required | Description                         |
| ------------ | -------- | -------- | ----------------------------------- |
| `policyPath` | `string` | yes      | Path to the policy file.            |
| `ledgerPath` | `string` | yes      | Path to the local JSONL ledger file. |

---

## Types

### `AuthorizeRequest`

Describes the action an agent wants to perform.

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

| Field      | Description                                                      |
| ---------- | ---------------------------------------------------------------- |
| `actor`    | Identifier for the agent making the request, e.g. `"agent-001"` |
| `action`   | The type of action being requested (see `AgentAction`)           |
| `resource` | The target, e.g. `"api.openai.com"` or `"stripe.com"`           |
| `rail`     | Optional execution rail: `"x402"`, `"mcp"`, `"api"`, etc.       |
| `amount`   | Monetary amount in USD when the action involves spending         |
| `context`  | Any additional metadata you want recorded with the decision      |

---

### `AuthorizeResponse`

Returned by `authorize()`.

```ts
interface AuthorizeResponse {
  readonly approved: boolean;
  readonly status: AuthorizationStatus;
  readonly reasons: readonly ReasonItem[];
  readonly decisionId: string;
  readonly timestamp: string;
}
```

---

### `AuthorizationStatus`

```ts
type AuthorizationStatus = "approved" | "denied" | "pending_approval";
```

| Value              | Meaning                                          |
| ------------------ | ------------------------------------------------ |
| `approved`         | Request passed all policy checks.                |
| `denied`           | Request was blocked by a policy rule.            |
| `pending_approval` | A human must approve before the action proceeds. |

---

### `AgentAction`

```ts
type AgentAction =
  | "purchase"
  | "api_call"
  | "execute_code"
  | "send_email"
  | "mcp_tool"
  | "custom";
```

---

### `ExecutionRail`

```ts
type ExecutionRail = "x402" | "mcp" | "api" | "code" | "custom";
```

---

### `ReasonItem`

One explanation for why a decision was made. A response always contains one or more.

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

---

### `Policy`

Loaded from your `policy.yaml` file. Contains an ordered list of rules and a fallback verdict.

```ts
interface Policy {
  readonly rules: readonly PolicyRule[];
  readonly defaultVerdict?: AuthorizationStatus;
}
```

Rules are evaluated top-to-bottom. The first matching rule wins. If no rule matches, `defaultVerdict` is used (defaults to `"pending_approval"` when omitted).

---

### `PolicyRule`

A single rule in your policy file.

```ts
interface PolicyRule {
  readonly resource: string;
  readonly actions?: readonly AgentAction[];
  readonly verdict: AuthorizationStatus;
  readonly maxAmount?: number;
  readonly maxDailyAmount?: number;
}
```

| Field           | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| `resource`      | Exact resource string, or `"*"` to match any resource.                        |
| `actions`       | Limits the rule to specific action types. Omit to match all actions.          |
| `verdict`       | The decision to issue when this rule matches.                                 |
| `maxAmount`     | Per-transaction cap. Requests above this are denied even if the rule matches. |
| `maxDailyAmount`| Rolling 24-hour spend cap for this resource. Exceeding it denies the request. |

**Example `policy.yaml`:**

```yaml
defaultVerdict: pending_approval

rules:
  - resource: "api.openai.com"
    verdict: approved
    maxAmount: 1.00
    maxDailyAmount: 20.00

  - resource: "stripe.com"
    actions: [purchase]
    verdict: pending_approval

  - resource: "*"
    verdict: denied
```

---

### `LedgerEntry`

One recorded decision. Written to `decisions.jsonl` — one JSON object per line.

```ts
interface LedgerEntry {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly request: AuthorizeRequest;
  readonly response: AuthorizeResponse;
}
```

---

### `LedgerSnapshot`

A pre-computed view of the ledger passed into the policy evaluator. Contains rolling 24-hour spend totals keyed by `"${actor}|${resource}"`.

```ts
interface LedgerSnapshot {
  readonly dailyTotals: Readonly<Record<string, number>>;
}
```

---

### `EvaluationResult`

The raw output from the policy engine, before the decision is written to the ledger.

```ts
interface EvaluationResult {
  readonly status: AuthorizationStatus;
  readonly reasons: readonly ReasonItem[];
}
```
