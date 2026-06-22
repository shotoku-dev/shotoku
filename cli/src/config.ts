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

export async function resolveRuntimePaths(
  options: RuntimePathOptions,
  cwd: string = process.cwd(),
): Promise<RuntimePaths> {
  const configPath = resolve(cwd, options.config ?? "shotoku.config.json");
  const config = await loadConfig(configPath);
  const configDir = dirname(configPath);

  const policyPath = options.policy ?? config?.policyPath ?? "policy.yaml";
  const ledgerPath = options.ledger ?? config?.ledgerPath ?? "data/decisions.jsonl";

  return {
    policyPath: resolveFrom(options.policy ? cwd : configDir, policyPath),
    ledgerPath: resolveFrom(options.ledger ? cwd : configDir, ledgerPath),
  };
}
