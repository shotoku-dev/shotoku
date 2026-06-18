#!/usr/bin/env node
import { Command } from "commander";
import { authorize, type AgentAction } from "@shotoku/core";
import { formatResponse, formatError } from "./format.js";

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

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(formatError(message));
  process.exit(1);
});
