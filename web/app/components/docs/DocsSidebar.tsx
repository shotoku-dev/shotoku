"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const NAV = [
  {
    section: "Get Started",
    items: [{ label: "Quickstart", href: "/docs/quickstart" }],
  },
  {
    section: "Reference",
    items: [
      { label: "API",      href: "/docs/api"      },
      { label: "CLI",      href: "/docs/cli"      },
      { label: "Policies", href: "/docs/policies" },
    ],
  },
  {
    section: "Integrations",
    items: [
      { label: "MCP server", href: "/docs/mcp"  },
      { label: "x402",       href: "/docs/x402" },
    ],
  },
  {
    section: "Tools",
    items: [
      { label: "TUI",       href: "/docs/tui"       },
      { label: "Snapshots", href: "/docs/snapshots" },
    ],
  },
];

export default function DocsSidebar() {
  const pathname = usePathname();
  const [backHover, setBackHover] = useState(false);

  return (
    <aside
      style={{
        width:         240,
        flexShrink:    0,
        height:        "100%",
        overflowY:     "auto",
        background:    "#F4F3EF",
        display:       "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "16px 16px 12px 20px", flexShrink: 0 }}>
        <Link
          href="/"
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            4,
            fontSize:       12,
            color:          backHover ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.38)",
            fontFamily:     "Satoshi, var(--font-geist), sans-serif",
            textDecoration: "none",
            marginBottom:   14,
            transition:     "color 0.12s",
          }}
        >
          ← Return to Shotoku
        </Link>

        <Image
          src="/assets/brand/shotoku-logo-rw.svg"
          alt="Shotoku"
          width={38}
          height={38}
          style={{ display: "block", marginBottom: 8, marginLeft: -10 }}
        />

        <span
          style={{
            fontSize:      17,
            fontWeight:    500,
            color:         "#0A0A0A",
            fontFamily:    "Satoshi, var(--font-geist), sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          Documentation
        </span>
      </div>

      <nav style={{ padding: "2px 0 0", flex: 1 }}>
        {NAV.map((group) => (
          <div key={group.section} style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize:      12.5,
                fontWeight:    500,
                color:         "rgba(0,0,0,0.4)",
                padding:       "0 16px 0 20px",
                marginBottom:  3,
                fontFamily:    "Satoshi, var(--font-geist), sans-serif",
                letterSpacing: "-0.01em",
              }}
            >
              {group.section}
            </div>

            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <div key={item.href} style={{ padding: "1px 18px 1px 14px" }}>
                  <Link
                    href={item.href}
                    style={{
                      display:        "block",
                      padding:        "5px 10px",
                      fontSize:       13.5,
                      fontWeight:     active ? 500 : 400,
                      color:          "#0A0A0A",
                      fontFamily:     "Satoshi, var(--font-geist), sans-serif",
                      textDecoration: "none",
                      borderRadius:   7,
                      background:     active ? "rgba(0,0,0,0.06)" : "transparent",
                      transition:     "background 0.12s",
                    }}
                  >
                    {item.label}
                  </Link>
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
