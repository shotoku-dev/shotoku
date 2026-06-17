export const createDaemonStatus = (ledgerEntries = 0) => ({
    state: "idle",
    ledgerEntries
});
export const evaluatePolicy = () => ({
    allowed: false,
    reason: "Policy engine is not implemented yet."
});
