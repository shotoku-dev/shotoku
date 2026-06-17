export type ExecutionRail = "x402" | "mcp" | "api" | "code" | "custom";
export interface AgentActionRequest {
    readonly id: string;
    readonly rail: ExecutionRail;
    readonly action: string;
}
export interface AuthorizationDecision {
    readonly allowed: boolean;
    readonly reason: string;
}
export type ApprovalStatus = "pending" | "approved" | "denied";
export interface LedgerEntry {
    readonly requestId: string;
    readonly status: ApprovalStatus;
    readonly timestamp: string;
}
export declare const authorize: (_request: AgentActionRequest) => AuthorizationDecision;
