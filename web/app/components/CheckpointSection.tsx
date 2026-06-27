"use client";

import { useRef, useLayoutEffect, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type MotionStyle,
} from "motion/react";
import { WebhookIcon,    type WebhookIconHandle    } from "./icons/WebhookIcon";
import { FolderCodeIcon, type FolderCodeIconHandle } from "./icons/FolderCodeIcon";
import { BlocksIcon,     type BlocksIconHandle     } from "./icons/BlocksIcon";
import { CreditCardIcon, type CreditCardIconHandle } from "./icons/CreditCardIcon";

// ── Data ───────────────────────────────────────────────────────────────────────

const CARDS = [
  { label: "Call APIs",     hint: "POST /v1/messages",   Icon: WebhookIcon    },
  { label: "Execute code",  hint: "node script.ts",      Icon: FolderCodeIcon },
  { label: "Use MCP tools", hint: "tool.invoke()",       Icon: BlocksIcon     },
  { label: "Spend money",   hint: "$42 payment request", Icon: CreditCardIcon },
] as const;

interface SvgPath { d: string; key: string }
interface SvgDot  { cx: number; cy: number; key: string }

// ── Constants ──────────────────────────────────────────────────────────────────

const PILL_WIDTH = 308;
const LOGO_W     = 52;
const DRAG_MAX   = PILL_WIDTH - LOGO_W; // 256

// ── Shotoku pill — collapse-x variant ─────────────────────────────────────────

function ShotokuPill({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) {
  const dragX      = useMotionValue(0);
  const containerW = useTransform(dragX, [0, DRAG_MAX], [LOGO_W, PILL_WIDTH]);

  // Logo squeezes from its right side toward the left — like a venetian blind closing
  const logoScaleX = useTransform(dragX, [0, DRAG_MAX * 0.45], [1, 0]);

  const textOpacity = useMotionValue(0);

  useEffect(() => {
    let stopped = false;
    const wait = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    const run = async () => {
      await wait(600);
      while (!stopped) {
        // Expand container and logo, then fade text in once logo has exited
        const expanding = animate(dragX, DRAG_MAX, { duration: 0.9, ease: [0.32, 0.72, 0, 1] });
        await wait(420); // logo is gone at ~45% of 900ms
        if (stopped) break;
        await animate(textOpacity, 1, { duration: 0.25, ease: "easeOut" });
        await expanding;
        if (stopped) break;
        await wait(2200);
        if (stopped) break;
        // Fade text out first, then collapse — mirrors the delayed fade-in on expand
        await animate(textOpacity, 0, { duration: 0.25, ease: "easeIn" });
        if (stopped) break;
        await animate(dragX, 0, { type: "spring", stiffness: 340, damping: 36 });
        if (stopped) break;
        await wait(900);
      }
    };

    run();
    return () => { stopped = true; };
  }, [dragX, textOpacity]);

  return (
    <div
      ref={innerRef}
      style={{
        width: PILL_WIDTH,
        height: LOGO_W,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <motion.div
        style={{
          width: containerW,
          height: LOGO_W,
          overflow: "hidden",
          borderRadius: 4,
          background: "#ffffff",
          position: "relative",
          userSelect: "none",
        } as MotionStyle}
      >
      {/* Logo — collapses horizontally, left edge anchored; white bg masks text until open */}
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: LOGO_W,
          height: LOGO_W,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          transformOrigin: "left center",
          scaleX: logoScaleX,
          zIndex: 1,
        }}
      >
        <Image
          src="/assets/brand/shotoku-shape.svg"
          alt="Shotoku"
          width={40}
          height={40}
          style={{ display: "block" }}
          draggable={false}
        />
      </motion.div>

      {/* Text — fades in after logo exits, fades out before container clips it on collapse */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <span
          style={{
            color: "#0A0A0A",
            fontSize: 10,
            fontFamily: "var(--font-geist-mono), monospace",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          Policy Check → Approval Gate → Audit Log
        </span>
      </motion.div>
    </motion.div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CheckpointSection() {
  const diagramRef   = useRef<HTMLDivElement>(null);
  const centerDotRef = useRef<HTMLDivElement>(null);
  const shotokuRef   = useRef<HTMLDivElement>(null);
  const decisionRef  = useRef<HTMLDivElement>(null);

  const iconRef0 = useRef<WebhookIconHandle>(null);
  const iconRef1 = useRef<FolderCodeIconHandle>(null);
  const iconRef2 = useRef<BlocksIconHandle>(null);
  const iconRef3 = useRef<CreditCardIconHandle>(null);
  const iconRefs = [iconRef0, iconRef1, iconRef2, iconRef3] as const;

  const [paths,   setPaths]   = useState<SvgPath[]>([]);
  const [dots,    setDots]    = useState<SvgDot[]>([]);
  const [svgDims, setSvgDims] = useState({ w: 0, h: 0 });

  const recalc = useCallback(() => {
    const dr = diagramRef.current;
    const cd = centerDotRef.current;
    const sr = shotokuRef.current;
    const dc = decisionRef.current;
    if (!dr || !cd || !sr || !dc) return;

    const db  = dr.getBoundingClientRect();
    const cdb = cd.getBoundingClientRect();
    const sb  = sr.getBoundingClientRect();
    const dcb = dc.getBoundingClientRect();

    const ox = db.left;
    const oy = db.top;

    const dotCX = db.left + db.width / 2 - ox;
    const dotCY = cdb.top - oy;

    const sCX  = sb.left + sb.width  / 2 - ox;
    const sTop = sb.top    - oy;
    const sBot = sb.bottom - oy;
    const dTop = dcb.top   - oy;

    const NEAR = 7;

    setPaths([
      { key: "stem-in",  d: `M ${dotCX} ${dotCY + NEAR} V ${sTop - NEAR * 2}` },
      { key: "stem-out", d: `M ${sCX} ${sBot + NEAR * 2} V ${dTop - NEAR}` },
    ]);
    setDots([
      { key: "dot-center",      cx: dotCX, cy: dotCY       },
      { key: "dot-shotoku-top", cx: sCX,   cy: sTop - NEAR },
      { key: "dot-shotoku-bot", cx: sCX,   cy: sBot + NEAR },
    ]);
    setSvgDims({ w: db.width, h: db.height });
  }, []);

  useLayoutEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  return (
    <div
      style={{
        background: "#F2F1ED",
        borderRadius: 6,
        padding: "48px 64px 52px",
        display: "flex",
        alignItems: "center",
        gap: 64,
      }}
    >
        {/* ── Left: text ── */}
        <div style={{ flexShrink: 0, width: 300 }}>
          <h2
            style={{
              color: "#0A0A0A",
              fontSize: "1.5rem",
              fontWeight: 450,
              letterSpacing: "-0.025em",
              lineHeight: 1.35,
              marginBottom: 5,
              fontFamily: "Satoshi, var(--font-geist), sans-serif",
            }}
          >
            Agents act.<br />Shotoku checks first.
          </h2>
          <p
            style={{
              color: "rgba(0,0,0,0.45)",
              fontSize: "1.5rem",
              fontWeight: 450,
              letterSpacing: "-0.025em",
              lineHeight: 1.35,
              fontFamily: "Satoshi, var(--font-geist), sans-serif",
            }}
          >
            Every autonomous action<br />needs a decision.
          </p>
        </div>

        {/* ── Right: flow diagram ── */}
        <div style={{ flex: 1 }}>
          <div
            ref={diagramRef}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* SVG connector overlay */}
            {svgDims.w > 0 && (
              <svg
                width={svgDims.w}
                height={svgDims.h}
                style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
              >
                <defs>
                  <style>{`@keyframes flowDown { to { stroke-dashoffset: -10; } }`}</style>
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
                    style={{ animation: "flowDown 1.8s linear infinite" }}
                  />
                ))}
                {dots.map((d) => (
                  <circle key={d.key} cx={d.cx} cy={d.cy} r="2.5" fill="#D4D2CD" stroke="rgba(0,0,0,0.14)" strokeWidth="1" />
                ))}
              </svg>
            )}

            {/* 2×2 card grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 150px)",
                gap: 8,
                justifyContent: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              {CARDS.map((card, i) => (
                <div
                  key={card.label}
                  onMouseEnter={() => iconRefs[i].current?.startAnimation()}
                  onMouseLeave={() => iconRefs[i].current?.stopAnimation()}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 5,
                    background: "rgba(255,255,255,0.55)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 14px",
                    textAlign: "center",
                    cursor: "default",
                  }}
                >
                  <card.Icon
                    ref={iconRefs[i]}
                    size={26}
                    style={{ color: "#0A0A0A", marginBottom: 12, flexShrink: 0 }}
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

            {/* Zero-height anchor — SVG renders center dot here */}
            <div ref={centerDotRef} style={{ height: 0, marginTop: 12, alignSelf: "center" }} />

            {/* Spacer */}
            <div style={{ height: 36 }} />

            {/* Shotoku pill */}
            <ShotokuPill innerRef={shotokuRef} />

            {/* Spacer */}
            <div style={{ height: 44 }} />

            {/* Decision recorded locally */}
            <div
              ref={decisionRef}
              style={{
                padding: "10px 20px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.55)",
                textAlign: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              <span
                style={{
                  color: "#0A0A0A",
                  fontSize: 10,
                  fontFamily: "var(--font-geist-mono), monospace",
                  letterSpacing: "0.01em",
                }}
              >
                Decision recorded locally.
              </span>
            </div>
          </div>
        </div>
    </div>
  );
}
