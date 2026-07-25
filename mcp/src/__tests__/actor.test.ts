import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveActor, slugifyClientName, UNKNOWN_ACTOR } from "../actor.js";
import { tools } from "../tools.js";

let previous: string | undefined;

beforeEach(() => {
  previous = process.env["SHOTOKU_MCP_ACTOR"];
  delete process.env["SHOTOKU_MCP_ACTOR"];
});

afterEach(() => {
  if (previous === undefined) {
    delete process.env["SHOTOKU_MCP_ACTOR"];
  } else {
    process.env["SHOTOKU_MCP_ACTOR"] = previous;
  }
});

describe("slugifyClientName", () => {
  it.each([
    ["Claude Code", "claude-code"],
    ["claude-ai", "claude-ai"],
    ["Cursor (VS Code)", "cursor-vs-code"],
    ["  spaced  out  ", "spaced-out"],
    ["!!!", ""],
  ])("%s -> %s", (input, expected) => {
    expect(slugifyClientName(input)).toBe(expected);
  });

  it("caps the length without leaving a trailing separator", () => {
    const slug = slugifyClientName(`${"a".repeat(63)} tail`);
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("resolveActor", () => {
  it("uses the client's announced name", () => {
    expect(resolveActor("Claude Desktop")).toBe("claude-desktop");
  });

  it("falls back when the client announces nothing usable", () => {
    expect(resolveActor(undefined)).toBe(UNKNOWN_ACTOR);
    expect(resolveActor("")).toBe(UNKNOWN_ACTOR);
    expect(resolveActor("???")).toBe(UNKNOWN_ACTOR);
  });

  it("lets an operator override the announced name", () => {
    process.env["SHOTOKU_MCP_ACTOR"] = "billing-agent";
    expect(resolveActor("Claude Desktop")).toBe("billing-agent");
  });

  it("ignores a blank override", () => {
    process.env["SHOTOKU_MCP_ACTOR"] = "   ";
    expect(resolveActor("Claude Desktop")).toBe("claude-desktop");
  });
});

describe("authorize_action schema", () => {
  /**
   * An agent that names itself is not an identity. The server knows who
   * connected; the model must not get a say.
   */
  it("does not let the caller supply an actor", () => {
    const tool = tools.find((t) => t.name === "authorize_action");
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).not.toHaveProperty("actor");
    expect(tool!.inputSchema["required"]).not.toContain("actor");
  });
});
