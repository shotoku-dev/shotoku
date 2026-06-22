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

---

## 0004 — Fail closed on policy and ledger uncertainty

Date: 2026-06-23

### Decision

Shotoku fails closed when the policy file is missing or invalid, the request is malformed, or the ledger is corrupt.

### Reasoning

Shotoku is an authorization layer. If it cannot understand the rules or cannot trust the audit log, it should not approve an agent action.

### Consequences

- Invalid policies produce denied decisions with human-readable reasons.
- Corrupt ledger records are reported instead of skipped.
- Budget checks use a rolling 24-hour window from trusted ledger data.
- Approval writes and authorization writes are guarded by a local lock to reduce race conditions.

---

## 0005 — Tamper-evident local audit trail

Date: 2026-06-23

### Decision

Shotoku ledger records are hash-chained, and Shotoku can create signed snapshots over the policy hash and ledger head hash.

### Reasoning

The ledger is local and inspectable, which is good for developer control. Local files are also easy to edit accidentally or maliciously. A hash chain makes edits visible. A signed snapshot lets a developer freeze a known-good policy and ledger state without sending data to a cloud service.

### Consequences

- New ledger records include sequence, previous hash, and record hash metadata.
- Legacy records are readable but reported as legacy until a hashed record anchors them.
- Snapshot signing uses a caller-provided HMAC secret.
- Shotoku does not store snapshot secrets or private keys.
