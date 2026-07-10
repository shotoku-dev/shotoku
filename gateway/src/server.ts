import http from "node:http";
import net from "node:net";
import {
  authorizeHttpRequest,
  type GatewayDecision,
} from "./authorize-request.js";
import type { GatewayConfig } from "./config.js";

function actorFrom(
  headers: http.IncomingHttpHeaders,
  defaultActor: string,
): string {
  const header = headers["x-shotoku-actor"];
  return typeof header === "string" && header.length > 0 ? header : defaultActor;
}

/** JSON body returned to the agent when Shotoku refuses a request. */
function blockedBody(decision: GatewayDecision): string {
  return `${JSON.stringify(
    {
      error: "blocked_by_shotoku",
      status: decision.status,
      decisionId: decision.decisionId,
      summary: decision.explanation.summary,
      ...(decision.explanation.hint ? { hint: decision.explanation.hint } : {}),
      reasons: decision.reasons,
    },
    null,
    2,
  )}\n`;
}

/** Resolve the target host/path of a forward-proxy request. */
function resolveTarget(
  req: http.IncomingMessage,
): { host: string; port: number; path: string } | null {
  const raw = req.url ?? "";
  // Forward proxies receive an absolute URL (e.g. http://api.openai.com/v1/x).
  try {
    const url = raw.startsWith("http")
      ? new URL(raw)
      : new URL(`http://${req.headers.host ?? ""}${raw}`);
    if (!url.hostname) return null;
    return {
      host: url.hostname,
      port: url.port ? Number.parseInt(url.port, 10) : 80,
      path: `${url.pathname}${url.search}`,
    };
  } catch {
    return null;
  }
}

/** Handle a plain-HTTP proxied request: authorize, then forward or refuse. */
async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: GatewayConfig,
): Promise<void> {
  const target = resolveTarget(req);
  if (!target) {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("Malformed proxy request: no target host.\n");
    return;
  }

  const decision = await authorizeHttpRequest(
    {
      method: req.method ?? "GET",
      host: target.host,
      path: target.path || "/",
      actor: actorFrom(req.headers, config.defaultActor),
    },
    { policyPath: config.policyPath, ledgerPath: config.ledgerPath },
  );

  if (decision.outcome === "block") {
    res.writeHead(403, {
      "content-type": "application/json",
      "x-shotoku-decision": decision.decisionId,
      "x-shotoku-status": decision.status,
    });
    res.end(blockedBody(decision));
    return;
  }

  // Approved → forward to the real target and stream the response back.
  const headers = { ...req.headers };
  delete headers["x-shotoku-actor"];
  delete headers["proxy-connection"];

  const proxyReq = http.request(
    {
      host: target.host,
      port: target.port,
      method: req.method,
      path: target.path || "/",
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`Gateway could not reach ${target.host}: ${err.message}\n`);
  });

  req.pipe(proxyReq);
}

/** Handle a CONNECT (HTTPS) tunnel: authorize the host, then tunnel or refuse. */
async function handleConnect(
  req: http.IncomingMessage,
  clientSocket: net.Socket,
  head: Buffer,
  config: GatewayConfig,
): Promise<void> {
  const [host, portRaw] = (req.url ?? "").split(":");
  const port = portRaw ? Number.parseInt(portRaw, 10) : 443;
  if (!host) {
    clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }

  // HTTPS is encrypted end-to-end, so we can only authorize at the host level
  // (no path). The tunnel, once open, is not inspected.
  const decision = await authorizeHttpRequest(
    {
      method: "CONNECT",
      host,
      path: "/",
      actor: actorFrom(req.headers, config.defaultActor),
    },
    { policyPath: config.policyPath, ledgerPath: config.ledgerPath },
  );

  if (decision.outcome === "block") {
    clientSocket.end(
      `HTTP/1.1 403 Forbidden\r\nx-shotoku-decision: ${decision.decisionId}\r\n\r\n`,
    );
    return;
  }

  const serverSocket = net.connect(port, host, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => serverSocket.destroy());
}

/**
 * Create the Shotoku enforcement gateway: a local forward proxy that routes
 * every agent request through `authorize()` before it leaves the machine.
 * Approved → forwarded; denied/pending → refused with a `403` and the decision
 * ID. The agent cannot bypass a denial, because it never reaches the network.
 */
export function createGatewayServer(config: GatewayConfig): http.Server {
  const server = http.createServer((req, res) => {
    void handleRequest(req, res, config).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/plain" });
      }
      res.end("Gateway internal error.\n");
    });
  });

  server.on("connect", (req, socket, head) => {
    void handleConnect(req, socket as net.Socket, head, config).catch(() => {
      (socket as net.Socket).destroy();
    });
  });

  return server;
}
