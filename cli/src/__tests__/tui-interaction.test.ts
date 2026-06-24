import { describe, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { render, type RenderOptions } from "ink";
import { createElement } from "react";
import {
  appendDecision,
  readApprovals,
  type AuthorizationStatus,
  type LedgerEntry,
} from "@shotoku/core";
import { App } from "../tui/App.js";

class TestStdin extends PassThrough {
  isTTY = true;

  setRawMode(_mode: boolean): this {
    return this;
  }

  override setEncoding(encoding: Parameters<PassThrough["setEncoding"]>[0]): this {
    super.setEncoding(encoding);
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }
}

class TestOutput extends Writable {
  isTTY = true;
  columns = 120;
  rows = 50;
  private readonly chunks: string[] = [];

  override _write(
    chunk: Buffer | string,
    _encoding: string,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(chunk.toString());
    callback();
  }

  output(): string {
    return this.chunks.join("");
  }

  getColorDepth(): number {
    return 1;
  }

  hasColors(): boolean {
    return false;
  }
}

function pendingDecision(
  id: string,
  status: AuthorizationStatus = "pending_approval",
): LedgerEntry {
  const timestamp = new Date().toISOString();
  return {
    decisionId: id,
    timestamp,
    request: {
      actor: "agent-1",
      action: "api_call",
      resource: "unknown.example",
      amount: 10,
    },
    response: {
      approved: false,
      status,
      reasons: [{ type: "escalated", text: "unknown.example needs review" }],
      explanation: {
        summary: "unknown.example needs review",
        hint: `shotoku approve ${id}`,
      },
      decisionId: id,
      timestamp,
    },
  };
}

async function waitFor(
  condition: () => boolean | Promise<boolean>,
  label: string,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 2_000) {
    if (await condition()) return;
    await sleep(25);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function renderTui(ledgerPath: string): Promise<{
  readonly stdin: TestStdin;
  readonly renderCount: () => number;
  readonly unmount: () => Promise<void>;
}> {
  const stdin = new TestStdin();
  const stdout = new TestOutput();
  const stderr = new TestOutput();
  let renders = 0;
  const options: RenderOptions = {
    stdin: stdin as unknown as NonNullable<RenderOptions["stdin"]>,
    stdout: stdout as unknown as NonNullable<RenderOptions["stdout"]>,
    stderr: stderr as unknown as NonNullable<RenderOptions["stderr"]>,
    exitOnCtrlC: false,
    interactive: true,
    debug: true,
    onRender: () => {
      renders += 1;
    },
  };
  const instance = render(createElement(App, { ledgerPath }), options);

  await waitFor(() => renders > 0, "initial render");

  return {
    stdin,
    renderCount: () => renders,
    unmount: async () => {
      instance.unmount();
      await instance.waitUntilExit().catch(() => undefined);
      instance.cleanup();
    },
  };
}

describe("TUI interactions", () => {
  it("approves the selected pending decision with Enter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-tui-test-"));
    const ledgerPath = join(dir, "decisions.jsonl");
    await appendDecision(pendingDecision("dec_tui_approve"), ledgerPath);

    const app = await renderTui(ledgerPath);
    try {
      await waitFor(() => app.renderCount() > 1, "pending decision render");
      app.stdin.write("\r");

      await waitFor(async () => {
        const approvals = await readApprovals(ledgerPath);
        return approvals.some(
          (approval) =>
            approval.decisionId === "dec_tui_approve" &&
            approval.verdict === "approved",
        );
      }, "approval write");
    } finally {
      await app.unmount();
    }
  });

  it("denies the selected pending decision with d", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-tui-test-"));
    const ledgerPath = join(dir, "decisions.jsonl");
    await appendDecision(pendingDecision("dec_tui_deny"), ledgerPath);

    const app = await renderTui(ledgerPath);
    try {
      await waitFor(() => app.renderCount() > 1, "pending decision render");
      app.stdin.write("d");

      await waitFor(async () => {
        const approvals = await readApprovals(ledgerPath);
        return approvals.some(
          (approval) =>
            approval.decisionId === "dec_tui_deny" &&
            approval.verdict === "denied",
        );
      }, "denial write");
    } finally {
      await app.unmount();
    }
  });
});
