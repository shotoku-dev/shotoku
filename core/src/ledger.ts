import { appendFile, readFile } from "node:fs/promises";
import type {
  ApprovalEntry,
  AuthorizationStatus,
  LedgerEntry,
  LedgerSnapshot,
} from "./types.js";

/** Either kind of record that can live in the append-only ledger file. */
type LedgerRecord = LedgerEntry | ApprovalEntry;

function isApproval(record: LedgerRecord): record is ApprovalEntry {
  return (record as Partial<ApprovalEntry>).kind === "approval";
}

async function readRecords(ledgerPath: string): Promise<LedgerRecord[]> {
  let raw: string;
  try {
    raw = await readFile(ledgerPath, "utf8");
  } catch {
    return [];
  }

  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LedgerRecord);
}

export async function appendDecision(
  entry: LedgerEntry,
  ledgerPath: string,
): Promise<void> {
  await appendFile(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
}

export async function appendApproval(
  entry: ApprovalEntry,
  ledgerPath: string,
): Promise<void> {
  await appendFile(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
}

export interface ReadOptions {
  readonly status?: AuthorizationStatus;
  readonly actor?: string;
  readonly since?: Date;
}

export async function readDecisions(
  ledgerPath: string,
  options: ReadOptions = {},
): Promise<LedgerEntry[]> {
  const records = await readRecords(ledgerPath);
  const entries = records.filter(
    (record): record is LedgerEntry => !isApproval(record),
  );

  return entries.filter((entry) => {
    if (options.status && entry.response.status !== options.status) return false;
    if (options.actor && entry.request.actor !== options.actor) return false;
    if (options.since && new Date(entry.timestamp) < options.since) return false;
    return true;
  });
}

export async function readApprovals(
  ledgerPath: string,
): Promise<ApprovalEntry[]> {
  const records = await readRecords(ledgerPath);
  return records.filter(isApproval);
}

export async function getDecisionById(
  ledgerPath: string,
  decisionId: string,
): Promise<LedgerEntry | undefined> {
  const entries = await readDecisions(ledgerPath);
  return entries.find((e) => e.decisionId === decisionId);
}

export async function getApprovalForDecision(
  ledgerPath: string,
  decisionId: string,
): Promise<ApprovalEntry | undefined> {
  const approvals = await readApprovals(ledgerPath);
  return approvals.find((a) => a.decisionId === decisionId);
}

/** Pending decisions that have not yet been approved or denied by a human. */
export async function getPendingApprovals(
  ledgerPath: string,
): Promise<LedgerEntry[]> {
  const records = await readRecords(ledgerPath);
  const actioned = new Set(
    records.filter(isApproval).map((approval) => approval.decisionId),
  );

  return records.filter(
    (record): record is LedgerEntry =>
      !isApproval(record) &&
      record.response.status === "pending_approval" &&
      !actioned.has(record.decisionId),
  );
}

export async function getLedgerSnapshot(
  ledgerPath: string,
): Promise<LedgerSnapshot> {
  const entries = await readDecisions(ledgerPath);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dailyTotals: Record<string, number> = {};

  for (const entry of entries) {
    if (!entry.response.approved) continue;
    if (new Date(entry.timestamp) < todayStart) continue;

    const amount = entry.request.amount;
    if (amount === undefined) continue;

    const key = `${entry.request.actor}|${entry.request.resource}`;
    dailyTotals[key] = (dailyTotals[key] ?? 0) + amount;
  }

  return { dailyTotals };
}
