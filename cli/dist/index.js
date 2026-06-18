import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, render, Text } from "ink";
import { authorize } from "@shotoku/core";
const demoRequest = {
    actor: "agent-001",
    action: "api_call",
    resource: "api.openai.com",
    rail: "x402",
    amount: 0.02,
};
const decision = authorize(demoRequest);
const App = () => (_jsxs(Box, { flexDirection: "column", paddingX: 1, paddingY: 1, children: [_jsx(Text, { bold: true, children: "Shotoku" }), _jsx(Text, { children: "Authorization layer for AI agents" }), _jsx(Text, { children: "Mode: Local" }), _jsx(Text, { children: "Rail: x402 (demo)" }), _jsx(Text, { children: "Custody: Never" }), _jsx(Text, { children: "Ledger: Local" }), _jsxs(Text, { children: ["Decision: ", decision.status] }), _jsx(Text, { dimColor: true, children: "early development" })] }));
render(_jsx(App, {}));
