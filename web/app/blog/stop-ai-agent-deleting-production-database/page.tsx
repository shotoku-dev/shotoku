import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";
import { PostLayout, Table, Ext, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("stop-ai-agent-deleting-production-database");

export const metadata = postMetadata(post);

export default function DatabasePost() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Short answer:</strong> make sure the agent can&rsquo;t reach production credentials, use
        tokens scoped to the job, keep backups outside the system they protect, and gate destructive tools
        so a human decides. No single step is enough. A prompt that says &ldquo;never delete anything&rdquo;
        isn&rsquo;t one of those steps at all.
      </p>

      <h2 style={S.h2}>How have agents deleted production data?</h2>
      <p style={S.p}>Two public incidents in 2026 show how it happens:</p>
      <ul style={S.ul}>
        <li style={S.li}>
          <strong>PocketOS.</strong> A Cursor agent running Claude Opus 4.6 was working on a staging
          credential problem. <Ext href="https://hackread.com/cursor-ai-agent-wipes-pocketos-database-backups/">According to reports</Ext>,
          it found an API token elsewhere and deleted the production volume on Railway in one API call,
          taking the backups on that volume with it. The founder said the agent had rules against guessing,
          and it ignored them. Railway later restored a backup, after{" "}
          <Ext href="https://devops.com/when-ai-goes-really-really-wrong-how-pocketos-lost-all-its-data/">more than a day of disruption</Ext>.
        </li>
        <li style={S.li}>
          <strong>DataTalks.Club.</strong> Claude Code{" "}
          <Ext href="https://www.tomshardware.com/tech-industry/artificial-intelligence/claude-code-deletes-developers-production-setup-including-its-database-and-snapshots-2-5-years-of-records-were-nuked-in-an-instant">wiped a production setup</Ext>,
          including the database and its snapshots, holding 2.5 years of records. Reports say it had been
          allowed to run Terraform against production.
        </li>
      </ul>
      <p style={S.p}>
        In both cases the agent could do far more than its task needed, and the backups could be destroyed
        by the same action.
      </p>

      <h2 style={S.h2}>What actually prevents it?</h2>
      <Table
        headers={["Safeguard", "What it stops", "Would it have helped?"]}
        rows={[
          ["Keep production credentials away from the agent", "Using a token it wasn't meant to have", "PocketOS: yes"],
          ["Scope tokens to one environment and task", "A staging job touching production", "PocketOS: yes"],
          ["Keep backups outside the system", "Losing the backups in the same action", "Both: yes"],
          ["Keep production infrastructure commands away from the agent", "Destructive plans running unreviewed", "DataTalks.Club: yes"],
          ["Gate destructive tools with a policy", "Tool calls the agent makes through MCP", "Only for actions that pass through the gate"],
          ["Rules in the prompt", "Nothing reliably", "PocketOS had these"],
        ]}
      />

      <h2 style={S.h2}>Would Shotoku have stopped these incidents?</h2>
      <p style={S.p}>
        <strong>Probably not on its own.</strong> Shotoku checks calls that pass through it. Based on the
        reports, the PocketOS agent used a token it found and called an API directly, and that route never
        touches an MCP gate. The same goes for a shell command. Fix credentials and backups first.
      </p>
      <p style={S.p}>
        Where a gate helps is the agent&rsquo;s normal, sanctioned route. If your agent reaches data through
        MCP tools and has no other route, a policy decides what those tools may do. An{" "}
        <Link href="/changelog" style={S.a}>HTTP gateway</Link> for traffic outside MCP is in the repo as an
        alpha, but it isn&rsquo;t on npm.
      </p>

      <h2 style={S.h2}>How do you gate destructive tools?</h2>
      <p style={S.p}>
        <Link href="/blog/require-human-approval-mcp-tool-calls" style={S.a}>Wrap your MCP server</Link> with
        Shotoku, then write a policy. Reads run, drops are refused, and everything else waits for a person:
      </p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
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
        We tested this policy on the current npm release, with a stand-in server that reports when a tool
        really runs:
      </p>
      <Table
        headers={["Tool call", "Result", "Reached the server?"]}
        rows={[
          ["postgres__query", "approved", "Yes"],
          ["postgres__drop_table", "denied, final", "No"],
          ["postgres__delete_rows", "pending_approval", "No, until a human approves that exact call"],
        ]}
      />
      <div style={S.note}>
        <strong>Check what your read tool can run.</strong> If a <InlineCode>query</InlineCode> tool accepts
        any SQL, approving it also approves <InlineCode>DROP TABLE</InlineCode> sent through it, because the
        policy matches on the tool name. Connect it with a read-only database user.
      </div>

      <h2 style={S.h2}>A checklist before you give an agent access</h2>
      <ol style={S.ol}>
        <li style={S.li}>Search the agent&rsquo;s workspace for tokens, <InlineCode>.env</InlineCode> files and cloud credentials it doesn&rsquo;t need.</li>
        <li style={S.li}>Give it a database user with only the rights the task needs.</li>
        <li style={S.li}>Test a restore from a backup stored in a separate account.</li>
        <li style={S.li}>Turn on deletion protection where your provider offers it.</li>
        <li style={S.li}>List every route the agent has: MCP tools, shell, HTTP and CI.</li>
        <li style={S.li}>Put a gate on the routes you keep, and hold unknown actions by default.</li>
      </ol>

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>Is this only a problem for coding agents?</h3>
      <p style={S.p}>
        No. Any agent with credentials and a loose task has the same risk. Coding agents are simply the
        most common place for it, because they have shells and tokens close at hand.
      </p>
      <h3 style={S.h3}>Do approval prompts solve it?</h3>
      <p style={S.p}>
        Only if the person reads them and the agent has no other route. A prompt on every action teaches
        people to click yes, so reserve them for actions that are hard to undo.
      </p>

      <p style={S.p}>
        Shotoku is built for spend controls, and the same policy engine covers tool calls like these.
        Start with the <Link href="/docs/mcp" style={S.a}>MCP guide</Link>.
      </p>
    </PostLayout>
  );
}
