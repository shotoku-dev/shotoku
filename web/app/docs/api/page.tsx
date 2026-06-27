import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";

const S = {
  page: { padding: "48px 64px 96px" } as React.CSSProperties,
  h1:   { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 8, lineHeight: 1.2 } as React.CSSProperties,
  lead: { fontSize: 15, color: "rgba(0,0,0,0.5)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 48, lineHeight: 1.6 } as React.CSSProperties,
  h2:   { fontSize: 18, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 52, marginBottom: 12, letterSpacing: "-0.015em" } as React.CSSProperties,
  h3:   { fontSize: 14, fontWeight: 600, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 28, marginBottom: 8 } as React.CSSProperties,
  p:    { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 14 } as React.CSSProperties,
  ul:   { margin: "8px 0 14px", paddingLeft: 20 } as React.CSSProperties,
  li:   { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 2 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "44px 0" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13.5, marginBottom: 20 },
  th:    { textAlign: "left" as const, padding: "8px 12px", fontFamily: "Satoshi, var(--font-geist), sans-serif", fontWeight: 500, color: "rgba(0,0,0,0.38)", fontSize: 11, borderBottom: "1px solid rgba(0,0,0,0.08)", letterSpacing: "0.04em", textTransform: "uppercase" as const } as React.CSSProperties,
  td:    { padding: "10px 12px", color: "rgba(0,0,0,0.62)", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, lineHeight: 1.55, fontFamily: "var(--font-geist), sans-serif", fontSize: 13.5 } as React.CSSProperties,
  tdKey: { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5, color: "#0A0A0A", fontWeight: 500 } as React.CSSProperties,
};

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <table style={S.table}>
      <thead>
        <tr>{headers.map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={j === 0 ? S.tdKey : S.td}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ApiPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>API reference</h1>
      <p style={S.lead}>
        The core <InlineCode>authorize()</InlineCode> function and the types it uses.
        Everything an agent needs to check whether an action is allowed before it runs.
      </p>

      <p style={{ ...S.p, marginBottom: 24 }}>
        Plain-English model: a <strong>request</strong> is what the agent wants to do.
        A <strong>policy</strong> is your local checklist for what is allowed.
        A <strong>decision</strong> is Shotoku&rsquo;s answer — approved, denied, or pending.
        The <strong>ledger</strong> is the append-only local audit log.
      </p>

      {/* authorize() */}
      <h2 style={S.h2}><InlineCode>authorize(request, options)</InlineCode></h2>
      <p style={S.p}>
        The main function. Describe what the agent wants to do, point it at your policy
        file and ledger, and it returns a decision.
      </p>
      <CodeBlock
        lang="typescript"
        code={`import { authorize } from "@shotoku/core";

const response = await authorize(
  {
    actor:    "agent-001",
    action:   "api_call",
    resource: "api.openai.com",
    amount:   0.02,
  },
  {
    policyPath: "./policy.yaml",
    ledgerPath: "./data/decisions.jsonl",
  },
);`}
      />
      <p style={S.p}>Under the hood it:</p>
      <ol style={{ ...S.ul, listStyleType: "decimal" }}>
        {["Loads your policy file", "Reads rolling 24-hour spend totals from the ledger", "Evaluates the request against your rules", "Writes the decision to the ledger", "Returns the result"].map((s, i) => (
          <li key={i} style={S.li}>{s}</li>
        ))}
      </ol>
      <p style={S.p}>
        Shotoku fails closed. If the request is malformed, the policy file is missing or
        invalid, or the ledger is corrupt, Shotoku does not approve the action.
      </p>

      <h3 style={S.h3}>Options</h3>
      <Table
        headers={["Field", "Required", "What it does"]}
        rows={[
          ["policyPath", "yes", "Path to your policy.yaml rules file"],
          ["ledgerPath",  "yes", "Path to the local file where decisions are stored"],
        ]}
      />

      <hr style={S.divider} />

      {/* AuthorizeRequest */}
      <h2 style={S.h2}><InlineCode>AuthorizeRequest</InlineCode></h2>
      <p style={S.p}>Describes the action an agent wants to take.</p>
      <CodeBlock
        lang="typescript"
        code={`interface AuthorizeRequest {
  readonly actor:    string;
  readonly action:   AgentAction;
  readonly resource: string;
  readonly rail?:    ExecutionRail;
  readonly amount?:  number;
  readonly context?: Record<string, unknown>;
}`}
      />
      <Table
        headers={["Field", "What it means"]}
        rows={[
          ["actor",    "Who is requesting the action — a name or ID for your agent"],
          ["action",   <>The category of action being requested — see <InlineCode>AgentAction</InlineCode> below</>],
          ["resource", "What the agent is acting on — a domain, API endpoint, or service name"],
          ["rail",     <>Optional: the execution channel (<InlineCode>x402</InlineCode>, <InlineCode>mcp</InlineCode>, <InlineCode>api</InlineCode>, etc.)</>],
          ["amount",   "Optional: how much this action costs in USD, if it involves spending"],
          ["context",  "Optional: extra details recorded alongside the decision (must be JSON-serializable)"],
        ]}
      />

      <hr style={S.divider} />

      {/* AuthorizeResponse */}
      <h2 style={S.h2}><InlineCode>AuthorizeResponse</InlineCode></h2>
      <p style={S.p}>What <InlineCode>authorize()</InlineCode> gives back.</p>
      <CodeBlock
        lang="typescript"
        code={`interface AuthorizeResponse {
  readonly approved:    boolean;
  readonly status:      AuthorizationStatus;
  readonly reasons:     readonly ReasonItem[];
  readonly explanation: Explanation;
  readonly decisionId:  string;
  readonly timestamp:   string;
}`}
      />
      <Table
        headers={["Field", "What it means"]}
        rows={[
          ["approved",    <>true if the action can proceed, false otherwise</>],
          ["status",      <>The full verdict — see <InlineCode>AuthorizationStatus</InlineCode> below</>],
          ["reasons",     "A list of specific checks that were run and what they found"],
          ["explanation", "A plain-English summary of the decision, ready to show to a user"],
          ["decisionId",  <>A unique ID for this decision, e.g. <InlineCode>dec_abc123</InlineCode></>],
          ["timestamp",   "When the decision was made, in ISO 8601 format"],
        ]}
      />

      <hr style={S.divider} />

      {/* AuthorizationStatus */}
      <h2 style={S.h2}><InlineCode>AuthorizationStatus</InlineCode></h2>
      <p style={S.p}>The three possible outcomes of an authorization check.</p>
      <CodeBlock
        lang="typescript"
        code={`type AuthorizationStatus = "approved" | "denied" | "pending_approval";`}
      />
      <Table
        headers={["Value", "What it means"]}
        rows={[
          ["approved",         "The request passed all policy checks. The agent can proceed."],
          ["denied",           "The request was blocked by a policy rule. The agent should stop."],
          ["pending_approval", <>No rule automatically decided this. A human must run <InlineCode>shotoku approve</InlineCode> or <InlineCode>shotoku deny</InlineCode>.</>],
        ]}
      />

      <hr style={S.divider} />

      {/* AgentAction */}
      <h2 style={S.h2}><InlineCode>AgentAction</InlineCode></h2>
      <p style={S.p}>The type of thing an agent wants to do.</p>
      <CodeBlock
        lang="typescript"
        code={`type AgentAction =
  | "purchase"
  | "api_call"
  | "execute_code"
  | "send_email"
  | "mcp_tool"
  | "custom";`}
      />
      <p style={S.p}>
        Use <InlineCode>custom</InlineCode> for anything that does not fit the other categories.
      </p>

      <hr style={S.divider} />

      {/* ExecutionRail */}
      <h2 style={S.h2}><InlineCode>ExecutionRail</InlineCode></h2>
      <p style={S.p}>
        The channel through which an action would be executed. Optional — include it when
        you want to write rules that apply to a specific channel only.
      </p>
      <CodeBlock
        lang="typescript"
        code={`type ExecutionRail = "x402" | "mcp" | "api" | "code" | "custom";`}
      />

      <hr style={S.divider} />

      {/* ReasonItem */}
      <h2 style={S.h2}><InlineCode>ReasonItem</InlineCode></h2>
      <p style={S.p}>
        One specific check that ran during policy evaluation. A decision always includes
        one or more of these.
      </p>
      <CodeBlock
        lang="typescript"
        code={`interface ReasonItem {
  readonly type:
    | "policy_match"
    | "budget_check"
    | "limit_check"
    | "blocked"
    | "escalated";
  readonly text: string;
}`}
      />
      <Table
        headers={["Type", "What triggered it"]}
        rows={[
          ["policy_match", "A rule in your policy file matched this request"],
          ["limit_check",  "The amount was checked against a per-transaction cap"],
          ["budget_check", "The rolling 24-hour spend total was checked against a daily cap"],
          ["blocked",      "The request was explicitly blocked — e.g. no policy file found"],
          ["escalated",    "The request was sent for human review"],
        ]}
      />

      <hr style={S.divider} />

      {/* LedgerEntry */}
      <h2 style={S.h2}><InlineCode>LedgerEntry</InlineCode></h2>
      <p style={S.p}>
        One recorded decision. Stored as a single line in <InlineCode>decisions.jsonl</InlineCode> — one
        JSON object per line, append-only. Each line is a self-contained record of one decision.
        You can inspect the file directly in any text editor.
      </p>
      <CodeBlock
        lang="typescript"
        code={`interface LedgerEntry {
  readonly decisionId: string;
  readonly timestamp:  string;
  readonly request:    AuthorizeRequest;
  readonly response:   AuthorizeResponse;
}`}
      />
      <p style={S.p}>
        Every new ledger record includes an <InlineCode>integrity</InlineCode> object that links
        it to the previous ledger hash:
      </p>
      <CodeBlock
        lang="typescript"
        code={`interface LedgerIntegrity {
  readonly version:      1;
  readonly sequence:     number;
  readonly previousHash: string;
  readonly hash:         string;
}`}
      />
      <p style={S.p}>
        If a ledger line is malformed, Shotoku reports the ledger as corrupt instead of skipping
        the bad line. Skipping would make budgets and approval state hard to trust.
      </p>

      <hr style={S.divider} />

      {/* Signed Snapshots */}
      <h2 style={S.h2}>Signed snapshots</h2>
      <p style={S.p}>
        A signed snapshot records the hash of the policy file, the current ledger head hash,
        and a keyed signature over those fields. Use snapshots when you want to prove later
        that the policy and ledger head have not changed since a point in time.
      </p>
      <CodeBlock
        lang="typescript"
        code={`import { createSignedSnapshot, verifySignedSnapshot } from "@shotoku/core";

const snapshot = await createSignedSnapshot({
  policyPath: "./policy.yaml",
  ledgerPath: "./data/decisions.jsonl",
  secret:     process.env.SHOTOKU_SNAPSHOT_SECRET!,
});

const result = await verifySignedSnapshot(snapshot, {
  secret: process.env.SHOTOKU_SNAPSHOT_SECRET!,
});`}
      />
      <p style={S.p}>
        Shotoku uses HMAC-SHA256 for local snapshots. It does not create, store, or manage
        signing keys — the secret comes from the caller.
      </p>
    </div>
  );
}
