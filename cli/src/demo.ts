import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import dedent from "dedent";
import {
  authorize,
  type AuthorizationStatus,
  type AuthorizeRequest,
} from "@shotoku/core";
import { formatResponse } from "./format.js";

/**
 * `shotoku demo` — a simulated agent scenario that shows APPROVED, DENIED, and
 * PENDING APPROVAL before the user writes any code. Decisions are real
 * `authorize()` calls against a throwaway policy and ledger in a temp
 * directory, deleted afterwards; nothing in the user's working directory is
 * read or written, and no real payment happens.
 */

export const DEMO_SCENARIO_NAMES = ["payments", "basic", "code", "email"] as const;

export type DemoScenarioName = (typeof DEMO_SCENARIO_NAMES)[number];

export function isDemoScenario(value: string): value is DemoScenarioName {
  return (DEMO_SCENARIO_NAMES as readonly string[]).includes(value);
}

interface DemoStep {
  /** One narration line printed before the decision. */
  readonly title: string;
  readonly request: AuthorizeRequest;
}

interface DemoScenario {
  /** Policy summary lines printed before the first step. */
  readonly intro: readonly string[];
  readonly policyYaml: string;
  readonly steps: readonly DemoStep[];
}

const SCENARIOS: Record<DemoScenarioName, DemoScenario> = {
  payments: {
    intro: [
      "Policy: api.openai.com allowlisted · max $50 per purchase · $50 daily budget.",
      "Everything else waits for a human.",
    ],
    policyYaml: dedent`
      defaultVerdict: pending_approval
      rules:
        - resource: api.openai.com
          verdict: approved
          maxAmount: 50
          maxDailyAmount: 50
    `,
    steps: [
      {
        title: "demo-agent buys $12 of API credits from api.openai.com",
        request: { actor: "demo-agent", action: "purchase", resource: "api.openai.com", amount: 12 },
      },
      {
        title: "demo-agent buys $30 more",
        request: { actor: "demo-agent", action: "purchase", resource: "api.openai.com", amount: 30 },
      },
      {
        title: "demo-agent tries another $25 — the $50 daily budget is nearly spent",
        request: { actor: "demo-agent", action: "purchase", resource: "api.openai.com", amount: 25 },
      },
      {
        title: "demo-agent tries a vendor the policy has never seen: vendor-xyz.com, $9",
        request: { actor: "demo-agent", action: "purchase", resource: "vendor-xyz.com", amount: 9 },
      },
    ],
  },

  basic: {
    intro: [
      "Policy: api.openai.com allowlisted up to $20 per call · internal.corp/* blocked.",
      "Everything else waits for a human.",
    ],
    policyYaml: dedent`
      defaultVerdict: pending_approval
      rules:
        - resource: api.openai.com
          verdict: approved
          maxAmount: 20
        - resource: internal.corp/*
          verdict: denied
    `,
    steps: [
      {
        title: "demo-agent calls api.openai.com for $5",
        request: { actor: "demo-agent", action: "api_call", resource: "api.openai.com", amount: 5 },
      },
      {
        title: "demo-agent tries a $45 purchase — over the $20 per-transaction limit",
        request: { actor: "demo-agent", action: "purchase", resource: "api.openai.com", amount: 45 },
      },
      {
        title: "demo-agent reaches for internal.corp/database — blocked outright",
        request: { actor: "demo-agent", action: "api_call", resource: "internal.corp/database" },
      },
      {
        title: "demo-agent tries an unlisted MCP tool: tools.example.dev",
        request: { actor: "demo-agent", action: "mcp_tool", resource: "tools.example.dev" },
      },
    ],
  },

  code: {
    intro: [
      "Policy: code runs in repo/sandbox/* only · repo/production/* blocked.",
      "Everything else waits for a human.",
    ],
    policyYaml: dedent`
      defaultVerdict: pending_approval
      rules:
        - resource: repo/sandbox/*
          verdict: approved
          actions: [execute_code]
        - resource: repo/production/*
          verdict: denied
    `,
    steps: [
      {
        title: "demo-agent runs the test suite in repo/sandbox/tests",
        request: { actor: "demo-agent", action: "execute_code", resource: "repo/sandbox/tests" },
      },
      {
        title: "demo-agent tries to deploy from repo/production/deploy — blocked",
        request: { actor: "demo-agent", action: "execute_code", resource: "repo/production/deploy" },
      },
      {
        title: "demo-agent wants to run a migration in repo/staging — no rule covers it",
        request: { actor: "demo-agent", action: "execute_code", resource: "repo/staging/migrate" },
      },
      {
        title: "demo-agent runs a build in repo/sandbox/build",
        request: { actor: "demo-agent", action: "execute_code", resource: "repo/sandbox/build" },
      },
    ],
  },

  email: {
    intro: [
      "Policy: mail to *@corp.example allowed · *@competitor.example blocked.",
      "Everything else waits for a human.",
    ],
    policyYaml: dedent`
      defaultVerdict: pending_approval
      rules:
        - resource: "*@corp.example"
          verdict: approved
          actions: [send_email]
        - resource: "*@competitor.example"
          verdict: denied
    `,
    steps: [
      {
        title: "demo-agent sends a status update to team@corp.example",
        request: { actor: "demo-agent", action: "send_email", resource: "team@corp.example" },
      },
      {
        title: "demo-agent drafts mail to press@competitor.example — blocked",
        request: { actor: "demo-agent", action: "send_email", resource: "press@competitor.example" },
      },
      {
        title: "demo-agent emails an address nobody allowlisted: stranger@unknown.example",
        request: { actor: "demo-agent", action: "send_email", resource: "stranger@unknown.example" },
      },
      {
        title: "demo-agent replies to cfo@corp.example",
        request: { actor: "demo-agent", action: "send_email", resource: "cfo@corp.example" },
      },
    ],
  },
};

const DEFAULT_DELAY_MS = 900;

export interface RunDemoOptions {
  readonly scenario?: DemoScenarioName;
  /** Pause between steps. Defaults to 900ms; pass 0 in tests. */
  readonly delayMs?: number;
  readonly log?: (line: string) => void;
}

export interface DemoResult {
  readonly scenario: DemoScenarioName;
  readonly statuses: readonly AuthorizationStatus[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export async function runDemo(options: RunDemoOptions = {}): Promise<DemoResult> {
  const scenarioName = options.scenario ?? "payments";
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const log = options.log ?? console.log;
  const scenario = SCENARIOS[scenarioName];

  const dir = await mkdtemp(join(tmpdir(), "shotoku-demo-"));
  const policyPath = join(dir, "policy.yaml");
  const ledgerPath = join(dir, "decisions.jsonl");
  const receiptSecret = randomBytes(16).toString("hex");

  const statuses: AuthorizationStatus[] = [];

  try {
    await writeFile(policyPath, `${scenario.policyYaml}\n`, "utf8");

    log(`Shotoku demo — ${scenarioName} scenario. Simulated: nothing real happens, your ledger is untouched.`);
    log("");
    for (const line of scenario.intro) {
      log(`  ${line}`);
    }

    for (const [index, step] of scenario.steps.entries()) {
      log("");
      log(`▶ ${index + 1}/${scenario.steps.length}  ${step.title}`);
      if (delayMs > 0) await sleep(delayMs);

      const response = await authorize(step.request, {
        policyPath,
        ledgerPath,
        receiptSecret,
      });
      statuses.push(response.status);
      log(formatResponse(response));
    }

    log("");
    log(`Done. ${scenario.steps.length} decisions, recorded to a throwaway ledger (now deleted).`);
    log("Try it on your own policy:");
    log("  shotoku init");
    log("  shotoku authorize --actor my-agent --action purchase --resource api.openai.com --amount 5");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  return { scenario: scenarioName, statuses };
}
