/**
 * Shotoku quickstart — run with:
 *   npx tsx examples/quickstart.ts
 *
 * Requires policy.yaml and data/ in the working directory.
 * Run `shotoku init` first if you haven't already.
 */
import { authorize } from "@shotoku/core";

const OPTIONS = {
  policyPath: "policy.yaml",
  ledgerPath: "data/decisions.jsonl",
};

async function run(): Promise<void> {
  // 1. Known vendor, under limit — should be approved
  const approved = await authorize(
    { actor: "my-agent", action: "api_call", resource: "openai.com", amount: 5 },
    OPTIONS,
  );
  console.log(`[${approved.status}] ${approved.decisionId}`);
  for (const r of approved.reasons) console.log(`  • ${r.text}`);

  // 2. Over daily limit — should be denied
  const overLimit = await authorize(
    { actor: "my-agent", action: "purchase", resource: "openai.com", amount: 999 },
    OPTIONS,
  );
  console.log(`[${overLimit.status}] ${overLimit.decisionId}`);
  for (const r of overLimit.reasons) console.log(`  • ${r.text}`);

  // 3. Unknown vendor — should be pending_approval
  const unknown = await authorize(
    { actor: "my-agent", action: "api_call", resource: "vendor-xyz.com" },
    OPTIONS,
  );
  console.log(`[${unknown.status}] ${unknown.decisionId}`);
  for (const r of unknown.reasons) console.log(`  • ${r.text}`);
  if (unknown.status === "pending_approval") {
    console.log(`  → shotoku approve ${unknown.decisionId}`);
  }
}

run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
