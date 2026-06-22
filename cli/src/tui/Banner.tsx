import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { MaskArt } from "./MaskArt.js";

const ART = [
  "███████╗██╗  ██╗ ██████╗ ████████╗ ██████╗ ██╗  ██╗██╗   ██╗",
  "██╔════╝██║  ██║██╔═══██╗╚══██╔══╝██╔═══██╗██║ ██╔╝██║   ██║",
  "███████╗███████║██║   ██║   ██║   ██║   ██║█████╔╝ ██║   ██║",
  "╚════██║██╔══██║██║   ██║   ██║   ██║   ██║██╔═██╗ ██║   ██║",
  "███████║██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║  ██╗╚██████╔╝",
  "╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ",
];

const REDS = [
  "#FF4455",
  "#F02035",
  "#DB0028",
  "#B80022",
  "#96001C",
  "#730014",
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
    <Box flexDirection="column" alignItems="center" paddingTop={1} paddingBottom={1}>
      {ART.map((line, i) => {
        const shade = REDS[i] ?? "#DB0028";
        return <Text key={i} color={shade} wrap="truncate-end">{line}</Text>;
      })}
      <Box marginTop={1}>
        <Text color="white">Local-first authorization layer for AI agents.</Text>
      </Box>
      <Box marginTop={1}>
        <MaskArt />
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
