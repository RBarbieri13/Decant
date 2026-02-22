// ============================================================
// ConnectionStatus — Header dot + text showing connection state
// ============================================================

import { ConnectionState } from '../types/index.js';

interface ConnectionStatusProps {
  connection: ConnectionState;
  onRetry: () => void;
}

export function ConnectionStatus({ connection, onRetry }: ConnectionStatusProps) {
  if (connection.checking) {
    return (
      <div className="ext-connection ext-connection--checking">
        <span className="ext-connection-dot ext-connection-dot--checking" />
        <span className="ext-connection-text">Connecting...</span>
      </div>
    );
  }

  if (!connection.connected) {
    return (
      <div className="ext-connection ext-connection--disconnected">
        <span className="ext-connection-dot ext-connection-dot--disconnected" />
        <button className="ext-connection-retry" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ext-connection ext-connection--connected">
      <span className="ext-connection-dot ext-connection-dot--connected" />
      <span className="ext-connection-text">Connected</span>
    </div>
  );
}
