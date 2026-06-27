import { CodeBlock, InlineCode } from "../../components/docs/CodeBlock";

const S = {
  page:    { padding: "48px 64px 96px" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 8, lineHeight: 1.2 } as React.CSSProperties,
  lead:    { fontSize: 15, color: "rgba(0,0,0,0.5)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 48, lineHeight: 1.6 } as React.CSSProperties,
  h2:      { fontSize: 18, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 44, marginBottom: 10, letterSpacing: "-0.015em" } as React.CSSProperties,
  h3:      { fontSize: 14.5, fontWeight: 600, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 28, marginBottom: 6 } as React.CSSProperties,
  p:       { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 14 } as React.CSSProperties,
  ul:      { margin: "8px 0 14px", paddingLeft: 20 } as React.CSSProperties,
  li:      { fontSize: 14.5, lineHeight: 1.8, color: "rgba(0,0,0,0.62)", fontFamily: "Satoshi, var(--font-geist), sans-serif", marginBottom: 2 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "40px 0" } as React.CSSProperties,
  table:   { width: "100%", borderCollapse: "collapse" as const, fontSize: 13.5, marginBottom: 20 },
  th:      { textAlign: "left" as const, padding: "8px 12px", fontFamily: "Satoshi, var(--font-geist), sans-serif", fontWeight: 500, color: "rgba(0,0,0,0.38)", fontSize: 11, borderBottom: "1px solid rgba(0,0,0,0.08)", letterSpacing: "0.04em", textTransform: "uppercase" as const } as React.CSSProperties,
  td:      { padding: "10px 12px", color: "rgba(0,0,0,0.62)", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, lineHeight: 1.55, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5 } as React.CSSProperties,
  tdKey:   { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13.5, color: "#0A0A0A", fontWeight: 500 } as React.CSSProperties,
  callout: { background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "14px 18px", marginBottom: 18 } as React.CSSProperties,
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

export default function SnapshotsPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Snapshots</h1>
      <p style={S.lead}>
        Cryptographically signed snapshots let you prove — to yourself or anyone else —
        that your policy and decision ledger have not been tampered with.
      </p>

      {/* What a snapshot is */}
      <h2 style={S.h2}>What a snapshot is</h2>
      <p style={S.p}>
        A snapshot is a JSON file that captures two things at a point in time:
      </p>
      <ul style={S.ul}>
        <li style={S.li}>A hash of your <InlineCode>policy.yaml</InlineCode> — so you can tell if the rules changed</li>
        <li style={S.li}>The head hash of your ledger — the last entry in the integrity chain</li>
      </ul>
      <p style={S.p}>
        Both are signed with an HMAC-SHA256 signature using a secret you control.
        Anyone with the same secret can verify the snapshot. No secret leaves your machine.
      </p>

      <hr style={S.divider} />

      {/* Setup */}
      <h2 style={S.h2}>Setup</h2>
      <p style={S.p}>
        Set the signing secret as an environment variable before running any snapshot command.
        Use a strong random value — at least 32 characters.
      </p>
      <CodeBlock lang="bash" code={`export SHOTOKU_SNAPSHOT_SECRET="your-secret-here"`} />
      <p style={S.p}>
        The same secret must be present both when creating and when verifying a snapshot.
        If they do not match, verification fails.
      </p>

      <hr style={S.divider} />

      {/* Creating */}
      <h2 style={S.h2}>Creating a snapshot</h2>
      <CodeBlock lang="bash" code={`shotoku snapshot create`} />
      <p style={S.p}>
        Reads your current policy and ledger, computes their hashes, signs the result,
        and writes <InlineCode>shotoku.snapshot.json</InlineCode> to the current directory.
      </p>
      <Table
        headers={["Flag", "Default", "Description"]}
        rows={[
          ["--out <path>",    "shotoku.snapshot.json", "Where to write the snapshot file"],
          ["--policy <path>", "policy.yaml",           "Policy file to hash"],
          ["--ledger <path>", "data/decisions.jsonl",  "Ledger file to hash"],
          ["--key-id <label>","—",                     "Optional label stored in the snapshot for reference"],
        ]}
      />
      <CodeBlock
        lang="json"
        filename="shotoku.snapshot.json"
        code={`{
  "version": 1,
  "createdAt": "2026-06-27T14:05:22.000Z",
  "policyHash": "sha256:a3f9...",
  "ledgerHeadHash": "sha256:c17b...",
  "keyId": "prod-2026-06",
  "signature": "hmac-sha256:7e4d..."
}`}
      />

      <hr style={S.divider} />

      {/* Verifying */}
      <h2 style={S.h2}>Verifying a snapshot</h2>
      <CodeBlock lang="bash" code={`shotoku snapshot verify --snapshot shotoku.snapshot.json`} />
      <p style={S.p}>
        Recomputes the hashes of your current policy and ledger and compares them against
        the snapshot. Also re-derives the HMAC signature and checks it matches.
      </p>
      <p style={S.p}>
        Verification fails — and exits with code <InlineCode>1</InlineCode> — if:
      </p>
      <ul style={S.ul}>
        <li style={S.li}>The policy file was modified since the snapshot was created</li>
        <li style={S.li}>New entries were appended to the ledger (or entries were removed)</li>
        <li style={S.li}>The snapshot file itself was edited</li>
        <li style={S.li}>The wrong secret is set in <InlineCode>SHOTOKU_SNAPSHOT_SECRET</InlineCode></li>
      </ul>
      <Table
        headers={["Flag", "Description"]}
        rows={[
          ["--snapshot <path>", "Snapshot file to verify (required)"],
          ["--policy <path>",   "Override the policy path stored in the snapshot"],
          ["--ledger <path>",   "Override the ledger path stored in the snapshot"],
        ]}
      />

      <hr style={S.divider} />

      {/* Ledger integrity chain */}
      <h2 style={S.h2}>Ledger integrity chain</h2>
      <p style={S.p}>
        Every record written to the ledger carries an integrity block — a sequence number,
        the hash of the previous record, and the hash of the current record. This forms a
        chain: changing any past record breaks every hash that follows it.
      </p>
      <p style={S.p}>
        The snapshot captures the <em>head hash</em> — the hash of the latest record.
        Verifying the snapshot confirms the chain is intact up to that point.
      </p>
      <div style={S.callout}>
        <p style={{ ...S.p, marginBottom: 0 }}>
          The genesis hash (the &ldquo;previous hash&rdquo; of the very first record) is
          the fixed value{" "}
          <InlineCode>sha256:0000…0000</InlineCode> (64 zeros).
          This is a known constant — it does not need to be kept secret.
        </p>
      </div>

      <hr style={S.divider} />

      {/* When to use */}
      <h2 style={S.h2}>When to use snapshots</h2>
      <ul style={S.ul}>
        <li style={S.li}>Before and after deploying a policy change — snapshot before, verify after</li>
        <li style={S.li}>As part of a CI step to confirm the ledger was not modified during a run</li>
        <li style={S.li}>To share an auditable proof of your policy state with a collaborator</li>
        <li style={S.li}>To detect accidental or unauthorized ledger edits</li>
      </ul>
    </div>
  );
}
