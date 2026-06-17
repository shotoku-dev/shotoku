export type DaemonState = "idle" | "running" | "stopped";

export interface DaemonStatus {
  readonly state: DaemonState;
  readonly ledgerEntries: number;
}

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export const createDaemonStatus = (
  ledgerEntries = 0
): DaemonStatus => ({
  state: "idle",
  ledgerEntries
});

export const evaluatePolicy = (): PolicyDecision => ({
  allowed: false,
  reason: "Policy engine is not implemented yet."
});