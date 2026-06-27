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
        Get from install to your first authorization decision in under five minutes.
      </p>

      {/* Prerequisites */}
      <p style={{ ...S.p, marginBottom: 0, marginTop: 0 }}>
        You need Node.js 18+ and npm or pnpm before starting.
      </p>

      <Step title="Install the CLI" />
      <CodeBlock lang="bash" code={`npm install -g shotoku-cli`} />
      <p style={S.p}>
        This installs the <InlineCode>shotoku</InlineCode> command globally.
        The core library (<InlineCode>@shotoku/core</InlineCode>) is also available
        separately if you want to call <InlineCode>authorize()</InlineCode> directly
        from your agent code.
      </p>

      <Step title="Initialize" />
      <CodeBlock lang="bash" code={`shotoku init`} />
      <p style={S.p}>This creates three things in your current directory:</p>
      <ul style={S.ul}>
        <li style={S.li}>
          <InlineCode>shotoku.config.json</InlineCode> — runtime config (policy path, ledger path)
        </li>
        <li style={S.li}>
          <InlineCode>policy.yaml</InlineCode> — your authorization rules
        </li>
        <li style={S.li}>
          <InlineCode>data/</InlineCode> — directory where decisions are stored locally
        </li>
      </ul>

      <Step title="Define your policy" />
      <p style={S.p}>
        Open <InlineCode>policy.yaml</InlineCode> and define which resources your
        agents are allowed to access. Anything not on the allowlist goes to{" "}
        <InlineCode>pending_approval</InlineCode>. Anything that exceeds a limit
        is <InlineCode>denied</InlineCode>.
      </p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`version: 1
allowlist:
  - resource: "api.openai.com"
    actions: ["api_call"]
    limits:
      per_request: 5.00
      daily: 50.00

  - resource: "api.anthropic.com"
    actions: ["api_call"]
    limits:
      per_request: 2.00
      daily: 20.00`}
      />
      <p style={S.p}>
        The <InlineCode>daily</InlineCode> limit is computed from the rolling
        24-hour window in the local ledger — not a calendar day.
      </p>

      <Step title="Call authorize() in your agent" />
      <p style={S.p}>
        Before your agent takes an action, call <InlineCode>authorize()</InlineCode>.
        It evaluates the request against your policy and the local ledger, writes
        the decision, and returns the result.
      </p>
      <CodeBlock
        lang="typescript"
        filename="agent.ts"
        code={`import { authorize } from "@shotoku/core";

const response = await authorize(
  {
    actor:    "agent-001",
    action:   "api_call",
    resource: "api.openai.com",
    amount:   0.04,
  },
  {
    policyPath: "./policy.yaml",
    ledgerPath: "./data/decisions.jsonl",
  },
);

if (response.approved) {
  // safe to proceed
  await callOpenAI(prompt);
}`}
      />
      <p style={S.p}>
        Shotoku fails closed. If the policy file is missing or the request is
        malformed, the response is <InlineCode>denied</InlineCode> — it never
        defaults to approved.
      </p>

      <Step title="Try it from the CLI" />
      <p style={S.p}>
        You can also authorize directly from the terminal — useful for testing
        policies before wiring them into agent code.
      </p>
      <CodeBlock
        lang="bash"
        code={`shotoku authorize \\
  --actor agent-001 \\
  --action api_call \\
  --resource api.openai.com \\
  --amount 0.04`}
      />
      <CodeBlock
        lang="bash"
        code={`✓ Approved  dec_abc123
  • api.openai.com is allowlisted
  • Daily budget remaining: $49.96
  • Transaction below $5.00 limit
  Recorded at 14:05:22`}
      />

      <Step title="Handle pending approvals" />
      <p style={S.p}>
        When an agent tries to reach a resource not on your allowlist, Shotoku
        records it as <InlineCode>pending_approval</InlineCode> and waits for a
        human decision.
      </p>
      <CodeBlock lang="bash" code={`shotoku status`} />

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
          <span style={{ color: "#92400e", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em" }}>
            <span style={{ display: "inline-flex", flexShrink: 0, lineHeight: 1 }}>
              <DotmSquare11 size={14} dotSize={1.5} animated speed={1.4} color="#92400e" />
            </span>
            <span>{"Pending Approval  dec_ghi789"}</span>
          </span>
          <span style={{ display: "block", color: "#0F0D0C" }}>{"  • vendor-xyz.com is not on the allowlist"}</span>
          <span style={{ display: "block", color: "#0F0D0C" }}>{"  • A human must approve this decision"}</span>
          <span style={{ display: "block", color: "#0F0D0C" }}>{"  → Run: shotoku approve dec_ghi789"}</span>
        </pre>
      </div>
      <CodeBlock
        lang="bash"
        code={`shotoku approve dec_ghi789
# → ✓ Approved. Recorded as apr_xxx.

shotoku deny dec_ghi789
# → ✗ Denied. Recorded as den_xxx.`}
      />

      <Step title="Quick links" />
      <div style={S.nextGrid}>
        {[
          { href: "/docs/api",       label: "API reference", desc: "authorize(), types, and the full request/response shape"   },
          { href: "/docs/cli",       label: "CLI reference", desc: "Every command, flag, and exit code"                        },
          { href: "/docs/policies",  label: "Policies",      desc: "Policy YAML format, rules, limits, and wildcards"          },
          { href: "/docs/mcp",       label: "MCP server",    desc: "Connect Shotoku to Claude, Cursor, and any MCP client"     },
          { href: "/docs/x402",      label: "x402",          desc: "Authorize HTTP 402 payment intents before they execute"    },
          { href: "/docs/tui",       label: "TUI",           desc: "Interactive terminal UI for reviewing pending approvals"    },
          { href: "/docs/snapshots", label: "Snapshots",     desc: "Sign and verify your policy and ledger state"              },
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
