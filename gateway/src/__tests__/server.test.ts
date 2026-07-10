import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGatewayServer } from "../server.js";
import type { GatewayConfig } from "../config.js";

let policyPath: string;
let ledgerPath: string;
const servers: http.Server[] = [];

function listen(server: http.Server): Promise<number> {
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as AddressInfo).port),
    );
  });
}

/** Make a forward-proxy GET request through the gateway to an absolute URL. */
function proxyGet(
  proxyPort: number,
  absoluteUrl: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: proxyPort,
        method: "GET",
        path: absoluteUrl,
        headers: { host: new URL(absoluteUrl).host },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "shotoku-gw-srv-"));
  policyPath = join(dir, "policy.yaml");
  ledgerPath = join(dir, "decisions.jsonl");
});

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) => new Promise<void>((resolve) => s.close(() => resolve())),
    ),
  );
});

function config(): GatewayConfig {
  return { policyPath, ledgerPath, port: 0, defaultActor: "gateway" };
}

describe("gateway server", () => {
  it("forwards an approved request to the target and streams the response", async () => {
    const target = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("hello from target");
    });
    const targetPort = await listen(target);

    await writeFile(policyPath, `rules:\n  - resource: 127.0.0.1/*\n    verdict: approved\n`);
    const gatewayPort = await listen(createGatewayServer(config()));

    const result = await proxyGet(
      gatewayPort,
      `http://127.0.0.1:${targetPort}/data`,
    );

    expect(result.status).toBe(200);
    expect(result.body).toBe("hello from target");
  });

  it("refuses a blocked request with 403 and never reaches the target", async () => {
    let targetHits = 0;
    const target = http.createServer((_req, res) => {
      targetHits += 1;
      res.end("should not happen");
    });
    const targetPort = await listen(target);

    await writeFile(policyPath, `rules:\n  - resource: 127.0.0.1/*\n    verdict: denied\n`);
    const gatewayPort = await listen(createGatewayServer(config()));

    const result = await proxyGet(
      gatewayPort,
      `http://127.0.0.1:${targetPort}/data`,
    );

    expect(result.status).toBe(403);
    expect(result.body).toContain("blocked_by_shotoku");
    expect(targetHits).toBe(0);
  });
});
