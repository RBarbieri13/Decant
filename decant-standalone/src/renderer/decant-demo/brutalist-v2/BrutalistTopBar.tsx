/**
 * BrutalistTopBar — Header bar for the Brutalist V2 theme.
 *
 * Matches the Stitch design export: dark navy (#1e3a8a) background,
 * heavy black borders, punchy yellow/green action buttons.
 *
 * Uses Material Symbols Outlined icon font (must be loaded in the app's HTML
 * or via a <link> in the host document):
 *   <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
 *
 * Usage:
 *   <BrutalistTopBar
 *     searchQuery={query}
 *     onSearchChange={setQuery}
 *     onQuickAddClick={handleImport}
 *     onRefreshAllClick={handleSync}
 *     onReclassifyClick={handleReclassify}
 *     isReclassifying={false}
 *     onSettingsClick={handleSettings}
 *     onToggleUiMode={handleToggleUi}
 *   />
 */

import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface BrutalistTopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onQuickAddClick?: () => void;
  onRefreshAllClick?: () => void;
  onReclassifyClick?: () => void;
  isReclassifying?: boolean;
  reclassifyProgress?: { completed: number; total: number; phase?: string } | null;
  onSettingsClick?: () => void;
  onToggleUiMode: () => void;
  onImessageImportClick?: () => void;
  showImessageButton?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Renders a Material Symbols Outlined icon span. */
const Icon: React.FC<{ name: string; size?: number; style?: React.CSSProperties }> = ({
  name,
  size = 16,
  style,
}) => (
  <span
    className="material-symbols-outlined"
    aria-hidden="true"
    style={{
      fontSize: `${size}px`,
      lineHeight: 1,
      userSelect: 'none',
      ...style,
    }}
  >
    {name}
  </span>
);

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ActionButtonProps {
  label: string;
  iconName: string;
  onClick?: () => void;
  disabled?: boolean;
  bgColor: string;
  textColor?: string;
  title?: string;
  children?: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  iconName,
  onClick,
  disabled = false,
  bgColor,
  textColor = '#000',
  title,
  children,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title ?? label}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      height: '24px',
      paddingLeft: '8px',
      paddingRight: '8px',
      backgroundColor: disabled ? '#9ca3af' : bgColor,
      color: textColor,
      border: '2px solid #000',
      borderRadius: '2px',
      fontSize: '10px',
      fontWeight: 900,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      cursor: disabled ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap',
      outline: 'none',
      transition: 'opacity 0.1s',
    }}
    onMouseEnter={(e) => {
      if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.opacity = '1';
    }}
  >
    <Icon name={iconName} size={13} />
    {label}
    {children}
  </button>
);

const BarDivider: React.FC = () => (
  <div
    aria-hidden="true"
    style={{
      width: '1px',
      height: '20px',
      backgroundColor: 'rgba(255,255,255,0.3)',
      flexShrink: 0,
    }}
  />
);

const IconButton: React.FC<{
  iconName: string;
  onClick?: () => void;
  title: string;
  bgColor?: string;
  textColor?: string;
  size?: number;
}> = ({ iconName, onClick, title, bgColor = 'transparent', textColor = '#fff', size = 18 }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '24px',
      backgroundColor: bgColor,
      color: textColor,
      border: bgColor === 'transparent' ? 'none' : '2px solid #000',
      borderRadius: '2px',
      cursor: 'pointer',
      outline: 'none',
      padding: 0,
      flexShrink: 0,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.opacity = '0.75';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.opacity = '1';
    }}
  >
    <Icon name={iconName} size={size} style={{ color: textColor }} />
  </button>
);

// ============================================================================
// RECLASSIFY PROGRESS OVERLAY
// ============================================================================

interface ReclassifyProgressProps {
  progress: { completed: number; total: number; phase?: string } | null | undefined;
}

const ReclassifyProgress: React.FC<ReclassifyProgressProps> = ({ progress }) => {
  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginLeft: '6px',
      }}
      aria-live="polite"
      aria-label={`Reclassifying: ${pct}% complete`}
    >
      <div
        style={{
          width: '60px',
          height: '6px',
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: '1px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: '#22c55e',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '9px',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {progress?.phase ?? 'INIT...'}
      </span>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BrutalistTopBar: React.FC<BrutalistTopBarProps> = React.memo(({
  searchQuery,
  onSearchChange,
  onQuickAddClick,
  onRefreshAllClick,
  onReclassifyClick,
  isReclassifying = false,
  reclassifyProgress,
  onSettingsClick,
  onToggleUiMode,
  onImessageImportClick,
  showImessageButton = false,
}) => {
  const reclassifyLabel = (() => {
    if (!isReclassifying) return 'Reclassify';
    if (!reclassifyProgress || reclassifyProgress.total === 0) return 'Starting...';
    const pct = Math.round((reclassifyProgress.completed / reclassifyProgress.total) * 100);
    return `${pct}%`;
  })();

  return (
    <header
      style={{
        height: '40px',
        minHeight: '40px',
        backgroundColor: '#1e3a8a',
        borderBottom: '2px solid #000',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '12px',
        paddingRight: '12px',
        gap: '10px',
        flexShrink: 0,
        zIndex: 10,
      }}
      aria-label="Application header"
    >
      {/* ---- Brand ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          flexShrink: 0,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '24px',
            height: '24px',
            backgroundColor: '#fff',
            border: '2px solid rgba(255,255,255,0.4)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="database" size={14} style={{ color: '#1e3a8a' }} />
        </div>
        <span
          style={{
            fontWeight: 900,
            fontSize: '18px',
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          DECANT
        </span>
      </div>

      {/* ---- Search ---- */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search global database..."
          aria-label="Global search"
          style={{
            paddingLeft: '28px',
            paddingRight: '8px',
            height: '26px',
            width: '256px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '2px',
            color: '#fff',
            fontSize: '11px',
            outline: 'none',
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.7)';
            (e.currentTarget as HTMLInputElement).style.backgroundColor = 'rgba(255,255,255,0.15)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.3)';
            (e.currentTarget as HTMLInputElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
          }}
        />
      </div>

      {/* ---- Spacer ---- */}
      <div style={{ flex: 1 }} />

      {/* ---- Action buttons ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* IMPORT */}
        <ActionButton
          label="Import"
          iconName="add"
          onClick={onQuickAddClick}
          bgColor="#facc15"
          title="Quick Add (Cmd+N)"
        />

        {/* iMessage — only on macOS */}
        {showImessageButton && (
          <ActionButton
            label="iMessage"
            iconName="sms"
            onClick={onImessageImportClick}
            bgColor="#34d399"
            title="Import links from your iMessage notes-to-self"
          />
        )}

        {/* SYNC */}
        <ActionButton
          label="Sync"
          iconName="sync"
          onClick={onRefreshAllClick}
          bgColor="#fff"
          title="Refresh all"
        />

        {/* RECLASSIFY */}
        <ActionButton
          label={reclassifyLabel}
          iconName="auto_awesome"
          onClick={onReclassifyClick}
          disabled={isReclassifying}
          bgColor="#22c55e"
          title="Reclassify all nodes with AI"
        />
        {isReclassifying && (
          <ReclassifyProgress progress={reclassifyProgress} />
        )}

        <BarDivider />

        {/* Settings */}
        <IconButton
          iconName="settings"
          onClick={onSettingsClick}
          title="Settings"
        />

        {/* UI Mode toggle */}
        <IconButton
          iconName="deployed_code"
          onClick={onToggleUiMode}
          title="Switch UI mode"
          bgColor="#7c3aed"
          textColor="#fff"
          size={15}
        />
      </div>
    </header>
  );
});

BrutalistTopBar.displayName = 'BrutalistTopBar';
