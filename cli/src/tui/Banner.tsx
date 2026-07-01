import { Box, Text } from "ink";
import { useEffect, useState } from "react";

const MINI_ART = [
  "    _  ,--.",
  "   ;c),. o}`",
  "   `._,=,   `.",
  "       / ,    `.",
  "       `/L`.    )~",
  "            /_/\\_\\",
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false });
}

interface BannerProps {
  readonly decisionCount: number;
  readonly pendingCount: number;
}

export function Banner({ decisionCount, pendingCount }: BannerProps) {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Box flexDirection="column" paddingTop={1} paddingBottom={1} paddingX={4}>
      <Box flexDirection="row" alignItems="flex-start">
        <Box flexDirection="column">
          {MINI_ART.map((line, i) => (
            <Text key={i} color="#DB0028">{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column" paddingTop={2} paddingLeft={4}>
          <Text bold color="white">Shotoku</Text>
          <Text dimColor>the local-first authorization layer for AI agents.</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{time}</Text>
        <Text dimColor>   ·   </Text>
        <Text dimColor>{decisionCount} decision{decisionCount !== 1 ? "s" : ""}</Text>
        <Text dimColor>   ·   </Text>
        {pendingCount > 0
          ? <Text color="yellow">{pendingCount} action{pendingCount !== 1 ? "s" : ""} pending review</Text>
          : <Text color="green">all clear</Text>}
      </Box>
    </Box>
  );
}
