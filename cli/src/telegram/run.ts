import { toUserSafeMessage } from "@shotoku/core";
import { TelegramError, type TelegramClient, type TelegramUpdate } from "./api.js";
import { createApprovalBot, describeSetupUpdate } from "./bot.js";
import type { TelegramConfig } from "./config.js";

/**
 * The long-running side of `shotoku telegram`: long-poll for button presses,
 * and check the ledger for new pending decisions every second. Returns only by
 * throwing an error a human can act on; Ctrl+C is handled by the caller.
 */

export interface RunTelegramOptions {
  readonly config: TelegramConfig;
  readonly client: TelegramClient;
  readonly ledgerPath: string;
  readonly log: (line: string) => void;
}

const POLL_SECONDS = 25;
const LEDGER_CHECK_MS = 1000;
const RETRY_MS = 3000;

export async function runTelegram(options: RunTelegramOptions): Promise<never> {
  const { config, client, log } = options;

  const me = await client.getMe().catch((error: unknown) => {
    throw friendly(error);
  });
  const botName = me.username ? `@${me.username}` : "your bot";

  if (config.ownerId === undefined) {
    log(`Connected as ${botName}. Setup mode: no SHOTOKU_TELEGRAM_CHAT_ID yet.`);
    log(`Open ${botName} in Telegram on your phone, press Start, and send any message.`);
    return pollForever(client, log, async (update) => {
      const line = describeSetupUpdate(update);
      if (line) log(line);
    });
  }

  const ownerId = config.ownerId;
  await client
    .sendMessage(ownerId, "Shotoku is watching. Pending approvals appear here with Approve and Deny buttons.")
    .catch((error: unknown) => {
      if (error instanceof TelegramError && error.code === 400) {
        throw new Error(
          `Telegram cannot message chat ${ownerId}.\n` +
            `  Open ${botName} in Telegram and press Start first, then check SHOTOKU_TELEGRAM_CHAT_ID.`,
        );
      }
      throw friendly(error);
    });

  const bot = createApprovalBot({
    client,
    ownerId,
    ledgerPath: options.ledgerPath,
    since: new Date(),
    log,
  });

  log(`Connected as ${botName}. Watching ${options.ledgerPath}`);
  log("Pending approvals go to your phone. Ctrl+C to stop.");

  setInterval(() => {
    bot.notifyPending().catch((error: unknown) => {
      log(`Could not check for pending approvals: ${toUserSafeMessage(error)}`);
    });
  }, LEDGER_CHECK_MS);

  return pollForever(client, log, (update) => bot.handleUpdate(update));
}

async function pollForever(
  client: TelegramClient,
  log: (line: string) => void,
  handle: (update: TelegramUpdate) => Promise<void>,
): Promise<never> {
  let offset = 0;
  for (;;) {
    let updates: readonly TelegramUpdate[];
    try {
      updates = await client.getUpdates(offset, POLL_SECONDS);
    } catch (error) {
      if (error instanceof TelegramError && (error.code === 401 || error.code === 409)) {
        throw friendly(error);
      }
      log(`${toUserSafeMessage(error)} Retrying in ${RETRY_MS / 1000}s.`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      try {
        await handle(update);
      } catch (error) {
        log(`Could not handle a Telegram update: ${toUserSafeMessage(error)}`);
      }
    }
  }
}

/** Turns the Telegram errors a user can fix into instructions. */
function friendly(error: unknown): Error {
  if (error instanceof TelegramError && error.code === 401) {
    return new Error(
      "Telegram rejected the bot token.\n" +
        "  Check SHOTOKU_TELEGRAM_BOT_TOKEN against the token @BotFather gave you.",
    );
  }
  if (error instanceof TelegramError && error.code === 409) {
    return new Error(
      "Another process is already reading this bot's updates.\n" +
        "  Stop the other shotoku telegram (only one can run per bot), then try again.",
    );
  }
  return error instanceof Error ? error : new Error(toUserSafeMessage(error));
}
