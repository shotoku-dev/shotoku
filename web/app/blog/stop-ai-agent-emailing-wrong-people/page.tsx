import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";
import { PostLayout, Table, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("stop-ai-agent-emailing-wrong-people");

export const metadata = postMetadata(post);

export default function EmailPost() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Short answer:</strong> check every recipient in code before the message is sent. Allow
        domains you trust, and hold everything else for a human. An email can&rsquo;t be unsent, so this
        check has to run before the send, not in a review afterward.
      </p>

      <h2 style={S.h2}>Why does an agent email the wrong person?</h2>
      <ul style={S.ul}>
        <li style={S.li}><strong>Bad context.</strong> The agent picks a similar name or an old address from its notes.</li>
        <li style={S.li}><strong>Instructions hidden in content.</strong> A message it reads can tell it to forward something elsewhere.</li>
        <li style={S.li}><strong>Scope creep.</strong> Asked to draft a reply, it sends one.</li>
      </ul>
      <p style={S.p}>
        A rule in the prompt helps with none of these reliably. The second case is worse: the model is
        following instructions, just the wrong ones.
      </p>

      <h2 style={S.h2}>How do you check recipients?</h2>
      <p style={S.p}>Install Shotoku:</p>
      <CodeBlock lang="bash" code={`npm install -g shotoku-cli
npm install @shotoku/core
shotoku init`} />
      <p style={S.p}>Write a policy keyed on the recipient&rsquo;s domain:</p>
      <CodeBlock
        lang="yaml"
        filename="policy.yaml"
        code={`rules:
  - resource: yourcompany.com
    actions: [send_email]
    verdict: approved

  - resource: "*.yourcompany.com"
    actions: [send_email]
    verdict: approved

  - resource: "*"
    actions: [send_email]
    verdict: pending_approval

defaultVerdict: pending_approval`}
      />
      <p style={S.p}>
        Then wrap your send function. Check each domain, and send only if all of them pass, so one outside
        address in the list holds the whole message:
      </p>
      <CodeBlock
        lang="typescript"
        filename="send.ts"
        code={`import { authorize } from "@shotoku/core";

const options = { policyPath: "./policy.yaml", ledgerPath: "./data/decisions.jsonl" };

export async function sendAgentEmail(to: string[], message: Message) {
  const domains = new Set(to.map((address) => address.split("@").pop()!.toLowerCase()));

  for (const domain of domains) {
    const decision = await authorize(
      { actor: "mail-agent", action: "send_email", resource: domain },
      options,
    );
    if (!decision.approved) {
      throw new Error(\`Email held: \${domain} [\${decision.decisionId}]\`);
    }
  }

  return mailer.send(to, message);
}`}
      />
      <p style={S.p}>
        Include CC and BCC in <InlineCode>to</InlineCode>, or the check won&rsquo;t see those recipients.
      </p>

      <h2 style={S.h2}>What happens when it runs?</h2>
      <p style={S.p}>We ran this logic on the current npm release of <InlineCode>@shotoku/core</InlineCode>:</p>
      <Table
        headers={["Recipients", "Result"]}
        rows={[
          ["a@yourcompany.com and b@eu.yourcompany.com", "sent"],
          ["a@yourcompany.com and c@customer.com", "held: customer.com needs a human"],
          ["Same list, after shotoku approve", "sent"],
          ["Same list again", "held again"],
        ]}
      />

      <h2 style={S.h2}>What should you watch out for?</h2>
      <ul style={S.ul}>
        <li style={S.li}>
          <strong>An approval covers the next email to that domain, not one message.</strong> The check above
          knows the domain, not the content. To tie an approval to one message, pass a hash of it as{" "}
          <InlineCode>fingerprint</InlineCode> in the request.
        </li>
        <li style={S.li}>
          <strong>Domains aren&rsquo;t people.</strong> Approving <InlineCode>gmail.com</InlineCode> approves
          everyone there. Use a specific rule only for domains you control or fully trust.
        </li>
        <li style={S.li}>
          <strong>Domain rules can&rsquo;t judge content.</strong> An allowed internal address can still
          receive the wrong attachment. This limits who gets mail, not what it says.
        </li>
      </ul>

      <h2 style={S.h2}>What about a Gmail MCP server?</h2>
      <p style={S.p}>
        <Link href="/blog/require-human-approval-mcp-tool-calls" style={S.a}>Wrapping an MCP server</Link> also
        works, with one difference: a wrapped rule matches the tool name, not the recipient. So you can
        allow drafts, and hold every send for a human, but you can&rsquo;t allow one domain through that route.
      </p>
      <Table
        headers={["Route", "Can the agent skip it?", "Rule matches on"]}
        rows={[
          ["authorize() in your send function", "Not if it's the only way to send", "Recipient domain"],
          ["Wrapped MCP mail server", "Not through MCP", "Tool name"],
        ]}
      />

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>Should agents send email without review at all?</h3>
      <p style={S.p}>
        Internal notifications to known addresses are usually fine. For anything that reaches a customer,
        start with human approval, then relax it once your history shows the agent gets it right.
      </p>
      <h3 style={S.h3}>Does the email text leave my machine?</h3>
      <p style={S.p}>
        Not through Shotoku. It runs locally and this check sends it only the domain, which is stored in a
        local file.
      </p>

      <p style={S.p}>
        Shotoku is built for spend controls, and the same policy engine covers email. See the{" "}
        <Link href="/docs/policies" style={S.a}>policy reference</Link>.
      </p>
    </PostLayout>
  );
}
