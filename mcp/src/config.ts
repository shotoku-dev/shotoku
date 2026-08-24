import { resolveShotokuPaths } from "@shotoku/core";

export interface ShotokuConfig {
  readonly policyPath: string;
  readonly ledgerPath: string;
}

/**
 * Delegates to the shared resolver in core. The MCP server is usually spawned by
 * an agent host with a working directory it did not choose — often the
 * filesystem root — so the home-directory fallback matters more here than
 * anywhere else: without it the server silently created its own ledger under the
 * root and nothing else on the machine could see it.
 */
export async function loadConfig(): Promise<ShotokuConfig> {
  const paths = await resolveShotokuPaths();
  return { policyPath: paths.policy.path, ledgerPath: paths.ledger.path };
}
