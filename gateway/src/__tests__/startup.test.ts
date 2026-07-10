import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertPolicyLoads } from "../startup.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "shotoku-gw-boot-"));
});

describe("assertPolicyLoads (fail closed at boot)", () => {
  it("does not throw for a valid policy", async () => {
    const policyPath = join(dir, "policy.yaml");
    await writeFile(policyPath, `rules:\n  - resource: openai.com\n    verdict: approved\n`);

    expect(() => assertPolicyLoads(policyPath)).not.toThrow();
  });

  it("throws when the policy file is missing", () => {
    expect(() => assertPolicyLoads(join(dir, "nope.yaml"))).toThrow(/not found/i);
  });

  it("throws when the policy shape is invalid", async () => {
    const policyPath = join(dir, "bad.yaml");
    await writeFile(policyPath, `rules:\n  - resource: openai.com\n    verdict: maybe\n`);

    expect(() => assertPolicyLoads(policyPath)).toThrow();
  });
});
