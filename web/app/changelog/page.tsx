import Navbar from "../components/Navbar";

const S = {
  page:    { paddingTop: 120, paddingBottom: 96, paddingLeft: 32, paddingRight: 32, maxWidth: 700, margin: "0 auto" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 6, lineHeight: 1.2 } as React.CSSProperties,
  meta:    { fontSize: 13, color: "rgba(0,0,0,0.35)", fontFamily: "var(--font-geist), sans-serif", marginBottom: 48 } as React.CSSProperties,
  entry:   { marginBottom: 48 } as React.CSSProperties,
  version: { fontSize: 17, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.015em", marginBottom: 4 } as React.CSSProperties,
  date:    { fontSize: 12, color: "rgba(0,0,0,0.35)", fontFamily: "var(--font-geist), sans-serif", marginBottom: 14 } as React.CSSProperties,
  p:       { fontSize: 14.5, lineHeight: 1.9, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 10 } as React.CSSProperties,
  ul:      { paddingLeft: 20, margin: "0 0 10px" } as React.CSSProperties,
  li:      { fontSize: 14.5, lineHeight: 1.9, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 2 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "36px 0" } as React.CSSProperties,
};

export default function ChangelogPage() {
  return (
    <>
      <Navbar />
      <div style={S.page}>
        <h1 style={S.h1}>Changelog</h1>
        <p style={S.meta}>What&apos;s new in Shotoku.</p>

        <div style={S.entry}>
          <div style={S.version}>v0.1.0-beta</div>
          <div style={S.date}>June 2026</div>
          <p style={S.p}>First public beta. Core authorization flow works end-to-end.</p>
          <ul style={S.ul}>
            <li style={S.li}>Local-first authorization engine with policy evaluation</li>
            <li style={S.li}>Append-only JSONL decision ledger</li>
            <li style={S.li}>CLI commands: authorize, status, history, approve, deny, decision</li>
            <li style={S.li}>MCP server with authorize_action, get_decision, get_pending_approvals tools</li>
            <li style={S.li}>x402 demo integration</li>
          </ul>
        </div>

        <hr style={S.divider} />

        <p style={S.p}>
          Full commit history is available on{" "}
          <a
            href="https://github.com/shotoku-dev/shotoku/commits/main"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#DB0028", textDecoration: "none" }}
          >
            GitHub
          </a>.
        </p>
      </div>
    </>
  );
}
