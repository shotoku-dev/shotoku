#!/usr/bin/env node
import { createGatewayServer } from "./server.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const server = createGatewayServer(config);

server.listen(config.port, () => {
  process.stdout.write(
    `Shotoku gateway listening on http://localhost:${config.port}\n` +
      `  policy: ${config.policyPath}\n` +
      `  ledger: ${config.ledgerPath}\n` +
      `  Point your agent's HTTP_PROXY / HTTPS_PROXY at http://localhost:${config.port}\n` +
      `  Every request is authorized before it leaves this machine.\n`,
  );
});
