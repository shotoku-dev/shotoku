import type { AgentAction, ReceiptPayload, ReceiptVerification } from "./types.js";
import { ShotokuError } from "./errors.js";
import { canonicalJson, hmacSha256Hex, verifyHmacSha256 } from "./integrity.js";
import { isAgentAction } from "./validation.js";

/**
 * Signed decision receipts.
 *
 * A receipt is a compact HMAC-SHA256 token attached to approved decisions:
 *
 *   rcpt.<base64url(payload JSON)>.<hex signature>
 *
 * Downstream infrastructure (a payment proxy, an MCP gateway, a CI job)
 * verifies the receipt with the shared secret before executing the action, so
 * `authorize()` is enforceable without Shotoku ever touching credentials or
 * funds. Receipts are short-lived: a decision authorizes one action now, not
 * the same action forever.
 */

const RECEIPT_PREFIX = "rcpt";
const DEFAULT_TTL_SECONDS = 300;

export interface CreateReceiptOptions {
  readonly decisionId: string;
  readonly actor: string;
  readonly action: AgentAction;
  readonly resource: string;
  readonly amount?: number;
  readonly secret: string;
  /** Receipt lifetime in seconds. Defaults to 300. */
  readonly ttlSeconds?: number;
  /** Issue time; defaults to now. Exposed for deterministic tests. */
  readonly issuedAt?: Date;
}

export interface VerifyReceiptOptions {
  readonly secret: string;
  /** Verification time; defaults to now. Exposed for deterministic tests. */
  readonly now?: Date;
}

function assertSecret(secret: string): void {
  if (!secret.trim()) {
    throw new ShotokuError(
      "config_invalid",
      "Receipts require a signing secret. Set SHOTOKU_RECEIPT_SECRET.",
    );
  }
}

function signaturePart(secret: string, payloadJson: string): string {
  // hmacSha256Hex returns "hmac-sha256:<hex>"; the token carries only the hex.
  return hmacSha256Hex(secret, payloadJson).split(":")[1] ?? "";
}

export function createReceipt(options: CreateReceiptOptions): string {
  assertSecret(options.secret);

  const issuedAt = options.issuedAt ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const payload: ReceiptPayload = {
    v: 1,
    decisionId: options.decisionId,
    actor: options.actor,
    action: options.action,
    resource: options.resource,
    ...(options.amount !== undefined ? { amount: options.amount } : {}),
    exp: Math.floor(issuedAt.getTime() / 1000) + ttlSeconds,
  };

  const payloadJson = canonicalJson(payload);
  const encoded = Buffer.from(payloadJson, "utf8").toString("base64url");
  return `${RECEIPT_PREFIX}.${encoded}.${signaturePart(options.secret, payloadJson)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(value: unknown): ReceiptPayload | undefined {
  if (
    !isRecord(value) ||
    value["v"] !== 1 ||
    typeof value["decisionId"] !== "string" ||
    typeof value["actor"] !== "string" ||
    !isAgentAction(value["action"]) ||
    typeof value["resource"] !== "string" ||
    (value["amount"] !== undefined && typeof value["amount"] !== "number") ||
    typeof value["exp"] !== "number" ||
    !Number.isFinite(value["exp"])
  ) {
    return undefined;
  }

  return {
    v: 1,
    decisionId: value["decisionId"],
    actor: value["actor"],
    action: value["action"],
    resource: value["resource"],
    ...(typeof value["amount"] === "number" ? { amount: value["amount"] } : {}),
    exp: value["exp"],
  };
}

export function verifyReceipt(
  token: string,
  options: VerifyReceiptOptions,
): ReceiptVerification {
  assertSecret(options.secret);

  const malformed: ReceiptVerification = {
    valid: false,
    reasons: ["Receipt is malformed."],
  };

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== RECEIPT_PREFIX) return malformed;
  const [, encoded = "", signature = ""] = parts;

  let payloadJson: string;
  let decoded: unknown;
  try {
    payloadJson = Buffer.from(encoded, "base64url").toString("utf8");
    decoded = JSON.parse(payloadJson);
  } catch {
    return malformed;
  }

  const payload = parsePayload(decoded);
  if (!payload) return malformed;

  // Re-canonicalize the decoded payload so verification matches creation even
  // if the transported JSON had a different key order.
  const canonical = canonicalJson(payload);
  if (!verifyHmacSha256(options.secret, canonical, `hmac-sha256:${signature}`)) {
    return { valid: false, reasons: ["Receipt signature does not match."] };
  }

  const now = options.now ?? new Date();
  if (now.getTime() >= payload.exp * 1000) {
    return {
      valid: false,
      reasons: [`Receipt expired at ${new Date(payload.exp * 1000).toISOString()}.`],
    };
  }

  return { valid: true, payload, reasons: [] };
}
