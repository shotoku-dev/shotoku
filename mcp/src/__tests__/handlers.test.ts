import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDecisions } from "@shotoku/core";
import { handleToolCall } from "../handlers.js";

let dir: string;
let previousPolicy: string | undefined;
let previousLedger: string | undefined;
let previousConfig: string | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "shotoku-mcp-test-"));
  previousPolicy = process.env["SHOTOKU_POLICY"];
  previousLedger = process.env["SHOTOKU_LEDGER"];
  previousConfig = process.env["SHOTOKU_CONFIG"];
  delete process.env["SHOTOKU_CONFIG"];
  process.env["SHOTOKU_POLICY"] = join(dir, "policy.yaml");
  process.env["SHOTOKU_LEDGER"] = join(dir, "decisions.jsonl");
});

afterEach(() => {
  if (previousPolicy === undefined) {
    delete process.env["SHOTOKU_POLICY"];
  } else {
    process.env["SHOTOKU_POLICY"] = previousPolicy;
  }

  if (previousLedger === undefined) {
    delete process.env["SHOTOKU_LEDGER"];
  } else {
    process.env["SHOTOKU_LEDGER"] = previousLedger;
  }

  if (previousConfig === undefined) {
    delete process.env["SHOTOKU_CONFIG"];
  } else {
    process.env["SHOTOKU_CONFIG"] = previousConfig;
  }
});

describe("handleToolCall", () => {
  it("returns structured authorization content", async () => {
    await writeFile(
      join(dir, "policy.yaml"),
      `rules:\n  - resource: openai.com\n    verdict: approved\n`,
      "utf8",
    );

    const result = await handleToolCall(
      "authorize_action",
      { action: "api_call", resource: "openai.com" },
      "claude-desktop",
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toHaveProperty("response");
    expect(result.structuredContent?.["actor"]).toBe("claude-desktop");
  });

  it("records the server-set actor, not one the caller supplies", async () => {
    await writeFile(
      join(dir, "policy.yaml"),
      `rules:\n  - resource: openai.com\n    verdict: approved\n`,
      "utf8",
    );

    const result = await handleToolCall(
      "authorize_action",
      { actor: "definitely-not-me", action: "api_call", resource: "openai.com" },
      "claude-desktop",
    );

    // Ignored, not rejected: clients pass model output through verbatim.
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.["actor"]).toBe("claude-desktop");

    const entries = await readDecisions(join(dir, "decisions.jsonl"));
    expect(entries).toHaveLength(1);
    expect(entries[0]!.request.actor).toBe("claude-desktop");
  });

  it("approves a pending decision through MCP", async () => {
    await writeFile(
      join(dir, "policy.yaml"),
      `rules:\n  - resource: openai.com\n    verdict: approved\n`,
      "utf8",
    );

    const pending = await handleToolCall(
      "authorize_action",
      { action: "api_call", resource: "unknown.example" },
      "claude-desktop",
    );
    const response = pending.structuredContent?.["response"] as
      | { readonly decisionId?: string }
      | undefined;

    const result = await handleToolCall(
      "approve_decision",
      { decisionId: response?.decisionId },
      "claude-desktop",
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toHaveProperty("approval");
  });
});
