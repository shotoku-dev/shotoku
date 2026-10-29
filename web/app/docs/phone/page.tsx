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

export default function PhonePage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Approve from your phone</h1>
      <p style={S.lead}>
        <InlineCode>shotoku telegram</InlineCode> sends every new pending decision to your Telegram with
        Approve and Deny buttons. A tap does exactly what <InlineCode>shotoku approve</InlineCode> does.
      </p>

      <div style={S.screen}>{`◷ PENDING APPROVAL  dec_092405fc58b6
support-agent → paypal__create_refund
Amount: $480 · full refund of capture 2PY84818WJ8069634
• Amount $480 exceeds per-transaction limit of $100
[ ✓ Approve ]  [ ✗ Deny ]`}</div>
      <p style={S.p}>
        After a tap, the message becomes the outcome and loses its buttons. Nothing listens on your machine:
        Shotoku long-polls Telegram over outbound HTTPS, so it works behind any router.
      </p>

      <hr style={S.divider} />

      {/* Setup */}
      <h2 style={S.h2}>Setup, about three minutes</h2>
      <p style={S.p}>
        <strong>1. Create a bot.</strong> In Telegram, open @BotFather, send <InlineCode>/newbot</InlineCode>,
        and pick a name and a username ending in <InlineCode>bot</InlineCode>. Keep the token it gives you secret.
      </p>
      <p style={S.p}><strong>2. Find your chat ID.</strong> Run Shotoku with only the token; it starts in setup mode:</p>
      <CodeBlock lang="bash" code={`SHOTOKU_TELEGRAM_BOT_TOKEN=7123456789:AAF... shotoku telegram`} />
      <p style={S.p}>Open your bot on your phone, press Start, and send any message. The terminal prints your chat ID.</p>
      <p style={S.p}><strong>3. Run it.</strong></p>
      <CodeBlock
        lang="bash"
        code={`export SHOTOKU_TELEGRAM_BOT_TOKEN=7123456789:AAF...
export SHOTOKU_TELEGRAM_CHAT_ID=123456789
shotoku telegram`}
      />
      <p style={S.p}>
        Your phone gets &ldquo;Shotoku is watching.&rdquo; Leave it running while your agent works. It reads
        the same ledger as the CLI and the MCP server.
      </p>

      <hr style={S.divider} />

      {/* Behaviour */}
      <h2 style={S.h2}>What it does</h2>
      <Table
        headers={["", ""]}
        rows={[
          ["Only your taps count", "Telegram says who pressed a button, and a bot cannot fake a press from another account. Presses from anyone else are refused and logged; strangers' messages get no reply."],
          ["The channel is recorded", <>The approval carries <InlineCode>via: telegram:&lt;your user ID&gt;</InlineCode>, so the audit trail shows the answer came from your phone.</>],
          ["Answered elsewhere", "Approve in the terminal or the dashboard instead, and the Telegram message updates and loses its buttons."],
          ["Only new decisions", <>Decisions already pending when it starts are not sent; <InlineCode>shotoku status</InlineCode> lists them.</>],
          ["One per bot", "Telegram delivers a bot's updates to a single reader. A second shotoku telegram on the same bot stops with an explanation."],
        ]}
      />

      <hr style={S.divider} />

      {/* Limits */}
      <h2 style={S.h2}>What it does not do</h2>
      <p style={S.p}>
        <strong>It is not a sandbox.</strong> It puts your answer on another device, so an agent can no longer
        reach the approval through the terminal you are watching. A process running as your user can still run{" "}
        <InlineCode>shotoku approve</InlineCode> or write the ledger. Real separation means the agent runs
        without access to Shotoku&apos;s files.
      </p>
      <p style={S.p}>
        <strong>The notification goes through Telegram.</strong> The decision is made on your machine and does
        not depend on Telegram. The message does: the agent&apos;s name, the tool, the amount, where the amount
        came from and the reason reach Telegram&apos;s servers. No other tool argument is sent.
      </p>
    </div>
  );
}
