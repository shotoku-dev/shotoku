import { describe, it, expect } from "vitest";
import { parseUpstreamConfigs } from "../upstream.js";

/**
 * The upstreams file is the one thing a new user writes by hand, so it is the
 * one most likely to be wrong. It used to fail in two unhelpful ways: a stray
 * comma threw before the server could answer its host, which the host reports
 * only as "server failed to start"; and every other mistake was skipped in
 * silence, leaving "wrapping is on but empty" indistinguishable from
 * "wrapping is off".
 */
describe("parseUpstreamConfigs", () => {
  it("reads a host-shaped config", () => {
    const result = parseUpstreamConfigs(
      JSON.stringify({
        mcpServers: {
          obsidian: { command: "obsidian-mcp", args: ["--vault", "/notes"] },
          reddit: { command: "npx", args: ["-y", "reddit-mcp-buddy"] },
        },
      }),
    );

    expect(result.problems).toEqual([]);
    expect(result.configs.map((c) => c.name)).toEqual(["obsidian", "reddit"]);
    expect(result.configs[0]!.args).toEqual(["--vault", "/notes"]);
  });

  it("keeps env for servers that need credentials", () => {
    const result = parseUpstreamConfigs(
      JSON.stringify({
        mcpServers: { obsidian: { command: "x", env: { KEY: "secret" } } },
      }),
    );

    expect(result.configs[0]!.env).toEqual({ KEY: "secret" });
  });

  it("names the syntax error instead of throwing", () => {
    const result = parseUpstreamConfigs('{ "mcpServers": { "a": {} }, }');

    expect(result.configs).toEqual([]);
    expect(result.problems[0]).toMatch(/not valid JSON/);
  });

  it("says so when the shape is wrong", () => {
    const result = parseUpstreamConfigs(JSON.stringify({ servers: {} }));

    expect(result.problems[0]).toMatch(/mcpServers/);
  });

  it("names the server that is missing a command", () => {
    const result = parseUpstreamConfigs(
      JSON.stringify({ mcpServers: { broken: { args: ["x"] }, fine: { command: "y" } } }),
    );

    expect(result.configs.map((c) => c.name)).toEqual(["fine"]);
    expect(result.problems[0]).toMatch(/"broken".*command/);
  });

  it("distinguishes an empty list from a broken one", () => {
    const result = parseUpstreamConfigs(JSON.stringify({ mcpServers: {} }));

    expect(result.configs).toEqual([]);
    expect(result.problems[0]).toMatch(/empty/);
  });

  it("does not throw on anything", () => {
    for (const raw of ["", "null", "[]", "42", '"text"', "{}"]) {
      expect(() => parseUpstreamConfigs(raw), raw).not.toThrow();
    }
  });
});
