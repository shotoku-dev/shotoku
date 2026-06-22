import {
  appendFile,
  mkdir,
  open,
  readFile,
  stat,
  unlink,
} from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type {
  ApprovalEntry,
  AuthorizationStatus,
  LedgerIntegrity,
  LedgerIntegrityReport,
  LedgerEntry,
  LedgerSnapshot,
} from "./types.js";
import { ShotokuError, errorMessage } from "./errors.js";
import { isAuthorizationStatus } from "./validation.js";
import {
  LEDGER_GENESIS_HASH,
  hashLedgerRecord,
} from "./integrity.js";

/** Either kind of record that can live in the append-only ledger file. */
type LedgerRecord = LedgerEntry | ApprovalEntry;

interface LedgerReadState {
  readonly records: readonly LedgerRecord[];
  readonly report: LedgerIntegrityReport;
}

const LEDGER_LOCK_RETRY_MS = 25;
const LEDGER_LOCK_TIMEOUT_MS = 5_000;
const LEDGER_LOCK_STALE_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

function isApproval(record: LedgerRecord): record is ApprovalEntry {
  return (record as Partial<ApprovalEntry>).kind === "approval";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReasonList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (reason) =>
        isRecord(reason) &&
        typeof reason["type"] === "string" &&
        typeof reason["text"] === "string",
    )
  );
}

function isLedgerIntegrity(value: unknown): value is LedgerIntegrity {
  return (
    isRecord(value) &&
    value["version"] === 1 &&
    Number.isInteger(value["sequence"]) &&
    typeof value["sequence"] === "number" &&
    value["sequence"] > 0 &&
    typeof value["previousHash"] === "string" &&
    typeof value["hash"] === "string"
  );
}

function isLedgerEntry(value: unknown): value is LedgerEntry {
  if (!isRecord(value)) return false;
  if (typeof value["decisionId"] !== "string") return false;
  if (typeof value["timestamp"] !== "string") return false;
  if (!isRecord(value["request"]) || !isRecord(value["response"])) return false;

  const request = value["request"];
  const response = value["response"];

  const integrity = value["integrity"];

  return (
    typeof request["actor"] === "string" &&
    typeof request["action"] === "string" &&
    typeof request["resource"] === "string" &&
    typeof response["approved"] === "boolean" &&
    isAuthorizationStatus(response["status"]) &&
    isReasonList(response["reasons"]) &&
    typeof response["decisionId"] === "string" &&
    typeof response["timestamp"] === "string" &&
    (integrity === undefined || isLedgerIntegrity(integrity))
  );
}

function isApprovalEntry(value: unknown): value is ApprovalEntry {
  const integrity = isRecord(value) ? value["integrity"] : undefined;

  return (
    isRecord(value) &&
    value["kind"] === "approval" &&
    typeof value["approvalId"] === "string" &&
    typeof value["decisionId"] === "string" &&
    (value["verdict"] === "approved" || value["verdict"] === "denied") &&
    typeof value["timestamp"] === "string" &&
    (integrity === undefined || isLedgerIntegrity(integrity))
  );
}

function parseLedgerRecord(line: string, lineNumber: number): LedgerRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    throw new ShotokuError(
      "ledger_corrupt",
      `Ledger is corrupt at line ${lineNumber}: ${errorMessage(error)}`,
    );
  }

  if (isApprovalEntry(parsed) || isLedgerEntry(parsed)) return parsed;

  throw new ShotokuError(
    "ledger_corrupt",
    `Ledger is corrupt at line ${lineNumber}: record has an invalid shape`,
  );
}

function recordBody(record: LedgerRecord): Record<string, unknown> {
  const source = record as unknown as Record<string, unknown>;
  const body: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key !== "integrity") body[key] = value;
  }

  return body;
}

function verifyRecordIntegrity(
  record: LedgerRecord,
  sequence: number,
  previousHash: string,
  lineNumber: number,
): { readonly hash: string; readonly legacy: boolean } {
  const expectedHash = hashLedgerRecord(previousHash, recordBody(record));
  const integrity = record.integrity;

  if (!integrity) {
    return { hash: expectedHash, legacy: true };
  }

  if (integrity.sequence !== sequence) {
    throw new ShotokuError(
      "ledger_corrupt",
      `Ledger is corrupt at line ${lineNumber}: expected sequence ${sequence}, found ${integrity.sequence}`,
    );
  }

  if (integrity.previousHash !== previousHash) {
    throw new ShotokuError(
      "ledger_corrupt",
      `Ledger is corrupt at line ${lineNumber}: previous hash does not match`,
    );
  }

  if (integrity.hash !== expectedHash) {
    throw new ShotokuError(
      "ledger_corrupt",
      `Ledger is corrupt at line ${lineNumber}: record hash does not match`,
    );
  }

  return { hash: integrity.hash, legacy: false };
}

async function ensureLedgerDir(ledgerPath: string): Promise<void> {
  await mkdir(dirname(ledgerPath), { recursive: true });
}

async function readLedgerState(ledgerPath: string): Promise<LedgerReadState> {
  let raw: string;
  try {
    raw = await readFile(ledgerPath, "utf8");
  } catch (error) {
    const code = typeof error === "object" && error !== null
      ? (error as { readonly code?: unknown }).code
      : undefined;
    if (code === "ENOENT") {
      return {
        records: [],
        report: {
          recordCount: 0,
          legacyRecordCount: 0,
          headHash: LEDGER_GENESIS_HASH,
        },
      };
    }
    throw new ShotokuError(
      "ledger_read_failed",
      `Could not read ledger "${ledgerPath}": ${errorMessage(error)}`,
    );
  }

  if (!raw.trim()) {
    return {
      records: [],
      report: {
        recordCount: 0,
        legacyRecordCount: 0,
        headHash: LEDGER_GENESIS_HASH,
      },
    };
  }

  const records: LedgerRecord[] = [];
  const lines = raw.split("\n");
  let previousHash = LEDGER_GENESIS_HASH;
  let legacyRecordCount = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const record = parseLedgerRecord(line, i + 1);
    const integrity = verifyRecordIntegrity(
      record,
      records.length + 1,
      previousHash,
      i + 1,
    );

    previousHash = integrity.hash;
    if (integrity.legacy) legacyRecordCount += 1;
    records.push(record);
  }

  return {
    records,
    report: {
      recordCount: records.length,
      legacyRecordCount,
      headHash: previousHash,
    },
  };
}

async function readRecords(ledgerPath: string): Promise<readonly LedgerRecord[]> {
  return (await readLedgerState(ledgerPath)).records;
}

async function removeStaleLock(lockPath: string): Promise<void> {
  try {
    const info = await stat(lockPath);
    if (Date.now() - info.mtimeMs > LEDGER_LOCK_STALE_MS) {
      await unlink(lockPath);
    }
  } catch {
    // If the lock disappeared between attempts, the next open() will succeed.
  }
}

export async function withLedgerLock<T>(
  ledgerPath: string,
  operation: () => Promise<T>,
): Promise<T> {
  await ensureLedgerDir(ledgerPath);
  const lockPath = `${ledgerPath}.lock`;
  const start = Date.now();

  while (true) {
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
    } catch (error) {
      const code = typeof error === "object" && error !== null
        ? (error as { readonly code?: unknown }).code
        : undefined;
      if (code !== "EEXIST") {
        throw new ShotokuError(
          "ledger_lock_timeout",
          `Could not lock ledger "${ledgerPath}": ${errorMessage(error)}`,
        );
      }

      await removeStaleLock(lockPath);
      if (Date.now() - start >= LEDGER_LOCK_TIMEOUT_MS) {
        throw new ShotokuError(
          "ledger_lock_timeout",
          `Timed out waiting for ledger lock "${lockPath}".`,
        );
      }
      await sleep(LEDGER_LOCK_RETRY_MS);
    }

    if (handle) {
      try {
        return await operation();
      } finally {
        await handle.close();
        await unlink(lockPath).catch(() => undefined);
      }
    }
  }
}

export async function appendDecision(
  entry: LedgerEntry,
  ledgerPath: string,
): Promise<void> {
  try {
    await ensureLedgerDir(ledgerPath);
    await appendFile(
      ledgerPath,
      `${JSON.stringify(await withIntegrity(entry, ledgerPath))}\n`,
      "utf8",
    );
  } catch (error) {
    if (error instanceof ShotokuError) throw error;
    throw new ShotokuError(
      "ledger_write_failed",
      `Could not write decision ledger "${ledgerPath}": ${errorMessage(error)}`,
    );
  }
}

export async function appendApproval(
  entry: ApprovalEntry,
  ledgerPath: string,
): Promise<void> {
  try {
    await ensureLedgerDir(ledgerPath);
    await appendFile(
      ledgerPath,
      `${JSON.stringify(await withIntegrity(entry, ledgerPath))}\n`,
      "utf8",
    );
  } catch (error) {
    if (error instanceof ShotokuError) throw error;
    throw new ShotokuError(
      "ledger_write_failed",
      `Could not write approval ledger "${ledgerPath}": ${errorMessage(error)}`,
    );
  }
}

async function withIntegrity<T extends LedgerRecord>(
  entry: T,
  ledgerPath: string,
): Promise<T & { readonly integrity: LedgerIntegrity }> {
  const state = await readLedgerState(ledgerPath);
  const body = recordBody(entry);
  const previousHash = state.report.headHash;
  const integrity: LedgerIntegrity = {
    version: 1,
    sequence: state.report.recordCount + 1,
    previousHash,
    hash: hashLedgerRecord(previousHash, body),
  };

  return { ...body, integrity } as T & { readonly integrity: LedgerIntegrity };
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

export async function getLedgerIntegrity(
  ledgerPath: string,
): Promise<LedgerIntegrityReport> {
  return (await readLedgerState(ledgerPath)).report;
}

export async function getLedgerSnapshot(
  ledgerPath: string,
  options: { readonly now?: Date } = {},
): Promise<LedgerSnapshot> {
  const entries = await readDecisions(ledgerPath);

  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - DAY_MS);

  const dailyTotals: Record<string, number> = {};

  for (const entry of entries) {
    if (!entry.response.approved) continue;
    if (new Date(entry.timestamp) < windowStart) continue;

    const amount = entry.request.amount;
    if (amount === undefined) continue;

    const key = `${entry.request.actor}|${entry.request.resource}`;
    dailyTotals[key] = (dailyTotals[key] ?? 0) + amount;
  }

  return { dailyTotals, windowStart: windowStart.toISOString() };
}
