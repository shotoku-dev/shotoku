import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { errorCode, errorMessage } from "@shotoku/core";

/** One upstream MCP server Shotoku will sit in front of. */
export interface UpstreamServerConfig {
  readonly name: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: Record<string, string>;
}

export interface UpstreamConnection {
  readonly name: string;
  readonly client: Client;
  readonly tools: readonly Tool[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a Claude-Desktop-shaped config: `{ "mcpServers": { name: { command, args, env } } }`.
 * Reusing that shape means you can point Shotoku at a config you already have.
 */
export function parseUpstreamConfigs(raw: string): UpstreamServerConfig[] {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) return [];

  const servers = parsed["mcpServers"];
  if (!isRecord(servers)) return [];

  const configs: UpstreamServerConfig[] = [];
  for (const [name, value] of Object.entries(servers)) {
    if (!isRecord(value)) continue;
    const command = value["command"];
    if (typeof command !== "string" || !command) continue;

    const args = Array.isArray(value["args"])
      ? value["args"].filter((a): a is string => typeof a === "string")
      : undefined;
    const env = isRecord(value["env"])
      ? Object.fromEntries(
          Object.entries(value["env"]).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : undefined;

    configs.push({
      name,
      command,
      ...(args ? { args } : {}),
      ...(env ? { env } : {}),
    });
  }

  return configs;
}

/**
 * Load upstream servers from the file at `SHOTOKU_MCP_UPSTREAMS`. When unset or
 * missing, Shotoku exposes only its own tools (wrapping is simply off).
 */
export async function loadUpstreamConfigs(): Promise<UpstreamServerConfig[]> {
  const path = process.env["SHOTOKU_MCP_UPSTREAMS"];
  if (!path) return [];

  try {
    return parseUpstreamConfigs(await readFile(path, "utf8"));
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      process.stderr.write(`shotoku: upstream config not found at "${path}"\n`);
      return [];
    }
    throw error;
  }
}

/** Spawn one upstream server, connect as a client, and list its tools. */
export async function connectUpstream(
  config: UpstreamServerConfig,
): Promise<UpstreamConnection> {
  const transport = new StdioClientTransport({
    command: config.command,
    args: [...(config.args ?? [])],
    ...(config.env ? { env: config.env } : {}),
  });

  const client = new Client(
    { name: `shotoku-wrap-${config.name}`, version: "0.0.0" },
    { capabilities: {} },
  );

  await client.connect(transport);
  const listed = await client.listTools();

  return { name: config.name, client, tools: listed.tools };
}

/**
 * Connect to every configured upstream. A server that fails to start is skipped
 * with a warning rather than taking the gateway down — its tools simply are not
 * exposed, which is the safe direction to fail.
 */
export async function connectUpstreams(
  configs: readonly UpstreamServerConfig[],
): Promise<UpstreamConnection[]> {
  const connections: UpstreamConnection[] = [];

  for (const config of configs) {
    try {
      connections.push(await connectUpstream(config));
    } catch (error) {
      process.stderr.write(
        `shotoku: could not connect upstream "${config.name}": ${errorMessage(error)}\n`,
      );
    }
  }

  return connections;
}

/** Forward an approved tool call to its upstream server. */
export async function callUpstream(
  connection: UpstreamConnection,
  tool: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  return (await connection.client.callTool({
    name: tool,
    arguments: args,
  })) as CallToolResult;
}
