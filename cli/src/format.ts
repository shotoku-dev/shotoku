import type {
  ApprovalEntry,
  AuthorizeResponse,
  AuthorizationStatus,
  LedgerEntry,
} from "@shotoku/core";

const APPROVED = "✓ APPROVED";
const DENIED = "✗ DENIED";
const PENDING = "◷ PENDING APPROVAL";

const STATUS_ICON: Record<AuthorizationStatus, string> = {
  approved: "✓",
  denied: "✗",
  pending_approval: "◷",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { hour12: false });
}

function formatAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function formatHistoryTable(entries: LedgerEntry[]): string {
  if (entries.length === 0) {
    return "No decisions found.";
  }

  const lines: string[] = [];
  for (const entry of entries) {
    const icon = STATUS_ICON[entry.response.status];
    const amount = entry.request.amount !== undefined ? ` $${entry.request.amount}` : "";
    lines.push(
      `${icon}  ${entry.decisionId}  ${entry.request.actor}  ${entry.request.action}  ${entry.request.resource}${amount}  ${formatAge(entry.timestamp)}`,
    );
  }

  const approved = entries.filter((e) => e.response.status === "approved").length;
  const denied = entries.filter((e) => e.response.status === "denied").length;
  const pending = entries.filter((e) => e.response.status === "pending_approval").length;
  lines.push("");
  lines.push(`${entries.length} total · ${approved} approved · ${denied} denied · ${pending} pending`);

  return lines.join("\n");
}

export function formatStatus(
  entries: LedgerEntry[],
  approvals: ApprovalEntry[] = [],
): string {
  const actioned = new Set(approvals.map((a) => a.decisionId));
  const pending = entries.filter(
    (e) =>
      e.response.status === "pending_approval" && !actioned.has(e.decisionId),
  );
  const last = entries.at(-1);
  const lines: string[] = [];

  if (pending.length === 0) {
    lines.push("No pending approvals.");
  } else {
    lines.push(`${pending.length} pending approval${pending.length === 1 ? "" : "s"}:`);
    for (const entry of pending) {
      const amount = entry.request.amount !== undefined ? ` $${entry.request.amount}` : "";
      lines.push(
        `  ◷  ${entry.decisionId}  ${entry.request.actor}  ${entry.request.resource}${amount}  ${formatAge(entry.timestamp)}`,
      );
      if (entry.response.reasons.length > 0) {
        lines.push(`     ${entry.response.reasons[0]!.text}`);
      }
    }
    lines.push(`  → Run: shotoku approve <id>`);
  }

  if (last) {
    lines.push("");
    lines.push(`Last decision: ${STATUS_ICON[last.response.status]} ${last.decisionId}  ${formatDateTime(last.timestamp)}`);
  }

  return lines.join("\n");
}

export function formatApproval(entry: ApprovalEntry): string {
  const verb = entry.verdict === "approved" ? "✓ Approved" : "✗ Denied";
  return `${verb}. Recorded as ${entry.approvalId}.`;
}

export function formatDecision(
  entry: LedgerEntry,
  approval?: ApprovalEntry,
): string {
  const lines: string[] = [];
  const icon = STATUS_ICON[entry.response.status];

  lines.push(`${icon} ${entry.response.status.toUpperCase().replace("_", " ")}  ${entry.decisionId}`);
  lines.push("");
  lines.push(`  Actor:    ${entry.request.actor}`);
  lines.push(`  Action:   ${entry.request.action}`);
  lines.push(`  Resource: ${entry.request.resource}`);
  if (entry.request.amount !== undefined) lines.push(`  Amount:   $${entry.request.amount}`);
  if (entry.request.rail) lines.push(`  Rail:     ${entry.request.rail}`);
  lines.push(`  Time:     ${formatDateTime(entry.timestamp)}`);
  lines.push("");
  lines.push("  Reasons:");
  for (const reason of entry.response.reasons) {
    lines.push(`    • ${reason.text}`);
  }

  if (approval) {
    const resIcon = approval.verdict === "approved" ? "✓" : "✗";
    lines.push("");
    lines.push(
      `  Resolution: ${resIcon} ${approval.verdict} (${approval.approvalId}) at ${formatDateTime(approval.timestamp)}`,
    );
  } else if (entry.response.status === "pending_approval") {
    lines.push("");
    lines.push(`  → Run: shotoku approve ${entry.decisionId}`);
  }

  return lines.join("\n");
}

export function formatResponse(response: AuthorizeResponse): string {
  const { status, decisionId, reasons, timestamp } = response;

  const lines: string[] = [];

  if (status === "approved") {
    lines.push(`${APPROVED}  ${decisionId}`);
    for (const reason of reasons) {
      lines.push(`  • ${reason.text}`);
    }
    lines.push(`  Recorded at ${formatTime(timestamp)}`);
  } else if (status === "denied") {
    lines.push(`${DENIED}  ${decisionId}`);
    for (const reason of reasons) {
      lines.push(`  • ${reason.text}`);
    }
  } else {
    lines.push(`${PENDING}  ${decisionId}`);
    for (const reason of reasons) {
      lines.push(`  • ${reason.text}`);
    }
    lines.push(`  → Run: shotoku approve ${decisionId}`);
  }

  return lines.join("\n");
}

export function formatError(message: string): string {
  return `✗ Error: ${message}`;
}
