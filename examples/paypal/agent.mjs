/**
 * PayPal support-agent demo, step 2: a scripted agent.
 *
 *   node examples/paypal/agent.mjs        (after node examples/paypal/setup.mjs)
 *
 * Plays the part of an AI agent that takes the customer at their word, with no
 * model involved, so the run is the same every time. It connects to
 * Shotoku's MCP server exactly as Claude Desktop would; Shotoku wraps PayPal's
 * own MCP server (@paypal/mcp) and decides on every call:
 *
 *   1. refund the $89 lamp, with an amount     → approved, refunded
 *   2. refund the $480 chair, with no amount   → priced at $480, held
 *   3. wait for a human (phone or terminal)    → approve or deny
 *   4. retry the identical call                → refunded only if approved
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const run = join(here, ".run");

if (!existsSync(join(run, "orders.json"))) {
  console.error("✗ No demo run found. Run node examples/paypal/setup.mjs first.");
  process.exit(1);
}

// The MCP SDK is a dependency of the mcp/ package, not of the repo root.
const sdk = (path) =>
  import(pathToFileURL(join(repo, "mcp/node_modules/@modelcontextprotocol/sdk/dist/esm", path)).href);
const { Client } = await sdk("client/index.js");
const { StdioClientTransport } = await sdk("client/stdio.js");
const { getApprovalForDecision } = await import(pathToFileURL(join(repo, "core/dist/index.js")).href);

const { lamp, chair } = JSON.parse(readFileSync(join(run, "orders.json"), "utf8"));
const ledgerPath = join(run, "decisions.jsonl");
const WAIT_MINUTES = 10;

const client = new Client({ name: "support-agent", version: "0.0.0" }, { capabilities: {} });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [join(repo, "mcp/dist/index.js")],
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      SHOTOKU_POLICY: join(run, "policy.yaml"),
      SHOTOKU_LEDGER: ledgerPath,
      SHOTOKU_MCP_UPSTREAMS: join(run, "upstreams.json"),
      SHOTOKU_MCP_ACTOR: "support-agent",
    },
    stderr: "inherit",
  }),
);

const { tools } = await client.listTools();
const paypalTools = tools.filter((t) => t.name.startsWith("paypal__"));
if (paypalTools.length === 0) {
  console.error("✗ PayPal's MCP server did not start behind Shotoku (see the messages above).");
  process.exit(1);
}
console.log(`agent: connected. ${paypalTools.length} PayPal tools, every call gated by Shotoku.\n`);

const textOf = (result) => result.content?.map((c) => c.text).join("\n") ?? "";

async function refund(label, args) {
  console.log(`agent: ${label}`);
  const result = await client.callTool({ name: "paypal__create_refund", arguments: args });
  const text = textOf(result);
  if (result.isError) {
    console.log(text.split("\n").map((l) => `  ${l}`).join("\n"));
  } else {
    const { id, status } = JSON.parse(text);
    console.log(`  ✓ PayPal refund ${id}: ${status}`);
  }
  console.log("");
  return { blocked: result.isError === true, text };
}

await refund(`refund the lamp, $${lamp.amount} (capture ${lamp.captureId})`, {
  capture_id: lamp.captureId,
  amount: { currency_code: "USD", value: lamp.amount },
});

const chairCall = { capture_id: chair.captureId };
const held = await refund(`refund the chair in full (capture ${chair.captureId}), no amount given`, chairCall);

const decisionId = held.text.match(/decision: (dec_[a-z0-9]+)/)?.[1];
if (!held.blocked || !held.text.includes("pending_approval") || !decisionId) {
  await client.close();
  process.exit(0);
}

console.log(`agent: waiting for a human to answer ${decisionId}`);
console.log(`  on your phone (shotoku telegram), or: shotoku approve ${decisionId} / shotoku deny ${decisionId}`);
console.log(`  (with SHOTOKU_LEDGER=${ledgerPath})\n`);

const deadline = Date.now() + WAIT_MINUTES * 60_000;
let answer;
while (!answer && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  answer = await getApprovalForDecision(ledgerPath, decisionId);
}

if (!answer) {
  console.log(`agent: no answer after ${WAIT_MINUTES} minutes. Stopping without refunding.`);
} else if (answer.verdict === "denied") {
  console.log(`agent: ${decisionId} was denied${answer.via ? ` (${answer.via})` : ""}. Not retrying.`);
} else {
  console.log(`agent: ${decisionId} approved${answer.via ? ` (${answer.via})` : ""}. Retrying the identical call.\n`);
  await refund(`refund the chair in full (capture ${chair.captureId}), retry`, chairCall);
}

await client.close();
