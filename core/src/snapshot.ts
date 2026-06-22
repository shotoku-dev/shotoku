import { readFile } from "node:fs/promises";
import type {
  LedgerIntegrityReport,
  SignedSnapshot,
  SignedSnapshotSignature,
  SnapshotVerification,
} from "./types.js";
import { ShotokuError, errorMessage } from "./errors.js";
import { getLedgerIntegrity } from "./ledger.js";
import { hmacSha256Hex, sha256Hex, verifyHmacSha256 } from "./integrity.js";

export interface CreateSignedSnapshotOptions {
  readonly policyPath: string;
  readonly ledgerPath: string;
  readonly secret: string;
  readonly keyId?: string;
  readonly createdAt?: Date;
}

export interface VerifySignedSnapshotOptions {
  readonly secret: string;
  readonly policyPath?: string;
  readonly ledgerPath?: string;
}

type SnapshotPayload = Omit<SignedSnapshot, "signature">;

function assertSecret(secret: string): void {
  if (!secret.trim()) {
    throw new ShotokuError(
      "config_invalid",
      "Snapshot signing requires SHOTOKU_SNAPSHOT_SECRET.",
    );
  }
}

async function policyHash(policyPath: string): Promise<string> {
  try {
    return sha256Hex(await readFile(policyPath, "utf8"));
  } catch (error) {
    throw new ShotokuError(
      "policy_not_found",
      `Could not read policy "${policyPath}": ${errorMessage(error)}`,
    );
  }
}

function snapshotPayload(snapshot: SignedSnapshot): SnapshotPayload {
  return {
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    policy: snapshot.policy,
    ledger: snapshot.ledger,
  };
}

function signatureFor(
  payload: SnapshotPayload,
  secret: string,
  keyId: string | undefined,
): SignedSnapshotSignature {
  return {
    algorithm: "HMAC-SHA256",
    value: hmacSha256Hex(secret, payload),
    ...(keyId !== undefined ? { keyId } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSignature(value: unknown): value is SignedSnapshotSignature {
  return (
    isRecord(value) &&
    value["algorithm"] === "HMAC-SHA256" &&
    typeof value["value"] === "string" &&
    (value["keyId"] === undefined || typeof value["keyId"] === "string")
  );
}

export function parseSignedSnapshot(value: unknown): SignedSnapshot {
  if (!isRecord(value)) {
    throw new ShotokuError("config_invalid", "Snapshot must be a JSON object.");
  }

  const policy = value["policy"];
  const ledger = value["ledger"];
  const signature = value["signature"];

  if (
    value["version"] !== 1 ||
    typeof value["createdAt"] !== "string" ||
    !isRecord(policy) ||
    typeof policy["path"] !== "string" ||
    typeof policy["hash"] !== "string" ||
    !isRecord(ledger) ||
    typeof ledger["path"] !== "string" ||
    typeof ledger["headHash"] !== "string" ||
    typeof ledger["recordCount"] !== "number" ||
    typeof ledger["legacyRecordCount"] !== "number" ||
    !isSignature(signature)
  ) {
    throw new ShotokuError(
      "config_invalid",
      "Snapshot has an invalid shape.",
    );
  }

  return {
    version: 1,
    createdAt: value["createdAt"],
    policy: {
      path: policy["path"],
      hash: policy["hash"],
    },
    ledger: {
      path: ledger["path"],
      headHash: ledger["headHash"],
      recordCount: ledger["recordCount"],
      legacyRecordCount: ledger["legacyRecordCount"],
    },
    signature,
  };
}

export async function createSignedSnapshot(
  options: CreateSignedSnapshotOptions,
): Promise<SignedSnapshot> {
  assertSecret(options.secret);

  const [policyDigest, ledgerIntegrity] = await Promise.all([
    policyHash(options.policyPath),
    getLedgerIntegrity(options.ledgerPath),
  ]);

  const payload: SnapshotPayload = {
    version: 1,
    createdAt: (options.createdAt ?? new Date()).toISOString(),
    policy: {
      path: options.policyPath,
      hash: policyDigest,
    },
    ledger: {
      path: options.ledgerPath,
      headHash: ledgerIntegrity.headHash,
      recordCount: ledgerIntegrity.recordCount,
      legacyRecordCount: ledgerIntegrity.legacyRecordCount,
    },
  };

  return {
    ...payload,
    signature: signatureFor(payload, options.secret, options.keyId),
  };
}

function verifySignature(
  snapshot: SignedSnapshot,
  secret: string,
  reasons: string[],
): void {
  if (snapshot.signature.algorithm !== "HMAC-SHA256") {
    reasons.push("Unsupported snapshot signature algorithm.");
    return;
  }

  if (!verifyHmacSha256(secret, snapshotPayload(snapshot), snapshot.signature.value)) {
    reasons.push("Snapshot signature does not match.");
  }
}

function compareLedger(
  expected: SignedSnapshot["ledger"],
  actual: LedgerIntegrityReport,
  reasons: string[],
): void {
  if (expected.headHash !== actual.headHash) {
    reasons.push("Ledger head hash does not match snapshot.");
  }
  if (expected.recordCount !== actual.recordCount) {
    reasons.push("Ledger record count does not match snapshot.");
  }
  if (expected.legacyRecordCount !== actual.legacyRecordCount) {
    reasons.push("Ledger legacy record count does not match snapshot.");
  }
}

export async function verifySignedSnapshot(
  snapshot: SignedSnapshot,
  options: VerifySignedSnapshotOptions,
): Promise<SnapshotVerification> {
  assertSecret(options.secret);

  const reasons: string[] = [];
  verifySignature(snapshot, options.secret, reasons);

  const currentPolicyHash = await policyHash(options.policyPath ?? snapshot.policy.path);
  if (currentPolicyHash !== snapshot.policy.hash) {
    reasons.push("Policy hash does not match snapshot.");
  }

  const currentLedger = await getLedgerIntegrity(
    options.ledgerPath ?? snapshot.ledger.path,
  );
  compareLedger(snapshot.ledger, currentLedger, reasons);

  return {
    verified: reasons.length === 0,
    reasons,
  };
}
