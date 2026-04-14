/**
 * BrutalistStatusBar — Footer bar for the Brutalist V2 theme.
 *
 * Usage:
 *   <BrutalistStatusBar nodeCount={240} filteredCount={18} pendingCount={3} />
 *
 * Height: 24px, bg slate-200, 2px solid black top border.
 * All text is 9px bold uppercase monospace-style.
 */

import React from 'react';

interface BrutalistStatusBarProps {
  nodeCount: number;
  filteredCount: number;
  pendingCount?: number;
}

export const BrutalistStatusBar: React.FC<BrutalistStatusBarProps> = React.memo(({
  nodeCount,
  filteredCount,
  pendingCount = 0,
}) => {
  // Rough storage percentage — placeholder value matching the Stitch design.
  // A real implementation would derive this from actual storage quota data.
  const storagePct = 42;

  return (
    <footer
      style={{
        height: '24px',
        minHeight: '24px',
        backgroundColor: '#e2e8f0',
        borderTop: '2px solid #000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '12px',
        paddingRight: '12px',
        flexShrink: 0,
      }}
      aria-label="Application status bar"
    >
      {/* Left cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Online indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            aria-hidden="true"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: pendingCount > 0 ? '#f59e0b' : '#22c55e',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#1e293b',
              textTransform: 'uppercase',
            }}
          >
            {pendingCount > 0 ? 'PROCESSING' : 'SYSTEM ONLINE'}
          </span>
        </div>

        {/* DB label */}
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#64748b',
            textTransform: 'uppercase',
          }}
        >
          DB: PRODUCTION
        </span>

        {/* Node counts */}
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#64748b',
            textTransform: 'uppercase',
          }}
          aria-label={`${filteredCount} of ${nodeCount} nodes visible`}
        >
          NODES: {filteredCount}/{nodeCount}
        </span>
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#64748b',
            textTransform: 'uppercase',
          }}
        >
          STORAGE: {storagePct}%
        </span>

        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: pendingCount > 0 ? '#b45309' : '#64748b',
            textTransform: 'uppercase',
          }}
          aria-live="polite"
          aria-label={`${pendingCount} tasks pending`}
        >
          TASKS: {pendingCount} PENDING
        </span>
      </div>
    </footer>
  );
});

BrutalistStatusBar.displayName = 'BrutalistStatusBar';
