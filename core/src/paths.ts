import { mkdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";
import { errorCode } from "./errors.js";

/**
 * One file, one name.
 *
 * The ledger lock is keyed on the path *string* — `${ledgerPath}.lock` — not on
 * the inode. Two spellings of the same file therefore produce two different
 * lockfiles and no mutual exclusion at all: concurrent writers each believe they
 * hold the lock, both compute the same chain position, and the hash chain breaks
 * permanently. Windows drive-letter casing (`C:\` vs `c:\`), a symlinked
 * directory, or a `..` segment are all enough to trigger it.
 *
 * Canonicalising every path at the edges is what makes cross-process
 * serialisation — and, with it, consuming a one-shot grant exactly once —
 * actually hold.
 */

/**
 * Resolves a path to a single canonical absolute form.
 *
 * `realpath` cannot be used directly: it throws ENOENT for a file that does not
 * exist yet, which is every first run. So the deepest *existing* ancestor is
 * canonicalised and the remaining segments are re-joined onto it. On Windows
 * this fixes the casing of every component that is already on disk; the final
 * segment's casing stays as written until the file exists, which is a residual
 * we accept — `ensureLedgerDir` creates the parent before any write, so by the
 * time two processes can contend, the directory is real and canonical.
 */
export async function canonicalizePath(path: string): Promise<string> {
  const absolute = isAbsolute(path) ? path : resolve(path);

  // Segments peeled off the end, deepest first, while walking up to something
  // that exists. `basename` is used rather than slicing so no separator
  // handling differs between platforms.
  const missing: string[] = [];
  let current = absolute;

  for (;;) {
    try {
      const real = await realpath(current);
      if (missing.length === 0) return real;
      return resolve(real, ...missing.slice().reverse());
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }

    const parent = dirname(current);
    // Walked all the way to the root without finding anything real.
    if (parent === current) return absolute;

    missing.push(basename(current));
    current = parent;
  }
}

/**
 * Canonicalises a ledger path, creating its directory first so the result is
 * stable from the very first call. Use this wherever a ledger path enters the
 * system from outside — config resolution, or a raw string handed to the SDK.
 */
export async function canonicalizeLedgerPath(ledgerPath: string): Promise<string> {
  const absolute = isAbsolute(ledgerPath) ? ledgerPath : resolve(ledgerPath);
  await mkdir(dirname(absolute), { recursive: true });
  return canonicalizePath(absolute);
}

/** True when two paths name the same file. Comparison is exact after canonicalising. */
export async function isSameLedger(a: string, b: string): Promise<boolean> {
  const [ca, cb] = await Promise.all([canonicalizePath(a), canonicalizePath(b)]);
  return ca === cb;
}

/** Exported for tests that need to reason about separators across platforms. */
export const PATH_SEPARATOR = sep;
