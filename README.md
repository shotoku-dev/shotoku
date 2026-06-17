# Shotoku

Shotoku is a local-first authorization layer for AI agents.

Before an agent performs an action—calling a paid API, using an MCP tool, executing code, deploying infrastructure, or spending money—Shotoku evaluates the request, applies policy, and records the decision locally.

Built first with x402. Designed for any rail.

No custody ever.

Status: Week 1 of 4.

## Why Shotoku exists

AI agents are rapidly gaining the ability to act on behalf of users.

Today, developers can give agents access to APIs, tools, payment systems, cloud infrastructure, and external services. What is still missing is a simple way to answer:

> Should this agent be allowed to perform this action?

Shotoku sits between agents and actions.

It provides:

* Authorization
* Approvals
* Policy enforcement
* Audit trails

without becoming a wallet, payment network, or custody provider.

## What Shotoku is not

* Not a wallet
* Not a payment network
* Not a custody provider
* Not an enterprise procurement system
* Not a workflow engine
* Not an ERP

Shotoku focuses on one job:

> Require approvals, enforce limits, and record auditable decisions before agents act.

## Architecture

```txt
Agent
  ↓
Shotoku
  ├─ Authorization
  ├─ Approval
  ├─ Policy
  └─ Audit Ledger
```

## Packages

* `core/` — authorization, policy, and ledger primitives.
* `cli/` — Ink-based terminal UI.
* `docs/` — architecture, positioning, and decisions.

## Development

```bash
pnpm install
pnpm --filter shotoku-cli dev
```

## Build

```bash
pnpm build
```
