import { describe, expect, it } from "vitest";
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
