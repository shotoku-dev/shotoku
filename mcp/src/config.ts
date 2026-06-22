export interface ShotokuConfig {
  readonly policyPath: string;
  readonly ledgerPath: string;
}

export function loadConfig(): ShotokuConfig {
  return {
    policyPath: process.env["SHOTOKU_POLICY"] ?? "policy.yaml",
    ledgerPath: process.env["SHOTOKU_LEDGER"] ?? "data/decisions.jsonl",
  };
}
