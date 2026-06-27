import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";

const S = {
  page:    { padding: "48px 64px 96px" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 8, lineHeight: 1.2 } as React.CSSProperties,
  lead:    { fontSize: 15, color: "rgba(0,0,0,0.5)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 48, lineHeight: 1.6 } as React.CSSProperties,
  h2:      { fontSize: 18, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 44, marginBottom: 10, letterSpacing: "-0.015em" } as React.CSSProperties,
  h3:      { fontSize: 14.5, fontWeight: 600, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 28, marginBottom: 6 } as React.CSSProperties,
  p:       { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 14 } as React.CSSProperties,
  ul:      { margin: "8px 0 14px", paddingLeft: 20 } as React.CSSProperties,
  li:      { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 2 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "40px 0" } as React.CSSProperties,
  table:   { width: "100%", borderCollapse: "collapse" as const, fontSize: 13.5, marginBottom: 20 },
  th:      { textAlign: "left" as const, padding: "8px 12px", fontFamily: "Satoshi, var(--font-geist), sans-serif", fontWeight: 500, color: "rgba(0,0,0,0.38)", fontSize: 11, borderBottom: "1px solid rgba(0,0,0,0.08)", letterSpacing: "0.04em", textTransform: "uppercase" as const } as React.CSSProperties,
  td:      { padding: "10px 12px", color: "rgba(0,0,0,0.62)", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, lineHeight: 1.55, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5 } as React.CSSProperties,
  tdKey:   { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5, color: "#0A0A0A", fontWeight: 500 } as React.CSSProperties,
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

function Cmd({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={S.h3}>{children}</h3>
  );
}

export default function CliPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>CLI reference</h1>
      <p style={S.lead}>
        Every command, flag, and exit code. All commands read from{" "}
        <InlineCode>shotoku.config.json</InlineCode> by default. Flags override the config file.
      </p>

      {/* Global flags */}
      <h2 style={S.h2}>Global flags</h2>
      <p style={S.p}>
        These flags are available on every command and override the values in{" "}
        <InlineCode>shotoku.config.json</InlineCode>.
      </p>
      <Table
        headers={["Flag", "What it does"]}
        rows={[
          ["--policy <path>", "Path to the policy YAML file"],
          ["--ledger <path>", "Path to the decision ledger (JSONL)"],
        ]}
      />
      <p style={S.p}>
        Precedence order: CLI flags → environment variables → config file → built-in defaults
        (<InlineCode>policy.yaml</InlineCode> and <InlineCode>data/decisions.jsonl</InlineCode>).
      </p>

      <hr style={S.divider} />

      {/* init */}
      <h2 style={S.h2}>init</h2>
      <CodeBlock lang="bash" code={`shotoku init [--dir <path>]`} />
      <p style={S.p}>
        Scaffolds Shotoku in the target directory (defaults to the current directory).
        Creates three things:
      </p>
      <ul style={S.ul}>
        <li style={S.li}><InlineCode>shotoku.config.json</InlineCode> — points to the policy file and ledger path</li>
        <li style={S.li}><InlineCode>policy.yaml</InlineCode> — a starter policy with OpenAI and Anthropic allowlisted</li>
        <li style={S.li}><InlineCode>data/</InlineCode> — directory where decisions will be recorded</li>
      </ul>
      <p style={S.p}>Safe to re-run — it will not overwrite existing files.</p>

      <hr style={S.divider} />

      {/* authorize */}
      <h2 style={S.h2}>authorize</h2>
      <CodeBlock lang="bash" code={`shotoku authorize --actor <id> --action <action> --resource <resource> [--amount <n>]`} />
      <p style={S.p}>Evaluates a single request against your policy and local ledger. Records the decision.</p>
      <Table
        headers={["Flag", "Required", "Description"]}
        rows={[
          ["--actor",    "yes", "Agent identifier"],
          ["--action",   "yes", <>One of: <InlineCode>purchase</InlineCode>, <InlineCode>api_call</InlineCode>, <InlineCode>execute_code</InlineCode>, <InlineCode>send_email</InlineCode>, <InlineCode>mcp_tool</InlineCode>, <InlineCode>custom</InlineCode></>],
          ["--resource", "yes", "Target domain or service (e.g. api.openai.com)"],
          ["--amount",   "no",  "Monetary amount in USD. Must be non-negative if provided."],
        ]}
      />
      <p style={S.p}>Exit codes: <InlineCode>0</InlineCode> if approved, <InlineCode>1</InlineCode> if denied or pending.</p>

      <hr style={S.divider} />

      {/* status */}
      <h2 style={S.h2}>status</h2>
      <CodeBlock lang="bash" code={`shotoku status`} />
      <p style={S.p}>
        Shows all decisions currently waiting for human review, plus the most recent decision.
        Each pending entry includes the actor, resource, amount, age, and a hint to approve or deny.
      </p>
      <CodeBlock lang="bash" code={`shotoku status --ledger ./path/to/decisions.jsonl`} />

      <hr style={S.divider} />

      {/* history */}
      <h2 style={S.h2}>history</h2>
      <CodeBlock lang="bash" code={`shotoku history [--actor <id>] [--since <window>] [--status <status>]`} />
      <p style={S.p}>Lists past decisions as a formatted table with ✓ / ✗ / ◷ icons and a summary line.</p>
      <Table
        headers={["Flag", "Values", "Description"]}
        rows={[
          ["--actor",  "any string",                       "Filter to decisions made by this actor"],
          ["--since",  "24h · 7d · 30d",                   "Rolling time window to filter by"],
          ["--status", "approved · denied · pending_approval", "Filter by decision outcome"],
        ]}
      />
      <CodeBlock lang="bash" code={`shotoku history --since 24h --status denied`} />

      <hr style={S.divider} />

      {/* decision */}
      <h2 style={S.h2}>decision</h2>
      <CodeBlock lang="bash" code={`shotoku decision <id>`} />
      <p style={S.p}>
        Shows the full record for a single decision — the original request, outcome, all reasons,
        and any associated approval or denial that followed.
      </p>
      <CodeBlock lang="bash" code={`shotoku decision dec_f3f0a6da3a69`} />

      <hr style={S.divider} />

      {/* approve */}
      <h2 style={S.h2}>approve</h2>
      <CodeBlock lang="bash" code={`shotoku approve <id>`} />
      <p style={S.p}>
        Approves a pending decision. Shotoku appends a new approval record — it never modifies
        the original decision. Both are preserved in the local ledger.
      </p>
      <p style={S.p}>Fails with a clear error if the decision does not exist, is not pending, or was already actioned.</p>

      <hr style={S.divider} />

      {/* deny */}
      <h2 style={S.h2}>deny</h2>
      <CodeBlock lang="bash" code={`shotoku deny <id>`} />
      <p style={S.p}>
        Denies a pending decision. Same constraints and append-only behavior as{" "}
        <InlineCode>approve</InlineCode>.
      </p>

      <hr style={S.divider} />

      {/* tui */}
      <h2 style={S.h2}>tui</h2>
      <CodeBlock lang="bash" code={`shotoku tui`} />
      <p style={S.p}>
        Launches the interactive terminal UI. Polls the ledger every 3 seconds and lets you
        navigate pending decisions with the keyboard. See the{" "}
        <a href="/docs/tui" style={{ color: "#DB0028", textDecoration: "none" }}>TUI guide →</a>
      </p>

      <hr style={S.divider} />

      {/* snapshot */}
      <h2 style={S.h2}>snapshot</h2>
      <CodeBlock lang="bash" code={`shotoku snapshot create [--out <path>] [--key-id <label>]
shotoku snapshot verify --snapshot <path>`} />
      <p style={S.p}>
        Creates and verifies cryptographically signed snapshots of your policy and ledger.
        Requires the <InlineCode>SHOTOKU_SNAPSHOT_SECRET</InlineCode> environment variable.
        See the{" "}
        <a href="/docs/snapshots" style={{ color: "#DB0028", textDecoration: "none" }}>Snapshots guide →</a>
      </p>
    </div>
  );
}
