import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const LEDGER_GENESIS_HASH = `sha256:${"0".repeat(64)}`;

type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot hash a non-finite number");
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (isRecord(value)) {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child !== undefined) {
        out[key] = toJsonValue(child);
      }
    }
    return out;
  }

  throw new Error("Cannot hash a non-JSON value");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(toJsonValue(value));
}

export function sha256Hex(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function hashLedgerRecord(
  previousHash: string,
  recordBody: unknown,
): string {
  return sha256Hex(canonicalJson({ previousHash, record: recordBody }));
}

export function hmacSha256Hex(secret: string, payload: unknown): string {
  return `hmac-sha256:${createHmac("sha256", secret)
    .update(canonicalJson(payload), "utf8")
    .digest("hex")}`;
}

export function verifyHmacSha256(
  secret: string,
  payload: unknown,
  signature: string,
): boolean {
  const expected = hmacSha256Hex(secret, payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
