import Link from "next/link";
import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";
import { PostLayout, Table, S, postMetadata } from "../../components/blog/PostLayout";
import { getPost } from "../posts";

const post = getPost("audit-log-for-ai-agents");

export const metadata = postMetadata(post);

export default function AuditPost() {
  return (
    <PostLayout post={post}>
      <p style={S.p}>
        <strong>Short answer:</strong> record every decision in an append-only log where each entry includes
        the hash of the one before it, then sign a snapshot of the log and keep it somewhere else. The hash
        chain shows that a past record was changed. The signed snapshot catches what a chain misses, such
        as deleted entries at the end.
      </p>

      <h2 style={S.h2}>Why isn&rsquo;t a normal log enough?</h2>
      <p style={S.p}>
        A plain log file can be edited, and nothing shows it was. That matters when you need to answer
        questions after the fact: what did the agent try to do, who approved it, and which rules applied at
        the time? If a record can change without trace, you are trusting the file, not checking it.
      </p>

      <h2 style={S.h2}>What should an agent audit log record?</h2>
      <Table
        headers={["Field", "Why it matters"]}
        rows={[
          ["Who", "Which agent made the request"],
          ["What", "The action, the resource and the amount"],
          ["Decision", "Approved, denied or pending"],
          ["Reasons", "Which rule or limit produced that result"],
          ["Human answer", "The approval or denial, as a new entry that leaves the original untouched"],
          ["Refused attempts", "Denied requests often tell you more than approved ones"],
        ]}
      />

      <h2 style={S.h2}>What gets caught? We tried to tamper with one</h2>
      <p style={S.p}>
        We recorded three decisions with the current npm release, signed a snapshot, then changed the files:
      </p>
      <Table
        headers={["Change", "shotoku history", "shotoku snapshot verify"]}
        rows={[
          ["None", "Works", "Verified"],
          ["Edited the amount in record 2", "Error: ledger corrupt at line 2", "Failed: ledger corrupt at line 2"],
          ["Deleted the last record", <strong key="miss">Not noticed</strong>, "Failed: head hash and record count don't match"],
          ["Raised a limit in the policy", "Not checked", "Failed: policy hash doesn't match"],
        ]}
      />
      <p style={S.p}>
        The deleted record is the one to remember. A hash chain links each record to the one before it, so
        nothing after the last record can vouch for it. Removing entries from the end leaves a valid,
        shorter chain. You need a signed record of how long the log was.
      </p>

      <h2 style={S.h2}>How do you set this up?</h2>
      <p style={S.p}>
        Every decision Shotoku makes already goes into a hash-chained JSONL file, one record per line, that
        you can read in any editor. To add snapshots, set a secret and create one:
      </p>
      <CodeBlock lang="bash" code={`export SHOTOKU_SNAPSHOT_SECRET="a-long-random-secret"
shotoku snapshot create`} />
      <p style={S.p}>Check the current files against it later:</p>
      <CodeBlock lang="bash" code={`shotoku snapshot verify --snapshot shotoku.snapshot.json`} />
      <p style={S.p}>
        Take snapshots on a schedule, such as daily, and keep them with the secret away from the machine the
        agent runs on. Anything recorded after your last snapshot isn&rsquo;t covered yet.
      </p>

      <h2 style={S.h2}>What doesn&rsquo;t a tamper-evident log prove?</h2>
      <ul style={S.ul}>
        <li style={S.li}><strong>It is evidence, not prevention.</strong> It doesn&rsquo;t stop someone editing a file. It shows that they did.</li>
        <li style={S.li}><strong>The chain alone can be rebuilt.</strong> Someone with file access could recompute every hash. That&rsquo;s why the signed snapshot, and keeping its secret elsewhere, matter.</li>
        <li style={S.li}><strong>It records decisions, not outcomes.</strong> An approved entry shows the action was allowed, not that the payment or call then succeeded.</li>
        <li style={S.li}><strong>It only covers what passes through it.</strong> Calls that skip the check leave no entry.</li>
        <li style={S.li}><strong>It isn&rsquo;t a compliance certification.</strong> It can support an audit, but you still need to confirm what your own requirements ask for.</li>
      </ul>

      <h2 style={S.h2}>Common questions</h2>
      <h3 style={S.h3}>Do I need a blockchain for this?</h3>
      <p style={S.p}>
        No. A hash chain borrows one idea from them, and a local file plus a signed snapshot stored elsewhere
        covers the cases above.
      </p>
      <h3 style={S.h3}>Where is the log stored?</h3>
      <p style={S.p}>
        On your machine, by default in <InlineCode>data/decisions.jsonl</InlineCode>. Run{" "}
        <InlineCode>shotoku where</InlineCode> to see which files a directory uses.
      </p>
      <h3 style={S.h3}>Can I read it without Shotoku?</h3>
      <p style={S.p}>
        Yes. It is plain JSON, one object per line, so standard tools can read it. Use{" "}
        <InlineCode>shotoku history</InlineCode> for filters and integrity checks.
      </p>

      <p style={S.p}>
        More in the <Link href="/docs/snapshots" style={S.a}>snapshots guide</Link>.
      </p>
    </PostLayout>
  );
}
