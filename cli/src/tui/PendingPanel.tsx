import { Box, Text, useStdout } from "ink";
import type { LedgerEntry } from "@shotoku/core";

// Rows consumed by Banner (mini art + tagline + status + padding) and Footer.
const CHROME_ROWS = 12;
// Rows per item: 1 content row + 1 marginBottom + 1 separator.
const ROWS_PER_ITEM = 3;
// Rows for the header row + separator.
const HEADER_ROWS = 2;

interface PendingPanelProps {
  readonly entries: LedgerEntry[];
  readonly selectedIndex: number;
  readonly expandedId: string | null;
}

function formatAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

function formatAmount(amount: number | undefined): string {
  if (amount === undefined || amount === 0) return "—";
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

interface PendingItemProps {
  readonly entry: LedgerEntry;
  readonly selected: boolean;
  readonly expanded: boolean;
}

function PendingItem({ entry, selected, expanded }: PendingItemProps) {
  const { request, response, decisionId, timestamp } = entry;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {selected
          ? <Text color="#DB0028">▶  </Text>
          : <Text>   </Text>}
        <Box width={24}>
          {selected
            ? <Text bold color="white">{request.resource}</Text>
            : <Text dimColor>{request.resource}</Text>}
        </Box>
        <Box width={14}>
          <Text dimColor>{request.action}</Text>
        </Box>
        <Box width={8}>
          {request.amount && request.amount > 0
            ? <Text color="white">{formatAmount(request.amount)}</Text>
            : <Text dimColor>{formatAmount(request.amount)}</Text>}
        </Box>
        <Box width={22}>
          <Text dimColor>{request.actor}</Text>
        </Box>
        <Text dimColor>{formatAge(timestamp)}</Text>
      </Box>
      {expanded && (
        <Box flexDirection="column" paddingLeft={3} marginTop={1}>
          <Box>
            <Text dimColor>id      </Text>
            <Text dimColor>{decisionId}</Text>
          </Box>
          {response.reasons.map((r, i) => (
            <Box key={i}>
              <Text dimColor>•  </Text>
              <Text>{r.text}</Text>
            </Box>
          ))}
          {response.explanation.hint && (
            <Box marginTop={1}>
              <Text color="yellow">→  {response.explanation.hint}</Text>
            </Box>
          )}
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
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 40;

  if (entries.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color="green">✓  </Text>
        <Text dimColor>No pending approvals.</Text>
      </Box>
    );
  }

  const SEP = "─".repeat(74);
  const availableRows = terminalRows - CHROME_ROWS - HEADER_ROWS;
  const visibleCount = Math.max(1, Math.floor(availableRows / ROWS_PER_ITEM));
  const needsPagination = entries.length > visibleCount;

  // Only paginate when entries exceed available space.
  let start = 0;
  if (needsPagination) {
    const half = Math.floor(visibleCount / 2);
    start = selectedIndex - half;
    start = Math.max(0, Math.min(start, entries.length - visibleCount));
  }
  const visible = needsPagination ? entries.slice(start, start + visibleCount) : entries;

  const showAbove = needsPagination && start > 0;
  const showBelow = needsPagination && start + visibleCount < entries.length;

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{"   "}</Text>
        <Box width={24}><Text dimColor>resource</Text></Box>
        <Box width={14}><Text dimColor>action</Text></Box>
        <Box width={8}><Text dimColor>amount</Text></Box>
        <Box width={22}><Text dimColor>actor</Text></Box>
        <Text dimColor>age</Text>
      </Box>
      <Text dimColor>{SEP}</Text>
      {showAbove && (
        <Text dimColor>  ↑ {start} more above</Text>
      )}
      {visible.map((entry, vi) => {
        const globalIndex = start + vi;
        return (
          <Box key={entry.decisionId} flexDirection="column">
            <PendingItem
              entry={entry}
              selected={globalIndex === selectedIndex}
              expanded={entry.decisionId === expandedId}
            />
            <Text dimColor>{SEP}</Text>
          </Box>
        );
      })}
      {showBelow && (
        <Text dimColor>  ↓ {entries.length - (start + visibleCount)} more below</Text>
      )}
    </Box>
  );
}
