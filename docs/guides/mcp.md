# MCP Integration

MCP (Model Context Protocol) is an open standard that lets AI agents call external tools during a task. Any MCP-compatible agent can connect to Shotoku and check your authorization policy before acting.

This guide uses Claude Desktop as the example host, but the setup pattern is the same for any MCP-compatible environment.

---

## Why use the MCP server?

The CLI is for you — you run commands, you read the output.

The MCP server is for your agent — it calls Shotoku automatically, mid-task, before doing something that costs money or touches an external service. You don't have to intervene. The agent asks Shotoku, Shotoku checks your policy, and the agent either proceeds or pauses and tells you it needs your approval.

---

## Prerequisites

- Node.js installed
- An MCP-compatible agent host (Claude Desktop, a custom agent, or any host that supports MCP tool servers)
- Shotoku cloned and built (`pnpm install && pnpm build` from the repo root)

---

## Setup

### 1. Build the MCP server

From the repo root:

```bash
pnpm build
```

This produces `mcp/dist/index.js` — the file your agent host will run.

### 2. Register Shotoku with your agent host

Most MCP hosts accept a JSON config that tells them which servers to run. The entry looks like this:

```json
{
  "mcpServers": {
    "shotoku": {
      "command": "node",
      "args": ["/absolute/path/to/shotoku/mcp/dist/index.js"],
      "env": {
        "SHOTOKU_POLICY": "/absolute/path/to/shotoku/policy.yaml",
        "SHOTOKU_LEDGER": "/absolute/path/to/shotoku/data/decisions.jsonl"
      }
    }
  }
}
```

Replace the paths with the actual location of your Shotoku repo.

**Claude Desktop:** add this to `~/Library/Application Support/Claude/claude_desktop_config.json`, then restart the app.

Refer to your agent host's documentation for where to place MCP server configuration.

### 3. Create the ledger directory

```bash
mkdir -p data
```

---

## Verifying the connection

Once your agent host is running, confirm that it discovered the Shotoku tools:

- `authorize_action`
- `get_decision`
- `get_pending_approvals`
- `approve_decision`
- `deny_decision`

How you verify depends on your host. In Claude Desktop, click the tools icon (hammer) in a new conversation and look for the **shotoku** section.

---

## The tools

### `authorize_action`

The main gate. The agent calls this before performing any action — spending money, calling an API, running code, sending a message.

| Field | Required | What it means |
|---|---|---|
| `actor` | yes | Who is acting — the agent's name or ID |
| `action` | yes | What the agent wants to do (`purchase`, `api_call`, `execute_code`, `send_email`, `mcp_tool`, `custom`) |
| `resource` | yes | What it's acting on — a domain, service name, or endpoint |
| `amount` | no | How much it costs in USD, if applicable |
| `context` | no | Any extra details you want recorded with the decision |

Shotoku checks your `policy.yaml`, records the decision to the local ledger, and returns one of three outcomes:

- **approved** — the action can proceed
- **denied** — the action is blocked
- **pending_approval** — a human needs to approve before the action continues

The MCP response includes both readable text and structured JSON content. Agents should use the structured content when they need to branch on `status` or store `decisionId`.

Example response:

```json
{
  "approved": true,
  "status": "approved",
  "reasons": [
    { "type": "policy_match", "text": "openai.com matched rule" },
    { "type": "limit_check", "text": "Amount $5 is within per-transaction limit of $50" },
    { "type": "budget_check", "text": "Daily budget remaining: $195" }
  ],
  "explanation": {
    "summary": "openai.com matched rule. Amount $5 is within per-transaction limit of $50. Daily budget remaining: $195"
  },
  "decisionId": "dec_f3f0a6da3a69",
  "timestamp": "2026-06-22T15:02:00.000Z"
}
```

---

### `get_decision`

Looks up a single past decision by its ID (e.g. `dec_f3f0a6da3a69`). Returns the full record — the original request, the outcome, and the reasons.

Useful when the agent wants to reference what was decided earlier in a session.

---

### `get_pending_approvals`

Returns a list of every decision that is waiting for a human to approve or deny.

The agent can surface this during a conversation: *"You have 2 pending approvals — want to review them?"*

If nothing is waiting, it returns: `No pending approvals.`

---

### `approve_decision`

Approves a decision that is currently pending human review.

Input:

```json
{ "decisionId": "dec_abc123" }
```

Shotoku appends a new approval record to the ledger. It does not mutate the original decision. That keeps the audit trail honest: you can see both the original decision and the later human action.

---

### `deny_decision`

Denies a decision that is currently pending human review.

Input:

```json
{ "decisionId": "dec_abc123" }
```

Like approval, denial is append-only. The original decision remains in the ledger, and the denial is recorded as a separate action.

---

## Walkthrough

Here is what a typical exchange looks like once Shotoku is connected:

**You:** Research the top three AI coding tools and summarize pricing.

**Agent** *(internally)*: I need to call an external API for this. Let me check with Shotoku first.
→ calls `authorize_action` with `{ actor: "my-agent", action: "api_call", resource: "openai.com", amount: 0.05 }`

**Shotoku** *(checks policy, records decision)*: approved

**Agent:** Here are the top three AI coding tools...

---

Or if your policy requires approval:

**Agent:** I need to call a service that isn't on your allowlist. Shotoku flagged this as pending approval.
→ Run `shotoku approve dec_abc123` to allow it, or `shotoku deny dec_abc123` to block it.

---

## Environment variables

| Variable | Default | What it controls |
|---|---|---|
| `SHOTOKU_CONFIG` | `shotoku.config.json` | Path to the Shotoku config file |
| `SHOTOKU_POLICY` | `policy.yaml` | Path to your policy file |
| `SHOTOKU_LEDGER` | `data/decisions.jsonl` | Path to the local decision ledger |

If `SHOTOKU_POLICY` or `SHOTOKU_LEDGER` are set, they win. Otherwise the server reads `shotoku.config.json`. If no config file exists, it falls back to `policy.yaml` and `data/decisions.jsonl`.

Relative paths inside `shotoku.config.json` are resolved from the config file directory. Relative paths in environment variables are resolved from the working directory where the server starts. Using absolute paths (as shown in the setup above) avoids ambiguity.
