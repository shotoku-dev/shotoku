import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorizeHttpRequest } from "../authorize-request.js";

let policyPath: string;
let ledgerPath: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "shotoku-gw-test-"));
  policyPath = join(dir, "policy.yaml");
  ledgerPath = join(dir, "decisions.jsonl");
});

const base = {
  method: "GET",
  host: "api.openai.com",
  path: "/v1/chat/completions",
  actor: "my-agent",
};

describe("authorizeHttpRequest", () => {
  it("passes a request to an allowlisted host", async () => {
    await writeFile(policyPath, `rules:\n  - resource: api.openai.com/*\n    verdict: approved\n`);

    const decision = await authorizeHttpRequest(base, { policyPath, ledgerPath });

    expect(decision.outcome).toBe("pass");
    expect(decision.status).toBe("approved");
    expect(decision.decisionId).toMatch(/^dec_/);
  });

  it("blocks a request denied by policy", async () => {
    await writeFile(policyPath, `rules:\n  - resource: api.openai.com/*\n    verdict: denied\n`);

    const decision = await authorizeHttpRequest(base, { policyPath, ledgerPath });

    expect(decision.outcome).toBe("block");
    expect(decision.status).toBe("denied");
  });

  it("blocks an unknown host as pending approval", async () => {
    await writeFile(policyPath, `rules:\n  - resource: other.com\n    verdict: approved\ndefaultVerdict: pending_approval\n`);

    const decision = await authorizeHttpRequest(base, { policyPath, ledgerPath });

    expect(decision.outcome).toBe("block");
    expect(decision.status).toBe("pending_approval");
  });

  it("matches the resource as host + path, so path globs work", async () => {
    await writeFile(policyPath, `rules:\n  - resource: api.openai.com/v1/*\n    verdict: approved\ndefaultVerdict: pending_approval\n`);

    const allowed = await authorizeHttpRequest(base, { policyPath, ledgerPath });
    const other = await authorizeHttpRequest(
      { ...base, path: "/admin/keys" },
      { policyPath, ledgerPath },
    );

    expect(allowed.outcome).toBe("pass");
    expect(other.outcome).toBe("block");
  });
});
