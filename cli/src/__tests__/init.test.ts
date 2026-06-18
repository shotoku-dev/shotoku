import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../init.js";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "shotoku-init-test-"));
});

describe("runInit", () => {
  it("creates policy.yaml, shotoku.config.json, and data/", async () => {
    await runInit(dir);

    expect(await fileExists(join(dir, "policy.yaml"))).toBe(true);
    expect(await fileExists(join(dir, "shotoku.config.json"))).toBe(true);
    expect(await fileExists(join(dir, "data"))).toBe(true);
  });

  it("policy.yaml contains defaultVerdict", async () => {
    await runInit(dir);
    const content = await readFile(join(dir, "policy.yaml"), "utf8");
    expect(content).toContain("defaultVerdict");
  });

  it("shotoku.config.json is valid JSON with policyPath and ledgerPath", async () => {
    await runInit(dir);
    const raw = await readFile(join(dir, "shotoku.config.json"), "utf8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    expect(config.policyPath).toBe("policy.yaml");
    expect(config.ledgerPath).toBe("data/decisions.jsonl");
  });

  it("skips existing files without overwriting and reports them", async () => {
    await runInit(dir);
    const originalPolicy = await readFile(join(dir, "policy.yaml"), "utf8");

    const result = await runInit(dir);
    expect(result.skipped).toContain("policy.yaml");
    expect(result.skipped).toContain("shotoku.config.json");

    const afterPolicy = await readFile(join(dir, "policy.yaml"), "utf8");
    expect(afterPolicy).toBe(originalPolicy);
  });

  it("reports created files on first run", async () => {
    const result = await runInit(dir);
    expect(result.created).toContain("policy.yaml");
    expect(result.created).toContain("shotoku.config.json");
    expect(result.created).toContain("data/");
  });
});
