# Shotoku

**Spend controls for AI agents.**

[![npm](https://img.shields.io/npm/v/shotoku-cli)](https://www.npmjs.com/package/shotoku-cli)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<!-- TODO: demo GIF here once recorded (Day 28) -->

Shotoku lets AI agents spend money safely — budgets, human approvals, and a tamper-evident audit trail, enforced deterministically on your machine **before** the payment happens. No cloud. No custody. Never holds funds or keys.

The same engine authorizes any agent action — the request model is rail-agnostic (x402, MCP, API, code). Spending is where the pain is sharpest today, so that's where it starts.

Built first with [x402](docs/guides/x402.md). Designed for any rail.

## What you can do with it

- **Give agents a budget** — per-transaction and rolling 24-hour limits per vendor. Over-budget payments are denied, not silently allowed.
- **Require human approval** — hold risky actions as `pending_approval` until you run `shotoku approve`.
- **Authorize agent payments (x402)** — decide on a payment once the price is known, before the wallet signs.
- **Prove enforcement with receipts** — approved decisions carry a short-lived signed token your infrastructure verifies before executing.
- **Let agents ask via MCP** — an MCP-compatible agent (like Claude) checks its own budget mid-task, automatically.
- **Audit everything** — every decision is written to a local, append-only, hash-chained ledger you can read in any text editor.

## Install

```bash
npm install -g shotoku-cli
```

## See it in 30 seconds

No setup, nothing real happens:

```bash
shotoku demo
```

Four simulated decisions: two purchases approved, a third denied when the daily budget runs out, and an unknown vendor held for human approval.

## Quickstart

```bash
# Initialize in your project directory
shotoku init

# Evaluate a spend
shotoku authorize --actor my-agent --action purchase --resource openai.com --amount 5
```

```
✓ APPROVED  dec_063a20380ba7
  • openai.com matched rule
  • Amount $5 is within per-transaction limit of $50
  • Daily budget remaining: $195
  Recorded at 14:05:22
```

```bash
shotoku status                       # pending approvals + last decision
shotoku history --since 24h          # decision history
shotoku decision dec_063a20380ba7    # full detail for one decision
shotoku approve dec_063a20380ba7     # approve a pending decision
```

See the [Quickstart guide](docs/guides/quickstart.md) for the full five-minute tour.

## How it works

`shotoku init` creates three local files:

- `policy.yaml` — the rules for what agents can do.
- `shotoku.config.json` — where Shotoku finds the policy and ledger.
- `data/decisions.jsonl` — the local audit log, created when decisions are recorded.

A policy is just a checklist. Shotoku reads it before an agent acts.

```yaml
rules:
  - resource: openai.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

defaultVerdict: pending_approval
```

Every decision is recorded to `data/decisions.jsonl`. JSONL means "one JSON record per line," so the ledger stays easy to inspect.

Shotoku **fails closed**: if the policy is missing, invalid, or the ledger cannot be trusted, the agent is not approved. An authorization layer should never guess when the audit trail is unclear.

`maxDailyAmount` is a rolling 24-hour limit, not a midnight reset. If an agent spent $20 at 3pm yesterday, that spend counts until 3pm today.

The ledger is **hash-chained**: each record stores a hash of the previous record plus itself. Edit a past line and later reads fail, because the chain no longer matches. You can also create a signed snapshot of the current policy and ledger head:

```bash
export SHOTOKU_SNAPSHOT_SECRET="use-a-long-local-secret"
shotoku snapshot create --out shotoku.snapshot.json
shotoku snapshot verify --snapshot shotoku.snapshot.json
```

Shotoku does not store the snapshot secret. Provide it through your environment or secret manager.

**Signed receipts** make approvals enforceable: with `SHOTOKU_RECEIPT_SECRET` set, every approved decision carries a compact HMAC-signed token (decision ID, actor, action, resource, amount, 5-minute expiry). Downstream infrastructure — a payment proxy, a CI job — verifies it before executing, so an agent cannot skip the check:

```bash
export SHOTOKU_RECEIPT_SECRET="use-a-long-local-secret"
shotoku authorize --actor my-agent --action purchase --resource openai.com --amount 5
# ✓ APPROVED … Receipt: rcpt.eyJhY3Rvci…
shotoku receipt verify rcpt.eyJhY3Rvci…
```

See [Writing policies](docs/guides/policies.md) for rules, limits, and matching in depth.

## Use with AI agents (MCP)

Shotoku ships an MCP server, so any MCP-compatible agent (like Claude Desktop) can check authorization automatically, mid-task. It exposes three tools:

- `authorize_action` — should this action be allowed?
- `get_decision` — look up a past decision by ID
- `get_pending_approvals` — list what is waiting for a human

The agent asks before it acts; if your policy requires approval, it pauses and tells you. See the [MCP integration guide](docs/guides/mcp.md).

## Use with x402 payments

When an agent hits an HTTP `402 Payment Required`, Shotoku authorizes the payment **after the amount is known and before the wallet signs** — the only safe point to decide. Shotoku never signs or settles a payment; it only decides whether it is allowed. See the [x402 integration guide](docs/guides/x402.md).

## Core question

> Should this agent be allowed to perform this action?

Shotoku answers it with a structured decision: **approved**, **denied**, or **pending human approval** — each with reasons and a plain-English explanation.

## FAQ

### How do I stop an AI agent from spending too much money?

Add `maxAmount` (per transaction) and `maxDailyAmount` (rolling 24 hours) to a policy rule for that vendor. Requests over either limit are denied, with a reason naming the cap.

### Does Shotoku hold my funds or private keys?

No. Shotoku never holds funds, stores private keys, or signs or settles payments. It only decides whether an action is allowed and records the decision. The agent's own wallet signs.

### Does it need the cloud?

No. Shotoku is local-first. The policy, the ledger, and the authorization path all run on your machine.

### Which AI agents work with it?

Any MCP-compatible host (such as Claude Desktop), plus a command-line interface and a TypeScript API (`@shotoku/core`) you can call directly.

### Is Shotoku only for crypto or x402?

No. x402 is the first payment rail. Shotoku authorizes any agent action — API calls, code execution, emails, MCP tools — across any rail.

### What happens if no policy rule matches a request?

The `defaultVerdict` applies — `pending_approval` unless you set otherwise. It fails toward human review, never silent approval.

## What Shotoku is not

- Not a wallet
- Not a payment network
- Not a custody provider
- Not a cloud policy engine
- Not an enterprise procurement system

## Documentation

- [Quickstart](docs/guides/quickstart.md) — install to first decision in five minutes
- [Writing policies](docs/guides/policies.md) — rules, limits, allowlists
- [API reference](docs/reference/api.md) — every function and type
- [MCP integration](docs/guides/mcp.md) — connect an AI agent
- [x402 integration](docs/guides/x402.md) — authorize agent payments

## Packages

- `core/` — authorization, policy, ledger, approvals, and x402 primitives (`@shotoku/core`)
- `cli/` — command-line interface and TUI (`shotoku-cli`)
- `mcp/` — MCP tool server for agent integrations
- `docs/` — guides, architecture, and decisions

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

[MIT](LICENSE)
