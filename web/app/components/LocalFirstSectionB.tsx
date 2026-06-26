'use client';

import { useState } from 'react';
import { Tree, File, Folder } from '@/app/components/ui/file-tree';

interface Props { reversed?: boolean }

type SelectedFile = 'decisions' | 'policy';
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

interface Segment { text: string; color: string }

const POLICY_LINES: Segment[][] = [
  [{ text: 'version: ', color: 'rgba(0,0,0,0.35)' }, { text: '1', color: 'rgba(0,0,0,0.55)' }],
  [],
  [{ text: 'rules:', color: 'rgba(0,0,0,0.45)' }],
  [{ text: '  - resource: ', color: 'rgba(0,0,0,0.35)' }, { text: 'openai.com', color: 'rgba(0,0,0,0.60)' }],
  [{ text: '    status: ', color: 'rgba(0,0,0,0.35)' }, { text: 'allow', color: '#16a34a' }],
  [{ text: '    daily_budget: ', color: 'rgba(0,0,0,0.35)' }, { text: '500', color: 'rgba(0,0,0,0.55)' }],
  [],
  [{ text: '  - resource: ', color: 'rgba(0,0,0,0.35)' }, { text: 'stripe.com', color: 'rgba(0,0,0,0.60)' }],
  [{ text: '    require_approval: ', color: 'rgba(0,0,0,0.35)' }, { text: 'true', color: '#ca8a04' }],
  [],
  [{ text: '  - resource: ', color: 'rgba(0,0,0,0.35)' }, { text: '"*"', color: 'rgba(0,0,0,0.55)' }],
  [{ text: '    status: ', color: 'rgba(0,0,0,0.35)' }, { text: 'deny', color: '#dc2626' }],
];

function getRightHeight(selectedFile: SelectedFile, view: View): number {
  if (selectedFile === 'policy') return 248;
  return view === 'log' ? 186 : 465;
}

const FILE_BG: React.CSSProperties = { background: 'rgba(0,0,0,0.05)', borderRadius: 4 };

export default function LocalFirstSectionB({ reversed }: Props) {
  const [selectedFile, setSelectedFile] = useState<SelectedFile>('decisions');
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
        {/* File tree */}
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
              <File
                value="policy"
                style={selectedFile === 'policy' ? FILE_BG : {}}
                onClick={() => setSelectedFile('policy')}
              >
                <span>policy.yaml</span>
              </File>
              <Folder element="data" value="data">
                <File
                  value="decisions"
                  style={selectedFile === 'decisions' ? FILE_BG : {}}
                  onClick={() => setSelectedFile('decisions')}
                >
                  <span>decisions.jsonl</span>
                </File>
              </Folder>
            </Folder>
          </Tree>
        </div>

        {/* Right column — height drives the expansion, panels fade between files */}
        <div
          style={{
            flex: 1,
            alignSelf: 'center',
            position: 'relative',
            height: getRightHeight(selectedFile, view),
            transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          }}
        >
          {/* Decisions panel */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              opacity: selectedFile === 'decisions' ? 1 : 0,
              transition: 'opacity 0.15s ease',
              pointerEvents: selectedFile === 'decisions' ? 'auto' : 'none',
            }}
          >
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, paddingLeft: 2 }}>
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

            {/* Card */}
            <div
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.42)',
                borderRadius: 5,
                position: 'relative',
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

          {/* Policy panel */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: selectedFile === 'policy' ? 1 : 0,
              transition: 'opacity 0.15s ease',
              pointerEvents: selectedFile === 'policy' ? 'auto' : 'none',
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.42)',
                borderRadius: 5,
                padding: '22px 22px',
                height: '100%',
                boxSizing: 'border-box',
              }}
            >
              {POLICY_LINES.map((segments, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: 'var(--font-geist-mono), monospace',
                    fontSize: 10,
                    lineHeight: 1.7,
                    whiteSpace: 'pre',
                    minHeight: segments.length === 0 ? '1em' : undefined,
                  }}
                >
                  {segments.map((seg, j) => (
                    <span key={j} style={{ color: seg.color }}>{seg.text}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
