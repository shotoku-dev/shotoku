import type { AuthorizeRequest, AuthorizeResponse } from "./types.js";
import { authorize } from "./authorize.js";

/**
 * Normalized payment details extracted from an x402 `402 Payment Required`
 * response. This is Shotoku's internal view — a friendly decimal amount and
 * asset name — independent of the on-the-wire x402 format.
 */
export interface PaymentRequirements {
  /** The resource/endpoint being paid for. Used as the authorization resource. */
  readonly resource: string;

  /** Amount required, in the asset's major units (e.g. 0.05 for 0.05 USDC). */
  readonly amount: number;

  /** Address the payment settles to (e.g. "0xABC…"). Recorded for audit. */
  readonly payTo: string;

  /** Human-readable asset name, e.g. "USDC". */
  readonly asset: string;

  /** Settlement network, e.g. "base". */
  readonly network: string;
}

/**
 * A single payment option from the `accepts` array of an x402 402 response.
 * Mirrors the x402 wire format. In production, prefer the official x402 types;
 * this minimal shape carries everything the authorization decision needs.
 * See: https://x402.org
 */
export interface X402Accept {
  readonly network: string;

  /** Amount required, in atomic units, as a string (e.g. "50000"). */
  readonly maxAmountRequired: string;

  /** The resource being paid for. */
  readonly resource: string;

  /** Recipient address. */
  readonly payTo: string;

  /** Token contract address. */
  readonly asset: string;

  /** Optional metadata; `name` is the human-readable asset name. */
  readonly extra?: { readonly name?: string };
}

export interface X402Response {
  readonly x402Version: number;
  readonly accepts: readonly X402Accept[];
}

/** USDC and most x402 stablecoins use 6 decimals. */
const DEFAULT_DECIMALS = 6;
const MAX_DECIMALS = 18;

function amountFromAtomicUnits(value: string, decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new Error(`x402 decimals must be an integer from 0 to ${MAX_DECIMALS}`);
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("x402 amount must be a non-negative integer string");
  }

  const padded =
    value.length <= decimals ? value.padStart(decimals + 1, "0") : value;
  const splitAt = padded.length - decimals;
  const whole = padded.slice(0, splitAt);
  const fractional = decimals > 0 ? padded.slice(splitAt) : "";
  const decimal = decimals > 0 ? `${whole}.${fractional}` : whole;
  const amount = Number(decimal);

  if (!Number.isFinite(amount)) {
    throw new Error("x402 amount is too large to represent safely");
  }

  return amount;
}

/**
 * Convert the first payment option from an x402 402 response into Shotoku's
 * normalized {@link PaymentRequirements}. Atomic amounts are converted to major
 * units using `decimals` (defaults to 6, the USDC convention).
 */
export function parseX402Response(
  response: X402Response,
  decimals: number = DEFAULT_DECIMALS,
): PaymentRequirements {
  const accept = response.accepts[0];
  if (!accept) {
    throw new Error("x402 response contains no payment options");
  }
  if (!accept.resource.trim()) {
    throw new Error("x402 payment option is missing resource");
  }
  if (!accept.payTo.trim()) {
    throw new Error("x402 payment option is missing payTo");
  }
  if (!accept.network.trim()) {
    throw new Error("x402 payment option is missing network");
  }
  if (!accept.asset.trim()) {
    throw new Error("x402 payment option is missing asset");
  }

  return {
    resource: accept.resource,
    amount: amountFromAtomicUnits(accept.maxAmountRequired, decimals),
    payTo: accept.payTo,
    asset: accept.extra?.name ?? accept.asset,
    network: accept.network,
  };
}

/**
 * The authorization gate for an x402 payment. Call this after receiving a 402
 * and before signing the payment. Builds an {@link AuthorizeRequest} from the
 * payment requirements and runs it through {@link authorize}.
 *
 * Shotoku never signs or settles the payment. It only decides whether the
 * payment is allowed and records the decision to the ledger. The recipient,
 * asset, and network are preserved in the decision context for audit.
 */
export function authorizeX402Payment(
  actor: string,
  requirements: PaymentRequirements,
  options: { readonly policyPath: string; readonly ledgerPath: string },
): Promise<AuthorizeResponse> {
  const request: AuthorizeRequest = {
    actor,
    action: "purchase",
    resource: requirements.resource,
    rail: "x402",
    amount: requirements.amount,
    context: {
      payTo: requirements.payTo,
      asset: requirements.asset,
      network: requirements.network,
    },
  };

  return authorize(request, options);
}
