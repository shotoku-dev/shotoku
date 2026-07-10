import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { validatePolicy } from "@shotoku/core";

/**
 * Fail closed at boot: throw if the policy at `policyPath` is missing or invalid.
 * A security proxy with no valid policy must refuse to start — better to fail
 * loudly at startup than to silently deny every request at runtime.
 */
export function assertPolicyLoads(policyPath: string): void {
  let raw: string;
  try {
    raw = readFileSync(policyPath, "utf8");
  } catch {
    throw new Error(`policy file not found at "${policyPath}"`);
  }
  // Throws a ShotokuError if the parsed policy has an invalid shape.
  validatePolicy(parse(raw));
}
