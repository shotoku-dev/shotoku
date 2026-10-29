import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { parse } from "yaml";
import {
  approve,
  deny,
  getLedgerIntegrity,
  getLedgerSnapshot,
  readApprovals,
  readDecisions,
  toUserSafeMessage,
  validatePolicy,
  type Policy,
} from "@shotoku/core";
import { buildDashboardState, type DashboardState, type IntegrityState } from "./state.js";

/**
 * The local dashboard behind `shotoku ui`.
 *
 * It can approve spending, so it is locked to the person at the keyboard:
 *
 * - It listens on 127.0.0.1 only, never on the network.
 * - Every request must name 127.0.0.1 or localhost in its Host header, so a
 *   web page that rebinds its own domain to 127.0.0.1 cannot reach it.
 * - Every API call needs the session token, which is printed in the terminal
 *   that started the server and is in no file.
 * - Writes also need an Origin of the dashboard itself, so another site
 *   cannot submit a form at it even if it guessed the port.
 *
 * None of this stops a process running as the same user that can read that
 * terminal. Approving from another device (`shotoku telegram`) is the stronger
 * separation; this is the convenient one.
 */

export interface DashboardOptions {
  readonly ledgerPath: string;
  readonly policyPath: string;
  /** 0 picks a free port. */
  readonly port: number;
  readonly token: string;
}

export interface Dashboard {
  readonly address: string;
  readonly port: number;
  /** The page, without the token. */
  readonly url: string;
  close(): Promise<void>;
}

const HOST = "127.0.0.1";
const ASSETS = fileURLToPath(new URL("../../assets/ui/", import.meta.url));
const DECISION_PATH = /^\/api\/decisions\/(dec_[a-z0-9]{1,40})\/(approve|deny)$/;

// AG Grid's package exports do not include its browser bundle, so it is found
// next to the entry point the package does export.
const require = createRequire(import.meta.url);
const AG_GRID_BUNDLE = join(dirname(require.resolve("ag-grid-community")), "..", "ag-grid-community.min.js");

const STATIC: Readonly<Record<string, { readonly file: string; readonly type: string }>> = {
  "/": { file: join(ASSETS, "index.html"), type: "text/html; charset=utf-8" },
  "/app.js": { file: join(ASSETS, "app.js"), type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: join(ASSETS, "styles.css"), type: "text/css; charset=utf-8" },
  "/vendor/ag-grid-community.min.js": { file: AG_GRID_BUNDLE, type: "text/javascript; charset=utf-8" },
};

const SECURITY_HEADERS = {
  // AG Grid's theming writes its styles into <style> tags at runtime, hence
  // 'unsafe-inline' for styles. Scripts are this server's files only.
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    "connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function startDashboard(options: DashboardOptions): Promise<Dashboard> {
  const expectedToken = Buffer.from(`Bearer ${options.token}`);
  let port = options.port;

  const allowedHosts = () => new Set([`${HOST}:${port}`, `localhost:${port}`]);
  const allowedOrigins = () => new Set([`http://${HOST}:${port}`, `http://localhost:${port}`]);

  function hasToken(req: IncomingMessage): boolean {
    const given = Buffer.from(req.headers.authorization ?? "");
    return given.length === expectedToken.length && timingSafeEqual(given, expectedToken);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!allowedHosts().has(req.headers.host ?? "")) {
      return send(res, 403, { error: "Unknown host." });
    }

    const path = new URL(req.url ?? "/", `http://${HOST}`).pathname;

    if (req.method === "GET" && Object.hasOwn(STATIC, path)) {
      const asset = STATIC[path]!;
      res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": asset.type, "Cache-Control": "no-cache" });
      res.end(await readFile(asset.file));
      return;
    }

    if (req.method === "GET" && path === "/api/state") {
      if (!hasToken(req)) return send(res, 401, { error: "Missing or wrong session token." });
      return send(res, 200, await loadState(options));
    }

    const write = req.method === "POST" ? DECISION_PATH.exec(path) : null;
    if (write) {
      if (!hasToken(req)) return send(res, 401, { error: "Missing or wrong session token." });
      if (!allowedOrigins().has(req.headers.origin ?? "")) {
        return send(res, 403, { error: "Writes are only accepted from the dashboard page." });
      }
      const [, decisionId, verb] = write;
      try {
        const resolve = verb === "approve" ? approve : deny;
        const approval = await resolve(decisionId!, { ledgerPath: options.ledgerPath, via: "dashboard" });
        return send(res, 200, { approval });
      } catch (error) {
        return send(res, 409, { error: toUserSafeMessage(error) });
      }
    }

    send(res, 404, { error: "Not found." });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (!res.headersSent) send(res, 500, { error: toUserSafeMessage(error) });
      else res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, HOST, () => resolve());
  });
  const address = server.address();
  port = typeof address === "object" && address ? address.port : options.port;

  return {
    address: HOST,
    port,
    url: `http://${HOST}:${port}/`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

/** Reads everything fresh on each call: the ledger is the only state. */
async function loadState(options: DashboardOptions): Promise<DashboardState> {
  const [decisions, approvals, snapshot, integrity, policy] = await Promise.all([
    readDecisions(options.ledgerPath),
    readApprovals(options.ledgerPath),
    getLedgerSnapshot(options.ledgerPath),
    loadIntegrity(options.ledgerPath),
    loadPolicy(options.policyPath),
  ]);

  return buildDashboardState({
    decisions,
    approvals,
    snapshot,
    integrity,
    now: new Date(),
    ...("policy" in policy ? { policy: policy.policy } : { policyError: policy.error }),
  });
}

async function loadIntegrity(ledgerPath: string): Promise<IntegrityState> {
  try {
    return { ok: true, records: (await getLedgerIntegrity(ledgerPath)).recordCount };
  } catch (error) {
    return { ok: false, message: toUserSafeMessage(error) };
  }
}

async function loadPolicy(
  policyPath: string,
): Promise<{ readonly policy: Policy } | { readonly error: string }> {
  try {
    return { policy: validatePolicy(parse(await readFile(policyPath, "utf8"))) };
  } catch (error) {
    return { error: toUserSafeMessage(error) };
  }
}
