/**
 * Shotoku enforcement-gateway demo — for screenshots / recordings.
 *
 *   node scripts/demo-gateway.mjs        (or: pnpm demo:gateway)
 *
 * Starts the gateway on a throwaway policy, then sends two agent requests THROUGH
 * it: one to an allowlisted service (forwarded) and one to a held service (blocked
 * before it leaves the machine). Prints a screenshot-ready session, then cleans up.
 * Nothing in your project is touched.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const GATEWAY_BIN = fileURLToPath(
  new URL("../gateway/dist/index.js", import.meta.url),
);
const PORT = 8791;

const dir = mkdtempSync(join(tmpdir(), "shotoku-gw-demo-"));
const policyPath = join(dir, "policy.yaml");
const ledgerPath = join(dir, "decisions.jsonl");

// A local "internal API" that the policy will allow.
const target = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok (real service response)");
});

function listen(server) {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server.address().port)),
  );
}

function waitForPort(port) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const attempt = () => {
      const sock = net.connect(port, "127.0.0.1");
      sock.on("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.on("error", () => {
        sock.destroy();
        if (++tries > 50) reject(new Error("gateway did not start"));
        else setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

function proxyGet(absoluteUrl) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        method: "GET",
        path: absoluteUrl,
        headers: { host: new URL(absoluteUrl).host },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const targetPort = await listen(target);
  writeFileSync(
    policyPath,
    `rules:\n  - resource: 127.0.0.1/*\n    verdict: approved\ndefaultVerdict: pending_approval\n`,
  );

  const gw = spawn("node", [GATEWAY_BIN], {
    env: {
      ...process.env,
      SHOTOKU_POLICY: policyPath,
      SHOTOKU_LEDGER: ledgerPath,
      SHOTOKU_GATEWAY_PORT: String(PORT),
      SHOTOKU_GATEWAY_ACTOR: "agent-007",
    },
    stdio: "ignore",
  });

  try {
    await waitForPort(PORT);

    console.log(
      "\n  Shotoku Gateway — every agent request routes through authorization first.",
    );
    console.log("  policy: allow the internal API, hold everything else.\n");

    const allowed = await proxyGet(`http://127.0.0.1:${targetPort}/health`);
    console.log("  agent → GET  internal-api/health                 (allowlisted)");
    console.log(`    ✓ ${allowed.status}  forwarded to the real service\n`);

    const blocked = await proxyGet("http://api.openai.com/v1/chat/completions");
    const b = JSON.parse(blocked.body);
    console.log(
      "  agent → GET  api.openai.com/v1/chat/completions   (not allowlisted)",
    );
    console.log(
      `    ✗ ${blocked.status}  BLOCKED by Shotoku — the request never left the machine`,
    );
    console.log(`       status:   ${b.status}`);
    console.log(`       decision: ${b.decisionId}`);
    console.log(`       reason:   ${b.summary}`);
    console.log(`       → ${b.hint}\n`);

    const entries = readFileSync(ledgerPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    console.log("  ledger (append-only, hash-chained):");
    for (const e of entries) {
      console.log(
        `    ${e.decisionId}  ${e.request.actor}  ${e.request.action}  ${e.request.resource}  →  ${e.response.status}`,
      );
    }
    console.log("");
  } finally {
    gw.kill();
    target.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
