"use client";

import { useState, useCallback } from "react";

const CMD = "npm install -g shotoku-cli";

export default function CopyInstallCommand() {
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState<"copy" | "copied!">("copy");
  const [labelVisible, setLabelVisible] = useState(true);

  const handleClick = useCallback(async () => {
    await navigator.clipboard.writeText(CMD);
    setLabel("copied!");
    setLabelVisible(true);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setLabelVisible(false);
      setTimeout(() => {
        setLabel("copy");
        setLabelVisible(true);
      }, 250);
    }, 2000);
  }, []);

  return (
    <button
      onClick={handleClick}
      className="group flex items-center gap-2 px-3 py-2 rounded-[10px] transition-[background-color,scale] duration-150 ease-out hover:bg-black/8 active:scale-[0.97]"
      style={{
        background: "rgba(0,0,0,0.05)",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 13,
          color: "#0A0A0A",
          letterSpacing: "-0.01em",
        }}
      >
        {CMD}
      </span>
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 11,
          color: copied ? "var(--brand-red)" : "rgba(0,0,0,0.35)",
          overflow: "hidden",
          display: "inline-block",
          maxWidth: copied ? 52 : 28,
          whiteSpace: "nowrap",
          verticalAlign: "middle",
          opacity: labelVisible ? 1 : 0,
          transition: "max-width 0.25s ease, color 0.15s ease, opacity 0.1s ease",
        }}
      >
        {label}
      </span>
    </button>
  );
}
