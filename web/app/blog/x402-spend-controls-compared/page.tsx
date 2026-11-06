import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";
import { PostLayout, Table, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("x402-spend-controls-compared");

export const metadata = postMetadata(post);

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={S.a}>{children}</a>;
}

export default function X402SpendControlsCompared() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Short answer:</strong> x402 defines how an agent pays for a request. A budget that
        spans many requests has to come from something else, and the check has to run after the
        402 response and before the agent signs. Four tools do this in different ways:
      </p>
      <ul style={S.ul}>
        <li style={S.li}><strong>x402-cfo</strong> if you want a drop-in client with hourly, daily and session budgets, analytics and anomaly detection.</li>
        <li style={S.li}><strong>AgentPay MCP</strong> if you want the wallet and the payment tools in one MCP server, with optional limits on-chain.</li>
        <li style={S.li}><strong>Shotoku</strong> if you want a deterministic local policy, human approval and a tamper-evident record, in a tool that never touches your keys.</li>
        <li style={S.li}><strong>PolicyLayer</strong> needs a check first. Its x402 SDK was last published in January 2026, and its website now describes a different product.</li>
      </ul>

      <div style={S.note}>
        <strong>How we did this.</strong> We build Shotoku, so read this with that in mind. We
        reviewed each project&rsquo;s npm README on November 6, 2026 and ran Shotoku&rsquo;s own
        example. We did not run the other three tools, so their columns describe what their
        documentation says, not behavior we tested.
      </div>

      <h2 style={S.h2}>How do the four tools compare?</h2>
      <Table
        minWidth={680}
        headers={["", "Shotoku", "AgentPay MCP", "x402-cfo", "PolicyLayer SDK"]}
        rows={[
          ["What it is", "Policy engine and ledger. Authorizes payments, never makes them.", "MCP server with wallet and payment tools", "Client library around your x402 wallet", "SDK around your wallet, with decisions from a hosted API"],
          ["Version reviewed", "main branch (npm: @shotoku/core 0.2.2)", "4.3.0", "0.5.0", "1.4.0"],
          ["Last npm release", "August 2026", "October 2026", "March 2026", "January 2026"],
          ["License", "MIT", "MIT", "MIT, with paid hosted dashboard tiers", "MIT SDK. Needs a PolicyLayer API key."],
          ["Signing key", "Never sees it", "Loaded into the server process", "Stays in the wallet you pass in", "Stays on your server, per its README"],
          ["Where the decision runs", "Your machine", "Your machine, in the server process", "Your machine, in your process", "api.policylayer.com"],
          ["Spend limits", "Per payment, per rule per day, per agent per day", "Spend policy in the process, plus optional on-chain limits", "Per request, hourly, daily, session", "Set in PolicyLayer, plus optional client-side limits"],
          ["Recipient rules", "Pin allowed payTo addresses per rule", "Not covered in the README", "Host allowlist and blocklist", "Allowed and blocked recipients"],
          ["Human approval", "Built in: terminal, local dashboard, Telegram", "Approval queue. A real gate only if the owner key is separate from the agent key.", "None documented. Anomaly detection has a review mode.", "None documented in the SDK README"],
          ["Payment record", "Hash-chained JSONL, checked against signed snapshots", "On-chain wallet events. x402 receipts are in memory, capped at 256.", "Ledger with JSON and CSV export", "None documented in the SDK README"],
          ["After a restart", "Ledger and budgets persist", "Rolling policy state is cleared", "Persists with JsonFileStorage", "Held by the service"],
          ["x402 integration", "You call authorize, then sign", "x402_pay tool", "agent.fetch() replaces fetch", "x402Client.pay()"],
        ]}
      />

      <h2 style={S.h2}>Where should an x402 budget check run?</h2>
      <p style={S.p}>
        Between the 402 response and the signature. Before the 402, there is no amount to check.
        After the signature, the payment can settle. That gap is the only point where the agent
        knows the full cost and nothing irreversible has happened. All four tools work there. What
        differs is who can override the check and what is left afterward.
      </p>

      <h2 style={S.h2}>What should you check in any x402 spend control?</h2>
      <ol style={S.ol}>
        <li style={S.li}>
          <strong>Can the agent change its own limit?</strong> AgentPay&rsquo;s README is direct about
          this: the same agent can call <InlineCode>set_spend_policy</InlineCode> again. Its on-chain
          limits avoid that, but only if the wallet owner sets them on the contract.
        </li>
        <li style={S.li}>
          <strong>Does spending history survive a restart?</strong> If rolling totals live in memory,
          a restart resets the budget. AgentPay documents this. x402-cfo fixes it with a storage
          adapter, so make sure you configure one.
        </li>
        <li style={S.li}>
          <strong>Is the human gate separate from the agent?</strong> An approval the agent can grant
          itself is not an approval. Check where the approval key or command lives.
        </li>
        <li style={S.li}>
          <strong>Does it trust the 402 body?</strong> The server asking to be paid writes that
          response. A hostile server can name an allowlisted vendor as the resource and put its own
          address in <InlineCode>payTo</InlineCode>. Ask which fields come from the server and which
          come from your own request.
        </li>
        <li style={S.li}>
          <strong>Can you prove the log later?</strong> A plain log can be edited without trace. A hash
          chain breaks if a past entry changes.
        </li>
      </ol>

      <h2 style={S.h2}>What does this look like in Shotoku?</h2>
      <p style={S.p}>
        This policy allows small payments to one API at one address, caps every agent at $5 a day,
        and sends everything else to a human:
      </p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`rules:
  - resource: api.weather.xyz
    recipients: ["0x000000000000000000000000000000000000dEaD"]
    actions: [purchase]
    verdict: approved
    maxAmount: 0.10
    maxDailyAmount: 1.00

defaultVerdict: pending_approval

budgets:
  - actor: "*"
    maxDailyAmount: 5.00`}
      />
      <p style={S.p}>The check goes between the 402 and your signing code:</p>
      <CodeBlock
        lang="typescript"
        filename="pay.ts"
        code={`import { authorizeX402Payment, parseX402Response } from "@shotoku/core";

const requirements = parseX402Response(body, { requestUrl: url });
const decision = await authorizeX402Payment("agent-1", requirements, {
  policyPath: "./policy.yaml",
  ledgerPath: "./data/decisions.jsonl",
});

if (decision.approved) {
  return signPayment(requirements.option); // your wallet signs, not Shotoku
}
throw new Error(\`Payment blocked: \${decision.status} [\${decision.decisionId}]\`);`}
      />
      <p style={S.p}>We ran this policy against five simulated 402 responses, using USDC on Base:</p>
      <Table
        headers={["402 response", "Result"]}
        rows={[
          ["$0.05 from the allowed host to the allowed address", "approved"],
          ["$0.50 from the allowed host", "denied: over the $0.10 limit"],
          ["$0.05 from the allowed host to a different address", "pending_approval"],
          ["$0.05 from an unknown host", "pending_approval"],
          ["Unknown host claiming to be the allowed API", "rejected before evaluation: resource and request host differ"],
        ]}
      />

      <h2 style={S.h2}>Where does Shotoku fall short?</h2>
      <ul style={S.ul}>
        <li style={S.li}>
          <strong>It isn&rsquo;t drop-in for x402.</strong> You add the call yourself. x402-cfo wraps{" "}
          <InlineCode>fetch</InlineCode>, and AgentPay gives the agent an <InlineCode>x402_pay</InlineCode> tool.
        </li>
        <li style={S.li}>
          <strong>Code that skips the check isn&rsquo;t stopped.</strong> Shotoku holds no key, so if your
          agent can sign directly, it can pay without asking. To close that route, keep the key behind
          a service that verifies Shotoku&rsquo;s signed receipts. AgentPay&rsquo;s on-chain limits are
          stronger here, because the contract enforces them whatever the process does.
        </li>
        <li style={S.li}>
          <strong>No analytics or anomaly detection.</strong> Rules are deterministic by design. If you
          want burn rate, cost estimates or statistical anomaly blocking, x402-cfo has them.
        </li>
        <li style={S.li}>
          <strong>Budgets are daily only.</strong> There are no hourly or session windows yet.
        </li>
        <li style={S.li}>
          <strong>Only USDC on Base works by default.</strong> Other assets must be registered. Unknown
          tokens are refused.
        </li>
        <li style={S.li}>
          <strong>It&rsquo;s beta, and npm is behind main.</strong> Recipient rules, agent budgets, the
          request-host check above and the local dashboard and Telegram approvals are in the repo but
          not in the current npm release. The table describes main.
        </li>
      </ul>

      <h2 style={S.h2}>Which x402 spend control should you use?</h2>
      <Table
        headers={["If you need", "Use"]}
        rows={[
          ["The fastest setup, with budgets and analytics", "x402-cfo"],
          ["An agent wallet and payments in one MCP server", "AgentPay MCP"],
          ["Limits a compromised process can't change", "AgentPay MCP with on-chain limits and a separate owner key"],
          ["Human approval for anything outside policy", "Shotoku"],
          ["A record you can verify later", "Shotoku"],
          ["The same policy across x402, PayPal and MCP tools", "Shotoku"],
          ["No signing key in the tool that decides", "Shotoku or x402-cfo"],
        ]}
      />
      <p style={S.p}>
        These aren&rsquo;t all exclusive. On-chain limits work as a hard ceiling underneath a local
        policy that decides each payment.
      </p>

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>Can a prompt enforce an x402 budget?</h3>
      <p style={S.p}>
        No. A prompt is an instruction the model can misread or ignore, and a prompt injection can
        override it. A budget has to be enforced by code outside the model.
      </p>
      <h3 style={S.h3}>Does a spend control need to hold my private key?</h3>
      <p style={S.p}>
        No. A decision only needs the amount, the recipient and the resource. Shotoku and x402-cfo
        leave signing to your wallet, and PolicyLayer says keys stay on your server. AgentPay loads
        the key because it is also the wallet.
      </p>
      <h3 style={S.h3}>What about AWS, Visa and Mastercard?</h3>
      <p style={S.p}>
        Platforms such as Amazon Bedrock AgentCore Payments are adding agent payments with their own
        limits. We left them out because this post covers tools you can add to an x402 client
        yourself.
      </p>

      <h2 style={S.h2}>Try it</h2>
      <p style={S.p}>
        Read the <Link href="/docs/x402" style={S.a}>x402 guide</Link> or start with the{" "}
        <Link href="/docs/quickstart" style={S.a}>quickstart</Link>. Shotoku is open source, deterministic,
        holds no funds and runs on your machine.
      </p>

      <h2 style={S.h2}>Sources</h2>
      <ul style={S.ul}>
        <li style={S.li}><Ext href="https://www.npmjs.com/package/agentpay-mcp">agentpay-mcp on npm</Ext> and <Ext href="https://github.com/up2itnow0822/agentpay-mcp">GitHub</Ext></li>
        <li style={S.li}><Ext href="https://www.npmjs.com/package/x402-cfo">x402-cfo on npm</Ext> and <Ext href="https://github.com/Upn-130guthub/x402-cfo">GitHub</Ext></li>
        <li style={S.li}><Ext href="https://www.npmjs.com/package/@policylayer/sdk">@policylayer/sdk on npm</Ext> and <Ext href="https://policylayer.com">policylayer.com</Ext></li>
        <li style={S.li}><Ext href="https://github.com/shotoku-dev/shotoku">Shotoku on GitHub</Ext></li>
        <li style={S.li}><Ext href="https://www.x402.org/">x402.org</Ext></li>
      </ul>
    </PostLayout>
  );
}
