import {
  authorize,
  type AuthorizationStatus,
  type Explanation,
  type ReasonItem,
} from "@shotoku/core";

/** Separator between an upstream server name and its tool name. */
const SEPARATOR = "__";

/**
 * The name a wrapped upstream tool is exposed under, e.g.
 * `github` + `create_issue` → `github__create_issue`.
 *
 * This same string is used as the policy `resource`, so one identifier covers
 * both what the agent calls and what the policy matches — glob rules like
 * `github__*` work directly.
 */
export function wrappedToolName(server: string, tool: string): string {
  return `${server}${SEPARATOR}${tool}`;
}

/** Split a wrapped tool name back into its server and tool. Null if not wrapped. */
export function parseWrappedToolName(
  name: string,
): { readonly server: string; readonly tool: string } | null {
  const index = name.indexOf(SEPARATOR);
  if (index <= 0) return null;

  const server = name.slice(0, index);
  const tool = name.slice(index + SEPARATOR.length);
  if (!server || !tool) return null;

  return { server, tool };
}

/** `pass` → forward to the upstream server; `block` → refuse the call. */
export type WrapOutcome = "pass" | "block";

export interface WrapDecision {
  readonly outcome: WrapOutcome;
  readonly status: AuthorizationStatus;
  readonly decisionId: string;
  readonly reasons: readonly ReasonItem[];
  readonly explanation: Explanation;
}

export interface WrapAuthorizeOptions {
  readonly policyPath: string;
  readonly ledgerPath: string;
  readonly actor: string;
}

/**
 * The gate for a wrapped MCP tool call — the MCP twin of the HTTP gateway.
 * Maps the call onto an `AuthorizeRequest`, runs the *same* `authorize()` the
 * CLI and gateway use, and collapses the verdict to pass/block.
 *
 * Modelled as `action: "mcp_tool"` on the `mcp` rail, with the wrapped tool name
 * as the resource. Only the argument *keys* are recorded in the audit context —
 * never the values — because tool arguments routinely carry secrets.
 */
export async function authorizeToolCall(
  server: string,
  tool: string,
  args: Record<string, unknown>,
  options: WrapAuthorizeOptions,
): Promise<WrapDecision> {
  const response = await authorize(
    {
      actor: options.actor,
      action: "mcp_tool",
      resource: wrappedToolName(server, tool),
      rail: "mcp",
      context: {
        server,
        tool,
        argumentKeys: Object.keys(args),
      },
    },
    { policyPath: options.policyPath, ledgerPath: options.ledgerPath },
  );

  return {
    outcome: response.approved ? "pass" : "block",
    status: response.status,
    decisionId: response.decisionId,
    reasons: response.reasons,
    explanation: response.explanation,
  };
}

/**
 * What the agent gets back when Shotoku refuses a wrapped tool call. It states
 * plainly that the agent cannot approve this itself — a human must do it
 * out-of-band — which is the whole point of the separation.
 */
export function blockedToolMessage(decision: WrapDecision): string {
  const lines = [
    `Blocked by Shotoku — this action was not authorized.`,
    `  status:   ${decision.status}`,
    `  decision: ${decision.decisionId}`,
    `  reason:   ${decision.explanation.summary}`,
  ];

  if (decision.status === "pending_approval") {
    lines.push(
      `  A human must approve this out-of-band (\`shotoku approve ${decision.decisionId}\`,`,
      `  the Shotoku TUI, or Slack). You cannot approve it yourself — ask the user,`,
      `  then retry this tool call.`,
    );
  } else {
    lines.push(`  This is a final denial. Do not retry; tell the user why.`);
  }

  return lines.join("\n");
}
