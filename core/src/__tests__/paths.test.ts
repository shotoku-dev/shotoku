import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join, resolve, sep } from "node:path";
import { canonicalizePath, canonicalizeLedgerPath, isSameLedger } from "../paths.js";
import { authorize } from "../authorize.js";
import { getLedgerIntegrity, readDecisions } from "../ledger.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "shotoku-paths-test-"));
});

describe("canonicalizePath", () => {
  it("returns an absolute path for a relative one", async () => {
    const result = await canonicalizePath("data/decisions.jsonl");
    expect(result).toBe(await canonicalizePath(resolve("data/decisions.jsonl")));
  });

  it("collapses .. segments", async () => {
    const nested = join(dir, "a", "b");
    await mkdir(nested, { recursive: true });

    const direct = await canonicalizePath(join(dir, "a", "ledger.jsonl"));
    // Built by concatenation: join() would normalise the ".." away, and the
    // point is to feed canonicalizePath two genuinely different strings.
    const roundabout = await canonicalizePath(`${nested}${sep}..${sep}ledger.jsonl`);

    expect(roundabout).toBe(direct);
  });

  /**
   * The first run is always this case: the ledger file does not exist yet, so a
   * bare realpath would throw ENOENT.
   */
  it("canonicalizes a file that does not exist yet", async () => {
    const missing = join(dir, "does", "not", "exist.jsonl");
    await expect(canonicalizePath(missing)).resolves.toBeTruthy();
  });

  it("agrees before and after the file is created", async () => {
    const path = join(dir, "later.jsonl");
    const before = await canonicalizePath(path);
    await writeFile(path, "", "utf8");
    const after = await canonicalizePath(path);

    expect(after).toBe(before);
  });
});

describe("isSameLedger", () => {
  it.runIf(platform() === "win32")(
    "sees through drive-letter casing on Windows",
    async () => {
      const path = join(dir, "d.jsonl");
      const swapped = path[0] === path[0]!.toUpperCase()
        ? path[0]!.toLowerCase() + path.slice(1)
        : path[0]!.toUpperCase() + path.slice(1);

      expect(await isSameLedger(path, swapped)).toBe(true);
    },
  );

  it.runIf(platform() !== "win32")(
    "sees through a symlinked directory on POSIX",
    async () => {
      const real = join(dir, "real");
      await mkdir(real, { recursive: true });
      const link = join(dir, "link");
      await symlink(real, link, "dir");

      expect(
        await isSameLedger(join(real, "d.jsonl"), join(link, "d.jsonl")),
      ).toBe(true);
    },
  );

  it("does not conflate two genuinely different files", async () => {
    expect(await isSameLedger(join(dir, "a.jsonl"), join(dir, "b.jsonl"))).toBe(false);
  });
});

/**
 * The lock is keyed on `${ledgerPath}.lock`. Before canonicalisation, two
 * spellings of one file produced two lockfiles and no mutual exclusion: both
 * writers computed the same chain position and the hash chain broke for good.
 * This is the property that consuming a one-shot grant exactly once will rest on.
 */
describe("concurrent writers using different spellings of one path", () => {
  it("still serialise", async () => {
    const policyPath = join(dir, "policy.yaml");
    await writeFile(
      policyPath,
      "rules:\n  - resource: openai.com\n    verdict: approved\n",
      "utf8",
    );

    const nested = join(dir, "nested");
    await mkdir(nested, { recursive: true });

    const plain = join(dir, "decisions.jsonl");
    const roundabout = `${nested}${sep}..${sep}decisions.jsonl`;
    expect(plain).not.toBe(roundabout);
    expect(await isSameLedger(plain, roundabout)).toBe(true);

    await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        authorize(
          {
            actor: `agent-${n}`,
            action: "api_call",
            resource: "openai.com",
            amount: 1,
          },
          { policyPath, ledgerPath: n % 2 === 0 ? plain : roundabout },
        ),
      ),
    );

    const report = await getLedgerIntegrity(plain);
    expect(report.recordCount).toBe(20);
    expect(await readDecisions(plain)).toHaveLength(20);
  }, 20_000);
});

describe("canonicalizeLedgerPath", () => {
  it("creates the parent directory so the result is stable immediately", async () => {
    const path = join(dir, "fresh", "data", "decisions.jsonl");
    const first = await canonicalizeLedgerPath(path);
    const second = await canonicalizeLedgerPath(path);

    expect(second).toBe(first);
  });
});
