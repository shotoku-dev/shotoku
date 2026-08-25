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
  callout: { padding: "14px 16px", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, marginBottom: 18, fontSize: 14, lineHeight: 1.7, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif" } as React.CSSProperties,
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
        Put Shotoku between your agent and the tools it can reach, so every call is
        checked against your policy before it runs — and the agent cannot opt out.
      </p>

      {/* Two modes */}
      <h2 style={S.h2}>Two ways to use it</h2>
      <p style={S.p}>
        Decide this first. It changes the whole setup, and only one of the two is
        actually enforcement.
      </p>
      <Table
        headers={["", "Wrapping", "Advisory"]}
        rows={[
          ["What it does", "Shotoku re-exposes your other MCP servers and gates every call", <>The agent calls <InlineCode>authorize_action</InlineCode> when it decides to</>],
          ["Can the agent skip it", <><strong>No</strong> — it has no other route to the tools</>, <><strong>Yes</strong> — nothing compels the call</>],
          ["What it is good for", "Real enforcement over existing MCP servers", "Actions with no MCP server behind them: purchases, your own API calls, code execution"],
          ["Setup", <>Set <InlineCode>SHOTOKU_MCP_UPSTREAMS</InlineCode> and move your servers behind Shotoku</>, "Add Shotoku alongside your other servers"],
        ]}
      />
      <p style={S.p}>
        They are not exclusive. Wrapping covers everything reachable through MCP;
        advisory covers everything else. Most setups end up using both.
      </p>

      <hr style={S.divider} />

      {/* Install */}
      <h2 style={S.h2}>Install</h2>
      <p style={S.p}>
        Nothing to clone or build. The server runs straight from npm:
      </p>
      <CodeBlock lang="bash" code={`npx shotoku-mcp`} />
      <p style={S.p}>
        It speaks MCP over stdin, so running it by hand just sits there waiting — that is
        correct. Your agent host is what launches it. You will also want the CLI, which is
        how you review and approve what the agent asked for:
      </p>
      <CodeBlock lang="bash" code={`npm install -g shotoku-cli`} />

      <hr style={S.divider} />

      {/* Wrapping setup */}
      <h2 style={S.h2}>Setup: wrapping</h2>
      <p style={S.p}>
        Shotoku connects to your other MCP servers, re-exposes each of their tools under
        its own name, and gates every call. The agent talks to Shotoku and nothing else.
      </p>
      <CodeBlock
        lang="text"
        code={`before    agent ──────────────────────► obsidian
after     agent ──► shotoku ──► policy ──► obsidian`}
      />

      <h3 style={S.h3}>1. Set up a home for Shotoku</h3>
      <p style={S.p}>
        Your agent host launches the server with a working directory it chooses — often the
        filesystem root. Give Shotoku a fixed place to keep its policy and its ledger so
        that never matters:
      </p>
      <CodeBlock
        lang="bash"
        code={`mkdir -p ~/shotoku-home
cd ~/shotoku-home
shotoku init`}
      />

      <h3 style={S.h3}>2. List the servers to put behind Shotoku</h3>
      <p style={S.p}>
        The format is the same <InlineCode>mcpServers</InlineCode> shape your agent host
        already uses, so entries usually move across unchanged.
      </p>
      <CodeBlock
        lang="json"
        filename="~/shotoku-home/upstreams.json"
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

      <h3 style={S.h3}>3. Point your agent host at Shotoku</h3>
      <p style={S.p}>
        Replace the entries you just moved. This is the whole config — Shotoku is now the
        only MCP server your host knows about:
      </p>
      <CodeBlock
        lang="json"
        filename="claude_desktop_config.json"
        code={`{
  "mcpServers": {
    "shotoku": {
      "command": "npx",
      "args": ["-y", "shotoku-mcp"],
      "env": {
        "SHOTOKU_HOME": "/absolute/path/to/shotoku-home",
        "SHOTOKU_MCP_UPSTREAMS": "/absolute/path/to/shotoku-home/upstreams.json"
      }
    }
  }
}`}
      />
      <div style={S.callout}>
        <strong>Leave the old entries in and the gate is decorative.</strong> The agent keeps
        a direct route to those servers and will use it. Wrapping only enforces anything if
        Shotoku is the only way through.
      </div>
      <p style={S.p}>
        On macOS the file is at{" "}
        <InlineCode>~/Library/Application Support/Claude/claude_desktop_config.json</InlineCode>;
        on Windows, <InlineCode>%APPDATA%\Claude\claude_desktop_config.json</InlineCode>.
        Restart the app afterwards.
      </p>

      <h3 style={S.h3}>4. Write rules for the wrapped tools</h3>
      <p style={S.p}>
        A wrapped tool is named <InlineCode>&lt;server&gt;__&lt;tool&gt;</InlineCode>, and{" "}
        <strong>that name is the <InlineCode>resource</InlineCode> in your policy</strong>.
        This is the single most useful thing to know about wrapping.
      </p>
      <CodeBlock
        lang="yaml"
        filename="~/shotoku-home/policy.yaml"
        code={`rules:
  # Reading is free
  - resource: obsidian__get_*
    verdict: approved
  - resource: obsidian__search_*
    verdict: approved

  # Writing is allowed, and recorded
  - resource: obsidian__create_*
    verdict: approved
  - resource: obsidian__append_*
    verdict: approved

  # Deleting is not something an agent decides alone
  - resource: obsidian__delete_*
    verdict: pending_approval

  # Read-only server, no friction
  - resource: reddit__*
    verdict: approved

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>
        Keep <InlineCode>defaultVerdict: pending_approval</InlineCode>. A new tool appearing
        in an upstream server after an update is then held for review instead of silently
        allowed.
      </p>

      <h3 style={S.h3}>5. Check it worked</h3>
      <p style={S.p}>
        In Claude Desktop, open the tools icon in a new conversation. You should see
        Shotoku&rsquo;s own tools plus one entry per wrapped tool, prefixed:{" "}
        <InlineCode>obsidian__search_vault</InlineCode>,{" "}
        <InlineCode>reddit__browse_subreddit</InlineCode>, and so on. Then, in a terminal:
      </p>
      <CodeBlock lang="bash" code={`shotoku where`} />
      <p style={S.p}>
        The ledger it prints must be the same file the server writes to. If they differ,
        the agent&rsquo;s decisions are going somewhere you are not looking — the most
        common cause of an approval queue that appears empty.
      </p>

      <hr style={S.divider} />

      {/* Advisory setup */}
      <h2 style={S.h2}>Setup: advisory</h2>
      <p style={S.p}>
        For actions with no MCP server behind them — a purchase, a paid API call, running
        code — the agent asks Shotoku directly. Same install, no upstreams file, and Shotoku
        sits alongside your other servers rather than in front of them:
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "mcpServers": {
    "shotoku": {
      "command": "npx",
      "args": ["-y", "shotoku-mcp"],
      "env": { "SHOTOKU_HOME": "/absolute/path/to/shotoku-home" }
    }
  }
}`}
      />
      <p style={S.p}>
        Be clear-eyed about what this is: the agent decides whether to ask. It is a
        guardrail and an audit trail, not a barrier. Use wrapping wherever a tool server
        exists.
      </p>

      <hr style={S.divider} />

      {/* Tools */}
      <h2 style={S.h2}>The tools</h2>
      <p style={S.p}>A default install exposes three:</p>
      <Table
        headers={["Tool", "What it does"]}
        rows={[
          ["authorize_action", "Ask whether an action is allowed. Returns the full decision with reasons"],
          ["get_decision", "Look up a past decision by ID"],
          ["get_pending_approvals", "List decisions waiting for a human"],
        ]}
      />
      <p style={S.p}>
        Three, not five. <InlineCode>approve_decision</InlineCode> and{" "}
        <InlineCode>deny_decision</InlineCode> exist but are withheld and refused if called:
        an agent that can approve its own pending decisions has not been gated, it has been
        given a form to fill in.
      </p>

      <h3 style={S.h3}>authorize_action</h3>
      <Table
        headers={["Field", "Required", "What it means"]}
        rows={[
          ["action",   "yes", <>One of <InlineCode>purchase</InlineCode>, <InlineCode>api_call</InlineCode>, <InlineCode>execute_code</InlineCode>, <InlineCode>send_email</InlineCode>, <InlineCode>mcp_tool</InlineCode>, <InlineCode>custom</InlineCode></>],
          ["resource", "yes", "What it is acting on — a domain, service name, or endpoint"],
          ["amount",   "no",  "Cost in USD, if any"],
          ["context",  "no",  "Extra detail recorded with the decision (JSON, max 16 KB)"],
        ]}
      />
      <p style={S.p}>
        There is deliberately no <InlineCode>actor</InlineCode> field — see below.
      </p>

      <hr style={S.divider} />

      {/* Identity */}
      <h2 style={S.h2} id="identity">Who the decision is attributed to</h2>
      <p style={S.p}>
        Every decision is recorded against an <strong>actor</strong>. Shotoku sets it; the
        agent does not.
      </p>
      <p style={S.p}>
        An MCP client announces its own name during the initialize handshake, before it can
        make a single tool call, and the model never sees that value. A connection from
        Claude Desktop is recorded as <InlineCode>claude-desktop</InlineCode>, one from
        Cursor as <InlineCode>cursor</InlineCode>, with no configuration.
      </p>
      <p style={S.p}>
        To name a server yourself — one entry per agent, each with its own budget — set{" "}
        <InlineCode>SHOTOKU_MCP_ACTOR</InlineCode> in that entry&rsquo;s{" "}
        <InlineCode>env</InlineCode>, then write rules that apply to it alone:
      </p>
      <CodeBlock
        lang="yaml"
        code={`rules:
  - resource: "*"
    actor: billing-agent
    verdict: approved
    maxDailyAmount: 50`}
      />
      <div style={S.callout}>
        <strong>Distinguishable, not unforgeable.</strong> An agent with shell access can
        edit a config file, or skip Shotoku altogether. The guarantee is narrower and still
        worth having: every call that goes through Shotoku is attributed to a named agent,
        and an agent cannot rename itself through the protocol.
      </div>

      <hr style={S.divider} />

      {/* Approvals */}
      <h2 style={S.h2} id="approvals">Approving what the agent asked for</h2>
      <p style={S.p}>
        Approval happens where the agent cannot reach it — your terminal:
      </p>
      <CodeBlock
        lang="bash"
        code={`shotoku status
shotoku approve dec_abc123`}
      />
      <p style={S.p}>
        Or in the TUI (<InlineCode>shotoku tui</InlineCode>), which is the same queue with
        keyboard navigation.
      </p>

      <h3 style={S.h3}>What happens after you approve</h3>
      <p style={S.p}>
        An approval is redeemable <strong>once</strong>, by the next call matching it
        exactly — same agent, same tool, same arguments, same amount. The agent retries, the
        call goes through, and the approval is spent.
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
        Approvals also expire, after fifteen minutes by default
        (<InlineCode>grantTtlSeconds</InlineCode>).
      </p>
      <p style={S.p}>
        <InlineCode>shotoku status</InlineCode> lists approvals waiting to be used, so one
        never disappears into nothing:
      </p>
      <CodeBlock
        lang="text"
        code={`1 approval waiting to be used by the agent:
  ✓  claude-desktop · obsidian__delete_vault_file · expires in 12m`}
      />

      <h3 style={S.h3}>What the agent is told when blocked</h3>
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
      <p style={S.p}>
        A denial says so plainly and tells the agent not to retry.
      </p>

      <hr style={S.divider} />

      {/* What is recorded */}
      <h2 style={S.h2}>What ends up in the ledger</h2>
      <p style={S.p}>
        Every gated call is recorded: the agent, the server, the tool, the verdict, the
        reasons, and a hash linking it to the record before it. For wrapped calls the{" "}
        <strong>names</strong> of the arguments are recorded — never their values. Tool
        arguments routinely carry API keys, file contents and personal data, and an audit
        log is not a place to accumulate them.
      </p>
      <p style={S.p}>
        The values are still bound to the approval, through a digest. That is what stops an
        approval for one file from being redeemed against another.
      </p>
      <CodeBlock
        lang="bash"
        code={`shotoku history --since 24h
shotoku decision dec_21028c`}
      />

      <hr style={S.divider} />

      {/* Environment */}
      <h2 style={S.h2}>Environment variables</h2>
      <Table
        headers={["Variable", "Default", "What it controls"]}
        rows={[
          ["SHOTOKU_HOME", "~/.shotoku", "Where policy and ledger live when nothing else says otherwise"],
          ["SHOTOKU_MCP_UPSTREAMS", "unset", "Path to the upstreams file. Setting it turns on wrapping"],
          ["SHOTOKU_MCP_ACTOR", "the client name", "Overrides the agent name recorded in the ledger"],
          ["SHOTOKU_MCP_ALLOW_APPROVALS", "unset", <><InlineCode>1</InlineCode> hands the approval tools to the agent. It removes the separation the product exists to provide</>],
          ["SHOTOKU_POLICY", "from the home", "Path to the policy file"],
          ["SHOTOKU_LEDGER", "from the home", "Path to the decision ledger"],
          ["SHOTOKU_CONFIG", "shotoku.config.json", "Path to the Shotoku config file"],
          ["SHOTOKU_RECEIPT_SECRET", "unset", "When set, approved decisions carry a signed receipt"],
        ]}
      />

      <h3 style={S.h3}>Which files the server actually uses</h3>
      <p style={S.p}>
        Every Shotoku process resolves the same way, highest priority first:
      </p>
      <ol style={S.ul}>
        <li style={S.li}><InlineCode>SHOTOKU_POLICY</InlineCode> / <InlineCode>SHOTOKU_LEDGER</InlineCode></li>
        <li style={S.li}>a <InlineCode>shotoku.config.json</InlineCode>, searched for from the working directory upward</li>
        <li style={S.li}>an existing <InlineCode>./data/decisions.jsonl</InlineCode> beside the working directory</li>
        <li style={S.li}><InlineCode>$SHOTOKU_HOME</InlineCode>, otherwise <InlineCode>~/.shotoku</InlineCode></li>
      </ol>
      <p style={S.p}>
        <InlineCode>shotoku where</InlineCode> prints what a directory resolves to and what
        decided it. Run it in your terminal and compare with your host config — if the two
        disagree, the server is writing decisions the CLI cannot see.
      </p>

      <hr style={S.divider} />

      {/* Troubleshooting */}
      <h2 style={S.h2}>When something is wrong</h2>
      <Table
        headers={["Symptom", "Almost always"]}
        rows={[
          [
            "The host says the server failed to start",
            <>Check its MCP logs — Shotoku names the reason on stderr. Usually the upstreams file: invalid JSON, or a path that is not absolute.</>,
          ],
          [
            "No prefixed tools appear",
            <>Wrapping is off or matched nothing. <InlineCode>SHOTOKU_MCP_UPSTREAMS</InlineCode> must point at a file with an <InlineCode>mcpServers</InlineCode> object, and each entry needs a <InlineCode>command</InlineCode>. Shotoku says which entry it rejected.</>,
          ],
          [
            "The agent still reaches a wrapped server directly",
            "Its entry is still in your host config. Wrapping only enforces anything when Shotoku is the only route.",
          ],
          [
            "shotoku status is empty but the agent says it is blocked",
            <>The CLI and the server are reading different ledgers. Run <InlineCode>shotoku where</InlineCode> and compare with the host config.</>,
          ],
          [
            "Everything is denied, including allowed things",
            <>The policy file failed to load and Shotoku fails closed. Run any <InlineCode>shotoku authorize</InlineCode>; the reason names the problem.</>,
          ],
          [
            "An approval does not let the retry through",
            "Something in the call changed — a different argument or amount — or more than fifteen minutes passed. An approval binds to the exact call.",
          ],
        ]}
      />
    </div>
  );
}
