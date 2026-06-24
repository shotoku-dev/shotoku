import { randomBytes } from "node:crypto";
import type { ApprovalEntry } from "./types.js";
import {
  appendApproval,
  getApprovalForDecision,
  getDecisionById,
  withLedgerLock,
} from "./ledger.js";

function approvalId(): string {
  return `apr_${randomBytes(6).toString("hex")}`;
}

export interface ApproveOptions {
  readonly ledgerPath: string;
}

async function resolve(
  decisionId: string,
  verdict: "approved" | "denied",
  options: ApproveOptions,
): Promise<ApprovalEntry> {
  return withLedgerLock(options.ledgerPath, async () => {
    const decision = await getDecisionById(options.ledgerPath, decisionId);
    if (!decision) {
      throw new Error(`Decision "${decisionId}" not found.`);
    }

    if (decision.response.status !== "pending_approval") {
      throw new Error(
        `Decision "${decisionId}" is not pending approval (status: ${decision.response.status}).`,
      );
    }

    const existing = await getApprovalForDecision(options.ledgerPath, decisionId);
    if (existing) {
      throw new Error(
        `Decision "${decisionId}" was already ${existing.verdict} as ${existing.approvalId}.`,
      );
    }

    const entry: ApprovalEntry = {
      kind: "approval",
      approvalId: approvalId(),
      decisionId,
      verdict,
      timestamp: new Date().toISOString(),
    };

    await appendApproval(entry, options.ledgerPath);
    return entry;
  });
}

export function approve(
  decisionId: string,
  options: ApproveOptions,
): Promise<ApprovalEntry> {
  return resolve(decisionId, "approved", options);
}

export function deny(
  decisionId: string,
  options: ApproveOptions,
): Promise<ApprovalEntry> {
  return resolve(decisionId, "denied", options);
}
