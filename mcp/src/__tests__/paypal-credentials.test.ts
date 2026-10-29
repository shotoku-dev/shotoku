import { describe, it, expect } from "vitest";
import { preparePayPalUpstream, prepareUpstreams } from "../paypal-credentials.js";
import type { UpstreamServerConfig } from "../upstream.js";

const SECRET = "client-secret-DO-NOT-LEAK";

interface Captured {
  readonly url: string;
  readonly authorization: string | null;
  readonly body: string;
}

function fakeFetch(reply: { status?: number; body: unknown }) {
  const calls: Captured[] = [];
  const fetchImpl = async (...[input, init]: Parameters<typeof fetch>) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      authorization: headers.get("authorization"),
      body: String(init?.body ?? ""),
    });
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

function paypal(env: Record<string, string>): UpstreamServerConfig {
  return {
    name: "paypal",
    command: "npx",
    args: ["-y", "@paypal/mcp", "--tools=all"],
    pricing: "paypal",
    env,
  };
}

const TOKEN_REPLY = { body: { access_token: "A21.minted", token_type: "Bearer", expires_in: 32400 } };

describe("preparePayPalUpstream", () => {
  it("mints an access token from client credentials, on the sandbox by default", async () => {
    const { fetchImpl, calls } = fakeFetch(TOKEN_REPLY);

    const prepared = await preparePayPalUpstream(
      paypal({ PAYPAL_CLIENT_ID: "client-id", PAYPAL_CLIENT_SECRET: SECRET, PAYPAL_ENVIRONMENT: "SANDBOX" }),
      fetchImpl,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(calls[0]?.authorization).toBe(
      `Basic ${Buffer.from(`client-id:${SECRET}`).toString("base64")}`,
    );
    expect(calls[0]?.body).toBe("grant_type=client_credentials");
    expect(prepared.config.env?.["PAYPAL_ACCESS_TOKEN"]).toBe("A21.minted");
    expect(prepared.config.env?.["PAYPAL_ENVIRONMENT"]).toBe("SANDBOX");
    expect(prepared.expiresInSeconds).toBe(32400);
  });

  it("does not hand the client secret to the upstream process", async () => {
    const { fetchImpl } = fakeFetch(TOKEN_REPLY);

    const prepared = await preparePayPalUpstream(
      paypal({ PAYPAL_CLIENT_ID: "client-id", PAYPAL_CLIENT_SECRET: SECRET }),
      fetchImpl,
    );

    expect(prepared.config.env).not.toHaveProperty("PAYPAL_CLIENT_SECRET");
    expect(prepared.config.env).not.toHaveProperty("PAYPAL_CLIENT_ID");
  });

  it("uses the live API for PRODUCTION", async () => {
    const { fetchImpl, calls } = fakeFetch(TOKEN_REPLY);

    await preparePayPalUpstream(
      paypal({ PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET, PAYPAL_ENVIRONMENT: "PRODUCTION" }),
      fetchImpl,
    );

    expect(calls[0]?.url).toBe("https://api-m.paypal.com/v1/oauth2/token");
  });

  it("leaves an explicit access token alone", async () => {
    const { fetchImpl, calls } = fakeFetch(TOKEN_REPLY);
    const config = paypal({ PAYPAL_ACCESS_TOKEN: "given", PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET });

    const prepared = await preparePayPalUpstream(config, fetchImpl);

    expect(prepared.config).toBe(config);
    expect(calls).toEqual([]);
  });

  it("leaves servers that are not PayPal alone", async () => {
    const { fetchImpl, calls } = fakeFetch(TOKEN_REPLY);
    const config: UpstreamServerConfig = {
      name: "github",
      command: "x",
      env: { PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET },
    };

    expect((await preparePayPalUpstream(config, fetchImpl)).config).toBe(config);
    expect(calls).toEqual([]);
  });

  it("leaves a PayPal server without credentials alone, with a warning", async () => {
    const { fetchImpl, calls } = fakeFetch(TOKEN_REPLY);
    const config = paypal({ PAYPAL_ENVIRONMENT: "SANDBOX" });

    const prepared = await preparePayPalUpstream(config, fetchImpl);

    expect(prepared.config).toBe(config);
    expect(prepared.warning).toMatch(/PAYPAL_CLIENT_ID/);
    expect(calls).toEqual([]);
  });

  it("explains rejected credentials without repeating the secret", async () => {
    const { fetchImpl } = fakeFetch({
      status: 401,
      body: { error: "invalid_client", error_description: "Client Authentication failed" },
    });

    const error = await preparePayPalUpstream(
      paypal({ PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET }),
      fetchImpl,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/PAYPAL_CLIENT_ID/);
    expect((error as Error).message).toContain("Client Authentication failed");
    expect((error as Error).message).not.toContain(SECRET);
  });

  it("explains a network failure without repeating the secret", async () => {
    const failing = (async () => {
      throw new Error(`fetch failed for id:${SECRET}`);
    }) as typeof fetch;

    const error = await preparePayPalUpstream(
      paypal({ PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET }),
      failing,
    ).catch((e: unknown) => e);

    expect((error as Error).message).toMatch(/Could not reach PayPal/);
    expect((error as Error).message).not.toContain(SECRET);
  });

  it("refuses a reply with no token in it", async () => {
    const { fetchImpl } = fakeFetch({ body: { token_type: "Bearer" } });

    await expect(
      preparePayPalUpstream(paypal({ PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET }), fetchImpl),
    ).rejects.toThrow(/no access token/);
  });
});

describe("prepareUpstreams", () => {
  it("drops an upstream whose credentials fail, and says so", async () => {
    const { fetchImpl } = fakeFetch({ status: 401, body: { error_description: "Client Authentication failed" } });
    const warnings: string[] = [];
    const other: UpstreamServerConfig = { name: "github", command: "x" };

    const prepared = await prepareUpstreams(
      [paypal({ PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET }), other],
      (m) => warnings.push(m),
      fetchImpl,
    );

    expect(prepared).toEqual([other]);
    expect(warnings.join("\n")).toMatch(/tools are not exposed/);
    expect(warnings.join("\n")).not.toContain(SECRET);
  });

  it("says how long a minted token lasts", async () => {
    const { fetchImpl } = fakeFetch(TOKEN_REPLY);
    const warnings: string[] = [];

    const prepared = await prepareUpstreams(
      [paypal({ PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: SECRET })],
      (m) => warnings.push(m),
      fetchImpl,
    );

    expect(prepared[0]?.env?.["PAYPAL_ACCESS_TOKEN"]).toBe("A21.minted");
    expect(warnings.join("\n")).toMatch(/about 9h/);
  });
});
