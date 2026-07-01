'use client';

import { useState } from 'react';
import { useIsNarrow } from '@/app/hooks/useIsNarrow';
import DocsSidebar from './DocsSidebar';

export default function DocsShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const mobile = useIsNarrow(1024);

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        background: '#F4F3EF',
      }}
    >
      {/* Desktop sidebar */}
      {!mobile && <DocsSidebar />}

      {/* Mobile/tablet overlay sidebar */}
      {mobile && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0,0,0,0.18)',
              backdropFilter: 'blur(2px)',
              opacity: open ? 1 : 0,
              pointerEvents: open ? 'auto' : 'none',
              transition: 'opacity 0.25s ease',
            }}
          />

          {/* Sliding sidebar */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100%',
              zIndex: 50,
              transform: open ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <DocsSidebar onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* Main */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: mobile ? '12px 12px 12px 12px' : '16px 16px 16px 0',
          overflow: 'hidden',
          gap: mobile ? 8 : 0,
        }}
      >
        {/* Mobile top bar */}
        {mobile && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 4,
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 7,
              }}
            >
              <span style={{ display: 'block', width: 18, height: 1.5, background: 'rgba(0,0,0,0.55)', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 18, height: 1.5, background: 'rgba(0,0,0,0.55)', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 18, height: 1.5, background: 'rgba(0,0,0,0.55)', borderRadius: 2 }} />
            </button>
          </div>
        )}

        {/* White content container */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid rgba(0,0,0,0.08)',
            overflowY: 'auto',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
