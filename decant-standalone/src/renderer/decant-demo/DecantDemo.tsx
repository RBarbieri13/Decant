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
// API imports for backend integration
import { nodesAPI, hierarchyAPI } from '../services/api';
// Real-time service for hierarchy updates
import { createIntegratedSSEClient } from '../services/realtimeService';
// Metadata code colors utility
import { getMetadataCodeColor, getSegmentColor, formatMetadataCodesForDisplay } from '../utils/metadataCodeColors';

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

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'table' | 'grid' | 'tree' | 'list';
type TagColor = 'blue' | 'yellow' | 'pink' | 'green' | 'purple' | 'gray' | 'orange' | 'teal';
type PanelTab = 'properties' | 'related' | 'backlinks';

// Icon types matching the mockup exactly
type TreeIconType =
  | 'folder'        // Brown folder icon
  | 'document'      // Blue document icon
  | 'link'          // Green link/chain icon
  | 'ui'            // Purple UI/interface icon
  | 'book'          // Green book/docs icon
  | 'component'     // Pink/magenta puzzle piece
  | 'button'        // Pink button icon
  | 'form'          // Pink form icon
  | 'modal'         // Pink modal icon
  | 'layout'        // Brown layout folder
  | 'style'         // Pink paint palette
  | 'image'         // Pink image icon
  | 'backend'       // Brown backend folder
  | 'test'          // Green flask/beaker
  | 'settings'      // Gray gear icon
  | 'guidelines'    // Blue guidelines doc
  | 'brand'         // Pink brand assets
  | 'tools'         // Green external tools
  | 'person'        // Orange person icon
  | 'notes'         // Green meeting notes
  | 'default';      // Default gray icon

interface BreadcrumbItem {
  label: string;
  id?: string;
}

interface TreeNodeData {
  id: string;
  name: string;
  iconType: TreeIconType;
  children?: TreeNodeData[];
  isExpanded?: boolean;
}

type RowColor = 'pink' | 'yellow' | 'blue' | 'green' | 'red' | 'cream' | 'default';

interface TableRow {
  id: string;
  logo: string;
  title: string;
  type: string;
  typeSymbol: string;
  segment: string;
  category: string;
  hierarchy: string;
  quickPhrase: string;
  tags: { label: string; color: TagColor }[];
  date: string;
  company: string;
  starred: boolean;
  rowColor?: RowColor;
  checked?: boolean;
  // Extended data for panel
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

// ============================================================================
// TOP BAR COMPONENT
// ============================================================================

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  breadcrumbs: BreadcrumbItem[];
  onBreadcrumbClick?: (item: BreadcrumbItem, index: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onBatchImportClick?: () => void;
  onQuickAddClick?: () => void;
  onSettingsClick?: () => void;
  onUserClick?: () => void;
  userName?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  // breadcrumbs available for future use
  // onBreadcrumbClick available for future use
  // viewMode available for future use - moved to title bar
  // onViewModeChange available for future use - moved to title bar
  onBatchImportClick,
  onQuickAddClick,
  onSettingsClick,
  onUserClick,
  // userName available for future use
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
      </div>

      {/* Spacer */}
      <div className="decant-topbar__spacer" />

      {/* Right side icons */}
      <div className="decant-topbar__actions">
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
          style={{ marginLeft: '8px', marginRight: '12px' }}
        >
          Batch
        </button>

        <button className="decant-topbar__icon-btn" title="Notifications">
          <i className="bx bx-bell" />
        </button>

        <button className="decant-topbar__icon-btn" title="Messages">
          <i className="bx bx-message-square-detail" />
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

// Icon configuration matching the mockup colors exactly
const ICON_CONFIG: Record<TreeIconType, { icon: string; color: string }> = {
  folder: { icon: 'bxs-folder', color: '#a67c52' },           // Brown folder
  document: { icon: 'bxs-file', color: '#3b82f6' },           // Blue document
  link: { icon: 'bx-link', color: '#22c55e' },                // Green link
  ui: { icon: 'bx-layout', color: '#8b5cf6' },                // Purple UI
  book: { icon: 'bxs-book', color: '#22c55e' },               // Green book
  component: { icon: 'bx-extension', color: '#ec4899' },      // Pink puzzle
  button: { icon: 'bx-extension', color: '#ec4899' },         // Pink
  form: { icon: 'bx-extension', color: '#ec4899' },           // Pink
  modal: { icon: 'bx-extension', color: '#ec4899' },          // Pink
  layout: { icon: 'bxs-folder', color: '#a67c52' },           // Brown folder
  style: { icon: 'bxs-palette', color: '#ec4899' },           // Pink palette
  image: { icon: 'bxs-image', color: '#ec4899' },             // Pink image
  backend: { icon: 'bxs-folder', color: '#a67c52' },          // Brown folder
  test: { icon: 'bxs-flask', color: '#22c55e' },              // Green flask
  settings: { icon: 'bx-cog', color: '#6b7280' },             // Gray gear
  guidelines: { icon: 'bxs-file', color: '#3b82f6' },         // Blue document
  brand: { icon: 'bxs-image', color: '#ec4899' },             // Pink image
  tools: { icon: 'bx-link', color: '#22c55e' },               // Green link
  person: { icon: 'bxs-user', color: '#f97316' },             // Orange person
  notes: { icon: 'bxs-note', color: '#22c55e' },              // Green notes
  default: { icon: 'bx-file', color: '#6b7280' },             // Gray default
};

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

  const iconConfig = ICON_CONFIG[node.iconType] || ICON_CONFIG.default;

  return (
    <div className="decant-tree-node">
      <div
        className={`decant-tree-node__row ${isSelected ? 'decant-tree-node__row--selected' : ''}`}
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
            <i className={`bx ${isExpanded ? 'bx-chevron-down' : 'bx-chevron-right'}`} />
          </button>
        ) : (
          <span className="decant-tree-node__toggle-spacer" />
        )}
        <i
          className={`bx ${iconConfig.icon} decant-tree-node__icon`}
          style={{ color: iconConfig.color }}
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
}

const Sidebar: React.FC<SidebarProps> = ({
  data,
  selectedId,
  onSelect,
  isCollapsed,
  onToggleCollapse,
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
}) => {
  const rowColorClass = data.rowColor ? `decant-table__row--${data.rowColor}` : '';

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
        <div className="decant-table__cell decant-table__cell--title">{data.title}</div>
        {/* Type symbol */}
        <div className="decant-table__cell decant-table__cell--center">
          <span className="decant-type-symbol">{data.typeSymbol}</span>
        </div>
        {/* Segment with badge */}
        <div className="decant-table__cell">
          <span className={`decant-segment-badge ${getSegmentClass(data.segment)}`}>
            {data.segment}
          </span>
        </div>
        {/* Category */}
        <div className="decant-table__cell">{data.category}</div>
        {/* Quick Phrase (was hierarchy) */}
        <div className="decant-table__cell decant-table__cell--secondary">{data.quickPhrase}</div>
        {/* Tags */}
        <div className="decant-table__cell decant-table__cell--tags">
          {data.tags.slice(0, 3).map((tag, i) => (
            <Tag key={i} label={tag.label} color={tag.color} />
          ))}
        </div>
        {/* Date */}
        <div className="decant-table__cell decant-table__cell--secondary">{data.date}</div>
        {/* Company */}
        <div className="decant-table__cell">{data.company}</div>
        {/* Star */}
        <div className="decant-table__cell decant-table__cell--center">
          <button
            className={`decant-star-btn ${data.starred ? 'decant-star-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(data.id);
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
}

const DataTable: React.FC<DataTableProps> = ({
  data,
  selectedId,
  onSelect,
  onToggleStar,
  statusText,
  totalCount = 5433,
  categoryName = 'Phoenix > Frontend',
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['tailwind-css']));
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

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

  return (
    <div className="decant-table">
      {/* Title bar with view toggles */}
      <div className="decant-table__title-bar">
        <h2 className="decant-table__title">Frontend</h2>
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
      <div className="decant-table__header">
        <div className="decant-table__header-cell"></div>
        <div className="decant-table__header-cell"></div>
        <div className="decant-table__header-cell">Logo</div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable">
          Title <i className="bx bx-sort-alt-2 decant-table__sort-icon" />
        </div>
        <div className="decant-table__header-cell"></div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable">
          Segment <i className="bx bx-sort-alt-2 decant-table__sort-icon" />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable">
          Category <i className="bx bx-sort-alt-2 decant-table__sort-icon" />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable">
          Quick Phrase <i className="bx bx-sort-alt-2 decant-table__sort-icon" />
        </div>
        <div className="decant-table__header-cell">Tags</div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable">
          Date <i className="bx bx-sort-alt-2 decant-table__sort-icon" />
        </div>
        <div className="decant-table__header-cell decant-table__header-cell--sortable">
          Company <i className="bx bx-sort-alt-2 decant-table__sort-icon" />
        </div>
        <div className="decant-table__header-cell"></div>
      </div>
      <div className="decant-table__body">
        {data.map((row) => (
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
          />
        ))}
      </div>
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
                  <span className="decant-hybrid-card__value">{item.date}</span>
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
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ item, onClose }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('properties');

  if (!item) {
    return (
      <aside className="decant-panel decant-panel--empty">
        <div className="decant-panel__empty-state">
          <i className="bx bx-info-circle" />
          <p>Select an item to view its properties</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="decant-panel">
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
            <div className="decant-card">
              <h3 className="decant-card__title">General</h3>
              {item.version && (
                <div className="decant-card__row">
                  <span className="decant-card__label">Version</span>
                  <span className="decant-card__value">{item.version}</span>
                </div>
              )}
              {item.license && (
                <div className="decant-card__row">
                  <span className="decant-card__label">License</span>
                  <span className="decant-card__value">{item.license}</span>
                </div>
              )}
              {item.author && (
                <div className="decant-card__row">
                  <span className="decant-card__label">Author</span>
                  <span className="decant-card__value">{item.author}</span>
                </div>
              )}
              {item.repository && (
                <div className="decant-card__row">
                  <span className="decant-card__label">Repository</span>
                  <span className="decant-card__value decant-card__value--link">{item.repository}</span>
                </div>
              )}
            </div>

            <div className="decant-card">
              <h3 className="decant-card__title">Statistics</h3>
              {item.stars && (
                <div className="decant-card__row">
                  <span className="decant-card__label">Stars</span>
                  <span className="decant-card__value">★ {item.stars}</span>
                </div>
              )}
              {item.forks && (
                <div className="decant-card__row">
                  <span className="decant-card__label">Forks</span>
                  <span className="decant-card__value">🍴 {item.forks}</span>
                </div>
              )}
              {item.downloads && (
                <div className="decant-card__row">
                  <span className="decant-card__label">Downloads</span>
                  <span className="decant-card__value">{item.downloads}</span>
                </div>
              )}
            </div>

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
                <span className="decant-card__value">{item.type}</span>
              </div>
            </div>

            <div className="decant-panel__tags">
              {item.tags.map((tag, i) => (
                <Tag key={i} label={tag.label} color={tag.color} />
              ))}
            </div>
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
        <button className="decant-panel__action-btn decant-panel__action-btn--primary">Open</button>
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
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [panelTab, setPanelTab] = useState<PanelTab>('properties');
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>('project-phoenix');
  const [selectedRowId, setSelectedRowId] = useState<string | null>('tailwind-css');
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tableData, setTableData] = useState<TableRow[]>(SAMPLE_TABLE_DATA);
  const [treeData, setTreeData] = useState<TreeNodeData[]>(SAMPLE_TREE_DATA);
  const [hierarchyView, setHierarchyView] = useState<'function' | 'organization'>('function');
  const [currentCategoryTitle] = useState('Frontend'); // Current category title for title bar
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'Workspace', id: 'workspace' },
    { label: 'Development', id: 'development' },
    { label: 'Tools', id: 'tools' },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

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
            return {
              id: node.id,
              logo: node.logo_url || 'https://via.placeholder.com/32',
              title: node.title || 'Untitled',
              type: 'Document',
              typeSymbol: CONTENT_TYPE_SYMBOLS[ctCode] || '\u{1F4C4}',
              segment: segLabel,
              category: catLabel,
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
                (node.metadata_tags || []).slice(0, 3).map((tag: string) => ({
                  label: tag,
                  color: (getSegmentColor(segCode) || 'blue') as TagColor
                })),
              date: node.date_added || new Date().toISOString().split('T')[0],
              company: node.company || 'Unknown',
              starred: false,
              rowColor: 'default' as RowColor,
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
          iconType: getIconTypeForNode(node),
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
          return {
            id: node.id,
            logo: node.logo_url || 'https://via.placeholder.com/32',
            title: node.title || 'Untitled',
            type: 'Document',
            typeSymbol: CONTENT_TYPE_SYMBOLS[ctCode] || '\u{1F4C4}',
            segment: segLabel,
            category: catLabel,
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
              (node.metadata_tags || []).slice(0, 3).map((tag: string) => ({
                label: tag,
                color: (getSegmentColor(segCode) || 'blue') as TagColor
              })),
            date: node.date_added || new Date().toISOString().split('T')[0],
            company: node.company || 'Unknown',
            starred: false,
            rowColor: 'default' as RowColor,
          };
        });
        setTableData(mappedData);
        console.log(`Reloaded ${mappedData.length} nodes from API`);
      }
    } catch (error) {
      console.error('Failed to load nodes from API:', error);
    }
  };

  // Helper function to determine icon type based on node properties
  const getIconTypeForNode = (node: any): TreeIconType => {
    // Map based on node type or segment
    if (node.nodeType === 'segment') return 'folder';
    if (node.nodeType === 'category') return 'folder';
    if (node.nodeType === 'content_type') return 'folder';
    if (node.nodeType === 'organization') return 'person';

    // For items, use content type or segment to determine icon
    const contentType = node.contentTypeCode;
    if (contentType === 'T') return 'link';      // Tool/Website
    if (contentType === 'A') return 'document';  // Article
    if (contentType === 'V') return 'link';      // Video
    if (contentType === 'G') return 'backend';   // Repository
    if (contentType === 'C') return 'book';      // Course

    return 'document'; // Default
  };

  // Selected item for properties panel
  const selectedItem = useMemo(
    () => tableData.find((item) => item.id === selectedRowId) || null,
    [tableData, selectedRowId]
  );

  // Filter table data based on search
  const filteredTableData = useMemo(() => {
    if (!searchQuery) return tableData;
    const query = searchQuery.toLowerCase();
    return tableData.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.company.toLowerCase().includes(query) ||
        item.quickPhrase.toLowerCase().includes(query) ||
        item.segment.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.label.toLowerCase().includes(query))
    );
  }, [tableData, searchQuery]);

  // Handlers
  const handleTreeSelect = useCallback((id: string, node: TreeNodeData) => {
    setSelectedTreeId(id);
    // Update breadcrumbs based on selection
    const newBreadcrumbs: BreadcrumbItem[] = [{ label: 'Decant Core', id: 'decant-core' }];

    // Add selected node to breadcrumbs
    newBreadcrumbs.push({ label: node.name, id: node.id });

    setBreadcrumbs(newBreadcrumbs);
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

  const handleBreadcrumbClick = useCallback((item: BreadcrumbItem, index: number) => {
    if (item.id) {
      setSelectedTreeId(item.id);
    }
    // Truncate breadcrumbs to clicked index
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }, []);

  const handleSettingsClick = useCallback(() => {
    console.log('Settings clicked');
    // TODO: Open settings dialog
  }, []);

  const handleUserClick = useCallback(() => {
    console.log('User menu clicked');
    // TODO: Open user menu
  }, []);

  const handleClosePanel = useCallback(() => {
    setRightPanelVisible(false);
    setSelectedRowId(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <div className="decant-app">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        breadcrumbs={breadcrumbs}
        onBreadcrumbClick={handleBreadcrumbClick}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onBatchImportClick={() => setIsBatchImportOpen(true)}
        onQuickAddClick={() => setIsQuickAddOpen(true)}
        onSettingsClick={handleSettingsClick}
        onUserClick={handleUserClick}
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
        />

        <main className="decant-main">
          <DataTable
            data={filteredTableData}
            selectedId={selectedRowId}
            onSelect={handleRowSelect}
            onToggleStar={handleToggleStar}
            categoryName="Phoenix > Frontend"
            totalCount={5432}
          />
        </main>

        {rightPanelVisible && (
          <PropertiesPanel item={selectedItem} onClose={handleClosePanel} />
        )}
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
    </div>
  );
}
