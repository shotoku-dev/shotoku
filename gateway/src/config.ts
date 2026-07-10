export interface GatewayConfig {
  readonly policyPath: string;
  readonly ledgerPath: string;
  readonly port: number;
  /** Actor recorded when a proxied request has no `X-Shotoku-Actor` header. */
  readonly defaultActor: string;
}

const DEFAULT_PORT = 8788;

/** Load gateway config from the environment, with safe local defaults. */
export function loadConfig(): GatewayConfig {
  const portRaw = process.env["SHOTOKU_GATEWAY_PORT"];
  const port = portRaw ? Number.parseInt(portRaw, 10) : DEFAULT_PORT;

  return {
    policyPath: process.env["SHOTOKU_POLICY"] ?? "policy.yaml",
    ledgerPath: process.env["SHOTOKU_LEDGER"] ?? "data/decisions.jsonl",
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    defaultActor: process.env["SHOTOKU_GATEWAY_ACTOR"] ?? "gateway",
  };
}
