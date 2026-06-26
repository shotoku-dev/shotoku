'use client';

interface StepItem {
  text: string;
  color?: string;
}

interface Step {
  num: string;
  label: string;
  items: StepItem[];
}

const STEPS: Step[] = [
  {
    num: '01',
    label: 'Request',
    items: [
      { text: 'actor' },
      { text: 'action' },
      { text: 'resource' },
      { text: 'amount' },
    ],
  },
  {
    num: '02',
    label: 'Policy',
    items: [
      { text: 'allowlists' },
      { text: 'limits' },
      { text: 'approval rules' },
    ],
  },
  {
    num: '03',
    label: 'Record',
    items: [
      { text: '✓ approved',          color: '#16a34a' },
      { text: '✗ denied',            color: '#dc2626' },
      { text: '◷ pending_approval',  color: '#ca8a04' },
    ],
  },
];

export default function HowItWorksSection() {
  return (
    <div
      style={{
        background: '#E8E6E1',
        borderRadius: 6,
        padding: '48px 64px 52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Heading */}
      <h2
        style={{
          color: '#0A0A0A',
          fontSize: '1.5rem',
          fontWeight: 450,
          letterSpacing: '-0.025em',
          lineHeight: 1.35,
          fontFamily: 'Satoshi, var(--font-geist), sans-serif',
          margin: 0,
        }}
      >
        How authorization<br />works.
      </h2>

      {/* 3-step flow */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {STEPS.map((step, i) => (
          <div key={step.num} style={{ display: 'contents' }}>
            {i > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  color: 'rgba(0,0,0,0.18)',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                →
              </div>
            )}
            <div
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.45)',
                borderRadius: 5,
                padding: '20px 22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <span
                style={{
                  color: 'rgba(0,0,0,0.25)',
                  fontSize: 10,
                  fontFamily: 'var(--font-geist-mono), monospace',
                  letterSpacing: '0.06em',
                }}
              >
                {step.num}
              </span>

              <div
                style={{
                  color: '#0A0A0A',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'Satoshi, var(--font-geist), sans-serif',
                  letterSpacing: '-0.01em',
                }}
              >
                {step.label}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
                {step.items.map((item) => (
                  <span
                    key={item.text}
                    style={{
                      color: item.color ?? 'rgba(0,0,0,0.40)',
                      fontSize: 10,
                      fontFamily: 'var(--font-geist-mono), monospace',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Local-first detail */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          paddingTop: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <span
          style={{
            color: 'rgba(0,0,0,0.35)',
            fontSize: 10,
            fontFamily: 'var(--font-geist-mono), monospace',
            letterSpacing: '0.01em',
          }}
        >
          request → policy → decision → decisions.jsonl
        </span>
        <p
          style={{
            color: 'rgba(0,0,0,0.45)',
            fontSize: '0.875rem',
            fontWeight: 400,
            fontFamily: 'Satoshi, var(--font-geist), sans-serif',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Recorded locally in an append-only ledger.<br />
          No custody. No private keys. No cloud requirement.
        </p>
      </div>
    </div>
  );
}
