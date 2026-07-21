// Throwaway driver: acts like Claude Desktop connecting to Shotoku's MCP server,
// which itself wraps the fake upstream server.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "shotoku-wrapdemo-"));
const policyPath = join(dir, "policy.yaml");
const ledgerPath = join(dir, "decisions.jsonl");
const upstreamsPath = join(dir, "upstreams.json");

writeFileSync(
  policyPath,
  `rules:
  - resource: demo__read_docs
    verdict: approved
defaultVerdict: pending_approval
`,
);

writeFileSync(
  upstreamsPath,
  JSON.stringify({
    mcpServers: {
      demo: { command: "node", args: [join(process.cwd(), "mcp/demo-upstream.mjs")] },
    },
  }),
);

const client = new Client({ name: "demo-agent", version: "0.0.0" }, { capabilities: {} });
await client.connect(
  new StdioClientTransport({
    command: "node",
    args: [join(process.cwd(), "mcp/dist/index.js")],
    env: {
      ...process.env,
      SHOTOKU_POLICY: policyPath,
      SHOTOKU_LEDGER: ledgerPath,
      SHOTOKU_MCP_UPSTREAMS: upstreamsPath,
    },
  }),
);

const { tools } = await client.listTools();
console.log("TOOLS THE AGENT SEES:");
for (const t of tools) console.log(`  - ${t.name}`);

const say = (label, result) =>
  console.log(`\n${label}\n${result.content.map((c) => c.text).join("\n")}`);

say(
  "① allowed tool  →  demo__read_docs",
  await client.callTool({ name: "demo__read_docs", arguments: {} }),
);

say(
  "② dangerous tool  →  demo__delete_everything",
  await client.callTool({ name: "demo__delete_everything", arguments: { target: "prod" } }),
);

say(
  "③ agent tries to approve itself  →  approve_decision",
  await client.callTool({ name: "approve_decision", arguments: { decisionId: "dec_whatever" } }),
);

await client.close();
