import { createPayPalPricer } from "./paypal-pricing.js";

/**
 * Pricing for wrapped tools.
 *
 * A wrapped MCP call carries no amount, so a policy limit on it could never be
 * checked (core now holds such calls for approval rather than letting them
 * through uncounted). A pricer answers one question per call: how much money
 * does this call send out of the account? That number becomes the request's
 * `amount`, and the ordinary limits and budgets apply to it.
 *
 * Pricers do I/O (a lookup when the arguments do not say the amount), which is
 * why they live here, next to the upstream code, and not in core: core still
 * receives a plain number and stays pure.
 *
 * `undefined` means "not priced" — unknown tool, failed lookup, foreign
 * currency, malformed argument. It is never coerced to zero: an unpriced call
 * against a limited rule is held for a human.
 */

export interface PriceQuote {
  /** Dollars this call sends out of the account. Zero for calls that send none. */
  readonly amount: number;
  /** Where the amount came from, recorded with the decision for the audit trail. */
  readonly source: string;
}

export interface Pricer {
  price(tool: string, args: Record<string, unknown>): Promise<PriceQuote | undefined>;
}

/** The pricers an upstream entry can name with `"pricing": "<kind>"`. */
export const PRICING_KINDS = ["paypal"] as const;

export type PricingKind = (typeof PRICING_KINDS)[number];

export function isPricingKind(value: unknown): value is PricingKind {
  return typeof value === "string" && (PRICING_KINDS as readonly string[]).includes(value);
}

export interface PricedServerConfig {
  readonly pricing?: PricingKind;
  readonly env?: Record<string, string>;
}

/**
 * The pricer for one upstream server, or undefined when it names none.
 *
 * Credentials come from the server's own `env` entry and nowhere else. That is
 * exactly what the upstream process receives (the MCP SDK passes it only a
 * handful of shell variables besides), so a lookup sees the same account and
 * environment as the call it prices.
 */
export function pricerFor(config: PricedServerConfig): Pricer | undefined {
  if (config.pricing === "paypal") {
    return createPayPalPricer({
      ...(config.env?.["PAYPAL_ACCESS_TOKEN"]
        ? { accessToken: config.env["PAYPAL_ACCESS_TOKEN"] }
        : {}),
      ...(config.env?.["PAYPAL_ENVIRONMENT"]
        ? { environment: config.env["PAYPAL_ENVIRONMENT"] }
        : {}),
    });
  }
  return undefined;
}
