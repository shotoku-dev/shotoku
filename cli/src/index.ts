#!/usr/bin/env node
import { Command } from "commander";
import { authorize, readDecisions, getDecisionById, type AgentAction, type AuthorizationStatus } from "@shotoku/core";
import { formatResponse, formatError, formatHistoryTable, formatStatus, formatDecision } from "./format.js";

const VALID_ACTIONS: AgentAction[] = [
  "purchase",
  "api_call",
  "execute_code",
  "send_email",
  "mcp_tool",
  "custom",
];

const program = new Command();

program
  .name("shotoku")
  .description("Local-first authorization layer for AI agents")
  .version("0.0.0");

program
  .command("authorize")
  .description("Evaluate whether an agent action is authorized")
  .requiredOption("--actor <id>", "Agent identifier")
  .requiredOption("--action <action>", `Action to evaluate (${VALID_ACTIONS.join(", ")})`)
  .requiredOption("--resource <resource>", "Target resource (e.g. openai.com)")
  .option("--amount <number>", "Monetary amount when applicable")
  .option("--policy <path>", "Path to policy file", "policy.yaml")
  .option("--ledger <path>", "Path to ledger file", "data/decisions.jsonl")
  .action(async (opts: { actor: string; action: string; resource: string; amount?: string; policy: string; ledger: string }) => {
    if (!VALID_ACTIONS.includes(opts.action as AgentAction)) {
      console.error(formatError(`Invalid action "${opts.action}". Valid actions: ${VALID_ACTIONS.join(", ")}`));
      process.exit(1);
    }

    let amount: number | undefined;
    if (opts.amount !== undefined) {
      amount = parseFloat(opts.amount);
      if (isNaN(amount) || amount < 0) {
        console.error(formatError(`Invalid amount "${opts.amount}". Must be a positive number.`));
        process.exit(1);
      }
    }

    const response = await authorize(
      {
        actor: opts.actor,
        action: opts.action as AgentAction,
        resource: opts.resource,
        ...(amount !== undefined ? { amount } : {}),
      },
      { policyPath: opts.policy, ledgerPath: opts.ledger },
    );

    console.log(formatResponse(response));
    process.exit(response.approved ? 0 : 1);
  });

const VALID_STATUSES: AuthorizationStatus[] = ["approved", "denied", "pending_approval"];
const VALID_SINCE = ["24h", "7d", "30d"] as const;
type SinceValue = (typeof VALID_SINCE)[number];

function parseSince(value: string): Date {
  const now = new Date();
  if (value === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (value === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (value === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  throw new Error(`Invalid --since value "${value}". Valid values: ${VALID_SINCE.join(", ")}`);
}

program
  .command("history")
  .description("List past authorization decisions")
  .option("--actor <id>", "Filter by actor")
  .option("--since <window>", `Filter by time window (${VALID_SINCE.join(", ")})`)
  .option("--status <status>", `Filter by status (${VALID_STATUSES.join(", ")})`)
  .option("--ledger <path>", "Path to ledger file", "data/decisions.jsonl")
  .action(async (opts: { actor?: string; since?: string; status?: string; ledger: string }) => {
    if (opts.status && !VALID_STATUSES.includes(opts.status as AuthorizationStatus)) {
      console.error(formatError(`Invalid status "${opts.status}". Valid values: ${VALID_STATUSES.join(", ")}`));
      process.exit(1);
    }

    let since: Date | undefined;
    if (opts.since) {
      if (!(VALID_SINCE as readonly string[]).includes(opts.since)) {
        console.error(formatError(`Invalid --since value "${opts.since}". Valid values: ${VALID_SINCE.join(", ")}`));
        process.exit(1);
      }
      since = parseSince(opts.since as SinceValue);
    }

    const readOpts = {
      ...(opts.actor !== undefined && { actor: opts.actor }),
      ...(opts.status !== undefined && { status: opts.status as AuthorizationStatus }),
      ...(since !== undefined && { since }),
    };
    const entries = await readDecisions(opts.ledger, readOpts);

    console.log(formatHistoryTable(entries));
  });

program
  .command("status")
  .description("Show pending approvals and last decision")
  .option("--ledger <path>", "Path to ledger file", "data/decisions.jsonl")
  .action(async (opts: { ledger: string }) => {
    const entries = await readDecisions(opts.ledger);
    console.log(formatStatus(entries));
  });

program
  .command("decision <id>")
  .description("Show full detail for a decision")
  .option("--ledger <path>", "Path to ledger file", "data/decisions.jsonl")
  .action(async (id: string, opts: { ledger: string }) => {
    const entry = await getDecisionById(opts.ledger, id);
    if (!entry) {
      console.error(formatError(`Decision "${id}" not found.`));
      process.exit(1);
    }
    console.log(formatDecision(entry));
  });

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(formatError(message));
  process.exit(1);
});
