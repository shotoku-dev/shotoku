import { Box, Text } from "ink";
import type { LedgerEntry } from "@shotoku/core";

interface PendingPanelProps {
  readonly entries: LedgerEntry[];
  readonly selectedIndex: number;
  readonly expandedId: string | null;
}

function formatAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

interface PendingItemProps {
  readonly entry: LedgerEntry;
  readonly selected: boolean;
  readonly expanded: boolean;
}

function PendingItem({ entry, selected, expanded }: PendingItemProps) {
  const { request, response, decisionId, timestamp } = entry;
  const amount = request.amount !== undefined ? ` · $${request.amount}` : "";
  const selector = selected ? "▶ " : "  ";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {selected ? <Text color="yellow">{selector}</Text> : <Text>{selector}</Text>}
        <Text color="yellow">◷ </Text>
        {selected ? <Text bold>{decisionId}</Text> : <Text>{decisionId}</Text>}
      </Box>
      <Box paddingLeft={4}>
        <Text dimColor>
          {request.actor} · {request.action} · {request.resource}
          {amount} · {formatAge(timestamp)}
        </Text>
      </Box>
      {expanded &&
        response.reasons.map((r, i) => (
          <Box key={i} paddingLeft={4}>
            <Text dimColor>• </Text>
            <Text>{r.text}</Text>
          </Box>
        ))}
      {expanded && response.explanation.summary && (
        <Box paddingLeft={4}>
          <Text dimColor>{response.explanation.summary}</Text>
        </Box>
      )}
      {expanded && response.explanation.hint && (
        <Box paddingLeft={4}>
          <Text color="yellow">→ {response.explanation.hint}</Text>
        </Box>
      )}
    </Box>
  );
}

export function PendingPanel({
  entries,
  selectedIndex,
  expandedId,
}: PendingPanelProps) {
  if (entries.length === 0) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text dimColor>No pending approvals.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      <Box paddingLeft={2} marginBottom={1}>
        <Text bold>PENDING APPROVALS</Text>
        <Text dimColor>  ({entries.length})</Text>
      </Box>
      {entries.map((entry, i) => (
        <PendingItem
          key={entry.decisionId}
          entry={entry}
          selected={i === selectedIndex}
          expanded={entry.decisionId === expandedId}
        />
      ))}
    </Box>
  );
}
