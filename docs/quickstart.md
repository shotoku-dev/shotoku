# Quickstart

Goal: from install to your first authorization decision in under five minutes.

Shotoku runs entirely on your machine. Nothing is sent anywhere; every decision is written to a local file you can read.

---

## 1. Install

```bash
npm install -g shotoku-cli
```

> **Not published yet / working from the repo?** Run from source instead:
>
> ```bash
> git clone https://github.com/shotoku-dev/shotoku
> cd shotoku
> pnpm install && pnpm build
> ```
>
> Then use `pnpm --filter shotoku-cli dev --` in place of `shotoku` in the commands below.

---

## 2. Initialize

From an empty project directory:

```bash
shotoku init
```

This creates three things:

```txt
  ✓ Created  data/                 ← where decisions are recorded
  ✓ Created  policy.yaml           ← your rules
  ✓ Created  shotoku.config.json   ← file paths
```

The starter `policy.yaml` allowlists `openai.com` and `anthropic.com` up to $50 per transaction and $200 per day, and sends everything else for human approval.

---

## 3. Your first decision

Ask Shotoku whether an agent may spend $5 calling OpenAI:

```bash
shotoku authorize --actor my-agent --action api_call --resource openai.com --amount 5
```

```txt
✓ APPROVED  dec_8f2a1c9b4e07
  • openai.com matched rule
  • Amount $5 is within per-transaction limit of $50
  • Daily budget remaining: $195
  Recorded at 14:05:22
```

That decision is now saved in `data/decisions.jsonl`.

---

## 4. A decision that gets denied

Try to spend more than the per-transaction limit:

```bash
shotoku authorize --actor my-agent --action purchase --resource openai.com --amount 500
```

```txt
✗ DENIED  dec_1d7e3a9f5b22
  • openai.com matched rule
  • Amount $500 exceeds per-transaction limit of $50
  → Run: shotoku approve dec_1d7e3a9f5b22
```

Shotoku tells you exactly which check failed, and how to override it if you choose to.

---

## 5. A decision that needs you

Hit a resource that is not on the allowlist:

```bash
shotoku authorize --actor my-agent --action purchase --resource vendor-xyz.com --amount 10
```

```txt
◷ PENDING APPROVAL  dec_3b9c5e1a8d44
  • vendor-xyz.com is not on the allowlist
  → Run: shotoku approve dec_3b9c5e1a8d44
```

Approve it (or `deny` it):

```bash
shotoku approve dec_3b9c5e1a8d44
```

```txt
✓ Approved. Recorded as apr_2f8a1b6c.
```

The original decision is never changed — the approval is recorded as a new entry, so the audit trail stays intact.

---

## 6. Review what happened

```bash
shotoku status          # pending approvals + last decision
shotoku history         # every decision, with a summary line
shotoku decision <id>   # full detail for one decision
```

```txt
$ shotoku history
✓  dec_8f2a1c9b4e07  my-agent  api_call  openai.com $5     2m ago
✗  dec_1d7e3a9f5b22  my-agent  purchase  openai.com $500   1m ago
◷  dec_3b9c5e1a8d44  my-agent  purchase  vendor-xyz.com $10  1m ago

3 total · 1 approved · 1 denied · 1 pending
```

`history` also takes filters: `--actor`, `--status approved|denied|pending_approval`, and `--since 24h|7d|30d`.

---

## 7. Use it from your own code

The CLI wraps a small TypeScript API. The same decision, programmatically:

```ts
import { authorize } from "@shotoku/core";

const decision = await authorize(
  { actor: "my-agent", action: "api_call", resource: "openai.com", amount: 5 },
  { policyPath: "policy.yaml", ledgerPath: "data/decisions.jsonl" },
);

if (decision.approved) {
  // proceed with the action
} else {
  console.log(decision.explanation.summary);
  // decision.status is "denied" or "pending_approval"
}
```

A runnable version lives in [`examples/quickstart.ts`](../examples/quickstart.ts).

---

## Next steps

- **[Writing policies](policies.md)** — rules, limits, and allowlists in depth
- **[API reference](api.md)** — every function and type
- **[MCP integration](mcp.md)** — let an AI agent call Shotoku automatically
- **[x402 integration](x402.md)** — authorize agent payments before they settle
