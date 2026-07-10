import {
  authorize,
  type AuthorizationStatus,
  type Explanation,
  type ReasonItem,
} from "@shotoku/core";

/** The pieces of an intercepted HTTP request the gateway needs to decide. */
export interface GatewayHttpRequest {
  readonly method: string;
  /** Target host, e.g. "api.openai.com". */
  readonly host: string;
  /** Target path, e.g. "/v1/chat/completions" (default "/"). */
  readonly path: string;
  /** The acting agent, from the `X-Shotoku-Actor` header or the configured default. */
  readonly actor: string;
}

export interface GatewayAuthorizeOptions {
  readonly policyPath: string;
  readonly ledgerPath: string;
}

/** `pass` → forward the request; `block` → refuse it (denied or pending). */
export type GatewayOutcome = "pass" | "block";

export interface GatewayDecision {
  readonly outcome: GatewayOutcome;
  readonly status: AuthorizationStatus;
  readonly decisionId: string;
  readonly reasons: readonly ReasonItem[];
  readonly explanation: Explanation;
}

/**
 * The gateway's decision core. Maps an intercepted HTTP request onto an
 * `AuthorizeRequest`, runs it through the *same* `authorize()` the CLI and MCP
 * use (so the policy engine and ledger stay the single source of truth), and
 * collapses the verdict into pass/block.
 *
 * The request is modelled as an `api_call` on the `api` rail. The resource is
 * `host + path`, so glob rules like `api.openai.com/v1/*` work directly. The
 * method/host/path are recorded in `context` for the audit trail.
 *
 * This function does no networking — it only decides. The server layer forwards
 * or refuses based on the returned `outcome`.
 */
export async function authorizeHttpRequest(
  request: GatewayHttpRequest,
  options: GatewayAuthorizeOptions,
): Promise<GatewayDecision> {
  const resource = `${request.host}${request.path}`;

  const response = await authorize(
    {
      actor: request.actor,
      action: "api_call",
      resource,
      rail: "api",
      context: {
        method: request.method,
        host: request.host,
        path: request.path,
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
