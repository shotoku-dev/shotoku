import type { ApprovalEntry, LedgerEntry } from "@shotoku/core";
import type { InlineKeyboard } from "./api.js";

/**
 * What the approval bot says. Pure: a decision in, text and buttons out.
 *
 * The first line follows the CLI's status lines (`◷ PENDING APPROVAL  dec_…`),
 * so a phone notification and a terminal read the same.
 */

type Verdict = ApprovalEntry["verdict"];

const VERB: Record<Verdict, string> = { approved: "approve", denied: "deny" };
const DECISION_ID = /^dec_[a-z0-9]{1,40}$/;

export function encodeCallback(verdict: Verdict, decisionId: string): string {
  return `${VERB[verdict]}:${decisionId}`;
}

/**
 * Reads a button press back. Anything this bot did not produce is refused:
 * the data arrives from Telegram, and only a known verb and a well-formed
 * decision ID ever reach the ledger.
 */
export function parseCallback(
  data: unknown,
): { readonly verdict: Verdict; readonly decisionId: string } | undefined {
  if (typeof data !== "string") return undefined;
  const [verb, decisionId, ...rest] = data.split(":");
  if (rest.length > 0 || decisionId === undefined || !DECISION_ID.test(decisionId)) {
    return undefined;
  }
  if (verb === VERB.approved) return { verdict: "approved", decisionId };
  if (verb === VERB.denied) return { verdict: "denied", decisionId };
  return undefined;
}

/** The lines every message about a decision shares: who, what, how much. */
function decisionLines(entry: LedgerEntry): string[] {
  const { request } = entry;
  const lines = [`${request.actor} → ${request.resource}`];
  if (request.amount !== undefined) {
    const source = request.context?.["amountSource"];
    lines.push(
      typeof source === "string"
        ? `Amount: $${request.amount} · ${source}`
        : `Amount: $${request.amount}`,
    );
  }
  return lines;
}

export function pendingMessage(entry: LedgerEntry): {
  readonly text: string;
  readonly keyboard: InlineKeyboard;
} {
  const text = [
    `◷ PENDING APPROVAL  ${entry.decisionId}`,
    ...decisionLines(entry),
    `• ${entry.response.explanation.summary}`,
  ].join("\n");

  return {
    text,
    keyboard: [
      [
        { text: "✓ Approve", callback_data: encodeCallback("approved", entry.decisionId) },
        { text: "✗ Deny", callback_data: encodeCallback("denied", entry.decisionId) },
      ],
    ],
  };
}

function outcomeLine(entry: LedgerEntry, approval: ApprovalEntry): string {
  return approval.verdict === "approved"
    ? `✓ APPROVED  ${entry.decisionId}`
    : `✗ DENIED  ${entry.decisionId}`;
}

function nextStep(approval: ApprovalEntry): string {
  return approval.verdict === "approved"
    ? "The agent can retry the exact same call once."
    : "The agent's call stays blocked.";
}

/** The pending message, rewritten once the human answered from this chat. */
export function resolvedMessage(entry: LedgerEntry, approval: ApprovalEntry): string {
  return [
    outcomeLine(entry, approval),
    ...decisionLines(entry),
    `Recorded as ${approval.approvalId}. ${nextStep(approval)}`,
  ].join("\n");
}

/** The pending message, rewritten after the decision was answered somewhere else. */
export function resolvedElsewhereMessage(entry: LedgerEntry, approval: ApprovalEntry): string {
  const where = approval.via ? ` (${approval.via})` : " (terminal or TUI)";
  return [
    outcomeLine(entry, approval),
    ...decisionLines(entry),
    `Answered elsewhere${where} as ${approval.approvalId}. ${nextStep(approval)}`,
  ].join("\n");
}
