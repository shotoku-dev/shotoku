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
  screen:  { background: "#0F0D0C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "20px 24px", marginBottom: 18, fontFamily: "var(--font-geist-mono), monospace", fontSize: 12.5, lineHeight: 1.8, color: "#E8E3DC", whiteSpace: "pre" as const } as React.CSSProperties,
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

export default function TuiPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>TUI</h1>
      <p style={S.lead}>
        An interactive terminal interface for reviewing and actioning pending approvals
        without leaving your terminal.
      </p>

      {/* Launch */}
      <h2 style={S.h2}>Launching</h2>
      <CodeBlock lang="bash" code={`shotoku tui`} />
      <p style={S.p}>
        The TUI opens in your terminal and polls the local ledger every 3 seconds.
        Pending decisions appear as soon as they are recorded — no manual refresh needed.
      </p>
      <CodeBlock lang="bash" code={`shotoku tui --ledger ./data/decisions.jsonl`} />
      <p style={S.p}>
        Pass <InlineCode>--ledger</InlineCode> to point at a non-default ledger file,
        or set it in <InlineCode>shotoku.config.json</InlineCode>.
      </p>

      <hr style={S.divider} />

      {/* Layout */}
      <h2 style={S.h2}>Layout</h2>
      <p style={S.p}>The TUI has three areas:</p>
      <ul style={S.ul}>
        <li style={S.li}><strong>Header</strong> — current time and pending count</li>
        <li style={S.li}><strong>Main panel</strong> — list of pending decisions, one per row</li>
        <li style={S.li}><strong>Footer</strong> — keyboard hint bar</li>
      </ul>
      <p style={S.p}>Each pending row shows the actor, resource, amount (if any), age, and a one-line reason summary.</p>

      <hr style={S.divider} />

      {/* Keyboard shortcuts */}
      <h2 style={S.h2}>Keyboard shortcuts</h2>
      <Table
        headers={["Key", "Action"]}
        rows={[
          ["↑ / ↓",  "Navigate between pending decisions"],
          ["Enter",  "Approve the selected decision"],
          ["d",      "Deny the selected decision"],
          ["e",      "Expand the selected decision — shows all reasons and full request detail"],
          ["h",      "Toggle decision history panel"],
          ["q",      "Quit the TUI"],
        ]}
      />
      <p style={S.p}>
        After approving or denying, the TUI updates immediately — the actioned decision moves
        out of the pending list and into history.
      </p>

      <hr style={S.divider} />

      {/* Empty state */}
      <h2 style={S.h2}>Empty state</h2>
      <p style={S.p}>
        When there are no pending decisions, the TUI shows a quiet empty state. It keeps
        polling — as soon as an agent records a pending decision, it appears automatically.
      </p>

      <hr style={S.divider} />

      {/* When to use */}
      <h2 style={S.h2}>When to use the TUI vs the CLI</h2>
      <p style={S.p}>
        Use <InlineCode>shotoku status</InlineCode> for a quick one-shot check. Use the TUI
        when you want a live view while an agent is running — it stays open and refreshes
        automatically so you can approve or deny decisions as they come in without switching
        back and forth between commands.
      </p>
    </div>
  );
}
