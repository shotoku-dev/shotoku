'use client';

import { useState, useEffect } from 'react';
import { useIsNarrow } from '@/app/hooks/useIsNarrow';
import { Tree, File, Folder } from '@/app/components/ui/file-tree';

interface Props { reversed?: boolean }

type View = 'log' | 'raw';

const CLEAN_DECISIONS = [
  { id: 'dec_01', status: 'approved',         amount: '$12.00',  color: '#16a34a' },
  { id: 'dec_02', status: 'pending_approval', amount: '$89.99',  color: '#ca8a04' },
  { id: 'dec_03', status: 'denied',           amount: '$210.00', color: '#dc2626' },
  { id: 'apr_01', status: 'approved dec_02',  amount: '',        color: '#16a34a' },
];

interface JsonEntry { [key: string]: string }

const JSON_ENTRIES: JsonEntry[] = [
  { id: 'dec_01', status: 'approved',         amount: '12.00' },
  { id: 'dec_02', status: 'pending_approval', amount: '89.99' },
  { id: 'dec_03', status: 'denied',           amount: '210.00' },
  { id: 'apr_01', type: 'approval', decision: 'dec_02', status: 'approved' },
];

const STATUS_COLORS: Record<string, string> = {
  approved:         '#16a34a',
  pending_approval: '#ca8a04',
  denied:           '#dc2626',
};

const FILE_BG: React.CSSProperties = { background: 'rgba(0,0,0,0.05)', borderRadius: 4 };

const CARD_H_DESKTOP: Record<View, number> = { log: 154, raw: 431 };
const CARD_H_COLUMN:  Record<View, number> = { log: 130, raw: 320 };
const CARD_H_NARROW:  Record<View, number> = { log: 154, raw: 370 };

const EXPANDED = ['shotoku', 'data'];

function LocalFirstSectionB({ reversed }: Props) {
  const [view, setView] = useState<View>('log');
  const narrow = useIsNarrow(600);
  const column = useIsNarrow(1040);
  const CARD_H = narrow ? CARD_H_NARROW : column ? CARD_H_COLUMN : CARD_H_DESKTOP;

  useEffect(() => {
    setView(column ? 'raw' : 'log');
  }, [column]);

  const outerPadding = !column
    ? '0 64px'
    : narrow
    ? '24px 28px 20px'
    : '24px 28px 20px';

  return (
    <div
      style={{
        background: '#DEDAD3',
        borderRadius: 6,
        padding: outerPadding,
        display: 'flex',
        flexDirection: column ? 'column' : (reversed ? 'row-reverse' : 'row'),
        alignItems: column ? 'flex-start' : undefined,
        gap: column ? 20 : 32,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Text */}
      <div style={{ flexShrink: 0, width: column ? '100%' : 280, alignSelf: column ? 'auto' : 'center' }}>
        <h2
          style={{
            color: '#0A0A0A',
            fontSize: narrow ? '1.25rem' : '1.5rem',
            fontWeight: 450,
            letterSpacing: '-0.025em',
            lineHeight: 1.35,
            fontFamily: 'Satoshi, var(--font-geist), sans-serif',
            marginBottom: 5,
            whiteSpace: column ? 'normal' : 'nowrap',
          }}
        >
          Local-first by design.
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
          Every spending decision stays on your machine.
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
        {/* File tree — decisions.jsonl only */}
        <div
          style={{
            background: 'rgba(255,255,255,0.42)',
            borderRadius: 5,
            padding: '14px 6px',
            flexShrink: 0,
            alignSelf: 'center',
          }}
          className={column ? '[&_.text-sm]:text-xs [&_svg]:size-3' : ''}
        >
          <Tree
            className={column ? 'w-48' : 'w-52'}
            initialSelectedId="decisions"
            initialExpandedItems={EXPANDED}
          >
            <Folder element="shotoku" value="shotoku">
              <Folder element="data" value="data">
                <File value="decisions" style={FILE_BG}>
                  <span>decisions.jsonl</span>
                </File>
              </Folder>
            </Folder>
          </Tree>
        </div>

        {/* Right column — expands from center as card height transitions */}
        <div
          style={{
            flex: column ? undefined : 1,
            width: narrow ? '100%' : column ? 310 : undefined,
            alignSelf: column && !narrow ? 'center' : column ? 'stretch' : 'center',
            marginTop: column && !narrow ? 12 : 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, paddingLeft: 2, pointerEvents: 'auto' }}>
            {(['log', 'raw'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                style={{
                  background: view === tab ? 'rgba(0,0,0,0.09)' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 9px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  fontSize: 10,
                  color: view === tab ? 'rgba(0,0,0,0.70)' : 'rgba(0,0,0,0.35)',
                  letterSpacing: '0.02em',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Card — height transitions reveal the active view */}
          <div
            style={{
              background: 'rgba(255,255,255,0.42)',
              borderRadius: 5,
              position: 'relative',
              height: CARD_H[view],
              transition: 'height 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
            }}
          >
            {/* Log view */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: narrow ? '20px 12px' : '28px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: view === 'log' ? 1 : 0,
                pointerEvents: view === 'log' ? 'auto' : 'none',
              }}
            >
              {(column && !narrow ? CLEAN_DECISIONS.slice(0, 3) : CLEAN_DECISIONS).map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    gap: 20,
                    fontFamily: 'var(--font-geist-mono), monospace',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: 'rgba(0,0,0,0.30)', flexShrink: 0, width: 48 }}>{d.id}</span>
                  <span style={{ color: d.color }}>{d.status}</span>
                  <span style={{ color: 'rgba(0,0,0,0.30)', marginLeft: 'auto' }}>{d.amount}</span>
                </div>
              ))}
            </div>

            {/* Raw view */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: '22px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: narrow ? 6 : 10,
                opacity: view === 'raw' ? 1 : 0,
                pointerEvents: view === 'raw' ? 'auto' : 'none',
              }}
            >
              {(column && !narrow ? JSON_ENTRIES.slice(0, 3) : JSON_ENTRIES).map((entry, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: 'var(--font-geist-mono), monospace',
                    fontSize: 10,
                    lineHeight: narrow ? 1.45 : 1.7,
                  }}
                >
                  <div style={{ color: 'rgba(0,0,0,0.22)' }}>{'{'}</div>
                  {Object.entries(entry).map(([key, value]) => (
                    <div key={key} style={{ paddingLeft: 14 }}>
                      <span style={{ color: 'rgba(0,0,0,0.38)' }}>"{key}"</span>
                      <span style={{ color: 'rgba(0,0,0,0.22)' }}>: </span>
                      <span style={{ color: STATUS_COLORS[value] ?? 'rgba(0,0,0,0.55)' }}>"{value}"</span>
                    </div>
                  ))}
                  <div style={{ color: 'rgba(0,0,0,0.22)' }}>{'}'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LocalFirstSectionB;
