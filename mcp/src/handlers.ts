import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  authorize,
  approve,
  deny,
  getDecisionById,
  getPendingApprovals,
  isAgentAction,
  toUserSafeMessage,
  validActions,
} from "@shotoku/core";
import { loadConfig } from "./config.js";

const VALID_ACTIONS = validActions();

function text(content: string): CallToolResult {
  return { content: [{ type: "text", text: content }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function jsonResult(content: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
    structuredContent: content,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  if (
    amount !== undefined &&
    (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
  ) {
    return errorResult("amount must be a non-negative number");
  }
  if (context !== undefined && !isPlainRecord(context)) {
    return errorResult("context must be a plain object");
  }

  const config = await loadConfig();
  const receiptSecret = process.env["SHOTOKU_RECEIPT_SECRET"];
  const response = await authorize(
    {
      actor,
      action,
      resource,
      ...(amount !== undefined ? { amount } : {}),
      ...(context !== undefined ? { context } : {}),
    },
    {
      policyPath: config.policyPath,
      ledgerPath: config.ledgerPath,
      ...(receiptSecret?.trim() ? { receiptSecret } : {}),
    },
  );

  return jsonResult({ response });
}

async function handleGetDecision(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { decisionId } = args;
  if (typeof decisionId !== "string" || !decisionId) {
    return errorResult("Missing required argument: decisionId");
  }

  const config = await loadConfig();
  const entry = await getDecisionById(config.ledgerPath, decisionId);

  if (!entry) {
    return errorResult(`Decision "${decisionId}" not found.`);
  }

  return jsonResult({ decision: entry });
}

async function handleGetPendingApprovals(): Promise<CallToolResult> {
  const config = await loadConfig();
  const pending = await getPendingApprovals(config.ledgerPath);

  if (pending.length === 0) {
    return text("No pending approvals.");
  }

  return jsonResult({ pending });
}

async function handleApprovalAction(
  args: Record<string, unknown>,
  verdict: "approved" | "denied",
): Promise<CallToolResult> {
  const { decisionId } = args;
  if (typeof decisionId !== "string" || !decisionId) {
    return errorResult("Missing required argument: decisionId");
  }

  const config = await loadConfig();

  try {
    const approval =
      verdict === "approved"
        ? await approve(decisionId, { ledgerPath: config.ledgerPath })
        : await deny(decisionId, { ledgerPath: config.ledgerPath });
    return jsonResult({ approval });
  } catch (error) {
    return errorResult(toUserSafeMessage(error));
  }
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  if (name === "authorize_action") return handleAuthorizeAction(args);
  if (name === "get_decision") return handleGetDecision(args);
  if (name === "get_pending_approvals") return handleGetPendingApprovals();
  if (name === "approve_decision") return handleApprovalAction(args, "approved");
  if (name === "deny_decision") return handleApprovalAction(args, "denied");

  return {
    content: [{ type: "text", text: `Unknown tool: "${name}".` }],
    isError: true,
  };
}
