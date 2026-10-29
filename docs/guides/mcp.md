# MCP Integration

MCP (Model Context Protocol) is an open standard that lets AI agents call external tools during a task. Any MCP-compatible agent can connect to Shotoku and check your authorization policy before acting.

This guide uses Claude Desktop as the example host, but the setup pattern is the same for any MCP-compatible environment.

---

## Why use the MCP server?

The CLI is for you — you run commands, you read the output.

The MCP server is for your agent — it calls Shotoku automatically, mid-task, before doing something that costs money or touches an external service. You don't have to intervene. The agent asks Shotoku, Shotoku checks your policy, and the agent either proceeds or pauses and tells you it needs your approval.

---

## Install

Nothing to clone or build:

```bash
npx shotoku-mcp
```

It speaks MCP over stdin, so running it by hand just sits there waiting — that is correct. Your agent host is what launches it.

You will also want the CLI, which is how you review and approve what the agent asked for:

```bash
npm install -g shotoku-cli
```

---

## Setup

### 1. Give Shotoku a home

Your agent host launches the server with a working directory it chooses — often the filesystem root. A fixed home means that never matters:

```bash
mkdir -p ~/shotoku-home
cd ~/shotoku-home
shotoku init
```

### 2. Register Shotoku with your agent host

```json
{
  "mcpServers": {
    "shotoku": {
      "command": "npx",
      "args": ["-y", "shotoku-mcp"],
      "env": {
        "SHOTOKU_HOME": "/absolute/path/to/shotoku-home"
      }
    }
  }
}
```

**Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Restart the app afterwards.

That config gives you *advisory* mode: the agent calls `authorize_action` when it decides to. To make the gate unavoidable, add `SHOTOKU_MCP_UPSTREAMS` — see [Gating other MCP servers](#gating-other-mcp-servers).

---

## Verifying the connection

Once your agent host is running, confirm that it discovered the Shotoku tools:

- `authorize_action`
- `get_decision`
- `get_pending_approvals`

Three tools, not five. `approve_decision` and `deny_decision` are withheld by default and refused if called: an agent that can approve its own pending decisions defeats the entire point of the product. See [Approvals happen out-of-band](#approvals-happen-out-of-band).

How you verify depends on your host. In Claude Desktop, click the tools icon (hammer) in a new conversation and look for the **shotoku** section.

---

## The tools

### `authorize_action`

The main gate. The agent calls this before performing any action — spending money, calling an API, running code, sending a message.

| Field | Required | What it means |
|---|---|---|
| `action` | yes | What the agent wants to do (`purchase`, `api_call`, `execute_code`, `send_email`, `mcp_tool`, `custom`) |
| `resource` | yes | What it's acting on — a domain, service name, or endpoint |
| `amount` | no | How much it costs in USD, if applicable |
| `context` | no | Any extra details you want recorded with the decision |

There is deliberately no `actor` field. Identity comes from the connected client, not from the call — see [Who the decision is attributed to](#who-the-decision-is-attributed-to).

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

## Who the decision is attributed to

Every decision is recorded against an **actor** — the name of the agent that asked. Shotoku sets it; the agent does not.

An MCP client announces its own name during the initialize handshake, before it can make a single tool call, and the model on the other side never sees that value. So a connection from Claude Desktop is recorded as `claude-desktop`, one from Cursor as `cursor`, and so on, with no configuration.

To name a server yourself — one entry per agent, each with its own budget and rules — set `SHOTOKU_MCP_ACTOR` in that server's config block:

```json
{
  "mcpServers": {
    "shotoku-billing": {
      "command": "npx",
      "args": ["-y", "shotoku-mcp"],
      "env": { "SHOTOKU_MCP_ACTOR": "billing-agent" }
    }
  }
}
```

Then write rules that apply to that agent alone:

```yaml
rules:
  - resource: "*"
    actor: billing-agent
    verdict: approved
    maxDailyAmount: 50
```

A limit needs an amount to check. `authorize_action` calls that pass `amount` are counted against the $50; wrapped tool calls carry no amount, so this rule holds each of them for approval instead of letting them through uncounted.

**What this does and does not guarantee.** It makes agents *distinguishable*, not *unforgeable*. An agent with shell access can edit a config file, or skip Shotoku altogether. The guarantee is narrower and still worth having: every call that goes through Shotoku is attributed to a named agent, and **an agent cannot rename itself through the protocol**. That is what makes the ledger worth reading.

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

## Walkthrough

Here is what a typical exchange looks like once Shotoku is connected:

**You:** Research the top three AI coding tools and summarize pricing.

**Agent** *(internally)*: I need to call an external API for this. Let me check with Shotoku first.
→ calls `authorize_action` with `{ action: "api_call", resource: "openai.com", amount: 0.05 }`

**Shotoku** *(checks policy, records decision)*: approved

**Agent:** Here are the top three AI coding tools...

---

Or if your policy requires approval:

**Agent:** I need to call a service that isn't on your allowlist. Shotoku flagged this as pending approval.
→ Run `shotoku approve dec_abc123` to allow it, or `shotoku deny dec_abc123` to block it.

---

## Gating other MCP servers

Everything above assumes the agent *chooses* to ask Shotoku. It can also decline to ask.

Wrapping removes that choice. Shotoku connects to your other MCP servers, re-exposes their tools as its own, and gates every call. The agent talks to Shotoku and nothing else — it never sees the servers behind it.

```
before          agent ──────────────────────► obsidian
after           agent ──► shotoku ──► policy ──► obsidian
```

### Turning it on

List the servers to put behind Shotoku in a file — the format is the same `mcpServers` shape your agent host already uses, so you can usually move entries across unchanged:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "/path/to/obsidian-mcp-server",
      "env": { "OBSIDIAN_API_KEY": "..." }
    },
    "reddit": {
      "command": "npx",
      "args": ["-y", "reddit-mcp-buddy"]
    }
  }
}
```

Point Shotoku at it, and **remove those servers from your host config** — otherwise the agent keeps a direct route to them and the gate is decorative:

```json
{
  "mcpServers": {
    "shotoku": {
      "command": "npx",
      "args": ["-y", "shotoku-mcp"],
      "env": {
        "SHOTOKU_MCP_UPSTREAMS": "/absolute/path/to/upstreams.json",
        "SHOTOKU_LEDGER": "/absolute/path/to/data/decisions.jsonl"
      }
    }
  }
}
```

Restart your host. Where you previously saw `search_vault`, you now see `obsidian__search_vault`.

### Writing rules for wrapped tools

A wrapped tool is named `<server>__<tool>`, and **that name is the `resource` in your policy**. This is the single most useful thing to know about wrapping:

```yaml
rules:
  # Reading is free
  - resource: obsidian__get_*
    verdict: approved
  - resource: obsidian__search_*
    verdict: approved

  # Writing is allowed, and recorded
  - resource: obsidian__create_*
    verdict: approved

  # Deleting is not something an agent decides alone
  - resource: obsidian__delete_*
    verdict: pending_approval

defaultVerdict: pending_approval
```

Wrapped calls are recorded as `action: mcp_tool` on the `mcp` rail, so `actions` and `rails` narrow rules further if you need them.

`defaultVerdict: pending_approval` is worth keeping here. A new tool appearing in an upstream server — after an update, say — is then held for review rather than silently allowed.

### Putting a price on wrapped tools

A wrapped call has no amount, so `maxAmount` and `maxDailyAmount` cannot be checked against it, and a rule with either holds every call for approval. To spend-limit a server's tools, name a pricer on its upstream entry:

```json
{
  "mcpServers": {
    "paypal": {
      "command": "npx",
      "args": ["-y", "@paypal/mcp", "--tools=all"],
      "env": { "PAYPAL_ACCESS_TOKEN": "...", "PAYPAL_ENVIRONMENT": "SANDBOX" },
      "pricing": "paypal"
    }
  }
}
```

The amount is **the money the call sends out of the account**. `paypal` is the only pricer so far, for PayPal's MCP server:

| Tool | Priced at |
|---|---|
| `create_refund` with `amount` | that amount |
| `create_refund` without `amount` | the full capture, looked up from PayPal, because that is what PayPal refunds |
| `accept_dispute_claim` | the disputed amount, looked up from PayPal |
| every other `@paypal/mcp` tool (reads, orders, invoices, catalog, subscriptions) | $0: none of them sends money out |
| anything else | not priced |

Lookups are read-only GETs with the token from the server's own `env`. A call that cannot be priced (failed lookup, a currency other than USD, a malformed amount, a tool the pricer does not know) gets no amount, never a zero one, so a limited rule holds it for a human. Where an amount came from is recorded with the decision (`amountSource`).

```yaml
rules:
  - resource: paypal__create_refund
    verdict: approved
    maxAmount: 100
    maxDailyAmount: 300
  - resource: paypal__list_*
    verdict: approved
defaultVerdict: pending_approval
```

A $89 refund passes. A refund with no amount on a $480 capture is denied: the lookup prices it at $480. Add `overLimit: pending_approval` to the refund rule and it is held for a human instead. After `shotoku approve`, the agent's identical retry goes through.

### What the agent sees when it is blocked

```
Blocked by Shotoku — this action was not authorized.
  status:   pending_approval
  decision: dec_cd9b9664cf9f
  reason:   obsidian__delete_vault_file matched rule
  A human must approve this out-of-band (`shotoku approve dec_cd9b9664cf9f`,
  the Shotoku TUI, or their phone). You cannot approve it yourself — ask the user.
  Once they approve, retry this exact call: the approval is redeemable once,
  for these arguments only. Changing anything requires a new approval.
```

A denial says so plainly and tells the agent not to retry.

### What is recorded, and what is not

The decision records the server, the tool, and the **names** of the arguments — never their values. Tool arguments routinely carry API keys, file contents and personal data, and an audit log is not a place to accumulate them.

The values are still bound to the approval, through a digest. That is what stops an approval for one file from being redeemed against another.

One exception: a priced call records where its amount came from (`amountSource`), and for PayPal that names the capture or dispute the amount was looked up from, e.g. `full refund of capture 2PY84818WJ8069634`. Those IDs identify a payment; they are not credentials.

---

## Approvals happen out-of-band

`approve_decision` and `deny_decision` exist, but a default install does not expose them, and calling one is refused outright. An agent that can approve its own pending decisions has not been gated at all — it has been given a form to fill in.

So approval happens somewhere the agent cannot reach:

```bash
shotoku status
shotoku approve dec_abc123
```

or in the TUI (`shotoku tui`), or with a tap on your phone (`shotoku telegram`, see [Approve from your phone](phone-approvals.md)).

`SHOTOKU_MCP_ALLOW_APPROVALS=1` lifts the restriction. It is meant for a human driving the server directly, and it removes the separation the product exists to provide.

### After you approve

An approval is redeemable **once**, by the next call that matches it exactly — same agent, same tool, same arguments, same amount. The agent retries, the call goes through, and the grant is spent.

```
agent   → obsidian__delete_vault_file   ◷ pending, dec_21028c
you     → shotoku approve dec_21028c
agent   → obsidian__delete_vault_file   ✓ approved
agent   → obsidian__delete_vault_file   ◷ pending again
```

That last line is the design, not a bug. Approving an action is not approving it forever — standing permission is what `policy.yaml` is for. Approvals expire too, after fifteen minutes by default (`grantTtlSeconds`).

`shotoku status` shows approvals that are waiting to be used, so an approval never disappears into nothing:

```
1 approval waiting to be used by the agent:
  ✓  claude-desktop · obsidian__delete_vault_file · expires in 12m
```

---

## When something is wrong

**The host says the server failed to start.** Almost always the upstreams file: check it is valid JSON and that the path in `SHOTOKU_MCP_UPSTREAMS` is absolute. The server writes the reason to stderr; your host will have it in its MCP logs.

**No `<server>__<tool>` tools appear.** Wrapping is off or found nothing. `SHOTOKU_MCP_UPSTREAMS` must be set and point at a file containing an `mcpServers` object, and each entry needs a `command`.

**`shotoku status` shows nothing, but the agent says it is blocked.** The CLI and the server are reading different ledgers. Run `shotoku where` in your terminal, and compare it with the `SHOTOKU_LEDGER` in your host config.

**Everything is denied, including things your policy allows.** The policy file failed to load, and Shotoku fails closed. Run any `shotoku authorize` command; the reason names the problem.

**An approval does not let the retry through.** Something in the call changed — a different argument, a different amount — or more than fifteen minutes passed. The grant binds to the exact call that was approved.

---

## Environment variables

| Variable | Default | What it controls |
|---|---|---|
| `SHOTOKU_MCP_UPSTREAMS` | unset | Path to the upstream servers file. Setting it turns on wrapping |
| `SHOTOKU_MCP_ACTOR` | the client name | Overrides the agent name recorded in the ledger |
| `SHOTOKU_MCP_ALLOW_APPROVALS` | unset | `1` exposes the approval tools to the agent. Read the warning below first |
| `SHOTOKU_HOME` | `~/.shotoku` | Where policy and ledger live when nothing else says otherwise |
| `SHOTOKU_CONFIG` | `shotoku.config.json` | Path to the Shotoku config file |
| `SHOTOKU_POLICY` | from the home | Path to your policy file |
| `SHOTOKU_LEDGER` | from the home | Path to the local decision ledger |
| `SHOTOKU_RECEIPT_SECRET` | unset | When set, approved decisions carry a signed receipt |

**`SHOTOKU_MCP_ALLOW_APPROVALS=1` disables the product's core separation.** It hands the agent the tools to approve and deny its own pending decisions. There is no scenario in normal use where you want this; it exists for a human driving the server directly.

### Which files the server actually uses

The MCP server is launched by your agent host, which chooses the working directory — often the filesystem root. That makes path resolution worth being explicit about. Every Shotoku process resolves the same way, highest priority first:

1. `SHOTOKU_POLICY` / `SHOTOKU_LEDGER`
2. a `shotoku.config.json`, searched for from the working directory upward
3. an existing `./data/decisions.jsonl` beside the working directory
4. `$SHOTOKU_HOME`, otherwise `~/.shotoku`

To see what any directory resolves to, and what decided it:

```bash
shotoku where
```

Run that, and run it again with the environment your MCP server has. If the two disagree, the server is writing decisions the CLI cannot see — which shows up as `shotoku status` reporting an empty approval queue while an action waits.
