export interface TelegramConfig {
  readonly token: string;
  /** Absent in setup mode, where the bot only reports who wrote to it. */
  readonly ownerId?: number;
}

/** A Telegram user ID: a positive integer. Group chats (negative IDs) are not owners. */
const USER_ID = /^[1-9]\d{0,15}$/;

/**
 * Reads `SHOTOKU_TELEGRAM_BOT_TOKEN` and `SHOTOKU_TELEGRAM_CHAT_ID`.
 *
 * From the environment rather than `shotoku.config.json`, because the token
 * is a credential and the config file is meant to be committed and shared.
 */
export function telegramConfigFromEnv(env: Record<string, string | undefined>): TelegramConfig {
  const token = env["SHOTOKU_TELEGRAM_BOT_TOKEN"]?.trim();
  if (!token) {
    throw new Error(
      "SHOTOKU_TELEGRAM_BOT_TOKEN is not set.\n" +
        "  Create a bot: open @BotFather in Telegram, send /newbot, and set the token it gives you.",
    );
  }

  const rawChatId = env["SHOTOKU_TELEGRAM_CHAT_ID"];
  if (rawChatId === undefined) return { token };

  const chatId = rawChatId.trim();
  if (!USER_ID.test(chatId)) {
    throw new Error(
      `SHOTOKU_TELEGRAM_CHAT_ID must be your numeric Telegram user ID, not "${rawChatId}".\n` +
        "  Unset it and run shotoku telegram, then send any message to your bot: the ID is printed here.",
    );
  }
  return { token, ownerId: Number(chatId) };
}
