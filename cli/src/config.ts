import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { ShotokuError, errorCode, errorMessage } from "@shotoku/core";

interface ConfigFile {
  readonly policyPath?: string;
  readonly ledgerPath?: string;
}

export interface RuntimePathOptions {
  readonly policy?: string;
  readonly ledger?: string;
  readonly config?: string;
}

export interface RuntimePaths {
  readonly policyPath: string;
  readonly ledgerPath: string;
}

function resolveFrom(baseDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(baseDir, path);
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseConfig(raw: string, configPath: string): ConfigFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ShotokuError(
      "config_invalid",
      `Config file "${configPath}" is not valid JSON: ${errorMessage(error)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ShotokuError(
      "config_invalid",
      `Config file "${configPath}" must contain a JSON object.`,
    );
  }

  const value = parsed as Record<string, unknown>;
  const policyPath = value["policyPath"];
  const ledgerPath = value["ledgerPath"];

  if (policyPath !== undefined && typeof policyPath !== "string") {
    throw new ShotokuError("config_invalid", "config.policyPath must be a string.");
  }
  if (ledgerPath !== undefined && typeof ledgerPath !== "string") {
    throw new ShotokuError("config_invalid", "config.ledgerPath must be a string.");
  }

  return {
    ...(policyPath !== undefined ? { policyPath } : {}),
    ...(ledgerPath !== undefined ? { ledgerPath } : {}),
  };
}

async function loadConfig(configPath: string): Promise<ConfigFile | undefined> {
  try {
    const raw = await readFile(configPath, "utf8");
    return parseConfig(raw, configPath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * SHOTOKU_POLICY and SHOTOKU_LEDGER sit above the config file, matching the MCP
 * server's precedence exactly (mcp/src/config.ts). They have to: the MCP server
 * writes pending approvals to the path in its environment, and a CLI that
 * ignored that variable showed an empty approval queue while a gated action was
 * waiting. For an approval tool, silently displaying "nothing to review" when
 * there is something to review fails on the unsafe side.
 *
 * Reading env below the config file would leave the two diverging for anyone who
 * has both, which is the bug itself.
 */
export async function resolveRuntimePaths(
  options: RuntimePathOptions,
  cwd: string = process.cwd(),
): Promise<RuntimePaths> {
  const configPath = resolve(cwd, options.config ?? "shotoku.config.json");
  const config = await loadConfig(configPath);
  const configDir = dirname(configPath);

  // An env var set to an empty string is a misconfiguration, not a path.
  const envPolicy = nonEmpty(process.env["SHOTOKU_POLICY"]);
  const envLedger = nonEmpty(process.env["SHOTOKU_LEDGER"]);

  const policyOverride = options.policy ?? envPolicy;
  const ledgerOverride = options.ledger ?? envLedger;

  const policyPath = policyOverride ?? config?.policyPath ?? "policy.yaml";
  const ledgerPath = ledgerOverride ?? config?.ledgerPath ?? "data/decisions.jsonl";

  // A flag or an env value is relative to where the user is standing; a config
  // file value is relative to the config file.
  return {
    policyPath: resolveFrom(policyOverride === undefined ? configDir : cwd, policyPath),
    ledgerPath: resolveFrom(ledgerOverride === undefined ? configDir : cwd, ledgerPath),
  };
}
