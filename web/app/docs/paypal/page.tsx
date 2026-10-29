import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";

const S = {
  page:    { padding: "48px 64px 96px" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 8, lineHeight: 1.2 } as React.CSSProperties,
  lead:    { fontSize: 15, color: "rgba(0,0,0,0.5)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 48, lineHeight: 1.6 } as React.CSSProperties,
  h2:      { fontSize: 18, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 44, marginBottom: 10, letterSpacing: "-0.015em" } as React.CSSProperties,
  p:       { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 14 } as React.CSSProperties,
  ul:      { margin: "8px 0 14px", paddingLeft: 20 } as React.CSSProperties,
  li:      { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 2 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "40px 0" } as React.CSSProperties,
  table:   { width: "100%", borderCollapse: "collapse" as const, fontSize: 13.5, marginBottom: 20 },
  th:      { textAlign: "left" as const, padding: "8px 12px", fontFamily: "Satoshi, var(--font-geist), sans-serif", fontWeight: 500, color: "rgba(0,0,0,0.38)", fontSize: 11, borderBottom: "1px solid rgba(0,0,0,0.08)", letterSpacing: "0.04em", textTransform: "uppercase" as const } as React.CSSProperties,
  td:      { padding: "10px 12px", color: "rgba(0,0,0,0.62)", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, lineHeight: 1.55, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5 } as React.CSSProperties,
  tdKey:   { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5, color: "#0A0A0A", fontWeight: 500 } as React.CSSProperties,
  screen:  { background: "#0F0D0C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "20px 24px", marginBottom: 18, fontFamily: "var(--font-geist-mono), monospace", fontSize: 12.5, lineHeight: 1.8, color: "#E8E3DC", whiteSpace: "pre" as const, overflowX: "auto" as const } as React.CSSProperties,
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

const LINK = { color: "#DB0028", textDecoration: "none" } as React.CSSProperties;

export default function PayPalPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>PayPal</h1>
      <p style={S.lead}>
        PayPal&apos;s own MCP server gives an agent refunds, invoices, orders and disputes, with no limit or
        approval of its own. Shotoku sits in front of it.
      </p>

      <div style={S.screen}>{`agent → paypal__create_refund  $89    ✓ APPROVED   refunded by PayPal
agent → paypal__create_refund  $480   ◷ PENDING    over the $100 limit, sent to your phone
you   → tap Approve or Deny
agent → retries the exact same call   ✓ refunded, or ✗ blocked`}</div>

      <p style={S.p}>
        Shotoku never moves the money. It decides whether each call may run, and records the answer in the
        local ledger.
      </p>

      <hr style={S.divider} />

      {/* Setup */}
      <h2 style={S.h2}>Setup</h2>
      <p style={S.p}>
        Wrap <InlineCode>@paypal/mcp</InlineCode> as an upstream of the Shotoku MCP server and name the PayPal
        pricer. Use your PayPal app&apos;s client ID and secret: Shotoku mints an access token each time it starts
        and gives the PayPal server only the token.
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "mcpServers": {
    "paypal": {
      "command": "npx",
      "args": ["-y", "@paypal/mcp", "--tools=all"],
      "env": {
        "PAYPAL_CLIENT_ID": "...",
        "PAYPAL_CLIENT_SECRET": "...",
        "PAYPAL_ENVIRONMENT": "SANDBOX"
      },
      "pricing": "paypal"
    }
  }
}`}
      />
      <p style={S.p}>
        Point <InlineCode>SHOTOKU_MCP_UPSTREAMS</InlineCode> at that file. Each PayPal tool then appears to the
        agent as <InlineCode>paypal__&lt;tool&gt;</InlineCode>. See{" "}
        <a href="/docs/mcp#pricing" style={LINK}>MCP: putting a price on wrapped tools</a>.
      </p>

      <hr style={S.divider} />

      {/* Policy */}
      <h2 style={S.h2}>A policy for a support agent</h2>
      <CodeBlock
        lang="yaml"
        code={`rules:
  - resource: paypal__list_*
    verdict: approved
  - resource: paypal__get_*
    verdict: approved
  - resource: paypal__create_refund
    verdict: approved
    maxAmount: 100
    maxDailyAmount: 1000
    overLimit: pending_approval

budgets:
  - actor: support-agent
    maxDailyAmount: 1000

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>
        Reads are free. Refunds up to $100 go through; a bigger one waits for a human. Anything else PayPal
        offers is held for review.
      </p>

      <hr style={S.divider} />

      {/* Pricing */}
      <h2 style={S.h2}>How calls are priced</h2>
      <Table
        headers={["Tool", "Priced at"]}
        rows={[
          ["create_refund with amount", "That amount."],
          ["create_refund without amount", "The full capture, looked up from PayPal: that is what PayPal refunds."],
          ["accept_dispute_claim", "The disputed amount, looked up from PayPal."],
          ["Every other tool", "$0. None of them sends money out."],
        ]}
      />
      <p style={S.p}>
        A call that cannot be priced gets no amount, never zero, so a limited rule holds it for a human.
      </p>

      <hr style={S.divider} />

      {/* Demo */}
      <h2 style={S.h2}>Run the demo</h2>
      <p style={S.p}>
        The repository ships a demo that runs against the PayPal sandbox in a few minutes: two orders paid with
        PayPal&apos;s test card, a customer email, and either a scripted agent or a real one.
      </p>
      <CodeBlock
        lang="bash"
        code={`node examples/paypal/setup.mjs
node examples/paypal/agent.mjs`}
      />
      <p style={S.p}>
        See{" "}
        <a href="https://github.com/shotoku-dev/shotoku/tree/main/examples/paypal" target="_blank" rel="noopener noreferrer" style={LINK}>
          examples/paypal
        </a>{" "}
        for the full walkthrough.
      </p>
    </div>
  );
}
