import { createHash } from "node:crypto";
import { toMicros } from "./money.js";
import { canonicalJson } from "./integrity.js";
import type { AuthorizeRequest, OpenGrant, Policy } from "./types.js";
import { normalizeRecipient } from "./recipient.js";

/**
 * One-shot grants.
 *
 * Before these existed, `shotoku approve` wrote an audit record and changed
 * nothing else: `evaluatePolicy` never read approvals, so an agent retrying an
 * approved action got a fresh decision with the same pending verdict, forever.
 * The MCP server told agents to approve and retry, which could not work.
 *
 * A grant is created when a human approves a pending decision, and is redeemed
 * by the next request whose signature matches. Exactly once — a second identical
 * call produces a new pending decision, because "approve this action" is not
 * "approve this action from now on". Standing permission is what `policy.yaml`
 * is for.
 */

/** Fifteen minutes. Long enough for a human to switch windows and read. */
export const DEFAULT_GRANT_TTL_SECONDS = 900;

export function grantTtlSeconds(policy: Policy): number {
  const configured = policy.grantTtlSeconds;
  return configured !== undefined && Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_GRANT_TTL_SECONDS;
}

/**
 * What a human is understood to have approved.
 *
 * `resource` alone is far too coarse. For MCP the resource is `<server>__<tool>`
 * (see mcp/src/wrap.ts), so a signature without `fingerprint` would let a human
 * who approved `fs__write_file` for one path hand the agent a grant redeemable
 * against any other path — a confused-deputy escalation, and an invisible one.
 *
 * `amount` is compared exactly, in integer micro-units. "Anything up to the
 * approved amount" would be a budget bypass, and would teach an agent to shave
 * the number until something clears.
 *
 * `recipient` is included only when present, so signatures of requests that
 * never carried one are unchanged by its introduction.
 */
export function grantSignature(request: AuthorizeRequest): string {
  const parts = {
    actor: request.actor,
    action: request.action,
    rail: request.rail ?? null,
    resource: request.resource,
    amount: request.amount === undefined ? null : toMicros(request.amount),
    fingerprint: request.fingerprint ?? null,
    ...(request.recipient !== undefined
      ? { recipient: normalizeRecipient(request.recipient) }
      : {}),
  };

  return createHash("sha256").update(canonicalJson(parts)).digest("hex");
}

/**
 * Digest of an arbitrary payload, for callers that want to bind an approval to
 * request details the resource string does not carry. Values are hashed, never
 * stored: the ledger records argument *keys* on purpose, because tool arguments
 * routinely carry secrets.
 */
export function fingerprintOf(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function isGrantExpired(
  grant: OpenGrant,
  ttlSeconds: number,
  now: Date,
): boolean {
  const approvedAt = new Date(grant.approvedAt).getTime();
  if (Number.isNaN(approvedAt)) return true;
  return now.getTime() - approvedAt > ttlSeconds * 1_000;
}

/** The oldest unexpired grant matching this request, if any. */
export function findRedeemableGrant(
  request: AuthorizeRequest,
  grants: readonly OpenGrant[],
  ttlSeconds: number,
  now: Date,
): OpenGrant | undefined {
  const signature = grantSignature(request);

  return grants
    .filter(
      (grant) =>
        grant.signature === signature && !isGrantExpired(grant, ttlSeconds, now),
    )
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt))[0];
}
