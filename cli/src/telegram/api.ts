/**
 * The handful of Telegram Bot API calls the approval bot needs, over `fetch`.
 *
 * Only outbound HTTPS: updates are fetched by long polling (`getUpdates`), so
 * nothing on this machine listens on a port. The token is part of every URL
 * Telegram defines, which is why no error raised here repeats a URL or the
 * underlying network message.
 *
 * Messages are always plain text. A decision's resource and reasons come from
 * the agent's request, and a parse mode would let them inject formatting or
 * links into the message a human is about to approve.
 */

export interface TelegramUser {
  readonly id: number;
  readonly first_name?: string;
  readonly username?: string;
}

export interface TelegramChat {
  readonly id: number;
}

export interface TelegramMessage {
  readonly message_id: number;
  readonly chat: TelegramChat;
  readonly from?: TelegramUser;
  readonly text?: string;
}

export interface TelegramCallbackQuery {
  readonly id: string;
  readonly from: TelegramUser;
  readonly message?: TelegramMessage;
  readonly data?: string;
}

export interface TelegramUpdate {
  readonly update_id: number;
  readonly message?: TelegramMessage;
  readonly callback_query?: TelegramCallbackQuery;
}

export interface InlineButton {
  readonly text: string;
  readonly callback_data: string;
}

export type InlineKeyboard = readonly (readonly InlineButton[])[];

export interface TelegramClient {
  getMe(): Promise<TelegramUser>;
  getUpdates(offset: number, timeoutSeconds: number): Promise<readonly TelegramUpdate[]>;
  sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<TelegramMessage>;
  /** Without a keyboard, Telegram removes the buttons from the message. */
  editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text: string): Promise<void>;
}

export class TelegramError extends Error {
  /** Telegram's `error_code` (401 bad token, 409 another poller, ...), if it sent one. */
  readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "TelegramError";
    this.code = code;
  }
}

/** Extra time over the long-poll timeout before a request counts as hung. */
const REQUEST_SLACK_MS = 10_000;

export function createTelegramClient(
  token: string,
  fetchImpl: typeof fetch = fetch,
): TelegramClient {
  async function call<T>(method: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new TelegramError(`Could not reach Telegram (${method}). Check the network connection.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TelegramError(`Telegram sent an unreadable reply to ${method} (HTTP ${response.status}).`);
    }

    if (!isRecord(payload) || payload["ok"] !== true) {
      const code = isRecord(payload) && typeof payload["error_code"] === "number"
        ? payload["error_code"]
        : response.status;
      const description = isRecord(payload) && typeof payload["description"] === "string"
        ? payload["description"]
        : `HTTP ${response.status}`;
      throw new TelegramError(`Telegram refused ${method}: ${description}`, code);
    }

    return payload["result"] as T;
  }

  const keyboardMarkup = (keyboard?: InlineKeyboard) =>
    keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {};

  return {
    getMe: () => call<TelegramUser>("getMe", {}, REQUEST_SLACK_MS),

    getUpdates: (offset, timeoutSeconds) =>
      call<readonly TelegramUpdate[]>(
        "getUpdates",
        { offset, timeout: timeoutSeconds, allowed_updates: ["message", "callback_query"] },
        timeoutSeconds * 1000 + REQUEST_SLACK_MS,
      ),

    sendMessage: (chatId, text, keyboard) =>
      call<TelegramMessage>(
        "sendMessage",
        { chat_id: chatId, text, ...keyboardMarkup(keyboard) },
        REQUEST_SLACK_MS,
      ),

    async editMessageText(chatId, messageId, text, keyboard) {
      await call<unknown>(
        "editMessageText",
        { chat_id: chatId, message_id: messageId, text, ...keyboardMarkup(keyboard) },
        REQUEST_SLACK_MS,
      );
    },

    async answerCallbackQuery(callbackQueryId, text) {
      await call<unknown>(
        "answerCallbackQuery",
        { callback_query_id: callbackQueryId, text },
        REQUEST_SLACK_MS,
      );
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
