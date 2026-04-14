/**
 * BrutalistDetailPane — Right-side detail panel for the Brutalist V2 theme.
 *
 * Shows full metadata for the currently-selected TableRow. 320px wide,
 * bg #e2e8f0, overflow-y-auto. Slides in when a row is selected.
 *
 * Uses Material Symbols Outlined icon font (must be loaded in the app's HTML):
 *   <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
 *
 * Usage:
 *   <BrutalistDetailPane item={selectedRow} onClose={() => setSelectedRow(null)} />
 */

import React, { useCallback } from 'react';
import { TableRow } from '../types';
import { shortId, formatDate, getSegmentHex } from '../helpers';

// ============================================================================
// PROPS
// ============================================================================

interface BrutalistDetailPaneProps {
  item: TableRow | null;
  onClose: () => void;
}

// ============================================================================
// ICON HELPER
// ============================================================================

const Icon: React.FC<{ name: string; size?: number; style?: React.CSSProperties }> = ({
  name,
  size = 14,
  style,
}) => (
  <span
    className="material-symbols-outlined"
    aria-hidden="true"
    style={{
      fontSize: `${size}px`,
      lineHeight: 1,
      userSelect: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      ...style,
    }}
  >
    {name}
  </span>
);

// ============================================================================
// SHARED PRIMITIVE COMPONENTS
// ============================================================================

/** Small uppercase label used above values in the metadata grid. */
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'block',
      fontSize: '8px',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      color: '#475569',
    }}
  >
    {children}
  </span>
);

/** Value text paired with a FieldLabel in the metadata grid. */
const FieldValue: React.FC<{ children: React.ReactNode; mono?: boolean }> = ({
  children,
  mono = false,
}) => (
  <span
    style={{
      display: 'block',
      fontSize: '10px',
      fontWeight: 700,
      color: '#0f172a',
      marginTop: '1px',
      fontFamily: mono ? 'monospace' : undefined,
      wordBreak: 'break-word',
    }}
  >
    {children || <span style={{ color: '#94a3b8' }}>—</span>}
  </span>
);

/** White card container used by each classification/metadata section. */
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      backgroundColor: '#fff',
      border: '1px solid #000',
      padding: '8px',
    }}
  >
    {children}
  </div>
);

interface CardHeaderProps {
  label: string;
  iconName?: string;
}

/** Card section header with optional edit icon. */
const CardHeader: React.FC<CardHeaderProps> = ({ label, iconName }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #e2e8f0',
      paddingBottom: '4px',
      marginBottom: '6px',
    }}
  >
    <span
      style={{
        fontSize: '9px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: '#475569',
      }}
    >
      {label}
    </span>
    {iconName && (
      <Icon name={iconName} size={12} style={{ color: '#94a3b8', cursor: 'pointer' }} />
    )}
  </div>
);

/** Two-column metadata grid used by classification and system metadata cards. */
const MetaGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      columnGap: '12px',
      rowGap: '8px',
    }}
  >
    {children}
  </div>
);

interface MetaFieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

/** A single label + value pair for use inside MetaGrid. */
const MetaField: React.FC<MetaFieldProps> = ({ label, value, mono }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <FieldValue mono={mono}>{value}</FieldValue>
  </div>
);

// ============================================================================
// SECTION: HEADER BAR
// ============================================================================

interface DetailHeaderProps {
  onClose: () => void;
  onCopy?: () => void;
  onShare?: () => void;
}

const DetailHeader: React.FC<DetailHeaderProps> = ({ onClose, onCopy, onShare }) => (
  <div
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backgroundColor: '#fff',
      borderBottom: '2px solid #000',
      padding: '6px 8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}
  >
    <span
      style={{
        fontSize: '9px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: '#0f172a',
        userSelect: 'none',
      }}
    >
      Active Node Detail
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={onCopy}
        title="Copy node data"
        aria-label="Copy node data"
        style={iconBtnStyle}
        onMouseEnter={btnHoverOn}
        onMouseLeave={btnHoverOff}
      >
        <Icon name="content_copy" size={14} />
      </button>
      <button
        onClick={onShare}
        title="Share node"
        aria-label="Share node"
        style={iconBtnStyle}
        onMouseEnter={btnHoverOn}
        onMouseLeave={btnHoverOff}
      >
        <Icon name="share" size={14} />
      </button>
      <button
        onClick={onClose}
        title="Close detail pane"
        aria-label="Close detail pane"
        style={iconBtnStyle}
        onMouseEnter={btnHoverOn}
        onMouseLeave={btnHoverOff}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  </div>
);

// ============================================================================
// SECTION: TITLE + STATUS BADGES
// ============================================================================

interface TitleSectionProps {
  row: TableRow;
}

const TitleSection: React.FC<TitleSectionProps> = ({ row }) => (
  <div>
    <p
      style={{
        fontSize: '13px',
        fontWeight: 900,
        textTransform: 'uppercase',
        lineHeight: 1.25,
        color: '#0f172a',
        borderBottom: '1px solid #000',
        paddingBottom: '4px',
        marginBottom: '6px',
        wordBreak: 'break-word',
      }}
    >
      {row.title}
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {/* Urgency badge: red if starred, green otherwise */}
      <span style={row.starred ? criticalBadgeStyle : activeBadgeStyle}>
        {row.starred ? 'Critical' : 'Active-Node'}
      </span>
      {/* Static status badge */}
      <span style={activeBadgeStyle}>Active-Node</span>
    </div>
  </div>
);

// ============================================================================
// SECTION: NODE CLASSIFICATION
// ============================================================================

interface ClassificationCardProps {
  row: TableRow;
}

const ClassificationCard: React.FC<ClassificationCardProps> = ({ row }) => (
  <Card>
    <CardHeader label="Node Classification" iconName="edit" />
    <MetaGrid>
      <MetaField label="Segment" value={row.segment} />
      <MetaField label="Origin" value={row.sourceDomain || 'Direct'} />
      <MetaField label="Category" value={row.category} />
      <MetaField label="Updated" value={row.date ? formatDate(row.date) : undefined} />
      <MetaField label="Type" value={row.type} />
      <MetaField label="Subcategory" value={row.subcategoryLabel} />
    </MetaGrid>
  </Card>
);

// ============================================================================
// SECTION: TECHNICAL PROPERTIES
// ============================================================================

interface TechnicalCardProps {
  row: TableRow;
}

const TechnicalCard: React.FC<TechnicalCardProps> = ({ row }) => {
  // Merge system tags and user tags into a single flat label array.
  const allTags: string[] = [
    ...(row.tags ?? []).map((t) => t.label),
    ...(row.userTags ?? []).map((t) => t.name),
  ];

  return (
    <Card>
      <CardHeader label="Technical Properties" />

      {/* Function Manifest */}
      <div style={{ marginBottom: '8px' }}>
        <FieldLabel>Function Manifest</FieldLabel>
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '4px 6px',
            marginTop: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#334155',
            wordBreak: 'break-word',
            minHeight: '28px',
          }}
        >
          {row.functionTags?.trim()
            ? row.functionTags
            : <span style={{ color: '#94a3b8' }}>No function tags assigned</span>}
        </div>
      </div>

      {/* Assigned Tags */}
      <div>
        <FieldLabel>Assigned Tags</FieldLabel>
        {allTags.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '3px',
              marginTop: '4px',
            }}
          >
            {allTags.map((tag) => (
              <span key={tag} style={tagBadgeStyle}>
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <span
            style={{
              display: 'block',
              fontSize: '9px',
              color: '#94a3b8',
              marginTop: '4px',
            }}
          >
            No tags
          </span>
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// SECTION: SYSTEM METADATA
// ============================================================================

interface SystemMetaCardProps {
  row: TableRow;
}

const SystemMetaCard: React.FC<SystemMetaCardProps> = ({ row }) => (
  <Card>
    <CardHeader label="System Metadata" />
    <MetaGrid>
      <MetaField label="Node ID:" value={shortId(row.id)} mono />
      <MetaField label="Segment:" value={row.segmentCode} mono />
      <MetaField label="Category:" value={row.categoryCode} mono />
      <MetaField label="Domain:" value={row.sourceDomain || 'N/A'} />
      <MetaField
        label="Starred:"
        value={
          row.starred ? (
            <span style={{ color: '#16a34a', fontWeight: 900 }}>YES</span>
          ) : (
            'NO'
          )
        }
      />
    </MetaGrid>
  </Card>
);

// ============================================================================
// SECTION: DEVELOPER LOG (DESCRIPTION)
// ============================================================================

interface DevLogSectionProps {
  row: TableRow;
}

const DevLogSection: React.FC<DevLogSectionProps> = ({ row }) => {
  const initialValue = row.shortDescription || row.quickPhrase || '';

  return (
    <div>
      <span
        style={{
          display: 'block',
          fontSize: '9px',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#0f172a',
          marginBottom: '4px',
        }}
      >
        Developer Log
      </span>
      <textarea
        readOnly
        defaultValue={initialValue}
        aria-label="Developer log"
        style={{
          width: '100%',
          backgroundColor: '#fff',
          border: '1px solid #000',
          padding: '6px',
          fontSize: '10px',
          color: '#0f172a',
          height: '80px',
          resize: 'none',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          outline: 'none',
          boxSizing: 'border-box',
        }}
        placeholder="No description available."
      />
    </div>
  );
};

// ============================================================================
// SECTION: ACTION BUTTON
// ============================================================================

interface OpenButtonProps {
  url: string | undefined;
}

const OpenInBrowserButton: React.FC<OpenButtonProps> = ({ url }) => {
  const handleClick = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [url]);

  return (
    <button
      onClick={handleClick}
      disabled={!url}
      aria-label="Open node URL in browser"
      style={{
        width: '100%',
        backgroundColor: url ? '#000' : '#64748b',
        color: '#fff',
        border: '2px solid #000',
        padding: '6px 0',
        fontSize: '10px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        cursor: url ? 'pointer' : 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        transition: 'opacity 0.1s',
      }}
      onMouseEnter={(e) => {
        if (url) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
      }}
    >
      <Icon name="open_in_new" size={13} style={{ color: '#fff' }} />
      Open in Browser
    </button>
  );
};

// ============================================================================
// SHARED STYLE CONSTANTS
// ============================================================================

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#64748b',
  borderRadius: '2px',
  padding: 0,
  outline: 'none',
  transition: 'opacity 0.1s',
};

function btnHoverOn(e: React.MouseEvent<HTMLButtonElement>) {
  (e.currentTarget as HTMLButtonElement).style.opacity = '0.6';
}
function btnHoverOff(e: React.MouseEvent<HTMLButtonElement>) {
  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
}

const baseBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '8px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  border: '1px solid #000',
  padding: '1px 5px',
  lineHeight: 1.5,
};

const activeBadgeStyle: React.CSSProperties = {
  ...baseBadgeStyle,
  backgroundColor: '#22c55e',
  color: '#fff',
};

const criticalBadgeStyle: React.CSSProperties = {
  ...baseBadgeStyle,
  backgroundColor: '#ef4444',
  color: '#fff',
};

const tagBadgeStyle: React.CSSProperties = {
  backgroundColor: '#e2e8f0',
  border: '1px solid rgba(0,0,0,0.2)',
  padding: '1px 4px',
  fontSize: '8px',
  fontWeight: 700,
  color: '#334155',
  letterSpacing: '0.04em',
};

// ============================================================================
// EMPTY STATE
// ============================================================================

const EmptyState: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '8px',
      color: '#94a3b8',
      userSelect: 'none',
    }}
  >
    <Icon name="info" size={28} style={{ color: '#cbd5e1' }} />
    <span
      style={{
        fontSize: '9px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      No Node Selected
    </span>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BrutalistDetailPane: React.FC<BrutalistDetailPaneProps> = React.memo(
  ({ item, onClose }) => {
    const segmentColor = item ? getSegmentHex(item.segmentCode) : '#6b7280';

    return (
      <aside
        aria-label="Node detail panel"
        style={{
          width: '320px',
          minWidth: '320px',
          backgroundColor: '#e2e8f0',
          borderLeft: '2px solid #000',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {/* Segment color accent strip — top edge */}
        <div
          aria-hidden="true"
          style={{
            height: '3px',
            backgroundColor: segmentColor,
            flexShrink: 0,
          }}
        />

        <DetailHeader onClose={onClose} />

        {item === null ? (
          <EmptyState />
        ) : (
          <div
            style={{
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flex: 1,
            }}
          >
            <TitleSection row={item} />
            <ClassificationCard row={item} />
            <TechnicalCard row={item} />
            <SystemMetaCard row={item} />
            <DevLogSection row={item} />
            <OpenInBrowserButton url={item.url} />
          </div>
        )}
      </aside>
    );
  }
);

BrutalistDetailPane.displayName = 'BrutalistDetailPane';
