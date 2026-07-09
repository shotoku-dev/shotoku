"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Openai, Claude, Perplexity, Grok } from "@thesvg/react";
import { IconArrowForward } from "@tabler/icons-react";
import { CopyIcon, type CopyIconHandle } from "./icons/CopyIcon";
import { CheckIcon, type CheckIconHandle } from "./icons/CheckIcon";

interface IconEntry {
  type: "component";
  Icon: React.ElementType;
  style?: React.CSSProperties;
}
interface ImgEntry {
  type: "img";
  src: string;
  alt: string;
  style?: React.CSSProperties;
}
type IconDef = IconEntry | ImgEntry;

const ICONS: IconDef[] = [
  { type: "component", Icon: Openai,     style: { filter: "invert(1)" } },
  { type: "component", Icon: Claude      },
  { type: "img",       src: "/icons/gemini.svg",  alt: "Gemini"  },
  { type: "component", Icon: Perplexity  },
  { type: "component", Icon: Grok,       style: { filter: "invert(1)" } },
  { type: "img",       src: "/icons/cursor.svg",  alt: "Cursor"  },
];

// Colours from the 4th stacking card (LocalFirstSectionD)
const C_KEY = "#FF3B4E";
const C_STR = "#8B6348";
const C_PUN = "rgba(15,13,12,0.38)";

function JsonLine({ children }: { children: React.ReactNode }) {
  return <div style={{ lineHeight: "20px" }}>{children}</div>;
}
function K({ v }: { v: string }) {
  return <span style={{ color: C_KEY }}>&quot;{v}&quot;</span>;
}
function S({ v }: { v: string }) {
  return <span style={{ color: C_STR }}>&quot;{v}&quot;</span>;
}
function P({ v }: { v: string }) {
  return <span style={{ color: C_PUN }}>{v}</span>;
}
const sp = (n: number) => " ".repeat(n);

function HighlightedConfig() {
  return (
    <pre
      style={{
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 11.5,
        lineHeight: "20px",
        padding: "14px 16px",
        margin: 0,
        userSelect: "text",
        whiteSpace: "pre",
      }}
    >
      <JsonLine><P v="{" /></JsonLine>
      <JsonLine>{sp(2)}<K v="mcpServers" /><P v=": {" /></JsonLine>
      <JsonLine>{sp(4)}<K v="shotoku" /><P v=": {" /></JsonLine>
      <JsonLine>{sp(6)}<K v="command" /><P v=": " /><S v="npx" /><P v="," /></JsonLine>
      <JsonLine>{sp(6)}<K v="args" /><P v=": [" /><S v="shotoku-mcp" /><P v="]" /></JsonLine>
      <JsonLine>{sp(4)}<P v="}" /></JsonLine>
      <JsonLine>{sp(2)}<P v="}" /></JsonLine>
      <JsonLine><P v="}" /></JsonLine>
    </pre>
  );
}

const slideVariants = {
  enter:  { y: "100%" },
  center: { y: "0%"   },
  exit:   { y: "-100%"},
};

const popoverVariants = {
  hidden:  { opacity: 0, y: -6, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1    },
};

function IconSlot({ def }: { def: IconDef }) {
  if (def.type === "img") {
    return (
      <img
        src={def.src}
        alt={def.alt}
        width={15}
        height={15}
        style={{ display: "block", width: 15, height: 15, ...def.style }}
      />
    );
  }
  const { Icon, style } = def;
  return <Icon className="w-[15px] h-[15px]" style={{ display: "block", ...style }} />;
}

const MCP_CONFIG = `{
  "mcpServers": {
    "shotoku": {
      "command": "npx",
      "args": ["shotoku-mcp"]
    }
  }
}`;

export default function ConnectWithAI() {
  const [idx, setIdx]       = useState(0);
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef          = useRef<HTMLDivElement>(null);
  const copyRef             = useRef<CopyIconHandle>(null);
  const checkRef            = useRef<CheckIconHandle>(null);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ICONS.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopy = useCallback(async () => {
    if (copied) return;
    await navigator.clipboard.writeText(MCP_CONFIG);
    setCopied(true);
    checkRef.current?.startAnimation();
    setTimeout(() => {
      setCopied(false);
      checkRef.current?.stopAnimation();
      setOpen(false);
    }, 1200);
  }, [copied]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-[10px] transition-[background-color,scale] duration-150 ease-out hover:bg-black/5 active:scale-[0.97]"
        style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.12)", cursor: "pointer" }}
      >
        <div style={{ width: 15, height: 15, position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={idx}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.32, 0, 0.67, 0] }}
              style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <IconSlot def={ICONS[idx]!} />
            </motion.div>
          </AnimatePresence>
        </div>

        <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.65)", fontFamily: "Satoshi, var(--font-geist), sans-serif", letterSpacing: "-0.01em" }}>
          Add to your AI
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 50,
              width: 320,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "relative" }}>
              <HighlightedConfig />
              <button
                onClick={handleCopy}
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 10,
                  background: "none",
                  border: "none",
                  padding: 4,
                  cursor: "pointer",
                  color: copied ? "var(--brand-red)" : "rgba(0,0,0,0.30)",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.3s ease",
                }}
                aria-label="Copy config"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      style={{ display: "flex" }}
                    >
                      <CheckIcon ref={checkRef} size={14} style={{ pointerEvents: "none" }} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      style={{ display: "flex" }}
                    >
                      <CopyIcon ref={copyRef} size={14} style={{ pointerEvents: "none" }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
      <a
        href="https://cal.eu/shotoku.julius/design-partner-collaboration"
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={e => { const s = e.currentTarget.querySelector<HTMLSpanElement>("[data-sub]"); if (s) s.style.color = "#0A0A0A"; }}
        onMouseLeave={e => { const s = e.currentTarget.querySelector<HTMLSpanElement>("[data-sub]"); if (s) s.style.color = "rgba(0,0,0,0.38)"; }}
        style={{
          fontFamily: "Satoshi, var(--font-geist), sans-serif",
          textDecoration: "none",
          letterSpacing: "-0.01em",
          display: "inline-flex",
          flexDirection: "column",
          gap: 3,
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 14, color: "#0A0A0A" }}>
          Want to become a design partner ?
        </span>
        <span data-sub="" style={{ fontSize: 14, color: "rgba(0,0,0,0.38)", paddingLeft: 16, display: "flex", alignItems: "center", gap: 4, transition: "color 0.15s" }}>
          <IconArrowForward size={14} stroke={1.5} />
          Let&apos;s chat
        </span>
      </a>
    </div>
  );
}
