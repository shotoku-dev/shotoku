import type {
  AgentAction,
  AuthorizationStatus,
  AuthorizeRequest,
  ExecutionRail,
  Policy,
  PolicyRule,
  ReasonItem,
} from "./types.js";
import { ShotokuError } from "./errors.js";

const VALID_ACTIONS = [
  "purchase",
  "api_call",
  "execute_code",
  "send_email",
  "mcp_tool",
  "custom",
] as const satisfies readonly AgentAction[];

const VALID_RAILS = [
  "x402",
  "mcp",
  "api",
  "code",
  "custom",
] as const satisfies readonly ExecutionRail[];

const VALID_STATUSES = [
  "approved",
  "denied",
  "pending_approval",
] as const satisfies readonly AuthorizationStatus[];

const POLICY_KEYS = new Set([
  "rules",
  "defaultVerdict",
]);

const RULE_KEYS = new Set([
  "resource",
  "actions",
  "rails",
  "verdict",
  "maxAmount",
  "maxDailyAmount",
]);

const MAX_ID_LENGTH = 256;
const MAX_RESOURCE_LENGTH = 512;
const MAX_CONTEXT_BYTES = 16_384;

export function isAgentAction(value: unknown): value is AgentAction {
  return (
    typeof value === "string" &&
    VALID_ACTIONS.includes(value as AgentAction)
  );
}

export function isExecutionRail(value: unknown): value is ExecutionRail {
  return typeof value === "string" && VALID_RAILS.includes(value as ExecutionRail);
}

export function isAuthorizationStatus(
  value: unknown,
): value is AuthorizationStatus {
  return (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as AuthorizationStatus)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKnownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): string | undefined {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return `${label} contains unknown field "${key}"`;
  }
  return undefined;
}

function validateNonNegativeNumber(
  value: unknown,
  label: string,
): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${label} must be a finite number`;
  }
  if (value < 0) return `${label} must be non-negative`;
  return undefined;
}

function validateJsonValue(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): string | undefined {
  if (value === null) return undefined;

  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return undefined;
  if (kind === "number") {
    return Number.isFinite(value) ? undefined : `${path} must be a finite number`;
  }
  if (
    kind === "undefined" ||
    kind === "function" ||
    kind === "symbol" ||
    kind === "bigint"
  ) {
    return `${path} must be JSON-serializable`;
  }

  if (typeof value !== "object") return undefined;
  if (seen.has(value)) return `${path} must not contain circular references`;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const error = validateJsonValue(value[i], `${path}[${i}]`, seen);
      if (error) return error;
    }
    return undefined;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return `${path} must contain only plain objects, arrays, and primitives`;
  }

  for (const [key, child] of Object.entries(value)) {
    const error = validateJsonValue(child, `${path}.${key}`, seen);
    if (error) return error;
  }

  return undefined;
}

function validateContext(context: Record<string, unknown>): string | undefined {
  const structuralError = validateJsonValue(context, "context", new WeakSet());
  if (structuralError) return structuralError;

  const encoded = JSON.stringify(context);
  if (encoded.length > MAX_CONTEXT_BYTES) {
    return `context must be ${MAX_CONTEXT_BYTES} bytes or smaller`;
  }

  return undefined;
}

export function validateAuthorizeRequest(
  request: AuthorizeRequest,
): readonly ReasonItem[] {
  const reasons: ReasonItem[] = [];

  if (typeof request.actor !== "string" || !request.actor.trim()) {
    reasons.push({ type: "blocked", text: "actor is required" });
  } else if (request.actor.length > MAX_ID_LENGTH) {
    reasons.push({
      type: "blocked",
      text: `actor must be ${MAX_ID_LENGTH} characters or shorter`,
    });
  }

  if (!isAgentAction(request.action)) {
    reasons.push({
      type: "blocked",
      text: `action must be one of ${VALID_ACTIONS.join(", ")}`,
    });
  }

  if (typeof request.resource !== "string" || !request.resource.trim()) {
    reasons.push({ type: "blocked", text: "resource is required" });
  } else if (request.resource.length > MAX_RESOURCE_LENGTH) {
    reasons.push({
      type: "blocked",
      text: `resource must be ${MAX_RESOURCE_LENGTH} characters or shorter`,
    });
  }

  if (request.rail !== undefined && !isExecutionRail(request.rail)) {
    reasons.push({
      type: "blocked",
      text: `rail must be one of ${VALID_RAILS.join(", ")}`,
    });
  }

  if (request.amount !== undefined) {
    const amountError = validateNonNegativeNumber(request.amount, "amount");
    if (amountError) reasons.push({ type: "blocked", text: amountError });
  }

  if (request.context !== undefined) {
    const contextError = validateContext(request.context);
    if (contextError) reasons.push({ type: "blocked", text: contextError });
  }

  return reasons;
}

function validateStringArray<T extends string>(
  value: unknown,
  label: string,
  isValid: (item: unknown) => item is T,
): readonly T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ShotokuError("policy_invalid", `${label} must be a non-empty list`);
  }

  const parsed: T[] = [];
  for (const item of value) {
    if (!isValid(item)) {
      throw new ShotokuError("policy_invalid", `${label} contains invalid value`);
    }
    parsed.push(item);
  }

  return parsed;
}

function validateRule(value: unknown, index: number): PolicyRule {
  if (!isRecord(value)) {
    throw new ShotokuError("policy_invalid", `rules[${index}] must be an object`);
  }

  const unknownKeyError = hasOnlyKnownKeys(value, RULE_KEYS, `rules[${index}]`);
  if (unknownKeyError) throw new ShotokuError("policy_invalid", unknownKeyError);

  if (typeof value["resource"] !== "string" || !value["resource"].trim()) {
    throw new ShotokuError(
      "policy_invalid",
      `rules[${index}].resource must be a non-empty string`,
    );
  }

  if (!isAuthorizationStatus(value["verdict"])) {
    throw new ShotokuError(
      "policy_invalid",
      `rules[${index}].verdict must be approved, denied, or pending_approval`,
    );
  }

  const rule: PolicyRule = {
    resource: value["resource"],
    verdict: value["verdict"],
  };

  if (value["actions"] !== undefined) {
    Object.assign(rule, {
      actions: validateStringArray(
        value["actions"],
        `rules[${index}].actions`,
        isAgentAction,
      ),
    });
  }

  if (value["rails"] !== undefined) {
    Object.assign(rule, {
      rails: validateStringArray(
        value["rails"],
        `rules[${index}].rails`,
        isExecutionRail,
      ),
    });
  }

  if (value["maxAmount"] !== undefined) {
    const error = validateNonNegativeNumber(
      value["maxAmount"],
      `rules[${index}].maxAmount`,
    );
    if (error) throw new ShotokuError("policy_invalid", error);
    Object.assign(rule, { maxAmount: value["maxAmount"] });
  }

  if (value["maxDailyAmount"] !== undefined) {
    const error = validateNonNegativeNumber(
      value["maxDailyAmount"],
      `rules[${index}].maxDailyAmount`,
    );
    if (error) throw new ShotokuError("policy_invalid", error);
    Object.assign(rule, { maxDailyAmount: value["maxDailyAmount"] });
  }

  return rule;
}

export function validatePolicy(value: unknown): Policy {
  if (!isRecord(value)) {
    throw new ShotokuError("policy_invalid", "Policy file must contain an object");
  }

  const unknownKeyError = hasOnlyKnownKeys(value, POLICY_KEYS, "Policy file");
  if (unknownKeyError) throw new ShotokuError("policy_invalid", unknownKeyError);

  if (!Array.isArray(value["rules"])) {
    throw new ShotokuError("policy_invalid", "Policy file must contain rules");
  }

  const policy: Policy = {
    rules: value["rules"].map((rule, index) => validateRule(rule, index)),
  };

  if (value["defaultVerdict"] !== undefined) {
    if (!isAuthorizationStatus(value["defaultVerdict"])) {
      throw new ShotokuError(
        "policy_invalid",
        "defaultVerdict must be approved, denied, or pending_approval",
      );
    }
    return { ...policy, defaultVerdict: value["defaultVerdict"] };
  }

  return policy;
}

export function validActions(): readonly AgentAction[] {
  return VALID_ACTIONS;
}

export function validStatuses(): readonly AuthorizationStatus[] {
  return VALID_STATUSES;
}
