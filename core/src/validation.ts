import type {
  AgentAction,
  AuthorizationStatus,
  AuthorizeRequest,
  BudgetScope,
  ExecutionRail,
  Policy,
  PolicyBudget,
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

const VALID_BUDGET_SCOPES = [
  "per_actor",
  "shared",
] as const satisfies readonly BudgetScope[];

/**
 * The accepted keys are derived from the types themselves, so adding a field to
 * `Policy` or `PolicyRule` without teaching the validator about it is a compile
 * error rather than a silent runtime rejection. `PolicyRule.actor` was missing
 * here once, which made every policy file using it fail to load.
 */
const POLICY_FIELDS = {
  rules: true,
  budgets: true,
  defaultVerdict: true,
  grantTtlSeconds: true,
} as const satisfies Record<keyof Policy, true>;

const RULE_FIELDS = {
  resource: true,
  actor: true,
  actions: true,
  rails: true,
  recipients: true,
  verdict: true,
  maxAmount: true,
  maxDailyAmount: true,
} as const satisfies Record<keyof PolicyRule, true>;

const BUDGET_FIELDS = {
  actor: true,
  maxDailyAmount: true,
  scope: true,
} as const satisfies Record<keyof PolicyBudget, true>;

const POLICY_KEYS: ReadonlySet<string> = new Set(Object.keys(POLICY_FIELDS));
const RULE_KEYS: ReadonlySet<string> = new Set(Object.keys(RULE_FIELDS));
const BUDGET_KEYS: ReadonlySet<string> = new Set(Object.keys(BUDGET_FIELDS));

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

  if (request.recipient !== undefined) {
    if (typeof request.recipient !== "string" || !request.recipient.trim()) {
      reasons.push({ type: "blocked", text: "recipient must be a non-empty string" });
    } else if (request.recipient.length > MAX_ID_LENGTH) {
      reasons.push({
        type: "blocked",
        text: `recipient must be ${MAX_ID_LENGTH} characters or shorter`,
      });
    }
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

  if (value["actor"] !== undefined) {
    // A pattern, not an identifier: "team-*" is a valid pattern and an invalid
    // actor name. Matching happens in policy.ts via patternMatches.
    const actor = value["actor"];
    if (typeof actor !== "string" || !actor.trim()) {
      throw new ShotokuError(
        "policy_invalid",
        `rules[${index}].actor must be a non-empty string`,
      );
    }
    if (actor.length > MAX_ID_LENGTH) {
      throw new ShotokuError(
        "policy_invalid",
        `rules[${index}].actor must be at most ${MAX_ID_LENGTH} characters`,
      );
    }
    Object.assign(rule, { actor });
  }

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

  if (value["recipients"] !== undefined) {
    const recipients = value["recipients"];
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new ShotokuError(
        "policy_invalid",
        `rules[${index}].recipients must be a non-empty list`,
      );
    }
    for (const recipient of recipients) {
      if (
        typeof recipient !== "string" ||
        !recipient.trim() ||
        recipient.length > MAX_ID_LENGTH
      ) {
        throw new ShotokuError(
          "policy_invalid",
          `rules[${index}].recipients contains invalid value`,
        );
      }
    }
    Object.assign(rule, { recipients: [...recipients] });
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

function validateBudget(value: unknown, index: number): PolicyBudget {
  const label = `budgets[${index}]`;
  if (!isRecord(value)) {
    throw new ShotokuError("policy_invalid", `${label} must be an object`);
  }

  const unknownKeyError = hasOnlyKnownKeys(value, BUDGET_KEYS, label);
  if (unknownKeyError) throw new ShotokuError("policy_invalid", unknownKeyError);

  const actor = value["actor"];
  if (typeof actor !== "string" || !actor.trim() || actor.length > MAX_ID_LENGTH) {
    throw new ShotokuError(
      "policy_invalid",
      `${label}.actor must be a non-empty string of at most ${MAX_ID_LENGTH} characters`,
    );
  }

  // Required, unlike a rule's: a budget with no ceiling is a typo, not a policy.
  const limitError = validateNonNegativeNumber(
    value["maxDailyAmount"],
    `${label}.maxDailyAmount`,
  );
  if (limitError) throw new ShotokuError("policy_invalid", limitError);

  const budget: PolicyBudget = {
    actor,
    maxDailyAmount: value["maxDailyAmount"] as number,
  };

  if (value["scope"] !== undefined) {
    const scope = value["scope"];
    if (!VALID_BUDGET_SCOPES.includes(scope as BudgetScope)) {
      throw new ShotokuError(
        "policy_invalid",
        `${label}.scope must be ${VALID_BUDGET_SCOPES.join(" or ")}`,
      );
    }
    Object.assign(budget, { scope });
  }

  return budget;
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

  if (value["budgets"] !== undefined) {
    if (!Array.isArray(value["budgets"])) {
      throw new ShotokuError("policy_invalid", "budgets must be a list");
    }
    Object.assign(policy, {
      budgets: value["budgets"].map((budget, index) => validateBudget(budget, index)),
    });
  }


  if (value["grantTtlSeconds"] !== undefined) {
    const error = validateNonNegativeNumber(
      value["grantTtlSeconds"],
      "grantTtlSeconds",
    );
    if (error) throw new ShotokuError("policy_invalid", error);
    Object.assign(policy, { grantTtlSeconds: value["grantTtlSeconds"] });
  }

  if (value["defaultVerdict"] !== undefined) {
    if (!isAuthorizationStatus(value["defaultVerdict"])) {
      throw new ShotokuError(
        "policy_invalid",
        "defaultVerdict must be approved, denied, or pending_approval",
      );
    }
    Object.assign(policy, { defaultVerdict: value["defaultVerdict"] });
  }

  return policy;
}

export function validActions(): readonly AgentAction[] {
  return VALID_ACTIONS;
}

export function validStatuses(): readonly AuthorizationStatus[] {
  return VALID_STATUSES;
}
