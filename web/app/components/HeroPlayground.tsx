"use client";

import { motion, useDragControls, useMotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type DemoState =
  | "idle"
  | "typing_command"
  | "checking_policy"
  | "pending_approval"
  | "shotoku_review"
  | "approved"
  | "denied"
  | "agent_success"
  | "agent_blocked"
  | "resetting";

// ─── Scenarios ────────────────────────────────────────────────────────────────

interface Scenario {
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly amount: string;
  readonly rail: string;
  readonly decisionId: string;
  readonly task: string;
  readonly nextActionLabel: string;
  readonly pendingReasons: readonly string[];
  readonly autoOutcome: "approve" | "deny";
  readonly successLines: readonly string[];
  readonly blockedLines: readonly string[];
  readonly shotokuVendorLine: string;
  readonly approvedBudget: string;
}

const SCENARIOS: readonly Scenario[] = [
  {
    actor: "research-agent",
    action: "purchase",
    resource: "shutterstock.com",
    amount: "0.99",
    rail: "x402",
    decisionId: "dec_8f41a2",
    task: "License a stock photo for the blog post.",
    nextActionLabel: "license image",
    pendingReasons: [
      "shutterstock.com is not allowlisted",
      "First purchase from this vendor",
      "Human approval required",
    ],
    autoOutcome: "approve",
    successLines: ["License purchased", "Image downloaded", "Draft updated"],
    blockedLines: ["Purchase blocked before execution.", "No payment was made."],
    shotokuVendorLine: "shutterstock.com  ·  $0.99  ·  x402",
    approvedBudget: "$21.58",
  },
  {
    actor: "data-agent",
    action: "api_call",
    resource: "polygon.io",
    amount: "2.50",
    rail: "x402",
    decisionId: "dec_3c92b1",
    task: "Pull live market data for the report.",
    nextActionLabel: "fetch market data",
    pendingReasons: [
      "polygon.io is not allowlisted",
      "Amount exceeds single-call limit",
      "Human approval required",
    ],
    autoOutcome: "deny",
    successLines: ["Data fetched", "Report generated", "Saved to /reports"],
    blockedLines: ["API call blocked before execution.", "No charges were made."],
    shotokuVendorLine: "polygon.io  ·  $2.50  ·  x402",
    approvedBudget: "$19.08",
  },
  {
    actor: "content-agent",
    action: "api_call",
    resource: "api.deepl.com",
    amount: "0.08",
    rail: "api",
    decisionId: "dec_7e04f3",
    task: "Translate the article draft into French.",
    nextActionLabel: "translate text",
    pendingReasons: [
      "api.deepl.com is not allowlisted",
      "First use of this service",
      "Human approval required",
    ],
    autoOutcome: "approve",
    successLines: ["Translation complete", "Draft updated", "Saved to workspace"],
    blockedLines: ["API call blocked before execution.", "No charges were made."],
    shotokuVendorLine: "api.deepl.com  ·  $0.08  ·  api",
    approvedBudget: "$21.50",
  },
];

// ─── Command rendering ────────────────────────────────────────────────────────

const C_CMD  = "rgba(0,0,0,0.85)";
const C_VERB = "rgba(0,0,0,0.52)";
const C_FLAG = "rgba(55,91,210,0.72)";
const C_VAL  = "rgba(0,0,0,0.70)";
const C_CONT = "rgba(0,0,0,0.16)";

interface Segment { text: string; color: string }

function buildSegments(s: Scenario): Segment[] {
  return [
    { text: "shotoku",        color: C_CMD  },
    { text: " authorize",     color: C_VERB },
    { text: " \\\n  ",        color: C_CONT },
    { text: "--actor",        color: C_FLAG },
    { text: ` ${s.actor}`,    color: C_VAL  },
    { text: " \\\n  ",        color: C_CONT },
    { text: "--action",       color: C_FLAG },
    { text: ` ${s.action}`,   color: C_VAL  },
    { text: " \\\n  ",        color: C_CONT },
    { text: "--resource",     color: C_FLAG },
    { text: ` ${s.resource}`, color: C_VAL  },
    { text: " \\\n  ",        color: C_CONT },
    { text: "--amount",       color: C_FLAG },
    { text: ` ${s.amount}`,   color: C_VAL  },
    { text: " \\\n  ",        color: C_CONT },
    { text: "--rail",         color: C_FLAG },
    { text: ` ${s.rail}`,     color: C_VAL  },
  ];
}

function renderTyped(charsTyped: number, segments: Segment[]): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let remaining = charsTyped;
  for (let i = 0; i < segments.length; i++) {
    if (remaining <= 0) break;
    const seg = segments[i]!;
    const visible = seg.text.slice(0, remaining);
    nodes.push(
      <span key={i} style={{ color: seg.color, whiteSpace: "pre" }}>
        {visible}
      </span>
    );
    remaining -= seg.text.length;
  }
  return nodes;
}

// ─── Brand mini art ───────────────────────────────────────────────────────────

const MINI_ART = [
  "    _  ,--.",
  "   ;c),. o}`",
  "   `._,=,   `.",
  "       / ,    `.",
  "       `/L`.    )~",
  "            /_/\\_\\",
];

// ─── Timing constants ─────────────────────────────────────────────────────────

const MS_PER_CHAR       = 22;
const COUNTDOWN_DELAY_MS = 8000;
const COUNTDOWN_FROM    = 5;

const AUTO_TRANSITIONS: Partial<Record<DemoState, [DemoState, number]>> = {
  idle:             ["typing_command",   2000],
  checking_policy:  ["pending_approval", 2500],
  pending_approval: ["shotoku_review",   3000],
  approved:         ["agent_success",    1500],
  denied:           ["agent_blocked",    1500],
  agent_success:    ["resetting",        6000],
  agent_blocked:    ["resetting",        5000],
  resetting:        ["idle",              800],
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Blank() { return <div className="h-[18px]" />; }

function Cursor() {
  return (
    <span
      className="inline-block w-[5px] h-[13px] ml-px align-middle"
      style={{ background: "rgba(0,0,0,0.5)", animation: "blink 1s step-end infinite" }}
    />
  );
}

// ─── Window shell ─────────────────────────────────────────────────────────────

const DRAG_PAD = 32;

interface WindowShellProps {
  title: string;
  isActive: boolean;
  zIndex: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

interface Bounds { top: number; left: number; right: number; bottom: number }

function WindowShell({
  title, isActive, zIndex, offsetX, offsetY,
  width, height,
  minWidth = 280, maxWidth = 720,
  minHeight = 260, maxHeight = 680,
  containerRef, children,
}: WindowShellProps) {
  const drag      = useDragControls();
  const x         = useMotionValue(offsetX);
  const y         = useMotionValue(offsetY);
  const windowRef = useRef<HTMLDivElement>(null);
  const [winWidth,  setWinWidth]  = useState(width);
  const [winHeight, setWinHeight] = useState(height);
  const [bounds, setBounds] = useState<Bounds>({ left: -10000, right: 10000, top: -10000, bottom: 10000 });

  const startResize = useCallback((
    e: React.PointerEvent,
    h: "left" | "right" | undefined,
    v: "bottom" | undefined,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const cx = e.clientX, cy = e.clientY;
    const sw = winWidth, sh = winHeight, sx = x.get();
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      if (h === "right") {
        setWinWidth(Math.max(minWidth, Math.min(maxWidth, sw + dx)));
      } else if (h === "left") {
        const nw = Math.max(minWidth, Math.min(maxWidth, sw - dx));
        setWinWidth(nw);
        x.set(sx + sw - nw);
      }
      if (v === "bottom") setWinHeight(Math.max(minHeight, Math.min(maxHeight, sh + dy)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [winWidth, winHeight, x, minWidth, maxWidth, minHeight, maxHeight]);

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const win = windowRef.current;
      if (!container || !win) return;
      setBounds({
        left:   DRAG_PAD,
        right:  container.clientWidth  - win.offsetWidth  - DRAG_PAD,
        top:    DRAG_PAD,
        bottom: container.clientHeight - win.offsetHeight - DRAG_PAD,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (windowRef.current)   ro.observe(windowRef.current);
    return () => ro.disconnect();
  }, [containerRef]);

  const HEADER_H = 38;
  const EDGE     = 6;
  const CORNER   = 14;

  return (
    <motion.div
      ref={windowRef}
      drag
      dragControls={drag}
      dragListener={false}
      dragConstraints={bounds}
      dragElastic={0}
      dragMomentum={false}
      style={{ x, y, position: "absolute", top: 0, left: 0, zIndex, width: winWidth, opacity: isActive ? 1 : 0.72 }}
    >
      <div
        className="relative rounded-xl overflow-hidden flex flex-col"
        style={{ border: "1px solid rgba(0,0,0,0.08)", height: winHeight }}
      >
        <div
          className="relative flex items-center px-3 py-2.5 select-none flex-shrink-0"
          style={{ background: "#F2F1ED", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          onPointerDown={(e) => drag.start(e)}
        >
          <div className="flex items-center gap-1.5">
            {["a", "b", "c"].map((k) => (
              <div key={k} className="w-2.5 h-2.5 rounded-full" style={{ background: "#CAC8C4" }} />
            ))}
          </div>
          <span
            className="absolute left-1/2 -translate-x-1/2 text-[11px] font-normal whitespace-nowrap"
            style={{ color: "rgba(0,0,0,0.42)" }}
          >
            {title}
          </span>
        </div>
        <div className="flex-1 min-h-0">{children}</div>

        <div onPointerDown={(e) => startResize(e, "left", undefined)}
          style={{ position: "absolute", left: 0, top: HEADER_H, width: EDGE, bottom: CORNER, cursor: "ew-resize" }} />
        <div onPointerDown={(e) => startResize(e, "right", undefined)}
          style={{ position: "absolute", right: 0, top: HEADER_H, width: EDGE, bottom: CORNER, cursor: "ew-resize" }} />
        <div onPointerDown={(e) => startResize(e, undefined, "bottom")}
          style={{ position: "absolute", bottom: 0, left: CORNER, right: CORNER, height: EDGE, cursor: "s-resize" }} />
        <div onPointerDown={(e) => startResize(e, "left", "bottom")}
          style={{ position: "absolute", bottom: 0, left: 0, width: CORNER, height: CORNER, cursor: "sw-resize" }} />
        <div onPointerDown={(e) => startResize(e, "right", "bottom")}
          style={{ position: "absolute", bottom: 0, right: 0, width: CORNER, height: CORNER, cursor: "se-resize" }} />
      </div>
    </motion.div>
  );
}

// ─── Agent body ───────────────────────────────────────────────────────────────

interface AgentBodyProps {
  state: DemoState;
  charsTyped: number;
  scenario: Scenario;
  segments: Segment[];
}

function AgentBody({ state, charsTyped, scenario, segments }: AgentBodyProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const after = (...states: DemoState[]) => states.includes(state);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state, charsTyped]);

  return (
    <div
      ref={bodyRef}
      className="p-3 font-mono text-[11px] leading-[18px] overflow-y-auto thin-scroll h-full"
      style={{
        background: "rgba(247,247,244,0.72)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        color: "rgba(0,0,0,0.72)",
      }}
    >
      <div style={{ color: "rgba(0,0,0,0.36)", letterSpacing: "0.04em", fontSize: 10 }}>Task</div>
      <div style={{ color: "rgba(0,0,0,0.78)" }}>{"  "}{scenario.task}</div>
      <Blank />
      <div style={{ color: "rgba(0,0,0,0.36)", letterSpacing: "0.04em", fontSize: 10 }}>Next Action</div>
      <div>
        {"  "}
        <span style={{ color: "rgba(0,0,0,0.52)" }}>{scenario.action}</span>
        {" "}
        <span style={{ color: "rgba(0,0,0,0.82)" }}>{scenario.resource}</span>
      </div>
      <div style={{ color: "rgba(0,0,0,0.36)" }}>
        {"  "}<span>amount{"   "}</span>
        <span style={{ color: "rgba(0,0,0,0.75)" }}>${scenario.amount}</span>
      </div>
      <div style={{ color: "rgba(0,0,0,0.36)" }}>
        {"  "}<span>rail{"      "}</span>
        <span style={{ color: "rgba(0,0,0,0.75)" }}>{scenario.rail}</span>
      </div>
      <Blank />

      {state === "idle" && (
        <div>
          <span style={{ color: "rgba(0,0,0,0.28)" }}>$ </span>
          <Cursor />
        </div>
      )}

      {after("typing_command", "checking_policy", "pending_approval", "shotoku_review", "approved", "denied", "agent_success", "agent_blocked") && (
        <>
          <div>
            <span style={{ color: "rgba(0,0,0,0.24)" }}>$ </span>
            {renderTyped(charsTyped, segments)}
            {state === "typing_command" && <Cursor />}
          </div>
          <Blank />
        </>
      )}

      {after("checking_policy", "pending_approval", "shotoku_review", "approved", "denied", "agent_success", "agent_blocked") && (
        <>
          <div style={{ color: "rgba(0,0,0,0.38)" }}>Checking local policy...</div>
          <div style={{ color: "rgba(0,0,0,0.38)" }}>Reading ledger from data/decisions.jsonl...</div>
          <Blank />
        </>
      )}

      {after("pending_approval", "shotoku_review", "approved", "denied", "agent_success", "agent_blocked") && (
        <>
          <div style={{ color: "#92400e", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em", marginBottom: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>◷</span>
            <span>Pending approval{"  "}{scenario.decisionId}</span>
          </div>
          {scenario.pendingReasons.map((r, i) => <div key={i}>{"  "}• {r}</div>)}
          <Blank />
          <div style={{ color: "rgba(0,0,0,0.38)" }}>→ Waiting for Shotoku approval</div>
          <Blank />
        </>
      )}

      {after("approved", "agent_success") && (
        <>
          <div style={{ color: "#166534", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em", marginBottom: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✓</span>
            <span>Approved{"  "}{scenario.decisionId}</span>
          </div>
          <div>{"  "}• Approved by user</div>
          <div>{"  "}• Daily budget remaining: {scenario.approvedBudget}</div>
          <div>{"  "}• Recorded locally</div>
          <Blank />
        </>
      )}

      {after("denied", "agent_blocked") && (
        <>
          <div style={{ color: "#991b1b", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em", marginBottom: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✗</span>
            <span>Denied{"  "}{scenario.decisionId}</span>
          </div>
        </>
      )}

      {after("agent_success") && (
        <>
          {scenario.successLines.map((line, i) => (
            <div key={i} style={{ color: "rgba(0,0,0,0.38)" }}>
              {i === 0 ? "Executing..." : `${line.toLowerCase()}...`}
            </div>
          ))}
          <Blank />
          {scenario.successLines.map((line, i) => (
            <div key={i} style={{ color: "#166534" }}>✓ {line}</div>
          ))}
          <Blank />
          <div style={{ color: "rgba(0,0,0,0.35)" }}>Decision recorded in local audit log.</div>
        </>
      )}

      {after("agent_blocked") && (
        <>
          {scenario.blockedLines.map((line, i) => (
            <div key={i} style={{ color: i === scenario.blockedLines.length - 1 ? "rgba(0,0,0,0.38)" : undefined }}>
              {line}
            </div>
          ))}
          <div style={{ color: "rgba(0,0,0,0.38)" }}>Decision recorded locally.</div>
        </>
      )}
    </div>
  );
}

// ─── Shotoku body ─────────────────────────────────────────────────────────────

interface ShotokuBodyProps {
  state: DemoState;
  countdown: number | null;
  scenario: Scenario;
  onApprove: () => void;
  onDeny: () => void;
}

function ShotokuBody({ state, countdown, scenario, onApprove, onDeny }: ShotokuBodyProps) {
  const hasPending = ["pending_approval", "shotoku_review"].includes(state);
  const inReview   = state === "shotoku_review";
  const isApproved = state === "approved" || state === "agent_success";
  const isDenied   = state === "denied"   || state === "agent_blocked";

  return (
    <div
      className="font-mono overflow-y-auto thin-scroll h-full"
      style={{
        background: "rgba(247,247,244,0.72)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding: "20px 16px 16px",
        fontSize: "11px",
        lineHeight: "19px",
        color: "rgba(0,0,0,0.72)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: "#DB0028", whiteSpace: "pre", lineHeight: "15px", fontSize: "10px" }}>
          {MINI_ART.join("\n")}
        </div>
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <div style={{ color: "#DB0028", fontSize: 12, fontWeight: 400, letterSpacing: "0.02em" }}>
            Shotoku
          </div>
          <div style={{ color: "rgba(0,0,0,0.38)", fontSize: 10, marginTop: 2 }}>
            Local-first authorization for AI agents.
          </div>
        </div>
      </div>

      {!hasPending && !isApproved && !isDenied && (
        <>
          <div style={{ color: "rgba(0,0,0,0.30)" }}>Listening for decisions...</div>
          <Blank />
          <div style={{ color: "rgba(0,0,0,0.16)" }}>No pending approvals.</div>
        </>
      )}

      {hasPending && (
        <>
          <div style={{ color: "#DB0028", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em", marginBottom: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>◷</span>
            <span>Pending{"  "}{scenario.decisionId}</span>
          </div>
          <div>
            <span style={{ color: "rgba(0,0,0,0.42)" }}>{scenario.actor}</span>
            <span style={{ color: "rgba(0,0,0,0.22)" }}>{" → "}</span>
            <span>{scenario.nextActionLabel}</span>
          </div>
          <div style={{ color: "rgba(0,0,0,0.42)" }}>{scenario.shotokuVendorLine}</div>
          <Blank />

          {inReview ? (
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <button
                onClick={onApprove}
                className="cursor-pointer transition-opacity hover:opacity-75"
                style={{
                  padding: "3px 10px",
                  border: "none",
                  borderRadius: 5,
                  background: "#166534",
                  color: "#ffffff",
                  font: "inherit",
                }}
              >
                ↵ approve
              </button>
              <button
                onClick={onDeny}
                className="cursor-pointer transition-opacity hover:opacity-75"
                style={{
                  padding: "3px 10px",
                  border: "none",
                  borderRadius: 5,
                  background: "#991b1b",
                  color: "#ffffff",
                  font: "inherit",
                }}
              >
                d deny
              </button>
              {countdown !== null && (
                <span style={{ color: "rgba(0,0,0,0.26)" }}>auto in {countdown}…</span>
              )}
            </div>
          ) : (
            <>
              <div style={{ color: "rgba(0,0,0,0.35)" }}>→ Waiting for Shotoku approval</div>
              <Blank />
            </>
          )}

          <div style={{ color: "#DB0028", fontSize: 10, letterSpacing: "0.06em", opacity: 0.7, marginBottom: 8 }}>Reasons</div>
          {scenario.pendingReasons.map((r, i) => <div key={i}>{"  "}• {r}</div>)}
        </>
      )}

      {isApproved && (
        <>
          <div style={{ color: "#166534", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em", marginBottom: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✓</span>
            <span>Approved{"  "}{scenario.decisionId}</span>
          </div>
          <div>{"  "}• Approved by user</div>
          <div>{"  "}• Daily budget remaining: {scenario.approvedBudget}</div>
          <div>{"  "}• Recorded locally</div>
          <Blank />
          <div style={{ color: "rgba(0,0,0,0.32)" }}>audit log: data/decisions.jsonl</div>
        </>
      )}

      {isDenied && (
        <>
          <div style={{ color: "#991b1b", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4em", marginBottom: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✗</span>
            <span>Denied{"  "}{scenario.decisionId}</span>
          </div>
          <div>{"  "}• Denied by user</div>
          <div>{"  "}• Agent cannot continue</div>
          <div>{"  "}• No charges were made</div>
          <Blank />
          <div style={{ color: "rgba(0,0,0,0.32)" }}>audit log: data/decisions.jsonl</div>
        </>
      )}
    </div>
  );
}

// ─── Terminal toast ───────────────────────────────────────────────────────────

type ToastKind = "pending" | "approved" | "denied" | "hidden";

function TerminalToast({ kind, decisionId }: { kind: ToastKind; decisionId: string }) {
  const visible = kind !== "hidden";

  const statusText =
    kind === "approved" ? `${decisionId} approved` :
    kind === "denied"   ? `${decisionId} denied`   :
                          "1 pending approval";

  return (
    <motion.div
      initial={{ opacity: 0, y: -56 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -56 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        top: 18,
        right: 18,
        zIndex: 30,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(242, 241, 237, 0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)",
          padding: "3px 14px 3px 5px",
        }}
      >
        <Image
          src="/assets/brand/shotoku-logo-rw.svg"
          alt="Shotoku"
          width={44}
          height={44}
          style={{ display: "block", flexShrink: 0, borderRadius: 10 }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div
            style={{
              color: "#0A0A0A",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "system-ui, -apple-system, sans-serif",
              lineHeight: 1.3,
            }}
          >
            Shotoku
          </div>
          <div
            style={{
              color: "rgba(0,0,0,0.55)",
              fontSize: 11,
              fontFamily: "system-ui, -apple-system, sans-serif",
              lineHeight: 1.3,
            }}
          >
            {statusText}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SHOTOKU_W = 400;
const SHOTOKU_H = 398;

export default function HeroPlayground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state,        setState]       = useState<DemoState>("idle");
  const [typedIndex,   setTypedIndex]  = useState(0);
  const [countdown,    setCountdown]   = useState<number | null>(null);
  const [scenarioIdx,  setScenarioIdx] = useState(0);
  const [shotokuPos,   setShotokuPos]  = useState<{ x: number; y: number } | null>(null);

  const scenario = SCENARIOS[scenarioIdx % SCENARIOS.length]!;
  const segments = buildSegments(scenario);
  const command  = segments.map((s) => s.text).join("");

  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    setShotokuPos({
      x: Math.max(32, c.clientWidth  - SHOTOKU_W - DRAG_PAD),
      y: Math.max(48, c.clientHeight - SHOTOKU_H - DRAG_PAD),
    });
  }, []);

  // Advance scenario each loop
  useEffect(() => {
    if (state === "resetting") setScenarioIdx((i) => i + 1);
  }, [state]);

  // Auto-play state machine
  useEffect(() => {
    const entry = AUTO_TRANSITIONS[state];
    if (!entry) return;
    const [next, delay] = entry;
    const t = setTimeout(() => setState(next), delay);
    return () => clearTimeout(t);
  }, [state]);

  // Reset typewriter on loop
  useEffect(() => {
    if (state === "idle" || state === "resetting") setTypedIndex(0);
  }, [state]);

  // Typewriter
  useEffect(() => {
    if (state !== "typing_command") return;
    if (typedIndex >= command.length) {
      const t = setTimeout(() => setState("checking_policy"), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTypedIndex((i) => i + 1), MS_PER_CHAR);
    return () => clearTimeout(t);
  }, [state, typedIndex, command]);

  // Start countdown after idle time in review
  useEffect(() => {
    if (state !== "shotoku_review") { setCountdown(null); return; }
    const t = setTimeout(() => setCountdown(COUNTDOWN_FROM), COUNTDOWN_DELAY_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Tick countdown — auto outcome per scenario
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setState(scenario.autoOutcome === "approve" ? "approved" : "denied");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, scenario.autoOutcome]);

  const handleApprove = useCallback(() => { setCountdown(null); setState("approved"); }, []);
  const handleDeny    = useCallback(() => { setCountdown(null); setState("denied");   }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state !== "shotoku_review") return;
      if (e.key === "Enter") { e.preventDefault(); handleApprove(); }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); handleDeny(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, handleApprove, handleDeny]);

  const agentFront = !["shotoku_review", "approved", "denied"].includes(state);

  const toastKind: ToastKind =
    state === "pending_approval"                  ? "pending"  :
    ["approved", "agent_success"].includes(state) ? "approved" :
    ["denied",   "agent_blocked"].includes(state) ? "denied"   :
    "hidden";

  const agentTitle = (() => {
    if (state === "typing_command" || state === "checking_policy") return `${scenario.actor} · requesting authorization`;
    if (state === "pending_approval" || state === "shotoku_review") return `${scenario.actor} · waiting for approval`;
    if (state === "approved")      return `${scenario.actor} · action approved`;
    if (state === "denied")        return `${scenario.actor} · action denied`;
    if (state === "agent_success") return `${scenario.actor} · completed`;
    if (state === "agent_blocked") return `${scenario.actor} · blocked`;
    return scenario.actor;
  })();

  const shotokuTitle = state === "shotoku_review" ? "Shotoku · pending approvals" : "Shotoku";

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        height: "clamp(480px, 72vh, 760px)",
        backgroundImage: "url('/assets/images/hero-img-2.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        userSelect: "none",
        borderRadius: 6,
      }}
    >
      <TerminalToast kind={toastKind} decisionId={scenario.decisionId} />

      <WindowShell
        title={agentTitle}
        isActive={agentFront}
        zIndex={agentFront ? 10 : 5}
        offsetX={32}
        offsetY={40}
        width={340}
        height={306}
        containerRef={containerRef}
      >
        <AgentBody state={state} charsTyped={typedIndex} scenario={scenario} segments={segments} />
      </WindowShell>

      {shotokuPos && (
        <WindowShell
          title={shotokuTitle}
          isActive={!agentFront}
          zIndex={agentFront ? 5 : 10}
          offsetX={shotokuPos.x}
          offsetY={shotokuPos.y}
          width={SHOTOKU_W}
          height={SHOTOKU_H}
          containerRef={containerRef}
        >
          <ShotokuBody
            state={state}
            countdown={countdown}
            scenario={scenario}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        </WindowShell>
      )}
    </div>
  );
}
