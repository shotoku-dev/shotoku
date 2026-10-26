import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorize } from "../authorize.js";
import { approve, deny } from "../approve.js";
import { getOpenGrants, readDecisions } from "../ledger.js";
import { fingerprintOf, grantSignature } from "../grant.js";
import type { AuthorizeRequest } from "../types.js";

let dir: string;
let policyPath: string;
let ledgerPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "shotoku-grant-test-"));
  policyPath = join(dir, "policy.yaml");
  ledgerPath = join(dir, "decisions.jsonl");
});

async function writePolicy(body: string): Promise<void> {
  await writeFile(policyPath, body, "utf8");
}

const PENDING_POLICY =
  "rules:\n  - resource: openai.com\n    verdict: pending_approval\n";

function request(overrides: Partial<AuthorizeRequest> = {}): AuthorizeRequest {
  return {
    actor: "agent-1",
    action: "api_call",
    resource: "openai.com",
    amount: 10,
    ...overrides,
  };
}

function run(req: AuthorizeRequest = request()) {
  return authorize(req, { policyPath, ledgerPath });
}

/**
 * The loop the product promised and did not deliver: approvals were write-only
 * audit data, so a human could approve and the agent retrying got a fresh
 * decision with the same pending verdict, forever.
 */
describe("approve, then retry", () => {
  it("lets the retry through", async () => {
    await writePolicy(PENDING_POLICY);

    const first = await run();
    expect(first.status).toBe("pending_approval");

    await approve(first.decisionId, { ledgerPath });

    const retry = await run();
    expect(retry.status).toBe("approved");
    expect(retry.approved).toBe(true);
  });

  it("names the approval it redeemed", async () => {
    await writePolicy(PENDING_POLICY);
    const first = await run();
    const approval = await approve(first.decisionId, { ledgerPath });

    const retry = await run();

    const entries = await readDecisions(ledgerPath);
    const redeeming = entries.find((e) => e.decisionId === retry.decisionId);
    expect(redeeming?.grant).toEqual({
      approvalId: approval.approvalId,
      decisionId: first.decisionId,
    });
    expect(retry.reasons.some((r) => r.text.includes(first.decisionId))).toBe(true);
  });

  /** One approval, one action. Standing permission is what policy.yaml is for. */
  it("redeems exactly once", async () => {
    await writePolicy(PENDING_POLICY);
    const first = await run();
    await approve(first.decisionId, { ledgerPath });

    expect((await run()).status).toBe("approved");
    expect((await run()).status).toBe("pending_approval");
  });

  it("leaves the grant visible until it is spent", async () => {
    await writePolicy(PENDING_POLICY);
    const first = await run();
    await approve(first.decisionId, { ledgerPath });

    expect(await getOpenGrants(ledgerPath)).toHaveLength(1);
    await run();
    expect(await getOpenGrants(ledgerPath)).toHaveLength(0);
  });
});

describe("approve, then retry, when the amount is unknown", () => {
  const LIMITED_POLICY =
    "rules:\n  - resource: openai.com\n    verdict: approved\n    maxAmount: 100\n";

  it("holds the request, then lets the approved retry through", async () => {
    await writePolicy(LIMITED_POLICY);
    const { amount: _omitted, ...unpriced } = request();

    const first = await run(unpriced);
    expect(first.status).toBe("pending_approval");

    await approve(first.decisionId, { ledgerPath });

    const retry = await run(unpriced);
    expect(retry.status).toBe("approved");
  });
});

describe("what a grant does not cover", () => {
  it("does not travel to a different amount", async () => {
    await writePolicy(PENDING_POLICY);
    const first = await run(request({ amount: 10 }));
    await approve(first.decisionId, { ledgerPath });

    expect((await run(request({ amount: 11 }))).status).toBe("pending_approval");
  });

  it("does not travel to a different actor", async () => {
    await writePolicy(PENDING_POLICY);
    const first = await run();
    await approve(first.decisionId, { ledgerPath });

    expect((await run(request({ actor: "other" }))).status).toBe("pending_approval");
  });

  /**
   * The escalation this guards against: for MCP the resource is
   * `<server>__<tool>`, so without a fingerprint a human approving a write to
   * one path would hand the agent a grant redeemable against any other.
   */
  it("does not travel to different arguments", async () => {
    await writePolicy(
      "rules:\n  - resource: fs__write_file\n    verdict: pending_approval\n",
    );

    const safe: AuthorizeRequest = {
      actor: "agent-1",
      action: "mcp_tool",
      rail: "mcp",
      resource: "fs__write_file",
      fingerprint: fingerprintOf({ path: "/tmp/notes.txt" }),
    };
    const dangerous = {
      ...safe,
      fingerprint: fingerprintOf({ path: "/home/me/.ssh/authorized_keys" }),
    };

    const first = await run(safe);
    await approve(first.decisionId, { ledgerPath });

    expect((await run(dangerous)).status).toBe("pending_approval");
    expect((await run(safe)).status).toBe("approved");
  });

  it("is not created by a denial", async () => {
    await writePolicy(PENDING_POLICY);
    const first = await run();
    await deny(first.decisionId, { ledgerPath });

    expect(await getOpenGrants(ledgerPath)).toHaveLength(0);
    expect((await run()).status).toBe("pending_approval");
  });

  /**
   * The budget is the product. A human approving a decision must not be able to
   * spend money that the daily limit already says is gone.
   */
  it("never lifts a denial", async () => {
    await writePolicy(
      "rules:\n  - resource: openai.com\n    verdict: approved\n    maxDailyAmount: 15\n",
    );

    const spend = await run(request({ amount: 10 }));
    expect(spend.status).toBe("approved");

    const overBudget = await run(request({ amount: 10 }));
    expect(overBudget.status).toBe("denied");

    // Approving a denied decision is refused outright, and even if a stale
    // approval existed the verdict would stand.
    await expect(approve(overBudget.decisionId, { ledgerPath })).rejects.toThrow();
    expect((await run(request({ amount: 10 }))).status).toBe("denied");
  });

  it("expires", async () => {
    await writePolicy(`${PENDING_POLICY}grantTtlSeconds: 0\n`);
    const first = await run();
    await approve(first.decisionId, { ledgerPath });

    // A zero-second lifetime means anything approved before now is already past.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect((await run()).status).toBe("pending_approval");
  }, 10_000);
});

describe("grantSignature", () => {
  it("ignores context, which is metadata rather than intent", () => {
    const base = request();
    expect(grantSignature({ ...base, context: { note: "a" } })).toBe(
      grantSignature({ ...base, context: { note: "b" } }),
    );
  });

  it("is stable when fingerprint keys are written in a different order", () => {
    expect(fingerprintOf({ a: 1, b: 2 })).toBe(fingerprintOf({ b: 2, a: 1 }));
  });

  it("separates a missing amount from a zero amount", () => {
    const withoutAmount: AuthorizeRequest = {
      actor: "agent-1",
      action: "api_call",
      resource: "openai.com",
    };

    expect(grantSignature(withoutAmount)).not.toBe(
      grantSignature({ ...withoutAmount, amount: 0 }),
    );
  });
});
