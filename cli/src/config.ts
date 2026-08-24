import { resolveShotokuPaths, type ShotokuPaths } from "@shotoku/core";

export interface RuntimePathOptions {
  readonly policy?: string;
  readonly ledger?: string;
  readonly config?: string;
}

export interface RuntimePaths {
  readonly policyPath: string;
  readonly ledgerPath: string;
}

/**
 * Path resolution lives in core so the CLI, the MCP server and the gateway
 * cannot disagree. They used to: three near-identical resolvers with three
 * different precedence chains meant the process writing a decision and the
 * process reading it could silently land on different files, and
 * `shotoku status` reported an empty approval queue while an action waited.
 */
export async function resolveRuntimePaths(
  options: RuntimePathOptions,
  cwd: string = process.cwd(),
): Promise<RuntimePaths> {
  const paths = await resolveShotokuPaths({ ...options, cwd });
  return { policyPath: paths.policy.path, ledgerPath: paths.ledger.path };
}

/** The full resolution, including what decided each path. Used by `shotoku where`. */
export async function explainRuntimePaths(
  options: RuntimePathOptions,
  cwd: string = process.cwd(),
): Promise<ShotokuPaths> {
  return resolveShotokuPaths({ ...options, cwd });
}
