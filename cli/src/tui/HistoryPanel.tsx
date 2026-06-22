import { Box, Text } from "ink";
import type { ApprovalEntry, AuthorizationStatus, LedgerEntry } from "@shotoku/core";

interface HistoryPanelProps {
  readonly entries: LedgerEntry[];
  readonly approvals: ApprovalEntry[];
}

const STATUS_ICON: Record<AuthorizationStatus, string> = {
  approved: "✓",
  denied: "✗",
  pending_approval: "◷",
};

const STATUS_COLOR: Record<AuthorizationStatus, string> = {
  approved: "green",
  denied: "red",
  pending_approval: "yellow",
};

function formatAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function HistoryPanel({ entries, approvals }: HistoryPanelProps) {
  const approvalMap = new Map(approvals.map((a) => [a.decisionId, a]));
  const recent = [...entries].reverse().slice(0, 10);

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1} borderStyle="single">
      <Box paddingLeft={2} marginBottom={1}>
        <Text bold>RECENT DECISIONS</Text>
      </Box>
      {recent.length === 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>No decisions yet.</Text>
        </Box>
      )}
      {recent.map((entry) => {
        const { request, response, decisionId, timestamp } = entry;
        const status = response.status;
        const icon = STATUS_ICON[status];
        const color = STATUS_COLOR[status];
        const amount = request.amount !== undefined ? ` $${request.amount}` : "";
        const resolution = approvalMap.get(decisionId);
        const resTag = resolution
          ? `  [${resolution.verdict === "approved" ? "✓" : "✗"} ${resolution.verdict}]`
          : "";

        return (
          <Box key={decisionId} paddingLeft={2} marginBottom={0}>
            <Text color={color}>{icon} </Text>
            <Text dimColor>{decisionId}  </Text>
            <Text dimColor>
              {request.actor} · {request.resource}
              {amount} · {formatAge(timestamp)}
              {resTag}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
