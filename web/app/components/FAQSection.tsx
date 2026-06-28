'use client';

import { useState } from 'react';

const FAQ = [
  {
    q: "How is this different from just writing an if statement before my API call?",
    a: "An if statement is logic. Shotoku is infrastructure. It gives you a structured audit trail, a human approval queue, policy as config instead of code, and MCP integration — so the same rules apply whether your agent runs in your terminal, in Claude, or anywhere else.",
  },
  {
    q: "What stops an agent from bypassing Shotoku entirely?",
    a: "Nothing enforces it at the runtime level — Shotoku is a call you add, not a firewall. The value is that it makes the safe path the easy path: one function call, structured decisions, full audit log. If you need hard enforcement, pair it with network-level controls.",
  },
  {
    q: "Isn't this just a logger with extra steps?",
    a: "Logging records what happened. Shotoku decides what should happen before it does. The approval queue, policy evaluation, and structured reasons are what make it authorization rather than observability.",
  },
  {
    q: "Do I need an account or internet connection?",
    a: "No. Shotoku runs entirely on your machine. No account, no cloud, no telemetry. Decisions are stored locally in a JSONL file you can inspect, move, or delete at any time.",
  },
  {
    q: "Where are decisions stored?",
    a: "In a local append-only file at data/decisions.jsonl inside your project. Every authorization decision — approved, denied, or pending — is written there in plain text.",
  },
  {
    q: "Can I use Shotoku with any AI framework or agent?",
    a: "Yes. The core is a plain TypeScript function. If your agent can call a function, it can use Shotoku. There's also an MCP server so tools like Claude can call it directly without any code changes.",
  },
  {
    q: "What happens after Shotoku denies a request?",
    a: "The agent receives a structured response with the denial reason and a decision ID. What happens next is up to you — retry, surface it to the user, or halt. Shotoku records the decision either way.",
  },
  {
    q: "Is this production-ready?",
    a: "Shotoku is v0.1.0 — early but functional. The core authorization path is stable. Use it for real projects, but expect the API to evolve. File issues and we'll ship fixes fast.",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{
        flexShrink: 0,
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <path d="M2.5 5L7 9.5L11.5 5" stroke="#E54B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      style={{
        padding: '48px 24px',
        fontFamily: 'Satoshi, var(--font-geist), sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {FAQ.map((item, i) => {
          const isOpen = openIndex === i;

          return (
            <div
              key={i}
              style={{
                background: '#F2F1ED',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '14px 18px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: '#0A0A0A',
                    letterSpacing: '-0.015em',
                    lineHeight: 1.4,
                  }}
                >
                  {item.q}
                </span>
                <ChevronIcon open={isOpen} />
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: isOpen ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <p
                    style={{
                      margin: 0,
                      padding: '0 18px 16px',
                      fontSize: 14.5,
                      color: 'rgba(0,0,0,0.5)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.6,
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
