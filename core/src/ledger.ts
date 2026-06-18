import { appendFile, readFile } from "node:fs/promises";
import type {
  AuthorizationStatus,
  LedgerEntry,
  LedgerSnapshot,
} from "./types.js";

export async function appendDecision(
  entry: LedgerEntry,
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
  let raw: string;
  try {
    raw = await readFile(ledgerPath, "utf8");
  } catch {
    return [];
  }

  const entries = raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LedgerEntry);

  return entries.filter((entry) => {
    if (options.status && entry.response.status !== options.status) return false;
    if (options.actor && entry.request.actor !== options.actor) return false;
    if (options.since && new Date(entry.timestamp) < options.since) return false;
    return true;
  });
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
