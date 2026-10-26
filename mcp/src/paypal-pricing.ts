import type { Pricer, PriceQuote } from "./pricing.js";

/**
 * Prices the tools of PayPal's MCP server (`@paypal/mcp`, built on
 * `@paypal/agent-toolkit`).
 *
 * Two of its tools send money out: `create_refund` and `accept_dispute_claim`
 * (accepting a claim refunds the buyer). Neither is safe to price from its
 * arguments alone. `create_refund` without `amount` refunds the whole capture,
 * so the cheapest-looking call is the most expensive one; `accept_dispute_claim`
 * takes only a dispute ID. Both are priced by a read-only lookup against the
 * PayPal API, with the same access token the upstream server uses.
 *
 * Every other tool PayPal ships moves no money out (reads, catalog, invoices
 * that bill someone else, orders that a buyer pays) and is priced at zero.
 * A tool not listed here is not priced at all, so a new upstream tool is held
 * for approval under a limited rule instead of passing as free.
 */

export interface PayPalPricerOptions {
  /** Bearer token for read-only lookups. Without one, lookups are not attempted. */
  readonly accessToken?: string;
  /** `PRODUCTION` for the live API; anything else is the sandbox, as in `@paypal/mcp`. */
  readonly environment?: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

/** Tools from `@paypal/mcp` that send no money out of the merchant's account. */
const NO_OUTFLOW_TOOLS: ReadonlySet<string> = new Set([
  "create_invoice",
  "list_invoices",
  "get_invoice",
  "send_invoice",
  "send_invoice_reminder",
  "cancel_sent_invoice",
  "generate_invoice_qr_code",
  "create_product",
  "list_products",
  "update_product",
  "show_product_details",
  "create_subscription_plan",
  "list_subscription_plans",
  "show_subscription_plan_details",
  "create_subscription",
  "show_subscription_details",
  "cancel_subscription",
  "create_shipment_tracking",
  "get_shipment_tracking",
  "create_order",
  "get_order",
  "pay_order",
  "list_disputes",
  "get_dispute",
  "list_transactions",
  "get_refund",
]);

/** PayPal IDs are short alphanumeric strings; nothing else goes into a URL. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** A plain decimal with at most two places, as PayPal writes USD. */
const USD_VALUE_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Reads a PayPal money object (`{ currency_code, value }`) as dollars.
 * Undefined for any other currency — budgets are in dollars, and converting
 * would put an exchange rate inside an authorization decision.
 */
export function parseUsdAmount(money: unknown): number | undefined {
  if (!isRecord(money)) return undefined;
  if (money["currency_code"] !== "USD") return undefined;
  const value = money["value"];
  if (typeof value !== "string" || !USD_VALUE_PATTERN.test(value)) return undefined;
  return Number(value);
}

export function createPayPalPricer(options: PayPalPricerOptions): Pricer {
  const baseUrl =
    options.environment?.toLowerCase() === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  /** GET a PayPal resource. Undefined on any failure: the caller fails closed. */
  async function lookup(path: string): Promise<Record<string, unknown> | undefined> {
    if (!options.accessToken) return undefined;
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return undefined;
      const body: unknown = await response.json();
      return isRecord(body) ? body : undefined;
    } catch {
      return undefined;
    }
  }

  async function priceRefund(args: Record<string, unknown>): Promise<PriceQuote | undefined> {
    if (args["amount"] !== undefined) {
      // A stated amount is final. A malformed one is not a reason to look up the
      // capture instead: that would price a call PayPal may read differently.
      const amount = parseUsdAmount(args["amount"]);
      return amount === undefined ? undefined : { amount, source: "create_refund amount argument" };
    }

    const captureId = args["capture_id"];
    if (typeof captureId !== "string" || !ID_PATTERN.test(captureId)) return undefined;

    // With no amount PayPal refunds what remains of the capture. The full
    // capture amount is an upper bound on that, which is the safe direction.
    const capture = await lookup(`/v2/payments/captures/${captureId}`);
    const amount = parseUsdAmount(capture?.["amount"]);
    return amount === undefined
      ? undefined
      : { amount, source: `full refund of capture ${captureId}` };
  }

  async function priceDisputeClaim(
    args: Record<string, unknown>,
  ): Promise<PriceQuote | undefined> {
    const disputeId = args["dispute_id"];
    if (typeof disputeId !== "string" || !ID_PATTERN.test(disputeId)) return undefined;

    const dispute = await lookup(`/v1/customer/disputes/${disputeId}`);
    const amount = parseUsdAmount(dispute?.["dispute_amount"]);
    return amount === undefined ? undefined : { amount, source: `dispute ${disputeId}` };
  }

  return {
    async price(tool, args) {
      if (tool === "create_refund") return priceRefund(args);
      if (tool === "accept_dispute_claim") return priceDisputeClaim(args);
      if (NO_OUTFLOW_TOOLS.has(tool)) {
        return { amount: 0, source: `${tool} sends no money out` };
      }
      return undefined;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
