import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { AuthorizationStatus } from "@shotoku/core";

const POLICY_YAML = `# Shotoku policy
# Docs: https://github.com/shotoku-dev/shotoku

rules:
  # Allow OpenAI API calls up to $50/transaction and $200/day
  - resource: openai.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

  # Allow Anthropic API calls up to $50/transaction and $200/day
  - resource: anthropic.com
    actions: [api_call, purchase]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200

  # Require human approval for everything else
defaultVerdict: pending_approval
`;

const CONFIG = {
  version: "1",
  policyPath: "policy.yaml",
  ledgerPath: "data/decisions.jsonl",
};

export interface InitResult {
  readonly created: string[];
  readonly skipped: string[];
  /** The effective verdict for actions that match no rule (safe-by-default). */
  readonly defaultVerdict: AuthorizationStatus;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(baseDir: string): Promise<InitResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  const dataDir = join(baseDir, "data");
  if (await fileExists(dataDir)) {
    skipped.push("data/");
  } else {
    await mkdir(dataDir, { recursive: true });
    created.push("data/");
  }

  const policyPath = join(baseDir, "policy.yaml");
  if (await fileExists(policyPath)) {
    skipped.push("policy.yaml");
  } else {
    await writeFile(policyPath, POLICY_YAML, "utf8");
    created.push("policy.yaml");
  }

  const configPath = join(baseDir, "shotoku.config.json");
  if (await fileExists(configPath)) {
    skipped.push("shotoku.config.json");
  } else {
    await writeFile(configPath, JSON.stringify(CONFIG, null, 2) + "\n", "utf8");
    created.push("shotoku.config.json");
  }

  // Read back the effective default verdict so `init` can surface it. The engine
  // treats an omitted defaultVerdict as "pending_approval" (fail toward review),
  // so we mirror that here.
  let defaultVerdict: AuthorizationStatus = "pending_approval";
  try {
    const raw = await readFile(policyPath, "utf8");
    const parsed = parse(raw) as { defaultVerdict?: AuthorizationStatus } | null;
    if (parsed?.defaultVerdict) defaultVerdict = parsed.defaultVerdict;
  } catch {
    // Unreadable policy: keep the safe default.
  }

  return { created, skipped, defaultVerdict };
}
