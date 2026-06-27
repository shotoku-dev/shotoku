import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";

const S = {
  page:    { padding: "48px 64px 96px" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 8, lineHeight: 1.2 } as React.CSSProperties,
  lead:    { fontSize: 15, color: "rgba(0,0,0,0.5)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 48, lineHeight: 1.6 } as React.CSSProperties,
  h2:      { fontSize: 18, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 44, marginBottom: 10, letterSpacing: "-0.015em" } as React.CSSProperties,
  h3:      { fontSize: 14.5, fontWeight: 600, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 28, marginBottom: 8 } as React.CSSProperties,
  p:       { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 14 } as React.CSSProperties,
  ul:      { margin: "8px 0 14px", paddingLeft: 20 } as React.CSSProperties,
  li:      { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 2 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "44px 0" } as React.CSSProperties,
  table:   { width: "100%", borderCollapse: "collapse" as const, fontSize: 13.5, marginBottom: 20 },
  th:      { textAlign: "left" as const, padding: "8px 12px", fontFamily: "Satoshi, var(--font-geist), sans-serif", fontWeight: 500, color: "rgba(0,0,0,0.38)", fontSize: 11, borderBottom: "1px solid rgba(0,0,0,0.08)", letterSpacing: "0.04em", textTransform: "uppercase" as const } as React.CSSProperties,
  td:      { padding: "10px 12px", color: "rgba(0,0,0,0.62)", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, lineHeight: 1.55, fontFamily: "var(--font-geist), sans-serif", fontSize: 13.5 } as React.CSSProperties,
  tdKey:   { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5, color: "#0A0A0A", fontWeight: 500 } as React.CSSProperties,
  diagram: { background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "20px 24px", marginBottom: 18, fontFamily: "var(--font-geist-mono), monospace", fontSize: 12.5, lineHeight: 1.8, color: "#0F0D0C", whiteSpace: "pre" as const } as React.CSSProperties,
};

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <table style={S.table}>
      <thead><tr>{headers.map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j} style={j === 0 ? S.tdKey : S.td}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function X402Page() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>x402</h1>
      <p style={S.lead}>
        x402 is Shotoku&rsquo;s first payment rail. The same authorization model works for any rail.
      </p>

      {/* What is x402 */}
      <h2 style={S.h2}>What is x402?</h2>
      <p style={S.p}>
        x402 is an open payment protocol from Coinbase that lets a client pay for a resource
        over plain HTTP — no account, no API key, no login. It revives the long-dormant HTTP{" "}
        <InlineCode>402 Payment Required</InlineCode> status code and turns it into a
        pay-per-request handshake, settled in stablecoins (typically USDC).
      </p>
      <p style={S.p}>
        That makes it a natural fit for agents: a machine can pay for exactly what it uses,
        per request, with nothing but a wallet that can sign. No custody, no billing relationship.
      </p>

      {/* The handshake */}
      <h2 style={S.h2}>The 402 handshake</h2>
      <p style={S.p}>A single paid request takes two round-trips:</p>
      <div style={S.diagram}>{`1. Agent requests a resource       GET /premium-data
2. Server answers 402
                                   + requirements: pay 0.05 USDC to 0xABC… on Base
3. Agent signs a payment
                                   GET /premium-data  +  X-PAYMENT header
4. Server verifies + settles on-chain, returns the resource`}</div>
      <ul style={S.ul}>
        <li style={S.li}>
          <strong>Step 2</strong> carries the payment requirements: how much, which token,
          which network, and the recipient address.
        </li>
        <li style={S.li}>
          <strong>Step 3</strong> carries the payment payload: a signed authorization to transfer
          the stablecoin. A facilitator verifies it and settles on-chain.
        </li>
      </ul>
      <p style={S.p}>
        No password is ever exchanged. The agent proves it can pay by signing, not by logging in.
      </p>

      <hr style={S.divider} />

      {/* Where Shotoku fits */}
      <h2 style={S.h2}>Where Shotoku fits</h2>
      <p style={S.p}>
        Shotoku inserts itself <strong>between step 2 and step 3</strong> — after the agent
        learns the price, before it signs anything.
      </p>
      <div style={S.diagram}>{`2.  Server → 402: "pay 0.05 USDC to 0xABC…"
         │
         ↓
    ★  Shotoku.authorize()   ← the decision point
         │
    approved          →  continue to step 3 (sign + pay)
    denied / pending  →  stop, surface to a human
         │
         ↓
3.  Agent signs and pays`}</div>
      <p style={S.p}>
        This is the only moment where both of these are true at once:
      </p>
      <ul style={S.ul}>
        <li style={S.li}>The agent <strong>knows the full cost</strong> — amount, recipient, and resource were just delivered in the 402.</li>
        <li style={S.li}>Nothing <strong>irreversible</strong> has happened yet — no signature, no settlement.</li>
      </ul>
      <p style={S.p}>
        Before step 2 there is no amount to evaluate. After step 3 the money is already gone.
        That narrow gap is the only place an authorization layer can do its job.
      </p>

      <hr style={S.divider} />

      {/* Mapping the 402 */}
      <h2 style={S.h2}>Mapping the 402 to an authorization request</h2>
      <p style={S.p}>
        The 402 response hands Shotoku exactly the fields <InlineCode>authorize()</InlineCode> needs:
      </p>
      <Table
        headers={["From the 402 handshake", "AuthorizeRequest field"]}
        rows={[
          ["The agent making the request",     "actor"],
          ["It is a payment",                  'action: "purchase"'],
          ["The recipient / endpoint paid",    "resource"],
          ["The amount required (0.05 USDC)",  "amount"],
          ["The protocol",                     'rail: "x402"'],
        ]}
      />
      <p style={S.p}>
        One detail matters: x402 amounts are usually sent in atomic units. For USDC,
        <InlineCode> 50000</InlineCode> atomic units means <InlineCode>0.05</InlineCode> USDC because USDC
        uses 6 decimals. Shotoku normalizes that into a regular decimal before policy evaluation,
        then records the original payment details in <InlineCode>context</InlineCode> for audit.
      </p>

      <hr style={S.divider} />

      {/* Integration code */}
      <h2 style={S.h2}>Integration</h2>
      <p style={S.p}>
        On receiving a 402 response, before signing the payment:
      </p>
      <CodeBlock
        lang="typescript"
        filename="x402-intercept.ts"
        code={`import { authorize } from "@shotoku/core";

// Called after the 402 response arrives, before signing
async function handlePaymentRequired(
  paymentRequirements: PaymentRequirements,
  agentId: string,
) {
  const decision = await authorize(
    {
      actor:    agentId,
      action:   "purchase",
      resource: paymentRequirements.recipient,
      rail:     "x402",
      amount:   paymentRequirements.maxAmountRequired / 1_000_000, // USDC 6 decimals
      context:  { network: paymentRequirements.network, raw: paymentRequirements },
    },
    { policyPath: "./policy.yaml", ledgerPath: "./data/decisions.jsonl" },
  );

  if (decision.approved) {
    // proceed to step 3: sign and send the X-PAYMENT request
    return signPayment(paymentRequirements);
  }

  // stop — decision is recorded, waiting for a human if pending
  throw new Error(\`Payment blocked: \${decision.status} [\${decision.decisionId}]\`);
}`}
      />

      <hr style={S.divider} />

      {/* What Shotoku does not do */}
      <h2 style={S.h2}>What Shotoku does not do</h2>
      <p style={S.p}>
        Shotoku is an authorization layer, not a wallet. It never holds funds, never stores
        private keys, never signs or settles a payment. The agent&rsquo;s own wallet signs.
        The facilitator settles on-chain. Shotoku answers one question —{" "}
        <em>should this payment be allowed?</em> — and records the answer locally.
      </p>

      <hr style={S.divider} />

      {/* Status */}
      <h2 style={S.h2}>Status</h2>
      <p style={S.p}>The current implementation in this repo includes:</p>
      <ul style={S.ul}>
        <li style={S.li}><InlineCode>core/src/x402.ts</InlineCode> — the interception and authorization flow</li>
        <li style={S.li}><InlineCode>examples/x402-demo.ts</InlineCode> — an end-to-end demo</li>
        <li style={S.li}><InlineCode>examples/policy-x402.yaml</InlineCode> — a sample policy for x402 spending</li>
      </ul>
      <p style={S.p}>
        The demo does not sign or settle a payment. It shows the safe point where Shotoku
        authorizes before signing would happen.
      </p>
      <p style={S.p}>
        The same authorization pattern extends to any payment or action rail. x402 is the
        first integration, not the only one.{" "}
        <Link href="/docs/policies" style={{ color: "#DB0028", textDecoration: "none" }}>
          See the policy reference →
        </Link>
      </p>
    </div>
  );
}
