#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { resolveActor } from "./actor.js";
import { APPROVAL_TOOLS, shotokuTools } from "./tools.js";
import { handleToolCall } from "./handlers.js";
import { loadConfig } from "./config.js";
import {
  callUpstream,
  connectUpstreams,
  loadUpstreamConfigs,
} from "./upstream.js";
import { pricerFor } from "./pricing.js";
import {
  authorizeToolCall,
  blockedToolMessage,
  parseWrappedToolName,
  wrappedToolName,
} from "./wrap.js";

const allowApprovals = process.env["SHOTOKU_MCP_ALLOW_APPROVALS"] === "1";

const config = await loadConfig();
const upstreamConfigs = await loadUpstreamConfigs();
const upstreams = await connectUpstreams(upstreamConfigs);
const upstreamByName = new Map(upstreams.map((u) => [u.name, u]));
const pricerByName = new Map(
  upstreamConfigs.flatMap((c) => {
    const pricer = pricerFor(c);
    return pricer ? [[c.name, pricer] as const] : [];
  }),
);

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

/**
 * Resolved per call, not once at startup: the client only announces itself
 * during the initialize handshake, which happens after this module is
 * evaluated and after `server.connect()` below.
 */
function currentActor(): string {
  return resolveActor(server.getClientVersion()?.name);
}

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};
  const actor = currentActor();

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
    const quote = await pricerByName.get(wrapped.server)?.price(wrapped.tool, args);
    const decision = await authorizeToolCall(
      wrapped.server,
      wrapped.tool,
      args,
      { policyPath: config.policyPath, ledgerPath: config.ledgerPath, actor },
      quote,
    );

    if (decision.outcome === "block") {
      return {
        content: [{ type: "text", text: blockedToolMessage(decision) }],
        isError: true,
      };
    }

    return callUpstream(upstream, wrapped.tool, args);
  }

  return handleToolCall(name, args, actor);
});

const transport = new StdioServerTransport();
await server.connect(transport);
