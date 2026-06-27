"use client";

import { useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CopyIcon, type CopyIconHandle } from "../icons/CopyIcon";
import { CheckIcon, type CheckIconHandle } from "../icons/CheckIcon";

// Exact colours from LocalFirstSectionD (4th stacking card)
const C_KW  = "#FF3B4E"; // keywords, function names
const C_STR = "#8B6348"; // strings, values
const C_CMT = "#A98586"; // comments
const C_NUM = "#B05A00"; // numbers
const C_DEF = "#0F0D0C"; // default text

type Token = { text: string; color?: string };

const TS_KEYWORDS = /\b(import|export|from|const|let|var|async|await|function|return|if|else|true|false|null|undefined|interface|type|readonly|as|new|class|extends|implements|throw|try|catch|typeof|instanceof|of|in)\b/;

function tokenizeTS(code: string): Token[] {
  // Match in priority order: template literals, strings, comments, keywords
  const pattern = new RegExp(
    [
      /`(?:[^`\\]|\\.)*`/.source,         // template literals
      /"(?:[^"\\]|\\.)*"/.source,          // double-quoted strings
      /'(?:[^'\\]|\\.)*'/.source,          // single-quoted strings
      /\/\/[^\n]*/.source,                 // line comments
      /\/\*[\s\S]*?\*\//.source,           // block comments
      /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.source, // numbers
      TS_KEYWORDS.source,                  // keywords
    ].join("|"),
    "g",
  );

  const result: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(code)) !== null) {
    if (m.index > last) result.push({ text: code.slice(last, m.index), color: C_DEF });
    const t = m[0];
    if (t.startsWith("//") || t.startsWith("/*")) {
      result.push({ text: t, color: C_CMT });
    } else if (t.startsWith('"') || t.startsWith("'") || t.startsWith("`")) {
      result.push({ text: t, color: C_STR });
    } else if (/^\d/.test(t) || t.startsWith("-")) {
      result.push({ text: t, color: C_NUM });
    } else {
      result.push({ text: t, color: C_KW });
    }
    last = m.index + t.length;
  }
  if (last < code.length) result.push({ text: code.slice(last), color: C_DEF });
  return result;
}

function tokenizeYAML(code: string): Token[] {
  const result: Token[] = [];
  const lines = code.split("\n");

  lines.forEach((line, i) => {
    if (i > 0) result.push({ text: "\n" });
    if (!line) return;

    const trimmed = line.trimStart();
    const indent  = line.slice(0, line.length - trimmed.length);
    if (indent) result.push({ text: indent, color: C_DEF });

    if (trimmed.startsWith("#")) {
      result.push({ text: trimmed, color: C_CMT });
      return;
    }

    let rest = trimmed;
    if (rest.startsWith("- ")) {
      result.push({ text: "- ", color: C_DEF });
      rest = rest.slice(2);
    }

    const ci = rest.indexOf(":");
    if (ci !== -1) {
      result.push({ text: rest.slice(0, ci), color: C_KW });
      result.push({ text: ":", color: C_DEF });
      const val = rest.slice(ci + 1);
      if (val.trim()) result.push({ text: val, color: C_STR });
    } else {
      result.push({ text: rest, color: C_STR });
    }
  });

  return result;
}

function tokenizeJSON(code: string): Token[] {
  const pattern = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const result: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(code)) !== null) {
    if (m.index > last) result.push({ text: code.slice(last, m.index), color: C_DEF });
    if (m[1]) {
      const ci = m[1].lastIndexOf(":");
      result.push({ text: m[1].slice(0, ci), color: C_KW });
      result.push({ text: m[1].slice(ci),    color: C_DEF });
    } else if (m[2]) {
      result.push({ text: m[2], color: C_STR });
    } else if (m[3]) {
      result.push({ text: m[3], color: C_KW });
    } else if (m[4]) {
      result.push({ text: m[4], color: C_NUM });
    }
    last = m.index + m[0].length;
  }
  if (last < code.length) result.push({ text: code.slice(last), color: C_DEF });
  return result;
}

function tokenizeBash(code: string): Token[] {
  // Negative lookbehind prevents matching hyphens inside compound words (e.g. shotoku-cli)
  const pattern = /(#[^\n]*)|(?<![a-zA-Z0-9])(--?[a-zA-Z][-a-zA-Z0-9]*)|(["'])(?:(?!\3)[^\\]|\\.)*\3/g;
  const result: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(code)) !== null) {
    if (m.index > last) result.push({ text: code.slice(last, m.index), color: C_DEF });
    if (m[1]) {
      result.push({ text: m[1], color: C_CMT });
    } else if (m[2]) {
      result.push({ text: m[2], color: C_KW });
    } else {
      result.push({ text: m[0], color: C_STR });
    }
    last = m.index + m[0].length;
  }
  if (last < code.length) result.push({ text: code.slice(last), color: C_DEF });
  return result;
}

function tokenize(code: string, lang: string): Token[] {
  switch (lang) {
    case "typescript": case "ts": case "javascript": case "js":
      return tokenizeTS(code);
    case "yaml": case "yml":
      return tokenizeYAML(code);
    case "json":
      return tokenizeJSON(code);
    case "bash": case "shell": case "sh":
      return tokenizeBash(code);
    default:
      return [{ text: code, color: C_DEF }];
  }
}

// ─────────────────────────────────────────

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
}

export function CodeBlock({ code, lang, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copyRef  = useRef<CopyIconHandle>(null);
  const checkRef = useRef<CheckIconHandle>(null);

  const handleCopy = useCallback(async () => {
    if (copied) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    checkRef.current?.startAnimation();
    setTimeout(() => {
      setCopied(false);
      checkRef.current?.stopAnimation();
    }, 2000);
  }, [code, copied]);

  const label  = filename ?? lang;
  const tokens = lang ? tokenize(code, lang) : [{ text: code, color: C_DEF }];

  return (
    <div
      style={{
        position:     "relative",
        background:   "rgba(0,0,0,0.025)",
        border:       "1px solid rgba(0,0,0,0.08)",
        borderRadius: 8,
        margin:       "16px 0",
        overflow:     "hidden",
      }}
    >
      {label && (
        <div
          style={{
            padding:      "5px 14px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            background:   "rgba(0,0,0,0.02)",
          }}
        >
          <span
            style={{
              fontSize:   11,
              color:      "rgba(0,0,0,0.3)",
              fontFamily: "Satoshi, var(--font-geist), sans-serif",
            }}
          >
            {label}
          </span>
        </div>
      )}

      <pre
        style={{
          margin:     0,
          padding:    "14px 16px",
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize:   12.5,
          lineHeight: 1.75,
          overflowX:  "auto",
          whiteSpace: "pre",
        }}
      >
        <code>
          {tokens.map((t, i) =>
            t.color
              ? <span key={i} style={{ color: t.color }}>{t.text}</span>
              : t.text
          )}
        </code>
      </pre>

      <button
        onClick={handleCopy}
        aria-label="Copy code"
        style={{
          position:       "absolute",
          bottom:         10,
          right:          10,
          background:     "none",
          border:         "none",
          padding:        4,
          cursor:         "pointer",
          color:          copied ? "var(--brand-red)" : "rgba(0,0,0,0.28)",
          borderRadius:   6,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          transition:     "color 0.2s ease",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex" }}
            >
              <CheckIcon ref={checkRef} size={14} />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex" }}
            >
              <CopyIcon ref={copyRef} size={14} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily:   "Satoshi, var(--font-geist), sans-serif",
        fontSize:     "0.875em",
        fontWeight:   500,
        background:   "rgba(0,0,0,0.05)",
        border:       "1px solid rgba(0,0,0,0.07)",
        borderRadius: 4,
        padding:      "1px 6px",
        color:        "#0A0A0A",
      }}
    >
      {children}
    </code>
  );
}
