import type { AuthorizeRequest, AuthorizeResponse } from "./types.js";
import { authorize } from "./authorize.js";
import { fingerprintOf } from "./grant.js";
import { fromMicros, MICROS_PER_DOLLAR } from "./money.js";
import { normalizeRecipient } from "./recipient.js";
import { ShotokuError } from "./errors.js";

/**
 * Everything in a 402 body is written by the server asking to be paid, so none
 * of it can decide which policy applies or what the amount is worth:
 *
 * - The policy `resource` is the host of the URL the agent actually requested,
 *   never the 402's own `resource` claim — otherwise any server could name an
 *   allowlisted vendor and collect payment to its own address.
 * - The asset is identified by network + contract address against a registry,
 *   and its decimals come from that registry — never from `extra.name` or from
 *   the caller assuming USDC. A server asking for 5,000,000 atomic units of an
 *   8-decimal token is asking for 0.05 of it, not $5.
 * - `payTo` becomes the request's `recipient`, so `recipients` rules can pin it
 *   and a human approval is bound to it.
 */

/** A token Shotoku can value. Amounts are read in its major units. */
export interface X402Asset {
  /** Network exactly as it appears in the 402, e.g. "base" or "eip155:8453". */
  readonly network: string;

  /** Token contract address. EVM addresses compare case-insensitively. */
  readonly address: string;

  /** Display symbol, e.g. "USDC". Recorded for audit; never read from the 402. */
  readonly symbol: string;

  /** Token decimals: atomic units per major unit is 10^decimals. */
  readonly decimals: number;
}

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * Assets recognised without configuration: USDC on Base and Base Sepolia, under
 * both the x402 v1 network names and their CAIP-2 IDs.
 *
 * Policy limits are plain numbers compared against amounts in an asset's major
 * units, so register only assets whose unit means what your limits mean —
 * dollar stablecoins, if your limits are in dollars.
 */
export const KNOWN_X402_ASSETS: readonly X402Asset[] = [
  { network: "base", address: BASE_USDC, symbol: "USDC", decimals: 6 },
  { network: "eip155:8453", address: BASE_USDC, symbol: "USDC", decimals: 6 },
  { network: "base-sepolia", address: BASE_SEPOLIA_USDC, symbol: "USDC", decimals: 6 },
  { network: "eip155:84532", address: BASE_SEPOLIA_USDC, symbol: "USDC", decimals: 6 },
];

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

  /** The resource being paid for, as claimed by the server. */
  readonly resource: string;

  /** Recipient address. */
  readonly payTo: string;

  /** Token contract address. */
  readonly asset: string;

  /** Optional metadata. Server-written, so never used to identify the asset. */
  readonly extra?: { readonly name?: string };
}

export interface X402Response {
  readonly x402Version: number;
  readonly accepts: readonly X402Accept[];
}

/**
 * Normalized payment details extracted from an x402 `402 Payment Required`
 * response. This is Shotoku's internal view — a friendly decimal amount and
 * asset name — independent of the on-the-wire x402 format.
 */
export interface PaymentRequirements {
  /**
   * The host the agent sent its request to, e.g. "api.weather.xyz". This is what
   * policy rules match, so it comes from the agent's side of the exchange.
   */
  readonly resource: string;

  /** Amount required, in the asset's major units (e.g. 0.05 for 0.05 USDC). */
  readonly amount: number;

  /** Address the payment settles to (e.g. "0xABC…"). Matched by `recipients`. */
  readonly payTo: string;

  /** Asset symbol from the registry, e.g. "USDC". */
  readonly asset: string;

  /** Token contract address of the asset being paid. */
  readonly assetAddress: string;

  /** Settlement network, e.g. "base". */
  readonly network: string;

  /** The server's own `resource` claim. Recorded for audit, never matched. */
  readonly claimedResource: string;

  /**
   * The exact payment option this was built from. Sign this one: the 402 may
   * list several, and the decision covers this option only.
   */
  readonly option: X402Accept;
}

export interface X402AssetOptions {
  /** Assets to recognise in addition to {@link KNOWN_X402_ASSETS}. */
  readonly assets?: readonly X402Asset[];
}

export interface ParseX402Options extends X402AssetOptions {
  /** The URL the agent requested and got the 402 from. Required. */
  readonly requestUrl: string;
}

const MAX_DECIMALS = 36;

function invalid(message: string): ShotokuError {
  return new ShotokuError("request_invalid", message);
}

function assertAsset(asset: X402Asset): void {
  if (
    !asset.network.trim() ||
    !asset.address.trim() ||
    !Number.isInteger(asset.decimals) ||
    asset.decimals < 0 ||
    asset.decimals > MAX_DECIMALS
  ) {
    throw invalid(
      `x402 asset ${asset.symbol} on ${asset.network} needs a network, an address, and integer decimals from 0 to ${MAX_DECIMALS}`,
    );
  }
}

/** The registered asset for this network + contract address, if any. */
export function findX402Asset(
  network: string,
  address: string,
  options: X402AssetOptions = {},
): X402Asset | undefined {
  const extra = options.assets ?? [];
  extra.forEach(assertAsset);

  const wantedAddress = normalizeRecipient(address);
  return [...extra, ...KNOWN_X402_ASSETS].find(
    (asset) =>
      asset.network === network.trim() &&
      normalizeRecipient(asset.address) === wantedAddress,
  );
}

/**
 * Atomic units → major units, through integer micro-units.
 *
 * BigInt all the way: a float detour loses precision on 18-decimal amounts.
 * Anything finer than a micro-unit is rounded *up*, so dust can never be
 * authorized as free.
 */
function amountFromAtomicUnits(value: string, decimals: number): number {
  if (!/^\d+$/.test(value)) {
    throw invalid("x402 amount must be a non-negative integer string");
  }

  const microDecimals = Math.log10(MICROS_PER_DOLLAR);
  const atomic = BigInt(value);
  const scale = 10n ** BigInt(Math.abs(decimals - microDecimals));
  const micros =
    decimals <= microDecimals ? atomic * scale : (atomic + scale - 1n) / scale;

  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw invalid("x402 amount is too large to represent safely");
  }

  return fromMicros(Number(micros));
}

function hostOf(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convert an x402 402 response into Shotoku's normalized
 * {@link PaymentRequirements}.
 *
 * Picks the first payment option in a registered asset (see
 * {@link KNOWN_X402_ASSETS}) and refuses the response if there is none, or if
 * the option claims a resource on a different host than `requestUrl`. Throws a
 * `ShotokuError` with code `request_invalid` on anything it cannot trust.
 */
export function parseX402Response(
  response: X402Response,
  options: ParseX402Options,
): PaymentRequirements {
  let resource: string;
  try {
    resource = new URL(options.requestUrl).host;
  } catch {
    resource = "";
  }
  if (!resource) {
    throw invalid("requestUrl must be the absolute URL the agent requested");
  }

  if (response.accepts.length === 0) {
    throw invalid("x402 response contains no payment options");
  }

  const match = response.accepts
    .map((option) => ({
      option,
      asset: findX402Asset(option.network, option.asset, options),
    }))
    .find((candidate) => candidate.asset !== undefined);

  if (!match?.asset) {
    const offered = response.accepts
      .map((option) => `${option.asset || "?"} on network ${option.network || "?"}`)
      .join(", ");
    throw invalid(
      `x402 response offers no payment option in a known asset (offered: ${offered}). Register the asset to accept it.`,
    );
  }

  const { option, asset } = match;
  if (!option.payTo.trim()) {
    throw invalid("x402 payment option is missing payTo");
  }

  const claimedHost = hostOf(option.resource);
  if (!claimedHost) {
    throw invalid("x402 payment option is missing resource");
  }
  if (claimedHost !== resource) {
    throw invalid(
      `x402 payment option claims a resource on ${claimedHost}, but the request went to ${resource}`,
    );
  }

  return {
    resource,
    amount: amountFromAtomicUnits(option.maxAmountRequired, asset.decimals),
    payTo: option.payTo.trim(),
    asset: asset.symbol,
    assetAddress: asset.address,
    network: asset.network,
    claimedResource: option.resource,
    option,
  };
}

/**
 * The authorization gate for an x402 payment. Call this after receiving a 402
 * and before signing the payment. Builds an {@link AuthorizeRequest} from the
 * payment requirements and runs it through {@link authorize}.
 *
 * Shotoku never signs or settles the payment. It only decides whether the
 * payment is allowed and records the decision to the ledger. The recipient is
 * the request's `recipient`; the asset and network are bound into its
 * fingerprint, so a human approval of one payment cannot be redeemed for the
 * same amount of a different token or chain.
 */
export function authorizeX402Payment(
  actor: string,
  requirements: PaymentRequirements,
  options: X402AssetOptions & {
    readonly policyPath: string;
    readonly ledgerPath: string;
    readonly receiptSecret?: string;
    readonly receiptTtlSeconds?: number;
  },
): Promise<AuthorizeResponse> {
  // Re-checked here because requirements can be built by hand, and an amount in
  // an unknown asset is a number with no meaning.
  if (!findX402Asset(requirements.network, requirements.assetAddress, options)) {
    return Promise.reject(
      invalid(
        `x402 asset ${requirements.assetAddress} on ${requirements.network} is not registered`,
      ),
    );
  }

  const request: AuthorizeRequest = {
    actor,
    action: "purchase",
    resource: requirements.resource,
    rail: "x402",
    amount: requirements.amount,
    recipient: requirements.payTo,
    fingerprint: fingerprintOf({
      network: requirements.network,
      asset: normalizeRecipient(requirements.assetAddress),
    }),
    context: {
      payTo: requirements.payTo,
      asset: requirements.asset,
      assetAddress: requirements.assetAddress,
      network: requirements.network,
      claimedResource: requirements.claimedResource,
    },
  };

  return authorize(request, {
    policyPath: options.policyPath,
    ledgerPath: options.ledgerPath,
    ...(options.receiptSecret !== undefined
      ? { receiptSecret: options.receiptSecret }
      : {}),
    ...(options.receiptTtlSeconds !== undefined
      ? { receiptTtlSeconds: options.receiptTtlSeconds }
      : {}),
  });
}
