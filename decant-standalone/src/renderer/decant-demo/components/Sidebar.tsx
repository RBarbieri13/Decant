import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { TreeNodeData, SidebarCollection } from '../types';
import { SEGMENT_HEX_MAP } from '../helpers';
import { COLLECTION_ICON_PRESETS } from '../../hooks/useCollections';
import {
  IconChevronDown, IconChevronRight, IconSearch,
  IconPlus, IconFileText, IconSettings, IconBuildingSkyscraper,
  IconDotsVertical, IconPencil, IconPalette, IconTrash, IconCheck, IconX,
} from '@tabler/icons-react';

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

const LS_SECTIONS = 'decant-sidebar-sections-v1';
const LS_EXPANDED = 'decant-sidebar-expanded-v1';

type SectionId = 'workspace' | 'hierarchy' | 'collections' | 'tags';

const DEFAULT_SECTIONS: Record<SectionId, boolean> = {
  workspace: true, hierarchy: true, collections: true, tags: true,
};

function readSections(): Record<SectionId, boolean> {
  try {
    const raw = localStorage.getItem(LS_SECTIONS);
    if (!raw) return DEFAULT_SECTIONS;
    return { ...DEFAULT_SECTIONS, ...JSON.parse(raw) };
  } catch { return DEFAULT_SECTIONS; }
}

function writeSections(sections: Record<SectionId, boolean>) {
  try { localStorage.setItem(LS_SECTIONS, JSON.stringify(sections)); } catch {}
}

function readExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_EXPANDED);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
}

function writeExpanded(ids: Set<string>) {
  try { localStorage.setItem(LS_EXPANDED, JSON.stringify([...ids])); } catch {}
}

// ============================================================================
// LETTER BADGE — colored tile with a single uppercase letter
// Mirrors the Stitch design where every row is anchored by a vivid letter chip.
// ============================================================================

interface LetterBadgeProps {
  letter: string;
  color: string;
  size?: number;
  variant?: 'filled' | 'soft';
}

const LetterBadge: React.FC<LetterBadgeProps> = ({ letter, color, size = 20, variant = 'filled' }) => {
  const isSoft = variant === 'soft';
  return (
    <span
      className="decant-sb-badge"
      style={{
        width: size,
        height: size,
        backgroundColor: isSoft ? color + '28' : color,
        color: isSoft ? color : '#ffffff',
        fontSize: size <= 18 ? 10 : 11,
      }}
    >
      {letter}
    </span>
  );
};

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  label: string;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
  rightAction?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ label, count, isOpen, onToggle, rightAction }) => (
  <div className="decant-sb-section__header" onClick={onToggle} role="button" tabIndex={0}>
    {isOpen ? <IconChevronDown size={16} stroke={2.75} /> : <IconChevronRight size={16} stroke={2.75} />}
    <span className="decant-sb-section__label">{label}</span>
    {count != null && <span className="decant-sb-section__count">{count}</span>}
    {rightAction && <span className="decant-sb-section__action">{rightAction}</span>}
  </div>
);

// ============================================================================
// FLAT ROW — used for workspace items, collections, and as the common row shape
// ============================================================================

interface FlatRowProps {
  leading: React.ReactNode;
  label: string;
  count?: number;
  isSelected: boolean;
  onClick: () => void;
}

const FlatRow: React.FC<FlatRowProps> = ({ leading, label, count, isSelected, onClick }) => (
  <div
    className={`decant-sb-row ${isSelected ? 'decant-sb-row--selected' : ''}`}
    onClick={onClick}
    role="button"
    tabIndex={0}
  >
    <span className="decant-sb-row__leading">{leading}</span>
    <span className="decant-sb-row__label">{label}</span>
    {count != null && count > 0 && <span className="decant-sb-row__count">{count}</span>}
  </div>
);

// ============================================================================
// TREE NODE — hierarchy row with letter badge, indent, chevron, count
// ============================================================================

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  selectedId: string | null;
  multiSelected: Set<string>;
  expandedIds: Set<string>;
  onSelect: (id: string, node: TreeNodeData, shiftKey: boolean) => void;
  onToggle: (id: string) => void;
  itemCounts?: Map<string, number>;
  onDropItem?: (itemId: string, targetNodeId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = React.memo(({
  node, level, selectedId, multiSelected, expandedIds,
  onSelect, onToggle, itemCounts, onDropItem,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const hasChildren = !!node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isMultiSelected = multiSelected.has(node.id);

  const letter = (node.id.charAt(0) || 'A').toUpperCase();
  const color = node.iconColor || SEGMENT_HEX_MAP[letter] || '#64748b';
  const count = itemCounts?.get(node.id);
  const isTopLevel = level === 0;

  return (
    <div className="decant-sb-tree-node">
      <div
        className={`decant-sb-tree-row
          ${isTopLevel ? 'decant-sb-tree-row--parent' : 'decant-sb-tree-row--child'}
          ${isSelected ? 'decant-sb-tree-row--selected' : ''}
          ${isMultiSelected ? 'decant-sb-tree-row--multi' : ''}
          ${isDragOver ? 'decant-sb-tree-row--drop-target' : ''}`}
        style={{ paddingLeft: level === 0 ? 8 : 8 + level * 20 }}
        onClick={(e) => onSelect(node.id, node, e.shiftKey)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          try {
            const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (payload.id) onDropItem?.(payload.id, node.id);
          } catch {}
        }}
      >
        {hasChildren ? (
          <button
            className="decant-sb-tree-row__chevron"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <IconChevronDown size={16} stroke={2.5} /> : <IconChevronRight size={16} stroke={2.5} />}
          </button>
        ) : (
          <span className="decant-sb-tree-row__chevron-spacer" />
        )}

        <LetterBadge
          letter={letter}
          color={color}
          size={22}
          variant={isTopLevel ? 'filled' : 'soft'}
        />

        <span className={`decant-sb-tree-row__label ${isTopLevel ? 'decant-sb-tree-row__label--strong' : ''}`}>
          {node.name}
        </span>

        {count != null && count > 0 && (
          <span className="decant-sb-tree-row__count">{count}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="decant-sb-tree-node__children">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              multiSelected={multiSelected}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              itemCounts={itemCounts}
              onDropItem={onDropItem}
            />
          ))}
        </div>
      )}
    </div>
  );
});
TreeNode.displayName = 'TreeNode';

// ============================================================================
// COLLECTION EDITOR FORM — inline create/edit form (name + icon + color)
// ============================================================================

interface CollectionEditorFormProps {
  initialName?: string;
  initialIcon?: string;
  initialColor?: string;
  submitLabel?: string;
  onSubmit: (name: string, icon: string, color: string) => void;
  onCancel: () => void;
}

const CollectionEditorForm: React.FC<CollectionEditorFormProps> = ({
  initialName = '',
  initialIcon = COLLECTION_ICON_PRESETS[0].icon,
  initialColor = COLLECTION_ICON_PRESETS[0].color,
  submitLabel = 'Create',
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSubmit = name.trim().length > 0;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      onSubmit(name.trim(), icon, color);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="decant-sb-collection-form" onKeyDown={handleKey}>
      <input
        ref={nameRef}
        className="decant-sb-collection-form__name"
        type="text"
        placeholder="Collection name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="decant-sb-collection-form__section-label">Choose an icon</div>
      <div className="decant-sb-collection-form__icon-grid">
        {COLLECTION_ICON_PRESETS.map((preset) => {
          const isActive = preset.icon === icon;
          return (
            <button
              key={preset.label}
              type="button"
              title={preset.label}
              className={`decant-sb-collection-form__icon-btn ${isActive ? 'decant-sb-collection-form__icon-btn--active' : ''}`}
              style={!isActive ? { background: preset.color + '18' } : undefined}
              onClick={() => {
                setIcon(preset.icon);
                setColor(preset.color);
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{preset.icon}</span>
            </button>
          );
        })}
      </div>

      <div className="decant-sb-collection-form__actions">
        <button
          type="button"
          className="decant-sb-collection-form__btn decant-sb-collection-form__btn--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="decant-sb-collection-form__btn decant-sb-collection-form__btn--primary"
          disabled={!canSubmit}
          onClick={() => onSubmit(name.trim(), icon, color)}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// COLLECTION ROW MENU — hover-revealed actions (edit / icon / delete)
// ============================================================================

interface CollectionRowMenuProps {
  onEdit: () => void;
  onChangeIcon: () => void;
  onDelete: () => void;
}

const CollectionRowMenu: React.FC<CollectionRowMenuProps> = ({ onEdit, onChangeIcon, onDelete }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  return (
    <div className="decant-sb-row-menu" ref={menuRef}>
      <button
        type="button"
        className="decant-sb-row__menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Collection actions"
      >
        <IconDotsVertical size={15} stroke={2} />
      </button>
      {open && (
        <div className="decant-sb-row-menu__popup" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="decant-sb-row-menu__item"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <IconPencil size={14} stroke={2} /> Rename
          </button>
          <button
            type="button"
            className="decant-sb-row-menu__item"
            onClick={() => { setOpen(false); onChangeIcon(); }}
          >
            <IconPalette size={14} stroke={2} /> Change icon
          </button>
          <button
            type="button"
            className="decant-sb-row-menu__item decant-sb-row-menu__item--danger"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            <IconTrash size={14} stroke={2} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// INLINE RENAME — used when a collection row is in rename mode
// ============================================================================

interface InlineRenameProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

const InlineRename: React.FC<InlineRenameProps> = ({ initialValue, onSave, onCancel }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="decant-sb-inline-rename" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="decant-sb-inline-rename__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (value.trim().length > 0) onSave(value.trim());
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <button
        className="decant-sb-inline-rename__btn decant-sb-inline-rename__btn--confirm"
        onClick={(e) => { e.stopPropagation(); if (value.trim()) onSave(value.trim()); }}
        aria-label="Save"
      >
        <IconCheck size={13} stroke={2.5} />
      </button>
      <button
        className="decant-sb-inline-rename__btn"
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        aria-label="Cancel"
      >
        <IconX size={13} stroke={2.5} />
      </button>
    </div>
  );
};

// ============================================================================
// TAG CHIP — pill with colored dot + label + count
// ============================================================================

interface TagChipProps {
  label: string;
  color: string;
  count?: number;
  isSelected: boolean;
  onClick: () => void;
}

const TagChip: React.FC<TagChipProps> = ({ label, color, count, isSelected, onClick }) => (
  <button
    className={`decant-sb-tag ${isSelected ? 'decant-sb-tag--selected' : ''}`}
    onClick={onClick}
    type="button"
  >
    <span className="decant-sb-tag__dot" style={{ backgroundColor: color }} />
    <span className="decant-sb-tag__label">{label}</span>
    {count != null && count > 0 && <span className="decant-sb-tag__count">{count}</span>}
  </button>
);

// ============================================================================
// SIDEBAR — Stitch "Resource Library" style, preserving original prop API
// ============================================================================

export interface SidebarProps {
  // Hierarchy tree
  data: TreeNodeData[];
  selectedId: string | null;
  onSelect: (id: string, node: TreeNodeData) => void;
  itemCounts?: Map<string, number>;
  onDropItem?: (itemId: string, targetNodeId: string) => void;

  // Layout
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  totalCount: number;
  width: number;
  onResizeStart: () => void;

  // Workspace
  starredCount?: number;
  recentCount?: number;
  uncategorizedCount?: number;
  workspaceSelection?: 'all' | 'starred' | 'recent' | 'uncategorized' | null;
  onSelectWorkspace?: (workspace: 'all' | 'starred' | 'recent' | 'uncategorized') => void;

  // Multi-select
  multiSelectedSegments?: Set<string>;
  onMultiSelectSegment?: (segmentCode: string) => void;
  onClearMultiSelect?: () => void;

  // Collections
  collections?: SidebarCollection[];
  selectedCollectionId?: string | null;
  onSelectCollection?: (collectionId: string) => void;
  onCreateCollection?: (name: string, icon: string, color: string) => Promise<void> | void;
  onRenameCollection?: (id: string, name: string) => Promise<void> | void;
  onUpdateCollectionIcon?: (id: string, icon: string, color: string) => Promise<void> | void;
  onDeleteCollection?: (id: string) => Promise<boolean> | Promise<void> | void;

  // Tags
  userTags?: Array<{ id: string; name: string; color: string; count?: number }>;
  selectedTagId?: string | null;
  onSelectTag?: (tagId: string) => void;

  // Optional hooks to render footer CTAs without altering DecantDemo wiring.
  onAddResourceClick?: () => void;
  onOpenDocsClick?: () => void;
  onOpenSettingsClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  data, selectedId, onSelect, itemCounts, onDropItem,
  isCollapsed, onToggleCollapse, totalCount, width, onResizeStart,
  starredCount = 0, recentCount = 0, uncategorizedCount = 0,
  workspaceSelection = 'all', onSelectWorkspace,
  multiSelectedSegments, onMultiSelectSegment, onClearMultiSelect,
  collections = [], selectedCollectionId, onSelectCollection,
  onCreateCollection, onRenameCollection, onUpdateCollectionIcon, onDeleteCollection,
  userTags = [], selectedTagId, onSelectTag,
  onAddResourceClick, onOpenDocsClick, onOpenSettingsClick,
}) => {
  const [sections, setSections] = useState<Record<SectionId, boolean>>(readSections);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const saved = readExpanded();
    if (saved.size > 0) return saved;
    const ids = new Set<string>();
    for (const node of data) ids.add(node.id);
    return ids;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [iconEditingCollectionId, setIconEditingCollectionId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { writeSections(sections); }, [sections]);
  useEffect(() => { writeExpanded(expandedIds); }, [expandedIds]);

  const toggleSection = useCallback((id: SectionId) => {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleTreeNodeSelect = useCallback((id: string, node: TreeNodeData, shiftKey: boolean) => {
    const isSegment = id.startsWith('seg-');
    if (shiftKey && isSegment && onMultiSelectSegment) {
      onMultiSelectSegment(id.replace('seg-', ''));
      return;
    }
    onSelect(id, node);
  }, [onSelect, onMultiSelectSegment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape' && document.activeElement === searchRef.current) {
          setSearchQuery('');
          (e.target as HTMLInputElement).blur();
        }
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filterTree = useCallback((nodes: TreeNodeData[], query: string): TreeNodeData[] => {
    if (!query) return nodes;
    const q = query.toLowerCase();
    return nodes.reduce<TreeNodeData[]>((acc, node) => {
      const matchesSearch = node.name.toLowerCase().includes(q);
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

  const multiSelectedNodeIds = useMemo(() => {
    if (!multiSelectedSegments || multiSelectedSegments.size === 0) return new Set<string>();
    const ids = new Set<string>();
    for (const code of multiSelectedSegments) ids.add(`seg-${code}`);
    return ids;
  }, [multiSelectedSegments]);

  const hasMultiSelect = multiSelectedSegments && multiSelectedSegments.size > 0;

  return (
    <aside
      className={`decant-sidebar decant-sidebar--stitch ${isCollapsed ? 'decant-sidebar--collapsed' : ''}`}
      style={!isCollapsed ? { width } : undefined}
    >
      {/* HEADER — branded tile + workspace title */}
      <div className="decant-sb-header">
        <div className="decant-sb-header__top">
          <div className="decant-sb-header__icon">
            <IconBuildingSkyscraper size={22} stroke={2.25} />
          </div>
          <div className="decant-sb-header__titles">
            <div className="decant-sb-header__title">Decant</div>
            <div className="decant-sb-header__subtitle">Knowledge Library</div>
          </div>
        </div>
        <div className="decant-sb-search">
          <IconSearch size={16} stroke={2.25} className="decant-sb-search__icon" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Filter tree…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter sidebar"
          />
          {searchQuery && (
            <button className="decant-sb-search__clear" onClick={() => setSearchQuery('')} aria-label="Clear">
              ×
            </button>
          )}
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <nav className="decant-sb-content">
        {/* HIERARCHY */}
        <div className="decant-sb-section">
          <SectionHeader
            label="Hierarchy"
            count={data.length}
            isOpen={sections.hierarchy}
            onToggle={() => toggleSection('hierarchy')}
            rightAction={
              hasMultiSelect ? (
                <button
                  className="decant-sb-section__clear"
                  onClick={(e) => { e.stopPropagation(); onClearMultiSelect?.(); }}
                  title="Clear multi-select"
                >
                  clear ({multiSelectedSegments!.size})
                </button>
              ) : null
            }
          />
          {sections.hierarchy && (
            <div className="decant-sb-section__body decant-sb-section__body--tight">
              {filteredData.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  level={0}
                  selectedId={selectedId}
                  multiSelected={multiSelectedNodeIds}
                  expandedIds={expandedIds}
                  onSelect={handleTreeNodeSelect}
                  onToggle={handleToggle}
                  itemCounts={itemCounts}
                  onDropItem={onDropItem}
                />
              ))}
              {filteredData.length === 0 && (
                <div className="decant-sb-section__empty">No matches</div>
              )}
            </div>
          )}
        </div>

        {/* COLLECTIONS */}
        <div className="decant-sb-section">
          <SectionHeader
            label="Collections"
            count={collections.length}
            isOpen={sections.collections}
            onToggle={() => toggleSection('collections')}
            rightAction={
              onCreateCollection ? (
                <button
                  type="button"
                  className="decant-sb-section__add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSections((prev) => ({ ...prev, collections: true }));
                    setIsCreatingCollection(true);
                  }}
                  title="New collection"
                  aria-label="New collection"
                >
                  <IconPlus size={15} stroke={2.75} />
                </button>
              ) : null
            }
          />
          {sections.collections && (
            <div className="decant-sb-section__body">
              {isCreatingCollection && onCreateCollection && (
                <CollectionEditorForm
                  submitLabel="Create"
                  onSubmit={async (name, icon, color) => {
                    try {
                      await onCreateCollection(name, icon, color);
                      setIsCreatingCollection(false);
                    } catch (err) {
                      console.error('Create collection failed', err);
                    }
                  }}
                  onCancel={() => setIsCreatingCollection(false)}
                />
              )}

              {collections.map((c) => {
                const letter = (c.name.charAt(0) || '?').toUpperCase();
                const color = c.color || SEGMENT_HEX_MAP[letter] || '#64748b';
                const leading = c.icon && c.icon.length <= 2
                  ? <span className="decant-sb-row__emoji">{c.icon}</span>
                  : <LetterBadge letter={letter} color={color} size={22} variant="filled" />;
                const isRenaming = renamingCollectionId === c.id;
                const isEditingIcon = iconEditingCollectionId === c.id;

                if (isEditingIcon && onUpdateCollectionIcon) {
                  return (
                    <CollectionEditorForm
                      key={c.id}
                      initialName={c.name}
                      initialIcon={c.icon}
                      initialColor={c.color}
                      submitLabel="Save"
                      onSubmit={async (_name, newIcon, newColor) => {
                        try {
                          await onUpdateCollectionIcon(c.id, newIcon, newColor);
                          setIconEditingCollectionId(null);
                        } catch (err) {
                          console.error('Update icon failed', err);
                        }
                      }}
                      onCancel={() => setIconEditingCollectionId(null)}
                    />
                  );
                }

                return (
                  <div
                    key={c.id}
                    className={`decant-sb-row ${selectedCollectionId === c.id ? 'decant-sb-row--selected' : ''}`}
                    onClick={() => !isRenaming && onSelectCollection?.(c.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="decant-sb-row__leading">{leading}</span>
                    {isRenaming && onRenameCollection ? (
                      <InlineRename
                        initialValue={c.name}
                        onSave={async (newName) => {
                          try {
                            await onRenameCollection(c.id, newName);
                            setRenamingCollectionId(null);
                          } catch (err) {
                            console.error('Rename failed', err);
                          }
                        }}
                        onCancel={() => setRenamingCollectionId(null)}
                      />
                    ) : (
                      <>
                        <span className="decant-sb-row__label">{c.name}</span>
                        {c.nodeCount != null && c.nodeCount > 0 && (
                          <span className="decant-sb-row__count">{c.nodeCount}</span>
                        )}
                        {(onRenameCollection || onUpdateCollectionIcon || onDeleteCollection) && (
                          <CollectionRowMenu
                            onEdit={() => setRenamingCollectionId(c.id)}
                            onChangeIcon={() => setIconEditingCollectionId(c.id)}
                            onDelete={async () => {
                              if (!onDeleteCollection) return;
                              if (!window.confirm(`Delete collection "${c.name}"?`)) return;
                              try {
                                await onDeleteCollection(c.id);
                              } catch (err) {
                                console.error('Delete failed', err);
                              }
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {collections.length === 0 && !isCreatingCollection && (
                <div className="decant-sb-section__empty">
                  No collections yet. {onCreateCollection ? 'Hit + to create one.' : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* TAGS — chip grid */}
        {userTags.length > 0 && (
          <div className="decant-sb-section">
            <SectionHeader
              label="Tags"
              count={userTags.length}
              isOpen={sections.tags}
              onToggle={() => toggleSection('tags')}
            />
            {sections.tags && (
              <div className="decant-sb-tags">
                {userTags.map((t) => (
                  <TagChip
                    key={t.id}
                    label={t.name}
                    color={t.color}
                    count={t.count}
                    isSelected={selectedTagId === t.id}
                    onClick={() => onSelectTag?.(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* FOOTER — primary CTA + ghost links */}
      <div className="decant-sb-footer">
        {onAddResourceClick && (
          <button className="decant-sb-footer__cta" onClick={onAddResourceClick} type="button">
            <IconPlus size={18} stroke={2.75} />
            <span>Add New Resource</span>
          </button>
        )}
        <div className="decant-sb-footer__links">
          {onOpenDocsClick && (
            <button className="decant-sb-footer__link" onClick={onOpenDocsClick} type="button">
              <IconFileText size={16} stroke={2.25} />
              <span>Documentation</span>
            </button>
          )}
          {onOpenSettingsClick && (
            <button className="decant-sb-footer__link" onClick={onOpenSettingsClick} type="button">
              <IconSettings size={16} stroke={2.25} />
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>

      <button className="decant-sidebar__toggle" onClick={onToggleCollapse} aria-label="Toggle sidebar">
        <i className={`bx ${isCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`} />
      </button>
      <div className="decant-sidebar__resize-handle" onMouseDown={onResizeStart} />
    </aside>
  );
};
