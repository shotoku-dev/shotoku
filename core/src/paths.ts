import { mkdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { ShotokuError, errorCode, errorMessage } from "./errors.js";

/**
 * One file, one name.
 *
 * The ledger lock is keyed on the path *string* — `${ledgerPath}.lock` — not on
 * the inode. Two spellings of the same file therefore produce two different
 * lockfiles and no mutual exclusion at all: concurrent writers each believe they
 * hold the lock, both compute the same chain position, and the hash chain breaks
 * permanently. Windows drive-letter casing (`C:\` vs `c:\`), a symlinked
 * directory, or a `..` segment are all enough to trigger it.
 *
 * Canonicalising every path at the edges is what makes cross-process
 * serialisation — and, with it, consuming a one-shot grant exactly once —
 * actually hold.
 */

/**
 * Resolves a path to a single canonical absolute form.
 *
 * `realpath` cannot be used directly: it throws ENOENT for a file that does not
 * exist yet, which is every first run. So the deepest *existing* ancestor is
 * canonicalised and the remaining segments are re-joined onto it. On Windows
 * this fixes the casing of every component that is already on disk; the final
 * segment's casing stays as written until the file exists, which is a residual
 * we accept — `ensureLedgerDir` creates the parent before any write, so by the
 * time two processes can contend, the directory is real and canonical.
 */
export async function canonicalizePath(path: string): Promise<string> {
  const absolute = isAbsolute(path) ? path : resolve(path);

  // Segments peeled off the end, deepest first, while walking up to something
  // that exists. `basename` is used rather than slicing so no separator
  // handling differs between platforms.
  const missing: string[] = [];
  let current = absolute;

  for (;;) {
    try {
      const real = await realpath(current);
      if (missing.length === 0) return real;
      return resolve(real, ...missing.slice().reverse());
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }

    const parent = dirname(current);
    // Walked all the way to the root without finding anything real.
    if (parent === current) return absolute;

    missing.push(basename(current));
    current = parent;
  }
}

/**
 * Canonicalises a ledger path, creating its directory first so the result is
 * stable from the very first call. Use this wherever a ledger path enters the
 * system from outside — config resolution, or a raw string handed to the SDK.
 */
export async function canonicalizeLedgerPath(ledgerPath: string): Promise<string> {
  const absolute = isAbsolute(ledgerPath) ? ledgerPath : resolve(ledgerPath);
  await mkdir(dirname(absolute), { recursive: true });
  return canonicalizePath(absolute);
}

/** True when two paths name the same file. Comparison is exact after canonicalising. */
export async function isSameLedger(a: string, b: string): Promise<boolean> {
  const [ca, cb] = await Promise.all([canonicalizePath(a), canonicalizePath(b)]);
  return ca === cb;
}

/** Exported for tests that need to reason about separators across platforms. */
export const PATH_SEPARATOR = sep;

/** Where a resolved path came from. Surfaced verbatim by `shotoku where`. */
export type PathSource = "flag" | "env" | "config" | "project" | "home";

export interface ResolvedPath {
  readonly path: string;
  readonly source: PathSource;
  /** The flag, env var, config file, or directory that decided it. */
  readonly origin: string;
}

export interface ShotokuPaths {
  readonly policy: ResolvedPath;
  readonly ledger: ResolvedPath;
  readonly home: string;
  /** The config file that was found and read, if any. */
  readonly configPath?: string;
}

export interface ResolvePathsOptions {
  /** Explicit --policy / --ledger / --config, highest precedence. */
  readonly policy?: string;
  readonly ledger?: string;
  readonly config?: string;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

interface ConfigFileShape {
  readonly policyPath?: string;
  readonly ledgerPath?: string;
}

const CONFIG_FILENAME = "shotoku.config.json";
const DEFAULT_POLICY = "policy.yaml";
const DEFAULT_LEDGER = "data/decisions.jsonl";
const SUPPORTED_CONFIG_VERSIONS = new Set(["1"]);

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walks up from `cwd` looking for a config file, so running a command from a
 * subdirectory of a project still finds it. Resolution used to be strictly cwd,
 * which meant `shotoku history` one directory too deep silently fell back to
 * defaults and printed an empty table.
 */
async function findConfigUpwards(cwd: string): Promise<string | undefined> {
  // The search stops before the user home directory. A config file sitting at
  // the root of a home directory would otherwise silently capture every project
  // beneath it, which is almost never what someone means -- and that role
  // already belongs to $SHOTOKU_HOME, which says so explicitly.
  const stopAt = resolve(homedir());
  let current = resolve(cwd);

  for (;;) {
    if (current === stopAt) return undefined;

    const candidate = join(current, CONFIG_FILENAME);
    if (await exists(candidate)) return candidate;

    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function parseConfigFile(raw: string, configPath: string): ConfigFileShape {
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

  // `version` has been written since the first release but never read. Reading
  // it is what makes a future format change safe to detect.
  const version = value["version"];
  if (version !== undefined) {
    const asString = typeof version === "number" ? String(version) : version;
    if (typeof asString !== "string" || !SUPPORTED_CONFIG_VERSIONS.has(asString)) {
      throw new ShotokuError(
        "config_invalid",
        `Config file "${configPath}" declares unsupported version ${JSON.stringify(version)}.`,
      );
    }
  }

  for (const key of ["policyPath", "ledgerPath"] as const) {
    const entry = value[key];
    if (entry !== undefined && typeof entry !== "string") {
      throw new ShotokuError("config_invalid", `config.${key} must be a string.`);
    }
  }

  return {
    ...(typeof value["policyPath"] === "string" ? { policyPath: value["policyPath"] } : {}),
    ...(typeof value["ledgerPath"] === "string" ? { ledgerPath: value["ledgerPath"] } : {}),
  };
}

/**
 * The single place any Shotoku process decides which policy and which ledger it
 * is talking to. The CLI, the MCP server and the gateway all route through it,
 * because when they disagreed the writer and the reader silently used different
 * files — an approval queue that displayed as empty while an action waited.
 *
 * Precedence, highest first:
 *   1. an explicit flag
 *   2. SHOTOKU_POLICY / SHOTOKU_LEDGER
 *   3. a shotoku.config.json found by walking up from the working directory
 *   4. an existing ./data/decisions.jsonl beside the working directory
 *   5. $SHOTOKU_HOME, else ~/.shotoku
 *
 * Rule 4 exists so upgrading never appears to erase a history: a project that
 * predates the home directory keeps its ledger until it is moved deliberately.
 */
export async function resolveShotokuPaths(
  options: ResolvePathsOptions = {},
): Promise<ShotokuPaths> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const home = resolve(trimmed(env["SHOTOKU_HOME"]) ?? join(homedir(), ".shotoku"));

  const explicitConfig = trimmed(options.config) ?? trimmed(env["SHOTOKU_CONFIG"]);
  const configPath = explicitConfig
    ? resolve(cwd, explicitConfig)
    : await findConfigUpwards(cwd);

  let config: ConfigFileShape = {};
  if (configPath !== undefined) {
    try {
      config = parseConfigFile(await readFile(configPath, "utf8"), configPath);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      // A config named explicitly and missing is a mistake worth reporting; one
      // merely looked for while walking up is not.
      if (explicitConfig) {
        throw new ShotokuError(
          "config_invalid",
          `Config file "${configPath}" does not exist.`,
        );
      }
    }
  }

  const configDir = configPath === undefined ? undefined : dirname(configPath);

  async function pick(
    flag: string | undefined,
    envName: string,
    flagName: string,
    fromConfig: string | undefined,
    relative: string,
  ): Promise<ResolvedPath> {
    const flagValue = trimmed(flag);
    if (flagValue) {
      return {
        path: await canonicalizePath(resolve(cwd, flagValue)),
        source: "flag",
        origin: flagName,
      };
    }

    const envValue = trimmed(env[envName]);
    if (envValue) {
      return {
        path: await canonicalizePath(resolve(cwd, envValue)),
        source: "env",
        origin: envName,
      };
    }

    if (fromConfig !== undefined && configDir !== undefined && configPath !== undefined) {
      return {
        path: await canonicalizePath(resolve(configDir, fromConfig)),
        source: "config",
        origin: configPath,
      };
    }

    const legacy = resolve(cwd, relative);
    if (configPath === undefined && (await exists(legacy))) {
      return { path: await canonicalizePath(legacy), source: "project", origin: cwd };
    }

    return {
      path: await canonicalizePath(join(home, relative)),
      source: "home",
      origin: home,
    };
  }

  const [policy, ledger] = await Promise.all([
    pick(options.policy, "SHOTOKU_POLICY", "--policy", config.policyPath, DEFAULT_POLICY),
    pick(options.ledger, "SHOTOKU_LEDGER", "--ledger", config.ledgerPath, DEFAULT_LEDGER),
  ]);

  return {
    policy,
    ledger,
    home,
    ...(configPath !== undefined ? { configPath } : {}),
  };
}

/** One human-readable phrase naming what decided a path, for `shotoku where`. */
export function describePathSource(resolved: ResolvedPath): string {
  switch (resolved.source) {
    case "flag":
      return `flag ${resolved.origin}`;
    case "env":
      return `$${resolved.origin}`;
    case "config":
      return `config file ${resolved.origin}`;
    case "project":
      return `existing project file under ${resolved.origin}`;
    case "home":
      return `Shotoku home ${resolved.origin}`;
  }
}
