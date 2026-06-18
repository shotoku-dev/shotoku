import { Box, render, Text } from "ink";
import { authorize, type AuthorizeRequest } from "@shotoku/core";

const demoRequest: AuthorizeRequest = {
  actor: "agent-001",
  action: "api_call",
  resource: "api.openai.com",
  rail: "x402",
  amount: 0.02,
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
    <Text>Decision: {decision.status}</Text>
    <Text dimColor>early development</Text>
  </Box>
);

render(<App />);
