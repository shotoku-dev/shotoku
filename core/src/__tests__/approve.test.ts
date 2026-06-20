import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendDecision,
  readDecisions,
  readApprovals,
  getPendingApprovals,
} from "../ledger.js";
import { approve, deny } from "../approve.js";
import type { AuthorizationStatus, LedgerEntry } from "../types.js";

function decisionEntry(
  decisionId: string,
  status: AuthorizationStatus,
): LedgerEntry {
  const timestamp = new Date().toISOString();
  return {
    decisionId,
    timestamp,
    request: {
      actor: "agent-1",
      action: "purchase",
      resource: "vendor-xyz.com",
      amount: 30,
    },
    response: {
      approved: status === "approved",
      status,
      reasons: [{ type: "escalated", text: "vendor-xyz.com is not on the allowlist" }],
      explanation: {
        summary: "vendor-xyz.com is not on the allowlist",
        ...(status === "pending_approval" ? { hint: `shotoku approve ${decisionId}` } : {}),
      },
      decisionId,
      timestamp,
    },
  };
}

let ledgerPath: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "shotoku-test-"));
  ledgerPath = join(dir, "decisions.jsonl");
});

describe("approve", () => {
  it("records an approval for a pending decision", async () => {
    await appendDecision(decisionEntry("dec_pending", "pending_approval"), ledgerPath);

    const approval = await approve("dec_pending", { ledgerPath });

    expect(approval.kind).toBe("approval");
    expect(approval.verdict).toBe("approved");
    expect(approval.decisionId).toBe("dec_pending");
    expect(approval.approvalId).toMatch(/^apr_/);
  });

  it("appends a new ledger entry without mutating the original decision", async () => {
    await appendDecision(decisionEntry("dec_pending", "pending_approval"), ledgerPath);

    await approve("dec_pending", { ledgerPath });

    const decisions = await readDecisions(ledgerPath);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.response.status).toBe("pending_approval");

    const approvals = await readApprovals(ledgerPath);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]!.decisionId).toBe("dec_pending");
  });

  it("throws when the decision does not exist", async () => {
    await expect(approve("dec_missing", { ledgerPath })).rejects.toThrow(
      /not found/,
    );
  });

  it("throws when the decision was already actioned", async () => {
    await appendDecision(decisionEntry("dec_pending", "pending_approval"), ledgerPath);
    await approve("dec_pending", { ledgerPath });

    await expect(approve("dec_pending", { ledgerPath })).rejects.toThrow(
      /already/,
    );
  });

  it("throws when the decision is not pending", async () => {
    await appendDecision(decisionEntry("dec_approved", "approved"), ledgerPath);

    await expect(approve("dec_approved", { ledgerPath })).rejects.toThrow(
      /not pending approval/,
    );
  });
});

describe("deny", () => {
  it("records a denial for a pending decision", async () => {
    await appendDecision(decisionEntry("dec_pending", "pending_approval"), ledgerPath);

    const approval = await deny("dec_pending", { ledgerPath });

    expect(approval.verdict).toBe("denied");
  });

  it("cannot deny an already-actioned decision", async () => {
    await appendDecision(decisionEntry("dec_pending", "pending_approval"), ledgerPath);
    await approve("dec_pending", { ledgerPath });

    await expect(deny("dec_pending", { ledgerPath })).rejects.toThrow(/already/);
  });
});

describe("getPendingApprovals", () => {
  it("excludes decisions that have been actioned", async () => {
    await appendDecision(decisionEntry("dec_a", "pending_approval"), ledgerPath);
    await appendDecision(decisionEntry("dec_b", "pending_approval"), ledgerPath);

    await approve("dec_a", { ledgerPath });

    const pending = await getPendingApprovals(ledgerPath);
    expect(pending.map((d) => d.decisionId)).toEqual(["dec_b"]);
  });
});
