import { resolveShotokuPaths } from "@shotoku/core";

export interface GatewayConfig {
  readonly policyPath: string;
  readonly ledgerPath: string;
  readonly port: number;
  /** Actor recorded when a proxied request has no `X-Shotoku-Actor` header. */
  readonly defaultActor: string;
}

const DEFAULT_PORT = 8788;

/**
 * Load gateway config, resolving paths through the shared resolver in core.
 *
 * This package used to resolve paths on its own, and did it differently from
 * everyone else: environment variables only, no config file, and a path left
 * relative to the working directory. Since the ledger lock is keyed on the path
 * string, that relative path produced a different lockfile than the absolute one
 * the CLI used, so the gateway and the CLI never actually excluded each other.
 */
export async function loadConfig(): Promise<GatewayConfig> {
  const portRaw = process.env["SHOTOKU_GATEWAY_PORT"];
  const port = portRaw ? Number.parseInt(portRaw, 10) : DEFAULT_PORT;
  const paths = await resolveShotokuPaths();

  return {
    policyPath: paths.policy.path,
    ledgerPath: paths.ledger.path,
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    defaultActor: process.env["SHOTOKU_GATEWAY_ACTOR"] ?? "gateway",
  };
}
