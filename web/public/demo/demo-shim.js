/* global window, document, Response, URL, setTimeout, TextEncoder */
/**
 * The hosted demo's stand-in for the `shotoku ui` server.
 *
 * app.js is the real dashboard page and talks to two routes:
 *   GET  /api/state
 *   POST /api/decisions/<id>/(approve|deny)
 * This file answers both from an in-memory ledger, so the page runs with no
 * server and nothing leaves the browser. Every other request is passed to the
 * real fetch.
 *
 * It is a small port of the code that answers those routes locally:
 *   cli/src/ui/server.ts and cli/src/ui/state.ts (routes and response shapes),
 *   core/src/policy.ts, explain.ts, approve.ts and ledger.ts (the verdicts,
 *   reason text and rolling 24-hour totals).
 * The seed is replayed through that logic, so the KPIs, budgets and history
 * agree with each other by construction rather than by hand-typed numbers.
 *
 * The ledger is hash-chained the way the real one is (SHA-256 over the
 * previous hash and the record, as canonical JSON), and every read verifies
 * the chain. Edit a record and the next read fails, exactly as it does locally.
 *
 * demo-story.js drives the agent through `window.shotokuDemo`.
 *
 * State lives in memory only. A reload starts again from the seed.
 */
(function () {
  "use strict";

  const ACTOR = "support-agent";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MINUTE_MS = 60 * 1000;
  /** How long the simulated agent waits before retrying an approved call. */
  const RETRY_MS = 1500;
  const DECISION_PATH = /^\/api\/decisions\/(dec_[a-z0-9]{1,40})\/(approve|deny)$/;

  // examples/paypal/policy.yaml, as the policy loader would return it.
  const POLICY = {
    rules: [
      { resource: "paypal__list_*", verdict: "approved" },
      { resource: "paypal__get_*", verdict: "approved" },
      { resource: "paypal__show_*", verdict: "approved" },
      {
        resource: "paypal__create_refund",
        verdict: "approved",
        maxAmount: 100,
        maxDailyAmount: 1000,
        overLimit: "pending_approval",
      },
      {
        resource: "paypal__accept_dispute_claim",
        verdict: "approved",
        maxAmount: 50,
        overLimit: "pending_approval",
      },
    ],
    budgets: [{ actor: ACTOR, maxDailyAmount: 1000 }],
    defaultVerdict: "pending_approval",
  };

  // --- the ledger -------------------------------------------------------------

  /** Decision records, oldest first. Never edited after they are appended. */
  let decisions = [];
  /** Human answers, oldest first. One per pending decision at most. */
  let approvals = [];
  /**
   * Every record in the order it was appended, as the ledger file holds them,
   * each with the hash that chains it to the one before.
   */
  let lines = [];

  // --- the hash chain (core/src/integrity.ts, core/src/ledger.ts) -------------

  const GENESIS_HASH = `sha256:${"0".repeat(64)}`;

  /** JSON with object keys in sorted order, so one record has one spelling. */
  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value !== null && typeof value === "object") {
      const members = Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
      return `{${members.join(",")}}`;
    }
    return JSON.stringify(value);
  }

  async function sha256Hex(text) {
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `sha256:${hex}`;
  }

  function hashRecord(previousHash, record) {
    return sha256Hex(canonicalJson({ previousHash, record }));
  }

  /** Gives every record that has none yet its place in the chain. */
  let sealing = Promise.resolve();
  function seal() {
    sealing = sealing.then(async () => {
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].integrity) continue;
        const previousHash = index === 0 ? GENESIS_HASH : lines[index - 1].integrity.hash;
        // Hashed as it stands now. A later edit to the record is not rehashed.
        const hash = await hashRecord(previousHash, lines[index].record);
        lines[index].integrity = { version: 1, sequence: index + 1, previousHash, hash };
      }
    });
    return sealing;
  }

  /** Recomputes the whole chain, as every read of the real ledger does. */
  async function verify() {
    await seal();
    let previousHash = GENESIS_HASH;
    for (let index = 0; index < lines.length; index += 1) {
      const { record, integrity } = lines[index];
      const line = index + 1;
      if (integrity.previousHash !== previousHash) {
        return { ok: false, line, message: `Ledger is corrupt at line ${line}: previous hash does not match` };
      }
      if (integrity.hash !== (await hashRecord(previousHash, record))) {
        return { ok: false, line, message: `Ledger is corrupt at line ${line}: record hash does not match` };
      }
      previousHash = integrity.hash;
    }
    return { ok: true, records: lines.length };
  }

  // --- money and matching (core/src/money.ts, core/src/policy.ts) -------------

  function toMicros(dollars) {
    return Math.round(dollars * 1e6);
  }

  function fromMicros(micros) {
    return micros / 1e6;
  }

  function matchesPattern(pattern, value) {
    const source = pattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${source}$`).test(value);
  }

  function findMatchingRule(request) {
    return POLICY.rules.find((rule) => matchesPattern(rule.resource, request.resource));
  }

  /** Approved spend in the 24 hours before `nowMs` (core/src/ledger.ts). */
  function snapshotAt(nowMs) {
    const windowStart = nowMs - DAY_MS;
    const dailyTotals = {};
    const actorTotals = {};
    for (const record of decisions) {
      if (!record.response.approved) continue;
      if (Date.parse(record.timestamp) < windowStart) continue;
      const amount = record.request.amount;
      if (amount === undefined) continue;
      const micros = toMicros(amount);
      const key = `${record.request.actor}|${record.request.resource}`;
      dailyTotals[key] = (dailyTotals[key] ?? 0) + micros;
      actorTotals[record.request.actor] = (actorTotals[record.request.actor] ?? 0) + micros;
    }
    return { dailyTotals, actorTotals };
  }

  function overLimit(rule, reasons, check, text) {
    if (rule.overLimit === "pending_approval") {
      return { status: "pending_approval", reasons: [...reasons, { type: "escalated", text }] };
    }
    return { status: "denied", reasons: [...reasons, { type: check, text }] };
  }

  function evaluateRules(request, snapshot) {
    const rule = findMatchingRule(request);
    if (!rule) {
      const type = POLICY.defaultVerdict === "pending_approval" ? "escalated" : "blocked";
      return {
        status: POLICY.defaultVerdict,
        reasons: [{ type, text: `${request.resource} is not on the allowlist` }],
      };
    }

    const reasons = [{ type: "policy_match", text: `${request.resource} matched rule` }];
    if (rule.verdict !== "approved") return { status: rule.verdict, reasons };

    if (request.amount !== undefined && rule.maxAmount !== undefined) {
      if (toMicros(request.amount) > toMicros(rule.maxAmount)) {
        return overLimit(
          rule,
          reasons,
          "limit_check",
          `Amount $${request.amount} exceeds per-transaction limit of $${rule.maxAmount}`,
        );
      }
      reasons.push({
        type: "limit_check",
        text: `Amount $${request.amount} is within per-transaction limit of $${rule.maxAmount}`,
      });
    }

    if (rule.maxDailyAmount !== undefined) {
      const spentMicros = snapshot.dailyTotals[`${request.actor}|${request.resource}`] ?? 0;
      const limitMicros = toMicros(rule.maxDailyAmount);
      const totalMicros = spentMicros + toMicros(request.amount ?? 0);
      if (totalMicros > limitMicros) {
        return overLimit(
          rule,
          reasons,
          "budget_check",
          `Daily total $${fromMicros(totalMicros)} would exceed daily limit of $${rule.maxDailyAmount}`,
        );
      }
      reasons.push({
        type: "budget_check",
        text: `Daily budget remaining: $${fromMicros(limitMicros - totalMicros)}`,
      });
    }

    return { status: "approved", reasons };
  }

  /** The agent's total ceiling. Only ever turns `approved` into `denied`. */
  function applyBudgets(result, request, snapshot) {
    if (result.status !== "approved" || request.amount === undefined) return result;

    const reasons = [...result.reasons];
    for (const budget of POLICY.budgets) {
      if (!matchesPattern(budget.actor, request.actor)) continue;
      const totalMicros = (snapshot.actorTotals[request.actor] ?? 0) + toMicros(request.amount);
      const limitMicros = toMicros(budget.maxDailyAmount);
      const label = `Daily budget for ${request.actor}`;
      if (totalMicros > limitMicros) {
        return {
          status: "denied",
          reasons: [
            ...reasons,
            {
              type: "budget_check",
              text: `${label}: total $${fromMicros(totalMicros)} would exceed $${budget.maxDailyAmount} across all resources`,
            },
          ],
        };
      }
      reasons.push({
        type: "budget_check",
        text: `${label}: $${fromMicros(limitMicros - totalMicros)} remaining across all resources`,
      });
    }
    return { status: "approved", reasons };
  }

  /** core/src/explain.ts, plus the grant line (see `authorize`). */
  function summarize(status, reasons, grantReason) {
    if (status === "approved") {
      const match = reasons.find((r) => r.type === "policy_match");
      const limit = reasons.find((r) => r.type === "limit_check");
      const budgets = reasons.filter((r) => r.type === "budget_check").map((r) => r.text);
      const lead = grantReason ? grantReason.text : match && match.text;
      const parts = [lead, limit && limit.text, ...budgets].filter(Boolean);
      return parts.length > 0 ? parts.join(". ") : "Approved.";
    }
    if (status === "denied") {
      const cause = reasons.at(-1);
      return cause ? cause.text : "Denied.";
    }
    const cause = reasons.find((r) => r.type === "escalated") ?? reasons[0];
    return cause ? cause.text : "Requires human approval.";
  }

  // --- ids --------------------------------------------------------------------

  // The seed uses fixed ids so the page looks the same on every load.
  const SEED_IDS = [
    "3f9a1c07b2e4", "a81d5e60c93f", "5c02b7f4d118", "e7b360a9124c", "19d4f8a2c65b",
    "b46e07d1a3f9", "7a2c9e5140bd", "d05f83b6e21a", "62e1a4c97f03", "f38b0d2e57a6",
    "0c7e5a91d4b2", "94a6d3f1b08e", "2b8f60c4e7d5", "c1d97a3e5f20", "86f2e4b0a1c7",
    "4e0a7c2d9b63",
  ];
  let seedIndex = 0;
  let seeding = false;

  function hexId() {
    if (seeding && seedIndex < SEED_IDS.length) return SEED_IDS[seedIndex++];
    const bytes = new Uint8Array(6);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // --- authorize, approve, deny (core/src/authorize.ts, approve.ts) -----------

  /**
   * Records a decision for `request` at `atMs` and returns it.
   *
   * `grant` is a human approval of an earlier identical request. As in core, it
   * can lift a pending verdict to approved but never a denial, and the agent's
   * budget is checked again afterwards: a human cannot approve past the ceiling.
   *
   * One deliberate difference from core: the reason line for a redeemed grant
   * says that it is used once, and leads the summary, so the retry row reads
   * clearly in the History grid. Core's line is "Approved by a human as <id>".
   */
  function authorize(request, atMs, grant) {
    const snapshot = snapshotAt(atMs);
    let result = evaluateRules(request, snapshot);
    let grantReason;

    if (grant && result.status === "pending_approval") {
      grantReason = {
        type: "policy_match",
        text: `Approved by a human as ${grant.decisionId}; that grant is used once`,
      };
      result = { status: "approved", reasons: [...result.reasons, grantReason] };
    }
    result = applyBudgets(result, request, snapshot);

    const decisionId = `dec_${hexId()}`;
    const timestamp = new Date(atMs).toISOString();
    const approved = result.status === "approved";
    const record = {
      decisionId,
      timestamp,
      request,
      response: {
        approved,
        status: result.status,
        reasons: result.reasons,
        decisionId,
        timestamp,
        explanation: { summary: summarize(result.status, result.reasons, approved ? grantReason : undefined) },
      },
      // Recording the grant on an approved decision is what spends it.
      ...(grantReason && approved
        ? { grant: { approvalId: grant.approvalId, decisionId: grant.decisionId } }
        : {}),
    };
    decisions.push(record);
    lines.push({ record });
    seal();
    return record;
  }

  /** Appends a human answer. Throws the messages core/src/approve.ts throws. */
  function resolve(decisionId, verdict, atMs, via) {
    const decision = decisions.find((d) => d.decisionId === decisionId);
    if (!decision) throw new Error(`Decision "${decisionId}" not found.`);
    if (decision.response.status !== "pending_approval") {
      throw new Error(
        `Decision "${decisionId}" is not pending approval (status: ${decision.response.status}).`,
      );
    }
    const existing = approvals.find((a) => a.decisionId === decisionId);
    if (existing) {
      throw new Error(
        `Decision "${decisionId}" was already ${existing.verdict} as ${existing.approvalId}.`,
      );
    }
    const approval = {
      kind: "approval",
      approvalId: `apr_${hexId()}`,
      decisionId,
      verdict,
      timestamp: new Date(atMs).toISOString(),
      ...(via ? { via } : {}),
    };
    approvals.push(approval);
    lines.push({ record: approval });
    seal();
    return approval;
  }

  // --- the seed: a PayPal support agent's afternoon ---------------------------

  function toolCall(tool, amount, amountSource) {
    return {
      actor: ACTOR,
      action: "mcp_tool",
      resource: `paypal__${tool}`,
      rail: "mcp",
      amount,
      context: { server: "paypal", tool, amountSource },
    };
  }

  const read = () => toolCall("get_order", 0, "get_order sends no money out");
  const refund = (amount, source) => toolCall("create_refund", amount, source ?? "create_refund amount argument");

  function seed(nowMs) {
    decisions = [];
    approvals = [];
    lines = [];
    seedIndex = 0;
    seeding = true;
    const ago = (minutes) => nowMs - minutes * MINUTE_MS;

    // Two small refunds, each after the agent looks the order up.
    authorize(read(), ago(318));
    authorize(refund(24), ago(317));
    authorize(read(), ago(204));
    authorize(refund(61), ago(203));

    // A $1,250 refund: over the $100 limit, so a human was asked and said yes
    // in the terminal. The retry was still refused, because $85 already spent
    // plus $1,250 is over the agent's $1,000 daily budget.
    authorize(read(), ago(131));
    const large = authorize(refund(1250, "full refund of capture 4GH19263LT552701P"), ago(130));
    const largeApproval = resolve(large.decisionId, "approved", ago(126));
    authorize(large.request, ago(125), largeApproval);

    // What happens next is up to the agent in demo-story.js, and to you.
    seeding = false;
  }

  // --- GET /api/state (cli/src/ui/state.ts) -----------------------------------

  function amountFields(entry) {
    const source = entry.request.context && entry.request.context.amountSource;
    return {
      ...(entry.request.amount !== undefined ? { amount: entry.request.amount } : {}),
      ...(typeof source === "string" ? { amountSource: source } : {}),
    };
  }

  function withLimit(row, limit) {
    if (limit === undefined) return row;
    return { ...row, limit, remaining: fromMicros(Math.max(0, toMicros(limit) - toMicros(row.spent))) };
  }

  function agentBudgetRows(actorTotals) {
    const rows = [];
    for (const budget of POLICY.budgets) {
      const covered = Object.entries(actorTotals).filter(([actor]) => matchesPattern(budget.actor, actor));
      const actors = covered.length > 0 || budget.actor.includes("*") ? covered : [[budget.actor, 0]];
      for (const [actor, micros] of actors) {
        rows.push(withLimit({ kind: "agent", actor, spent: fromMicros(micros) }, budget.maxDailyAmount));
      }
    }
    return rows;
  }

  function resourceRows(dailyTotals, latestByKey) {
    const rows = Object.entries(dailyTotals).map(([key, micros]) => {
      const separator = key.indexOf("|");
      const actor = key.slice(0, separator);
      const resource = key.slice(separator + 1);
      const latest = latestByKey.get(key);
      const rule = latest ? findMatchingRule(latest.request) : undefined;
      return withLimit({ kind: "resource", actor, resource, spent: fromMicros(micros) }, rule && rule.maxDailyAmount);
    });
    return rows.filter((row) => row.spent > 0 || row.limit !== undefined);
  }

  function buildState(nowMs) {
    const approvalFor = new Map(approvals.map((a) => [a.decisionId, a]));
    const latestByKey = new Map();
    for (const entry of decisions) {
      latestByKey.set(`${entry.request.actor}|${entry.request.resource}`, entry);
    }

    const pending = decisions
      .filter((d) => d.response.status === "pending_approval" && !approvalFor.has(d.decisionId))
      .map((d) => ({
        decisionId: d.decisionId,
        timestamp: d.timestamp,
        ageSeconds: Math.max(0, Math.round((nowMs - Date.parse(d.timestamp)) / 1000)),
        actor: d.request.actor,
        action: d.request.action,
        resource: d.request.resource,
        ...amountFields(d),
        summary: d.response.explanation.summary,
        reasons: d.response.reasons.map((r) => r.text),
      }));

    const history = [...decisions].reverse().map((d) => {
      const approval = approvalFor.get(d.decisionId);
      return {
        decisionId: d.decisionId,
        timestamp: d.timestamp,
        actor: d.request.actor,
        action: d.request.action,
        resource: d.request.resource,
        ...amountFields(d),
        status: d.response.status,
        ...(approval
          ? {
              resolution: {
                verdict: approval.verdict,
                approvalId: approval.approvalId,
                ...(approval.via ? { via: approval.via } : {}),
                timestamp: approval.timestamp,
              },
            }
          : {}),
        summary: d.response.explanation.summary,
        reasons: d.response.reasons.map((r) => r.text),
      };
    });

    const snapshot = snapshotAt(nowMs);
    const count = (status) => decisions.filter((d) => d.response.status === status).length;

    return {
      generatedAt: new Date(nowMs).toISOString(),
      pending,
      history,
      budgets: [
        ...agentBudgetRows(snapshot.actorTotals),
        ...resourceRows(snapshot.dailyTotals, latestByKey),
      ],
      totals: {
        decisions: decisions.length,
        approved: count("approved"),
        denied: count("denied"),
        pending: pending.length,
        spent24h: fromMicros(Object.values(snapshot.actorTotals).reduce((sum, micros) => sum + micros, 0)),
      },
      // The local server recomputes the ledger's hash chain here. The demo has
      // no file to check, so it reports the intact state and the record count.
      integrity: { ok: true, records: decisions.length + approvals.length },
    };
  }

  // --- the fetch stand-in (cli/src/ui/server.ts) ------------------------------

  function json(status, body) {
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      }),
    );
  }

  /** Decisions whose answer demo-story.js acts on itself. */
  const claimed = new Set();
  const answerListeners = [];

  async function decide(decisionId, verb) {
    // An answer is a write, and the real ledger refuses writes it cannot chain.
    const report = await verify();
    if (!report.ok) return json(409, { error: report.message });
    try {
      const approval = resolve(decisionId, verb === "approve" ? "approved" : "denied", Date.now(), "dashboard");
      const original = decisions.find((d) => d.decisionId === decisionId);
      if (approval.verdict === "approved" && !claimed.has(decisionId)) {
        // What the agent does next on a real machine: the same call again. The
        // grant lets it through once, if the budget still has room.
        setTimeout(() => authorize(original.request, Date.now(), approval), RETRY_MS);
      }
      for (const listener of answerListeners) listener(approval, original);
      return json(200, { approval });
    } catch (error) {
      return json(409, { error: error.message });
    }
  }

  async function state() {
    // As locally: a ledger that does not verify is not read at all.
    const report = await verify();
    if (!report.ok) return json(500, { error: report.message });
    return json(200, { ...buildState(Date.now()), integrity: { ok: true, records: report.records } });
  }

  const realFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    const target = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const url = new URL(target, window.location.href);
    const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

    if (url.origin === window.location.origin) {
      if (method === "GET" && url.pathname === "/api/state") return state();
      const write = method === "POST" ? DECISION_PATH.exec(url.pathname) : null;
      if (write) return decide(write[1], write[2]);
    }
    return realFetch(input, init);
  };

  // --- page wiring ------------------------------------------------------------

  // app.js refuses to start without the session token `shotoku ui` puts in the
  // URL fragment. There is no session here, so give it a placeholder to read.
  if (!/token=[a-f0-9]+/.test(window.location.hash)) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#token=de30`);
  }

  seed(Date.now());

  // --- what demo-story.js can do ----------------------------------------------

  /** The record an edit replaced, so it can be put back. */
  let edited = null;

  window.shotokuDemo = {
    /** The agent looks an order up. */
    read: () => authorize(read(), Date.now()),
    /** The agent asks for a refund; `source` says where the amount came from. */
    refund: (amount, source) => authorize(refund(amount, source), Date.now()),
    /** The story will act on this decision's answer itself. */
    claim: (decisionId) => claimed.add(decisionId),
    /** The agent repeats a held call after a human approved it. */
    retry(decisionId) {
      const original = decisions.find((d) => d.decisionId === decisionId);
      const approval = approvals.find((a) => a.decisionId === decisionId);
      return authorize(original.request, Date.now(), approval);
    },
    onAnswer: (listener) => answerListeners.push(listener),
    verify,
    /** Rewrites one recorded amount in place, the way an editor would. */
    async edit(decisionId, amount) {
      await seal();
      const index = lines.findIndex((line) => line.record.decisionId === decisionId && line.record.kind !== "approval");
      const record = lines[index].record;
      edited = { record, request: record.request };
      record.request = { ...record.request, amount };
      return { line: index + 1, before: edited.request.amount, after: amount };
    },
    /** Puts the edited record back as it was. */
    restore() {
      if (!edited) return;
      edited.record.request = edited.request;
      edited = null;
    },
    spent: () => fromMicros(snapshotAt(Date.now()).actorTotals[ACTOR] ?? 0),
  };

  // State is in memory only, so a reload is a reset.
  document.getElementById("demo-reset").addEventListener("click", () => window.location.reload());
})();
