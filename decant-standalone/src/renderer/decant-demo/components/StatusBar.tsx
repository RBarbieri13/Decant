import React from 'react';

interface StatusBarProps {
  nodeCount: number;
  filteredCount: number;
  pendingCount?: number;
}

export const StatusBar: React.FC<StatusBarProps> = React.memo(({
  nodeCount,
  filteredCount,
  pendingCount = 0,
}) => {
  return (
    <div className="decant-status-bar">
      <div className="decant-status-bar__left">
        <div className="decant-status-bar__indicator">
          <span className={`decant-status-bar__dot ${pendingCount > 0 ? 'decant-status-bar__dot--warning' : ''}`} />
          <span>{pendingCount > 0 ? 'PROCESSING' : 'CONNECTED'}</span>
        </div>
        <span>{filteredCount} / {nodeCount} NODES</span>
      </div>
      <div className="decant-status-bar__right">
        <span>STORAGE: LOCAL</span>
        {pendingCount > 0 && <span>PENDING: {pendingCount}</span>}
        <span>v2.0-BRUT</span>
      </div>
    </div>
  );
});
