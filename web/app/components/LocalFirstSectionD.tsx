'use client';

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono), monospace',
  fontSize: 11,
  lineHeight: '19px',
};

const KW  = '#FF3B4E';   // keywords, imports, functions
const STR = '#8B6348';   // strings
const CMT = '#A98586';   // commented output
const KEY = '#0F0D0C';   // object keys
const NUM = '#B05A00';   // numbers (same family as strings)
const FN  = '#FF3B4E';   // function names
const PUN = '#0F0D0C';   // brackets, punctuation
const _OK  = '#22c55e';

const Blank = () => <div style={{ height: 19 }} />;

export default function LocalFirstSectionD() {
  return (
    <div
      style={{
        background: '#CAC3B9',
        borderRadius: 6,
        padding: '0 64px',
        display: 'flex',
        flexDirection: 'row',
        gap: 32,
        height: '100%',
        boxSizing: 'border-box',
        alignItems: 'center',
      }}
    >
      {/* Code window */}
      <div style={{ flex: 1 }}>
        {/* macOS title bar */}
        <div
          style={{
            background: '#EBE9E4',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            padding: '9px 12px',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {['a', 'b', 'c'].map((k) => (
              <div
                key={k}
                style={{ width: 10, height: 10, borderRadius: '50%', background: '#CAC8C4' }}
              />
            ))}
          </div>
          <span
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              ...MONO,
              color: 'rgba(0,0,0,0.42)',
            }}
          >
            agent.ts
          </span>
        </div>

        {/* Code body */}
        <div
          style={{
            background: 'rgba(255,255,255,0.42)',
            borderRadius: '0 0 8px 8px',
            border: 'none',
            padding: '20px 22px',
            ...MONO,
          }}
        >
          <div>
            <span style={{ color: KW }}>import</span>
            <span style={{ color: PUN }}>{' { '}</span>
            <span style={{ color: PUN }}>authorize</span>
            <span style={{ color: PUN }}>{' }'}</span>
            <span style={{ color: KW }}> from</span>
            <span style={{ color: STR }}> &quot;@shotoku/core&quot;</span>
            <span style={{ color: PUN }}>;</span>
          </div>

          <Blank />

          <div>
            <span style={{ color: KW }}>const</span>
            <span style={{ color: FN }}> decision</span>
            <span style={{ color: PUN }}> = </span>
            <span style={{ color: KW }}>await</span>
            <span style={{ color: FN }}> authorize</span>
            <span style={{ color: PUN }}>{`({`}</span>
          </div>
          <div style={{ paddingLeft: '2em' }}>
            <span style={{ color: KEY }}>actor</span>
            <span style={{ color: PUN }}>: </span>
            <span style={{ color: STR }}>&quot;shopping-agent&quot;</span>
            <span style={{ color: PUN }}>,</span>
          </div>
          <div style={{ paddingLeft: '2em' }}>
            <span style={{ color: KEY }}>action</span>
            <span style={{ color: PUN }}>: </span>
            <span style={{ color: STR }}>&quot;purchase&quot;</span>
            <span style={{ color: PUN }}>,</span>
          </div>
          <div style={{ paddingLeft: '2em' }}>
            <span style={{ color: KEY }}>resource</span>
            <span style={{ color: PUN }}>: </span>
            <span style={{ color: STR }}>&quot;api.openai.com&quot;</span>
            <span style={{ color: PUN }}>,</span>
          </div>
          <div style={{ paddingLeft: '2em' }}>
            <span style={{ color: KEY }}>amount</span>
            <span style={{ color: PUN }}>: </span>
            <span style={{ color: NUM }}>24.99</span>
            <span style={{ color: PUN }}>,</span>
          </div>
          <div>
            <span style={{ color: PUN }}>{`});`}</span>
          </div>

          <Blank />

          <div>
            <span style={{ color: FN }}>console</span>
            <span style={{ color: PUN }}>.</span>
            <span style={{ color: FN }}>log</span>
            <span style={{ color: PUN }}>(decision);</span>
          </div>

          <Blank />

          <div style={{ color: CMT }}>{'/*'}</div>
          <div style={{ paddingLeft: '2em', color: CMT }}>{'{'}</div>
          <div style={{ paddingLeft: '4em' }}>
            <span style={{ color: CMT }}>status: &quot;approved&quot;,</span>
          </div>
          <div style={{ paddingLeft: '4em', color: CMT }}>decisionId: &quot;dec_4f8a91&quot;,</div>
          <div style={{ paddingLeft: '4em', color: CMT }}>reasons: [</div>
          <div style={{ paddingLeft: '6em', color: CMT }}>&quot;OpenAI is allowlisted&quot;,</div>
          <div style={{ paddingLeft: '6em', color: CMT }}>&quot;Purchase is below $50 limit&quot;</div>
          <div style={{ paddingLeft: '4em', color: CMT }}>],</div>
          <div style={{ paddingLeft: '2em', color: CMT }}>{'}'}</div>
          <div style={{ color: CMT }}>{'*/'}</div>
        </div>
      </div>

      {/* Text */}
      <div style={{ flexShrink: 0, width: 240, alignSelf: 'center' }}>
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
          One function call.
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
          Add authorization to any agent in minutes.
        </p>
      </div>
    </div>
  );
}
