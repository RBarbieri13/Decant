/**
 * BrutalistSidebar
 *
 * Brutalist-design sidebar for the Decant demo. 208px wide, slate-200 bg.
 * Three sections: Main Library (static), Hierarchy (dynamic tree from props),
 * System Tags (derived from tree segment roots).
 *
 * Usage:
 *   <BrutalistSidebar
 *     data={treeData}
 *     selectedId={selectedId}
 *     onSelect={(id, node) => setSelectedId(id)}
 *     itemCounts={countsMap}
 *   />
 */

import React, { useState, useCallback } from 'react';
import type { TreeNodeData } from '../types';
import { SEGMENT_HEX_MAP } from '../helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface BrutalistSidebarProps {
  data: TreeNodeData[];
  selectedId: string | null;
  onSelect: (id: string, node: TreeNodeData) => void;
  itemCounts?: Map<string, number>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maps segment name keywords to Material Symbols icon names.
 * Checked in order — first match wins.
 */
const SEGMENT_ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['ai', 'machine', 'learning'],   icon: 'terminal' },
  { keywords: ['technology', 'development'],    icon: 'code' },
  { keywords: ['finance', 'economics'],         icon: 'payments' },
  { keywords: ['sport', 'fitness'],             icon: 'sports_soccer' },
  { keywords: ['health', 'wellness'],           icon: 'health_and_safety' },
  { keywords: ['business', 'productivity'],     icon: 'business_center' },
  { keywords: ['entertainment', 'media'],       icon: 'movie' },
  { keywords: ['lifestyle', 'personal'],        icon: 'home' },
  { keywords: ['science', 'research'],          icon: 'science' },
  { keywords: ['creative', 'design'],           icon: 'palette' },
];

/**
 * Derives a Material Symbol icon for a segment-level node from its name.
 */
function getSegmentIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const rule of SEGMENT_ICON_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.icon;
    }
  }
  return 'folder';
}

/**
 * Derives a Material Symbol icon for a category-level node from its name.
 * Falls back to a generic folder variant.
 */
function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('language') || lower.includes('llm') || lower.includes('nlp')) return 'translate';
  if (lower.includes('agent'))          return 'smart_toy';
  if (lower.includes('foundation'))     return 'layers';
  if (lower.includes('ops') || lower.includes('devops')) return 'settings_suggest';
  if (lower.includes('vision'))         return 'visibility';
  if (lower.includes('generative'))     return 'auto_awesome';
  if (lower.includes('ethic'))          return 'balance';
  if (lower.includes('research'))       return 'biotech';
  if (lower.includes('web'))            return 'web';
  if (lower.includes('mobile'))         return 'smartphone';
  if (lower.includes('cloud'))          return 'cloud';
  if (lower.includes('security'))       return 'lock';
  if (lower.includes('data'))           return 'storage';
  if (lower.includes('api'))            return 'api';
  if (lower.includes('hardware'))       return 'memory';
  if (lower.includes('invest'))         return 'trending_up';
  if (lower.includes('crypto'))         return 'currency_bitcoin';
  if (lower.includes('tax') || lower.includes('account')) return 'receipt_long';
  if (lower.includes('market'))         return 'candlestick_chart';
  if (lower.includes('real estate'))    return 'apartment';
  if (lower.includes('training') || lower.includes('gym')) return 'fitness_center';
  if (lower.includes('run'))            return 'directions_run';
  if (lower.includes('basketball'))     return 'sports_basketball';
  if (lower.includes('baseball'))       return 'sports_baseball';
  if (lower.includes('soccer'))         return 'sports_soccer';
  if (lower.includes('medical'))        return 'local_hospital';
  if (lower.includes('mental'))         return 'psychology';
  if (lower.includes('nutrition'))      return 'nutrition';
  if (lower.includes('sleep'))          return 'bedtime';
  if (lower.includes('strategy'))       return 'account_tree';
  if (lower.includes('product'))        return 'inventory_2';
  if (lower.includes('marketing'))      return 'campaign';
  if (lower.includes('sales'))          return 'point_of_sale';
  if (lower.includes('gaming'))         return 'videogame_asset';
  if (lower.includes('music'))          return 'music_note';
  if (lower.includes('movie') || lower.includes('tv')) return 'theaters';
  if (lower.includes('podcast'))        return 'podcasts';
  if (lower.includes('home'))           return 'home';
  if (lower.includes('fashion'))        return 'checkroom';
  if (lower.includes('food') || lower.includes('cook')) return 'restaurant';
  if (lower.includes('travel'))         return 'flight';
  if (lower.includes('photo'))          return 'photo_camera';
  if (lower.includes('video'))          return 'videocam';
  if (lower.includes('writing'))        return 'edit_note';
  if (lower.includes('ux') || lower.includes('design')) return 'design_services';
  if (lower.includes('physics'))        return 'speed';
  if (lower.includes('biology'))        return 'biotech';
  if (lower.includes('chemistry'))      return 'science';
  if (lower.includes('astronom'))       return 'telescope';
  if (lower.includes('math'))           return 'calculate';
  if (lower.includes('javascript') || lower.includes('js')) return 'javascript';
  if (lower.includes('network') || lower.includes('ethernet')) return 'settings_ethernet';
  if (lower.includes('model'))          return 'model_training';
  return 'folder_special';
}

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  label: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ label }) => (
  <div className="px-3 pt-3 pb-1">
    <span
      style={{ fontSize: '9px', letterSpacing: '0.12em' }}
      className="font-black uppercase text-[#475569]"
    >
      {label}
    </span>
  </div>
);

// ============================================================================
// STATIC NAV ITEM (Main Library section)
// ============================================================================

interface StaticNavItemProps {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const StaticNavItem: React.FC<StaticNavItemProps> = ({
  id,
  label,
  icon,
  iconColor,
  selectedId,
  onSelect,
  isFirst,
  isLast,
}) => {
  const isSelected = selectedId === id;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(id); }}
      className={[
        'flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none',
        'border-black',
        isFirst ? 'border-y' : isLast ? 'border-b' : 'border-b',
        isSelected
          ? 'bg-white font-bold text-black'
          : 'hover:bg-white/60 text-slate-700',
      ].join(' ')}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '15px', color: iconColor }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-[11px] flex-1 truncate">{label}</span>
    </div>
  );
};

// ============================================================================
// TREE NODE (Hierarchy section)
// ============================================================================

interface TreeNodeItemProps {
  node: TreeNodeData;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string, node: TreeNodeData) => void;
  onToggle: (id: string) => void;
  itemCounts?: Map<string, number>;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = React.memo(({
  node,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  itemCounts,
}) => {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const count = itemCounts?.get(node.id);

  // Derive icon and colors by level
  const icon = level === 0
    ? getSegmentIcon(node.name)
    : level === 1
      ? getCategoryIcon(node.name)
      : 'subdirectory_arrow_right';

  const iconColor = level === 0
    ? '#9333ea'
    : level === 1
      ? '#22c55e'
      : '#64748b'; // slate-500

  // Level-based background
  const bgStyle: React.CSSProperties =
    level === 0
      ? { background: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }
      : level === 1
        ? { background: 'rgba(0,0,0,0.02)' }
        : { background: 'rgba(0,0,0,0.05)' };

  const paddingLeft = level === 0 ? '0.75rem' : level === 1 ? '1.75rem' : '2.75rem';

  const handleClick = useCallback(() => {
    onSelect(node.id, node);
  }, [node, onSelect]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  }, [node.id, onToggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      onToggle(node.id);
    } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      onToggle(node.id);
    }
  }, [handleClick, hasChildren, isExpanded, node.id, onToggle]);

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={[
          'flex items-center gap-2 px-3 py-1 cursor-pointer select-none outline-none',
          'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-purple-400',
          isSelected ? 'bg-white font-bold text-black' : 'hover:bg-white/60 text-slate-800',
          level === 0 ? 'font-bold' : '',
        ].join(' ')}
        style={{ ...bgStyle, paddingLeft }}
      >
        {/* Expand/collapse toggle — only rendered for nodes with children */}
        {hasChildren ? (
          <button
            tabIndex={-1}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={handleToggle}
            className="flex items-center justify-center w-3 h-3 shrink-0 text-slate-400 hover:text-slate-700"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '12px' }}
              aria-hidden="true"
            >
              {isExpanded ? 'expand_more' : 'chevron_right'}
            </span>
          </button>
        ) : (
          <span className="w-3 h-3 shrink-0" aria-hidden="true" />
        )}

        <span
          className="material-symbols-outlined shrink-0"
          style={{ fontSize: '14px', color: iconColor }}
          aria-hidden="true"
        >
          {icon}
        </span>

        <span
          className="flex-1 truncate"
          style={{ fontSize: level >= 2 ? '11px' : '12px' }}
        >
          {node.name}
        </span>

        {count != null && count > 0 && (
          <span
            className="shrink-0 text-[9px] font-bold text-slate-500 tabular-nums"
            aria-label={`${count} items`}
          >
            {count}
          </span>
        )}
      </div>

      {/* Recursive children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              itemCounts={itemCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TreeNodeItem.displayName = 'TreeNodeItem';

// ============================================================================
// SYSTEM TAGS SECTION
// Derives tag labels from segment root nodes in the tree data.
// Falls back to SEGMENT_HEX_MAP keys if tree is empty.
// ============================================================================

interface SystemTagsProps {
  data: TreeNodeData[];
  selectedId: string | null;
  onSelect: (id: string, node: TreeNodeData) => void;
}

const SystemTags: React.FC<SystemTagsProps> = ({ data, selectedId, onSelect }) => {
  // Collect segment root nodes for tags. If tree is empty, derive from hex map.
  const tagNodes: Array<{ id: string; label: string; node: TreeNodeData }> = data.length > 0
    ? data.map((node) => ({
        id: node.id,
        label: node.name.split(/[&/]/)[0].trim().toUpperCase().slice(0, 4),
        node,
      }))
    : Object.keys(SEGMENT_HEX_MAP).map((code) => ({
        id: `seg-${code}`,
        label: code,
        node: { id: `seg-${code}`, name: code, iconHint: '', iconColor: '' },
      }));

  return (
    <div className="px-3 py-2 border-t border-black/10 mt-auto">
      <SectionHeader label="System Tags" />
      <div className="flex flex-wrap gap-1 pt-1">
        {tagNodes.map(({ id, label, node }) => {
          const isActive = selectedId === id;
          return (
            <button
              key={id}
              aria-pressed={isActive}
              onClick={() => onSelect(id, node)}
              className={[
                'text-[8px] font-bold px-1 border border-black uppercase tracking-wide',
                'transition-colors duration-100',
                isActive
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-slate-100',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// BRUTALIST SIDEBAR — Main Export
// ============================================================================

export const BrutalistSidebar: React.FC<BrutalistSidebarProps> = ({
  data,
  selectedId,
  onSelect,
  itemCounts,
}) => {
  // Auto-expand top-level nodes on first render
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const node of data) {
      ids.add(node.id);
    }
    return ids;
  });

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleStaticSelect = useCallback((id: string) => {
    onSelect(id, { id, name: id, iconHint: '', iconColor: '' } as TreeNodeData);
  }, [onSelect]);

  return (
    <aside
      role="navigation"
      aria-label="Decant sidebar"
      className="flex flex-col overflow-y-auto"
      style={{
        width: '208px',
        minWidth: '208px',
        background: '#e2e8f0',
        height: '100%',
      }}
    >
      {/* ── Section 1: Main Library ─────────────────────────────── */}
      <section aria-label="Main library">
        <SectionHeader label="Main Library" />
        <nav>
          <StaticNavItem
            id="all"
            label="All Resources"
            icon="folder_open"
            iconColor="#9333ea"
            selectedId={selectedId}
            onSelect={handleStaticSelect}
            isFirst
          />
          <StaticNavItem
            id="favorites"
            label="Favorites"
            icon="star"
            iconColor="#22c55e"
            selectedId={selectedId}
            onSelect={handleStaticSelect}
          />
          <StaticNavItem
            id="recent"
            label="Recent"
            icon="history"
            iconColor="#2563eb"
            selectedId={selectedId}
            onSelect={handleStaticSelect}
            isLast
          />
        </nav>
      </section>

      {/* ── Section 2: Hierarchy ────────────────────────────────── */}
      <section aria-label="Hierarchy" className="mt-2">
        <SectionHeader label="Hierarchy" />
        <div role="tree" aria-label="Resource hierarchy">
          {data.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              level={0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={handleToggle}
              itemCounts={itemCounts}
            />
          ))}
        </div>
      </section>

      {/* ── Section 3: System Tags ──────────────────────────────── */}
      <SystemTags
        data={data}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </aside>
  );
};

export default BrutalistSidebar;
