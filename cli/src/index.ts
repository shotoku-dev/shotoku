#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { render } from "ink";
import { createElement } from "react";
import {
  authorize,
  approve,
  createSignedSnapshot,
  deny,
  getApprovalForDecision,
  getDecisionById,
  isAgentAction,
  isAuthorizationStatus,
  readApprovals,
  readDecisions,
  parseSignedSnapshot,
  toUserSafeMessage,
  validActions,
  validStatuses,
  verifySignedSnapshot,
  type AuthorizationStatus,
} from "@shotoku/core";
import { App } from "./tui/App.js";
import {
  formatApproval,
  formatDecision,
  formatError,
  formatHistoryTable,
  formatResponse,
  formatStatus,
  type HistoryOptions,
} from "./format.js";
import { runInit } from "./init.js";
import { resolveRuntimePaths } from "./config.js";

const VALID_ACTIONS = validActions();
const VALID_STATUSES = validStatuses();

const program = new Command();

function snapshotSecret(): string {
  const secret = process.env["SHOTOKU_SNAPSHOT_SECRET"];
  if (!secret?.trim()) {
    throw new Error("Set SHOTOKU_SNAPSHOT_SECRET before using snapshots.");
  }
  return secret;
}

function parseAmountOption(value: string): number {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount "${value}". Must be a non-negative number.`);
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid amount "${value}". Must be a finite number.`);
  }

  return amount;
}

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
  .option("--policy <path>", "Path to policy file")
  .option("--ledger <path>", "Path to ledger file")
  .action(async (opts: { actor: string; action: string; resource: string; amount?: string; policy?: string; ledger?: string }) => {
    if (!isAgentAction(opts.action)) {
      console.error(formatError(`Invalid action "${opts.action}". Valid actions: ${VALID_ACTIONS.join(", ")}`));
      process.exit(1);
    }

    let amount: number | undefined;
    if (opts.amount !== undefined) {
      try {
        amount = parseAmountOption(opts.amount);
      } catch (error) {
        console.error(formatError(toUserSafeMessage(error)));
        process.exit(1);
      }
    }

    const paths = await resolveRuntimePaths(opts);
    const response = await authorize(
      {
        actor: opts.actor,
        action: opts.action,
        resource: opts.resource,
        ...(amount !== undefined ? { amount } : {}),
      },
      paths,
    );

    console.log(formatResponse(response));
    process.exit(response.approved ? 0 : 1);
  });

const VALID_SINCE = ["24h", "7d", "30d"] as const;
type SinceValue = (typeof VALID_SINCE)[number];

function isSinceValue(value: string): value is SinceValue {
  return (VALID_SINCE as readonly string[]).includes(value);
}

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
  .option("--ledger <path>", "Path to ledger file")
  .action(async (opts: { actor?: string; since?: string; status?: string; ledger?: string }) => {
    let status: AuthorizationStatus | undefined;
    if (opts.status) {
      if (!isAuthorizationStatus(opts.status)) {
        console.error(formatError(`Invalid status "${opts.status}". Valid values: ${VALID_STATUSES.join(", ")}`));
        process.exit(1);
      }
      status = opts.status;
    }

    let since: Date | undefined;
    if (opts.since) {
      if (!isSinceValue(opts.since)) {
        console.error(formatError(`Invalid --since value "${opts.since}". Valid values: ${VALID_SINCE.join(", ")}`));
        process.exit(1);
      }
      since = parseSince(opts.since);
    }

    const { ledgerPath } = await resolveRuntimePaths(opts);
    const readOpts = {
      ...(opts.actor !== undefined && { actor: opts.actor }),
      ...(status !== undefined && { status }),
      ...(since !== undefined && { since }),
    };
    const entries = await readDecisions(ledgerPath, readOpts);
    const approvals = await readApprovals(ledgerPath);

    const historyOpts: HistoryOptions = {
      approvals,
      ...(opts.actor !== undefined && { actor: opts.actor }),
      ...(opts.since !== undefined && { since: opts.since }),
      ...(opts.status !== undefined && { status: opts.status }),
    };
    console.log(formatHistoryTable(entries, historyOpts));
  });

program
  .command("status")
  .description("Show pending approvals and last decision")
  .option("--ledger <path>", "Path to ledger file")
  .action(async (opts: { ledger?: string }) => {
    const { ledgerPath } = await resolveRuntimePaths(opts);
    const entries = await readDecisions(ledgerPath);
    const approvals = await readApprovals(ledgerPath);
    console.log(formatStatus(entries, approvals));
  });

program
  .command("decision <id>")
  .description("Show full detail for a decision")
  .option("--ledger <path>", "Path to ledger file")
  .action(async (id: string, opts: { ledger?: string }) => {
    const { ledgerPath } = await resolveRuntimePaths(opts);
    const entry = await getDecisionById(ledgerPath, id);
    if (!entry) {
      console.error(formatError(`Decision "${id}" not found.`));
      process.exit(1);
    }
    const approval = await getApprovalForDecision(ledgerPath, id);
    console.log(formatDecision(entry, approval));
  });

program
  .command("approve <id>")
  .description("Approve a pending decision")
  .option("--ledger <path>", "Path to ledger file")
  .action(async (id: string, opts: { ledger?: string }) => {
    try {
      const { ledgerPath } = await resolveRuntimePaths(opts);
      const entry = await approve(id, { ledgerPath });
      console.log(formatApproval(entry));
    } catch (err) {
      console.error(formatError(toUserSafeMessage(err)));
      process.exit(1);
    }
  });

program
  .command("deny <id>")
  .description("Deny a pending decision")
  .option("--ledger <path>", "Path to ledger file")
  .action(async (id: string, opts: { ledger?: string }) => {
    try {
      const { ledgerPath } = await resolveRuntimePaths(opts);
      const entry = await deny(id, { ledgerPath });
      console.log(formatApproval(entry));
    } catch (err) {
      console.error(formatError(toUserSafeMessage(err)));
      process.exit(1);
    }
  });

const snapshot = program
  .command("snapshot")
  .description("Create and verify signed policy/ledger snapshots");

snapshot
  .command("create")
  .description("Write a signed snapshot of the current policy and ledger")
  .option("--policy <path>", "Path to policy file")
  .option("--ledger <path>", "Path to ledger file")
  .option("--out <path>", "Snapshot output file", "shotoku.snapshot.json")
  .option("--key-id <id>", "Optional label for the signing secret")
  .action(async (opts: { policy?: string; ledger?: string; out: string; keyId?: string }) => {
    const paths = await resolveRuntimePaths(opts);
    const signed = await createSignedSnapshot({
      ...paths,
      secret: snapshotSecret(),
      ...(opts.keyId !== undefined ? { keyId: opts.keyId } : {}),
    });
    const outPath = resolve(process.cwd(), opts.out);

    await writeFile(outPath, `${JSON.stringify(signed, null, 2)}\n`, "utf8");
    console.log(`✓ Snapshot written: ${outPath}`);
    console.log(`  Ledger head: ${signed.ledger.headHash}`);
  });

snapshot
  .command("verify")
  .description("Verify a signed snapshot against policy and ledger files")
  .requiredOption("--snapshot <path>", "Snapshot file to verify")
  .option("--policy <path>", "Override policy path")
  .option("--ledger <path>", "Override ledger path")
  .action(async (opts: { snapshot: string; policy?: string; ledger?: string }) => {
    const raw = await readFile(resolve(process.cwd(), opts.snapshot), "utf8");
    const parsed = parseSignedSnapshot(JSON.parse(raw) as unknown);
    const paths =
      opts.policy !== undefined || opts.ledger !== undefined
        ? await resolveRuntimePaths(opts)
        : {};
    const result = await verifySignedSnapshot(parsed, {
      secret: snapshotSecret(),
      ...paths,
    });

    if (result.verified) {
      console.log("✓ Snapshot verified.");
      return;
    }

    console.error(formatError(result.reasons.join(" ")));
    process.exit(1);
  });

program
  .command("init")
  .description("Initialize Shotoku in the current directory")
  .option("--dir <path>", "Target directory", ".")
  .action(async (opts: { dir: string }) => {
    const { created, skipped } = await runInit(opts.dir);

    for (const f of created) console.log(`  ✓ Created  ${f}`);
    for (const f of skipped) console.log(`  · Skipped  ${f} (already exists)`);

    console.log("");
    console.log("Ready. Try:");
    console.log("  shotoku authorize --actor my-agent --action api_call --resource openai.com --amount 5");
  });

program
  .command("tui")
  .description("Launch the interactive TUI")
  .option("--ledger <path>", "Path to ledger file")
  .action(async (opts: { ledger?: string }) => {
    const { ledgerPath } = await resolveRuntimePaths(opts);
    render(createElement(App, { ledgerPath }));
  });

program.parseAsync().catch((err: unknown) => {
  const message = toUserSafeMessage(err);
  console.error(formatError(message));
  process.exit(1);
});
