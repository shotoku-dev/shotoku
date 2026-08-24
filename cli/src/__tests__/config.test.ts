import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRuntimePaths } from "../config.js";

describe("resolveRuntimePaths", () => {
  it("uses shotoku.config.json when present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-config-test-"));
    await writeFile(
      join(dir, "shotoku.config.json"),
      JSON.stringify({
        policyPath: "config/policy.yaml",
        ledgerPath: "logs/decisions.jsonl",
      }),
      "utf8",
    );

    const paths = await resolveRuntimePaths({}, dir);

    expect(paths.policyPath).toBe(join(dir, "config/policy.yaml"));
    expect(paths.ledgerPath).toBe(join(dir, "logs/decisions.jsonl"));
  });

  it("lets explicit CLI paths override config paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-config-test-"));
    await writeFile(
      join(dir, "shotoku.config.json"),
      JSON.stringify({
        policyPath: "config/policy.yaml",
        ledgerPath: "logs/decisions.jsonl",
      }),
      "utf8",
    );

    const paths = await resolveRuntimePaths(
      { policy: "policy.override.yaml", ledger: "ledger.override.jsonl" },
      dir,
    );

    expect(paths.policyPath).toBe(join(dir, "policy.override.yaml"));
    expect(paths.ledgerPath).toBe(join(dir, "ledger.override.jsonl"));
  });

  it("falls back to conventional paths when no config exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-config-test-"));

    const paths = await resolveRuntimePaths({}, dir);

    expect(paths.policyPath).toBe(join(dir, "policy.yaml"));
    expect(paths.ledgerPath).toBe(join(dir, "data/decisions.jsonl"));
  });
});

/**
 * The MCP server writes pending approvals to the path in SHOTOKU_LEDGER. Until
 * the CLI read the same variable, `shotoku status` from any other directory
 * reported "No pending approvals" while a gated destructive action was waiting.
 */
describe("resolveRuntimePaths — environment", () => {
  let previousPolicy: string | undefined;
  let previousLedger: string | undefined;

  beforeEach(() => {
    previousPolicy = process.env["SHOTOKU_POLICY"];
    previousLedger = process.env["SHOTOKU_LEDGER"];
    delete process.env["SHOTOKU_POLICY"];
    delete process.env["SHOTOKU_LEDGER"];
  });

  afterEach(() => {
    restore("SHOTOKU_POLICY", previousPolicy);
    restore("SHOTOKU_LEDGER", previousLedger);
  });

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  async function withConfig(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-config-env-"));
    await writeFile(
      join(dir, "shotoku.config.json"),
      JSON.stringify({
        policyPath: "config/policy.yaml",
        ledgerPath: "logs/decisions.jsonl",
      }),
      "utf8",
    );
    return dir;
  }

  it("reads the ledger the MCP server writes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-config-env-"));
    const shared = join(dir, "shotoku-home", "data", "decisions.jsonl");
    process.env["SHOTOKU_LEDGER"] = shared;

    // cwd is somewhere unrelated, exactly as when running `shotoku status`
    // from another directory.
    const paths = await resolveRuntimePaths({}, tmpdir());

    expect(paths.ledgerPath).toBe(shared);
  });

  it("puts the environment above the config file", async () => {
    const dir = await withConfig();
    process.env["SHOTOKU_POLICY"] = join(dir, "env-policy.yaml");
    process.env["SHOTOKU_LEDGER"] = join(dir, "env-ledger.jsonl");

    const paths = await resolveRuntimePaths({}, dir);

    expect(paths.policyPath).toBe(join(dir, "env-policy.yaml"));
    expect(paths.ledgerPath).toBe(join(dir, "env-ledger.jsonl"));
  });

  it("still lets an explicit flag beat the environment", async () => {
    const dir = await withConfig();
    process.env["SHOTOKU_LEDGER"] = join(dir, "env-ledger.jsonl");

    const paths = await resolveRuntimePaths({ ledger: "flag-ledger.jsonl" }, dir);

    expect(paths.ledgerPath).toBe(join(dir, "flag-ledger.jsonl"));
  });

  it("resolves a relative env path against the working directory", async () => {
    const dir = await withConfig();
    process.env["SHOTOKU_LEDGER"] = "relative/decisions.jsonl";

    const paths = await resolveRuntimePaths({}, dir);

    expect(paths.ledgerPath).toBe(join(dir, "relative/decisions.jsonl"));
  });

  it("ignores an env var set to an empty string", async () => {
    const dir = await withConfig();
    process.env["SHOTOKU_LEDGER"] = "   ";

    const paths = await resolveRuntimePaths({}, dir);

    expect(paths.ledgerPath).toBe(join(dir, "logs/decisions.jsonl"));
  });

  it("changes nothing when the environment is unset", async () => {
    const dir = await withConfig();

    const paths = await resolveRuntimePaths({}, dir);

    expect(paths.policyPath).toBe(join(dir, "config/policy.yaml"));
    expect(paths.ledgerPath).toBe(join(dir, "logs/decisions.jsonl"));
  });
});
