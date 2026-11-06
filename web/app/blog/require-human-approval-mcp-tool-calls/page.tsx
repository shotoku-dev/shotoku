import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";
import { PostLayout, Table, Ext, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("require-human-approval-mcp-tool-calls");

export const metadata = postMetadata(post);

export default function McpApprovalPost() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Short answer:</strong> put a proxy MCP server between the agent and your real servers,
        so the proxy is the only server the agent can reach. It checks each tool call against a policy,
        lets safe calls through and holds risky ones until a person approves them outside the agent.
      </p>
      <p style={S.p}>
        The <Ext href="https://modelcontextprotocol.io/specification/2025-06-18/server/tools">MCP specification</Ext> recommends
        this kind of control: &ldquo;a human in the loop with the ability to deny tool invocations.&rdquo;
        It leaves the how to each application.
      </p>

      <h2 style={S.h2}>What are the ways to add approval?</h2>
      <Table
        headers={["Approach", "Can the agent skip it?", "Trade-off"]}
        rows={[
          ["Host confirmation prompts", "Depends on the host and its settings", "Simple, but differs per host and keeps no shared record"],
          ["An approval tool the agent should call", "Yes", "The model decides whether to ask, so it isn't a real gate"],
          ["A proxy in front of your servers", "Not through MCP", "Takes some setup, and works across MCP hosts"],
        ]}
      />
      <p style={S.p}>
        Asking for approval on everything has its own cost: people stop reading and click yes. Let reads
        run freely and save the prompts for calls that change something.
      </p>

      <h2 style={S.h2}>How do you set it up?</h2>
      <p style={S.p}>Install the CLI and give Shotoku a fixed home:</p>
      <CodeBlock lang="bash" code={`npm install -g shotoku-cli
mkdir -p ~/shotoku-home
cd ~/shotoku-home
shotoku init`} />
      <p style={S.p}>
        Move your servers into an upstreams file. It uses the same format as your host config:
      </p>
      <CodeBlock
        lang="json"
        filename="~/shotoku-home/upstreams.json"
        code={`{
  "mcpServers": {
    "postgres": {
      "command": "/path/to/your-postgres-mcp-server"
    }
  }
}`}
      />
      <p style={S.p}>Make Shotoku the only server in your host config, for example in Claude Desktop:</p>
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
      <div style={S.note}>
        <strong>Remove the old entries.</strong> If a server stays in your host config, the agent still
        has a direct route to it and the gate does nothing.
      </div>
      <p style={S.p}>
        Wrapped tools are named <InlineCode>{"<server>__<tool>"}</InlineCode>, and that name is the
        resource in your policy. Your tool names will differ from these:
      </p>
      <CodeBlock
        lang="yaml"
        filename="~/shotoku-home/policy.yaml"
        code={`rules:
  - resource: postgres__query
    verdict: approved
  - resource: postgres__list_*
    verdict: approved
  - resource: postgres__drop_*
    verdict: denied

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>
        <InlineCode>defaultVerdict</InlineCode> covers everything else, so a tool added to the server
        later is held instead of quietly allowed. When a call is held, approve it from{" "}
        <InlineCode>~/shotoku-home</InlineCode> in your terminal:
      </p>
      <CodeBlock lang="bash" code={`shotoku status
shotoku approve dec_abc123`} />

      <h2 style={S.h2}>What does the agent see?</h2>
      <p style={S.p}>
        We connected an MCP client to the current npm release of <InlineCode>shotoku-mcp</InlineCode>,
        with a stand-in server behind it that reports when a tool really runs:
      </p>
      <Table
        headers={["Call", "Result", "Reached the server?"]}
        rows={[
          ["postgres__query", "approved", "Yes"],
          ["postgres__drop_table", "denied", "No"],
          ["postgres__delete_rows on users", "pending_approval", "No"],
          ["Same call, after a human approved it", "approved", "Yes"],
          ["Same call a third time", "pending_approval", "No"],
          ["postgres__delete_rows on orders", "pending_approval", "No"],
          ["approve_decision, called by the agent", "refused", "No"],
        ]}
      />
      <p style={S.p}>
        An approval works once, for the exact call you approved. Approving a delete on{" "}
        <InlineCode>users</InlineCode> gave the agent no way to delete <InlineCode>orders</InlineCode>.
        For standing permission, write a rule in the policy.
      </p>

      <h2 style={S.h2}>What doesn&rsquo;t this cover?</h2>
      <ul style={S.ul}>
        <li style={S.li}><strong>Anything outside MCP.</strong> An agent with shell access or an API token can skip the proxy. See <Link href="/blog/stop-ai-agent-deleting-production-database" style={S.a}>the production database post</Link>.</li>
        <li style={S.li}><strong>Blocked work waits.</strong> Someone has to answer. The terminal queue and TUI are on npm today. The local dashboard and Telegram approvals are in the repo and arrive in the next npm release.</li>
        <li style={S.li}><strong>The rule sees the tool name.</strong> To allow a tool for some arguments and not others, split it across tools or hold it for a human.</li>
      </ul>

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>Does this work with Cursor and other hosts?</h3>
      <p style={S.p}>
        Shotoku is a standard MCP server, so it fits any host that launches MCP servers. We ran this test
        with our own MCP client, so check your host&rsquo;s config format.
      </p>
      <h3 style={S.h3}>Can the agent approve its own request?</h3>
      <p style={S.p}>
        No. The approval tools are withheld by default and refused if called. Approval happens in a place
        the agent can&rsquo;t reach through MCP.
      </p>
      <h3 style={S.h3}>Is every decision recorded?</h3>
      <p style={S.p}>
        Yes, in a local, <Link href="/blog/audit-log-for-ai-agents" style={S.a}>tamper-evident log</Link>,
        including denied and held calls.
      </p>

      <p style={S.p}>
        Full details are in the <Link href="/docs/mcp" style={S.a}>MCP guide</Link>.
      </p>
    </PostLayout>
  );
}
