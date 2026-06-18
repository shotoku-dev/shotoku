import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { AuthorizeRequest, AuthorizeResponse, Policy } from "./types.js";
import { evaluatePolicy } from "./policy.js";
import { appendDecision, getLedgerSnapshot } from "./ledger.js";

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
    const response: AuthorizeResponse = {
      approved: false,
      status: "denied",
      reasons: [{ type: "blocked", text: "Policy file could not be loaded" }],
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
    decisionId: id,
    timestamp,
  };

  await appendDecision({ decisionId: id, timestamp, request, response }, options.ledgerPath);
  return response;
}
