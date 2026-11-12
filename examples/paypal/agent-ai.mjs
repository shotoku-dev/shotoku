/**
 * PayPal support-agent demo, step 2: a real AI agent.
 *
 *   node examples/paypal/agent-ai.mjs     (after node examples/paypal/setup.mjs)
 *
 * Claude reads the customer's email and decides what to do with the shop's
 * PayPal account. Nothing here tells it which tools to call or in what order:
 * it gets the shop's refund policy, the email, and one MCP server, Shotoku,
 * which wraps PayPal's. Every call it makes is decided by policy.yaml before
 * PayPal sees it.
 *
 * When Shotoku holds a call for a human, this script waits for the answer
 * (phone, dashboard or terminal), hands it back to the same Claude session,
 * and lets the agent finish: retry the identical call if you approved, or
 * write to the customer if you denied.
 *
 * Uses the Claude Code CLI in headless mode, so it runs on the login you
 * already have and needs no API key. Any MCP-capable agent can take its place:
 * point it at .run/claude-mcp.json.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const run = join(here, ".run");
const ledgerPath = join(run, "decisions.jsonl");
const WAIT_MINUTES = 10;
const MAX_ROUNDS = 4;

if (!existsSync(join(run, "agent-prompt.txt"))) {
  console.error("✗ No demo run found. Run node examples/paypal/setup.mjs first.");
  process.exit(1);
}
if (spawnSync("claude", ["--version"], { stdio: "ignore" }).status !== 0) {
  console.error(
    "✗ The Claude Code CLI is not installed (npm install -g @anthropic-ai/claude-code).\n" +
      "  Without it, run the scripted agent instead: node examples/paypal/agent.mjs",
  );
  process.exit(1);
}

const { approve, deny, getApprovalForDecision, readDecisions } = await import(
  pathToFileURL(join(repo, "core/dist/index.js")).href
);

const tty = process.stdout.isTTY;
const paint = (code) => (text) => (tty ? `\u001b[${code}m${text}\u001b[0m` : text);
const dim = paint(2);
const bold = paint(1);
const green = paint(32);
const yellow = paint(33);
const red = paint(31);
const indent = (text, pad = "  ") =>
  text
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");

/** `mcp__shotoku__paypal__create_refund` → `paypal__create_refund`. */
const shortTool = (name) => name.replace(/^mcp__shotoku__/, "");

/** Tool arguments on one line, with PayPal money objects written as dollars. */
function showArgs(input) {
  const parts = Object.entries(input ?? {}).map(([key, value]) => {
    if (value && typeof value === "object" && "value" in value && "currency_code" in value) {
      return `${key}: ${value.currency_code === "USD" ? "$" : `${value.currency_code} `}${value.value}`;
    }
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return `${key}: ${text.length > 48 ? `${text.slice(0, 45)}...` : text}`;
  });
  return parts.join(", ");
}

function showResult(toolName, text, isError) {
  if (text.startsWith("Blocked by Shotoku")) {
    const status = text.match(/status:\s+(\S+)/)?.[1] ?? "blocked";
    const decision = text.match(/decision:\s+(\S+)/)?.[1] ?? "";
    const reason = text.match(/reason:\s+(.+)/)?.[1] ?? "";
    const label = status === "pending_approval" ? yellow("◷ HELD FOR A HUMAN") : red("✗ DENIED");
    console.log(`  ${label}  ${dim(decision)}\n  ${reason}\n`);
    return;
  }
  if (isError) {
    console.log(`  ${red("✗")} ${text.split("\n")[0]}\n`);
    return;
  }
  let summary = text.split("\n")[0].slice(0, 100);
  try {
    const body = JSON.parse(text);
    if (toolName.endsWith("create_refund")) {
      summary = `PayPal refund ${body.id}: ${body.status}`;
    } else if (body.id && body.status) {
      const amount = body.purchase_units?.[0]?.amount;
      summary = `${body.id}: ${body.status}${amount ? `, $${amount.value}` : ""}`;
    }
  } catch {
    // Not JSON: keep the first line.
  }
  console.log(`  ${green("✓ APPROVED")}  ${summary}\n`);
}

// An empty folder, kept for the whole run: Claude reads none of this repo's
// docs (which describe the demo), and the session can be resumed from it.
const workdir = mkdtempSync(join(tmpdir(), "shotoku-support-agent-"));
let sessionId;

/** One turn of the agent. Prints what it says and does as it happens. */
function turn(prompt) {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--strict-mcp-config",
    "--mcp-config",
    join(run, "claude-mcp.json"),
    // Shotoku is the gate under test, not Claude Code's permission prompt.
    "--allowedTools",
    "mcp__shotoku",
  ];
  if (sessionId) args.push("--resume", sessionId);
  if (process.env.SHOTOKU_DEMO_MODEL) args.push("--model", process.env.SHOTOKU_DEMO_MODEL);

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: workdir, stdio: ["pipe", "pipe", "inherit"] });
    const toolNames = new Map();
    child.stdin.end(prompt);

    createInterface({ input: child.stdout }).on("line", (line) => {
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.session_id) sessionId = event.session_id;
      const content = event.message?.content;
      if (!Array.isArray(content)) return;

      for (const block of content) {
        if (event.type === "assistant" && block.type === "text" && block.text.trim()) {
          console.log(`${bold("claude:")}\n${indent(block.text.trim())}\n`);
        } else if (event.type === "assistant" && block.type === "tool_use") {
          // Claude Code's own housekeeping tools are not calls to PayPal.
          if (!block.name.startsWith("mcp__shotoku__")) continue;
          toolNames.set(block.id, block.name);
          console.log(`${bold("claude →")} ${shortTool(block.name)}  ${dim(showArgs(block.input))}`);
        } else if (event.type === "user" && block.type === "tool_result") {
          if (!toolNames.has(block.tool_use_id)) continue;
          const text = Array.isArray(block.content)
            ? block.content.map((part) => part.text ?? "").join("\n")
            : String(block.content ?? "");
          showResult(toolNames.get(block.tool_use_id) ?? "", text, block.is_error === true);
        }
      }
    });

    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`claude exited with code ${code}`)),
    );
  });
}

async function waitForHuman(decision) {
  const already = await getApprovalForDecision(ledgerPath, decision.decisionId);
  if (already) return already;
  const amount = decision.request.amount !== undefined ? `$${decision.request.amount} ` : "";
  const interactive = process.stdin.isTTY === true;
  console.log(
    `${yellow("waiting:")} ${amount}${decision.request.resource} needs a human. ${dim(decision.decisionId)}\n` +
      `  Answer on your phone (shotoku telegram), in the dashboard (shotoku ui), or:\n` +
      `  SHOTOKU_LEDGER=${ledgerPath} node ${join(repo, "cli/dist/index.js")} approve ${decision.decisionId}\n` +
      (interactive ? `  Or answer here: type ${bold("y")} to approve or ${bold("n")} to deny, then Enter.\n` : ""),
  );

  // You are the human. An answer typed here is recorded like one from any
  // other channel; whichever channel answers first wins.
  const prompt = interactive ? createInterface({ input: process.stdin }) : undefined;
  prompt?.on("line", (line) => {
    const key = line.trim().toLowerCase();
    if (key !== "y" && key !== "n") return;
    (key === "y" ? approve : deny)(decision.decisionId, { ledgerPath, via: "terminal" }).catch(() => {
      // Already answered from another channel.
    });
  });

  try {
    const deadline = Date.now() + WAIT_MINUTES * 60_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const answer = await getApprovalForDecision(ledgerPath, decision.decisionId);
      if (answer) return answer;
    }
    return undefined;
  } finally {
    prompt?.close();
  }
}

console.log(dim(`support agent: Claude, with one MCP server (Shotoku, wrapping PayPal's)\n`));
await turn(readFileSync(join(run, "agent-prompt.txt"), "utf8"));

const answered = new Set();
for (let round = 0; round < MAX_ROUNDS; round += 1) {
  // Every call that was held, whether or not a human has answered yet: an
  // answer given while the agent was still talking must reach it too.
  const pending = (await readDecisions(ledgerPath)).filter(
    (d) => d.response.status === "pending_approval" && !answered.has(d.decisionId),
  );
  if (pending.length === 0) break;

  const updates = [];
  for (const decision of pending) {
    answered.add(decision.decisionId);
    const answer = await waitForHuman(decision);
    const via = answer?.via ? ` (${answer.via})` : "";
    if (!answer) {
      console.log(`${dim("no answer after")} ${WAIT_MINUTES} ${dim("minutes: nothing is refunded.")}\n`);
      updates.push(`Decision ${decision.decisionId}: no human answered. Do not retry that call.`);
    } else if (answer.verdict === "approved") {
      console.log(`${green("human:")} approved ${decision.decisionId}${via}\n`);
      updates.push(
        `Decision ${decision.decisionId}: a human APPROVED it. Retry that exact call now, with identical arguments.`,
      );
    } else {
      console.log(`${red("human:")} denied ${decision.decisionId}${via}\n`);
      updates.push(`Decision ${decision.decisionId}: a human DENIED it. Do not retry that call.`);
    }
  }

  await turn(
    `Update from the shop's staff on the calls that were held:\n${updates.join("\n")}\n` +
      "Finish handling the customer's email, then write the reply you would send them.",
  );
}

const decisions = await readDecisions(ledgerPath);
console.log(bold("ledger:"));
for (const entry of decisions) {
  const status = entry.response.status;
  const mark = status === "approved" ? green("✓") : status === "denied" ? red("✗") : yellow("◷");
  const amount = entry.request.amount !== undefined ? `$${entry.request.amount}` : "";
  console.log(
    `  ${mark} ${status.padEnd(16)} ${entry.request.resource.padEnd(26)} ${amount.padEnd(8)}${
      entry.grant ? dim("human-approved retry") : ""
    }`,
  );
}
console.log(dim(`\n  ${decisions.length} decisions, hash-chained, in ${ledgerPath}`));
