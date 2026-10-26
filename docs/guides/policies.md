# Writing Policies

A policy is the set of rules Shotoku checks every time an agent wants to act. It is a single YAML file you own, version, and read. No rule lives in the cloud; the file on your disk is the whole policy.

This guide covers how rules are written, how they are matched, and the patterns you will reach for most.

---

## Where the policy lives

By default, Shotoku looks for `policy.yaml` in the current directory. `shotoku init` creates a starter one for you. Point at a different file with `--policy <path>` on the `authorize` command, or set `policyPath` when calling `authorize()` from code.

---

## The shape of a policy

```yaml
rules:
  - resource: openai.com
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

defaultVerdict: pending_approval
```

A policy has three parts:

- **`rules`** — an ordered list. Each rule describes which requests it matches and what to decide.
- **`defaultVerdict`** — the fallback when no rule matches. Optional; defaults to `pending_approval`.
- **`budgets`** — total spend ceilings per agent, across every resource. Optional; see [Agent budgets](#agent-budgets).

---

## How matching works

Rules are evaluated **top to bottom. The first rule that matches wins** — later rules are not consulted. If no rule matches, `defaultVerdict` applies.

A rule matches a request when **all** of these are true:

1. The `resource` matches — either an exact string, or `"*"` (matches anything).
2. The `actor` matches — the request's actor matches the rule's `actor` pattern, or the rule omits `actor` (then it matches every actor).
3. The `actions` matches — the request's action is in the rule's `actions` list, or the rule omits `actions` (then it matches every action).
4. The `rails` matches — the request's `rail` is in the rule's `rails` list, or the rule omits `rails` (then it matches every rail).
5. The `recipients` matches — the request's `recipient` is in the rule's `recipients` list, or the rule omits `recipients` (then it matches any recipient, or none).

Because the first match wins, **put your most specific rules first and your catch-alls last.**

---

## A rule's fields

```yaml
- resource: openai.com      # required
  actor: team-*             # optional — match only these actors
  actions: [api_call]       # optional — match only these action types
  rails: [api]              # optional — match only these execution rails
  recipients: ["0xAbC…"]    # optional — match only payments to these addresses
  verdict: approved         # required
  maxAmount: 50             # optional
  maxDailyAmount: 200       # optional
```

| Field | Required | What it does |
|---|---|---|
| `resource` | yes | The domain or service this rule applies to. `*` is a wildcard (e.g. `openai.com/*`, `*.openai.com`). |
| `actor` | no | Restricts the rule to actors matching this pattern. `*` is a wildcard, so `team-*` matches `team-alpha`, `team-billing`, etc. Omit to match all actors. |
| `actions` | no | Restricts the rule to specific action types (`purchase`, `api_call`, `execute_code`, `send_email`, `mcp_tool`, `custom`). Omit to match all actions. |
| `rails` | no | Restricts the rule to specific execution rails (`x402`, `mcp`, `api`, `code`, `custom`). Omit to match all rails. |
| `recipients` | no | Restricts the rule to payments to these exact recipients (an x402 `payTo`, for example). EVM `0x` addresses compare case-insensitively. A request with no recipient does not match. Omit to match any recipient. |
| `verdict` | yes | What to decide when the rule matches: `approved`, `denied`, or `pending_approval`. |
| `maxAmount` | no | Per-transaction cap. A matching request above this amount is **denied**, even if `verdict` is `approved`. |
| `maxDailyAmount` | no | Rolling 24-hour spend cap for this resource. If today's approved spend plus this request would exceed it, the request is **denied**. |
| `overLimit` | no | What a request over `maxAmount` or `maxDailyAmount` gets: `denied` (the default) or `pending_approval`, which asks a human instead. Only on a rule with `verdict: approved` and at least one limit. |

A few things worth knowing:

- **A request with no `amount` is held for approval when the matched rule has `maxAmount` or `maxDailyAmount`.** A missing amount is not zero: the limit cannot be checked, so a human decides (`Amount unknown; the $100 per-transaction limit cannot be checked`). Wrapped MCP tools never carry an amount, so a limit on a rule that matches them holds every call. Give tools that cost nothing a rule without limits.
- The daily total is computed from the ledger — only **approved** decisions for the same actor and resource count toward it. Denied and pending requests do not consume budget.
- `maxDailyAmount` is **per resource**. A `resource: "*"` rule with `maxDailyAmount: 200` allows 200 for each distinct resource, not 200 in total. To cap an agent's total, use [`budgets`](#agent-budgets).
- The limits act as a safety net on top of an `approved` verdict. A rule can say "approved" and still produce a denial if a cap is exceeded — and the decision will tell the user which cap.
- **Unknown fields are rejected, not ignored.** A typo like `maxAmonut` makes the whole policy invalid rather than silently dropping the cap. A misspelled limit should fail loudly, not quietly weaken your policy.

---

## Agent budgets

Rule limits cap spend per vendor. A budget caps an agent's **total** spend across every resource, over a rolling 24 hours.

```yaml
rules:
  - resource: "*"
    actions: [purchase]
    verdict: approved

budgets:
  - actor: "*"              # every agent gets its own 100 a day
    maxDailyAmount: 100

  - actor: "research-*"     # research agents also share one 30 a day pool
    maxDailyAmount: 30
    scope: shared
```

| Field | Required | What it does |
|---|---|---|
| `actor` | yes | Which actors the budget applies to. `*` is a wildcard. |
| `maxDailyAmount` | yes | Rolling 24-hour ceiling on approved spend, across all resources. |
| `scope` | no | `per_actor` (default): each matching actor has its own ceiling. `shared`: all matching actors draw from one pool. |

How budgets behave:

- **Every matching budget applies**, unlike rules. A request must fit under all of them, so the tightest one decides.
- They run **after** the rules, and only on requests the rules approved — including ones approved by `defaultVerdict: approved`. A budget can turn an approval into a denial; it never approves anything.
- **A human approval does not lift a budget.** If an approved pending request would exceed a budget when the agent retries, it is denied, and the approval stays redeemable until it expires.
- They count only requests that carry an `amount`.
- **Use `scope: shared` when the agent controls its own name.** A per-actor budget is only as strong as the actor name: an agent that can set it (an HTTP header, a self-chosen ID) gets a fresh budget by inventing a new name. A shared `actor: "*"` budget is a hard ceiling for everyone, whatever they call themselves.

---

## Worked examples

### Allowlist a vendor with limits

```yaml
rules:
  - resource: openai.com
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200
```

Approves OpenAI spending up to $50 per call and $200 per day. The 201st dollar in a day is denied with a budget reason.

### Require a human for a whole category

```yaml
rules:
  - resource: "*"
    actions: [send_email, execute_code]
    verdict: pending_approval
```

Any email or code execution, to any resource, is held for human approval.

### Approve small, escalate large

```yaml
rules:
  - resource: paypal__create_refund
    verdict: approved
    maxAmount: 100                # refunds up to $100 go through on their own
    maxDailyAmount: 1000
    overLimit: pending_approval   # a bigger one waits for a human
```

A $89 refund is approved. A $480 refund exceeds `maxAmount`, and instead of a denial it becomes `pending_approval`, with the exceeded limit as the reason. Once a human runs `shotoku approve`, the agent's identical retry goes through and counts toward the $1000 daily limit.

Without `overLimit`, a request over a limit is **denied**. Rules do not fall through: a second, lower rule for the same resource never sees it. Agent [`budgets`](#agent-budgets) are not affected by `overLimit`: over a budget is always a denial, even after a human approves.

### Cap the total, whatever the vendor

```yaml
rules:
  - resource: "*"
    actions: [purchase]
    verdict: approved
    maxAmount: 5

budgets:
  - actor: "*"
    maxDailyAmount: 50
    scope: shared
```

Any single purchase up to $5 goes through, but all agents together never spend more than $50 a day.

### Default deny

```yaml
rules:
  - resource: openai.com
    verdict: approved
    maxAmount: 50

defaultVerdict: denied
```

Only OpenAI is allowed. Everything else is denied outright instead of waiting for approval.

---

## Common patterns

- **Allowlist + hold the rest.** List the resources you trust with `approved` and limits, then set `defaultVerdict: pending_approval`. This is the starter policy, and a sane default: known vendors flow, everything new pauses for you.
- **Hard wall.** Set `defaultVerdict: denied` when you want unknown resources blocked, not queued.
- **Per-rail rules.** Combine `resource` with `actions` to authorize, say, `purchase` on a payment endpoint while denying `execute_code` everywhere.

---

## Testing a policy

You do not have to guess. Run a request through it and read the decision:

```bash
shotoku authorize --actor test --action purchase --resource openai.com --amount 75
```

The output names the rule that matched and the check that decided the outcome. Iterate on the file until the decisions match your intent.

---

## Starter templates

Ready-made policies you can copy to `policy.yaml` and adapt:

- [`examples/policy-payments.yaml`](../examples/policy-payments.yaml) — cap agent spending per vendor, hold the rest
- [`examples/policy-email.yaml`](../examples/policy-email.yaml) — auto-approve known recipients, review the rest
- [`examples/policy-file-access.yaml`](../examples/policy-file-access.yaml) — allow the workspace scope, block system scopes
- [`examples/policy-x402.yaml`](../examples/policy-x402.yaml) — micropayments over the x402 rail

---

## Related

- **[Quickstart](quickstart.md)** — the five-minute tour
- **[API reference](api.md)** — the `Policy` and `PolicyRule` types in full
