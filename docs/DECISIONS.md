# Decisions

## 0001 — x402-first, rail-neutral architecture, no custody

Date: 2026-06-17

### Decision

Shotoku will be x402-first, rail-neutral, and non-custodial.

### Context

Agent payments are emerging across multiple rails and protocols. The approval, policy, and ledger layer should not depend on a single payment provider or custody model.

### Consequences

* x402 is the initial integration target.
* Additional payment rails will be added later.
* Core abstractions must remain rail-neutral.
* Shotoku never holds user funds.
* Policy, approval, and ledger functionality remain independent from payment execution.
