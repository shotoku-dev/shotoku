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

export default function McpPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>MCP server</h1>
      <p style={S.lead}>
        Connect Shotoku to any MCP-compatible agent host — Claude, Cursor, Windsurf,
        or a custom agent — so that authorization happens automatically, mid-task,
        before your agent acts.
      </p>

      {/* What is MCP */}
      <h2 style={S.h2}>What is MCP?</h2>
      <p style={S.p}>
        MCP (Model Context Protocol) is an open standard that lets AI agents call external
        tools through a consistent interface. Instead of each agent needing custom integration
        code, MCP defines how tools are discovered, described, and called — so the same server
        works across Claude, Cursor, Windsurf, and any other MCP-compatible host.
      </p>
      <p style={S.p}>
        When you add Shotoku as an MCP server, your agent gains direct access to its authorization
        tools. Before spending money, calling an API, or executing code, the agent can call{" "}
        <InlineCode>authorize_action</InlineCode> and let Shotoku make the call — automatically,
        inline, without you writing any integration glue.
      </p>
      <p style={S.p}>
        The CLI is for you. The MCP server is for your agent.
      </p>

      <hr style={S.divider} />

      {/* Setup */}
      <h2 style={S.h2}>Setup</h2>

      <h3 style={S.h3}>1. Build the MCP server</h3>
      <p style={S.p}>From the repo root:</p>
      <CodeBlock lang="bash" code={`pnpm build`} />
      <p style={S.p}>
        This produces <InlineCode>mcp/dist/index.js</InlineCode> — the file your agent host will run.
      </p>

      <h3 style={S.h3}>2. Register Shotoku with your agent host</h3>
      <p style={S.p}>
        Most MCP hosts accept a JSON config file. Add a <InlineCode>shotoku</InlineCode> entry:
      </p>
      <CodeBlock
        lang="json"
        filename="claude_desktop_config.json"
        code={`{
  "mcpServers": {
    "shotoku": {
      "command": "node",
      "args": ["/absolute/path/to/shotoku/mcp/dist/index.js"],
      "env": {
        "SHOTOKU_POLICY": "/absolute/path/to/shotoku/policy.yaml",
        "SHOTOKU_LEDGER": "/absolute/path/to/shotoku/data/decisions.jsonl"
      }
    }
  }
}`}
      />
      <p style={S.p}>
        Use absolute paths. Relative paths are resolved from the working directory where the
        server starts, which may differ by host.
      </p>
      <p style={S.p}>
        For Claude Desktop, add this to{" "}
        <InlineCode>~/Library/Application Support/Claude/claude_desktop_config.json</InlineCode>{" "}
        then restart the app.
      </p>

      <h3 style={S.h3}>3. Create the ledger directory</h3>
      <CodeBlock lang="bash" code={`mkdir -p data`} />

      <hr style={S.divider} />

      {/* Verify */}
      <h2 style={S.h2}>Verifying the connection</h2>
      <p style={S.p}>
        In Claude Desktop, click the tools icon (hammer) in a new conversation and look
        for the <strong>shotoku</strong> section. You should see five tools:
      </p>
      <ul style={S.ul}>
        {["authorize_action", "get_decision", "get_pending_approvals", "approve_decision", "deny_decision"].map((t) => (
          <li key={t} style={S.li}><InlineCode>{t}</InlineCode></li>
        ))}
      </ul>

      <hr style={S.divider} />

      {/* Tools */}
      <h2 style={S.h2}>The tools</h2>

      <h3 style={S.h3}>authorize_action</h3>
      <p style={S.p}>
        The main gate. The agent calls this before performing any action — spending money,
        calling an API, running code, sending a message.
      </p>
      <Table
        headers={["Field", "Required", "What it means"]}
        rows={[
          ["actor",    "yes", "Who is acting — the agent's name or ID"],
          ["action",   "yes", <>What the agent wants to do (<InlineCode>purchase</InlineCode>, <InlineCode>api_call</InlineCode>, <InlineCode>execute_code</InlineCode>, <InlineCode>send_email</InlineCode>, <InlineCode>mcp_tool</InlineCode>, <InlineCode>custom</InlineCode>)</>],
          ["resource", "yes", "What it's acting on — a domain, service name, or endpoint"],
          ["amount",   "no",  "How much it costs in USD, if applicable"],
          ["context",  "no",  "Any extra details you want recorded with the decision (must be JSON-serializable, max 16 KB)"],
        ]}
      />
      <CodeBlock
        lang="json"
        filename="Example response"
        code={`{
  "approved": true,
  "status": "approved",
  "reasons": [
    { "type": "policy_match", "text": "openai.com matched rule" },
    { "type": "limit_check",  "text": "Amount $5 within per-transaction limit of $50" },
    { "type": "budget_check", "text": "Daily budget remaining: $195" }
  ],
  "explanation": { "summary": "Request approved. All policy checks passed." },
  "decisionId": "dec_f3f0a6da3a69",
  "timestamp": "2026-06-22T15:02:00.000Z"
}`}
      />

      <h3 style={S.h3}>get_decision</h3>
      <p style={S.p}>
        Looks up a single past decision by ID. Returns the full record — original request,
        outcome, and reasons. Useful when the agent wants to reference what was decided
        earlier in a session.
      </p>

      <h3 style={S.h3}>get_pending_approvals</h3>
      <p style={S.p}>
        Returns every decision currently waiting for human review. The agent can surface this
        naturally: &ldquo;You have 2 pending approvals — want to review them?&rdquo; Returns
        an empty message when the queue is clear.
      </p>

      <h3 style={S.h3}>approve_decision</h3>
      <p style={S.p}>
        Approves a pending decision. Shotoku appends a new approval record to the ledger —
        it never mutates the original decision. Both the decision and the human approval
        are preserved in the audit trail.
      </p>
      <CodeBlock lang="json" code={`{ "decisionId": "dec_abc123" }`} />

      <h3 style={S.h3}>deny_decision</h3>
      <p style={S.p}>
        Denies a pending decision. Same append-only behavior as approval.
      </p>
      <CodeBlock lang="json" code={`{ "decisionId": "dec_abc123" }`} />

      <hr style={S.divider} />

      {/* Walkthrough */}
      <h2 style={S.h2}>Walkthrough</h2>
      <p style={S.p}>What a typical exchange looks like once Shotoku is connected:</p>
      <CodeBlock
        lang="bash"
        code={`# You ask the agent something that involves an API call
You: Research the top three AI coding tools and summarize pricing.

# Agent calls authorize_action before doing anything
Agent → authorize_action({
  actor: "my-agent", action: "api_call",
  resource: "openai.com", amount: 0.05
})

# Shotoku checks policy, records decision, returns approved
Shotoku → { approved: true, status: "approved", decisionId: "dec_..." }

# Agent proceeds
Agent: Here are the top three AI coding tools...`}
      />
      <p style={S.p}>If your policy requires human approval:</p>
      <CodeBlock
        lang="bash"
        code={`Agent: I need to call a service that isn't on your allowlist.
       Shotoku flagged this as pending approval.

# From your terminal:
shotoku approve dec_abc123
# → ✓ Approved. Recorded as apr_xxx.`}
      />

      <hr style={S.divider} />

      {/* Environment variables */}
      <h2 style={S.h2}>Environment variables</h2>
      <Table
        headers={["Variable", "Default", "What it controls"]}
        rows={[
          ["SHOTOKU_CONFIG", "shotoku.config.json",   "Path to the Shotoku config file"],
          ["SHOTOKU_POLICY", "policy.yaml",            "Path to your policy file (overrides config)"],
          ["SHOTOKU_LEDGER", "data/decisions.jsonl",   "Path to the local decision ledger (overrides config)"],
        ]}
      />
      <p style={S.p}>
        If <InlineCode>SHOTOKU_POLICY</InlineCode> or <InlineCode>SHOTOKU_LEDGER</InlineCode> are set
        they take precedence. Otherwise the server reads <InlineCode>shotoku.config.json</InlineCode>.
        If no config file exists it falls back to the defaults above.
      </p>
    </div>
  );
}
