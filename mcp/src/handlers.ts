import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  authorize,
  getDecisionById,
  getPendingApprovals,
  type AgentAction,
} from "@shotoku/core";
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

async function handleGetDecision(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { decisionId } = args;
  if (typeof decisionId !== "string" || !decisionId) {
    return errorResult("Missing required argument: decisionId");
  }

  const config = loadConfig();
  const entry = await getDecisionById(config.ledgerPath, decisionId);

  if (!entry) {
    return errorResult(`Decision "${decisionId}" not found.`);
  }

  return text(JSON.stringify(entry, null, 2));
}

async function handleGetPendingApprovals(): Promise<CallToolResult> {
  const config = loadConfig();
  const pending = await getPendingApprovals(config.ledgerPath);

  if (pending.length === 0) {
    return text("No pending approvals.");
  }

  return text(JSON.stringify(pending, null, 2));
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  if (name === "authorize_action") return handleAuthorizeAction(args);
  if (name === "get_decision") return handleGetDecision(args);
  if (name === "get_pending_approvals") return handleGetPendingApprovals();

  return {
    content: [{ type: "text", text: `Unknown tool: "${name}".` }],
    isError: true,
  };
}
