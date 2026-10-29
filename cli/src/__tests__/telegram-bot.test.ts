import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendDecision,
  approve,
  readApprovals,
  type AuthorizationStatus,
  type LedgerEntry,
} from "@shotoku/core";
import type {
  InlineKeyboard,
  TelegramClient,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from "../telegram/api.js";
import { createApprovalBot, describeSetupUpdate } from "../telegram/bot.js";
import { telegramConfigFromEnv } from "../telegram/config.js";

const OWNER = 123456;
const STRANGER = 999999;

interface Sent {
  readonly chatId: number;
  readonly messageId: number;
  readonly text: string;
  readonly keyboard?: InlineKeyboard;
}

interface Edited {
  readonly chatId: number;
  readonly messageId: number;
  readonly text: string;
  readonly keyboard?: InlineKeyboard;
}

/** Records every call; message IDs count up from 1. */
function fakeClient() {
  const sent: Sent[] = [];
  const edited: Edited[] = [];
  const answered: { readonly id: string; readonly text: string }[] = [];
  const client: TelegramClient = {
    async getMe(): Promise<TelegramUser> {
      return { id: 1, first_name: "Shotoku", username: "shotoku_test_bot" };
    },
    async getUpdates(): Promise<readonly TelegramUpdate[]> {
      return [];
    },
    async sendMessage(chatId, text, keyboard): Promise<TelegramMessage> {
      const messageId = sent.length + 1;
      sent.push({ chatId, messageId, text, ...(keyboard ? { keyboard } : {}) });
      return { message_id: messageId, chat: { id: chatId } };
    },
    async editMessageText(chatId, messageId, text, keyboard) {
      edited.push({ chatId, messageId, text, ...(keyboard ? { keyboard } : {}) });
    },
    async answerCallbackQuery(id, text) {
      answered.push({ id, text });
    },
  };
  return { client, sent, edited, answered };
}

function decision(
  decisionId: string,
  status: AuthorizationStatus,
  timestamp = new Date().toISOString(),
): LedgerEntry {
  return {
    decisionId,
    timestamp,
    request: {
      actor: "support-agent",
      action: "mcp_tool",
      resource: "paypal__create_refund",
      rail: "mcp",
      amount: 480,
    },
    response: {
      approved: status === "approved",
      status,
      reasons: [{ type: "escalated", text: "Amount $480 exceeds per-transaction limit of $100" }],
      explanation: { summary: "Amount $480 exceeds per-transaction limit of $100" },
      decisionId,
      timestamp,
    },
  };
}

function tap(from: number, data: string, messageId = 1): TelegramUpdate {
  return {
    update_id: 1,
    callback_query: {
      id: `cb_${data}`,
      from: { id: from, first_name: "Someone" },
      message: { message_id: messageId, chat: { id: from } },
      data,
    },
  };
}

function text(from: number, body: string): TelegramUpdate {
  return {
    update_id: 2,
    message: { message_id: 50, chat: { id: from }, from: { id: from, first_name: "Issa" }, text: body },
  };
}

let ledgerPath: string;
let logs: string[];
const since = new Date(Date.now() - 60_000);

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "shotoku-telegram-test-"));
  ledgerPath = join(dir, "decisions.jsonl");
  logs = [];
});

function bot(client: TelegramClient) {
  return createApprovalBot({ client, ownerId: OWNER, ledgerPath, since, log: (l) => logs.push(l) });
}

describe("approval bot — notifications", () => {
  it("sends each new pending decision to the owner, with buttons", async () => {
    const fake = fakeClient();
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);

    await bot(fake.client).notifyPending();

    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]?.chatId).toBe(OWNER);
    expect(fake.sent[0]?.text).toContain("dec_aaa111");
    expect(fake.sent[0]?.keyboard?.[0]?.map((b) => b.callback_data)).toEqual([
      "approve:dec_aaa111",
      "deny:dec_aaa111",
    ]);
  });

  it("sends a decision once", async () => {
    const fake = fakeClient();
    const b = bot(fake.client);
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);

    await b.notifyPending();
    await b.notifyPending();

    expect(fake.sent).toHaveLength(1);
  });

  it("does not resend what was pending before it started", async () => {
    const fake = fakeClient();
    const old = new Date(since.getTime() - 3_600_000).toISOString();
    await appendDecision(decision("dec_old", "pending_approval", old), ledgerPath);

    await bot(fake.client).notifyPending();

    expect(fake.sent).toEqual([]);
  });

  it("ignores decisions that are not pending", async () => {
    const fake = fakeClient();
    await appendDecision(decision("dec_ok", "approved"), ledgerPath);
    await appendDecision(decision("dec_no", "denied"), ledgerPath);

    await bot(fake.client).notifyPending();

    expect(fake.sent).toEqual([]);
  });

  it("updates the message when the decision is resolved somewhere else", async () => {
    const fake = fakeClient();
    const b = bot(fake.client);
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);
    await b.notifyPending();

    await approve("dec_aaa111", { ledgerPath });
    await b.notifyPending();

    expect(fake.edited).toHaveLength(1);
    expect(fake.edited[0]?.messageId).toBe(1);
    expect(fake.edited[0]?.text).toContain("✓ APPROVED");
    expect(fake.edited[0]?.keyboard).toBeUndefined();
  });
});

describe("approval bot — buttons", () => {
  it("approves when the owner taps Approve, and records the channel", async () => {
    const fake = fakeClient();
    const b = bot(fake.client);
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);
    await b.notifyPending();

    await b.handleUpdate(tap(OWNER, "approve:dec_aaa111"));

    const approvals = await readApprovals(ledgerPath);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.verdict).toBe("approved");
    expect(approvals[0]?.via).toBe(`telegram:${OWNER}`);
    expect(fake.edited.at(-1)?.text).toContain("✓ APPROVED");
    expect(fake.edited.at(-1)?.keyboard).toBeUndefined();
    expect(fake.answered.at(-1)?.text).toMatch(/Approved/);
  });

  it("denies when the owner taps Deny", async () => {
    const fake = fakeClient();
    const b = bot(fake.client);
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);

    await b.handleUpdate(tap(OWNER, "deny:dec_aaa111"));

    const approvals = await readApprovals(ledgerPath);
    expect(approvals[0]?.verdict).toBe("denied");
    expect(fake.edited.at(-1)?.text).toContain("✗ DENIED");
  });

  it("refuses a tap from anyone but the owner", async () => {
    const fake = fakeClient();
    const b = bot(fake.client);
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);

    await b.handleUpdate(tap(STRANGER, "approve:dec_aaa111"));

    expect(await readApprovals(ledgerPath)).toEqual([]);
    expect(fake.answered.at(-1)?.text).toMatch(/not authorized/i);
    expect(fake.edited).toEqual([]);
    expect(logs.join("\n")).toContain(String(STRANGER));
  });

  it("says so when the decision was already resolved, without a second record", async () => {
    const fake = fakeClient();
    const b = bot(fake.client);
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);
    await approve("dec_aaa111", { ledgerPath });

    await b.handleUpdate(tap(OWNER, "deny:dec_aaa111"));

    const approvals = await readApprovals(ledgerPath);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.verdict).toBe("approved");
    expect(fake.answered.at(-1)?.text).toMatch(/already approved/);
    expect(fake.edited.at(-1)?.text).toContain("✓ APPROVED");
  });

  it("ignores button data it did not produce", async () => {
    const fake = fakeClient();
    const b = bot(fake.client);
    await appendDecision(decision("dec_aaa111", "pending_approval"), ledgerPath);

    await b.handleUpdate(tap(OWNER, "grant:dec_aaa111"));

    expect(await readApprovals(ledgerPath)).toEqual([]);
    expect(fake.answered.at(-1)?.text).toMatch(/not a Shotoku button/i);
  });
});

describe("approval bot — messages", () => {
  it("answers the owner, so they know it is listening", async () => {
    const fake = fakeClient();

    await bot(fake.client).handleUpdate(text(OWNER, "/start"));

    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]?.chatId).toBe(OWNER);
  });

  it("stays silent to strangers", async () => {
    const fake = fakeClient();

    await bot(fake.client).handleUpdate(text(STRANGER, "/start"));

    expect(fake.sent).toEqual([]);
  });
});

describe("setup mode", () => {
  it("tells the terminal the chat ID of whoever wrote to the bot", () => {
    const line = describeSetupUpdate(text(OWNER, "hi"));

    expect(line).toContain(String(OWNER));
    expect(line).toContain("SHOTOKU_TELEGRAM_CHAT_ID");
  });

  it("has nothing to say about other updates", () => {
    expect(describeSetupUpdate(tap(OWNER, "approve:dec_aaa111"))).toBeUndefined();
  });
});

describe("telegram config", () => {
  it("reads the token and chat ID", () => {
    expect(
      telegramConfigFromEnv({ SHOTOKU_TELEGRAM_BOT_TOKEN: "1:abc", SHOTOKU_TELEGRAM_CHAT_ID: "123456" }),
    ).toEqual({ token: "1:abc", ownerId: 123456 });
  });

  it("runs without a chat ID, for setup", () => {
    expect(telegramConfigFromEnv({ SHOTOKU_TELEGRAM_BOT_TOKEN: "1:abc" })).toEqual({ token: "1:abc" });
  });

  it("explains where to get a token when there is none", () => {
    expect(() => telegramConfigFromEnv({})).toThrow(/SHOTOKU_TELEGRAM_BOT_TOKEN.*@BotFather/s);
  });

  it("rejects a chat ID that is not a user ID", () => {
    for (const id of ["abc", "-100123", "12.5", ""]) {
      expect(() =>
        telegramConfigFromEnv({ SHOTOKU_TELEGRAM_BOT_TOKEN: "1:abc", SHOTOKU_TELEGRAM_CHAT_ID: id }),
      ).toThrow(/SHOTOKU_TELEGRAM_CHAT_ID/);
    }
  });
});
