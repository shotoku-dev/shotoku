export type ShotokuErrorCode =
  | "config_invalid"
  | "ledger_corrupt"
  | "ledger_lock_timeout"
  | "ledger_read_failed"
  | "ledger_write_failed"
  | "policy_invalid"
  | "policy_not_found"
  | "request_invalid";

export class ShotokuError extends Error {
  readonly code: ShotokuErrorCode;
  readonly userMessage: string;

  constructor(code: ShotokuErrorCode, userMessage: string) {
    super(userMessage);
    this.name = "ShotokuError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function toUserSafeMessage(error: unknown): string {
  if (error instanceof ShotokuError) return error.userMessage;
  if (error instanceof Error && error.message) return error.message;
  return "Unexpected Shotoku error.";
}

export function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const maybeCode = (error as { readonly code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode : undefined;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
