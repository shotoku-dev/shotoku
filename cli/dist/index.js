import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, render, Text } from "ink";
import { createDaemonStatus, evaluatePolicy } from "@shotoku/core";
const App = ({ status, policyReason }) => (_jsxs(Box, { flexDirection: "column", paddingX: 1, paddingY: 1, children: [_jsx(Text, { bold: true, children: "Shotoku" }), _jsxs(Text, { children: ["Core status: ", status] }), _jsxs(Text, { children: ["Policy: ", policyReason] }), _jsx(Text, { dimColor: true, children: "Week 1 of 4 \u00B7 no custody ever" })] }));
const daemon = createDaemonStatus();
const policy = evaluatePolicy();
render(_jsx(App, { status: daemon.state, policyReason: policy.reason }));
