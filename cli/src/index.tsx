import { Box, render, Text } from "ink";
import { createDaemonStatus, evaluatePolicy } from "@shotoku/core";

interface AppProps {
  readonly status: string;
  readonly policyReason: string;
}

const App = ({ status, policyReason }: AppProps) => (
  <Box flexDirection="column" paddingX={1} paddingY={1}>
    <Text bold>Shotoku</Text>
    <Text>Core status: {status}</Text>
    <Text>Policy: {policyReason}</Text>
    <Text dimColor>Week 1 of 4 · no custody ever</Text>
  </Box>
);

const daemon = createDaemonStatus();
const policy = evaluatePolicy();

render(<App status={daemon.state} policyReason={policy.reason} />);