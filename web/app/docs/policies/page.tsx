import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";

const S = {
  page:    { padding: "48px 64px 96px" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 8, lineHeight: 1.2 } as React.CSSProperties,
  lead:    { fontSize: 15, color: "rgba(0,0,0,0.5)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 48, lineHeight: 1.6 } as React.CSSProperties,
  h2:      { fontSize: 18, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 52, marginBottom: 12, letterSpacing: "-0.015em" } as React.CSSProperties,
  h3:      { fontSize: 14.5, fontWeight: 600, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 32, marginBottom: 8 } as React.CSSProperties,
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

export default function PoliciesPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Policies</h1>
      <p style={S.lead}>
        A policy file is your authorization rulebook. It lives on your machine,
        it is human-readable, and every authorization decision is evaluated against it locally.
      </p>

      {/* How policies work */}
      <h2 style={S.h2}>How policies work</h2>
      <p style={S.p}>
        When <InlineCode>authorize()</InlineCode> runs, it reads your <InlineCode>policy.yaml</InlineCode> file
        and evaluates the incoming request against the rules top-to-bottom. The first rule that matches wins.
        If nothing matches, the <InlineCode>defaultVerdict</InlineCode> applies — and if you omit it, it
        defaults to <InlineCode>pending_approval</InlineCode>.
      </p>
      <p style={S.p}>
        Shotoku fails closed. If the policy file is missing, malformed, or contains unknown fields, the
        request is denied. Unknown fields are rejected instead of silently ignored, because a typo in an
        authorization policy should not weaken it.
      </p>

      {/* Full example */}
      <h2 style={S.h2}>Example policy</h2>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`version: 1
defaultVerdict: pending_approval

rules:
  # Known AI APIs: approve up to budget
  - resource: "api.openai.com"
    actions: ["api_call"]
    verdict: approved
    maxAmount: 5.00
    maxDailyAmount: 50.00

  - resource: "api.anthropic.com"
    actions: ["api_call"]
    verdict: approved
    maxAmount: 2.00
    maxDailyAmount: 20.00

  # Payments require human approval
  - resource: "stripe.com"
    actions: ["purchase"]
    verdict: pending_approval

  # Block all other spending
  - resource: "*"
    actions: ["purchase"]
    verdict: denied`}
      />

      <hr style={S.divider} />

      {/* Top-level fields */}
      <h2 style={S.h2}>Top-level fields</h2>
      <Table
        headers={["Field", "Type", "What it does"]}
        rows={[
          ["version",        "number",           "Policy format version. Currently 1."],
          ["defaultVerdict", "AuthorizationStatus", <>What happens when no rule matches. Defaults to <InlineCode>pending_approval</InlineCode> if omitted.</>],
          ["rules",          "PolicyRule[]",     "The ordered list of rules. Evaluated top-to-bottom — the first match wins."],
        ]}
      />

      <hr style={S.divider} />

      {/* Rule fields */}
      <h2 style={S.h2}>Rule fields</h2>
      <p style={S.p}>Each entry in the <InlineCode>rules</InlineCode> array is a <InlineCode>PolicyRule</InlineCode>:</p>
      <Table
        headers={["Field", "Type", "What it does"]}
        rows={[
          ["resource",       "string",             <>The domain or service this rule applies to. Use <InlineCode>&quot;*&quot;</InlineCode> to match anything not matched by an earlier rule.</>],
          ["actions",        "AgentAction[]",      <>Optional. Limits this rule to specific action types. Omit to match all actions.</>],
          ["rails",          "ExecutionRail[]",    <>Optional. Limits this rule to specific execution rails (<InlineCode>x402</InlineCode>, <InlineCode>mcp</InlineCode>, etc.). Omit to match all rails.</>],
          ["verdict",        "AuthorizationStatus", <>The outcome when this rule matches: <InlineCode>approved</InlineCode>, <InlineCode>denied</InlineCode>, or <InlineCode>pending_approval</InlineCode>.</>],
          ["maxAmount",      "number",             "Optional. Maximum allowed spend per single transaction in USD. Exceeding this denies the request even if the rule would otherwise approve it."],
          ["maxDailyAmount", "number",             "Optional. Maximum total spend for this resource in a rolling 24-hour window in USD. Exceeding this denies the request."],
        ]}
      />

      <hr style={S.divider} />

      {/* Wildcard rules */}
      <h2 style={S.h2}>Wildcard rules</h2>
      <p style={S.p}>
        A <InlineCode>resource: &quot;*&quot;</InlineCode> rule matches any request that was not matched
        by an earlier rule. Use it to define a catch-all policy at the bottom of your file.
      </p>
      <CodeBlock
        lang="yaml"
        code={`# Deny all purchases not covered above
- resource: "*"
  actions: ["purchase"]
  verdict: denied

# Send everything else for human review
- resource: "*"
  verdict: pending_approval`}
      />
      <p style={S.p}>
        Rules are evaluated in order. A wildcard at position 3 only catches requests that
        did not match rules 1 and 2. Order matters.
      </p>

      <hr style={S.divider} />

      {/* Daily limits */}
      <h2 style={S.h2}>Daily limits</h2>
      <p style={S.p}>
        <InlineCode>maxDailyAmount</InlineCode> is evaluated against a rolling 24-hour window, not a
        calendar day. Shotoku reads the local ledger to compute how much has been spent for the
        given actor and resource combination in the past 24 hours, then checks whether this
        request would push it over the cap.
      </p>
      <p style={S.p}>
        The daily total is keyed as <InlineCode>actor|resource</InlineCode>. Two different actors
        spending against the same resource do not share a budget — each actor has its own counter.
      </p>
      <CodeBlock
        lang="yaml"
        code={`- resource: "api.openai.com"
  actions: ["api_call"]
  verdict: approved
  maxAmount: 5.00        # no single call costs more than $5
  maxDailyAmount: 50.00  # total spend per actor per 24h`}
      />

      <hr style={S.divider} />

      {/* Rail-specific rules */}
      <h2 style={S.h2}>Rail-specific rules</h2>
      <p style={S.p}>
        You can write rules that only apply when an action is taken through a specific execution
        rail. For example, to require approval for all x402 payments regardless of resource:
      </p>
      <CodeBlock
        lang="yaml"
        code={`- resource: "*"
  rails: ["x402"]
  actions: ["purchase"]
  verdict: pending_approval`}
      />

      <hr style={S.divider} />

      {/* Policy for x402 */}
      <h2 style={S.h2}>x402 policy example</h2>
      <p style={S.p}>
        If you are using the x402 payment rail, the agent passes <InlineCode>rail: &quot;x402&quot;</InlineCode>
        and <InlineCode>action: &quot;purchase&quot;</InlineCode> with the payment amount. Your policy
        can match specifically on these:
      </p>
      <CodeBlock
        lang="yaml"
        filename="policy-x402.yaml"
        code={`version: 1
defaultVerdict: pending_approval

rules:
  # Trust low-cost data endpoints
  - resource: "api.datavendor.com"
    actions: ["purchase"]
    rails: ["x402"]
    verdict: approved
    maxAmount: 0.10
    maxDailyAmount: 5.00

  # Anything more expensive needs a human
  - resource: "*"
    actions: ["purchase"]
    rails: ["x402"]
    verdict: pending_approval`}
      />
    </div>
  );
}
