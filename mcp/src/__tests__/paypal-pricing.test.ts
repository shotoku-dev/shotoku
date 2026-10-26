import { describe, it, expect } from "vitest";
import { createPayPalPricer, parseUsdAmount } from "../paypal-pricing.js";

interface FakeCall {
  readonly url: string;
  readonly authorization: string | null;
}

/** A fetch that answers from a table of URLs and records what was asked. */
function fakeFetch(responses: Record<string, { status: number; body: unknown }>) {
  const calls: FakeCall[] = [];
  const fetchImpl = async (...[input, init]: Parameters<typeof fetch>) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, authorization: headers.get("authorization") });
    const response = responses[url];
    if (!response) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(response.body), { status: response.status });
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

const SANDBOX = "https://api-m.sandbox.paypal.com";
const CAPTURE_ID = "21U52621A9811731L";
const DISPUTE_ID = "PP-D-27803";

function pricer(responses: Record<string, { status: number; body: unknown }> = {}, overrides = {}) {
  const fake = fakeFetch(responses);
  return {
    ...fake,
    pricer: createPayPalPricer({ accessToken: "test-token", fetch: fake.fetchImpl, ...overrides }),
  };
}

describe("parseUsdAmount", () => {
  it("reads a PayPal money object in USD", () => {
    expect(parseUsdAmount({ currency_code: "USD", value: "89.00" })).toBe(89);
    expect(parseUsdAmount({ currency_code: "USD", value: "0.5" })).toBe(0.5);
  });

  it("refuses other currencies, because budgets are in dollars", () => {
    expect(parseUsdAmount({ currency_code: "EUR", value: "89.00" })).toBeUndefined();
  });

  it("refuses anything that is not a plain decimal string", () => {
    for (const value of ["abc", "-5", "1e3", "89.999", "", " 89", 89]) {
      expect(parseUsdAmount({ currency_code: "USD", value })).toBeUndefined();
    }
    expect(parseUsdAmount(undefined)).toBeUndefined();
    expect(parseUsdAmount("89.00")).toBeUndefined();
  });
});

describe("PayPal pricer — create_refund", () => {
  it("prices a partial refund from its amount argument, without a lookup", async () => {
    const { pricer: p, calls } = pricer();

    const quote = await p.price("create_refund", {
      capture_id: CAPTURE_ID,
      amount: { currency_code: "USD", value: "89.00" },
    });

    expect(quote?.amount).toBe(89);
    expect(calls).toEqual([]);
  });

  it("prices a refund with no amount at the full capture, which is what PayPal refunds", async () => {
    const { pricer: p, calls } = pricer({
      [`${SANDBOX}/v2/payments/captures/${CAPTURE_ID}`]: {
        status: 200,
        body: { id: CAPTURE_ID, amount: { currency_code: "USD", value: "480.00" } },
      },
    });

    const quote = await p.price("create_refund", { capture_id: CAPTURE_ID });

    expect(quote?.amount).toBe(480);
    expect(quote?.source).toContain(CAPTURE_ID);
    expect(calls).toEqual([
      {
        url: `${SANDBOX}/v2/payments/captures/${CAPTURE_ID}`,
        authorization: "Bearer test-token",
      },
    ]);
  });

  it("does not price a refund in another currency", async () => {
    const { pricer: p } = pricer();

    const quote = await p.price("create_refund", {
      capture_id: CAPTURE_ID,
      amount: { currency_code: "EUR", value: "10.00" },
    });

    expect(quote).toBeUndefined();
  });

  it("does not fall back to a lookup when the amount argument is malformed", async () => {
    const { pricer: p, calls } = pricer();

    const quote = await p.price("create_refund", {
      capture_id: CAPTURE_ID,
      amount: { currency_code: "USD", value: "lots" },
    });

    expect(quote).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("fails closed when the capture lookup fails", async () => {
    const { pricer: p } = pricer({
      [`${SANDBOX}/v2/payments/captures/${CAPTURE_ID}`]: { status: 500, body: {} },
    });

    expect(await p.price("create_refund", { capture_id: CAPTURE_ID })).toBeUndefined();
  });

  it("fails closed when the network throws", async () => {
    const throwing = (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    const p = createPayPalPricer({ accessToken: "test-token", fetch: throwing });

    expect(await p.price("create_refund", { capture_id: CAPTURE_ID })).toBeUndefined();
  });

  it("fails closed when the capture has no usable amount", async () => {
    const { pricer: p } = pricer({
      [`${SANDBOX}/v2/payments/captures/${CAPTURE_ID}`]: { status: 200, body: { id: CAPTURE_ID } },
    });

    expect(await p.price("create_refund", { capture_id: CAPTURE_ID })).toBeUndefined();
  });

  it("does not look anything up without an access token", async () => {
    const fake = fakeFetch({});
    const p = createPayPalPricer({ fetch: fake.fetchImpl });

    expect(await p.price("create_refund", { capture_id: CAPTURE_ID })).toBeUndefined();
    expect(fake.calls).toEqual([]);
  });

  it("never puts an unchecked ID into a URL", async () => {
    const { pricer: p, calls } = pricer();

    for (const capture_id of ["../../v1/oauth2/token", "abc?x=1", "", 42]) {
      expect(await p.price("create_refund", { capture_id })).toBeUndefined();
    }
    expect(calls).toEqual([]);
  });

  it("looks up live captures on the live API", async () => {
    const { pricer: p, calls } = pricer(
      {
        [`https://api-m.paypal.com/v2/payments/captures/${CAPTURE_ID}`]: {
          status: 200,
          body: { amount: { currency_code: "USD", value: "12.34" } },
        },
      },
      { environment: "PRODUCTION" },
    );

    expect((await p.price("create_refund", { capture_id: CAPTURE_ID }))?.amount).toBe(12.34);
    expect(calls[0]?.url.startsWith("https://api-m.paypal.com/")).toBe(true);
  });
});

describe("PayPal pricer — accept_dispute_claim", () => {
  it("prices accepting a claim at the disputed amount", async () => {
    const { pricer: p } = pricer({
      [`${SANDBOX}/v1/customer/disputes/${DISPUTE_ID}`]: {
        status: 200,
        body: { dispute_id: DISPUTE_ID, dispute_amount: { currency_code: "USD", value: "150.00" } },
      },
    });

    const quote = await p.price("accept_dispute_claim", { dispute_id: DISPUTE_ID, note: "ok" });

    expect(quote?.amount).toBe(150);
    expect(quote?.source).toContain(DISPUTE_ID);
  });

  it("fails closed when the dispute lookup fails", async () => {
    const { pricer: p } = pricer();

    expect(await p.price("accept_dispute_claim", { dispute_id: DISPUTE_ID })).toBeUndefined();
  });
});

describe("PayPal pricer — tools that send no money out", () => {
  it("prices reads and inbound payments at zero, without a lookup", async () => {
    const { pricer: p, calls } = pricer();

    for (const tool of ["list_transactions", "get_order", "pay_order", "create_order", "send_invoice"]) {
      expect((await p.price(tool, {}))?.amount).toBe(0);
    }
    expect(calls).toEqual([]);
  });

  it("does not price a tool it does not know", async () => {
    const { pricer: p } = pricer();

    expect(await p.price("create_payout", { amount: "1.00" })).toBeUndefined();
  });
});
