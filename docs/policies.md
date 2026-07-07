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

A policy has two parts:

- **`rules`** — an ordered list. Each rule describes which requests it matches and what to decide.
- **`defaultVerdict`** — the fallback when no rule matches. Optional; defaults to `pending_approval`.

---

## How matching works

Rules are evaluated **top to bottom. The first rule that matches wins** — later rules are not consulted. If no rule matches, `defaultVerdict` applies.

A rule matches a request when **all** of these are true:

1. The `resource` matches — either an exact string, or `"*"` (matches anything).
2. The `actions` matches — the request's action is in the rule's `actions` list, or the rule omits `actions` (then it matches every action).
3. The `rails` matches — the request's `rail` is in the rule's `rails` list, or the rule omits `rails` (then it matches every rail).

Because the first match wins, **put your most specific rules first and your catch-alls last.**

---

## A rule's fields

```yaml
- resource: openai.com      # required
  actor: team-*             # optional — match only these actors
  actions: [api_call]       # optional — match only these action types
  rails: [api]              # optional — match only these execution rails
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
| `verdict` | yes | What to decide when the rule matches: `approved`, `denied`, or `pending_approval`. |
| `maxAmount` | no | Per-transaction cap. A matching request above this amount is **denied**, even if `verdict` is `approved`. |
| `maxDailyAmount` | no | Rolling 24-hour spend cap for this resource. If today's approved spend plus this request would exceed it, the request is **denied**. |

A few things worth knowing:

- `maxAmount` and `maxDailyAmount` only apply when the request carries an `amount`. Actions without a cost ignore them.
- The daily total is computed from the ledger — only **approved** decisions for the same actor and resource count toward it. Denied and pending requests do not consume budget.
- The limits act as a safety net on top of an `approved` verdict. A rule can say "approved" and still produce a denial if a cap is exceeded — and the decision will tell the user which cap.
- **Unknown fields are rejected, not ignored.** A typo like `maxAmonut` makes the whole policy invalid rather than silently dropping the cap. A misspelled limit should fail loudly, not quietly weaken your policy.

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
  - resource: api.vendor.com
    verdict: approved
    maxAmount: 1.00          # auto-approve micro-payments

  - resource: api.vendor.com
    verdict: pending_approval # anything that fell through (over $1) needs a human
```

The first rule auto-approves payments up to $1. A larger payment exceeds `maxAmount`, so the first rule **denies** it — note this is a denial, not a fall-through to the second rule. To escalate large amounts instead of denying them, drop `maxAmount` and gate by amount in your own code, or keep the categories on separate resources.

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
