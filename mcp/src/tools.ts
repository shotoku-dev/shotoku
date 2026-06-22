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
];
