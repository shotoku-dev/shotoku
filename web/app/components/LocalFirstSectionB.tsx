'use client';

import { useState } from 'react';
import { Tree, File, Folder } from '@/app/components/ui/file-tree';

interface Props { reversed?: boolean }

type View = 'log' | 'raw';

const CLEAN_DECISIONS = [
  { id: 'dec_01', status: 'approved',         color: '#16a34a' },
  { id: 'dec_02', status: 'pending_approval', color: '#ca8a04' },
  { id: 'dec_03', status: 'denied',           color: '#dc2626' },
  { id: 'apr_01', status: 'approved dec_02',  color: '#16a34a' },
];

interface JsonEntry { [key: string]: string }

const JSON_ENTRIES: JsonEntry[] = [
  { id: 'dec_01', status: 'approved',         actor: 'agent-1' },
  { id: 'dec_02', status: 'pending_approval', actor: 'agent-1' },
  { id: 'dec_03', status: 'denied',           actor: 'agent-1' },
  { id: 'apr_01', type: 'approval', decision: 'dec_02', status: 'approved' },
];

const STATUS_COLORS: Record<string, string> = {
  approved:         '#16a34a',
  pending_approval: '#ca8a04',
  denied:           '#dc2626',
};

const FILE_BG: React.CSSProperties = { background: 'rgba(0,0,0,0.05)', borderRadius: 4 };

// Card heights for the two views
const CARD_H: Record<View, number> = { log: 154, raw: 431 };

export default function LocalFirstSectionB({ reversed }: Props) {
  const [view, setView] = useState<View>('log');

  return (
    <div
      style={{
        background: '#DEDAD3',
        borderRadius: 6,
        padding: '0 64px',
        display: 'flex',
        flexDirection: reversed ? 'row-reverse' : 'row',
        gap: 32,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Text */}
      <div style={{ flexShrink: 0, width: 280, alignSelf: 'center' }}>
        <h2
          style={{
            color: '#0A0A0A',
            fontSize: '1.5rem',
            fontWeight: 450,
            letterSpacing: '-0.025em',
            lineHeight: 1.35,
            fontFamily: 'Satoshi, var(--font-geist), sans-serif',
            marginBottom: 5,
            whiteSpace: 'nowrap',
          }}
        >
          Local-first by design.
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

      {/* Visual */}
      <div style={{ flex: 1, display: 'flex', gap: 16 }}>
        {/* File tree — decisions.jsonl only */}
        <div
          style={{
            background: 'rgba(255,255,255,0.42)',
            borderRadius: 5,
            padding: '14px 6px',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          <Tree
            className="w-52"
            initialSelectedId="decisions"
            initialExpandedItems={['shotoku', 'data']}
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
            flex: 1,
            alignSelf: 'center',
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
                padding: '28px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: view === 'log' ? 1 : 0,
                pointerEvents: view === 'log' ? 'auto' : 'none',
              }}
            >
              {CLEAN_DECISIONS.map((d) => (
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
                gap: 10,
                opacity: view === 'raw' ? 1 : 0,
                pointerEvents: view === 'raw' ? 'auto' : 'none',
              }}
            >
              {JSON_ENTRIES.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: 'var(--font-geist-mono), monospace',
                    fontSize: 10,
                    lineHeight: 1.7,
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
