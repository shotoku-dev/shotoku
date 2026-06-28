'use client';

import { Tree, File, Folder } from '@/app/components/ui/file-tree';
import { useIsNarrow } from '@/app/hooks/useIsNarrow';
import { IconArrowLoopRight2 } from '@tabler/icons-react';

const EXPANDED_C = ['shotoku', 'data'];

const FILE_BG: React.CSSProperties = { background: 'rgba(0,0,0,0.05)', borderRadius: 4 };

const RULES = [
  {
    resource: 'openai.com',
    actions: '[api_call]',
    verdict: 'approved',
    verdictColor: '#16a34a',
    comment: 'safe actions pass',
  },
  {
    resource: 'stripe.com',
    actions: '[purchase]',
    verdict: 'pending_approval',
    verdictColor: '#ca8a04',
    comment: 'risky actions wait',
  },
  {
    resource: '"*"',
    actions: null,
    verdict: 'denied',
    verdictColor: '#dc2626',
    comment: 'everything else stops',
  },
];

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono), monospace',
  fontSize: 10,
  lineHeight: 1.7,
};

const KEY = 'rgba(0,0,0,0.38)';
const SEP = 'rgba(0,0,0,0.22)';
const VAL = 'rgba(0,0,0,0.58)';
const CMT = 'rgba(0,0,0,0.25)';

function LocalFirstSectionC() {
  const narrow = useIsNarrow(600);
  const column = useIsNarrow(1040);

  const outerPadding = !column
    ? '0 64px'
    : narrow
    ? '24px 28px 20px'
    : '24px 28px 20px';

  return (
    <div
      style={{
        background: '#D4CEC6',
        borderRadius: 6,
        padding: outerPadding,
        display: 'flex',
        flexDirection: column ? 'column' : 'row',
        alignItems: column ? 'flex-start' : undefined,
        gap: column ? 20 : 16,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Text */}
      <div style={{ flexShrink: 0, width: column ? '100%' : 200, alignSelf: column ? 'auto' : 'center' }}>
        <h2
          style={{
            color: '#0A0A0A',
            fontSize: narrow ? '1.25rem' : '1.5rem',
            fontWeight: 450,
            letterSpacing: '-0.025em',
            lineHeight: 1.35,
            fontFamily: 'Satoshi, var(--font-geist), sans-serif',
            marginBottom: 5,
          }}
        >
          Policies decide.
        </h2>
        <p
          style={{
            color: 'rgba(0,0,0,0.45)',
            fontSize: narrow ? '1.25rem' : '1.5rem',
            fontWeight: 450,
            letterSpacing: '-0.025em',
            lineHeight: 1.35,
            fontFamily: 'Satoshi, var(--font-geist), sans-serif',
            margin: 0,
          }}
        >
          Agents follow the rules you set.
        </p>
      </div>

      {/* Visual */}
      <div
        style={{
          flex: 1,
          width: column ? '100%' : undefined,
          display: 'flex',
          flexDirection: column ? 'column' : 'row',
          alignItems: column ? (narrow ? 'stretch' : 'center') : undefined,
          gap: column ? 10 : 16,
        }}
      >
        {/* File tree */}
        <div
          style={{
            background: 'rgba(255,255,255,0.42)',
            borderRadius: 5,
            padding: '14px 6px',
            flexShrink: 0,
            alignSelf: narrow ? 'flex-start' : 'center',
            pointerEvents: 'auto',
          }}
          className={column ? '[&_.text-sm]:text-xs [&_svg]:size-3' : ''}
        >
          <Tree
            className={column ? 'w-48' : 'w-52'}
            initialSelectedId="policy"
            initialExpandedItems={EXPANDED_C}
          >
            <Folder element="shotoku" value="shotoku">
              <File value="policy" style={FILE_BG}>
                <span>policy.yaml</span>
              </File>
              <Folder element="data" value="data">
                <File value="decisions">
                  <span>decisions.jsonl</span>
                </File>
              </Folder>
            </Folder>
          </Tree>
        </div>

        {/* Policy card */}
        <div
          style={{
            width: narrow ? '100%' : 310,
            flexShrink: narrow ? undefined : 0,
            alignSelf: column && !narrow ? 'center' : narrow ? 'stretch' : 'center',
            marginTop: column && !narrow ? 12 : 0,
            background: 'rgba(255,255,255,0.42)',
            borderRadius: 5,
            padding: '22px 22px',
            ...MONO,
          }}
        >
          <div style={{ color: KEY, marginBottom: 10 }}>rules:</div>

          {RULES.map((rule, i) => (
            <div key={rule.resource} style={{ marginBottom: i < RULES.length - 1 ? 14 : 0 }}>
              {/* resource */}
              <div>
                <span style={{ color: SEP }}>{'  - '}</span>
                <span style={{ color: KEY }}>resource</span>
                <span style={{ color: SEP }}>: </span>
                <span style={{ color: VAL }}>{rule.resource}</span>
              </div>

              {/* actions */}
              {rule.actions && (
                <div style={{ paddingLeft: 20 }}>
                  <span style={{ color: KEY }}>actions</span>
                  <span style={{ color: SEP }}>: </span>
                  <span style={{ color: VAL }}>{rule.actions}</span>
                </div>
              )}

              {/* verdict on line 1, comment indented to align under the value on line 2 */}
              <div style={{ paddingLeft: 20 }}>
                <div>
                  <span style={{ color: KEY }}>verdict</span>
                  <span style={{ color: SEP }}>: </span>
                  <span style={{ color: rule.verdictColor }}>{rule.verdict}</span>
                </div>
                <div style={{ paddingLeft: '9ch', color: CMT, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IconArrowLoopRight2 size={10} style={{ flexShrink: 0, transform: 'scaleY(-1)', display: 'block' }} />
                  <span style={{ lineHeight: 1 }}>{rule.comment}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LocalFirstSectionC;
