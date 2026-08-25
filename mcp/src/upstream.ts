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
 */export interface UpstreamParseResult {
  readonly configs: UpstreamServerConfig[];
  /** Anything rejected, phrased for a human reading a log. */
  readonly problems: string[];
}

export function parseUpstreamConfigs(raw: string): UpstreamParseResult {
  const problems: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { configs: [], problems: [`not valid JSON: ${errorMessage(error)}`] };
  }

  if (!isRecord(parsed)) {
    return { configs: [], problems: ["expected a JSON object at the top level"] };
  }

  const servers = parsed["mcpServers"];
  if (!isRecord(servers)) {
    return {
      configs: [],
      problems: ['expected an "mcpServers" object, like an agent host config'],
    };
  }

  const configs: UpstreamServerConfig[] = [];
  for (const [name, value] of Object.entries(servers)) {
    if (!isRecord(value)) {
      problems.push(`server "${name}": entry must be an object`);
      continue;
    }
    const command = value["command"];
    if (typeof command !== "string" || !command) {
      problems.push(`server "${name}": missing a "command" to run`);
      continue;
    }
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

  if (configs.length === 0 && problems.length === 0) {
    problems.push('"mcpServers" is empty, so nothing is being wrapped');
  }

  return { configs, problems };
}

/**
 * Load upstream servers from the file at `SHOTOKU_MCP_UPSTREAMS`. When unset,
 * wrapping is off and Shotoku exposes only its own tools.
 *
 * This never throws. A stray comma in the file used to kill the process before
 * it could answer its host, and a host reports that as nothing more useful than
 * "server failed to start" -- about the one file the user just edited by hand.
 * Every rejection is now named on stderr, where agent hosts keep MCP logs, and
 * the server still comes up.
 */
export async function loadUpstreamConfigs(): Promise<UpstreamServerConfig[]> {
  const path = process.env["SHOTOKU_MCP_UPSTREAMS"];
  if (!path) return [];

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const reason = errorCode(error) === "ENOENT" ? "file not found" : errorMessage(error);
    warn(`could not read SHOTOKU_MCP_UPSTREAMS "${path}": ${reason}`);
    warn("wrapping is off; only Shotoku own tools are exposed");
    return [];
  }

  const { configs, problems } = parseUpstreamConfigs(raw);

  for (const problem of problems) {
    warn(`${path}: ${problem}`);
  }
  if (configs.length === 0) {
    warn("wrapping is off; only Shotoku own tools are exposed");
  }

  return configs;
}

function warn(message: string): void {
  process.stderr.write(`shotoku: ${message}
`);
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
