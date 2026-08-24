import { describe, it, expect } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse } from "yaml";
import { validatePolicy } from "../validation.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * The real door a policy file goes through: `authorize.ts` does
 * `validatePolicy(parse(raw))`. Tests that hand-build `Policy` objects in
 * TypeScript skip this, which is exactly how `actor` shipped as a documented
 * field that no policy file could actually use.
 */
function loadPolicyYaml(raw: string): ReturnType<typeof validatePolicy> {
  const parsed: unknown = parse(raw);
  // Docs show bare rule fragments as well as whole policies.
  return validatePolicy(
    Array.isArray(parsed) ? { rules: parsed } : parsed,
  );
}

function yamlBlocks(markdown: string): readonly string[] {
  // `\r?` so the docs parse the same on Windows checkouts as on CI.
  return [...markdown.matchAll(/```yaml\r?\n([\s\S]*?)```/g)].map((m) => m[1]!);
}

describe("validatePolicy — the documented rule fields all work", () => {
  it("accepts every field listed in the rule-fields table", () => {
    const policy = loadPolicyYaml(`
rules:
  - resource: openai.com
    actor: team-*
    actions: [api_call]
    rails: [api]
    verdict: approved
    maxAmount: 50
    maxDailyAmount: 200
`);

    expect(policy.rules).toHaveLength(1);
    expect(policy.rules[0]!.actor).toBe("team-*");
    expect(policy.rules[0]!.actions).toEqual(["api_call"]);
    expect(policy.rules[0]!.rails).toEqual(["api"]);
  });

  it("carries actor through to the parsed rule", () => {
    const policy = loadPolicyYaml(
      "rules:\n  - resource: '*'\n    actor: billing-agent\n    verdict: approved\n",
    );

    expect(policy.rules[0]!.actor).toBe("billing-agent");
  });

  it("omits actor when the rule does not set it", () => {
    const policy = loadPolicyYaml(
      "rules:\n  - resource: openai.com\n    verdict: approved\n",
    );

    expect(policy.rules[0]!.actor).toBeUndefined();
  });

  it("rejects an empty actor", () => {
    expect(() =>
      loadPolicyYaml("rules:\n  - resource: '*'\n    actor: ''\n    verdict: approved\n"),
    ).toThrow(/actor must be a non-empty string/);
  });

  it("rejects a non-string actor", () => {
    expect(() =>
      loadPolicyYaml("rules:\n  - resource: '*'\n    actor: 42\n    verdict: approved\n"),
    ).toThrow(/actor must be a non-empty string/);
  });

  it("rejects an over-long actor pattern", () => {
    const long = "a".repeat(257);
    expect(() =>
      loadPolicyYaml(
        `rules:\n  - resource: '*'\n    actor: ${long}\n    verdict: approved\n`,
      ),
    ).toThrow(/at most 256 characters/);
  });

  it("still rejects a misspelled field", () => {
    expect(() =>
      loadPolicyYaml(
        "rules:\n  - resource: openai.com\n    verdict: approved\n    maxAmonut: 50\n",
      ),
    ).toThrow(/unknown field "maxAmonut"/);
  });

  it("still rejects a misspelled actor field", () => {
    expect(() =>
      loadPolicyYaml(
        "rules:\n  - resource: openai.com\n    actorr: bot\n    verdict: approved\n",
      ),
    ).toThrow(/unknown field "actorr"/);
  });
});

/**
 * Documentation drift is what produced the bug above: `docs/guides/policies.md`
 * documented `actor:` for months while `validatePolicy` rejected it outright.
 * Every YAML block we publish is parsed here, so the docs cannot drift again
 * without turning CI red.
 */
describe("validatePolicy — published examples are executable", () => {
  it("accepts every YAML block in docs/guides/policies.md", async () => {
    const markdown = await readFile(
      join(repoRoot, "docs/guides/policies.md"),
      "utf8",
    );
    const blocks = yamlBlocks(markdown);

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(() => loadPolicyYaml(block), `block:\n${block}`).not.toThrow();
    }
  });

  /**
   * The website restates the docs by hand rather than rendering them, so it
   * drifts independently. It had been teaching a policy format that does not
   * exist -- `allowlist`, `limits`, `per_request` -- which validatePolicy
   * rejects outright, so anyone following the quickstart had every request
   * denied with a message about an unknown field.
   */
  it("accepts every YAML block published on the website", async () => {
    const docsDir = join(repoRoot, "web/app/docs");
    const pages = await readdir(docsDir, { withFileTypes: true });
    let checked = 0;

    for (const entry of pages) {
      if (!entry.isDirectory()) continue;
      const file = join(docsDir, entry.name, "page.tsx");

      let source: string;
      try {
        source = await readFile(file, "utf8");
      } catch {
        continue;
      }

      for (const match of source.matchAll(/lang="yaml"[\s\S]{0,160}?code=\{`([\s\S]*?)`\}/g)) {
        const block = match[1]!;
        // Skip blocks that interpolate: they are illustrative, not literal.
        if (block.includes("${")) continue;
        checked += 1;
        expect(
          () => loadPolicyYaml(block),
          `${entry.name}/page.tsx:
${block}`,
        ).not.toThrow();
      }
    }

    expect(checked).toBeGreaterThan(0);
  });

  it("accepts every shipped example policy", async () => {
    const dir = join(repoRoot, "examples");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml"));

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = await readFile(join(dir, file), "utf8");
      expect(() => loadPolicyYaml(raw), file).not.toThrow();
    }
  });
});
