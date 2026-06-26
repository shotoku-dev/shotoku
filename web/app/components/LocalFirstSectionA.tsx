'use client';

interface Props { reversed?: boolean }

const PRINCIPLES = [
  {
    title: 'Runs locally',
    body: 'No cloud service required in the authorization path.',
  },
  {
    title: 'Records decisions',
    body: 'Every approval, denial, and pending request is written to a local ledger.',
  },
  {
    title: 'No custody',
    body: 'Shotoku does not hold funds, wallets, or private keys.',
  },
];

export default function LocalFirstSectionA({ reversed }: Props) {
  return (
    <div
      style={{
        background: '#DEDAD3',
        borderRadius: 6,
        padding: '48px 64px 52px',
        display: 'flex',
        flexDirection: reversed ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 64,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Text */}
      <div style={{ flexShrink: 0, width: 300 }}>
        <h2
          style={{
            color: '#0A0A0A',
            fontSize: '1.5rem',
            fontWeight: 450,
            letterSpacing: '-0.025em',
            lineHeight: 1.35,
            fontFamily: 'Satoshi, var(--font-geist), sans-serif',
            marginBottom: 5,
          }}
        >
          Local-first<br />by design.
        </h2>
        <p
          style={{
            color: 'rgba(0,0,0,0.45)',
            fontSize: '1.5rem',
            fontWeight: 450,
            letterSpacing: '-0.025em',
            lineHeight: 1.35,
            fontFamily: 'Satoshi, var(--font-geist), sans-serif',
            margin: 0,
          }}
        >
          Authorization decisions stay on your machine.
        </p>
      </div>

      {/* Principle cards — stacked vertically */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PRINCIPLES.map((p) => (
          <div
            key={p.title}
            style={{
              background: 'rgba(255,255,255,0.42)',
              borderRadius: 5,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'baseline',
              gap: 16,
            }}
          >
            <span
              style={{
                color: '#0A0A0A',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'Satoshi, var(--font-geist), sans-serif',
                letterSpacing: '-0.01em',
                flexShrink: 0,
                width: 140,
              }}
            >
              {p.title}
            </span>
            <span
              style={{
                color: 'rgba(0,0,0,0.45)',
                fontSize: '0.8125rem',
                fontFamily: 'Satoshi, var(--font-geist), sans-serif',
                lineHeight: 1.5,
              }}
            >
              {p.body}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
