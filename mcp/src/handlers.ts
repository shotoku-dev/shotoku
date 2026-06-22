import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { authorize, type AgentAction } from "@shotoku/core";
import { loadConfig } from "./config.js";

const VALID_ACTIONS: readonly AgentAction[] = [
  "purchase",
  "api_call",
  "execute_code",
  "send_email",
  "mcp_tool",
  "custom",
];

function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === "string" && (VALID_ACTIONS as string[]).includes(value);
}

function text(content: string): CallToolResult {
  return { content: [{ type: "text", text: content }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

async function handleAuthorizeAction(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { actor, action, resource, amount, context } = args;

  if (typeof actor !== "string" || !actor) {
    return errorResult("Missing required argument: actor");
  }
  if (!isAgentAction(action)) {
    return errorResult(
      `Invalid or missing action. Valid values: ${VALID_ACTIONS.join(", ")}`,
    );
  }
  if (typeof resource !== "string" || !resource) {
    return errorResult("Missing required argument: resource");
  }
  if (amount !== undefined && (typeof amount !== "number" || amount < 0)) {
    return errorResult("amount must be a non-negative number");
  }
  if (
    context !== undefined &&
    (typeof context !== "object" || context === null || Array.isArray(context))
  ) {
    return errorResult("context must be a plain object");
  }

  const config = loadConfig();
  const response = await authorize(
    {
      actor,
      action,
      resource,
      ...(amount !== undefined ? { amount: amount as number } : {}),
      ...(context !== undefined
        ? { context: context as Record<string, unknown> }
        : {}),
    },
    { policyPath: config.policyPath, ledgerPath: config.ledgerPath },
  );

  return text(JSON.stringify(response, null, 2));
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  if (name === "authorize_action") {
    return handleAuthorizeAction(args);
  }

  return {
    content: [
      {
        type: "text",
        text: `Tool "${name}" is not yet implemented.`,
      },
    ],
    isError: true,
  };
}
