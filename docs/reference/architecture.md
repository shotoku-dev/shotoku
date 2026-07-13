# Shotoku — Architecture Reference

Technical reference for the current implementation. Covers data flow, module responsibilities, file formats, and known design constraints.

---

## Overview

Shotoku is spend controls for AI agents — local-first, deterministic, no custody. Before an agent spends money (an x402 payment, a paid API call, a purchase) it calls `authorize()`. Shotoku evaluates the request against a YAML policy with budgets and limits, records the decision to an append-only local ledger, and returns a structured response. The same engine authorizes any agent action — the request model is rail-agnostic (x402, MCP, API, code).

No cloud dependency exists in the core authorization path. No private keys are stored. No funds are custodied.

---

## Repo Layout

```
shotoku/
├── core/src/          — authorization engine, policy, ledger, types
├── cli/src/           — commander CLI, Ink TUI
├── mcp/src/           — MCP server (stdio transport)
├── web/app/           — Next.js landing page
├── docs/              — guides and API reference
├── examples/          — example policy and quickstart scripts
└── demo/              — demo data and policy for local testing
```

---

## Core Package (`@shotoku/core`)

### Data Flow

```
authorize(request, options)
  │
  ├── validateAuthorizeRequest(request)       — input validation
  │     └── returns ReasonItem[] (empty = valid)
  │
  ├── loadPolicy(options.policyPath)          — parse YAML, validatePolicy()
  │     └── returns Policy | denial reason
  │
  └── withLedgerLock(options.ledgerPath)      — exclusive file lock
        │
        ├── getLedgerSnapshot(ledgerPath)     — compute 24h daily totals
        │
        ├── evaluatePolicy(request, policy, snapshot) — pure function, no I/O
        │     └── returns EvaluationResult { status, reasons }
        │
        ├── buildExplanation(status, reasons, id)
        │     └── returns Explanation { summary, hint? }
        │
        └── appendDecision(entry, ledgerPath) — append + hash-chain integrity
              └── returns void, writes to JSONL
```

### `authorize.ts`

Public entrypoint. Async. Orchestrates validation → policy load → snapshot → evaluation → ledger write → response.

```ts
authorize(request: AuthorizeRequest, options: {
  policyPath: string;
  ledgerPath: string;
}): Promise<AuthorizeResponse>
```

Three outcomes:

| Status | Meaning |
|---|---|
| `approved` | Policy matched and all limits passed |
| `denied` | Blocked by a rule, limit exceeded, or invalid request |
| `pending_approval` | No matching rule (or rule verdict is `pending_approval`) — a human must act |

Input validation failures always produce `denied` and are written to the ledger for auditability.

### `policy.ts`

Pure function — no I/O, no filesystem, no async. Takes a request, a parsed policy, and a ledger snapshot. Returns an `EvaluationResult`.

```ts
evaluatePolicy(
  request: AuthorizeRequest,
  policy: Policy,
  ledger: LedgerSnapshot,
): EvaluationResult
```

Evaluation order:

1. Validate `amount` (non-negative finite number).
2. Find the first rule where `resource`, `actions`, and `rails` all match. `resource: "*"` matches any resource. `actions`/`rails` are optional filters; omitting them means "match all".
3. If no rule matches → use `policy.defaultVerdict` (defaults to `pending_approval`).
4. If the matched rule's `verdict` is not `approved` → return that verdict immediately.
5. Check `maxAmount` (per-transaction limit). Deny if exceeded.
6. Check `maxDailyAmount` against the ledger snapshot's 24-hour running total. Deny if `spent + incoming > limit`.
7. Return `approved` with all accumulated reasons.

Rule matching is **first-match-wins**. Rule order in the YAML file matters.

### `ledger.ts`

Append-only local ledger stored as newline-delimited JSON (`decisions.jsonl`). Two record types coexist in the same file:

- `LedgerEntry` — an authorization decision (approval/denial/pending)
- `ApprovalEntry` — a human approval or denial of a pending decision (identified by `kind: "approval"`)

The original decision record is **never mutated**. Human resolutions are appended as new records.

**Locking:** Uses an exclusive `.lock` file (`decisions.jsonl.lock`) before any write. Polls every 25ms, times out after 5 seconds, removes stale locks (>30 seconds old). Only the snapshot read inside `getLedgerSnapshot` does not require the lock; all writes do.

**Hash chain:** Every record gets an `integrity` block appended at write time:

```json
{
  "integrity": {
    "version": 1,
    "sequence": 4,
    "previousHash": "sha256:abc...",
    "hash": "sha256:def..."
  }
}
```

`hashLedgerRecord(previousHash, recordBody)` computes `sha256(canonicalJson({ previousHash, record: body }))`. The genesis hash is `sha256:000...000` (64 zeros). Old records without an `integrity` block are treated as legacy — they validate as a structural pass but are flagged in the integrity report.

**Snapshot:** `getLedgerSnapshot` scans all approved decisions in the last 24 hours and aggregates `amount` by key `"${actor}|${resource}"`. This snapshot is passed to `evaluatePolicy` for daily limit checks.

Key functions:

| Function | Description |
|---|---|
| `appendDecision` | Write a new decision with integrity block |
| `appendApproval` | Write a new approval record with integrity block |
| `readDecisions` | Read all decision records, with optional `status`/`actor`/`since` filters |
| `readApprovals` | Read all approval records |
| `getDecisionById` | Find a single decision by ID |
| `getApprovalForDecision` | Find the approval record for a decision |
| `getPendingApprovals` | Return all `pending_approval` decisions that have no approval record |
| `getLedgerSnapshot` | Compute 24h daily totals for budget checks |
| `getLedgerIntegrity` | Return head hash and record counts for snapshot verification |
| `withLedgerLock` | Exclusive lock wrapper for any write operation |

### `approve.ts`

Wraps `withLedgerLock` and enforces three pre-conditions before writing an `ApprovalEntry`:

1. Decision exists in the ledger.
2. Decision status is `pending_approval`.
3. No approval record for this decision already exists.

```ts
approve(decisionId: string, options: { ledgerPath: string }): Promise<ApprovalEntry>
deny(decisionId: string, options: { ledgerPath: string }): Promise<ApprovalEntry>
```

IDs are prefixed `apr_` + 6 random hex bytes.

### `integrity.ts`

Cryptographic primitives used by the ledger and snapshot modules:

- `canonicalJson(value)` — deterministic JSON serialization (object keys sorted recursively, non-JSON types rejected)
- `sha256Hex(value)` — `sha256:<hex>` prefixed digest
- `hashLedgerRecord(previousHash, body)` — hash of `{ previousHash, record: body }` in canonical form
- `hmacSha256Hex(secret, payload)` — `hmac-sha256:<hex>` prefixed HMAC for snapshot signing
- `verifyHmacSha256(secret, payload, signature)` — timing-safe comparison

### `snapshot.ts`

Point-in-time audit snapshots that bind a policy file and ledger head together under an HMAC signature. Useful for CI checks or compliance records.

```ts
createSignedSnapshot(options): Promise<SignedSnapshot>
verifySignedSnapshot(snapshot, options): Promise<SnapshotVerification>
```

The snapshot captures:
- SHA-256 of the policy YAML file content
- Ledger head hash, record count, legacy record count
- HMAC-SHA256 of the above payload using `SHOTOKU_SNAPSHOT_SECRET`

Verification re-computes the policy hash and ledger integrity report and compares them against the stored values.

### `x402.ts`

Authorization gate for x402 HTTP 402 payments. Converts the x402 wire format into an `AuthorizeRequest` and calls `authorize()`. Does not sign or settle payments — only decides and records.

```ts
parseX402Response(response: X402Response, decimals?: number): PaymentRequirements
authorizeX402Payment(actor, requirements, options): Promise<AuthorizeResponse>
```

`parseX402Response` reads the first entry from the `accepts` array and converts the atomic-unit amount string to a decimal float (defaults to 6 decimals, the USDC convention). `authorizeX402Payment` builds a request with `action: "purchase"`, `rail: "x402"`, and records `payTo`, `asset`, and `network` in the decision context for audit.

### `explain.ts`

Derives a single `Explanation` from an `EvaluationResult`. Called inside `authorize()` before ledger write.

- `approved` → join the `policy_match`, `limit_check`, and `budget_check` reason texts.
- `denied` → surface the last reason (the one that caused the denial).
- `pending_approval` → surface the first reason and set `hint: "shotoku approve <decisionId>"`.

### `validation.ts`

Two validation paths:

**Request validation** (`validateAuthorizeRequest`) — returns `ReasonItem[]`. Empty array means valid. Checks:
- `actor`: required, non-empty string, ≤ 256 characters
- `action`: must be one of the 6 known `AgentAction` values
- `resource`: required, non-empty string, ≤ 512 characters
- `rail`: optional, must be one of the 5 known `ExecutionRail` values if present
- `amount`: optional, must be a non-negative finite number
- `context`: optional, must be JSON-serializable, no circular references, ≤ 16 384 bytes

**Policy validation** (`validatePolicy`) — throws `ShotokuError("policy_invalid", ...)`. Validates object shape, rejects unknown keys, validates each rule's `resource`, `verdict`, `actions`, `rails`, `maxAmount`, `maxDailyAmount`.

### `errors.ts`

Typed internal error class. All `ShotokuError` instances carry a machine-readable `code` and a human-readable `userMessage`. `toUserSafeMessage(error)` extracts a safe string from any thrown value — used throughout CLI and MCP to avoid leaking stack traces.

Error codes: `config_invalid`, `ledger_corrupt`, `ledger_lock_timeout`, `ledger_read_failed`, `ledger_write_failed`, `policy_invalid`, `policy_not_found`, `request_invalid`.

### `types.ts`

Domain types only — no implementation. Key types:

```ts
AuthorizeRequest     — what the agent wants to do
AuthorizeResponse    — the decision + reasons + explanation + ID + timestamp
LedgerEntry          — a persisted decision record
ApprovalEntry        — a persisted human resolution (kind: "approval")
Policy               — parsed policy (rules + defaultVerdict)
PolicyRule           — a single rule (resource, actions?, rails?, verdict, maxAmount?, maxDailyAmount?)
LedgerSnapshot       — pre-computed 24h daily totals
EvaluationResult     — policy engine output (status + reasons)
Explanation          — human-readable summary + optional hint
SignedSnapshot       — HMAC-signed audit snapshot
```

---

## Ledger File Format

Default path: `data/decisions.jsonl`. One JSON object per line.

**Decision record:**
```json
{
  "decisionId": "dec_a1b2c3d4e5f6",
  "timestamp": "2024-01-15T14:05:22.000Z",
  "request": {
    "actor": "my-agent",
    "action": "api_call",
    "resource": "openai.com",
    "amount": 5
  },
  "response": {
    "approved": true,
    "status": "approved",
    "reasons": [
      { "type": "policy_match", "text": "openai.com matched rule" },
      { "type": "limit_check", "text": "Amount $5 is within per-transaction limit of $50" },
      { "type": "budget_check", "text": "Daily budget remaining: $195" }
    ],
    "explanation": { "summary": "openai.com matched rule. Amount $5 is within per-transaction limit of $50. Daily budget remaining: $195" },
    "decisionId": "dec_a1b2c3d4e5f6",
    "timestamp": "2024-01-15T14:05:22.000Z"
  },
  "integrity": {
    "version": 1,
    "sequence": 1,
    "previousHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "hash": "sha256:abc123..."
  }
}
```

**Approval record:**
```json
{
  "kind": "approval",
  "approvalId": "apr_f1e2d3c4b5a6",
  "decisionId": "dec_9z8y7x6w5v4u",
  "verdict": "approved",
  "timestamp": "2024-01-15T14:07:45.000Z",
  "integrity": { ... }
}
```

---

## Policy File Format

Default path: `policy.yaml`. Loaded fresh on every `authorize()` call.

```yaml
rules:
  - resource: openai.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

  - resource: "*"
    actions: [send_email]
    verdict: denied

defaultVerdict: pending_approval
```

Field reference:

| Field | Type | Required | Description |
|---|---|---|---|
| `resource` | string | yes | Exact resource string or `"*"` to match all |
| `verdict` | string | yes | `approved`, `denied`, or `pending_approval` |
| `actions` | string[] | no | Limit to specific actions. Omit to match all |
| `rails` | string[] | no | Limit to specific rails. Omit to match all |
| `maxAmount` | number | no | Per-transaction ceiling (USD or major units) |
| `maxDailyAmount` | number | no | Rolling 24-hour ceiling per `actor+resource` pair |

Valid `actions`: `purchase`, `api_call`, `execute_code`, `send_email`, `mcp_tool`, `custom`

Valid `rails`: `x402`, `mcp`, `api`, `code`, `custom`

---

## CLI Package (`shotoku-cli`)

Entrypoint: `cli/src/index.ts`. Uses `commander`. All commands resolve paths through `resolveRuntimePaths()` which reads `shotoku.config.json` (if present) and applies CLI flag overrides.

Path resolution priority: CLI flag → config file → default.

| Default | Value |
|---|---|
| Config file | `shotoku.config.json` (cwd) |
| Policy | `policy.yaml` (relative to config file dir) |
| Ledger | `data/decisions.jsonl` (relative to config file dir) |

### Commands

**`shotoku authorize`**

```
--actor <id>       Agent identifier (required)
--action <action>  One of the 6 AgentAction values (required)
--resource <res>   Target resource (required)
--amount <n>       Non-negative decimal amount (optional)
--policy <path>    Override policy path
--ledger <path>    Override ledger path
```

Exits `0` on approved, `1` on denied or pending.

Output format:
```
✓ APPROVED  dec_abc123
  • openai.com matched rule
  • Amount $5 is within per-transaction limit of $50
  • Daily budget remaining: $195
  Recorded at 14:05:22

✗ DENIED  dec_def456
  • anthropic.com is not on the allowlist

◷ PENDING APPROVAL  dec_ghi789
  • vendor-xyz.com is not on the allowlist
  → Run: shotoku approve dec_ghi789
```

**`shotoku history`**

```
--actor <id>     Filter by actor
--since <window> 24h | 7d | 30d
--status <s>     approved | denied | pending_approval
--ledger <path>
```

Displays a table of decisions with `✓`/`✗`/`◷` icons, age, and resolution tags for actioned pending decisions. Summary line: `N total · A approved · D denied · P pending`.

**`shotoku status`**

Shows all unresolved `pending_approval` decisions with actor, resource, amount, age, reasons, and `approve`/`deny` hints. Shows the last decision regardless of status.

**`shotoku decision <id>`**

Full detail for a single decision: all request fields, all reasons, timestamp. If a resolution exists, shows the verdict and approval ID. If pending, shows the `shotoku approve <id>` hint.

**`shotoku approve <id>` / `shotoku deny <id>`**

Calls `approve()` or `deny()` from core. Enforces the three pre-conditions (exists, is pending, not already resolved). On success: `✓ Approved. Recorded as apr_xxx.`

**`shotoku init`**

Creates `shotoku.config.json`, `policy.yaml`, and `data/` in the target directory. Skips files that already exist. Prints `✓ Created` or `· Skipped` for each file.

**`shotoku snapshot create`**

Reads `SHOTOKU_SNAPSHOT_SECRET` from env. Writes a signed JSON snapshot to `--out` (default: `shotoku.snapshot.json`). Requires `policyPath` and `ledgerPath` to be resolvable.

**`shotoku snapshot verify`**

Reads a snapshot file and re-verifies the HMAC signature, policy hash, and ledger head hash against the live files. Exits `0` on match, `1` with error message on any mismatch.

**`shotoku tui`**

Launches an Ink-based terminal UI in the alternate screen buffer. Components:

| File | Role |
|---|---|
| `App.tsx` | Root component, wires ledger path, manages refresh |
| `Header.tsx` | Top bar with branding and current time |
| `Banner.tsx` | Status summary (pending count, last decision) |
| `PendingPanel.tsx` | Navigable list of pending approvals; `↑/↓` to select, `Enter` to approve, `d` to deny |
| `HistoryPanel.tsx` | Recent decision history, toggled with `h` |
| `Footer.tsx` | Keyboard shortcut legend |

---

## MCP Package (`shotoku-mcp`)

Stdio transport. Connects to Claude or any MCP-compatible host. Exposes 5 tools:

| Tool | Description |
|---|---|
| `authorize_action` | Run an authorization check. Returns full `AuthorizeResponse` as JSON |
| `get_decision` | Fetch a single decision by ID |
| `get_pending_approvals` | List all unresolved pending decisions |
| `approve_decision` | Approve a pending decision by ID |
| `deny_decision` | Deny a pending decision by ID |

Config is loaded from `shotoku.config.json` in the working directory via `mcp/src/config.ts`. All tools share the same policy and ledger paths.

The MCP server calls the same `authorize()`, `approve()`, `deny()` functions as the CLI — there is no separate MCP-specific logic.

---

## Configuration File

`shotoku.config.json` — optional, JSON:

```json
{
  "policyPath": "policy.yaml",
  "ledgerPath": "data/decisions.jsonl"
}
```

Paths are resolved relative to the config file's directory. Absolute paths are accepted. If the file does not exist, defaults are used.

---

## Known Design Constraints

**No sub-execution visibility.** Shotoku authorizes the declared action. If an agent requests `execute_code` authorization and runs a script that then sends email, Shotoku does not see that secondary action. Nested authorization (the script itself calling `authorize()` before sending email) is the only way to enforce sub-action policy without a sandbox runtime. This is an intentional design constraint, not an oversight — enforcing sub-execution requires OS-level interception and is out of scope for v1.

**Honor-system by design.** Shotoku does not intercept syscalls, wrap process environments, or proxy HTTP traffic. An agent that calls `authorize()` and then ignores the decision is not stopped. The ledger records the decision regardless of what the agent actually does. The model assumes cooperative agents — developers instrument their own agent code to call `authorize()` before acting.

**Policy is re-read on every call.** `loadPolicy()` reads and parses `policy.yaml` on each `authorize()` invocation. There is no caching. Policy changes take effect on the next call with no restart required. This trades a small I/O cost for operational simplicity.

**Single-writer ledger.** The file lock is process-level (`O_EXCL` on the `.lock` file). Multiple processes writing to the same ledger file will serialize correctly, but concurrent writes from the same process within a single lock scope are not supported.

**Amount arithmetic is floating-point.** Daily totals are accumulated as JavaScript `number`. This is safe for the typical ranges (USD cents to hundreds of dollars) but is not suitable for high-precision financial accounting. The x402 module converts atomic units to floats using string arithmetic to avoid intermediate precision loss.

**Legacy records.** Records written before the hash-chain was introduced have no `integrity` block. They are accepted during ledger reads and flagged as `legacyRecordCount` in the integrity report. The hash chain treats the body hash of a legacy record as its effective hash for the chain computation, preserving forward integrity from the first signed record onward.
