import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorize } from "../authorize.js";
import { createReceipt, verifyReceipt } from "../receipt.js";
import { ShotokuError } from "../errors.js";

const SECRET = "local-test-receipt-secret";
const ISSUED_AT = new Date("2026-07-13T10:00:00.000Z");

function makeReceipt(overrides: Partial<Parameters<typeof createReceipt>[0]> = {}): string {
  return createReceipt({
    decisionId: "dec_receipt1",
    actor: "billing-agent",
    action: "purchase",
    resource: "api.openai.com",
    amount: 12,
    secret: SECRET,
    issuedAt: ISSUED_AT,
    ...overrides,
  });
}

describe("createReceipt / verifyReceipt", () => {
  it("round-trips a valid receipt", () => {
    const token = makeReceipt();
    const result = verifyReceipt(token, { secret: SECRET, now: ISSUED_AT });

    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.payload).toMatchObject({
      v: 1,
      decisionId: "dec_receipt1",
      actor: "billing-agent",
      action: "purchase",
      resource: "api.openai.com",
      amount: 12,
    });
  });

  it("omits amount when the request had none", () => {
    const token = createReceipt({
      decisionId: "dec_receipt2",
      actor: "agent",
      action: "api_call",
      resource: "openai.com",
      secret: SECRET,
      issuedAt: ISSUED_AT,
    });
    const result = verifyReceipt(token, { secret: SECRET, now: ISSUED_AT });

    expect(result.valid).toBe(true);
    expect(result.payload?.amount).toBeUndefined();
  });

  it("rejects a receipt signed with a different secret", () => {
    const token = makeReceipt();
    const result = verifyReceipt(token, { secret: "other-secret", now: ISSUED_AT });

    expect(result.valid).toBe(false);
    expect(result.payload).toBeUndefined();
    expect(result.reasons.join(" ")).toMatch(/signature/i);
  });

  it("rejects a receipt whose payload was tampered with", () => {
    const token = makeReceipt();
    const [prefix = "", payload = "", signature = ""] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    decoded["amount"] = 999999;
    const forged = [
      prefix,
      Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url"),
      signature,
    ].join(".");

    const result = verifyReceipt(forged, { secret: SECRET, now: ISSUED_AT });

    expect(result.valid).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/signature/i);
  });

  it("rejects an expired receipt", () => {
    const token = makeReceipt({ ttlSeconds: 60 });
    const later = new Date(ISSUED_AT.getTime() + 61_000);
    const result = verifyReceipt(token, { secret: SECRET, now: later });

    expect(result.valid).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/expired/i);
  });

  it("accepts a receipt just inside its lifetime", () => {
    const token = makeReceipt({ ttlSeconds: 60 });
    const justBefore = new Date(ISSUED_AT.getTime() + 59_000);

    expect(verifyReceipt(token, { secret: SECRET, now: justBefore }).valid).toBe(true);
  });

  it("rejects malformed tokens without throwing", () => {
    for (const bad of ["", "not-a-receipt", "rcpt.only-two", "a.b.c.d", `rcpt.${Buffer.from("[]").toString("base64url")}.deadbeef`]) {
      const result = verifyReceipt(bad, { secret: SECRET });
      expect(result.valid).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it("requires a non-empty secret", () => {
    expect(() => makeReceipt({ secret: "  " })).toThrow(ShotokuError);
    expect(() => verifyReceipt(makeReceipt(), { secret: "" })).toThrow(ShotokuError);
  });
});

describe("authorize() receipt integration", () => {
  async function setup(): Promise<{ policyPath: string; ledgerPath: string }> {
    const dir = await mkdtemp(join(tmpdir(), "shotoku-receipt-test-"));
    const policyPath = join(dir, "policy.yaml");
    const ledgerPath = join(dir, "decisions.jsonl");
    await writeFile(
      policyPath,
      "rules:\n  - resource: api.openai.com\n    verdict: approved\n    maxAmount: 50\n",
      "utf8",
    );
    return { policyPath, ledgerPath };
  }

  it("attaches a verifiable receipt to approved decisions when a secret is configured", async () => {
    const paths = await setup();
    const response = await authorize(
      { actor: "billing-agent", action: "purchase", resource: "api.openai.com", amount: 12 },
      { ...paths, receiptSecret: SECRET },
    );

    expect(response.approved).toBe(true);
    expect(response.receipt).toBeDefined();

    const result = verifyReceipt(response.receipt ?? "", { secret: SECRET });
    expect(result.valid).toBe(true);
    expect(result.payload?.decisionId).toBe(response.decisionId);
    expect(result.payload?.amount).toBe(12);
  });

  it("issues no receipt on denied decisions", async () => {
    const paths = await setup();
    const response = await authorize(
      { actor: "billing-agent", action: "purchase", resource: "api.openai.com", amount: 900 },
      { ...paths, receiptSecret: SECRET },
    );

    expect(response.approved).toBe(false);
    expect(response.receipt).toBeUndefined();
  });

  it("issues no receipt when no secret is configured", async () => {
    const paths = await setup();
    const response = await authorize(
      { actor: "billing-agent", action: "purchase", resource: "api.openai.com", amount: 12 },
      paths,
    );

    expect(response.approved).toBe(true);
    expect(response.receipt).toBeUndefined();
  });
});
