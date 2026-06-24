# Shotoku

Local-first authorization layer for AI agents.

Before an agent performs an action — calling a paid API, using an MCP tool, executing code, sending an email, deploying infrastructure, or spending money — Shotoku evaluates the request, applies policy, and records the decision locally.

Built first with x402. Designed for any rail.

No custody ever.

## Install

```bash
npm install -g shotoku-cli
```

## Quickstart

```bash
# Initialize in your project directory
shotoku init

# Evaluate an action
shotoku authorize --actor my-agent --action api_call --resource openai.com --amount 5
```

```
✓ APPROVED  dec_063a20380ba7
  • openai.com matched rule
  • Amount $5 is within per-transaction limit of $50
  • Daily budget remaining: $195
  Recorded at 14:05:22
```

```bash
# Check pending approvals
shotoku status

# View decision history
shotoku history --since 24h

# Inspect a specific decision
shotoku decision dec_063a20380ba7
```

## How it works

`shotoku init` creates three local files:

- `policy.yaml` — the rules for what agents can do.
- `shotoku.config.json` — where Shotoku should find the policy and ledger.
- `data/decisions.jsonl` — the local audit log, created when decisions are recorded.

A policy is just a checklist. Shotoku reads the checklist before an agent acts.

```yaml
rules:
  - resource: openai.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

defaultVerdict: pending_approval
```

Every decision is recorded locally to `data/decisions.jsonl`. JSONL means “one JSON record per line,” so the ledger stays easy to inspect with any text editor.

Shotoku fails closed: if the policy is missing, invalid, or the ledger cannot be trusted, the agent is not approved. That is intentional. An authorization layer should be easy to use, but it should never guess when the audit trail is unclear.

`maxDailyAmount` is a rolling 24-hour limit, not a midnight reset. If an agent spent $20 at 3pm yesterday, that spend counts until 3pm today.

The ledger is hash-chained. Each new record stores a hash of the previous record plus itself. If someone edits a past line, later reads fail because the chain no longer matches.

You can also create a signed snapshot of the current policy and ledger head:

```bash
export SHOTOKU_SNAPSHOT_SECRET="use-a-long-local-secret"
shotoku snapshot create --out shotoku.snapshot.json
shotoku snapshot verify --snapshot shotoku.snapshot.json
```

Shotoku does not store the snapshot secret. Provide it through your environment or secret manager.

## Core question

> Should this agent be allowed to perform this action?

Shotoku answers it with a structured decision: approved, denied, or pending human approval.

## What Shotoku is not

- Not a wallet
- Not a payment network
- Not a custody provider
- Not a cloud policy engine
- Not an enterprise procurement system

## Packages

- `core/` — authorization, policy, ledger, approvals, and x402 primitives
- `cli/` — command-line interface and TUI
- `mcp/` — MCP tool server for agent integrations
- `docs/` — architecture and decisions

## Development

```bash
pnpm install
pnpm build
pnpm test
```
