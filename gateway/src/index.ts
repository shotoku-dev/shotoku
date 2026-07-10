#!/usr/bin/env node
import { createGatewayServer } from "./server.js";
import { loadConfig } from "./config.js";
import { assertPolicyLoads } from "./startup.js";

const config = loadConfig();

// Fail closed at boot — refuse to start without a valid policy.
try {
  assertPolicyLoads(config.policyPath);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `Shotoku gateway refused to start.\n` +
      `  ${message}\n` +
      `  Fix the policy (or set SHOTOKU_POLICY) and try again.\n`,
  );
  process.exit(1);
}

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
