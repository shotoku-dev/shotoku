'use client';

interface Props { reversed?: boolean }

const NOT_LIST = [
  'Not a wallet.',
  'Not a payment processor.',
  'Not a custody layer.',
  'Not a generic workflow engine.',
];

export default function LocalFirstSectionC({ reversed }: Props) {
  return (
    <div
      style={{
        background: '#C9C6BE',
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
          Shotoku is not another<br />cloud control plane.
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
          It is the local authorization layer before your agent acts.
        </p>
      </div>

      {/* Not list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {NOT_LIST.map((item) => (
          <div
            key={item}
            style={{
              color: 'rgba(0,0,0,0.45)',
              fontSize: 11,
              fontFamily: 'var(--font-geist-mono), monospace',
              letterSpacing: '0.01em',
              padding: '14px 0',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
