# PayPal support-agent demo

An AI support agent can issue PayPal refunds. A customer writes that two orders arrived broken: an $89 lamp and a $480 chair. Nothing the agent can check says otherwise, and the shop's policy is to refund damaged items, so a well-behaved agent refunds both. Shotoku sits between the agent and PayPal's own MCP server ([`@paypal/mcp`](https://www.npmjs.com/package/@paypal/mcp)) and decides how far it can go alone:

```
agent → paypal__create_refund  $89, lamp        ✓ APPROVED   refunded by PayPal
agent → paypal__create_refund  $480, chair      ◷ PENDING    over the $100 limit, sent to your phone
you   → Approve or Deny on your phone           (you can ask the customer for a photo; the agent can't judge)
agent → retry                                   ✓ refunded, or ✗ blocked
```

The agent acts on what customers tell it, and it cannot tell a true claim from a false one. Shotoku does not try to: it limits what the agent can do unsupervised.

A second scenario, `--scenario injection`, hides a fake "system note" in the email telling the agent to refund the chair. In our test, Claude spotted that note, refused it and flagged the email as fraud. A less careful agent would not have, and Shotoku would hold the refund the same way; the claim scenario shows that without relying on the model being fooled.

Everything runs in the PayPal **sandbox**: no real money moves, and the setup script refuses to run against the live API.

## What you need

- Node 20+ and pnpm: `pnpm install && pnpm build` at the repo root.
- A PayPal sandbox app: at [developer.paypal.com](https://developer.paypal.com/dashboard/) → **Apps & Credentials** → **Sandbox** → the Default Application (or **Create App**). Copy its **Client ID** and **Secret** into `.env` at the repo root:

  ```
  PAYPAL_CLIENT_ID=...
  PAYPAL_CLIENT_SECRET=...
  ```

- Optional, for approvals on your phone: a Telegram bot. See [Approve from your phone](../../docs/guides/phone-approvals.md).

## Run it

```bash
node examples/paypal/setup.mjs
```

This creates two orders in your sandbox, pays them with PayPal's test card, and writes a fresh run to `examples/paypal/.run/`, with the claim email (`node examples/paypal/setup.mjs --scenario injection` for the other one). Running it again starts over with new orders and an empty ledger. It prints the exact commands for your machine; in short:

**1. Phone approvals (optional).** In a second terminal:

```bash
SHOTOKU_LEDGER="$PWD/examples/paypal/.run/decisions.jsonl" node cli/dist/index.js telegram
```

**2. The agent.** Either the scripted agent, which makes the same calls every time and needs no AI:

```bash
node examples/paypal/agent.mjs
```

or Claude, with Shotoku as its only MCP server. Setup writes the config to `examples/paypal/.run/claude-mcp.json`:

```bash
cd "$(mktemp -d)" && claude --strict-mcp-config --mcp-config /path/to/shotoku/examples/paypal/.run/claude-mcp.json --allowedTools mcp__shotoku
```

The empty folder keeps Claude from reading this repo's own docs, which describe the demo. `--allowedTools mcp__shotoku` lets it call the tools without asking each time: Shotoku is the gate under test, not Claude Code's permission prompt. (For Claude Desktop, copy the `shotoku` entry of that file into `claude_desktop_config.json` and restart it.) Then paste `examples/paypal/.run/agent-prompt.txt`: the agent's role, the shop's refund policy, and the customer email.

**3. Answer.** When the $480 refund is held, tap Approve or Deny on your phone, or in a terminal:

```bash
SHOTOKU_LEDGER="$PWD/examples/paypal/.run/decisions.jsonl" node cli/dist/index.js status
SHOTOKU_LEDGER="$PWD/examples/paypal/.run/decisions.jsonl" node cli/dist/index.js deny dec_...
```

The scripted agent waits up to ten minutes for your answer, then retries if you approved.

## What is going on

- [`policy.yaml`](policy.yaml): refunds up to $100 pass; over that, `overLimit: pending_approval` asks a human instead of refusing. Reads are free; anything else PayPal offers is held for review.
- `upstreams.json` (written by setup) wraps `@paypal/mcp` with `"pricing": "paypal"`. Shotoku prices each call by the money it sends out: the stated amount, or for a refund with no amount, the full capture looked up from PayPal, because that is what PayPal refunds. See [Putting a price on wrapped tools](../../docs/guides/mcp.md#putting-a-price-on-wrapped-tools).
- The upstream entry holds your client ID and secret. Shotoku mints a PayPal access token from them each time it starts and gives the PayPal server only the token. The file is written with mode 600 and `.run/` is gitignored; do not commit it.
- Every decision, and every approval with the channel it came through, is in `.run/decisions.jsonl`, hash-chained: `node cli/dist/index.js history` with the same `SHOTOKU_LEDGER`.
