/**
 * Scripted Shotoku demo for screenshots / recordings.
 *
 *   node scripts/demo.mjs
 *
 * Plays a full session — an approved payment, a held email, a blocked file
 * scope, then a human approval — against a throwaway policy and ledger in a
 * temp directory. Nothing in your project is touched.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../cli/dist/index.js", import.meta.url));

const dir = mkdtempSync(join(tmpdir(), "shotoku-demo-"));
const policy = join(dir, "policy.yaml");
const ledger = join(dir, "decisions.jsonl");

writeFileSync(
  policy,
  `rules:
  - resource: openai.com
    actions: [purchase, api_call]
    verdict: approved
    maxAmount: 20
    maxDailyAmount: 100
  - resource: yourcompany.com
    actions: [send_email]
    verdict: approved
  - resource: system
    actions: [custom]
    verdict: denied
defaultVerdict: pending_approval
`,
);

/** Print the command as a user would type it, then run it and print its output. */
function run(args, { withPolicy = false } = {}) {
  process.stdout.write(`\n$ shotoku ${args.join(" ")}\n`);
  const full = [
    CLI,
    ...args,
    ...(withPolicy ? ["--policy", policy] : []),
    "--ledger",
    ledger,
  ];
  try {
    const out = execFileSync("node", full, { encoding: "utf8" });
    process.stdout.write(out);
    return out;
  } catch (err) {
    // authorize exits non-zero for denied / pending; the output is still on stdout.
    const out = err.stdout ?? "";
    process.stdout.write(out);
    return out;
  }
}

run(["authorize", "--actor", "my-agent", "--action", "purchase", "--resource", "openai.com", "--amount", "5"], { withPolicy: true });
const pending = run(["authorize", "--actor", "my-agent", "--action", "send_email", "--resource", "external-client.com"], { withPolicy: true });
run(["authorize", "--actor", "my-agent", "--action", "custom", "--resource", "system"], { withPolicy: true });

const id = (pending.match(/dec_[0-9a-f]+/) ?? [])[0];
if (id) run(["approve", id]);

run(["history"]);

rmSync(dir, { recursive: true, force: true });
