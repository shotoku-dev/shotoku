/**
 * Launch the Shotoku TUI pre-seeded with realistic decisions, for screenshots
 * and recordings.
 *
 *   node scripts/demo-tui.mjs
 *
 * Seeds a throwaway policy + ledger in a temp directory (two pending approvals,
 * one approved, one denied), then opens the interactive TUI on it. Press `q`
 * to quit; the temp files are cleaned up on exit. Nothing in your project is
 * touched.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../cli/dist/index.js", import.meta.url));

const dir = mkdtempSync(join(tmpdir(), "shotoku-tui-"));
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
  - resource: system
    actions: [custom]
    verdict: denied
defaultVerdict: pending_approval
`,
);

function seed(args) {
  try {
    execFileSync("node", [CLI, ...args, "--policy", policy, "--ledger", ledger], {
      stdio: "ignore",
    });
  } catch {
    // authorize exits non-zero for denied / pending — that is expected here.
  }
}

seed(["authorize", "--actor", "research-agent", "--action", "purchase", "--resource", "openai.com", "--amount", "4"]);
seed(["authorize", "--actor", "research-agent", "--action", "send_email", "--resource", "external-client.com"]);
seed(["authorize", "--actor", "ops-agent", "--action", "purchase", "--resource", "vendor-xyz.com", "--amount", "12"]);
seed(["authorize", "--actor", "ops-agent", "--action", "custom", "--resource", "system"]);

try {
  execFileSync("node", [CLI, "tui", "--ledger", ledger], { stdio: "inherit" });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
