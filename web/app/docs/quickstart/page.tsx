import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";
import { DotmSquare11 } from "../../components/ui/dotm-square-11";

const S = {
  page: {
    padding: "48px 64px 96px",
  } as React.CSSProperties,
  h1: {
    fontSize:      28,
    fontWeight:    500,
    fontFamily:    "Satoshi, var(--font-geist), sans-serif",
    color:         "#0A0A0A",
    letterSpacing: "-0.025em",
    marginBottom:  8,
    lineHeight:    1.2,
  } as React.CSSProperties,
  lead: {
    fontSize:     15,
    color:        "rgba(0,0,0,0.5)",
    fontFamily:   "Satoshi, var(--font-geist), sans-serif",
    marginBottom: 48,
    lineHeight:   1.6,
  } as React.CSSProperties,
  h2: {
    fontSize:      17,
    fontWeight:    500,
    fontFamily:    "Satoshi, var(--font-geist), sans-serif",
    color:         "#0A0A0A",
    letterSpacing: "-0.01em",
    marginTop:     44,
    marginBottom:  14,
  } as React.CSSProperties,
  p: {
    fontSize:   14.5,
    lineHeight: 1.8,
    color:      "rgba(0,0,0,0.62)",
    fontFamily: "var(--font-geist), Satoshi, sans-serif",
    marginBottom: 12,
  } as React.CSSProperties,
  ul: {
    margin:      "8px 0 14px",
    paddingLeft: 20,
  } as React.CSSProperties,
  li: {
    fontSize:     14.5,
    lineHeight:   1.8,
    color:        "rgba(0,0,0,0.62)",
    fontFamily:   "var(--font-geist), Satoshi, sans-serif",
    marginBottom: 2,
  } as React.CSSProperties,
  divider: {
    border:    "none",
    borderTop: "1px solid rgba(0,0,0,0.07)",
    margin:    "48px 0",
  } as React.CSSProperties,
  nextGrid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 10,
    marginTop:           14,
  } as React.CSSProperties,
  nextCard: {
    padding:        "14px 16px",
    border:         "1px solid rgba(0,0,0,0.09)",
    borderRadius:   10,
    textDecoration: "none",
    display:        "block",
    transition:     "border-color 0.15s",
  } as React.CSSProperties,
  nextLabel: {
    fontSize:     13.5,
    fontWeight:   500,
    color:        "#0A0A0A",
    fontFamily:   "Satoshi, var(--font-geist), sans-serif",
    marginBottom: 2,
  } as React.CSSProperties,
  nextDesc: {
    fontSize:   12.5,
    color:      "rgba(0,0,0,0.42)",
    fontFamily: "Satoshi, var(--font-geist), sans-serif",
    lineHeight: 1.5,
  } as React.CSSProperties,
};

function Step({ title }: { title: string }) {
  return <h2 style={S.h2}>{title}</h2>;
}

export default function QuickstartPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Quickstart</h1>
      <p style={S.lead}>
        Connect your agent to Shotoku, watch one spend go through and one wait for
        you, then approve it. About five minutes.
      </p>

      <p style={{ ...S.p, marginBottom: 0, marginTop: 0 }}>
        You need Node.js 20 or newer, and an MCP-compatible agent such as Claude
        Desktop, Claude Code, or Cursor.
      </p>

      <Step title="See it first (optional)" />
      <p style={S.p}>
        Thirty seconds, nothing to configure, nothing real happens. Four simulated
        spends: two approved, one denied when the daily budget runs out, one held
        for a human.
      </p>
      <CodeBlock lang="bash" code={`npx shotoku-cli demo`} />

      <Step title="Install the CLI" />
      <CodeBlock lang="bash" code={`npm install -g shotoku-cli`} />
      <p style={S.p}>
        Shotoku has two halves. The MCP server is for your agent: it asks before it
        spends. The <InlineCode>shotoku</InlineCode> command is for you: it creates
        the policy, and it is how you approve. The agent can never approve its own
        requests, so you need both.
      </p>

      <Step title="Give Shotoku a home" />
      <p style={S.p}>
        Your agent host starts the MCP server from a folder it chooses, often the
        filesystem root. A fixed home keeps the policy and the ledger in one place,
        whatever that folder is.
      </p>
      <CodeBlock
        lang="bash"
        code={`mkdir -p ~/shotoku-home
cd ~/shotoku-home
shotoku init`}
      />
      <p style={S.p}>This creates:</p>
      <ul style={S.ul}>
        <li style={S.li}>
          <InlineCode>policy.yaml</InlineCode>, the rules your agents are held to
        </li>
        <li style={S.li}>
          <InlineCode>shotoku.config.json</InlineCode>, which says where the policy
          and the ledger are
        </li>
        <li style={S.li}>
          <InlineCode>data/</InlineCode>, where every decision is recorded, one JSON
          line each
        </li>
      </ul>
      <p style={S.p}>The starting policy looks like this:</p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`rules:
  - resource: openai.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50          # per transaction
    maxDailyAmount: 200    # rolling 24 hours

  - resource: anthropic.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>
        Rules are read top to bottom, and the first match decides. Anything that
        matches no rule is held for you, never approved on its own. Anything over a
        limit is denied. See <Link href="/docs/policies">Policies</Link> for the
        full format.
      </p>

      <Step title="Connect your agent" />
      <p style={S.p}>
        Add Shotoku to your agent host&apos;s MCP config. Use the absolute path to
        the folder you just made.
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "mcpServers": {
    "shotoku": {
      "command": "npx",
      "args": ["-y", "shotoku-mcp"],
      "env": {
        "SHOTOKU_HOME": "/absolute/path/to/shotoku-home",
        "SHOTOKU_MCP_ACTOR": "my-agent"
      }
    }
  }
}`}
      />
      <p style={S.p}>
        For Claude Desktop, the file is{" "}
        <InlineCode>claude_desktop_config.json</InlineCode>, in{" "}
        <InlineCode>~/Library/Application Support/Claude/</InlineCode> on macOS
        and <InlineCode>%APPDATA%\Claude\</InlineCode> on Windows. Restart the app
        afterwards.
      </p>
      <p style={S.p}>
        <InlineCode>SHOTOKU_MCP_ACTOR</InlineCode> is the name your agent&apos;s
        decisions are recorded under. Leave it out and Shotoku uses the name your
        agent host announces.
      </p>
      <p style={S.p}>
        Your agent should now list three Shotoku tools:{" "}
        <InlineCode>authorize_action</InlineCode>,{" "}
        <InlineCode>get_decision</InlineCode> and{" "}
        <InlineCode>get_pending_approvals</InlineCode>.
      </p>

      <Step title="Let the agent ask" />
      <p style={S.p}>Give your agent this:</p>
      <CodeBlock
        lang="text"
        code={`Use Shotoku to check whether you may spend $5 on openai.com,
then whether you may spend $12 on vendor-xyz.com.`}
      />
      <p style={S.p}>
        The first spend is approved: openai.com is on the allowlist, and $5 is under
        both limits. The second is held, because vendor-xyz.com matches no rule. The
        agent gets the decision ID back and tells you a human has to approve.
      </p>

      <Step title="Approve it" />
      <p style={S.p}>
        In a terminal inside <InlineCode>~/shotoku-home</InlineCode>, see what is
        waiting for you:
      </p>
      <CodeBlock lang="bash" code={`shotoku status`} />
      <p style={S.p}>
        Run it from that folder, or set <InlineCode>SHOTOKU_HOME</InlineCode> in your
        shell. Anywhere else, the CLI reads a different ledger than your agent and
        shows nothing waiting. <InlineCode>shotoku where</InlineCode> tells you which
        ledger you are reading.
      </p>

      {/* Pending approval output — uses DotmSquare11 instead of ◷ */}
      <div
        style={{
          position:     "relative",
          background:   "rgba(0,0,0,0.025)",
          border:       "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          margin:       "16px 0",
          overflow:     "hidden",
        }}
      >
        <pre
          style={{
            margin:     0,
            padding:    "14px 16px",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize:   12.5,
            lineHeight: 1.75,
            overflowX:  "auto",
            whiteSpace: "pre",
          }}
        >
          <span style={{ display: "block", color: "#0F0D0C" }}>{"1 pending approval:"}</span>
          <span style={{ display: "block" }}>{" "}</span>
          <span style={{ color: "#92400e", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em" }}>
            <span>{"  "}</span>
            <span style={{ display: "inline-flex", flexShrink: 0, lineHeight: 1 }}>
              <DotmSquare11 size={14} dotSize={1.5} animated speed={1.4} color="#92400e" />
            </span>
            <span>{"dec_ghi789"}</span>
          </span>
          <span style={{ display: "block", color: "#0F0D0C" }}>{"     my-agent · purchase · vendor-xyz.com · $12 · 1m ago"}</span>
          <span style={{ display: "block", color: "#0F0D0C" }}>{"     • vendor-xyz.com is not on the allowlist"}</span>
          <span style={{ display: "block", color: "#0F0D0C" }}>{"     → shotoku approve dec_ghi789  |  shotoku deny dec_ghi789"}</span>
        </pre>
      </div>

      <CodeBlock
        lang="bash"
        code={`shotoku approve dec_ghi789
# ✓ Approved. Recorded as apr_4b1e09c2d7a3.`}
      />
      <p style={S.p}>
        Ask the agent to try the same spend again. It goes through this time, once.
        An approval covers that exact request: same agent, same vendor, same amount,
        within 15 minutes. A second identical spend needs a new approval. Standing
        permission belongs in <InlineCode>policy.yaml</InlineCode>.
      </p>
      <p style={S.p}>You can also answer from somewhere other than a terminal:</p>
      <ul style={S.ul}>
        <li style={S.li}>
          <InlineCode>shotoku ui</InlineCode> opens a local dashboard with approve
          and deny buttons, budgets, and history. See{" "}
          <Link href="/docs/dashboard">Dashboard</Link>.
        </li>
        <li style={S.li}>
          <InlineCode>shotoku telegram</InlineCode> sends each pending decision to
          your phone, with buttons to approve or deny. See{" "}
          <Link href="/docs/phone">Approve from your phone</Link>.
        </li>
      </ul>

      <Step title="Make it unavoidable" />
      <p style={S.p}>
        So far the agent asks because you told it to. Nothing stops it from skipping
        the question. To make Shotoku a gate the agent cannot go around, put your
        other MCP servers behind it. The agent then reaches their tools only through
        Shotoku, and every call is checked against the policy first.
      </p>
      <p style={S.p}>
        <Link href="/docs/mcp">MCP server</Link> covers the setup.{" "}
        <Link href="/docs/paypal">PayPal</Link> walks through a full example: an
        agent that issues refunds through PayPal&apos;s own MCP server, with refunds
        over $100 sent to your phone.
      </p>

      <hr style={S.divider} />

      <Step title="Not using an MCP agent?" />
      <p style={S.p}>
        Call <InlineCode>authorize()</InlineCode> from your own code before the agent
        acts. It reads the same policy and writes to the same ledger, so{" "}
        <InlineCode>shotoku status</InlineCode> and every way of approving work the
        same.
      </p>
      <CodeBlock lang="bash" code={`npm install @shotoku/core`} />
      <CodeBlock
        lang="typescript"
        filename="agent.ts"
        code={`import { authorize } from "@shotoku/core";

const response = await authorize(
  { actor: "my-agent", action: "purchase", resource: "openai.com", amount: 5 },
  {
    policyPath: "/absolute/path/to/shotoku-home/policy.yaml",
    ledgerPath: "/absolute/path/to/shotoku-home/data/decisions.jsonl",
  },
);

if (response.approved) {
  // safe to proceed
}`}
      />
      <p style={S.p}>
        Shotoku fails closed. If the policy is missing or invalid, or the request is
        malformed, the answer is <InlineCode>denied</InlineCode>, never approved.
      </p>
      <p style={S.p}>To test a policy without any agent, ask from the terminal:</p>
      <CodeBlock
        lang="bash"
        code={`shotoku authorize --actor my-agent --action purchase --resource openai.com --amount 5`}
      />
      <CodeBlock
        lang="text"
        code={`✓ APPROVED  dec_063a20380ba7
  • openai.com matched rule
  • Amount $5 is within per-transaction limit of $50
  • Daily budget remaining: $195
  Recorded at 14:05:22`}
      />

      <Step title="Quick links" />
      <div style={S.nextGrid}>
        {[
          { href: "/docs/mcp",       label: "MCP server",              desc: "Advisory mode, wrapping other servers, and pricing tool calls" },
          { href: "/docs/policies",  label: "Policies",                desc: "Rules, limits, agent budgets, and wildcards"                    },
          { href: "/docs/phone",     label: "Approve from your phone", desc: "Pending decisions on Telegram, answered with a tap"            },
          { href: "/docs/dashboard", label: "Dashboard",               desc: "Approvals, budgets, and history in your browser"                },
          { href: "/docs/paypal",    label: "PayPal",                  desc: "A support agent issuing refunds, with limits and approvals"     },
          { href: "/docs/x402",      label: "x402",                    desc: "Authorize a payment once the price is known, before signing"   },
          { href: "/docs/cli",       label: "CLI reference",           desc: "Every command, flag, and exit code"                             },
          { href: "/docs/api",       label: "API reference",           desc: "authorize(), types, and the request and response shape"        },
        ].map((card) => (
          <Link key={card.href} href={card.href} style={S.nextCard}>
            <div style={S.nextLabel}>{card.label}</div>
            <div style={S.nextDesc}>{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
