import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { authorize } from "../authorize.js";
import { approve } from "../approve.js";
import { getLedgerSnapshot, readDecisions } from "../ledger.js";
import { evaluatePolicy } from "../policy.js";
import { validatePolicy } from "../validation.js";
import { toMicros } from "../money.js";
import type { AuthorizeRequest, LedgerSnapshot, Policy } from "../types.js";

function policyFromYaml(raw: string): Policy {
  return validatePolicy(parse(raw));
}

function snapshot(actorTotals: Record<string, number>): LedgerSnapshot {
  return {
    dailyTotals: {},
    actorTotals: Object.fromEntries(
      Object.entries(actorTotals).map(([actor, dollars]) => [actor, toMicros(dollars)]),
    ),
    windowStart: new Date("2026-06-18T00:00:00.000Z").toISOString(),
  };
}

function request(overrides: Partial<AuthorizeRequest> = {}): AuthorizeRequest {
  return {
    actor: "agent-1",
    action: "purchase",
    resource: "vendor-a.com",
    amount: 10,
    ...overrides,
  };
}

const WILDCARD_RULE = `rules:
  - resource: "*"
    verdict: approved
    maxDailyAmount: 200
`;

describe("evaluatePolicy — budgets", () => {
  it("caps total spend across resources, which rule limits alone do not", () => {
    // Without a budget, every distinct resource gets its own 200.
    const ruleOnly = policyFromYaml(WILDCARD_RULE);
    expect(
      evaluatePolicy(request({ resource: "vendor-z.com" }), ruleOnly, snapshot({ "agent-1": 190 }))
        .status,
    ).toBe("approved");

    const budgeted = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 195\n`,
    );
    const result = evaluatePolicy(
      request({ resource: "vendor-z.com" }),
      budgeted,
      snapshot({ "agent-1": 190 }),
    );

    expect(result.status).toBe("denied");
    expect(result.reasons.at(-1)?.text).toMatch(/Daily budget for agent-1.*\$200.*\$195/);
  });

  it("reports what is left when the request fits", () => {
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 100\n`,
    );
    const result = evaluatePolicy(request(), policy, snapshot({ "agent-1": 25 }));

    expect(result.status).toBe("approved");
    expect(result.reasons.at(-1)?.text).toMatch(/\$65 remaining across all resources/);
  });

  it("allows spend that lands exactly on the ceiling", () => {
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 30\n`,
    );

    expect(evaluatePolicy(request(), policy, snapshot({ "agent-1": 20 })).status).toBe(
      "approved",
    );
  });

  it("applies a per-actor budget to each agent separately", () => {
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 50\n`,
    );
    const ledger = snapshot({ "agent-1": 45, "agent-2": 0 });

    expect(evaluatePolicy(request(), policy, ledger).status).toBe("denied");
    expect(evaluatePolicy(request({ actor: "agent-2" }), policy, ledger).status).toBe(
      "approved",
    );
  });

  it("pools a shared budget across every matching actor", () => {
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "team-*"\n    maxDailyAmount: 100\n    scope: shared\n`,
    );
    const ledger = snapshot({ "team-a": 50, "team-b": 45, outsider: 1000 });

    const result = evaluatePolicy(request({ actor: "team-c" }), policy, ledger);
    expect(result.status).toBe("denied");
    expect(result.reasons.at(-1)?.text).toMatch(/Shared daily budget.*team-\*.*\$105/);
  });

  it("holds a fresh actor name to a shared catch-all budget", () => {
    // An agent that can pick its own actor name escapes a per-actor budget by
    // inventing a new name. A shared "*" budget does not care what it is called.
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 100\n    scope: shared\n`,
    );

    expect(
      evaluatePolicy(request({ actor: "brand-new-name" }), policy, snapshot({ "agent-1": 95 }))
        .status,
    ).toBe("denied");
  });

  it("requires every matching budget to pass", () => {
    const policy = policyFromYaml(`${WILDCARD_RULE}budgets:
  - actor: "*"
    maxDailyAmount: 1000
  - actor: "research-*"
    maxDailyAmount: 20
`);
    const ledger = snapshot({ "research-bot": 15 });

    expect(evaluatePolicy(request({ actor: "research-bot" }), policy, ledger).status).toBe(
      "denied",
    );
    expect(evaluatePolicy(request({ actor: "prod-bot" }), policy, ledger).status).toBe(
      "approved",
    );
  });

  it("caps spend approved by defaultVerdict, with no rule matched", () => {
    const policy = policyFromYaml(
      `rules: []\ndefaultVerdict: approved\nbudgets:\n  - actor: "*"\n    maxDailyAmount: 5\n`,
    );

    expect(evaluatePolicy(request(), policy, snapshot({})).status).toBe("denied");
  });

  it("never turns a denial or a pending verdict into anything else", () => {
    const policy = policyFromYaml(`rules:
  - resource: blocked.com
    verdict: denied
budgets:
  - actor: "*"
    maxDailyAmount: 1000
`);
    const ledger = snapshot({});

    expect(evaluatePolicy(request({ resource: "blocked.com" }), policy, ledger).status).toBe(
      "denied",
    );
    expect(evaluatePolicy(request({ resource: "other.com" }), policy, ledger).status).toBe(
      "pending_approval",
    );
  });

  it("ignores requests without an amount", () => {
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 1\n`,
    );
    const { amount: _amount, ...noAmount } = request();

    expect(evaluatePolicy(noAmount, policy, snapshot({ "agent-1": 5 })).status).toBe(
      "approved",
    );
  });

  it("denies rather than guesses when the snapshot has no per-actor totals", () => {
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 1000\n`,
    );
    const handBuilt: LedgerSnapshot = { dailyTotals: {}, windowStart: "" };

    const result = evaluatePolicy(request(), policy, handBuilt);
    expect(result.status).toBe("denied");
    expect(result.reasons.at(-1)?.text).toMatch(/could not be checked/);
  });

  it("treats prototype-looking actor names as ordinary agents", () => {
    const policy = policyFromYaml(
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 50\n`,
    );

    expect(
      evaluatePolicy(request({ actor: "constructor" }), policy, snapshot({})).status,
    ).toBe("approved");
  });
});

describe("validatePolicy — budgets", () => {
  it.each([
    ["a non-list", `rules: []\nbudgets: {}\n`, /budgets must be a list/],
    ["a missing ceiling", `rules: []\nbudgets:\n  - actor: "*"\n`, /maxDailyAmount/],
    ["a negative ceiling", `rules: []\nbudgets:\n  - actor: "*"\n    maxDailyAmount: -1\n`, /non-negative/],
    ["a missing actor", `rules: []\nbudgets:\n  - maxDailyAmount: 1\n`, /actor/],
    ["an unknown scope", `rules: []\nbudgets:\n  - actor: "*"\n    maxDailyAmount: 1\n    scope: team\n`, /scope/],
    ["an unknown field", `rules: []\nbudgets:\n  - actor: "*"\n    maxDailyAmount: 1\n    perDay: 1\n`, /unknown field "perDay"/],
  ])("rejects %s", (_label, raw, message) => {
    expect(() => policyFromYaml(raw)).toThrow(message);
  });

  it("rejects an empty recipients list", () => {
    expect(() =>
      policyFromYaml(`rules:\n  - resource: "*"\n    recipients: []\n    verdict: approved\n`),
    ).toThrow(/recipients must be a non-empty list/);
  });
});

describe("authorize — budgets end to end", () => {
  let dir: string;
  let policyPath: string;
  let ledgerPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "shotoku-budget-test-"));
    policyPath = join(dir, "policy.yaml");
    ledgerPath = join(dir, "decisions.jsonl");
  });

  const run = (req: AuthorizeRequest) => authorize(req, { policyPath, ledgerPath });

  it("stops an agent spreading spend over many resources", async () => {
    await writeFile(
      policyPath,
      `${WILDCARD_RULE}budgets:\n  - actor: "*"\n    maxDailyAmount: 25\n`,
    );

    expect((await run(request({ resource: "a.com" }))).status).toBe("approved");
    expect((await run(request({ resource: "b.com" }))).status).toBe("approved");
    expect((await run(request({ resource: "c.com" }))).status).toBe("denied");

    const totals = await getLedgerSnapshot(ledgerPath);
    expect(totals.actorTotals?.["agent-1"]).toBe(toMicros(20));
  });

  it("does not let a human approval spend past a budget, and keeps the grant open", async () => {
    await writeFile(
      policyPath,
      `rules:
  - resource: cheap.com
    verdict: approved
  - resource: review.com
    verdict: pending_approval
budgets:
  - actor: "*"
    maxDailyAmount: 15
`,
    );

    const pending = await run(request({ resource: "review.com" }));
    expect(pending.status).toBe("pending_approval");
    await approve(pending.decisionId, { ledgerPath });

    // Spend the budget elsewhere before the agent retries.
    expect((await run(request({ resource: "cheap.com" }))).status).toBe("approved");

    const retry = await run(request({ resource: "review.com" }));
    expect(retry.status).toBe("denied");
    expect(retry.reasons.at(-1)?.text).toMatch(/Daily budget/);

    const decisions = await readDecisions(ledgerPath);
    expect(decisions.at(-1)?.grant).toBeUndefined();
  });
});
