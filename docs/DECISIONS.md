# Decisions

## 0001 — x402-first, rail-neutral, no custody

Date: 2026-06-17

### Decision

Shotoku starts with x402 but remains rail-neutral.

Shotoku never custodies funds, private keys, or payment credentials.

### Reasoning

x402 is an early, relevant protocol for agent-native payments and provides a useful first integration target.

However, authorization should not depend on a single payment rail.

### Consequences

- x402 is the first integration.
- Additional rails may be supported later.
- Core abstractions remain rail-neutral.
- No custody functionality will be added.

---

## 0002 — Developer-first, not enterprise-first

Date: 2026-06-17

### Decision

Shotoku is designed first for developers building AI agents.

### Reasoning

The fastest path to adoption is providing a simple local tool that developers can understand and run immediately.

### Consequences

- CLI first.
- Local-first workflows.
- Open-source friendly architecture.
- Avoid enterprise complexity in the initial product.

---

## 0003 — Local-first authorization

Date: 2026-06-17

### Decision

The core authorization path should remain usable locally.

### Reasoning

Developers should be able to inspect, audit, and control agent actions without relying on a hosted service.

### Consequences

- Local approvals remain a first-class workflow.
- Audit logs remain locally inspectable.
- Cloud features must not replace core local functionality.
