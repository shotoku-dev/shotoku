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
        Use absolute paths. Your host chooses the working directory the server starts in,
        and it is often not the one you expect — see <em>Which files the server actually
        uses</em> below.
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
        for the <strong>shotoku</strong> section. You should see three tools:
      </p>
      <ul style={S.ul}>
        {["authorize_action", "get_decision", "get_pending_approvals"].map((t) => (
          <li key={t} style={S.li}><InlineCode>{t}</InlineCode></li>
        ))}
      </ul>
      <p style={S.p}>
        Three, not five. <InlineCode>approve_decision</InlineCode> and{" "}
        <InlineCode>deny_decision</InlineCode> are withheld by default and refused if
        called: an agent that can approve its own pending decisions defeats the point.
      </p>

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
          ["action",   "yes", <>What the agent wants to do (<InlineCode>purchase</InlineCode>, <InlineCode>api_call</InlineCode>, <InlineCode>execute_code</InlineCode>, <InlineCode>send_email</InlineCode>, <InlineCode>mcp_tool</InlineCode>, <InlineCode>custom</InlineCode>)</>],
          ["resource", "yes", "What it's acting on — a domain, service name, or endpoint"],
          ["amount",   "no",  "How much it costs in USD, if applicable"],
          ["context",  "no",  "Any extra details you want recorded with the decision (must be JSON-serializable, max 16 KB)"],
        ]}
      />
      <p style={S.p}>
        There is deliberately no <InlineCode>actor</InlineCode> field. Identity comes from the
        connected client, not from the call — see <em>Who the decision is attributed to</em> below.
      </p>
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

      {/* Identity */}
      <h2 style={S.h2} id="identity">Who the decision is attributed to</h2>
      <p style={S.p}>
        Every decision is recorded against an <strong>actor</strong> — the name of the agent that
        asked. Shotoku sets it; the agent does not.
      </p>
      <p style={S.p}>
        An MCP client announces its own name during the initialize handshake, before it can make a
        single tool call, and the model on the other side never sees that value. A connection from
        Claude Desktop is recorded as <InlineCode>claude-desktop</InlineCode>, one from Cursor as{" "}
        <InlineCode>cursor</InlineCode>, with no configuration.
      </p>
      <p style={S.p}>
        To name a server yourself — one entry per agent, each with its own budget and rules — set{" "}
        <InlineCode>SHOTOKU_MCP_ACTOR</InlineCode> in that server&rsquo;s config block:
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "mcpServers": {
    "shotoku-billing": {
      "command": "node",
      "args": ["/absolute/path/to/shotoku/mcp/dist/index.js"],
      "env": { "SHOTOKU_MCP_ACTOR": "billing-agent" }
    }
  }
}`}
      />
      <p style={S.p}>Then write rules that apply to that agent alone:</p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`rules:
  - resource: "*"
    actor: billing-agent
    verdict: approved
    maxDailyAmount: 50`}
      />
      <p style={S.p}>
        <strong>What this does and does not guarantee.</strong> It makes agents{" "}
        <em>distinguishable</em>, not <em>unforgeable</em>. An agent with shell access can edit a
        config file, or skip Shotoku altogether. The guarantee is narrower and still worth having:
        every call that goes through Shotoku is attributed to a named agent, and an agent cannot
        rename itself through the protocol. That is what makes the ledger worth reading.
      </p>

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
  action: "api_call",
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

      {/* Wrapping */}
      <h2 style={S.h2} id="wrapping">Gating other MCP servers</h2>
      <p style={S.p}>
        Everything above assumes the agent <em>chooses</em> to ask Shotoku. It can also
        decline to ask.
      </p>
      <p style={S.p}>
        Wrapping removes that choice. Shotoku connects to your other MCP servers,
        re-exposes their tools as its own, and gates every call. The agent talks to
        Shotoku and nothing else — it never sees the servers behind it.
      </p>
      <CodeBlock
        lang="text"
        code={`before    agent ──────────────────────► obsidian
after     agent ──► shotoku ──► policy ──► obsidian`}
      />

      <h3 style={S.h3}>Turning it on</h3>
      <p style={S.p}>
        List the servers to put behind Shotoku in a file. The format is the same{" "}
        <InlineCode>mcpServers</InlineCode> shape your agent host already uses, so entries
        usually move across unchanged.
      </p>
      <CodeBlock
        lang="json"
        filename="upstreams.json"
        code={`{
  "mcpServers": {
    "obsidian": {
      "command": "/path/to/obsidian-mcp-server",
      "env": { "OBSIDIAN_API_KEY": "..." }
    },
    "reddit": {
      "command": "npx",
      "args": ["-y", "reddit-mcp-buddy"]
    }
  }
}`}
      />
      <p style={S.p}>
        Point Shotoku at it — and <strong>remove those servers from your host config</strong>.
        Leave them and the agent keeps a direct route, which makes the gate decorative.
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "mcpServers": {
    "shotoku": {
      "command": "node",
      "args": ["/absolute/path/to/shotoku/mcp/dist/index.js"],
      "env": {
        "SHOTOKU_MCP_UPSTREAMS": "/absolute/path/to/upstreams.json",
        "SHOTOKU_LEDGER": "/absolute/path/to/data/decisions.jsonl"
      }
    }
  }
}`}
      />
      <p style={S.p}>
        Restart your host. Where you previously saw <InlineCode>search_vault</InlineCode>,
        you now see <InlineCode>obsidian__search_vault</InlineCode>.
      </p>

      <h3 style={S.h3}>Writing rules for wrapped tools</h3>
      <p style={S.p}>
        A wrapped tool is named <InlineCode>&lt;server&gt;__&lt;tool&gt;</InlineCode>, and{" "}
        <strong>that name is the <InlineCode>resource</InlineCode> in your policy</strong>.
        This is the single most useful thing to know about wrapping.
      </p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`rules:
  # Reading is free
  - resource: obsidian__get_*
    verdict: approved
  - resource: obsidian__search_*
    verdict: approved

  # Writing is allowed, and recorded
  - resource: obsidian__create_*
    verdict: approved

  # Deleting is not something an agent decides alone
  - resource: obsidian__delete_*
    verdict: pending_approval

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>
        Wrapped calls are recorded as <InlineCode>action: mcp_tool</InlineCode> on the{" "}
        <InlineCode>mcp</InlineCode> rail, so <InlineCode>actions</InlineCode> and{" "}
        <InlineCode>rails</InlineCode> narrow rules further if you need them.
      </p>
      <p style={S.p}>
        Keeping <InlineCode>defaultVerdict: pending_approval</InlineCode> matters here. A new
        tool appearing in an upstream server — after an update, say — is then held for review
        rather than silently allowed.
      </p>

      <h3 style={S.h3}>What the agent sees when it is blocked</h3>
      <CodeBlock
        lang="text"
        code={`Blocked by Shotoku — this action was not authorized.
  status:   pending_approval
  decision: dec_cd9b9664cf9f
  reason:   obsidian__delete_vault_file matched rule
  A human must approve this out-of-band (\`shotoku approve dec_cd9b9664cf9f\`,
  the Shotoku TUI, or Slack). You cannot approve it yourself — ask the user.
  Once they approve, retry this exact call: the approval is redeemable once,
  for these arguments only. Changing anything requires a new approval.`}
      />

      <h3 style={S.h3}>What is recorded, and what is not</h3>
      <p style={S.p}>
        The decision records the server, the tool, and the <strong>names</strong> of the
        arguments — never their values. Tool arguments routinely carry API keys, file
        contents and personal data, and an audit log is not a place to accumulate them.
      </p>
      <p style={S.p}>
        The values are still bound to the approval, through a digest. That is what stops an
        approval for one file from being redeemed against another.
      </p>

      <hr style={S.divider} />

      {/* Approvals */}
      <h2 style={S.h2} id="approvals">Approvals happen out-of-band</h2>
      <p style={S.p}>
        <InlineCode>approve_decision</InlineCode> and <InlineCode>deny_decision</InlineCode>{" "}
        exist, but a default install does not expose them, and calling one is refused
        outright. An agent that can approve its own pending decisions has not been gated at
        all — it has been given a form to fill in.
      </p>
      <p style={S.p}>So approval happens somewhere the agent cannot reach:</p>
      <CodeBlock
        lang="bash"
        code={`shotoku status
shotoku approve dec_abc123`}
      />
      <p style={S.p}>
        Or in the TUI (<InlineCode>shotoku tui</InlineCode>).{" "}
        <InlineCode>SHOTOKU_MCP_ALLOW_APPROVALS=1</InlineCode> lifts the restriction; it is
        meant for a human driving the server directly, and it removes the separation the
        product exists to provide.
      </p>

      <h3 style={S.h3}>After you approve</h3>
      <p style={S.p}>
        An approval is redeemable <strong>once</strong>, by the next call that matches it
        exactly — same agent, same tool, same arguments, same amount. The agent retries, the
        call goes through, and the grant is spent.
      </p>
      <CodeBlock
        lang="text"
        code={`agent   → obsidian__delete_vault_file   ◷ pending, dec_21028c
you     → shotoku approve dec_21028c
agent   → obsidian__delete_vault_file   ✓ approved
agent   → obsidian__delete_vault_file   ◷ pending again`}
      />
      <p style={S.p}>
        That last line is the design, not a bug. Approving an action is not approving it
        forever — standing permission is what <InlineCode>policy.yaml</InlineCode> is for.
        Approvals expire too, after fifteen minutes by default
        (<InlineCode>grantTtlSeconds</InlineCode>).
      </p>
      <p style={S.p}>
        <InlineCode>shotoku status</InlineCode> shows approvals waiting to be used, so an
        approval never disappears into nothing:
      </p>
      <CodeBlock
        lang="text"
        code={`1 approval waiting to be used by the agent:
  ✓  claude-desktop · obsidian__delete_vault_file · expires in 12m`}
      />

      <hr style={S.divider} />

      {/* Troubleshooting */}
      <h2 style={S.h2}>When something is wrong</h2>
      <Table
        headers={["Symptom", "Almost always"]}
        rows={[
          [
            "The host says the server failed to start",
            <>The upstreams file. Check it is valid JSON and that the path in <InlineCode>SHOTOKU_MCP_UPSTREAMS</InlineCode> is absolute. The reason goes to stderr, which your host keeps in its MCP logs.</>,
          ],
          [
            "No <server>__<tool> tools appear",
            <>Wrapping is off or found nothing. <InlineCode>SHOTOKU_MCP_UPSTREAMS</InlineCode> must point at a file containing an <InlineCode>mcpServers</InlineCode> object, and each entry needs a <InlineCode>command</InlineCode>.</>,
          ],
          [
            "shotoku status is empty but the agent says it is blocked",
            <>The CLI and the server are reading different ledgers. Run <InlineCode>shotoku where</InlineCode> and compare it with the <InlineCode>SHOTOKU_LEDGER</InlineCode> in your host config.</>,
          ],
          [
            "Everything is denied, including allowed things",
            <>The policy file failed to load, and Shotoku fails closed. Run any <InlineCode>shotoku authorize</InlineCode>; the reason names the problem.</>,
          ],
          [
            "An approval does not let the retry through",
            "Something in the call changed — a different argument, a different amount — or more than fifteen minutes passed. The grant binds to the exact call that was approved.",
          ],
        ]}
      />

      <hr style={S.divider} />

      {/* Environment variables */}
      <h2 style={S.h2}>Environment variables</h2>
      <Table
        headers={["Variable", "Default", "What it controls"]}
        rows={[
          ["SHOTOKU_MCP_UPSTREAMS", "unset", "Path to the upstream servers file. Setting it turns on wrapping"],
          ["SHOTOKU_MCP_ACTOR", "the client name", "Overrides the agent name recorded in the ledger"],
          ["SHOTOKU_MCP_ALLOW_APPROVALS", "unset", <><InlineCode>1</InlineCode> exposes the approval tools to the agent. It removes the separation the product exists to provide</>],
          ["SHOTOKU_HOME", "~/.shotoku", "Where policy and ledger live when nothing else says otherwise"],
          ["SHOTOKU_CONFIG", "shotoku.config.json", "Path to the Shotoku config file"],
          ["SHOTOKU_POLICY", "from the home", "Path to your policy file"],
          ["SHOTOKU_LEDGER", "from the home", "Path to the local decision ledger"],
          ["SHOTOKU_RECEIPT_SECRET", "unset", "When set, approved decisions carry a signed receipt"],
        ]}
      />

      <h3 style={S.h3}>Which files the server actually uses</h3>
      <p style={S.p}>
        Your agent host launches the MCP server and chooses its working directory — often
        the filesystem root. That makes resolution worth being explicit about. Every
        Shotoku process resolves the same way, highest priority first:
      </p>
      <ol style={S.ul}>
        <li style={S.li}><InlineCode>SHOTOKU_POLICY</InlineCode> / <InlineCode>SHOTOKU_LEDGER</InlineCode></li>
        <li style={S.li}>a <InlineCode>shotoku.config.json</InlineCode>, searched for from the working directory upward</li>
        <li style={S.li}>an existing <InlineCode>./data/decisions.jsonl</InlineCode> beside the working directory</li>
        <li style={S.li}><InlineCode>$SHOTOKU_HOME</InlineCode>, otherwise <InlineCode>~/.shotoku</InlineCode></li>
      </ol>
      <p style={S.p}>
        To see what a directory resolves to, and what decided it:
      </p>
      <CodeBlock lang="bash" code={`shotoku where`} />
      <p style={S.p}>
        Run it in your terminal, then compare with the environment your MCP server has. If
        the two disagree, the server is writing decisions the CLI cannot see.
      </p>
    </div>
  );
}
