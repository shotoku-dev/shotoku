import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  wrappedToolName,
  parseWrappedToolName,
  authorizeToolCall,
  blockedToolMessage,
} from "../wrap.js";

let policyPath: string;
let ledgerPath: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "shotoku-wrap-test-"));
  policyPath = join(dir, "policy.yaml");
  ledgerPath = join(dir, "decisions.jsonl");
});

const options = () => ({ policyPath, ledgerPath, actor: "claude-desktop" });

describe("wrapped tool names", () => {
  it("builds and parses a wrapped name", () => {
    const name = wrappedToolName("github", "create_issue");
    expect(name).toBe("github__create_issue");
    expect(parseWrappedToolName(name)).toEqual({
      server: "github",
      tool: "create_issue",
    });
  });

  it("keeps underscores inside the tool name intact", () => {
    expect(parseWrappedToolName("fs__read_text_file")).toEqual({
      server: "fs",
      tool: "read_text_file",
    });
  });

  it("returns null for a name that is not wrapped", () => {
    expect(parseWrappedToolName("authorize_action")).toBeNull();
    expect(parseWrappedToolName("__orphan")).toBeNull();
  });
});

describe("authorizeToolCall", () => {
  it("passes a tool allowed by policy", async () => {
    await writeFile(policyPath, `rules:\n  - resource: github__*\n    verdict: approved\n`);

    const decision = await authorizeToolCall("github", "create_issue", {}, options());

    expect(decision.outcome).toBe("pass");
    expect(decision.status).toBe("approved");
  });

  it("blocks a tool denied by policy", async () => {
    await writeFile(policyPath, `rules:\n  - resource: github__delete_repo\n    verdict: denied\ndefaultVerdict: pending_approval\n`);

    const decision = await authorizeToolCall("github", "delete_repo", {}, options());

    expect(decision.outcome).toBe("block");
    expect(decision.status).toBe("denied");
  });

  it("holds an unlisted tool for human approval", async () => {
    await writeFile(policyPath, `rules:\n  - resource: github__*\n    verdict: approved\ndefaultVerdict: pending_approval\n`);

    const decision = await authorizeToolCall("payments", "send_money", {}, options());

    expect(decision.outcome).toBe("block");
    expect(decision.status).toBe("pending_approval");
  });

  it("records only argument keys, never their values", async () => {
    await writeFile(policyPath, `rules:\n  - resource: github__*\n    verdict: approved\n`);

    await authorizeToolCall(
      "github",
      "create_issue",
      { title: "hi", apiKey: "sk-super-secret" },
      options(),
    );

    const { readFile } = await import("node:fs/promises");
    const ledger = await readFile(ledgerPath, "utf8");
    expect(ledger).toContain("argumentKeys");
    expect(ledger).toContain("apiKey");
    expect(ledger).not.toContain("sk-super-secret");
  });
});

describe("blockedToolMessage", () => {
  it("tells the agent it cannot self-approve a pending decision", async () => {
    await writeFile(policyPath, `rules: []\ndefaultVerdict: pending_approval\n`);
    const decision = await authorizeToolCall("payments", "send_money", {}, options());

    const message = blockedToolMessage(decision);

    expect(message).toContain("Blocked by Shotoku");
    expect(message).toContain(decision.decisionId);
    expect(message).toContain("cannot approve it yourself");
  });
});
