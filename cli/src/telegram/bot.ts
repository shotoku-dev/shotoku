import {
  approve,
  deny,
  getApprovalForDecision,
  getDecisionById,
  getPendingApprovals,
  toUserSafeMessage,
  type ApprovalEntry,
} from "@shotoku/core";
import type { TelegramCallbackQuery, TelegramClient, TelegramMessage, TelegramUpdate } from "./api.js";
import {
  parseCallback,
  pendingMessage,
  resolvedElsewhereMessage,
  resolvedMessage,
} from "./message.js";

/**
 * Approvals from a phone.
 *
 * New pending decisions go to one Telegram user, the owner, with Approve and
 * Deny buttons. A press runs the same `approve()` / `deny()` as
 * `shotoku approve`, recorded with `via: "telegram:<user id>"`.
 *
 * Only the owner's presses count. Telegram itself says who pressed
 * (`callback_query.from`), and a bot cannot fake a press from someone else's
 * account, so the check is on that ID, not on anything in the button data.
 * Everyone else is refused and logged.
 *
 * This puts the human's answer on another device. It is not a sandbox: a
 * process running as the same user can still run `shotoku approve` or write
 * the ledger. That separation needs the agent kept away from Shotoku's files.
 */

export interface ApprovalBotOptions {
  readonly client: TelegramClient;
  /** The one Telegram user whose presses are honoured, and who is notified. */
  readonly ownerId: number;
  readonly ledgerPath: string;
  /** Decisions older than this were pending before the bot started; not announced. */
  readonly since: Date;
  readonly log: (line: string) => void;
}

export interface ApprovalBot {
  /** Announce new pending decisions; update messages for ones resolved elsewhere. */
  notifyPending(): Promise<void>;
  handleUpdate(update: TelegramUpdate): Promise<void>;
}

/** Telegram truncates longer callback answers. */
const MAX_ANSWER_LENGTH = 200;

export function createApprovalBot(options: ApprovalBotOptions): ApprovalBot {
  const { client, ownerId, ledgerPath, log } = options;
  /** decisionId → the Telegram message announcing it. */
  const announced = new Map<string, number>();

  // A refresh and a button press must not interleave: a press would be seen
  // as "resolved elsewhere" by a refresh that read the ledger mid-press.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  /** An edit or answer that fails is logged; it never undoes a recorded decision. */
  async function quietly(what: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      log(`Could not ${what}: ${toUserSafeMessage(error)}`);
    }
  }

  async function notifyPending(): Promise<void> {
    const pending = await getPendingApprovals(ledgerPath);
    const stillPending = new Set(pending.map((entry) => entry.decisionId));

    for (const entry of pending) {
      if (announced.has(entry.decisionId)) continue;
      if (new Date(entry.timestamp) < options.since) continue;

      const { text, keyboard } = pendingMessage(entry);
      const message = await client.sendMessage(ownerId, text, keyboard);
      announced.set(entry.decisionId, message.message_id);
      log(`◷ ${entry.decisionId} sent to Telegram`);
    }

    for (const [decisionId, messageId] of announced) {
      if (stillPending.has(decisionId)) continue;
      announced.delete(decisionId);

      const entry = await getDecisionById(ledgerPath, decisionId);
      const approval = await getApprovalForDecision(ledgerPath, decisionId);
      if (!entry || !approval) continue;
      await quietly(`update the message for ${decisionId}`, () =>
        client.editMessageText(ownerId, messageId, resolvedElsewhereMessage(entry, approval)),
      );
    }
  }

  async function handlePress(press: TelegramCallbackQuery): Promise<void> {
    const answer = (text: string) =>
      quietly("answer the button press", () =>
        client.answerCallbackQuery(press.id, text.slice(0, MAX_ANSWER_LENGTH)),
      );

    if (press.from.id !== ownerId) {
      log(`Refused a button press from Telegram user ${press.from.id}: not the owner`);
      await answer("Not authorized.");
      return;
    }

    const parsed = parseCallback(press.data);
    if (!parsed) {
      await answer("That is not a Shotoku button.");
      return;
    }
    const { verdict, decisionId } = parsed;
    const target = messageOf(press, announced.get(decisionId), ownerId);
    announced.delete(decisionId);

    let approval: ApprovalEntry;
    try {
      const resolve = verdict === "approved" ? approve : deny;
      approval = await resolve(decisionId, { ledgerPath, via: `telegram:${press.from.id}` });
    } catch (error) {
      // Not found, already answered, or not pending: say why, and show the
      // answer that does stand, if there is one.
      await answer(toUserSafeMessage(error));
      const entry = await getDecisionById(ledgerPath, decisionId);
      const existing = await getApprovalForDecision(ledgerPath, decisionId);
      if (entry && existing && target) {
        await quietly(`update the message for ${decisionId}`, () =>
          client.editMessageText(target.chatId, target.messageId, resolvedElsewhereMessage(entry, existing)),
        );
      }
      return;
    }

    const symbol = verdict === "approved" ? "✓" : "✗";
    log(`${symbol} ${decisionId} ${verdict} on Telegram as ${approval.approvalId}`);
    await answer(verdict === "approved" ? "Approved." : "Denied.");

    const entry = await getDecisionById(ledgerPath, decisionId);
    if (entry && target) {
      await quietly(`update the message for ${decisionId}`, () =>
        client.editMessageText(target.chatId, target.messageId, resolvedMessage(entry, approval)),
      );
    }
  }

  async function handleMessage(message: TelegramMessage): Promise<void> {
    if (message.from?.id !== ownerId) {
      log(`Ignored a message from Telegram user ${message.from?.id ?? "unknown"}`);
      return;
    }
    await client.sendMessage(
      ownerId,
      "Shotoku is watching. Pending approvals appear here with Approve and Deny buttons.",
    );
  }

  return {
    notifyPending: () => serial(notifyPending),
    handleUpdate: (update) =>
      serial(async () => {
        if (update.callback_query) await handlePress(update.callback_query);
        else if (update.message) await handleMessage(update.message);
      }),
  };
}

function messageOf(
  press: TelegramCallbackQuery,
  announcedId: number | undefined,
  ownerId: number,
): { readonly chatId: number; readonly messageId: number } | undefined {
  if (press.message) return { chatId: press.message.chat.id, messageId: press.message.message_id };
  return announcedId === undefined ? undefined : { chatId: ownerId, messageId: announcedId };
}

/**
 * Setup mode, before a chat ID is configured: what to print in the terminal
 * when someone writes to the bot. The ID is the sender's user ID, which is
 * exactly what the owner check compares against.
 */
export function describeSetupUpdate(update: TelegramUpdate): string | undefined {
  const from = update.message?.from;
  if (!from) return undefined;
  const name = from.username ? `@${from.username}` : (from.first_name ?? "someone");
  return [
    `Message from ${name}: chat ID ${from.id}.`,
    `If that is you, set SHOTOKU_TELEGRAM_CHAT_ID=${from.id} and run shotoku telegram again.`,
  ].join("\n");
}
