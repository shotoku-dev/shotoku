import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";
import { PostLayout, Table, Ext, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("ai-support-agent-refund-limits");

export const metadata = postMetadata(post);

export default function RefundPost() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Short answer:</strong> let the agent issue refunds up to a set amount, send bigger ones to
        a human, and cap the total per day. Enforce all of it outside the model. An agent reads what
        customers write, and it can&rsquo;t tell a true claim from a false one.
      </p>

      <h2 style={S.h2}>Why can&rsquo;t the model decide on its own?</h2>
      <p style={S.p}>
        A refund tool moves real money based on text from a stranger. A customer can invent a broken
        order, and an email can carry hidden instructions. In our PayPal sandbox demo, one scenario hides a
        fake system note in a customer email. Claude spotted it and refused. A less careful agent might not
        have, so the limit shouldn&rsquo;t depend on the model noticing.
      </p>
      <p style={S.p}>
        With a limit outside the model, a fooled agent can only do limited damage: a $480 refund waits for
        a person whatever the email said.
      </p>

      <h2 style={S.h2}>What does a refund policy look like?</h2>
      <p style={S.p}>
        This policy sits in front of <Ext href="https://www.npmjs.com/package/@paypal/mcp">PayPal&rsquo;s MCP server</Ext>.
        Reads are free, refunds up to $100 go through, and bigger ones wait for a human:
      </p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`rules:
  - resource: paypal__list_*
    verdict: approved
  - resource: paypal__get_*
    verdict: approved

  - resource: paypal__create_refund
    verdict: approved
    maxAmount: 100
    maxDailyAmount: 1000
    overLimit: pending_approval

  - resource: paypal__accept_dispute_claim
    verdict: approved
    maxAmount: 50
    overLimit: pending_approval

budgets:
  - actor: support-agent
    maxDailyAmount: 1000

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>
        <InlineCode>overLimit: pending_approval</InlineCode> is the key line. Without it, an over-limit
        refund is refused. With it, a real customer with a real $480 problem still gets helped, once a
        person checks.
      </p>
      <p style={S.p}>Shotoku reads the amount from the tool call, so the agent can&rsquo;t understate it in a separate field:</p>
      <Table
        headers={["PayPal tool", "Priced at"]}
        rows={[
          ["create_refund with an amount", "That amount"],
          ["create_refund without an amount", "The full capture, looked up from PayPal"],
          ["accept_dispute_claim", "The disputed amount, looked up from PayPal"],
          ["A call that can't be priced", "No amount, so a limited rule holds it for a human"],
        ]}
      />

      <h2 style={S.h2}>What happens to each refund?</h2>
      <p style={S.p}>We ran the example policy through the policy engine on the repo&rsquo;s main branch:</p>
      <Table
        headers={["Request", "Result"]}
        rows={[
          ["$89 refund", "approved, $911 left today"],
          ["$480 refund", "pending_approval: over the $100 limit"],
          ["List transactions", "approved"],
          ["Create an invoice (not in the policy)", "pending_approval"],
        ]}
      />
      <p style={S.p}>
        The agent retries after you approve, and that approval works once, for that exact refund. The agent
        can&rsquo;t approve its own request.
      </p>

      <h2 style={S.h2}>What works today?</h2>
      <div style={S.note}>
        <strong>The $100 threshold isn&rsquo;t on npm yet.</strong> Tool pricing, <InlineCode>overLimit</InlineCode>,
        agent budgets and phone approvals are on the main branch. You can run them from the repo today, and
        they arrive in the next npm release.
      </div>
      <p style={S.p}>
        On the current npm release, you can hold every refund for a human. We tested this rule with{" "}
        <InlineCode>shotoku-mcp</InlineCode> and a stand-in server: the refund never reached it, while the
        listing call did.
      </p>
      <CodeBlock
        lang="yaml"
        code={`rules:
  - resource: paypal__list_*
    verdict: approved
  - resource: paypal__create_refund
    verdict: pending_approval

defaultVerdict: pending_approval`}
      />

      <h2 style={S.h2}>Does this work with Stripe or other providers?</h2>
      <p style={S.p}>
        Partly. You can wrap any MCP server and hold or block its refund tool. The dollar threshold needs a
        pricer that knows how to read that server&rsquo;s tools, and PayPal is the only built-in pricer so
        far. Without one, a rule with a limit holds every call for a human, so nothing slips through.
      </p>

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>How should I pick the refund limit?</h3>
      <p style={S.p}>
        Look at your typical refund size and how much a wrong refund would cost you. Set the limit where a
        mistake is cheaper than a person reviewing it, and set the daily cap to the most you would accept
        losing in a bad day.
      </p>
      <h3 style={S.h3}>Does Shotoku hold my PayPal money?</h3>
      <p style={S.p}>
        No. PayPal moves the money. Shotoku only decides whether a call goes ahead and records why.
      </p>
      <h3 style={S.h3}>Can I try it without real money?</h3>
      <p style={S.p}>
        Yes. The repo has a runnable demo in <InlineCode>examples/paypal</InlineCode> that uses PayPal&rsquo;s
        sandbox, and its setup script refuses to run against the live API.
      </p>

      <p style={S.p}>
        The full setup is in the <Link href="/docs/paypal" style={S.a}>PayPal guide</Link>.
      </p>
    </PostLayout>
  );
}
