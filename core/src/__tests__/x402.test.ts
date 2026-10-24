import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  KNOWN_X402_ASSETS,
  authorizeX402Payment,
  parseX402Response,
} from "../x402.js";
import type { PaymentRequirements, X402Accept, X402Response } from "../x402.js";
import { approve } from "../approve.js";
import { readDecisions } from "../ledger.js";

let tmpDir: string;
let policyPath: string;
let ledgerPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "shotoku-x402-test-"));
  policyPath = join(tmpDir, "policy.yaml");
  ledgerPath = join(tmpDir, "decisions.jsonl");
});

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const VENDOR = "0x1111111111111111111111111111111111111111";
const ATTACKER = "0x2222222222222222222222222222222222222222";
const REQUEST_URL = "https://api.weather.xyz/v1/forecast?city=paris";

function accept(overrides: Partial<X402Accept> = {}): X402Accept {
  return {
    network: "base",
    maxAmountRequired: "50000",
    resource: "https://api.weather.xyz/v1/forecast",
    payTo: VENDOR,
    asset: BASE_USDC,
    extra: { name: "USDC" },
    ...overrides,
  };
}

function response(...accepts: X402Accept[]): X402Response {
  return { x402Version: 1, accepts };
}

const REQUIREMENTS: PaymentRequirements = parseX402Response(response(accept()), {
  requestUrl: REQUEST_URL,
});

describe("parseX402Response", () => {
  it("reads a USDC-on-Base option in major units", () => {
    const req = parseX402Response(response(accept()), { requestUrl: REQUEST_URL });

    expect(req.amount).toBe(0.05);
    expect(req.asset).toBe("USDC");
    expect(req.assetAddress).toBe(BASE_USDC);
    expect(req.payTo).toBe(VENDOR);
    expect(req.network).toBe("base");
  });

  it("takes the resource from the URL the agent requested, not from the 402", () => {
    const req = parseX402Response(
      response(accept({ resource: "https://api.weather.xyz/anything-the-server-says" })),
      { requestUrl: REQUEST_URL },
    );

    // Host only: path and query must not split a vendor into many resources.
    expect(req.resource).toBe("api.weather.xyz");
    expect(req.claimedResource).toBe("https://api.weather.xyz/anything-the-server-says");
  });

  it("refuses an option that claims a resource on another host", () => {
    // A malicious server naming an allowlisted vendor to collect payment itself.
    const spoofed = response(
      accept({ resource: "https://api.openai.com/v1/chat", payTo: ATTACKER }),
    );

    expect(() =>
      parseX402Response(spoofed, { requestUrl: "https://evil.example/pay" }),
    ).toThrow(/claims a resource on api\.openai\.com/);
  });

  it("requires an absolute requestUrl", () => {
    expect(() =>
      parseX402Response(response(accept()), { requestUrl: "api.weather.xyz" }),
    ).toThrow(/requestUrl/);
  });

  it("refuses an asset it does not know, whatever extra.name says", () => {
    // 5,000,000 atomic units of an 8-decimal token is 0.05 of it — worth far more
    // than $5 for a BTC-like asset. Assuming 6 decimals would read it as $5.
    const wbtcLike = response(
      accept({
        asset: "0x3333333333333333333333333333333333333333",
        maxAmountRequired: "5000000",
        extra: { name: "USDC" },
      }),
    );

    expect(() => parseX402Response(wbtcLike, { requestUrl: REQUEST_URL })).toThrow(
      /no payment option in a known asset/,
    );
  });

  it("refuses the canonical USDC address on the wrong network", () => {
    const wrongChain = response(accept({ network: "polygon" }));

    expect(() => parseX402Response(wrongChain, { requestUrl: REQUEST_URL })).toThrow(
      /known asset/,
    );
  });

  it("uses the registered decimals of a caller-supplied asset", () => {
    const token = "0x4444444444444444444444444444444444444444";
    const req = parseX402Response(
      response(accept({ asset: token, maxAmountRequired: "5000000" })),
      {
        requestUrl: REQUEST_URL,
        assets: [{ network: "base", address: token, symbol: "TKN8", decimals: 8 }],
      },
    );

    expect(req.amount).toBe(0.05);
    expect(req.asset).toBe("TKN8");
  });

  it("rounds sub-micro amounts up so dust is never free", () => {
    const token = "0x5555555555555555555555555555555555555555";
    const req = parseX402Response(
      response(accept({ asset: token, maxAmountRequired: "1" })),
      {
        requestUrl: REQUEST_URL,
        assets: [{ network: "base", address: token, symbol: "T18", decimals: 18 }],
      },
    );

    expect(req.amount).toBe(0.000001);
  });

  it("skips unknown options and returns the known one to sign", () => {
    const unknown = accept({ asset: "0x6666666666666666666666666666666666666666" });
    const known = accept({ maxAmountRequired: "70000" });
    const req = parseX402Response(response(unknown, known), { requestUrl: REQUEST_URL });

    expect(req.option).toBe(known);
    expect(req.amount).toBe(0.07);
  });

  it("matches the asset address case-insensitively", () => {
    const req = parseX402Response(response(accept({ asset: BASE_USDC.toLowerCase() })), {
      requestUrl: REQUEST_URL,
    });

    expect(req.asset).toBe("USDC");
  });

  it("knows USDC on Base under its CAIP-2 network id", () => {
    expect(KNOWN_X402_ASSETS.some((asset) => asset.network === "eip155:8453")).toBe(true);
    const req = parseX402Response(response(accept({ network: "eip155:8453" })), {
      requestUrl: REQUEST_URL,
    });

    expect(req.network).toBe("eip155:8453");
  });

  it("throws when there are no payment options", () => {
    expect(() => parseX402Response(response(), { requestUrl: REQUEST_URL })).toThrow(
      /no payment options/,
    );
  });

  it("throws when the atomic amount is not a non-negative integer string", () => {
    expect(() =>
      parseX402Response(response(accept({ maxAmountRequired: "10.5" })), {
        requestUrl: REQUEST_URL,
      }),
    ).toThrow(/amount/i);
  });

  it("throws when payTo is empty", () => {
    expect(() =>
      parseX402Response(response(accept({ payTo: " " })), { requestUrl: REQUEST_URL }),
    ).toThrow(/payTo/);
  });

  it("rejects a malformed caller-supplied asset", () => {
    expect(() =>
      parseX402Response(response(accept()), {
        requestUrl: REQUEST_URL,
        assets: [{ network: "base", address: "0x7", symbol: "BAD", decimals: 2.5 }],
      }),
    ).toThrow(/decimals/);
  });
});

describe("authorizeX402Payment", () => {
  it("approves a payment to an allowlisted vendor under the limit", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: api.weather.xyz\n    actions: [purchase]\n    verdict: approved\n    maxAmount: 1\n`,
    );

    const res = await authorizeX402Payment("agent-1", REQUIREMENTS, {
      policyPath,
      ledgerPath,
    });

    expect(res.approved).toBe(true);
    expect(res.status).toBe("approved");

    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.request.rail).toBe("x402");
    expect(entries[0]!.request.action).toBe("purchase");
    expect(entries[0]!.request.recipient).toBe(VENDOR);
  });

  it("denies a payment above the per-transaction limit", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: api.weather.xyz\n    verdict: approved\n    maxAmount: 0.01\n`,
    );

    const res = await authorizeX402Payment("agent-1", REQUIREMENTS, {
      policyPath,
      ledgerPath,
    });

    expect(res.approved).toBe(false);
    expect(res.status).toBe("denied");
  });

  it("returns pending_approval for a vendor not on the allowlist", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: openai.com\n    verdict: approved\n`,
    );

    const res = await authorizeX402Payment("agent-1", REQUIREMENTS, {
      policyPath,
      ledgerPath,
    });

    expect(res.status).toBe("pending_approval");
  });

  it("holds a payment to an address the rule does not pin", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: api.weather.xyz\n    recipients: ["${ATTACKER}"]\n    verdict: approved\n`,
    );

    const res = await authorizeX402Payment("agent-1", REQUIREMENTS, {
      policyPath,
      ledgerPath,
    });

    expect(res.status).toBe("pending_approval");
  });

  it("approves a pinned recipient written in a different case", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: api.weather.xyz\n    recipients: ["${VENDOR.toUpperCase().replace("0X", "0x")}"]\n    verdict: approved\n`,
    );

    const res = await authorizeX402Payment("agent-1", REQUIREMENTS, {
      policyPath,
      ledgerPath,
    });

    expect(res.status).toBe("approved");
  });

  it("does not redeem an approval for the same payment to another address", async () => {
    await writeFile(policyPath, `rules: []\n`);

    const first = await authorizeX402Payment("agent-1", REQUIREMENTS, {
      policyPath,
      ledgerPath,
    });
    expect(first.status).toBe("pending_approval");
    await approve(first.decisionId, { ledgerPath });

    const redirected: PaymentRequirements = { ...REQUIREMENTS, payTo: ATTACKER };
    const retry = await authorizeX402Payment("agent-1", redirected, {
      policyPath,
      ledgerPath,
    });
    expect(retry.status).toBe("pending_approval");

    const honest = await authorizeX402Payment("agent-1", REQUIREMENTS, {
      policyPath,
      ledgerPath,
    });
    expect(honest.status).toBe("approved");
  });

  it("refuses hand-built requirements in an unregistered asset", async () => {
    await writeFile(policyPath, `rules:\n  - resource: "*"\n    verdict: approved\n`);

    await expect(
      authorizeX402Payment(
        "agent-1",
        { ...REQUIREMENTS, assetAddress: "0x3333333333333333333333333333333333333333" },
        { policyPath, ledgerPath },
      ),
    ).rejects.toThrow(/not registered/);
    expect(await readDecisions(ledgerPath)).toHaveLength(0);
  });

  it("records the payment details in the decision context", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: api.weather.xyz\n    verdict: approved\n    maxAmount: 1\n`,
    );

    await authorizeX402Payment("agent-1", REQUIREMENTS, { policyPath, ledgerPath });

    const entries = await readDecisions(ledgerPath);
    expect(entries[0]!.request.context).toMatchObject({
      payTo: VENDOR,
      asset: "USDC",
      assetAddress: BASE_USDC,
      network: "base",
      claimedResource: "https://api.weather.xyz/v1/forecast",
    });
  });
});
