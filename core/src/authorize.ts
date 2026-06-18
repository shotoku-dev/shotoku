import { randomUUID } from "node:crypto";

import type { AuthorizeRequest, AuthorizeResponse } from "./types.js";

export const authorize = (_request: AuthorizeRequest): AuthorizeResponse => ({
  approved: false,
  status: "denied",
  reasons: [
    {
      type: "escalated",
      text: "Authorization engine is not implemented yet.",
    },
  ],
  decisionId: randomUUID(),
  timestamp: new Date().toISOString(),
});
