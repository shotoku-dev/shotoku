import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { AuthorizeRequest, AuthorizeResponse, Policy } from "./types.js";
import { evaluatePolicy } from "./policy.js";
import { appendDecision, getLedgerSnapshot } from "./ledger.js";
import { buildExplanation } from "./explain.js";

function decisionId(): string {
  return `dec_${randomBytes(6).toString("hex")}`;
}

async function loadPolicy(policyPath: string): Promise<Policy | null> {
  try {
    const raw = await readFile(policyPath, "utf8");
    return parse(raw) as Policy;
  } catch {
    return null;
  }
}

export async function authorize(
  request: AuthorizeRequest,
  options: {
    readonly policyPath: string;
    readonly ledgerPath: string;
  },
): Promise<AuthorizeResponse> {
  const id = decisionId();
  const timestamp = new Date().toISOString();

  const policy = await loadPolicy(options.policyPath);

  if (!policy) {
    const reasons = [{ type: "blocked" as const, text: "Policy file could not be loaded" }];
    const response: AuthorizeResponse = {
      approved: false,
      status: "denied",
      reasons,
      explanation: buildExplanation("denied", reasons, id),
      decisionId: id,
      timestamp,
    };
    await appendDecision({ decisionId: id, timestamp, request, response }, options.ledgerPath);
    return response;
  }

  const snapshot = await getLedgerSnapshot(options.ledgerPath);
  const result = evaluatePolicy(request, policy, snapshot);

  const response: AuthorizeResponse = {
    approved: result.status === "approved",
    status: result.status,
    reasons: result.reasons,
    explanation: buildExplanation(result.status, result.reasons, id),
    decisionId: id,
    timestamp,
  };

  await appendDecision({ decisionId: id, timestamp, request, response }, options.ledgerPath);
  return response;
}
