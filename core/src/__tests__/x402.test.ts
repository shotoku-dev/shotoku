import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  authorizeX402Payment,
  parseX402Response,
} from "../x402.js";
import type { PaymentRequirements, X402Response } from "../x402.js";
import { readDecisions } from "../ledger.js";

let tmpDir: string;
let policyPath: string;
let ledgerPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "shotoku-x402-test-"));
  policyPath = join(tmpDir, "policy.yaml");
  ledgerPath = join(tmpDir, "decisions.jsonl");
});

const REQUIREMENTS: PaymentRequirements = {
  resource: "api.weather.xyz",
  amount: 0.05,
  payTo: "0xABC",
  asset: "USDC",
  network: "base",
};

describe("parseX402Response", () => {
  it("converts atomic units to major units and reads the first accept", () => {
    const response: X402Response = {
      x402Version: 1,
      accepts: [
        {
          network: "base",
          maxAmountRequired: "50000",
          resource: "api.weather.xyz",
          payTo: "0xABC",
          asset: "0xUSDC",
          extra: { name: "USDC" },
        },
      ],
    };

    const req = parseX402Response(response);
    expect(req.amount).toBeCloseTo(0.05);
    expect(req.asset).toBe("USDC");
    expect(req.resource).toBe("api.weather.xyz");
    expect(req.payTo).toBe("0xABC");
    expect(req.network).toBe("base");
  });

  it("falls back to the asset address when no friendly name is present", () => {
    const response: X402Response = {
      x402Version: 1,
      accepts: [
        {
          network: "base",
          maxAmountRequired: "1000000",
          resource: "api.weather.xyz",
          payTo: "0xABC",
          asset: "0xUSDC",
        },
      ],
    };

    expect(parseX402Response(response).asset).toBe("0xUSDC");
  });

  it("throws when there are no payment options", () => {
    expect(() => parseX402Response({ x402Version: 1, accepts: [] })).toThrow();
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

  it("records the recipient address in the decision context", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: api.weather.xyz\n    verdict: approved\n    maxAmount: 1\n`,
    );

    await authorizeX402Payment("agent-1", REQUIREMENTS, { policyPath, ledgerPath });

    const entries = await readDecisions(ledgerPath);
    expect(entries[0]!.request.context?.["payTo"]).toBe("0xABC");
  });
});
