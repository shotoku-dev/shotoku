import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendDecision, approve, readApprovals, type LedgerEntry } from "@shotoku/core";
import { startDashboard, type Dashboard } from "../ui/server.js";

const TOKEN = "a".repeat(64);

function pending(decisionId: string): LedgerEntry {
  const timestamp = new Date().toISOString();
  return {
    decisionId,
    timestamp,
    request: { actor: "support-agent", action: "mcp_tool", resource: "paypal__create_refund", amount: 480 },
    response: {
      approved: false,
      status: "pending_approval",
      reasons: [{ type: "escalated", text: "Amount $480 exceeds per-transaction limit of $100" }],
      explanation: { summary: "Amount $480 exceeds per-transaction limit of $100" },
      decisionId,
      timestamp,
    },
  };
}

interface Reply {
  readonly status: number;
  readonly headers: http.IncomingHttpHeaders;
  readonly body: string;
}

/** node:http rather than fetch, because fetch will not let a test set Host. */
function request(
  dashboard: Dashboard,
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: dashboard.port,
        path,
        method: options.method ?? "GET",
        headers: { Host: `127.0.0.1:${dashboard.port}`, ...options.headers },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const auth = { Authorization: `Bearer ${TOKEN}` };
const origin = (d: Dashboard) => ({ Origin: `http://127.0.0.1:${d.port}` });

let dashboard: Dashboard;
let ledgerPath: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "shotoku-ui-test-"));
  ledgerPath = join(dir, "decisions.jsonl");
  const policyPath = join(dir, "policy.yaml");
  await writeFile(policyPath, "rules:\n  - resource: paypal__create_refund\n    verdict: approved\n    maxAmount: 100\n");
  await appendDecision(pending("dec_held"), ledgerPath);
  dashboard = await startDashboard({ ledgerPath, policyPath, port: 0, token: TOKEN });
});

afterEach(async () => {
  await dashboard.close();
});

describe("dashboard server — where it listens", () => {
  it("listens on the loopback address only", () => {
    expect(dashboard.address).toBe("127.0.0.1");
    expect(dashboard.url).toBe(`http://127.0.0.1:${dashboard.port}/`);
  });

  it("refuses a request for another host name, so a rebound DNS name cannot reach it", async () => {
    const reply = await request(dashboard, "/api/state", {
      headers: { ...auth, Host: "evil.example:80" },
    });

    expect(reply.status).toBe(403);
  });
});

describe("dashboard server — the page", () => {
  it("serves the page without a token, since it holds no data", async () => {
    const reply = await request(dashboard, "/");

    expect(reply.status).toBe(200);
    expect(reply.headers["content-type"]).toMatch(/text\/html/);
    expect(reply.body).toContain("<title>");
  });

  it("locks the page down: own scripts only, no framing, no referrer", async () => {
    const reply = await request(dashboard, "/");

    expect(reply.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(reply.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(reply.headers["referrer-policy"]).toBe("no-referrer");
    expect(reply.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("serves AG Grid from the installed package, not a CDN", async () => {
    const reply = await request(dashboard, "/vendor/ag-grid-community.min.js");

    expect(reply.status).toBe(200);
    expect(reply.headers["content-type"]).toMatch(/javascript/);
    expect(reply.body.length).toBeGreaterThan(100_000);
  });

  it("answers 404 for anything else", async () => {
    expect((await request(dashboard, "/../../etc/passwd")).status).toBe(404);
    expect((await request(dashboard, "/nope")).status).toBe(404);
  });
});

describe("dashboard server — the API", () => {
  it("refuses state without the session token", async () => {
    expect((await request(dashboard, "/api/state")).status).toBe(401);
    expect(
      (await request(dashboard, "/api/state", { headers: { Authorization: "Bearer wrong" } })).status,
    ).toBe(401);
  });

  it("returns state with the token, never cached", async () => {
    const reply = await request(dashboard, "/api/state", { headers: auth });

    expect(reply.status).toBe(200);
    expect(reply.headers["cache-control"]).toBe("no-store");
    const state = JSON.parse(reply.body) as { pending: { decisionId: string }[] };
    expect(state.pending.map((p) => p.decisionId)).toEqual(["dec_held"]);
  });

  it("approves with the token from the page's own origin, recorded as the dashboard", async () => {
    const reply = await request(dashboard, "/api/decisions/dec_held/approve", {
      method: "POST",
      headers: { ...auth, ...origin(dashboard) },
    });

    expect(reply.status).toBe(200);
    const approvals = await readApprovals(ledgerPath);
    expect(approvals[0]?.verdict).toBe("approved");
    expect(approvals[0]?.via).toBe("dashboard");
  });

  it("denies the same way", async () => {
    await request(dashboard, "/api/decisions/dec_held/deny", {
      method: "POST",
      headers: { ...auth, ...origin(dashboard) },
    });

    expect((await readApprovals(ledgerPath))[0]?.verdict).toBe("denied");
  });

  it("refuses a write from another origin, or with none", async () => {
    const foreign = await request(dashboard, "/api/decisions/dec_held/approve", {
      method: "POST",
      headers: { ...auth, Origin: "https://evil.example" },
    });
    const none = await request(dashboard, "/api/decisions/dec_held/approve", {
      method: "POST",
      headers: auth,
    });

    expect(foreign.status).toBe(403);
    expect(none.status).toBe(403);
    expect(await readApprovals(ledgerPath)).toEqual([]);
  });

  it("refuses a write without the token", async () => {
    const reply = await request(dashboard, "/api/decisions/dec_held/approve", {
      method: "POST",
      headers: origin(dashboard),
    });

    expect(reply.status).toBe(401);
    expect(await readApprovals(ledgerPath)).toEqual([]);
  });

  it("says why when the decision was already answered", async () => {
    await approve("dec_held", { ledgerPath });

    const reply = await request(dashboard, "/api/decisions/dec_held/deny", {
      method: "POST",
      headers: { ...auth, ...origin(dashboard) },
    });

    expect(reply.status).toBe(409);
    expect((JSON.parse(reply.body) as { error: string }).error).toMatch(/already approved/);
  });

  it("refuses a malformed decision ID", async () => {
    const reply = await request(dashboard, "/api/decisions/..%2Fx/approve", {
      method: "POST",
      headers: { ...auth, ...origin(dashboard) },
    });

    expect(reply.status).toBe(404);
  });
});
