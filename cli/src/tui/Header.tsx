import { Box, Text } from "ink";
import { useEffect, useState } from "react";

interface HeaderProps {
  readonly decisionCount: number;
  readonly pendingCount: number;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function Header({ decisionCount, pendingCount }: HeaderProps) {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Box borderStyle="single" paddingX={1}>
      <Text bold>Shotoku</Text>
      <Text dimColor>  │  </Text>
      <Text dimColor>{time}</Text>
      <Text dimColor>  │  </Text>
      <Text dimColor>{decisionCount} decisions</Text>
      <Text dimColor>  │  </Text>
      {pendingCount > 0 ? (
        <Text color="yellow">{pendingCount} pending</Text>
      ) : (
        <Text dimColor>0 pending</Text>
      )}
    </Box>
  );
}
