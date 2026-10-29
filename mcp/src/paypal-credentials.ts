import type { UpstreamServerConfig } from "./upstream.js";

/**
 * Credentials for a wrapped PayPal MCP server.
 *
 * `@paypal/mcp` takes an access token, and a PayPal access token dies after
 * about nine hours, so a token pasted into a config file breaks the agent the
 * next day (or mid-demo). Given `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`
 * instead, Shotoku mints a fresh token each time it starts and hands the
 * upstream only that token: the client secret, which can mint more, never
 * reaches the upstream process. The pricer then reads the same token from the
 * prepared env, so its lookups see the same account.
 *
 * Shotoku keeps nothing: the credentials stay in the user's config file, the
 * token lives in memory for the life of the process.
 */

export interface PreparedUpstream {
  readonly config: UpstreamServerConfig;
  /** Seconds until the minted token expires, when one was minted. */
  readonly expiresInSeconds?: number;
  /** Something the user should know, for stderr. */
  readonly warning?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function preparePayPalUpstream(
  config: UpstreamServerConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PreparedUpstream> {
  if (config.pricing !== "paypal") return { config };

  const env = config.env ?? {};
  if (env["PAYPAL_ACCESS_TOKEN"]) return { config };

  const clientId = env["PAYPAL_CLIENT_ID"];
  const clientSecret = env["PAYPAL_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    return {
      config,
      warning:
        `server "${config.name}": no PayPal credentials in its env. Set PAYPAL_CLIENT_ID and ` +
        "PAYPAL_CLIENT_SECRET (Shotoku mints the token), or PAYPAL_ACCESS_TOKEN.",
    };
  }

  const baseUrl =
    env["PAYPAL_ENVIRONMENT"]?.toLowerCase() === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // The underlying message can carry the request, and with it the secret.
    throw new Error(`server "${config.name}": Could not reach PayPal to get an access token.`);
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const description =
      isRecord(body) && typeof body["error_description"] === "string"
        ? body["error_description"]
        : `HTTP ${response.status}`;
    throw new Error(
      `server "${config.name}": PayPal refused PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET: ${description}. ` +
        "Check them under Apps & Credentials in the PayPal developer dashboard (Sandbox or Live, to match PAYPAL_ENVIRONMENT).",
    );
  }

  const token = isRecord(body) ? body["access_token"] : undefined;
  if (typeof token !== "string" || !token) {
    throw new Error(`server "${config.name}": PayPal answered with no access token.`);
  }

  const {
    PAYPAL_CLIENT_ID: _clientId,
    PAYPAL_CLIENT_SECRET: _clientSecret,
    ...rest
  } = env;
  const expiresIn = isRecord(body) && typeof body["expires_in"] === "number" ? body["expires_in"] : undefined;

  return {
    config: { ...config, env: { ...rest, PAYPAL_ACCESS_TOKEN: token } },
    ...(expiresIn !== undefined ? { expiresInSeconds: expiresIn } : {}),
  };
}

/**
 * Prepares every upstream before it is spawned. One that cannot be prepared
 * is dropped with a warning, like an upstream that fails to start: its tools
 * are not exposed, which is the safe direction to fail.
 */
export async function prepareUpstreams(
  configs: readonly UpstreamServerConfig[],
  warn: (message: string) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<UpstreamServerConfig[]> {
  const prepared: UpstreamServerConfig[] = [];
  for (const config of configs) {
    try {
      const result = await preparePayPalUpstream(config, fetchImpl);
      if (result.warning) warn(result.warning);
      if (result.expiresInSeconds !== undefined) {
        const hours = Math.floor(result.expiresInSeconds / 3600);
        warn(
          `server "${config.name}": minted a PayPal access token, valid for about ${hours}h. ` +
            "Restart the agent host after that to get a new one.",
        );
      }
      prepared.push(result.config);
    } catch (error) {
      warn(`${error instanceof Error ? error.message : String(error)} Its tools are not exposed.`);
    }
  }
  return prepared;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
