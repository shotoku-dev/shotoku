import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { APPROVAL_TOOLS, shotokuTools } from "./tools.js";
import { handleToolCall } from "./handlers.js";
import { loadConfig } from "./config.js";
import {
  callUpstream,
  connectUpstreams,
  loadUpstreamConfigs,
} from "./upstream.js";
import {
  authorizeToolCall,
  blockedToolMessage,
  parseWrappedToolName,
  wrappedToolName,
} from "./wrap.js";

const allowApprovals = process.env["SHOTOKU_MCP_ALLOW_APPROVALS"] === "1";
const actor = process.env["SHOTOKU_MCP_ACTOR"] ?? "mcp-agent";

const config = await loadConfig();
const upstreams = await connectUpstreams(await loadUpstreamConfigs());
const upstreamByName = new Map(upstreams.map((u) => [u.name, u]));

// Every upstream tool is re-exposed under "<server>__<tool>" and gated.
const wrappedTools: Tool[] = upstreams.flatMap((upstream) =>
  upstream.tools.map((tool) => ({
    ...tool,
    name: wrappedToolName(upstream.name, tool.name),
    description: `[via ${upstream.name}, gated by Shotoku] ${tool.description ?? ""}`.trim(),
  })),
);

const exposedTools: Tool[] = [...shotokuTools(allowApprovals), ...wrappedTools];

const server = new Server(
  { name: "shotoku", version: "0.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: exposedTools }));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  // Hiding an approval tool is not enough — refuse the call outright.
  if (!allowApprovals && APPROVAL_TOOLS.has(name)) {
    return {
      content: [
        {
          type: "text",
          text:
            "Refused: an agent cannot approve or deny its own decisions.\n" +
            "A human must do it out-of-band (`shotoku approve <id>`, the TUI, or Slack).",
        },
      ],
      isError: true,
    };
  }

  const wrapped = parseWrappedToolName(name);
  const upstream = wrapped ? upstreamByName.get(wrapped.server) : undefined;

  if (wrapped && upstream) {
    const decision = await authorizeToolCall(wrapped.server, wrapped.tool, args, {
      policyPath: config.policyPath,
      ledgerPath: config.ledgerPath,
      actor,
    });

    if (decision.outcome === "block") {
      return {
        content: [{ type: "text", text: blockedToolMessage(decision) }],
        isError: true,
      };
    }

    return callUpstream(upstream, wrapped.tool, args);
  }

  return handleToolCall(name, args);
});

const transport = new StdioServerTransport();
await server.connect(transport);
