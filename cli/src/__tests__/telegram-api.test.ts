import { describe, it, expect } from "vitest";
import { createTelegramClient, TelegramError } from "../telegram/api.js";

const TOKEN = "123456:SECRET-bot-token";

interface Captured {
  readonly url: string;
  readonly body: unknown;
}

function fakeFetch(reply: { status?: number; body: unknown }) {
  const calls: Captured[] = [];
  const fetchImpl = async (...[input, init]: Parameters<typeof fetch>) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "null")) });
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

describe("Telegram client", () => {
  it("posts a method call as JSON and returns its result", async () => {
    const { fetchImpl, calls } = fakeFetch({
      body: { ok: true, result: { message_id: 7, chat: { id: 42 } } },
    });
    const client = createTelegramClient(TOKEN, fetchImpl);

    const message = await client.sendMessage(42, "hello", [
      [{ text: "✓ Approve", callback_data: "approve:dec_1" }],
    ]);

    expect(message.message_id).toBe(7);
    expect(calls[0]?.url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(calls[0]?.body).toEqual({
      chat_id: 42,
      text: "hello",
      reply_markup: { inline_keyboard: [[{ text: "✓ Approve", callback_data: "approve:dec_1" }]] },
    });
  });

  it("sends plain text, never a parse mode, so decision text cannot inject markup", async () => {
    const { fetchImpl, calls } = fakeFetch({
      body: { ok: true, result: { message_id: 1, chat: { id: 42 } } },
    });

    await createTelegramClient(TOKEN, fetchImpl).sendMessage(42, "*bold* <b>x</b>");

    expect(calls[0]?.body).not.toHaveProperty("parse_mode");
  });

  it("removes the buttons when a message is edited without a keyboard", async () => {
    const { fetchImpl, calls } = fakeFetch({ body: { ok: true, result: true } });

    await createTelegramClient(TOKEN, fetchImpl).editMessageText(42, 7, "done");

    expect(calls[0]?.body).toEqual({ chat_id: 42, message_id: 7, text: "done" });
  });

  it("asks only for the updates the bot handles", async () => {
    const { fetchImpl, calls } = fakeFetch({ body: { ok: true, result: [] } });

    await createTelegramClient(TOKEN, fetchImpl).getUpdates(10, 20);

    expect(calls[0]?.body).toEqual({
      offset: 10,
      timeout: 20,
      allowed_updates: ["message", "callback_query"],
    });
  });

  it("raises Telegram's error code and description, without the token", async () => {
    const { fetchImpl } = fakeFetch({
      status: 401,
      body: { ok: false, error_code: 401, description: "Unauthorized" },
    });

    const error = await createTelegramClient(TOKEN, fetchImpl)
      .getMe()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TelegramError);
    expect((error as TelegramError).code).toBe(401);
    expect((error as TelegramError).message).toContain("Unauthorized");
    expect((error as TelegramError).message).not.toContain("SECRET");
  });

  it("does not leak the token when the network fails", async () => {
    const failing = (async () => {
      throw new Error(`request to https://api.telegram.org/bot${TOKEN}/getMe failed`);
    }) as typeof fetch;

    const error = await createTelegramClient(TOKEN, failing)
      .getMe()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TelegramError);
    expect((error as TelegramError).message).not.toContain("SECRET");
  });
});
