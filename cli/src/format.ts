import type { AuthorizeResponse } from "@shotoku/core";

const APPROVED = "✓ APPROVED";
const DENIED = "✗ DENIED";
const PENDING = "◷ PENDING APPROVAL";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
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
    lines.push(`  → Run: shotoku approve ${decisionId}`);
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
