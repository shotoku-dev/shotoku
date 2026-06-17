import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, render, Text } from "ink";
import { authorize } from "@shotoku/core";
const demoRequest = {
    id: "demo-001",
    rail: "x402",
    action: "Call paid API endpoint"
};
const decision = authorize(demoRequest);
const App = () => (_jsxs(Box, { flexDirection: "column", paddingX: 1, paddingY: 1, children: [_jsx(Text, { bold: true, children: "Shotoku" }), _jsx(Text, { children: "Authorization layer for AI agents" }), _jsx(Text, { children: "Mode: Local" }), _jsx(Text, { children: "Rail: x402 (demo)" }), _jsx(Text, { children: "Custody: Never" }), _jsx(Text, { children: "Ledger: Local" }), _jsxs(Text, { children: ["Decision: ", decision.reason] }), _jsx(Text, { dimColor: true, children: "Week 1 of 4" })] }));
render(_jsx(App, {}));
