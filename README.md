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

`shotoku init` creates a `policy.yaml` in your project directory:

```yaml
rules:
  - resource: openai.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

defaultVerdict: pending_approval
```

Every decision is recorded locally to `data/decisions.jsonl`. No cloud. No external services required.

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

- `core/` — authorization, policy, and ledger primitives
- `cli/` — command-line interface
- `docs/` — architecture and decisions

## Development

```bash
pnpm install
pnpm build
pnpm test
```
