import Link from "next/link";
import { PostLayout, Table, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("what-are-spend-controls-for-ai-agents");

export const metadata = postMetadata(post);

export default function DefinitionPost() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Spend controls for AI agents</strong> are rules, enforced outside the model, that decide
        whether an agent may spend money before the spending happens. They limit how much an agent can
        spend, who it can pay and when a human must step in, and they keep a record of each decision.
      </p>

      <h2 style={S.h2}>Why do AI agents need spend controls?</h2>
      <p style={S.p}>
        Agents now call paid APIs, buy services and issue refunds without a person clicking anything. Normal
        software spends in predictable ways, but an agent chooses its actions at run time. It can loop, follow
        a bad instruction or misjudge a task, and it can do that many times a minute.
      </p>

      <h2 style={S.h2}>What are the five core controls?</h2>
      <Table
        headers={["Control", "What it does", "What it catches"]}
        rows={[
          ["Per-transaction limit", "Caps one payment or call", "A single expensive mistake"],
          ["Rolling budget", "Caps the total over a period", "Loops of small charges"],
          ["Allowlist", "Limits who can be paid", "Unknown vendors and redirected payments"],
          ["Human approval", "Holds anything outside the rules", "Cases the policy can't decide"],
          ["Audit trail", "Records every decision and why", "Disputes and questions after the fact"],
        ]}
      />
      <p style={S.p}>
        You usually need several together. A per-transaction limit can&rsquo;t see a loop, and a budget
        can&rsquo;t see a bad vendor.
      </p>

      <h2 style={S.h2}>Where should spend controls run?</h2>
      <p style={S.p}>
        Outside the model, and before the money moves. A limit the model is merely asked to respect is a
        suggestion. The check needs to run in code that sits between the agent and the payment, so the
        agent&rsquo;s reasoning doesn&rsquo;t decide whether the check happens.
      </p>
      <p style={S.p}>
        The decision should also be predictable. If the same request can get different answers, you
        can&rsquo;t test your policy or explain a result. That&rsquo;s why rule-based checks fit this job better
        than asking a second model.
      </p>

      <h2 style={S.h2}>How do spend controls differ from similar tools?</h2>
      <Table
        headers={["Tool", "What it does", "How it differs"]}
        rows={[
          ["Prompt instructions", "Asks the model to behave", "Not enforced"],
          ["Billing alerts", "Report spending", "Act after the money is spent"],
          ["Provider caps", "Limit an account or project", "Usually one vendor, not one agent"],
          ["Virtual cards", "Limit a card's merchant and amount", "Cover card payments, not API usage or tool calls"],
          ["AI gateways", "Route and meter model traffic", "Focus on model calls, often as a hosted service"],
          ["Agent wallets", "Hold keys and make payments", "Move the money, so a wallet carries custody risk"],
        ]}
      />
      <p style={S.p}>
        These can work together. A virtual card or an on-chain limit makes a good hard ceiling under a policy
        that decides each request.
      </p>

      <h2 style={S.h2}>What should you look for in a spend control tool?</h2>
      <ol style={S.ol}>
        <li style={S.li}><strong>It fails closed.</strong> A missing policy or a bad request means no, not yes.</li>
        <li style={S.li}><strong>The agent can&rsquo;t change it.</strong> Neither the limits nor the approvals are reachable by the agent.</li>
        <li style={S.li}><strong>State survives a restart.</strong> A restart must not reset the budget.</li>
        <li style={S.li}><strong>It explains itself.</strong> Each decision states the rule behind it.</li>
        <li style={S.li}><strong>It covers your real routes.</strong> Check every way your agent can spend, not only the main one.</li>
        <li style={S.li}><strong>The log can be verified.</strong> A <Link href="/blog/audit-log-for-ai-agents" style={S.a}>tamper-evident record</Link> is worth more than a plain log.</li>
      </ol>

      <h2 style={S.h2}>How do you get started?</h2>
      <ol style={S.ol}>
        <li style={S.li}>List every way your agent can spend money.</li>
        <li style={S.li}>Set a low limit per transaction and a daily cap, based on a normal day.</li>
        <li style={S.li}>Hold anything unknown for a human.</li>
        <li style={S.li}>Review the decision history after a week, then adjust.</li>
      </ol>
      <p style={S.p}>
        The <Link href="/blog/how-to-set-a-spending-limit-on-an-ai-agent" style={S.a}>spending limit guide</Link> walks
        through this with working code.
      </p>

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>Are spend controls only for crypto payments?</h3>
      <p style={S.p}>
        No. They apply to any way an agent spends: API calls, card purchases, PayPal refunds or stablecoin
        payments. The rule stays the same, and only the connection to the payment method changes.
      </p>
      <h3 style={S.h3}>Do spend controls need to hold my money?</h3>
      <p style={S.p}>
        No. A decision only needs the amount, the recipient and the agent. Shotoku, for example, never holds
        funds or keys.
      </p>
      <h3 style={S.h3}>What is Shotoku?</h3>
      <p style={S.p}>
        Shotoku is open-source spend controls for AI agents: budgets, human approvals and a tamper-evident
        audit trail. It is deterministic, takes no custody and runs on your machine. Start with the{" "}
        <Link href="/docs/quickstart" style={S.a}>quickstart</Link>.
      </p>
    </PostLayout>
  );
}
