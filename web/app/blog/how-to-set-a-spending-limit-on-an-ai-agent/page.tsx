import Link from "next/link";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { PostLayout, Table, Ext, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("how-to-set-a-spending-limit-on-an-ai-agent");

export const metadata = postMetadata(post);

export default function SpendingLimitPost() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Short answer:</strong> check the budget in code before every paid call, and refuse the
        call when it would go over. Use two limits: a cap per call for one expensive request, and a
        rolling daily cap for loops of cheap ones. Billing alerts and instructions in a prompt don&rsquo;t
        do this, because neither one blocks the next call.
      </p>

      <h2 style={S.h2}>Why don&rsquo;t alerts and prompts stop overspending?</h2>
      <Table
        headers={["Method", "Blocks the next call?", "The problem"]}
        rows={[
          ["Rule in the prompt", "No", "The model can misread it, ignore it or be talked out of it"],
          ["Billing alert", "No", "It tells you after the money is spent"],
          ["Provider spend cap", "Sometimes", "Coverage varies by provider, and it usually applies to a whole project, not one agent"],
          ["Check in code before the call", "Yes", "You have to route every paid call through it"],
        ]}
      />
      <p style={S.p}>
        Even a budget setting may only be an alert. <Ext href="https://docs.github.com/en/copilot/tutorials/budgets/getting-started-with-budget-controls">GitHub&rsquo;s Copilot budgets</Ext>,
        for example, stop usage only if you turn that option on.
      </p>
      <p style={S.p}>
        A loop of small calls is the case to plan for. Each call looks harmless, so a per-call cap never
        fires. One widely repeated story describes agents looping for 11 days and running up a $47,000
        bill. We couldn&rsquo;t trace it to a primary source, but the failure it describes is real: no
        limit sat in front of the next call.
      </p>

      <h2 style={S.h2}>How do you add a hard limit?</h2>
      <p style={S.p}>Install Shotoku and create a policy:</p>
      <CodeBlock lang="bash" code={`npm install -g shotoku-cli
npm install @shotoku/core
shotoku init`} />
      <p style={S.p}>
        Set a limit per call and per day for each vendor. Anything you haven&rsquo;t listed waits for a human:
      </p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`rules:
  - resource: api.openai.com
    actions: [api_call]
    verdict: approved
    maxAmount: 2
    maxDailyAmount: 10

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>Then check before each paid call:</p>
      <CodeBlock
        lang="typescript"
        filename="agent.ts"
        code={`import { authorize } from "@shotoku/core";

const decision = await authorize(
  {
    actor: "research-agent",
    action: "api_call",
    resource: "api.openai.com",
    amount: estimatedCost,
  },
  { policyPath: "./policy.yaml", ledgerPath: "./data/decisions.jsonl" },
);

if (!decision.approved) {
  throw new Error(\`Blocked: \${decision.status} [\${decision.decisionId}]\`);
}

await callTheApi();`}
      />

      <h2 style={S.h2}>What happens when an agent hits the limit?</h2>
      <p style={S.p}>
        We ran this policy on the current npm release, with an agent looping on $1.50 calls:
      </p>
      <Table
        headers={["Request", "Result"]}
        rows={[
          ["Six calls at $1.50", "approved, $9 spent"],
          ["Seventh call at $1.50", "denied: $10.50 would exceed the $10 daily limit"],
          ["One call at $3", "denied: over the $2 limit"],
          ["$0.10 to a vendor not in the policy", "pending_approval: waits for a human"],
          ["Any call with the policy file missing", "denied"],
        ]}
      />
      <p style={S.p}>
        The last row matters most. If something goes wrong with the policy, the agent is refused rather
        than waved through. The check is deterministic too: the same request, policy and history always
        give the same answer, with no model involved.
      </p>

      <h2 style={S.h2}>What are the limits of this approach?</h2>
      <ul style={S.ul}>
        <li style={S.li}><strong>You supply the amount.</strong> Shotoku doesn&rsquo;t meter tokens or read invoices. Pass a realistic upper bound for each call, because a low estimate means a low count.</li>
        <li style={S.li}><strong>Only checked calls count.</strong> If code can reach the API without the check, the budget can&rsquo;t see it. For MCP tools, <Link href="/blog/require-human-approval-mcp-tool-calls" style={S.a}>wrapping the server</Link> closes that route.</li>
        <li style={S.li}><strong>Daily limits here are per rule.</strong> A single daily budget per agent across all vendors is in the repo but not yet in the npm release.</li>
      </ul>

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>What should a daily limit be set to?</h3>
      <p style={S.p}>
        Start from what a normal day costs and leave some headroom. Too tight and a good run gets
        blocked. Too loose and a loop runs for longer. Check your history after a week and adjust.
      </p>
      <h3 style={S.h3}>Should an over-limit call fail or wait for a human?</h3>
      <p style={S.p}>
        For a background agent, failing is usually right, because nobody is there to answer. If a person
        is available and the work matters, route it for approval instead. See{" "}
        <Link href="/blog/ai-support-agent-refund-limits" style={S.a}>the refund example</Link>.
      </p>
      <h3 style={S.h3}>Does this send my spending data anywhere?</h3>
      <p style={S.p}>
        No. The policy and the decision record are local files, and Shotoku holds no funds or keys. It
        makes the decision and your code makes the payment.
      </p>

      <p style={S.p}>
        Next, try the <Link href="/docs/quickstart" style={S.a}>quickstart</Link> or read the{" "}
        <Link href="/docs/policies" style={S.a}>policy reference</Link>.
      </p>
    </PostLayout>
  );
}
