/**
 * Decant Application - Full Featured Demo
 *
 * Complete working application with:
 * - TopBar with search, breadcrumbs, view toggle
 * - HierarchyTree sidebar with collapsible folders
 * - DataTable main content with expandable rows
 * - PropertiesPanel right panel with full item details
 * - API integration for real data
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '../styles/app.css';
// Import logo
import decantLogoLight from '../assets/decant-logo-light.png';
// Import Batch Import Modal
import { BatchImportModal } from '../components/import/BatchImportModal';
// Import Quick Add Modal
import { QuickAddModal } from '../components/import/QuickAddModal';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { useApp } from '../context/AppContext';
// API imports for backend integration
import { nodesAPI, hierarchyAPI, adminAPI, reclassifyAPI } from '../services/api';
// Real-time service for hierarchy updates
import { createIntegratedSSEClient } from '../services/realtimeService';
// Metadata code colors utility
import { getMetadataCodeColor, getSegmentColor, formatMetadataCodesForDisplay, parseRawTag } from '../utils/metadataCodeColors';
// Hierarchy icons
import { getTreeNodeIcon, getIconProps, getCategoryIcon } from '../utils/hierarchyIcons';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

const SEGMENT_LABELS: Record<string, string> = {
  A: 'AI & ML', T: 'Technology', F: 'Finance', S: 'Sports',
  H: 'Health', B: 'Business', E: 'Entertainment', L: 'Lifestyle',
  X: 'Science', C: 'Creative',
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  A: { LLM: 'LLMs', AGT: 'AI Agents', FND: 'Foundation', MLO: 'MLOps', NLP: 'NLP', CVS: 'Vision', GEN: 'Generative', ETH: 'Ethics', RES: 'Research', OTH: 'Other' },
  T: { WEB: 'Web', MOB: 'Mobile', DEV: 'Dev Tools', CLD: 'Cloud', SEC: 'Security', DAT: 'Data', API: 'APIs', OPS: 'DevOps', HRD: 'Hardware', OTH: 'Other' },
  F: { INV: 'Investing', CRY: 'Crypto', FPA: 'FP&A', BNK: 'Banking', TAX: 'Tax', PFN: 'Personal', MKT: 'Markets', REL: 'Real Estate', ECN: 'Economics', OTH: 'Other' },
  S: { NFL: 'NFL', FAN: 'Fantasy', FIT: 'Fitness', RUN: 'Running', GYM: 'Training', NBA: 'NBA', MLB: 'MLB', SOC: 'Soccer', OLY: 'Olympics', OTH: 'Other' },
  H: { MED: 'Medical', MNT: 'Mental', NUT: 'Nutrition', SLP: 'Sleep', ACC: 'Access', WEL: 'Wellness', FRT: 'Fertility', AGE: 'Aging', DIS: 'Disease', OTH: 'Other' },
  B: { STR: 'Strategy', MNG: 'Mgmt', PRD: 'Product', MKT: 'Marketing', SAL: 'Sales', OPS: 'Ops', HRS: 'HR', STP: 'Startups', ENT: 'Enterprise', OTH: 'Other' },
  E: { GAM: 'Gaming', MUS: 'Music', MOV: 'Movies', STR: 'Streaming', SOC: 'Social', POP: 'Pop Culture', POD: 'Podcasts', CEL: 'Celebs', EVT: 'Events', OTH: 'Other' },
  L: { HOM: 'Home', FAS: 'Fashion', FOD: 'Food', TRV: 'Travel', REL: 'Relations', PAR: 'Parenting', PET: 'Pets', HOB: 'Hobbies', GAR: 'Garden', OTH: 'Other' },
  X: { PHY: 'Physics', BIO: 'Biology', CHM: 'Chemistry', AST: 'Astronomy', ENV: 'Environment', MAT: 'Math', ENG: 'Engineering', SOC: 'Social Sci', PSY: 'Psychology', OTH: 'Other' },
  C: { UXD: 'UX', GRD: 'Graphic', WRT: 'Writing', PHO: 'Photo', VID: 'Video', AUD: 'Audio', ART: 'Art', ANI: 'Animation', TYP: 'Typography', OTH: 'Other' },
};

const CONTENT_TYPE_SYMBOLS: Record<string, string> = {
  T: '\u{1F527}', A: '\u{1F4C4}', V: '\u{1F3AC}', P: '\u{1F4DA}', R: '\u{1F4E6}',
  G: '\u{1F4D6}', S: '\u{2601}', C: '\u{1F393}', I: '\u{1F5BC}', N: '\u{1F4F0}',
  K: '\u{1F4DA}', U: '\u{2753}',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  T: 'Tool', A: 'Website', V: 'Video', P: 'Tutorial',
  R: 'Repo', G: 'Guide', S: 'Social', C: 'Course',
  I: 'Image', N: 'News', K: 'Reference', U: 'Unknown',
};

function getTypeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    'Website':   'website',
    'Video':     'video',
    'X':         'x',
    'Tool':      'tool',
    'Social':    'social',
    'Repo':      'repo',
    'Tutorial':  'tutorial',
    'Course':    'course',
    'Guide':     'guide',
    'News':      'news',
    'Image':     'image',
    'Reference': 'reference',
    'Unknown':   'unknown',
  };
  return map[type] || 'unknown';
}

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'table' | 'grid' | 'tree' | 'list';
type TagColor = 'blue' | 'yellow' | 'pink' | 'green' | 'purple' | 'gray' | 'orange' | 'teal';
type PanelTab = 'properties' | 'related' | 'backlinks';

// Gumroad palette hex colors for tree node icons
const GUMROAD_ICON_COLORS: Record<string, string> = {
  pink: '#ff90e8',
  blue: '#90a8ed',
  green: '#23a094',
  yellow: '#f1c40f',
};

interface BreadcrumbItem {
  label: string;
  id?: string;
}

interface TreeNodeData {
  id: string;
  name: string;
  iconHint: string;
  iconColor: string;
  iconType?: string;
  children?: TreeNodeData[];
  isExpanded?: boolean;
}

type RowColor = 'pink' | 'yellow' | 'blue' | 'green' | 'red' | 'cream' | 'default';

interface HierarchyFilter {
  type: 'all' | 'segment' | 'category';
  segmentCode?: string;
  categoryCode?: string;
}

interface TableRow {
  id: string;
  segmentCode: string;
  categoryCode: string;
  logo: string;
  title: string;
  type: string;
  typeSymbol: string;
  segment: string;
  category: string;
  subcategoryLabel: string;
  hierarchy: string;
  quickPhrase: string;
  tags: { label: string; color: TagColor }[];
  date: string;
  company: string;
  starred: boolean;
  rowColor?: RowColor;
  checked?: boolean;
  // Extended data for panel
  url?: string;
  sourceDomain?: string;
  aiSummary?: string;
  shortDescription?: string;
  keyConcepts?: string[];
  version?: string;
  license?: string;
  author?: string;
  repository?: string;
  stars?: string;
  forks?: string;
  downloads?: string;
  lastUpdated?: string;
  usedBy?: string[];
  description?: string;
}

// ============================================================================
// SAMPLE DATA - Matching the mockup exactly
// ============================================================================

// Empty tree data - add your own folders and structure here
const SAMPLE_TREE_DATA: TreeNodeData[] = [];

// Empty table data - add your imported websites here
const SAMPLE_TABLE_DATA: TableRow[] = [];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const Tag: React.FC<{ label: string; color: TagColor }> = ({ label, color }) => (
  <span className={`decant-tag decant-tag--${color}`}>{label}</span>
);

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = d.getUTCDate();
  const mm = d.getUTCMonth() + 1;
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const formatRelativeDate = (dateStr: string): { display: string; full: string } => {
  const full = formatDate(dateStr);
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (isNaN(diffDays)) return { display: full, full };
    if (diffDays < 1) return { display: 'Today', full };
    if (diffDays === 1) return { display: 'Yesterday', full };
    if (diffDays < 7) return { display: `${diffDays}d ago`, full };
    if (diffDays < 30) return { display: `${Math.floor(diffDays / 7)}wk ago`, full };
    if (diffDays < 180) return { display: `${Math.floor(diffDays / 30)}mo ago`, full };
    // Older than 6 months: abbreviated absolute
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[date.getMonth()];
    const y = String(date.getFullYear()).slice(2);
    return { display: `${m} '${y}`, full };
  } catch {
    return { display: full, full };
  }
};

// ============================================================================
// TOP BAR COMPONENT
// ============================================================================

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  breadcrumbs: BreadcrumbItem[];
  onBreadcrumbClick?: (item: BreadcrumbItem, index: number) => void;
  onClearFilter?: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onBatchImportClick?: () => void;
  onQuickAddClick?: () => void;
  onRefreshAllClick?: () => void;
  onReclassifyClick?: () => void;
  isReclassifying?: boolean;
  onSettingsClick?: () => void;
  onUserClick?: () => void;
  userName?: string;
  showStarredOnly?: boolean;
  onToggleStarredFilter?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  breadcrumbs,
  onBreadcrumbClick,
  onClearFilter,
  // viewMode available for future use - moved to title bar
  // onViewModeChange available for future use - moved to title bar
  onBatchImportClick,
  onQuickAddClick,
  onRefreshAllClick,
  onReclassifyClick,
  isReclassifying: isReclassifyingProp,
  onSettingsClick,
  onUserClick,
  // userName available for future use
  showStarredOnly,
  onToggleStarredFilter,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      (e.target as HTMLInputElement).focus();
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const searchInput = document.querySelector('.decant-topbar__search-input') as HTMLInputElement;
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <header className="decant-topbar decant-topbar--light">
      {/* Left side: Logo + Brand + Search */}
      <div className="decant-topbar__left">
        <div className="decant-topbar__brand">
          <img src={decantLogoLight} alt="Decant" className="decant-topbar__logo" />
          <span className="decant-topbar__brand-name">Decant</span>
        </div>

        {/* Search bar next to logo */}
        <div className="decant-topbar__search">
          <i className="bx bx-search decant-topbar__search-icon" />
          <input
            type="text"
            className="decant-topbar__search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all items..."
          />
          {searchQuery && (
            <button
              className="decant-topbar__clear-btn"
              onClick={() => onSearchChange('')}
            >
              <i className="bx bx-x" />
            </button>
          )}
        </div>

        {/* Active filter breadcrumb chip — only show when not at root */}
        {breadcrumbs && breadcrumbs.length > 1 && (
          <div className="decant-filter-breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <span className="decant-filter-breadcrumb__sep">›</span>}
                <button
                  className={`decant-filter-breadcrumb__crumb ${index === breadcrumbs.length - 1 ? 'decant-filter-breadcrumb__crumb--active' : ''}`}
                  onClick={() => onBreadcrumbClick?.(crumb, index)}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
            <button
              className="decant-filter-breadcrumb__clear"
              onClick={onClearFilter}
              title="Clear filter"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="decant-topbar__spacer" />

      {/* Right side icons */}
      <div className="decant-topbar__actions">
        <button
          className={`decant-topbar__icon-btn decant-topbar__star-filter ${showStarredOnly ? 'decant-topbar__star-filter--active' : ''}`}
          onClick={onToggleStarredFilter}
          title={showStarredOnly ? 'Showing starred only (click to show all)' : 'Filter to starred items'}
        >
          <i className={`bx ${showStarredOnly ? 'bxs-star' : 'bx-star'}`} />
        </button>

        <button
          className="quick-add-trigger"
          onClick={onQuickAddClick}
          title="Quick Add (⌘N)"
        >
          +
        </button>

        <button
          className="gum-button gum-button--small gum-button--blue"
          onClick={onBatchImportClick}
          title="Batch Import URLs"
          style={{ marginLeft: '8px', marginRight: '4px' }}
        >
          Batch
        </button>

        <button
          className="gum-button gum-button--small gum-button--pink"
          onClick={onReclassifyClick}
          disabled={isReclassifyingProp}
          title="Reclassify all nodes with AI"
          style={{ marginRight: '12px' }}
        >
          {isReclassifyingProp ? 'Classifying...' : 'Reclassify'}
        </button>

        <button className="decant-topbar__icon-btn" title="Notifications">
          <i className="bx bx-bell" />
        </button>

        <button className="decant-topbar__icon-btn" title="Messages">
          <i className="bx bx-message-square-detail" />
        </button>

        <button
          className="decant-topbar__icon-btn"
          onClick={onRefreshAllClick}
          title="Re-analyze and rebuild hierarchy for all content"
        >
          <i className="bx bx-refresh" />
        </button>

        <button className="decant-topbar__icon-btn" onClick={onSettingsClick} title="Settings">
          <i className="bx bx-cog" />
        </button>

        <button className="decant-topbar__user" onClick={onUserClick}>
          <div className="decant-topbar__user-avatar decant-topbar__user-avatar--placeholder">
            <i className="bx bx-user" />
          </div>
        </button>
      </div>
    </header>
  );
};

// ============================================================================
// TITLE BAR COMPONENT
// ============================================================================

interface TitleBarProps {
  title: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
  title,
  viewMode,
  onViewModeChange,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="decant-titlebar">
      <h1 className="decant-titlebar__title">{title}</h1>

      <div className="decant-titlebar__spacer" />

      <div className="decant-view-toggle">
        {(['table', 'grid', 'tree', 'list'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            className={`decant-view-toggle__option ${viewMode === mode ? 'decant-view-toggle__option--active' : ''}`}
            onClick={() => onViewModeChange(mode)}
            title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
          >
            <i
              className={`bx ${
                mode === 'table'
                  ? 'bx-table'
                  : mode === 'grid'
                  ? 'bx-grid-alt'
                  : mode === 'tree'
                  ? 'bx-sitemap'
                  : 'bx-list-ul'
              }`}
            />
          </button>
        ))}
      </div>

      <div className="decant-titlebar__tabs">
        <button
          className={`decant-titlebar__tab ${activeTab === 'properties' ? 'decant-titlebar__tab--active' : ''}`}
          onClick={() => onTabChange('properties')}
        >
          PROPERTIES
        </button>
        <button
          className={`decant-titlebar__tab ${activeTab === 'related' ? 'decant-titlebar__tab--active' : ''}`}
          onClick={() => onTabChange('related')}
        >
          RELATED ITEMS
        </button>
        <button
          className={`decant-titlebar__tab ${activeTab === 'backlinks' ? 'decant-titlebar__tab--active' : ''}`}
          onClick={() => onTabChange('backlinks')}
        >
          BACKLINKS
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string, node: TreeNodeData) => void;
  onToggle: (id: string) => void;
}


const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  // Check if this node is an ancestor of the selected node
  const isAncestor = selectedId !== null && selectedId !== node.id &&
    (node.id.startsWith('seg-') && selectedId.startsWith(`cat-${node.id.replace('seg-', '')}-`));

  // Get the appropriate Tabler icon based on node ID pattern
  const NodeIcon = getTreeNodeIcon(node.id, node.iconType);

  // Derive segment color from node.id prefix (e.g. "A", "A.LLM", "A.LLM.gpt4")
  const segmentHexMap: Record<string, string> = {
    A: '#ec4899', H: '#ec4899', C: '#ec4899', // pink
    T: '#3b82f6', B: '#3b82f6', X: '#3b82f6', // blue
    F: '#22c55e', L: '#22c55e',                // green
    S: '#eab308', E: '#eab308',                // yellow
  };
  const segmentCode = node.id === 'all' ? '' : node.id.charAt(0).toUpperCase();
  const iconColor = segmentHexMap[segmentCode] ?? '#6b7280';

  const iconProps = getIconProps({ size: 16, stroke: 1.5, color: iconColor });


  return (
    <div className="decant-tree-node">
      <div
        className={`decant-tree-node__row ${isSelected ? 'decant-tree-node__row--selected' : ''} ${isAncestor ? 'decant-tree-node__row--ancestor' : ''}`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelect(node.id, node)}
      >
        {hasChildren ? (
          <button
            className="decant-tree-node__toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isExpanded ? <IconChevronDown size={14} stroke={1.5} /> : <IconChevronRight size={14} stroke={1.5} />}
          </button>
        ) : (
          <span className="decant-tree-node__toggle-spacer" />
        )}
        <NodeIcon {...iconProps} className="decant-tree-node__icon" />
        <i
          className={`bx ${node.iconHint || 'bx-file'} decant-tree-node__icon`}
          style={{ color: node.iconColor || '#6b7280' }}
        />
        <span className="decant-tree-node__label">{node.name}</span>
      </div>
      {hasChildren && isExpanded && (
        <div className="decant-tree-node__children">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface SidebarProps {
  data: TreeNodeData[];
  selectedId: string | null;
  onSelect: (id: string, node: TreeNodeData) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  totalCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  data,
  selectedId,
  onSelect,
  isCollapsed,
  onToggleCollapse,
  totalCount,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(['decant-core', 'project-phoenix', 'frontend', 'components', 'resources', 'team-space'])
  );
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter tree nodes based on search
  const filterTree = useCallback((nodes: TreeNodeData[], query: string): TreeNodeData[] => {
    if (!query) return nodes;

    return nodes.reduce<TreeNodeData[]>((acc, node) => {
      const matchesSearch = node.name.toLowerCase().includes(query.toLowerCase());
      const filteredChildren = node.children ? filterTree(node.children, query) : [];

      if (matchesSearch || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }
      return acc;
    }, []);
  }, []);

  const filteredData = useMemo(() => filterTree(data, searchQuery), [data, searchQuery, filterTree]);

  return (
    <aside className={`decant-sidebar ${isCollapsed ? 'decant-sidebar--collapsed' : ''}`}>
      <div className="decant-sidebar__search">
        <i className="bx bx-search" />
        <input
          type="text"
          placeholder="Search your tree..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="decant-sidebar__content">
        {/* All Items root node */}
        <div
          className={`decant-tree-node__root-row ${selectedId === 'all' || selectedId === null ? 'decant-tree-node__row--selected' : ''}`}
          onClick={() => onSelect('all', { id: 'all', name: 'All Items' } as any)}
          role="button"
          tabIndex={0}
        >
          <span className="decant-tree-node__toggle-spacer" />
          <svg className="decant-tree-node__root-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span className="decant-tree-node__root-label">All Items</span>
          <span className="decant-tree-node__root-count">{totalCount}</span>
        </div>
        {filteredData.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={handleToggle}
          />
        ))}
      </div>
      <button className="decant-sidebar__toggle" onClick={onToggleCollapse}>
        <i className={`bx ${isCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`} />
      </button>
    </aside>
  );
};

// ============================================================================
// DATA TABLE ROW COMPONENT
// ============================================================================

interface DataTableRowProps {
  data: TableRow;
  isSelected: boolean;
  isExpanded: boolean;
  isChecked: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleCheck: (id: string) => void;
  gridTemplate: string;
  onTagClick?: (tag: string) => void;
  onSegmentClick?: (segCode: string) => void;
  onCategoryClick?: (segCode: string, catCode: string) => void;
}

const DataTableRow: React.FC<DataTableRowProps> = ({
  data,
  isSelected,
  isExpanded,
  isChecked,
  onSelect,
  onToggleExpand,
  onToggleStar,
  onToggleCheck,
  gridTemplate,
  onTagClick,
  onSegmentClick,
  onCategoryClick,
}) => {
  const rowColorClass = data.rowColor ? `decant-table__row--${data.rowColor}` : '';
  const [starPulse, setStarPulse] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  // Get segment badge class
  const getSegmentClass = (segment: string) => {
    const color = getSegmentColor(segment.charAt(0).toUpperCase());
    if (color) return `decant-segment-badge--${color}`;
    return '';
  };

  return (
    <>
      <div
        className={`decant-table__row ${rowColorClass} ${isSelected ? 'decant-table__row--selected' : ''}`}
        style={{ gridTemplateColumns: gridTemplate }}
        onClick={() => onSelect(data.id)}
      >
        {/* Checkbox */}
        <div className="decant-table__cell decant-table__cell--center">
          <div
            className={`decant-checkbox ${isChecked ? 'decant-checkbox--checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck(data.id);
            }}
          />
        </div>
        {/* Expand button */}
        <div className="decant-table__cell decant-table__cell--center">
          <button
            className={`decant-table__expand-btn ${isExpanded ? 'decant-table__expand-btn--expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(data.id);
            }}
          >
            <i className="bx bx-chevron-right" />
          </button>
        </div>
        {/* Logo */}
        <div className="decant-table__cell decant-table__cell--center">
          <img src={data.logo} alt={data.title} className="decant-logo-icon" />
        </div>
        {/* Title */}
        <div className="decant-table__cell decant-table__cell--title">
          <span className="decant-table__title-text">{data.title}</span>
          {data.url && (
            <a
              className="decant-table__title-link"
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open URL"
            >
              <i className="bx bx-link-external" />
            </a>
          )}
        </div>
        {/* Segment with badge */}
        <div className="decant-table__cell">
          <span
            className={`decant-segment-badge ${getSegmentClass(data.segment)} decant-segment-badge--clickable`}
            onClick={(e) => { e.stopPropagation(); onSegmentClick?.(data.segmentCode); }}
            title={`Filter by ${data.segment}`}
          >
            {data.segment}
          </span>
        </div>
        {/* Type badge */}
        <div className="decant-table__cell decant-table__cell--center">
          <span className={`decant-type-badge decant-type-badge--${getTypeBadgeClass(data.type)}`}>
            {data.type}
          </span>
        </div>
        {/* Category */}
        <div
          className="decant-table__cell decant-table__cell--category decant-table__cell--category-clickable"
          onClick={(e) => { e.stopPropagation(); onCategoryClick?.(data.segmentCode, data.categoryCode); }}
          title={`Filter by ${data.category}`}
        >
          <span
            className="decant-category-dot"
            style={{
              backgroundColor: (() => {
                const m: Record<string, string> = {
                  A: '#ec4899', H: '#ec4899', C: '#ec4899',
                  T: '#3b82f6', B: '#3b82f6', X: '#3b82f6',
                  F: '#22c55e', L: '#22c55e',
                  S: '#eab308', E: '#eab308',
                };
                return m[data.segmentCode?.charAt(0).toUpperCase() ?? ''] ?? '#6b7280';
              })()
            }}
          />
          {data.category}
        </div>
        {/* Subcategory */}
        <div className="decant-table__cell decant-table__cell--secondary">
          {data.subcategoryLabel || '—'}
        </div>
        {/* Quick Phrase (was hierarchy) */}
        <div className="decant-table__cell decant-table__cell--quick-phrase" title={data.quickPhrase}>{data.quickPhrase}</div>
        {/* Tags */}
        <div className="decant-table__cell decant-table__cell--tags">
          {data.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className={`decant-tag decant-tag--${tag.color} decant-tag--clickable`}
              onClick={(e) => { e.stopPropagation(); onTagClick?.(tag.label); }}
            >
              {tag.label}
            </span>
          ))}
          {data.tags.length > 3 && (
            <span className="decant-tag decant-tag--overflow">+{data.tags.length - 3}</span>
          )}
        </div>
        {/* Date */}
        {(() => {
          const { display, full } = formatRelativeDate(data.date);
          return (
            <div className="decant-table__cell decant-table__cell--secondary" title={full}>
              {display}
            </div>
          );
        })()}
        {/* Company */}
        <div className="decant-table__cell decant-table__cell--company">
          {data.sourceDomain && (
            faviconError ? (
              <span className="decant-favicon-placeholder">
                {data.company?.charAt(0).toUpperCase() || '?'}
              </span>
            ) : (
              <img
                className="decant-company-favicon"
                src={`https://www.google.com/s2/favicons?domain=${data.sourceDomain}&sz=16`}
                alt=""
                width={16}
                height={16}
                onError={() => setFaviconError(true)}
              />
            )
          )}
          <span>{data.company}</span>
        </div>
        {/* Star */}
        <div className="decant-table__cell decant-table__cell--center">
          <button
            className={`decant-star-btn ${data.starred ? 'decant-star-btn--active' : ''} ${starPulse ? 'decant-star-btn--pulse' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(data.id);
              if (!data.starred) {
                setStarPulse(true);
                setTimeout(() => setStarPulse(false), 400);
              }
            }}
          >
            <i className={`bx ${data.starred ? 'bxs-star' : 'bx-star'}`} />
          </button>
        </div>
      </div>

      {/* Expanded Row Content - Matching Screenshot */}
      {isExpanded && (
        <div className="decant-expanded-row decant-fade-in">
          <div className="decant-expanded-row__content">
            <div className="decant-expanded-row__logo-wrapper">
              <img src={data.logo} alt={data.title} className="decant-expanded-row__logo" />
            </div>
            <div className="decant-expanded-row__details">
              <h3 className="decant-expanded-row__title">
                {data.title}
                <span className="decant-expanded-row__type-badge">{data.type}</span>
              </h3>
              <div className="decant-expanded-row__meta-grid">
                <div className="decant-expanded-row__meta-item">
                  <span className="decant-expanded-row__meta-label">Created by:</span>
                  <span className="decant-expanded-row__meta-value">{data.author || data.company}</span>
                </div>
                <div className="decant-expanded-row__meta-item">
                  <span className="decant-expanded-row__meta-label">Initial release:</span>
                  <span className="decant-expanded-row__meta-value">2013</span>
                </div>
                <div className="decant-expanded-row__meta-item">
                  <span className="decant-expanded-row__meta-label">Version:</span>
                  <span className="decant-expanded-row__meta-value">{data.version || '1.0.0'}</span>
                </div>
              </div>
              <div className="decant-expanded-row__stats">
                <span className="decant-expanded-row__stat">
                  <strong>Repository:</strong> <i className="bx bx-git-repo-forked" /> {data.stars || '210k'}
                </span>
                <span className="decant-expanded-row__stat">
                  <i className="bx bx-git-branch" /> {data.forks || '45k'}
                </span>
                <span className="decant-expanded-row__stat">
                  <strong>Used by:</strong> {data.usedBy?.join(', ') || 'Facebook, Netflix, Airbnb'}
                </span>
              </div>
              {/* Visual Intelligence Card */}
              {(data.shortDescription || data.aiSummary || data.quickPhrase || (data.keyConcepts && data.keyConcepts.length > 0)) && (
                <div className="decant-visual-card">
                  <div className="decant-visual-card__header">
                    <i className="bx bx-analyse" />
                    <span>Visual Summary</span>
                  </div>
                  <div className="decant-visual-card__body">
                    {/* Zone A: Type glyph */}
                    <div
                      className="decant-visual-card__glyph"
                      style={{
                        backgroundColor: (() => {
                          const m: Record<string, string> = {
                            A: 'rgba(236,72,153,0.1)', H: 'rgba(236,72,153,0.1)', C: 'rgba(236,72,153,0.1)',
                            T: 'rgba(59,130,246,0.1)', B: 'rgba(59,130,246,0.1)', X: 'rgba(59,130,246,0.1)',
                            F: 'rgba(34,197,94,0.1)', L: 'rgba(34,197,94,0.1)',
                            S: 'rgba(234,179,8,0.1)', E: 'rgba(234,179,8,0.1)',
                          };
                          return m[data.segmentCode?.charAt(0).toUpperCase() ?? ''] ?? 'rgba(107,114,128,0.1)';
                        })()
                      }}
                    >
                      <span className="decant-visual-card__glyph-emoji">{data.typeSymbol}</span>
                      <div className="decant-visual-card__glyph-crumb">
                        <span>{data.segment}</span>
                        <span className="decant-visual-card__glyph-sep">›</span>
                        <span>{data.category}</span>
                      </div>
                    </div>
                    {/* Zone B: Summary text + concepts */}
                    <div className="decant-visual-card__summary">
                      {(data.shortDescription || data.aiSummary || data.quickPhrase) && (
                        <p className="decant-visual-card__summary-text">
                          {(data.shortDescription || data.aiSummary || data.quickPhrase || '').slice(0, 160)}
                          {(data.shortDescription || data.aiSummary || data.quickPhrase || '').length > 160 ? '…' : ''}
                        </p>
                      )}
                      {data.keyConcepts && data.keyConcepts.length > 0 && (
                        <div className="decant-visual-card__concepts">
                          {data.keyConcepts.slice(0, 5).map((c, i) => (
                            <span key={i} className="decant-visual-card__concept">{c.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Zone C: Popularity bar */}
                  {(data.stars || data.forks || data.downloads) && (
                    <div className="decant-visual-card__popularity">
                      <div className="decant-visual-card__signal-bars">
                        {(() => {
                          const val = parseInt((data.stars || '0').replace(/[^0-9]/g, ''));
                          const bars = val >= 100000 ? 4 : val >= 10000 ? 3 : val >= 1000 ? 2 : 1;
                          return [1,2,3,4].map(b => (
                            <span key={b} className={`decant-visual-card__bar ${b <= bars ? 'decant-visual-card__bar--filled' : ''}`} />
                          ));
                        })()}
                        <span className="decant-visual-card__pop-label">Popularity</span>
                      </div>
                      <div className="decant-visual-card__metrics">
                        {data.stars && <span className="decant-visual-card__metric"><i className="bx bx-star" />{data.stars}</span>}
                        {data.forks && <span className="decant-visual-card__metric"><i className="bx bx-git-branch" />{data.forks}</span>}
                        {data.downloads && <span className="decant-visual-card__metric"><i className="bx bx-download" />{data.downloads}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="decant-expanded-row__actions">
              <button className="decant-expanded-row__btn decant-expanded-row__btn--primary">
                <i className="bx bx-folder-open" /> Open
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-edit" /> Edit
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-link" /> Link
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-share-alt" /> Share
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-book-open" /> Learn More
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================================
// DATA TABLE COMPONENT
// ============================================================================

interface DataTableProps {
  data: TableRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  statusText?: string;
  totalCount?: number;
  categoryName?: string;
  groupedData?: { label: string; catCode: string; items: TableRow[] }[] | null;
  segmentCode?: string;
  onCategoryClick?: (segCode: string, catCode: string) => void;
  onTagClick?: (tag: string) => void;
  onSegmentClick?: (segCode: string) => void;
}

type SortKey = 'title' | 'segment' | 'category' | 'subcategoryLabel' | 'quickPhrase' | 'date' | 'company';
type SortDir = 'asc' | 'desc';
type ColumnWidths = Record<string, number>;

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  checkbox: 24, expand: 28, logo: 32, title: 200,
  segment: 90, type: 70, category: 100, subcategory: 130, quickPhrase: 200,
  tags: 140, date: 90, company: 100, star: 32,
};
const RESIZABLE_COLUMNS = ['title', 'segment', 'category', 'subcategory', 'quickPhrase', 'tags', 'date', 'company'];
const COLUMN_WIDTHS_KEY = 'decant-column-widths-v2';

const DataTable: React.FC<DataTableProps> = ({
  data,
  selectedId,
  onSelect,
  onToggleStar,
  statusText,
  totalCount = 5433,
  categoryName = 'All Items',
  groupedData,
  segmentCode,
  onCategoryClick,
  onTagClick,
  onSegmentClick,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['tailwind-css']));
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(
    () => (localStorage.getItem('decant-sort-key') as SortKey | null) ?? null
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    () => (localStorage.getItem('decant-sort-dir') as SortDir) ?? 'asc'
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      return saved ? { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) } : DEFAULT_COLUMN_WIDTHS;
    } catch { return DEFAULT_COLUMN_WIDTHS; }
  });

  const handleColumnResize = useCallback((col: string, width: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [col]: Math.max(50, width) };
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[col];
    const onMove = (ev: MouseEvent) => {
      handleColumnResize(col, startWidth + (ev.clientX - startX));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [columnWidths, handleColumnResize]);

  const gridTemplate = useMemo(() => {
    const w = columnWidths;
    return `${w.checkbox}px ${w.expand}px ${w.logo}px ${w.title}px ${w.segment}px ${w.type}px ${w.category}px ${w.subcategory}px ${w.quickPhrase}px ${w.tags}px ${w.date}px ${w.company}px ${w.star}px`;
  }, [columnWidths]);

  const handleToggleExpand = useCallback((id: string) => {
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

  const handleToggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((catCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(catCode)) next.delete(catCode); else next.add(catCode);
      return next;
    });
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      const newDir = prev === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      setSortDir(newDir);
      localStorage.setItem('decant-sort-key', key);
      localStorage.setItem('decant-sort-dir', newDir);
      return key;
    });
  }, [sortDir]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = (a[sortKey] ?? '').toLowerCase();
      const bVal = (b[sortKey] ?? '').toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <i className="bx bx-sort-alt-2 decant-table__sort-icon" />;
    return <i className={`bx ${sortDir === 'asc' ? 'bx-sort-up' : 'bx-sort-down'} decant-table__sort-icon decant-table__sort-icon--active`} />;
  };

  return (
    <div className="decant-table">
      {/* Title bar with view toggles */}
      <div className="decant-table__title-bar">
        <h2 className="decant-table__title">{categoryName}</h2>
        <div className="decant-table__title-actions">
          <button className="decant-table__view-btn decant-table__view-btn--active" title="Table view">
            <i className="bx bx-table" />
          </button>
          <button className="decant-table__view-btn" title="Grid view">
            <i className="bx bx-grid-alt" />
          </button>
          <button className="decant-table__view-btn" title="Compact view">
            <i className="bx bxs-grid" />
          </button>
          <button className="decant-table__view-btn" title="List view">
            <i className="bx bx-list-ul" />
          </button>
        </div>
      </div>
      {/* Column headers */}
      <div className="decant-table__header" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="decant-table__header-cell"></div>
        <div className="decant-table__header-cell"></div>
        <div className="decant-table__header-cell">Logo</div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable" onClick={() => handleSort('title')}>
          Title <SortIcon col="title" />
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'title')} />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable" onClick={() => handleSort('segment')}>
          Segment <SortIcon col="segment" />
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'segment')} />
        </div>
        <div className="decant-table__header-cell">Type</div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable" onClick={() => handleSort('category')}>
          Category <SortIcon col="category" />
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'category')} />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable" onClick={() => handleSort('subcategoryLabel')}>
          Subcategory <SortIcon col="subcategoryLabel" />
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'subcategory')} />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable" onClick={() => handleSort('quickPhrase')}>
          Quick Phrase <SortIcon col="quickPhrase" />
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'quickPhrase')} />
        </div>
        <div className="decant-table__header-cell">
          Tags
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'tags')} />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable" onClick={() => handleSort('date')}>
          Date <SortIcon col="date" />
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'date')} />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable" onClick={() => handleSort('company')}>
          Company <SortIcon col="company" />
          <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'company')} />
        </div>
        <div className="decant-table__header-cell"></div>
      </div>
      <div className="decant-table__body">
        {groupedData ? (
          // Render with subcategory group headers
          groupedData.map((group) => {
            const GroupIcon = segmentCode
              ? getCategoryIcon(segmentCode, group.catCode)
              : null;
            return (
              <React.Fragment key={`group-${group.catCode}`}>
                <div className={`decant-table__group-header ${collapsedGroups.has(group.catCode) ? 'decant-table__group-header--collapsed' : ''}`}>
                  <button
                    className="decant-table__group-collapse-btn"
                    onClick={(e) => handleToggleGroup(group.catCode, e)}
                    title={collapsedGroups.has(group.catCode) ? 'Expand' : 'Collapse'}
                  >
                    <i className={`bx ${collapsedGroups.has(group.catCode) ? 'bx-chevron-right' : 'bx-chevron-down'}`} />
                  </button>
                  <div
                    className="decant-table__group-header__inner"
                    onClick={() => segmentCode && onCategoryClick?.(segmentCode, group.catCode)}
                    role="button"
                    tabIndex={0}
                  >
                    {GroupIcon && <GroupIcon size={14} stroke={1.5} className="decant-table__group-icon" />}
                    <span className="decant-table__group-label">{group.label}</span>
                    <span className={`decant-table__group-count ${collapsedGroups.has(group.catCode) ? 'decant-table__group-count--collapsed' : ''}`}>
                      {group.items.length}
                    </span>
                  </div>
                </div>
                {!collapsedGroups.has(group.catCode) && group.items.map((row) => (
                  <DataTableRow
                    key={row.id}
                    data={row}
                    isSelected={selectedId === row.id}
                    isExpanded={expandedIds.has(row.id)}
                    isChecked={checkedIds.has(row.id)}
                    onSelect={onSelect}
                    onToggleExpand={handleToggleExpand}
                    onToggleStar={onToggleStar}
                    onToggleCheck={handleToggleCheck}
                    gridTemplate={gridTemplate}
                    onTagClick={onTagClick}
                    onSegmentClick={onSegmentClick}
                    onCategoryClick={onCategoryClick}
                  />
                ))}
              </React.Fragment>
            );
          })
        ) : (
          // Render flat list
          sortedData.map((row) => (
            <DataTableRow
              key={row.id}
              data={row}
              isSelected={selectedId === row.id}
              isExpanded={expandedIds.has(row.id)}
              isChecked={checkedIds.has(row.id)}
              onSelect={onSelect}
              onToggleExpand={handleToggleExpand}
              onToggleStar={onToggleStar}
              onToggleCheck={handleToggleCheck}
              gridTemplate={gridTemplate}
              onTagClick={onTagClick}
              onSegmentClick={onSegmentClick}
              onCategoryClick={onCategoryClick}
            />
          ))
        )}
      </div>
      {checkedIds.size > 0 && (
        <div className="decant-bulk-bar">
          <span className="decant-bulk-bar__count">
            {checkedIds.size} {checkedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <div className="decant-bulk-bar__actions">
            <button
              className="decant-bulk-bar__btn decant-bulk-bar__btn--star"
              onClick={() => {
                checkedIds.forEach(id => onToggleStar(id));
                setCheckedIds(new Set());
              }}
            >
              <i className="bx bxs-star" /> Star All
            </button>
            <button
              className="decant-bulk-bar__btn decant-bulk-bar__btn--clear"
              onClick={() => setCheckedIds(new Set())}
            >
              <i className="bx bx-x" /> Clear
            </button>
          </div>
        </div>
      )}
      <div className="decant-table__status">
        {statusText || `Showing ${data.length} items in "${categoryName}" | ${data.length} total in category | ${totalCount.toLocaleString()} total in database`}
      </div>
    </div>
  );
};

// ============================================================================
// HYBRID DETAIL CARD MODAL COMPONENT
// ============================================================================

interface HybridDetailCardProps {
  item: TableRow | null;
  isOpen: boolean;
  onClose: () => void;
}

const HybridDetailCard: React.FC<HybridDetailCardProps> = ({ item, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('properties');
  const [isDependenciesExpanded, setIsDependenciesExpanded] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  // Backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="decant-modal-backdrop" onClick={handleBackdropClick}>
      <div className="decant-hybrid-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Section */}
        <div className="decant-hybrid-card__header">
          <button className="decant-hybrid-card__close" onClick={onClose} aria-label="Close">
            <i className="bx bx-x" />
          </button>

          <img src={item.logo} alt={item.title} className="decant-hybrid-card__logo" />
          <h2 className="decant-hybrid-card__title">{item.title}</h2>
          <span className="decant-hybrid-card__type-badge">{item.type}</span>

          <div className="decant-hybrid-card__quick-stats">
            {item.stars && <span>★ {item.stars}</span>}
            {item.forks && <span>🍴 {item.forks}</span>}
            {item.license && <span>{item.license}</span>}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="decant-hybrid-card__tabs">
          <button
            className={`decant-hybrid-card__tab ${activeTab === 'properties' ? 'decant-hybrid-card__tab--active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </button>
          <button
            className={`decant-hybrid-card__tab ${activeTab === 'related' ? 'decant-hybrid-card__tab--active' : ''}`}
            onClick={() => setActiveTab('related')}
          >
            Related Items
          </button>
          <button
            className={`decant-hybrid-card__tab ${activeTab === 'backlinks' ? 'decant-hybrid-card__tab--active' : ''}`}
            onClick={() => setActiveTab('backlinks')}
          >
            Backlinks
          </button>
        </div>

        {/* Content Section */}
        <div className="decant-hybrid-card__content">
          {activeTab === 'properties' && (
            <div className="decant-hybrid-card__properties">
              {/* General Card */}
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">General</h3>
                {item.version && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Version</span>
                    <span className="decant-hybrid-card__value">{item.version}</span>
                  </div>
                )}
                {item.license && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">License</span>
                    <span className="decant-hybrid-card__value">{item.license}</span>
                  </div>
                )}
                {item.author && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Author</span>
                    <span className="decant-hybrid-card__value">{item.author}</span>
                  </div>
                )}
                {item.repository && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Repository</span>
                    <span className="decant-hybrid-card__value decant-hybrid-card__value--link">
                      {item.repository}
                    </span>
                  </div>
                )}
              </div>

              {/* Statistics Card */}
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Statistics</h3>
                {item.stars && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Stars</span>
                    <span className="decant-hybrid-card__value">★ {item.stars}</span>
                  </div>
                )}
                {item.forks && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Forks</span>
                    <span className="decant-hybrid-card__value">🍴 {item.forks}</span>
                  </div>
                )}
                {item.downloads && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Downloads</span>
                    <span className="decant-hybrid-card__value">{item.downloads}</span>
                  </div>
                )}
                {item.lastUpdated && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Last Updated</span>
                    <span className="decant-hybrid-card__value">{item.lastUpdated}</span>
                  </div>
                )}
              </div>

              {/* Dependencies Card */}
              <div className="decant-hybrid-card__section">
                <div className="decant-hybrid-card__section-header">
                  <h3 className="decant-hybrid-card__section-title">
                    Dependencies
                    <span className="decant-hybrid-card__count-badge">2</span>
                  </h3>
                  <button
                    className="decant-hybrid-card__collapse-btn"
                    onClick={() => setIsDependenciesExpanded(!isDependenciesExpanded)}
                    aria-label={isDependenciesExpanded ? 'Collapse' : 'Expand'}
                  >
                    <i className={`bx ${isDependenciesExpanded ? 'bx-chevron-up' : 'bx-chevron-down'}`} />
                  </button>
                </div>
                {isDependenciesExpanded && (
                  <div className="decant-hybrid-card__dependencies">
                    <div className="decant-hybrid-card__dependency">loose-envify</div>
                    <div className="decant-hybrid-card__dependency">scheduler</div>
                  </div>
                )}
              </div>

              {/* Metadata Card */}
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Metadata</h3>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Brand</span>
                  <span className="decant-hybrid-card__value">{item.company}</span>
                </div>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Category</span>
                  <span className="decant-hybrid-card__value">{item.category}</span>
                </div>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Created</span>
                  <span className="decant-hybrid-card__value">{formatDate(item.date)}</span>
                </div>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Language</span>
                  <span className="decant-hybrid-card__value">JavaScript</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'related' && (
            <div className="decant-hybrid-card__tab-content">
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Related Items</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                  Items related to {item.title} based on tags and category.
                </p>
                {item.usedBy && item.usedBy.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {item.usedBy.map((company, i) => (
                      <Tag key={i} label={company} color="gray" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'backlinks' && (
            <div className="decant-hybrid-card__tab-content">
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Backlinks</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                  Items that reference {item.title}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Section */}
        <div className="decant-hybrid-card__footer">
          <button className="decant-hybrid-card__action decant-hybrid-card__action--primary">
            <i className="bx bx-folder-open" />
            Open
          </button>
          <button className="decant-hybrid-card__action">
            <i className="bx bx-edit" />
            Edit
          </button>
          <button className="decant-hybrid-card__action">
            <i className="bx bx-link" />
            Link
          </button>
          <button className="decant-hybrid-card__action">
            <i className="bx bx-share-alt" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PROPERTIES PANEL COMPONENT
// ============================================================================

interface PropertiesPanelProps {
  item: TableRow | null;
  onClose: () => void;
  isVisible: boolean;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ item, onClose, isVisible }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('properties');

  if (!item) {
    return (
      <aside className={`decant-panel decant-panel--empty${!isVisible ? ' decant-panel--hidden' : ''}`}>
        <div className="decant-panel__empty-state">
          <i className="bx bx-info-circle" />
          <p>Select an item to view its properties</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={`decant-panel${!isVisible ? ' decant-panel--hidden' : ''}`}>
      <div className="decant-panel__header">
        <button className="decant-panel__close" onClick={onClose}>
          <i className="bx bx-x" />
        </button>
        <img src={item.logo} alt={item.title} className="decant-panel__logo" />
        <h2 className="decant-panel__title">{item.title}</h2>
        <span className="decant-panel__badge">{item.type}</span>
        <div className="decant-panel__quick-stats">
          {item.stars && `★ ${item.stars}`}
          {item.forks && ` • 🍴 ${item.forks}`}
          {item.license && ` • ${item.license}`}
        </div>
      </div>

      <div className="decant-panel__tabs">
        <button
          className={`decant-panel__tab ${activeTab === 'properties' ? 'decant-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
        <button
          className={`decant-panel__tab ${activeTab === 'related' ? 'decant-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('related')}
        >
          Related
        </button>
        <button
          className={`decant-panel__tab ${activeTab === 'backlinks' ? 'decant-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('backlinks')}
        >
          Backlinks
        </button>
      </div>

      <div className="decant-panel__content">
        {activeTab === 'properties' && (
          <>
            {/* Description */}
            {(item.shortDescription || item.quickPhrase) && (
              <div className="decant-card">
                <h3 className="decant-card__title">Description</h3>
                <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--decant-text-primary)', margin: 0 }}>
                  {item.shortDescription || item.quickPhrase}
                </p>
              </div>
            )}

            {/* Source Info */}
            <div className="decant-card">
              <h3 className="decant-card__title">Source</h3>
              {item.url && (
                <div className="decant-card__row">
                  <span className="decant-card__label">URL</span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="decant-card__value decant-card__value--link"
                    style={{ fontSize: '12px', wordBreak: 'break-all' }}
                  >
                    {item.sourceDomain || item.url}
                  </a>
                </div>
              )}
              {item.company && item.company !== 'Unknown' && (
                <div className="decant-card__row">
                  <span className="decant-card__label">Company</span>
                  <span className="decant-card__value">{item.company}</span>
                </div>
              )}
              <div className="decant-card__row">
                <span className="decant-card__label">Added</span>
                <span className="decant-card__value">{formatDate(item.date)}</span>
              </div>
            </div>

            {/* Classification */}
            <div className="decant-card">
              <h3 className="decant-card__title">Classification</h3>
              <div className="decant-card__row">
                <span className="decant-card__label">Segment</span>
                <span className="decant-card__value">{item.segment}</span>
              </div>
              <div className="decant-card__row">
                <span className="decant-card__label">Category</span>
                <span className="decant-card__value">{item.category}</span>
              </div>
              <div className="decant-card__row">
                <span className="decant-card__label">Type</span>
                <span className="decant-card__value">{item.typeSymbol} {item.type}</span>
              </div>
            </div>

            {/* Key Concepts */}
            {item.keyConcepts && item.keyConcepts.length > 0 && (
              <div className="decant-card">
                <h3 className="decant-card__title">Key Concepts</h3>
                <div className="decant-panel__tags">
                  {item.keyConcepts.map((concept, i) => (
                    <Tag key={i} label={concept.replace(/_/g, ' ')} color="purple" />
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {item.tags.length > 0 && (
              <div className="decant-card">
                <h3 className="decant-card__title">Tags</h3>
                <div className="decant-panel__tags">
                  {item.tags.map((tag, i) => (
                    <Tag key={i} label={tag.label} color={tag.color} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'related' && (
          <div className="decant-card">
            <h3 className="decant-card__title">Related Items</h3>
            <p style={{ fontSize: '13px', color: 'var(--decant-text-secondary)' }}>
              Items related to {item.title} based on tags and category.
            </p>
            {item.usedBy && (
              <div style={{ marginTop: '12px' }}>
                <div className="decant-panel__tags">
                  {item.usedBy.map((company, i) => (
                    <Tag key={i} label={company} color="gray" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'backlinks' && (
          <div className="decant-card">
            <h3 className="decant-card__title">Backlinks</h3>
            <p style={{ fontSize: '13px', color: 'var(--decant-text-secondary)' }}>
              Items that reference {item.title}.
            </p>
          </div>
        )}
      </div>

      <div className="decant-panel__actions">
        <button
          className="decant-panel__action-btn decant-panel__action-btn--primary"
          onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
          disabled={!item.url}
        >
          Open
        </button>
        <button className="decant-panel__action-btn">Edit</button>
        <button className="decant-panel__action-btn">Link</button>
        <button className="decant-panel__action-btn">Share</button>
      </div>
    </aside>
  );
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function DecantDemo() {
  const { state: appState, actions: appActions } = useApp();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [panelTab, setPanelTab] = useState<PanelTab>('properties');
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>('project-phoenix');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tableData, setTableData] = useState<TableRow[]>(SAMPLE_TABLE_DATA);
  const [treeData, setTreeData] = useState<TreeNodeData[]>(SAMPLE_TREE_DATA);
  const [hierarchyView, setHierarchyView] = useState<'function' | 'organization'>('function');
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyFilter>({ type: 'all' });
  const [currentCategoryTitle, setCurrentCategoryTitle] = useState('All Items');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'All Items', id: 'all' },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshQueuedCount, setRefreshQueuedCount] = useState<number | null>(null);
  const [isReclassifying, setIsReclassifying] = useState(false);

  // Load real nodes from API
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const nodes = await nodesAPI.getAll();
        if (nodes && nodes.length > 0) {
          const mappedData: TableRow[] = nodes.map((node) => {
            const segCode = node.segment_code || node.extracted_fields?.segment || '';
            const catCode = node.category_code || node.extracted_fields?.category || '';
            const ctCode = node.content_type_code || node.extracted_fields?.contentType || 'A';
            const segLabel = SEGMENT_LABELS[segCode] || segCode || 'Uncategorized';
            const catLabel = CATEGORY_LABELS[segCode]?.[catCode] || catCode || 'General';
            const domain = (node.source_domain || '').toLowerCase();
            let typeLabel = CONTENT_TYPE_LABELS[ctCode] || 'Website';
            let typeSymbol = CONTENT_TYPE_SYMBOLS[ctCode] || '\u{1F4C4}';
            if (domain.includes('twitter.com') || domain.includes('x.com')) {
              typeLabel = 'X';
              typeSymbol = '\u{1D54F}';
            } else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
              typeLabel = 'Video';
              typeSymbol = '\u{1F3AC}';
            }
            return {
              id: node.id,
              segmentCode: segCode,
              categoryCode: catCode,
              logo: node.logo_url || 'https://via.placeholder.com/32',
              title: node.title || 'Untitled',
              type: typeLabel,
              typeSymbol: typeSymbol,
              segment: segLabel,
              category: catLabel,
              subcategoryLabel: node.subcategory_label || '',
              hierarchy: segCode && catCode ? `${segLabel} > ${catLabel}` : '',
              quickPhrase: node.phrase_description || '',
              tags: node.metadataCodes ?
                formatMetadataCodesForDisplay(
                  Object.entries(node.metadataCodes).flatMap(([type, codes]) =>
                    (codes as string[]).map(code => ({ type, code, confidence: 0.9 }))
                  )
                ).slice(0, 3).map((badge) => ({
                  label: badge.label,
                  color: badge.color as TagColor
                })) :
                (node.metadata_tags || []).slice(0, 3).map((tag: string, i: number) => {
                  // Structured tags (segment:A, category:AGT, type:S, org:COMP)
                  const prefix = tag.split(':')[0] || '';
                  const structuredColorMap: Record<string, TagColor> = {
                    'segment': getSegmentColor(segCode) as TagColor,
                    'category': 'green' as TagColor,
                    'type': 'yellow' as TagColor,
                    'org': 'pink' as TagColor,
                  };
                  if (structuredColorMap[prefix] && tag.includes(':')) {
                    return { label: tag, color: structuredColorMap[prefix] };
                  }
                  // Plain word tags: cycle through colors based on position
                  const plainColors: TagColor[] = [
                    getSegmentColor(segCode) as TagColor,
                    'green',
                    'yellow',
                    'pink',
                  ];
                  return { label: tag, color: plainColors[i % plainColors.length] };
                }),
              date: node.date_added || new Date().toISOString().split('T')[0],
              company: node.company || 'Unknown',
              starred: false,
              rowColor: 'default' as RowColor,
              // Extended panel data
              url: node.url || '',
              sourceDomain: node.source_domain || '',
              aiSummary: node.ai_summary || '',
              shortDescription: node.short_description || '',
              keyConcepts: node.key_concepts || [],
            };
          });
          setTableData(mappedData);
          console.log(`Loaded ${mappedData.length} nodes from API`);
        }
      } catch (error) {
        console.error('Failed to load nodes from API:', error);
      }
    };
    loadNodes();
  }, []);

  // Load hierarchy tree from API
  const loadTree = useCallback(async () => {
    try {
      const result = await hierarchyAPI.getTree(hierarchyView);
      if (result && result.tree) {
        // Transform API tree nodes to frontend TreeNodeData format
        const transformNode = (node: any): TreeNodeData => ({
          id: node.id,
          name: node.title,
          iconHint: node.iconHint || 'bxs-folder',
          iconColor: GUMROAD_ICON_COLORS[node.color] || '#6b7280',
          children: (node.children || []).map(transformNode),
          isExpanded: false,
        });

        const transformedTree = result.tree.map(transformNode);
        setTreeData(transformedTree);
        console.log(`Loaded ${result.tree.length} root nodes in hierarchy tree (${hierarchyView} view)`);
      }
    } catch (error) {
      console.error('Failed to load hierarchy tree from API:', error);
    }
  }, [hierarchyView]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Set up SSE client for real-time hierarchy updates
  useEffect(() => {
    const sseClient = createIntegratedSSEClient(
      (nodeId, hierarchyUpdates) => {
        console.log('Node enrichment complete:', nodeId, hierarchyUpdates);

        // Reload tree when hierarchy updates are received
        if (hierarchyUpdates) {
          console.log('Reloading hierarchy tree due to enrichment update');
          loadTree();
        }

        // Reload table data to show updated node
        loadNodes();
      },
      (event) => {
        // Show toast notification for enrichment complete
        console.log('Enrichment complete event:', event);
      }
    );

    // Cleanup on unmount
    return () => {
      sseClient.disconnect();
    };
  }, [loadTree]);

  // Global keyboard shortcut: Cmd+N / Ctrl+N opens Quick Add
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Helper function to reload nodes
  const loadNodes = async () => {
    try {
      const nodes = await nodesAPI.getAll();
      if (nodes && nodes.length > 0) {
        const mappedData: TableRow[] = nodes.map((node) => {
          const segCode = node.segment_code || node.extracted_fields?.segment || '';
          const catCode = node.category_code || node.extracted_fields?.category || '';
          const ctCode = node.content_type_code || node.extracted_fields?.contentType || 'A';
          const segLabel = SEGMENT_LABELS[segCode] || segCode || 'Uncategorized';
          const catLabel = CATEGORY_LABELS[segCode]?.[catCode] || catCode || 'General';
          const domain = (node.source_domain || '').toLowerCase();
          let typeLabel = CONTENT_TYPE_LABELS[ctCode] || 'Website';
          let typeSymbol = CONTENT_TYPE_SYMBOLS[ctCode] || '\u{1F4C4}';
          if (domain.includes('twitter.com') || domain.includes('x.com')) {
            typeLabel = 'X';
            typeSymbol = '\u{1D54F}';
          } else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
            typeLabel = 'Video';
            typeSymbol = '\u{1F3AC}';
          }
          return {
            id: node.id,
            segmentCode: segCode,
            categoryCode: catCode,
            logo: node.logo_url || 'https://via.placeholder.com/32',
            title: node.title || 'Untitled',
            type: typeLabel,
            typeSymbol: typeSymbol,
            segment: segLabel,
            category: catLabel,
            subcategoryLabel: node.subcategory_label || '',
            hierarchy: segCode && catCode ? `${segLabel} > ${catLabel}` : '',
            quickPhrase: node.phrase_description || '',
            tags: node.metadataCodes ?
              formatMetadataCodesForDisplay(
                Object.entries(node.metadataCodes).flatMap(([type, codes]) =>
                  (codes as string[]).map(code => ({ type, code, confidence: 0.9 }))
                )
              ).slice(0, 3).map((badge) => ({
                label: badge.label,
                color: badge.color as TagColor
              })) :
              (node.metadata_tags || []).slice(0, 3).map((tag: string, i: number) => {
                const prefix = tag.split(':')[0] || '';
                const structuredColorMap: Record<string, TagColor> = {
                  'segment': getSegmentColor(segCode) as TagColor,
                  'category': 'green' as TagColor,
                  'type': 'yellow' as TagColor,
                  'org': 'pink' as TagColor,
                };
                if (structuredColorMap[prefix] && tag.includes(':')) {
                  return { label: tag, color: structuredColorMap[prefix] };
                }
                const plainColors: TagColor[] = [
                  getSegmentColor(segCode) as TagColor,
                  'green',
                  'yellow',
                  'pink',
                ];
                return { label: tag, color: plainColors[i % plainColors.length] };
              }),
            date: node.date_added || new Date().toISOString().split('T')[0],
            company: node.company || 'Unknown',
            starred: false,
            rowColor: 'default' as RowColor,
            // Extended panel data
            url: node.url || '',
            sourceDomain: node.source_domain || '',
            aiSummary: node.ai_summary || '',
            shortDescription: node.short_description || '',
            keyConcepts: node.key_concepts || [],
          };
        });
        setTableData(mappedData);
        console.log(`Reloaded ${mappedData.length} nodes from API`);
      }
    } catch (error) {
      console.error('Failed to load nodes from API:', error);
    }
  };


  // Selected item for properties panel
  const selectedItem = useMemo(
    () => tableData.find((item) => item.id === selectedRowId) || null,
    [tableData, selectedRowId]
  );

  // Filter table data based on hierarchy selection then search
  const filteredTableData = useMemo(() => {
    // Step 1: Apply hierarchy filter
    let filtered = tableData;
    if (hierarchyFilter.type === 'segment' && hierarchyFilter.segmentCode) {
      filtered = tableData.filter(item => item.segmentCode === hierarchyFilter.segmentCode);
    } else if (hierarchyFilter.type === 'category' && hierarchyFilter.segmentCode && hierarchyFilter.categoryCode) {
      filtered = tableData.filter(
        item => item.segmentCode === hierarchyFilter.segmentCode && item.categoryCode === hierarchyFilter.categoryCode
      );
    }

    // Step 2: Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.company.toLowerCase().includes(query) ||
          item.quickPhrase.toLowerCase().includes(query) ||
          item.segment.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.label.toLowerCase().includes(query))
      );
    }

    // Step 3: Apply starred filter
    if (showStarredOnly) filtered = filtered.filter(item => item.starred);

    return filtered;
  }, [tableData, hierarchyFilter, searchQuery, showStarredOnly]);

  // Group items by subcategory when viewing a segment (for group headers in table)
  const groupedTableData = useMemo(() => {
    if (hierarchyFilter.type !== 'segment') return null;

    const groups = new Map<string, { label: string; catCode: string; items: TableRow[] }>();
    for (const item of filteredTableData) {
      const key = item.categoryCode || 'OTH';
      if (!groups.has(key)) {
        groups.set(key, {
          label: item.category,
          catCode: key,
          items: [],
        });
      }
      groups.get(key)!.items.push(item);
    }

    // Sort groups by item count descending
    return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
  }, [filteredTableData, hierarchyFilter]);

  // Handlers
  const handleTreeSelect = useCallback((id: string, node: TreeNodeData) => {
    setSelectedTreeId(id);

    if (id.startsWith('seg-')) {
      // Segment click: filter by segment
      const segCode = id.replace('seg-', '');
      const segLabel = SEGMENT_LABELS[segCode] || segCode;
      setHierarchyFilter({ type: 'segment', segmentCode: segCode });
      setCurrentCategoryTitle(segLabel);
      setBreadcrumbs([
        { label: 'All Items', id: 'all' },
        { label: segLabel, id },
      ]);
    } else if (id.startsWith('cat-')) {
      // Category click: filter by segment + category
      const parts = id.replace('cat-', '').split('-');
      const segCode = parts[0];
      const catCode = parts[1];
      const segLabel = SEGMENT_LABELS[segCode] || segCode;
      const catLabel = CATEGORY_LABELS[segCode]?.[catCode] || catCode;
      setHierarchyFilter({ type: 'category', segmentCode: segCode, categoryCode: catCode });
      setCurrentCategoryTitle(catLabel);
      setBreadcrumbs([
        { label: 'All Items', id: 'all' },
        { label: segLabel, id: `seg-${segCode}` },
        { label: catLabel, id },
      ]);
    } else {
      // Item or unknown click: show all
      setHierarchyFilter({ type: 'all' });
      setCurrentCategoryTitle('All Items');
      setBreadcrumbs([{ label: 'All Items', id: 'all' }]);
    }
  }, []);

  const handleRowSelect = useCallback((id: string) => {
    setSelectedRowId(id);
    setRightPanelVisible(true);
    // Open modal on double-click instead (for now just show panel)
  }, []);

  const handleToggleStar = useCallback((id: string) => {
    setTableData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, starred: !item.starred } : item
      )
    );
  }, []);

  const handleTagClick = useCallback((tagLabel: string) => {
    setSearchQuery(tagLabel);
  }, []);

  const handleSegmentBadgeClick = useCallback((segCode: string) => {
    const segLabel = SEGMENT_LABELS[segCode] || segCode;
    setSelectedTreeId(`seg-${segCode}`);
    setHierarchyFilter({ type: 'segment', segmentCode: segCode });
    setCurrentCategoryTitle(segLabel);
    setBreadcrumbs([
      { label: 'All Items', id: 'all' },
      { label: segLabel, id: `seg-${segCode}` },
    ]);
  }, []);

  const handleBreadcrumbClick = useCallback((item: BreadcrumbItem, index: number) => {
    if (item.id === 'all') {
      setHierarchyFilter({ type: 'all' });
      setCurrentCategoryTitle('All Items');
      setSelectedTreeId(null);
    } else if (item.id?.startsWith('seg-')) {
      const segCode = item.id.replace('seg-', '');
      setHierarchyFilter({ type: 'segment', segmentCode: segCode });
      setCurrentCategoryTitle(SEGMENT_LABELS[segCode] || segCode);
      setSelectedTreeId(item.id);
    } else if (item.id) {
      setSelectedTreeId(item.id);
    }
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }, []);

  const handleSettingsClick = useCallback(() => {
    appActions.openSettingsDialog();
  }, [appActions]);

  const handleUserClick = useCallback(() => {
    console.log('User menu clicked');
    // TODO: Open user menu
  }, []);

  const handleRefreshAll = useCallback(async () => {
    if (isRefreshingAll) return;
    setIsRefreshingAll(true);
    setRefreshQueuedCount(null);
    try {
      const result = await adminAPI.reEnrichAll();
      setRefreshQueuedCount(result.count);
      setTimeout(() => setRefreshQueuedCount(null), 4000);
    } catch (err) {
      console.error('Refresh all failed:', err);
    } finally {
      setIsRefreshingAll(false);
    }
  }, [isRefreshingAll]);

  const handleClosePanel = useCallback(() => {
    setRightPanelVisible(false);
    setSelectedRowId(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleReclassifyAll = useCallback(async () => {
    if (isReclassifying) return;
    setIsReclassifying(true);
    try {
      const result = await reclassifyAPI.reclassifyAll();
      console.log('Reclassification complete:', result.message, result.segmentDistribution);
      await loadNodes();
      await loadTree();
    } catch (error) {
      console.error('Reclassification failed:', error);
    } finally {
      setIsReclassifying(false);
    }
  }, [isReclassifying, loadTree]);

  return (
    <div className="decant-app">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        breadcrumbs={breadcrumbs}
        onBreadcrumbClick={handleBreadcrumbClick}
        onClearFilter={() => {
          setHierarchyFilter({ type: 'all' });
          setCurrentCategoryTitle('All Items');
          setBreadcrumbs([{ label: 'All Items', id: 'all' }]);
          setSelectedTreeId(null);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onBatchImportClick={() => setIsBatchImportOpen(true)}
        onQuickAddClick={() => setIsQuickAddOpen(true)}
        onRefreshAllClick={handleRefreshAll}
        onReclassifyClick={handleReclassifyAll}
        isReclassifying={isReclassifying}
        onSettingsClick={handleSettingsClick}
        onUserClick={handleUserClick}
        showStarredOnly={showStarredOnly}
        onToggleStarredFilter={() => setShowStarredOnly(prev => !prev)}
      />

      <TitleBar
        title={currentCategoryTitle}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeTab={panelTab}
        onTabChange={setPanelTab}
      />

      <div className="decant-app__body">
        <Sidebar
          data={treeData}
          selectedId={selectedTreeId}
          onSelect={handleTreeSelect}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          totalCount={tableData.length}
        />

        <main className="decant-main">
          <DataTable
            data={filteredTableData}
            selectedId={selectedRowId}
            onSelect={handleRowSelect}
            onToggleStar={handleToggleStar}
            categoryName={currentCategoryTitle}
            totalCount={tableData.length}
            groupedData={groupedTableData}
            segmentCode={hierarchyFilter.segmentCode}
            onTagClick={handleTagClick}
            onSegmentClick={handleSegmentBadgeClick}
            onCategoryClick={(segCode, catCode) => {
              const catLabel = CATEGORY_LABELS[segCode]?.[catCode] || catCode;
              const segLabel = SEGMENT_LABELS[segCode] || segCode;
              setHierarchyFilter({ type: 'category', segmentCode: segCode, categoryCode: catCode });
              setCurrentCategoryTitle(catLabel);
              setSelectedTreeId(`cat-${segCode}-${catCode}`);
              setBreadcrumbs([
                { label: 'All Items', id: 'all' },
                { label: segLabel, id: `seg-${segCode}` },
                { label: catLabel, id: `cat-${segCode}-${catCode}` },
              ]);
            }}
          />
        </main>

        <PropertiesPanel
          item={selectedItem}
          onClose={handleClosePanel}
          isVisible={rightPanelVisible}
        />
      </div>

      {/* Hybrid Detail Card Modal */}
      <HybridDetailCard
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onImported={(nodeId) => {
          console.log('Quick Add imported node:', nodeId);
          loadNodes();
          loadTree();
        }}
        onSwitchToBatch={() => {
          setIsQuickAddOpen(false);
          setIsBatchImportOpen(true);
        }}
      />

      {/* Batch Import Modal */}
      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
      />

      <SettingsDialog isOpen={appState.settingsDialogOpen} onClose={appActions.closeSettingsDialog} />
    </div>
  );
}
