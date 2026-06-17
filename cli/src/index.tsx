import { Box, render, Text } from "ink";
import { authorize, type AgentActionRequest } from "@shotoku/core";

const demoRequest: AgentActionRequest = {
  id: "demo-001",
  rail: "x402",
  action: "Call paid API endpoint"
};

const decision = authorize(demoRequest);

const App = () => (
  <Box flexDirection="column" paddingX={1} paddingY={1}>
    <Text bold>Shotoku</Text>
    <Text>Authorization layer for AI agents</Text>
    <Text>Mode: Local</Text>
    <Text>Rail: x402 (demo)</Text>
    <Text>Custody: Never</Text>
    <Text>Ledger: Local</Text>
    <Text>Decision: {decision.reason}</Text>
    <Text dimColor>Week 1 of 4</Text>
  </Box>
);

render(<App />);