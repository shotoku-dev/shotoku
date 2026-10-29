# Approve from your phone

`shotoku telegram` sends every new pending decision to you on Telegram, with **Approve** and **Deny** buttons. A tap does exactly what `shotoku approve` does, and the agent's retry goes through (or stays blocked).

```
◷ PENDING APPROVAL  dec_092405fc58b6
support-agent → paypal__create_refund
Amount: $480 · full refund of capture 2PY84818WJ8069634
• Amount $480 exceeds per-transaction limit of $100
[ ✓ Approve ]  [ ✗ Deny ]
```

After a tap, the message becomes the outcome:

```
✓ APPROVED  dec_092405fc58b6
support-agent → paypal__create_refund
Amount: $480 · full refund of capture 2PY84818WJ8069634
Recorded as apr_49da94a10d1e. The agent can retry the exact same call once.
```

Nothing listens on your machine. Shotoku long-polls Telegram over outbound HTTPS, so it works behind any router and your phone does not need to be on the same network.

## Setup (about three minutes)

**1. Create a bot.** In Telegram, open [@BotFather](https://t.me/BotFather), send `/newbot`, and pick a name and a username ending in `bot`. BotFather replies with a token like `7123456789:AAF...`. Keep it secret: anyone with it can act as your bot.

**2. Find your chat ID.** Run Shotoku with only the token. It starts in setup mode:

```bash
SHOTOKU_TELEGRAM_BOT_TOKEN=7123456789:AAF... shotoku telegram
```

```
Connected as @my_shotoku_bot. Setup mode: no SHOTOKU_TELEGRAM_CHAT_ID yet.
Open @my_shotoku_bot in Telegram on your phone, press Start, and send any message.
Message from @you: chat ID 123456789.
If that is you, set SHOTOKU_TELEGRAM_CHAT_ID=123456789 and run shotoku telegram again.
```

Stop it with Ctrl+C.

**3. Run it.**

```bash
export SHOTOKU_TELEGRAM_BOT_TOKEN=7123456789:AAF...
export SHOTOKU_TELEGRAM_CHAT_ID=123456789
shotoku telegram
```

Your phone gets "Shotoku is watching." Leave it running while your agent works. It reads the same ledger as the CLI and the MCP server (`--ledger` to point elsewhere; `shotoku where` shows which one).

## What it does

- **Only new decisions.** Decisions already pending when it starts are not sent; `shotoku status` lists them.
- **Only your taps count.** Telegram says who pressed a button, and a bot cannot fake a press from someone else's account. Presses from anyone but `SHOTOKU_TELEGRAM_CHAT_ID` are refused and logged; messages from strangers get no reply.
- **The channel is recorded.** The approval in the ledger carries `"via": "telegram:<your user ID>"`, so the audit trail shows the answer came from your phone, not the terminal.
- **Answered elsewhere.** If you approve in the terminal or the TUI instead, the Telegram message updates and loses its buttons. A tap on a decision that was already answered changes nothing and tells you so.
- **One per bot.** Telegram delivers a bot's updates to a single reader. A second `shotoku telegram` on the same bot stops with an explanation.

## What it does not do

**It is not a sandbox.** It puts your answer on another device, which is worth having: an agent can no longer reach the approval by typing into the terminal you are watching. But a process running as your user can still run `shotoku approve` or write the ledger directly. Real separation means the agent runs without access to Shotoku's files.

**The message goes through Telegram.** The decision itself is made on your machine, and nothing about it depends on Telegram. The notification does: the agent's name, the tool or vendor, the amount, where the amount came from (for PayPal, the capture or dispute ID) and the reason are sent to Telegram's servers so they can reach your phone. No other tool argument is sent. If that is not acceptable for your data, approve with `shotoku approve` or the TUI instead.

## Environment variables

| Variable | Description |
|---|---|
| `SHOTOKU_TELEGRAM_BOT_TOKEN` | The token from @BotFather. Required. |
| `SHOTOKU_TELEGRAM_CHAT_ID` | Your numeric Telegram user ID. Unset to run setup mode. |

Both are read from the environment and never from `shotoku.config.json`, which is meant to be committed.
