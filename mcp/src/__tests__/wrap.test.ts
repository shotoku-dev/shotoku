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

describe("authorizeToolCall with a price", () => {
  const REFUND_POLICY = `rules:\n  - resource: paypal__create_refund\n    verdict: approved\n    maxAmount: 100\n    maxDailyAmount: 300\n`;

  it("passes a priced call within the limits", async () => {
    await writeFile(policyPath, REFUND_POLICY);

    const decision = await authorizeToolCall("paypal", "create_refund", {}, options(), {
      amount: 89,
      source: "create_refund amount argument",
    });

    expect(decision.outcome).toBe("pass");
    expect(decision.status).toBe("approved");
  });

  it("denies a priced call over the per-transaction limit", async () => {
    await writeFile(policyPath, REFUND_POLICY);

    const decision = await authorizeToolCall("paypal", "create_refund", {}, options(), {
      amount: 480,
      source: "capture 21U52621A9811731L",
    });

    expect(decision.outcome).toBe("block");
    expect(decision.status).toBe("denied");
    expect(decision.explanation.summary).toContain("$480");
  });

  it("counts priced calls against the daily limit", async () => {
    await writeFile(policyPath, REFUND_POLICY);
    const quote = { amount: 90, source: "create_refund amount argument" };

    for (let i = 0; i < 3; i++) {
      const ok = await authorizeToolCall("paypal", "create_refund", { n: i }, options(), quote);
      expect(ok.status).toBe("approved");
    }
    const fourth = await authorizeToolCall("paypal", "create_refund", { n: 3 }, options(), quote);

    expect(fourth.status).toBe("denied");
  });

  it("holds an unpriced call against a limited rule", async () => {
    await writeFile(policyPath, REFUND_POLICY);

    const decision = await authorizeToolCall("paypal", "create_refund", {}, options());

    expect(decision.status).toBe("pending_approval");
  });

  it("records where the amount came from", async () => {
    await writeFile(policyPath, REFUND_POLICY);

    await authorizeToolCall("paypal", "create_refund", {}, options(), {
      amount: 89,
      source: "capture 21U52621A9811731L",
    });

    const { readFile } = await import("node:fs/promises");
    const ledger = await readFile(ledgerPath, "utf8");
    expect(ledger).toContain("capture 21U52621A9811731L");
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
