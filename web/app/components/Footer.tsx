"use client";

import Image from "next/image";

const NAV_COLUMNS = [
  {
    label: "Product",
    links: [
      { text: "Docs",      href: "/docs"      },
      { text: "Changelog", href: "/changelog" },
    ],
  },
  {
    label: "Developers",
    links: [
      { text: "Quickstart",    href: "/docs/quickstart" },
      { text: "API Reference", href: "/docs/api"        },
    ],
  },
  {
    label: "Community",
    links: [
      { text: "GitHub",      href: "https://github.com/shotoku-dev/shotoku", external: true },
      { text: "X / Twitter", href: "https://x.com/shotokudev",               external: true },
    ],
  },
];

const LEGAL_LINKS = [
  { text: "Privacy",     href: "/privacy" },
  { text: "Terms",       href: "/terms"   },
  { text: "MIT License", href: "/license" },
];

function StatusDot() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: "50%",
          border: "1.5px solid #22c55e",
          animation: "ring-expand 2.4s ease-out infinite",
        }}
      />
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#22c55e",
          display: "block",
          flexShrink: 0,
        }}
      />
    </span>
  );
}

export default function Footer() {
  return (
    <footer
      style={{
        background: "#ffffff",
        padding: "80px 256px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Top row: logo + nav columns */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 64 }}>
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flexShrink: 0, width: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Image
              src="/assets/brand/shotoku-logo-rw.svg"
              alt="Shotoku"
              width={44}
              height={44}
              style={{ marginLeft: -7, display: "block" }}
            />
            <span
              style={{
                fontFamily: "Satoshi, var(--font-geist), sans-serif",
                fontSize: 17,
                fontWeight: 500,
                color: "#0A0A0A",
                letterSpacing: "-0.02em",
              }}
            >
              Shotoku
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-geist), sans-serif",
              fontSize: 12,
              color: "rgba(0,0,0,0.4)",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            Local-first authorization layer for AI agents.
          </p>
        </div>

        {/* Nav columns */}
        <div style={{ display: "flex", gap: 40, flex: 1, justifyContent: "flex-end" }}>
          {NAV_COLUMNS.map((col) => (
            <div key={col.label} style={{ display: "flex", flexDirection: "column", minWidth: 110 }}>
              <span
                style={{
                  fontFamily: "var(--font-geist), sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(0,0,0,0.55)",
                  letterSpacing: "-0.01em",
                  marginBottom: 8,
                }}
              >
                {col.label}
              </span>
              {col.links.map((link) => (
                <a
                  key={link.text}
                  href={link.href}
                  style={{
                    fontFamily: "var(--font-geist), sans-serif",
                    fontSize: 13,
                    color: "rgba(0,0,0,0.45)",
                    textDecoration: "none",
                    display: "block",
                    padding: "5px 0",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.85)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.45)")}
                  {...('external' in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {link.text}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot />
          <span
            style={{
              fontFamily: "var(--font-geist), sans-serif",
              fontSize: 12,
              color: "rgba(0,0,0,0.35)",
            }}
          >
            All systems operational
          </span>
        </div>

        {/* Legal */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {LEGAL_LINKS.map((link, i) => (
            <div key={link.text} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {i > 0 && (
                <span style={{ color: "rgba(0,0,0,0.15)", fontSize: 11, lineHeight: 1 }}>·</span>
              )}
              <a
                href={link.href}
                style={{
                  fontFamily: "var(--font-geist), sans-serif",
                  fontSize: 12,
                  color: "rgba(0,0,0,0.3)",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.7)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.3)")}
              >
                {link.text}
              </a>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <span
          style={{
            fontFamily: "var(--font-geist), sans-serif",
            fontSize: 12,
            color: "rgba(0,0,0,0.25)",
          }}
        >
          © 2026 Shotoku
        </span>
      </div>
    </footer>
  );
}
