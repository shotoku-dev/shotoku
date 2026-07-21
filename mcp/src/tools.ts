import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const tools: Tool[] = [
  {
    name: "authorize_action",
    description:
      "Evaluate whether an agent is allowed to perform an action. Returns a full authorization decision with reasons.",
    inputSchema: {
      type: "object",
      properties: {
        actor: {
          type: "string",
          description: "Identifier for the agent or user making the request.",
        },
        action: {
          type: "string",
          enum: [
            "purchase",
            "api_call",
            "execute_code",
            "send_email",
            "mcp_tool",
            "custom",
          ],
          description: "The type of action being requested.",
        },
        resource: {
          type: "string",
          description: "The resource or vendor being accessed (e.g. openai.com).",
        },
        amount: {
          type: "number",
          description: "Optional transaction amount in USD.",
        },
        context: {
          type: "object",
          description: "Optional key-value metadata about the request.",
          additionalProperties: true,
        },
      },
      required: ["actor", "action", "resource"],
    },
  },
  {
    name: "get_decision",
    description: "Retrieve full detail for a single authorization decision by ID.",
    inputSchema: {
      type: "object",
      properties: {
        decisionId: {
          type: "string",
          description: "The decision ID (e.g. dec_abc123).",
        },
      },
      required: ["decisionId"],
    },
  },
  {
    name: "get_pending_approvals",
    description: "List all authorization decisions that are pending human approval.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "approve_decision",
    description: "Approve a pending authorization decision by ID.",
    inputSchema: {
      type: "object",
      properties: {
        decisionId: {
          type: "string",
          description: "The pending decision ID (e.g. dec_abc123).",
        },
      },
      required: ["decisionId"],
    },
  },
  {
    name: "deny_decision",
    description: "Deny a pending authorization decision by ID.",
    inputSchema: {
      type: "object",
      properties: {
        decisionId: {
          type: "string",
          description: "The pending decision ID (e.g. dec_abc123).",
        },
      },
      required: ["decisionId"],
    },
  },
];

/**
 * Tools an agent must not be able to call while Shotoku is gating it — an agent
 * that can approve its own pending decisions defeats the entire point.
 */
export const APPROVAL_TOOLS: ReadonlySet<string> = new Set([
  "approve_decision",
  "deny_decision",
]);

/**
 * Shotoku's own tools. Approval tools are withheld unless explicitly enabled
 * (`SHOTOKU_MCP_ALLOW_APPROVALS=1`) for a trusted, human-driven session.
 * Approvals normally happen out-of-band: the CLI, the TUI, or Slack.
 */
export function shotokuTools(allowApprovals: boolean): Tool[] {
  return allowApprovals ? tools : tools.filter((t) => !APPROVAL_TOOLS.has(t.name));
}
