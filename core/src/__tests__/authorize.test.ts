import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorize } from "../authorize.js";
import { readDecisions } from "../ledger.js";

let tmpDir: string;
let policyPath: string;
let ledgerPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "shotoku-auth-test-"));
  policyPath = join(tmpDir, "policy.yaml");
  ledgerPath = join(tmpDir, "decisions.jsonl");
});

describe("authorize", () => {
  it("approves a known vendor under limits and records the decision", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: openai.com\n    verdict: approved\n    maxAmount: 50\n`,
    );

    const response = await authorize(
      { actor: "agent-1", action: "api_call", resource: "openai.com", amount: 10 },
      { policyPath, ledgerPath },
    );

    expect(response.approved).toBe(true);
    expect(response.status).toBe("approved");
    expect(response.decisionId).toMatch(/^dec_/);
    expect(response.timestamp).toBeTruthy();

    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.decisionId).toBe(response.decisionId);
    expect(entries[0]!.request.resource).toBe("openai.com");
  });

  it("denies when amount exceeds per-transaction limit", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: openai.com\n    verdict: approved\n    maxAmount: 5\n`,
    );

    const response = await authorize(
      { actor: "agent-1", action: "api_call", resource: "openai.com", amount: 20 },
      { policyPath, ledgerPath },
    );

    expect(response.approved).toBe(false);
    expect(response.status).toBe("denied");

    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.response.status).toBe("denied");
  });

  it("returns pending_approval for an unknown vendor", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: openai.com\n    verdict: approved\n`,
    );

    const response = await authorize(
      { actor: "agent-1", action: "purchase", resource: "unknown-vendor.io" },
      { policyPath, ledgerPath },
    );

    expect(response.approved).toBe(false);
    expect(response.status).toBe("pending_approval");

    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(1);
  });

  it("denies when daily budget is exhausted by prior decisions", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: openai.com\n    verdict: approved\n    maxAmount: 50\n    maxDailyAmount: 30\n`,
    );

    await authorize(
      { actor: "agent-1", action: "api_call", resource: "openai.com", amount: 20 },
      { policyPath, ledgerPath },
    );

    const response = await authorize(
      { actor: "agent-1", action: "api_call", resource: "openai.com", amount: 20 },
      { policyPath, ledgerPath },
    );

    expect(response.status).toBe("denied");
    expect(response.reasons.some((r) => r.type === "budget_check")).toBe(true);

    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(2);
  });

  it("returns denied with reason when policy file is missing", async () => {
    const response = await authorize(
      { actor: "agent-1", action: "api_call", resource: "openai.com" },
      { policyPath: join(tmpDir, "nonexistent.yaml"), ledgerPath },
    );

    expect(response.approved).toBe(false);
    expect(response.status).toBe("denied");
    expect(response.reasons[0]!.text).toMatch(/not found/i);
  });

  it("denies and records invalid policy files with a precise reason", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: openai.com\n    verdict: approve\n`,
    );

    const response = await authorize(
      { actor: "agent-1", action: "api_call", resource: "openai.com" },
      { policyPath, ledgerPath },
    );

    expect(response.status).toBe("denied");
    expect(response.reasons[0]!.text).toMatch(/verdict/i);

    const entries = await readDecisions(ledgerPath);
    expect(entries).toHaveLength(1);
  });

  it("denies invalid requests before policy evaluation", async () => {
    await writeFile(
      policyPath,
      `rules:\n  - resource: "*"\n    verdict: approved\n`,
    );

    const response = await authorize(
      { actor: "", action: "api_call", resource: "openai.com" },
      { policyPath, ledgerPath },
    );

    expect(response.status).toBe("denied");
    expect(response.reasons[0]!.text).toBe("actor is required");
  });
});
