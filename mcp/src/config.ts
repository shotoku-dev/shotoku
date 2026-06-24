import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { ShotokuError, errorCode, errorMessage } from "@shotoku/core";

export interface ShotokuConfig {
  readonly policyPath: string;
  readonly ledgerPath: string;
}

interface ConfigFile {
  readonly policyPath?: string;
  readonly ledgerPath?: string;
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

async function loadConfigFile(configPath: string): Promise<ConfigFile | undefined> {
  try {
    const raw = await readFile(configPath, "utf8");
    return parseConfig(raw, configPath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

export async function loadConfig(): Promise<ShotokuConfig> {
  const cwd = process.cwd();
  const configPath = resolve(cwd, process.env["SHOTOKU_CONFIG"] ?? "shotoku.config.json");
  const config = await loadConfigFile(configPath);
  const configDir = dirname(configPath);
  const policyPath =
    process.env["SHOTOKU_POLICY"] ?? config?.policyPath ?? "policy.yaml";
  const ledgerPath =
    process.env["SHOTOKU_LEDGER"] ?? config?.ledgerPath ?? "data/decisions.jsonl";

  return {
    policyPath: resolveFrom(process.env["SHOTOKU_POLICY"] ? cwd : configDir, policyPath),
    ledgerPath: resolveFrom(process.env["SHOTOKU_LEDGER"] ? cwd : configDir, ledgerPath),
  };
}
