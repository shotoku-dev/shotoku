/**
 * Who is calling.
 *
 * The identity of an agent is a property of the channel, never of the payload.
 * An MCP client announces its own name during the initialize handshake, before
 * it can make a single tool call, and the model on the other side never sees
 * that value — so it is the client process asserting an identity, not the agent
 * choosing one for itself.
 *
 * This makes agents distinguishable, not unforgeable. Anything with shell
 * access can edit a config or bypass Shotoku entirely. The guarantee is
 * narrower and still worth having: every call that goes through Shotoku is
 * attributed to a named agent, and an agent cannot rename itself through the
 * protocol.
 */

/** Recorded when a client announces no usable name. */
export const UNKNOWN_ACTOR = "unregistered";

const MAX_ACTOR_LENGTH = 64;

/** "Claude Code" -> "claude-code". Keeps ledger actors readable and greppable. */
export function slugifyClientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ACTOR_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * `SHOTOKU_MCP_ACTOR` wins so an operator can name a server explicitly — one
 * entry per agent in the client config. Otherwise the client's announced name
 * is used, which covers the common case with no configuration at all.
 */
export function resolveActor(clientName: string | undefined): string {
  const override = process.env["SHOTOKU_MCP_ACTOR"]?.trim();
  if (override) return override;

  const slug = clientName ? slugifyClientName(clientName) : "";
  return slug || UNKNOWN_ACTOR;
}
