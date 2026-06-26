"use client";

import { useRef, useLayoutEffect, useState, useCallback } from "react";

// ── Data ───────────────────────────────────────────────────────────────────────

const CARDS = [
  { label: "Call APIs",     hint: "POST /v1/messages"   },
  { label: "Execute code",  hint: "node script.ts"      },
  { label: "Use MCP tools", hint: "tool.invoke()"       },
  { label: "Spend money",   hint: "$42 payment request" },
] as const;

const PILLS = [
  { symbol: "✓", label: "Approved", color: "#166534" },
  { symbol: "✕", label: "Denied",   color: "#991b1b" },
  { symbol: "◷", label: "Pending",  color: "#92400e" },
] as const;

interface SvgPath { d: string; key: string }
interface SvgDot  { cx: number; cy: number; key: string }

// ── Component ──────────────────────────────────────────────────────────────────

export default function CheckpointSectionVertical() {
  const diagramRef = useRef<HTMLDivElement>(null);
  const shotokuRef = useRef<HTMLDivElement>(null);
  const pillsRef   = useRef<HTMLDivElement>(null);
  const c0Ref      = useRef<HTMLDivElement>(null);
  const c1Ref      = useRef<HTMLDivElement>(null);
  const c2Ref      = useRef<HTMLDivElement>(null);
  const c3Ref      = useRef<HTMLDivElement>(null);

  const [paths,   setPaths]   = useState<SvgPath[]>([]);
  const [dots,    setDots]    = useState<SvgDot[]>([]);
  const [svgDims, setSvgDims] = useState({ w: 0, h: 0 });

  const recalc = useCallback(() => {
    const dr = diagramRef.current;
    const sr = shotokuRef.current;
    const pr = pillsRef.current;
    const cardEls = [c0Ref, c1Ref, c2Ref, c3Ref].map((r) => r.current);
    if (!dr || !sr || !pr || cardEls.some((el) => !el)) return;

    const db = dr.getBoundingClientRect();
    const sb = sr.getBoundingClientRect();
    const pb = pr.getBoundingClientRect();

    const ox = db.left;
    const oy = db.top;

    const sCX  = sb.left + sb.width  / 2 - ox;
    const sTop = sb.top  - oy;
    const sBot = sb.bottom - oy;
    const pTop = pb.top  - oy;

    const cards = cardEls.map((el) => {
      const b = el!.getBoundingClientRect();
      return { cx: b.left + b.width / 2 - ox, bottom: b.bottom - oy };
    });

    const maxBottom = Math.max(...cards.map((c) => c.bottom));
    const gatherY   = maxBottom + (sTop - maxBottom) * 0.42;
    const minCX     = Math.min(...cards.map((c) => c.cx));
    const maxCX     = Math.max(...cards.map((c) => c.cx));

    const ps: SvgPath[] = [];
    const ds: SvgDot[]  = [];

    cards.forEach(({ cx, bottom }, i) => {
      ps.push({ key: `feed-${i}`, d: `M ${cx} ${bottom} V ${gatherY}` });
      ds.push({ key: `dot-card-${i}`, cx, cy: bottom });
    });

    ps.push({ key: "gather",   d: `M ${minCX} ${gatherY} H ${maxCX}` });
    ps.push({ key: "stem-in",  d: `M ${sCX} ${gatherY} V ${sTop}` });
    ds.push({ key: "dot-shotoku-top", cx: sCX, cy: sTop });

    ps.push({ key: "stem-out", d: `M ${sCX} ${sBot} V ${pTop}` });
    ds.push({ key: "dot-shotoku-bot", cx: sCX, cy: sBot });

    setPaths(ps);
    setDots(ds);
    setSvgDims({ w: db.width, h: db.height });
  }, []);

  useLayoutEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  const cardRefs = [c0Ref, c1Ref, c2Ref, c3Ref];

  return (
    <section style={{ background: "#ffffff", padding: "0 32px 64px" }}>
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          background: "#F2F1ED",
          borderRadius: 10,
          padding: "60px 64px",
        }}
      >
        {/* ── Header — centered ── */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2
            style={{
              color: "#0A0A0A",
              fontSize: 13.5,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.6,
              marginBottom: 8,
              fontFamily: "Satoshi, var(--font-geist), sans-serif",
            }}
          >
            Agents act. Shotoku checks first.
          </h2>
          <p
            style={{
              color: "rgba(0,0,0,0.42)",
              fontSize: 13.5,
              lineHeight: 1.6,
              fontFamily: "var(--font-geist), sans-serif",
            }}
          >
            Every autonomous action needs a decision.
          </p>
        </div>

        {/* ── Vertical flow diagram ── */}
        <div
          ref={diagramRef}
          style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {/* SVG connector overlay */}
          {svgDims.w > 0 && (
            <svg
              width={svgDims.w}
              height={svgDims.h}
              style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
            >
              <defs>
                <style>{`@keyframes flowDownV { to { stroke-dashoffset: -12; } }`}</style>
              </defs>

              {paths.map((p) => (
                <path key={`base-${p.key}`} d={p.d} fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="1" />
              ))}

              {paths.map((p) => (
                <path
                  key={`anim-${p.key}`}
                  d={p.d}
                  fill="none"
                  stroke="rgba(0,0,0,0.18)"
                  strokeWidth="1"
                  strokeDasharray="2 8"
                  style={{ animation: "flowDownV 1.8s linear infinite" }}
                />
              ))}

              {dots.map((d) => (
                <circle key={d.key} cx={d.cx} cy={d.cy} r="2" fill="#E0DED9" stroke="rgba(0,0,0,0.14)" strokeWidth="1" />
              ))}
            </svg>
          )}

          {/* Action cards — 1×4 row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 150px)",
              gap: 9,
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            {CARDS.map((card, i) => (
              <div
                key={card.label}
                ref={cardRefs[i]}
                style={{
                  aspectRatio: "1",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.55)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: "rgba(0,0,0,0.06)",
                    borderRadius: 4,
                    marginBottom: 12,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    color: "#0A0A0A",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 4,
                    fontFamily: "Satoshi, var(--font-geist), sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    color: "rgba(0,0,0,0.30)",
                    fontSize: 10,
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {card.hint}
                </div>
              </div>
            ))}
          </div>

          {/* Spacer — connectors run through here */}
          <div style={{ height: 44 }} />

          {/* Shotoku checkpoint card */}
          <div
            ref={shotokuRef}
            style={{
              padding: "16px 28px",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 10,
              background: "#ffffff",
              textAlign: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                color: "#DB0028",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.01em",
                marginBottom: 6,
                fontFamily: "Satoshi, var(--font-geist), sans-serif",
              }}
            >
              Shotoku
            </div>
            <div
              style={{
                color: "rgba(0,0,0,0.35)",
                fontSize: 10,
                fontFamily: "var(--font-geist-mono), monospace",
                letterSpacing: "0.01em",
              }}
            >
              policy → decision → local record
            </div>
          </div>

          {/* Spacer — Shotoku → pills */}
          <div style={{ height: 36 }} />

          {/* Decision outcomes */}
          <div
            ref={pillsRef}
            style={{ display: "flex", gap: 24, position: "relative", zIndex: 1 }}
          >
            {PILLS.map((pill) => (
              <span
                key={pill.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 10,
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: pill.color }}>{pill.symbol}</span>
                <span style={{ color: "rgba(0,0,0,0.38)" }}>{pill.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
