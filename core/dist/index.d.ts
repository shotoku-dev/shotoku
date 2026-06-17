export type DaemonState = "idle" | "running" | "stopped";
export interface DaemonStatus {
    readonly state: DaemonState;
    readonly ledgerEntries: number;
}
export interface PolicyDecision {
    readonly allowed: boolean;
    readonly reason: string;
}
export declare const createDaemonStatus: (ledgerEntries?: number) => DaemonStatus;
export declare const evaluatePolicy: () => PolicyDecision;
