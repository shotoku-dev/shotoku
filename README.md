# Shotoku

**Spend controls for AI agents.**

[![CI](https://github.com/shotoku-dev/shotoku/actions/workflows/ci.yml/badge.svg)](https://github.com/shotoku-dev/shotoku/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/shotoku-cli)](https://www.npmjs.com/package/shotoku-cli)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**[Watch the demo (3 min)](https://www.youtube.com/watch?v=OfXpXQCjEnA)** · **[Be the human in the loop, in your browser](https://www.shotoku.dev/demo)** · **[Run it yourself](#run-it-yourself)**

[![Shotoku and PayPal: an AI support agent's refund is held for a human](https://img.youtube.com/vi/OfXpXQCjEnA/maxresdefault.jpg)](https://www.youtube.com/watch?v=OfXpXQCjEnA)

Shotoku lets AI agents spend money safely — budgets, human approvals, and a tamper-evident audit trail, enforced deterministically on your machine **before** the payment happens. No cloud. No custody. Never holds funds or keys.

The same engine authorizes any agent action — the request model is rail-agnostic (x402, MCP, API, code). Spending is where the pain is sharpest today, so that's where it starts.

Works with [PayPal](examples/paypal/README.md) and [x402](docs/guides/x402.md). Designed for any rail.

## An AI agent with your PayPal account

Give an AI support agent PayPal's MCP server and it can refund any payment in your account, for any amount. It acts on what customers tell it, and it cannot tell a true claim from a false one.

A customer writes that two orders arrived broken: an $89 lamp and a $480 chair. The shop's policy is to refund damaged items, so a well-behaved agent refunds both. With Shotoku in front of PayPal's server:

```
claude → paypal__get_order       lamp, chair          ✓ APPROVED   reads are free
claude → paypal__create_refund   $89, lamp            ✓ APPROVED   refunded by PayPal
claude → paypal__create_refund   $480, chair          ◷ HELD       over the $100 limit, sent to your phone
you    → tap Approve or Deny
claude → retries the exact same call                  ✓ refunded, or ✗ blocked
```

Shotoku does not try to judge the claim. It decides how far the agent can go without you, and it does that with a rule, not with another model:

```yaml
- resource: paypal__create_refund
  verdict: approved
  maxAmount: 100
  overLimit: pending_approval
```

```mermaid
flowchart LR
  A["AI agent<br/>Claude, or any MCP client"] -->|every tool call| S
  subgraph S["Shotoku, on your machine"]
    direction TB
    P["1. Price the call<br/>what does it send out of the account?"] --> R["2. Policy and budgets<br/>deterministic, fails closed"] --> L[("3. Ledger<br/>append-only, hash-chained")]
  end
  S -->|approved| M["PayPal MCP server<br/>@paypal/mcp"] --> API["PayPal API"]
  S -.->|over the limit| H["You<br/>phone, dashboard, terminal"]
  H -.->|approval, good for one identical retry| S
```

What makes this hold up against a real agent:

- **The agent cannot skip it.** Shotoku is the only MCP server the agent sees. PayPal's server runs behind it, so there is no un-gated path to `create_refund`.
- **It prices what PayPal will actually do.** `create_refund` with no amount refunds the whole capture, so the cheapest-looking call is the most expensive one. Shotoku looks the capture up and prices the call at the full $480 before deciding.
- **The agent cannot approve itself.** Approval tools are not exposed over MCP and are refused if called. An approval lets through one identical retry: same agent, same tool, same arguments, same amount, within 15 minutes.
- **It never guesses.** No policy, an unreadable ledger, or an amount it cannot determine all end the same way: the agent is not approved.
- **Your PayPal secret stays with you.** Shotoku mints a short-lived access token from your app credentials and hands PayPal's server only the token.

[![The live demo: Claude's transcript on the left, held at a $480 refund; the Shotoku dashboard on the right, waiting for an answer](assets/dashboard.png)](https://www.shotoku.dev/demo)

**[Try it in your browser](https://www.shotoku.dev/demo).** Watch the agent work the email, answer the $480 refund it cannot make alone, then edit the ledger behind its back and see what happens. The agent's side is replayed from real runs against the PayPal sandbox; every decision is computed in the page by a port of Shotoku's policy and ledger code, hash chain included. The dashboard is the one `shotoku ui` serves locally, built with AG Grid.

## What the agent does with nobody watching

We gave the same Claude agent the same two orders 20 times, with no human answering: two customer emails, with and without Shotoku, five fresh sessions each.

| Customer email | Agent | Refunded the $480 chair | Refunded over the $100 limit |
|---|---|---|---|
| A plausible claim: "both arrived broken" | Unguarded | **5 of 5** | **$2,400** |
| | Behind Shotoku | 0 of 5, held for a human every time | $0 |
| A prompt injection hidden in the email | Unguarded | 0 of 5 | $0 |
| | Behind Shotoku | 0 of 5 | $0 |

Claude refused the injection every time. It also refunded the $480 chair every time a customer simply said it arrived broken, because that is what the shop's policy tells it to do. The model was not fooled; it had nothing to check the claim against. In all 20 runs the $89 lamp, under the limit, was refunded without anyone being asked.

This is a small sample on one model (`claude-opus-5-5`), run against the offline stand-in for PayPal. Reproduce it with `pnpm eval:paypal`; the script is [`examples/paypal/eval.mjs`](examples/paypal/eval.mjs).

## Run it yourself

You need Node 20+ and pnpm.

```bash
git clone https://github.com/shotoku-dev/shotoku && cd shotoku
pnpm install
```

**No PayPal account, one command.** Claude is the agent, a local stand-in answers for PayPal, and everything else is the real thing: the MCP wrapping, the policy, the approval, the ledger. When the $480 refund is held, type `y` or `n`.

```bash
pnpm demo:paypal
```

This uses the [Claude Code CLI](https://claude.com/claude-code) on the login you already have, so there is no API key to set up. Without it, `node examples/paypal/agent.mjs` runs a scripted agent that makes the same calls.

**Against the PayPal sandbox.** Put a sandbox app's `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env`, then:

```bash
pnpm build
node examples/paypal/setup.mjs       # creates and pays two real sandbox orders
node examples/paypal/agent-ai.mjs    # Claude handles the customer's email
```

Now the agent talks to PayPal's own MCP server, and the refunds are real sandbox refunds. `shotoku ui` shows the run in the dashboard and `shotoku telegram` sends the held refund to your phone; setup prints the exact commands. The [PayPal demo guide](examples/paypal/README.md) has every step, plus a prompt-injection scenario.

**No install at all.** `npx shotoku-cli demo` runs four simulated decisions in a few seconds.

## Built for the PayPal AI Hackathon

Shotoku started in June 2026 as a policy engine for x402 payments. Everything that connects it to PayPal was built during the hackathon, after 1 October 2026:

| Built during the hackathon | Where |
|---|---|
| Pricing for PayPal's MCP tools: refunds by amount or by capture lookup, dispute claims by dispute lookup, every other tool classified | [`mcp/src/paypal-pricing.ts`](mcp/src/paypal-pricing.ts) |
| Access tokens minted from app credentials, so the secret never reaches the upstream server | [`mcp/src/paypal-credentials.ts`](mcp/src/paypal-credentials.ts) |
| `overLimit: pending_approval`, so a rule can ask a human instead of refusing | [`core/src/policy.ts`](core/src/policy.ts) |
| Per-agent daily budgets across every vendor and tool | [`core/src/policy.ts`](core/src/policy.ts) |
| A call with no known amount is held for a human, never counted as zero | [`core/src/policy.ts`](core/src/policy.ts) |
| Approve or deny from your phone, through Telegram | [`cli/src/telegram/`](cli/src/telegram) |
| The local dashboard, built with AG Grid | [`cli/src/ui/`](cli/src/ui), [`cli/assets/ui/`](cli/assets/ui) |
| The support-agent demo: sandbox orders, a Claude agent, a scripted agent, an offline mode, and the with/without comparison above | [`examples/paypal/`](examples/paypal) |
| The [hosted dashboard demo](https://www.shotoku.dev/demo) and the [PayPal docs](https://www.shotoku.dev/docs/paypal) | [`web/`](web) |

**PayPal technology used**

- [`@paypal/mcp`](https://www.npmjs.com/package/@paypal/mcp), PayPal's MCP server from the Agent Toolkit. Shotoku wraps it unmodified and gates every one of its tools.
- Orders v2, to create and capture the demo's sandbox orders.
- Payments v2 and Disputes v1, read-only, to price a refund or a dispute claim before it is allowed.
- OAuth 2.0 client credentials, to mint the access token.
- The PayPal sandbox. The demo refuses to run against the live API.

**AI used**

- Claude is the support agent. It reads the customer's email, looks the orders up and decides what to refund, through the Model Context Protocol. Nothing in the demo tells it which tools to call.
- Shotoku itself contains no model, on purpose. The agent is the AI; the thing that limits it is 374 tests' worth of deterministic code. A guardrail that can be talked into something is not a guardrail.

## What you can do with it

- **Give agents a budget** — per-transaction and rolling 24-hour limits per vendor, and a daily ceiling per agent across everything it touches.
- **Require human approval** — hold risky or large actions as `pending_approval`. Small refunds go through; a big one waits for you.
- **Answer from anywhere** — approve or deny in the terminal, the TUI, a local dashboard, or with one tap on your phone.
- **Put any MCP server behind Shotoku** — every tool call goes through the policy first, and money-moving tools are priced (PayPal's MCP server is priced out of the box), so limits apply to what the agent actually spends.
- **Authorize agent payments (x402)** — decide on a payment once the price is known, before the wallet signs.
- **Prove enforcement with receipts** — approved decisions carry a short-lived signed token your infrastructure verifies before executing.
- **Audit everything** — every decision and every human answer is written to a local, append-only, hash-chained ledger you can read in any text editor.

## Install

```bash
npm install -g shotoku-cli
```

## See it in 30 seconds

No setup, nothing real happens:

```bash
shotoku demo
```

Four simulated decisions: two purchases approved, a third denied when the daily budget runs out, and an unknown vendor held for human approval.

![Shotoku demo](assets/demo.gif)

## Quickstart

```bash
# Initialize in your project directory
shotoku init

# Evaluate a spend
shotoku authorize --actor my-agent --action purchase --resource openai.com --amount 5
```

```
✓ APPROVED  dec_063a20380ba7
  • openai.com matched rule
  • Amount $5 is within per-transaction limit of $50
  • Daily budget remaining: $195
  Recorded at 14:05:22
```

```bash
shotoku status                       # pending approvals + last decision
shotoku history --since 24h          # decision history
shotoku decision dec_063a20380ba7    # full detail for one decision
shotoku approve dec_063a20380ba7     # approve a pending decision
shotoku ui                           # local dashboard: approvals, budgets, history
shotoku telegram                     # approve or deny from your phone
```

See the [Quickstart guide](docs/guides/quickstart.md) for the full five-minute tour.

## How it works

`shotoku init` creates three local files:

- `policy.yaml` — the rules for what agents can do.
- `shotoku.config.json` — where Shotoku finds the policy and ledger.
- `data/decisions.jsonl` — the local audit log, created when decisions are recorded.

A policy is just a checklist. Shotoku reads it before an agent acts.

```yaml
rules:
  - resource: openai.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

  # Refunds up to $100 on their own; a bigger one waits for a human.
  - resource: paypal__create_refund
    verdict: approved
    maxAmount: 100
    overLimit: pending_approval

budgets:
  # Everything this agent spends, across every vendor, per day.
  - actor: support-agent
    maxDailyAmount: 1000

defaultVerdict: pending_approval
```

Every decision is recorded to `data/decisions.jsonl`. JSONL means "one JSON record per line," so the ledger stays easy to inspect.

Shotoku **fails closed**: if the policy is missing, invalid, or the ledger cannot be trusted, the agent is not approved. A request with no amount against a rule with a limit is held for a human, never counted as zero. An authorization layer should never guess.

`maxDailyAmount` is a rolling 24-hour limit, not a midnight reset. If an agent spent $20 at 3pm yesterday, that spend counts until 3pm today.

A **human approval** lets through the agent's next identical call, once: same agent, same tool, same arguments, same amount, within 15 minutes. It never lifts a denial and never spends past a budget.

The ledger is **hash-chained**: each record stores a hash of the previous record plus itself. Edit a past line and later reads fail, because the chain no longer matches. You can also create a signed snapshot of the current policy and ledger head:

```bash
export SHOTOKU_SNAPSHOT_SECRET="use-a-long-local-secret"
shotoku snapshot create --out shotoku.snapshot.json
shotoku snapshot verify --snapshot shotoku.snapshot.json
```

Shotoku does not store the snapshot secret. Provide it through your environment or secret manager.

**Signed receipts** make approvals enforceable: with `SHOTOKU_RECEIPT_SECRET` set, every approved decision carries a compact HMAC-signed token (decision ID, actor, action, resource, amount, 5-minute expiry). Downstream infrastructure — a payment proxy, a CI job — verifies it before executing, so an agent cannot skip the check:

```bash
export SHOTOKU_RECEIPT_SECRET="use-a-long-local-secret"
shotoku authorize --actor my-agent --action purchase --resource openai.com --amount 5
# ✓ APPROVED … Receipt: rcpt.eyJhY3Rvci…
shotoku receipt verify rcpt.eyJhY3Rvci…
```

See [Writing policies](docs/guides/policies.md) for rules, limits, and matching in depth.

## Approve from anywhere

A pending decision waits for a human. Every channel does the same thing, and the ledger records which one was used.

- **Terminal** — `shotoku approve dec_…` or `shotoku deny dec_…`.
- **TUI** — `shotoku tui`, a live queue you answer with the keyboard.
- **Dashboard** — `shotoku ui` serves a local page on 127.0.0.1: pending approvals with Approve and Deny, budgets against limits, the full history, and whether the ledger's hash chain still verifies. See [Dashboard](docs/guides/dashboard.md).
- **Phone** — `shotoku telegram` sends each pending decision to your Telegram with two buttons. Only your taps count, and nothing listens on your machine. See [Approve from your phone](docs/guides/phone-approvals.md).

An agent cannot approve its own decisions: the MCP server does not expose the approval tools and refuses them if called.

## Use with AI agents (MCP)

Shotoku ships an MCP server (`shotoku-mcp`) for any MCP-compatible agent. It works two ways.

**Wrapping**, the one that cannot be skipped: list the MCP servers your agent uses, and Shotoku sits in front of them. Each tool is exposed as `<server>__<tool>` and every call is decided by your policy before it is forwarded. With a pricer, the call gets the amount it sends out of the account, so limits and budgets apply to tools that move money. `"pricing": "paypal"` prices PayPal's own MCP server (`@paypal/mcp`) and mints its access token from your app credentials at startup.

**Advisory**: the agent calls `authorize_action` itself before it acts, and `get_decision` / `get_pending_approvals` to follow up. Useful for agents you write yourself; an agent can forget to ask, which wrapping rules out.

See the [MCP integration guide](docs/guides/mcp.md).

## Use with x402 payments

When an agent hits an HTTP `402 Payment Required`, Shotoku authorizes the payment **after the amount is known and before the wallet signs** — the only safe point to decide. It judges the host the agent actually requested, not what the 402 response claims to be. Shotoku never signs or settles a payment; it only decides whether it is allowed. See the [x402 integration guide](docs/guides/x402.md).

## Core question

> Should this agent be allowed to perform this action?

Shotoku answers it with a structured decision: **approved**, **denied**, or **pending human approval** — each with reasons and a plain-English explanation.

## FAQ

### How do I stop an AI agent from spending too much money?

Add `maxAmount` (per transaction) and `maxDailyAmount` (rolling 24 hours) to a policy rule for that vendor, and a `budgets` entry for the agent's total. Over a rule's limit, a request is denied with a reason naming the cap, or held for you if the rule says `overLimit: pending_approval`. Over a budget, it is always denied.

### Does Shotoku hold my funds or private keys?

No. Shotoku never holds funds, stores private keys, or signs or settles payments. It only decides whether an action is allowed and records the decision. The agent's own wallet or payment provider moves the money.

### Does it need the cloud?

No. Shotoku is local-first. The policy, the ledger, and the authorization path all run on your machine. Phone approvals send the notification through Telegram; the decision itself stays local.

### Which AI agents work with it?

Any MCP-compatible agent, plus a command-line interface, an HTTP gateway (alpha) and a TypeScript API (`@shotoku/core`) you can call directly.

### Is Shotoku only for crypto or x402?

No. x402 and PayPal are the first payment rails. Shotoku authorizes any agent action — API calls, code execution, emails, MCP tools — across any rail.

### What happens if no policy rule matches a request?

The `defaultVerdict` applies — `pending_approval` unless you set otherwise. It fails toward human review, never silent approval.

## What Shotoku is not

- Not a wallet
- Not a payment network
- Not a custody provider
- Not a cloud policy engine
- Not an enterprise procurement system

## Documentation

- [Quickstart](docs/guides/quickstart.md) — install to first decision in five minutes
- [Writing policies](docs/guides/policies.md) — rules, limits, budgets, allowlists
- [API reference](docs/reference/api.md) — every function and type
- [MCP integration](docs/guides/mcp.md) — connect an agent, wrap MCP servers, price their tools
- [Dashboard](docs/guides/dashboard.md) — approvals, budgets and history in the browser
- [Approve from your phone](docs/guides/phone-approvals.md) — Telegram approvals with one tap
- [x402 integration](docs/guides/x402.md) — authorize agent payments
- [PayPal demo](examples/paypal/README.md) — a support agent, PayPal's MCP server, the sandbox
- [Architecture](docs/reference/architecture.md) — data flow, ledger format, design constraints

## Packages

- `core/` — authorization, policy, ledger, approvals, and x402 primitives (`@shotoku/core`)
- `cli/` — command-line interface, TUI, dashboard and phone approvals (`shotoku-cli`)
- `mcp/` — MCP server: advisory tools, wrapping, and pricing (`shotoku-mcp`)
- `gateway/` — local HTTP enforcement proxy (alpha)
- `web/` — the shotoku.dev site
- `examples/` — policies and runnable demos
- `docs/` — guides, architecture, and decisions

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

[MIT](LICENSE)
