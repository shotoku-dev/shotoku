/**
 * x402 demo — run with:
 *   npx tsx examples/x402-demo.ts
 *
 * Simulates the x402 handshake end-to-end. The authorization is REAL: it calls
 * Shotoku via authorizeX402Payment and records every decision to the ledger.
 * The wallet signing and on-chain settlement are MOCKED — Shotoku never signs
 * or settles. Swap `mockSigner` for a real x402 client + wallet and the flow
 * is identical.
 */
import { mkdir } from "node:fs/promises";
import {
  authorizeX402Payment,
  parseX402Response,
  type PaymentRequirements,
  type X402Response,
} from "@shotoku/core";

const OPTIONS = {
  policyPath: "examples/policy-x402.yaml",
  ledgerPath: "data/decisions.jsonl",
};

// ── The seam ──────────────────────────────────────────────────────────────
// Anything that can turn payment requirements into a signed payment. The mock
// returns a fake payload. In production you back this with x402-fetch + a viem
// account — same interface, real signature.
interface SignedPayment {
  readonly header: string;
}
interface PaymentSigner {
  sign(requirements: PaymentRequirements): Promise<SignedPayment>;
}

const mockSigner: PaymentSigner = {
  sign: async (req) => ({
    header: `mock-payment:${req.asset}:${req.amount}:${req.payTo}`,
  }),
};
// ────────────────────────────────────────────────────────────────────────────

/** A fake server endpoint that always answers with a 402. */
function fakeServer402(resource: string, atomicAmount: string): X402Response {
  return {
    x402Version: 1,
    accepts: [
      {
        network: "base",
        maxAmountRequired: atomicAmount,
        resource,
        payTo: "0x000000000000000000000000000000000000dEaD",
        asset: "0xUSDC",
        extra: { name: "USDC" },
      },
    ],
  };
}

function iconFor(status: string): string {
  if (status === "approved") return "✓";
  if (status === "denied") return "✗";
  return "◷";
}

async function attemptPayment(
  actor: string,
  resource: string,
  atomicAmount: string,
  signer: PaymentSigner,
): Promise<void> {
  // Steps 1–2: request the resource, receive a 402 with payment requirements.
  const requirements = parseX402Response(fakeServer402(resource, atomicAmount));
  console.log(
    `\n→ 402 from ${resource}: pay ${requirements.amount} ${requirements.asset} to ${requirements.payTo}`,
  );

  // Step 2½: authorize BEFORE signing anything.
  const decision = await authorizeX402Payment(actor, requirements, OPTIONS);
  console.log(`  ${iconFor(decision.status)} ${decision.status}  ${decision.decisionId}`);
  console.log(`     ${decision.explanation.summary}`);

  if (!decision.approved) {
    if (decision.explanation.hint) console.log(`     → ${decision.explanation.hint}`);
    console.log("  ✗ Payment blocked. Nothing signed, nothing spent.");
    return;
  }

  // Steps 3–4: only now do we sign and "settle" (mocked).
  const signed = await signer.sign(requirements);
  console.log(`  ✓ Authorized → signed (mock): ${signed.header}`);
  console.log("  ✓ Resource delivered.");
}

async function run(): Promise<void> {
  await mkdir("data", { recursive: true });

  // 1. Allowlisted vendor, small amount — approved, payment proceeds.
  await attemptPayment("agent-001", "api.weather.xyz", "50000", mockSigner); // 0.05 USDC

  // 2. Allowlisted vendor, over the limit — denied, nothing signed.
  await attemptPayment("agent-001", "api.weather.xyz", "5000000", mockSigner); // 5 USDC

  // 3. Unknown vendor — pending approval, nothing signed.
  await attemptPayment("agent-001", "api.unknown-vendor.io", "50000", mockSigner);
}

run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
