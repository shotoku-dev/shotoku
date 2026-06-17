# Shotoku

Shotoku is a local-first approval, policy, and ledger layer for agent payments.

Agents are starting to spend money on behalf of users, but the control layer is still missing. Shotoku gives developers and operators a simple way to see what an agent wants to spend, decide whether it should be allowed, and keep an auditable local record.

Unlike AgentPay/Skyfire-style payment stacks, Shotoku is not trying to custody funds, issue wallets, or become the checkout network. Shotoku is the local operator layer around agent spending: policy, approval, and ledgering.

No custody ever.

Status: Week 1 of 4.

## Packages

- `core/` — daemon, ledger, and policy primitives.
- `cli/` — Ink-based terminal UI.
- `docs/` — architecture notes and decisions.

## Development

```bash
pnpm install
pnpm --filter shotoku-cli dev