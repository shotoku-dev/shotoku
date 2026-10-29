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

export default function DashboardPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Dashboard</h1>
      <p style={S.lead}>
        A local page with everything at once: what is waiting for you, what each agent has spent
        against its limits, and every decision in the ledger.
      </p>

      {/* Launch */}
      <h2 style={S.h2}>Launching</h2>
      <CodeBlock lang="bash" code={`shotoku ui`} />
      <div style={S.screen}>{`Shotoku dashboard: http://127.0.0.1:4402/#token=9f2c…
  Ledger  /home/you/project/data/decisions.jsonl
  Policy  /home/you/project/policy.yaml
Open the link above; the token in it is this session's only key. Ctrl+C to stop.`}</div>
      <p style={S.p}>
        Open the link. The page refreshes every two seconds, so decisions appear while your agent works.
      </p>
      <Table
        headers={["Option", "Default", "What it does"]}
        rows={[
          ["--port <n>", "4402", <>Port on 127.0.0.1. <InlineCode>0</InlineCode> picks a free one.</>],
          ["--policy <path>", "resolved", <>Same resolution as every command; <InlineCode>shotoku where</InlineCode> shows it.</>],
          ["--ledger <path>", "resolved", "The ledger to read and answer in."],
        ]}
      />

      <hr style={S.divider} />

      {/* What it shows */}
      <h2 style={S.h2}>What it shows</h2>
      <ul style={S.ul}>
        <li style={S.li}><strong>Totals</strong> — pending, approved, denied, and spent in the last 24 hours.</li>
        <li style={S.li}><strong>Pending approvals</strong> — who wants to do what, for how much, and why a human is asked, with Approve and Deny. Approving does what <InlineCode>shotoku approve</InlineCode> does and is recorded with <InlineCode>via: dashboard</InlineCode>.</li>
        <li style={S.li}><strong>Budgets</strong> — each agent budget from your policy, and each agent&apos;s spend on each tool or vendor against the daily limit of the rule it matched.</li>
        <li style={S.li}><strong>History</strong> — every decision, newest first, with the human answer and where it came from. Sort, filter any column, search, and click a row for its full reasons.</li>
        <li style={S.li}><strong>Ledger integrity</strong> — whether the hash chain still verifies.</li>
      </ul>
      <p style={S.p}>
        The tables are AG Grid Community, served from the installed package. The page loads nothing from the internet.
      </p>

      <hr style={S.divider} />

      {/* Security */}
      <h2 style={S.h2}>How it is locked down</h2>
      <p style={S.p}>The dashboard can approve spending, so it is locked to the person at the keyboard:</p>
      <ul style={S.ul}>
        <li style={S.li}>It listens on 127.0.0.1 only, never on your network.</li>
        <li style={S.li}>Every API call needs the session token from the link. It is new each run, printed only in your terminal, written to no file, and moved out of the address bar on load.</li>
        <li style={S.li}>Requests must name 127.0.0.1 or localhost as their host, which stops a web page that rebinds its own domain to your machine.</li>
        <li style={S.li}>Approve and Deny are only accepted from the dashboard&apos;s own page, so another site cannot post to it.</li>
        <li style={S.li}>Everything an agent wrote is shown as text, never as HTML.</li>
      </ul>
      <p style={S.p}>
        What this does not stop: a process running as your user that can read the terminal the token was
        printed in. For a separation an agent cannot cross, answer on another device with{" "}
        <a href="/docs/phone" style={LINK}>phone approvals</a>.
      </p>
    </div>
  );
}
