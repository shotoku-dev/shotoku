"use client";

import Image from "next/image";

const NAV_COLUMNS = [
  {
    label: "Product",
    links: [
      { text: "Docs", href: "/docs" },
      { text: "Changelog", href: "/changelog" },
      { text: "Roadmap", href: "/roadmap" },
      { text: "CLI Reference", href: "/docs/cli" },
    ],
  },
  {
    label: "Developers",
    links: [
      { text: "Quickstart", href: "/docs/quickstart" },
      { text: "API Reference", href: "/docs/api" },
      { text: "MCP Integration", href: "/docs/mcp" },
      { text: "npm", href: "https://www.npmjs.com/package/shotoku-cli", external: true },
    ],
  },
  {
    label: "Community",
    links: [
      { text: "GitHub", href: "https://github.com/shotoku-dev/shotoku", external: true },
      { text: "Discord", href: "/discord", external: true },
      { text: "X / Twitter", href: "https://x.com/shotokudev", external: true },
      { text: "Blog", href: "/blog" },
    ],
  },
];

const LEGAL_LINKS = [
  { text: "Privacy", href: "/privacy" },
  { text: "Terms", href: "/terms" },
  { text: "MIT License", href: "https://github.com/shotoku-dev/shotoku/blob/main/LICENSE", external: true },
];

const LINK_STYLE = {
  fontFamily: "var(--font-geist), sans-serif",
  fontSize: 13,
  color: "rgba(0,0,0,0.45)",
  transition: "color 0.15s ease",
} as const;

const LINK_HOVER = "rgba(0,0,0,0.85)";
const LINK_DEFAULT = "rgba(0,0,0,0.45)";

function FooterLink({ text, href, external }: { text: string; href: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      style={LINK_STYLE}
      onMouseEnter={(e) => (e.currentTarget.style.color = LINK_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.color = LINK_DEFAULT)}
    >
      {text}
    </a>
  );
}

function StatusDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}>
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
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "block" }} />
    </span>
  );
}

export default function Footer() {
  return (
    <footer className="px-64 pt-20 pb-12 flex flex-col gap-16">
      {/* Top: logo + columns */}
      <div className="flex gap-16 items-start">
        <div className="flex flex-col gap-3 shrink-0" style={{ width: 220 }}>
          <div className="flex items-center gap-1">
            <Image src="/assets/brand/shotoku-logo-rw.svg" alt="Shotoku" width={44} height={44} style={{ marginLeft: -7 }} />
            <span style={{ fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 17, fontWeight: 500, color: "#0A0A0A", letterSpacing: "-0.02em" }}>
              Shotoku
            </span>
          </div>
          <p style={{ fontFamily: "var(--font-geist), sans-serif", fontSize: 12, color: "rgba(0,0,0,0.4)", lineHeight: 1.65, margin: 0 }}>
            Local-first authorization layer for AI agents.
          </p>
        </div>

        <div className="flex gap-10 flex-1 justify-end">
          {NAV_COLUMNS.map((col) => (
            <div key={col.label} className="flex flex-col gap-3" style={{ minWidth: 110 }}>
              <span style={{ fontFamily: "var(--font-geist), sans-serif", fontSize: 12, fontWeight: 500, color: "rgba(0,0,0,0.55)", letterSpacing: "-0.01em" }}>
                {col.label}
              </span>
              {col.links.map((link) => (
                <FooterLink key={link.text} {...link} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot />
          <span style={{ fontFamily: "var(--font-geist), sans-serif", fontSize: 12, color: "rgba(0,0,0,0.35)" }}>
            All systems operational
          </span>
        </div>

        <div className="flex items-center gap-4">
          {LEGAL_LINKS.map((link, i) => (
            <span key={link.text} className="flex items-center gap-4">
              {i > 0 && <span style={{ color: "rgba(0,0,0,0.15)", fontSize: 11 }}>·</span>}
              <a
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{ fontFamily: "var(--font-geist), sans-serif", fontSize: 12, color: "rgba(0,0,0,0.3)", transition: "color 0.15s ease" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.7)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.3)")}
              >
                {link.text}
              </a>
            </span>
          ))}
        </div>

        <span style={{ fontFamily: "var(--font-geist), sans-serif", fontSize: 12, color: "rgba(0,0,0,0.25)" }}>
          © 2026 Shotoku
        </span>
      </div>
    </footer>
  );
}
