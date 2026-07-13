import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { AuthorizeRequest, AuthorizeResponse, Policy } from "./types.js";
import { evaluatePolicy } from "./policy.js";
import { appendDecision, getLedgerSnapshot, withLedgerLock } from "./ledger.js";
import { buildExplanation } from "./explain.js";
import { createReceipt } from "./receipt.js";
import { ShotokuError, errorCode, errorMessage } from "./errors.js";
import {
  isAgentAction,
  isExecutionRail,
  validateAuthorizeRequest,
  validatePolicy,
} from "./validation.js";

function decisionId(): string {
  return `dec_${randomBytes(6).toString("hex")}`;
}

interface PolicyLoadResult {
  readonly policy?: Policy;
  readonly reason?: string;
}

function deniedResponse(
  id: string,
  timestamp: string,
  reasonText: string,
): AuthorizeResponse {
  const reasons = [{ type: "blocked" as const, text: reasonText }];
  return {
    approved: false,
    status: "denied",
    reasons,
    explanation: buildExplanation("denied", reasons, id),
    decisionId: id,
    timestamp,
  };
}

function safeRequestForLedger(
  request: AuthorizeRequest,
  contextRejected: boolean,
): AuthorizeRequest {
  const safe: AuthorizeRequest = {
    actor: typeof request.actor === "string" ? request.actor : "<invalid actor>",
    action: isAgentAction(request.action) ? request.action : "custom",
    resource:
      typeof request.resource === "string"
        ? request.resource
        : "<invalid resource>",
    ...(isExecutionRail(request.rail) ? { rail: request.rail } : {}),
    ...(typeof request.amount === "number" && Number.isFinite(request.amount)
      ? { amount: request.amount }
      : {}),
  };

  if (contextRejected) {
    return {
      ...safe,
      context: {
        shotokuNote: "Original context was rejected by request validation.",
      },
    };
  }

  if (request.context !== undefined) {
    try {
      JSON.stringify(request.context);
      return { ...safe, context: request.context };
    } catch {
      return {
        ...safe,
        context: {
          shotokuNote: "Original context was not JSON-serializable.",
        },
      };
    }
  }

  return safe;
}

async function loadPolicy(policyPath: string): Promise<PolicyLoadResult> {
  try {
    const raw = await readFile(policyPath, "utf8");
    return { policy: validatePolicy(parse(raw)) };
  } catch (error) {
    if (error instanceof ShotokuError) {
      return { reason: error.userMessage };
    }

    if (errorCode(error) === "ENOENT") {
      return { reason: `Policy file not found at ${policyPath}` };
    }

    return {
      reason: `Policy file could not be loaded: ${errorMessage(error)}`,
    };
  }
}

export async function authorize(
  request: AuthorizeRequest,
  options: {
    readonly policyPath: string;
    readonly ledgerPath: string;

    /** When set, approved decisions carry a signed receipt (see receipt.ts). */
    readonly receiptSecret?: string;

    /** Receipt lifetime in seconds. Defaults to 300. */
    readonly receiptTtlSeconds?: number;
  },
): Promise<AuthorizeResponse> {
  const id = decisionId();
  const timestamp = new Date().toISOString();

  const invalidReasons = validateAuthorizeRequest(request);
  const requestForLedger = safeRequestForLedger(
    request,
    invalidReasons.some((reason) => reason.text.startsWith("context")),
  );
  if (invalidReasons.length > 0) {
    const response: AuthorizeResponse = {
      approved: false,
      status: "denied",
      reasons: invalidReasons,
      explanation: buildExplanation("denied", invalidReasons, id),
      decisionId: id,
      timestamp,
    };
    await appendDecision(
      { decisionId: id, timestamp, request: requestForLedger, response },
      options.ledgerPath,
    );
    return response;
  }

  const policy = await loadPolicy(options.policyPath);

  const loadedPolicy = policy.policy;

  if (!loadedPolicy) {
    const response = deniedResponse(
      id,
      timestamp,
      policy.reason ?? "Policy file could not be loaded",
    );
    await appendDecision(
      { decisionId: id, timestamp, request: requestForLedger, response },
      options.ledgerPath,
    );
    return response;
  }

  return withLedgerLock(options.ledgerPath, async () => {
    const snapshot = await getLedgerSnapshot(options.ledgerPath);
    const result = evaluatePolicy(request, loadedPolicy, snapshot);

    const receipt =
      result.status === "approved" && options.receiptSecret !== undefined
        ? createReceipt({
            decisionId: id,
            actor: requestForLedger.actor,
            action: requestForLedger.action,
            resource: requestForLedger.resource,
            ...(requestForLedger.amount !== undefined
              ? { amount: requestForLedger.amount }
              : {}),
            secret: options.receiptSecret,
            ...(options.receiptTtlSeconds !== undefined
              ? { ttlSeconds: options.receiptTtlSeconds }
              : {}),
          })
        : undefined;

    const response: AuthorizeResponse = {
      approved: result.status === "approved",
      status: result.status,
      reasons: result.reasons,
      explanation: buildExplanation(result.status, result.reasons, id),
      decisionId: id,
      timestamp,
      ...(receipt !== undefined ? { receipt } : {}),
    };

    await appendDecision(
      { decisionId: id, timestamp, request: requestForLedger, response },
      options.ledgerPath,
    );
    return response;
  });
}
