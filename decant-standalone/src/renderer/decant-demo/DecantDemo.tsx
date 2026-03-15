/**
 * Decant Application — Orchestrator
 *
 * Thin orchestrator: state, effects, handlers, layout composition.
 * All UI components are imported from ./components/.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import '../styles/app.css';
import { BatchImportModal } from '../components/import/BatchImportModal';
import { QuickAddModal } from '../components/import/QuickAddModal';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { useApp } from '../context/AppContext';
import { nodesAPI, hierarchyAPI, adminAPI, reclassifyAPI, userTagsAPI, imessageAPI } from '../services/api';
import type { UserTag } from '../services/api';
import { createIntegratedSSEClient, getEnrichmentTracker } from '../services/realtimeService';
import { getSegmentColor, formatMetadataCodesForDisplay } from '../utils/metadataCodeColors';
import { CommandPalette } from '../components/CommandPalette';
import { UserTagManager } from './components/UserTagManager';

import type {
  ViewMode, PanelTab, TagColor, RowColor, ColumnFilters,
  TableRow, TreeNodeData, BreadcrumbItem, HierarchyFilter,
} from './types';
import {
  DEFAULT_SEGMENT_LABELS, DEFAULT_CATEGORY_LABELS,
  CONTENT_TYPE_SYMBOLS, CONTENT_TYPE_LABELS, GUMROAD_ICON_COLORS,
  SAMPLE_TREE_DATA, SAMPLE_TABLE_DATA,
} from './types';

import { TopBar } from './components/TopBar';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { DataTable } from './components/DataTable';
import { FIELD_TO_API } from './components/DataTableRow';
import { PropertiesPanel } from './components/PropertiesPanel';
import { HybridDetailCard } from './components/HybridDetailCard';
import { Dashboard } from './components/Dashboard';
import { CollectionsPanel } from '../components/collections/CollectionsPanel';
import { UserTagsPanel } from '../components/user-tags/UserTagsPanel';

// ============================================================================
// HOOKS
// ============================================================================

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ============================================================================
// NODE MAPPING (consolidated — used by both initial load and reload)
// ============================================================================

function mapNodeToTableRow(
  node: any,
  segLabels: Record<string, string>,
  catLabels: Record<string, Record<string, string>>,
): TableRow {
  const segCode = node.segment_code || node.extracted_fields?.segment || '';
  const catCode = node.category_code || node.extracted_fields?.category || '';
  const ctCode = node.content_type_code || node.extracted_fields?.contentType || 'A';
  const segLabel = segLabels[segCode] || segCode || 'Uncategorized';
  const catLabel = catLabels[segCode]?.[catCode] || catCode || 'General';
  const domain = (node.source_domain || '').toLowerCase();

  let typeLabel = CONTENT_TYPE_LABELS[ctCode] || 'Website';
  let typeSymbol = CONTENT_TYPE_SYMBOLS[ctCode] || '\u{1F4C4}';

  // Domain-based type overrides
  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    typeLabel = 'X';
    typeSymbol = '\u{1D54F}';
  } else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    typeLabel = 'Video';
    typeSymbol = '\u{1F3AC}';
  }

  const tags = node.metadataCodes
    ? formatMetadataCodesForDisplay(
        Object.entries(node.metadataCodes).flatMap(([type, codes]) =>
          (codes as string[]).map(code => ({ type, code, confidence: 0.9 }))
        )
      ).slice(0, 3).map((badge) => ({
        label: badge.label,
        color: badge.color as TagColor,
      }))
    : (node.metadata_tags || []).slice(0, 3).map((tag: string, i: number) => {
        const prefix = tag.split(':')[0] || '';
        const structuredColorMap: Record<string, TagColor> = {
          segment: getSegmentColor(segCode) as TagColor,
          category: 'green' as TagColor,
          type: 'yellow' as TagColor,
          org: 'pink' as TagColor,
        };
        if (structuredColorMap[prefix] && tag.includes(':')) {
          return { label: tag, color: structuredColorMap[prefix] };
        }
        const plainColors: TagColor[] = [
          getSegmentColor(segCode) as TagColor,
          'green', 'yellow', 'pink',
        ];
        return { label: tag, color: plainColors[i % plainColors.length] };
      });

  return {
    id: node.id,
    segmentCode: segCode,
    categoryCode: catCode,
    logo: node.logo_url || 'https://via.placeholder.com/32',
    title: node.title || 'Untitled',
    type: typeLabel,
    typeSymbol,
    segment: segLabel,
    category: catLabel,
    subcategoryLabel: node.subcategory_label || '',
    hierarchy: segCode && catCode ? `${segLabel} > ${catLabel}` : '',
    quickPhrase: node.phrase_description || '',
    shortDescription: node.short_description || '',
    functionTags: node.function_tags || '',
    tags,
    date: node.date_added || new Date().toISOString().split('T')[0],
    company: node.company || 'Unknown',
    starred: false,
    rowColor: 'default' as RowColor,
    url: node.url || '',
    sourceDomain: node.source_domain || '',
    aiSummary: node.ai_summary || '',
    keyConcepts: node.key_concepts || [],
    userTags: node.user_tags || [],
  };
}

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
  const [rightPanelVisible, setRightPanelVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizingRef = useRef(false);
  const [tableData, setTableData] = useState<TableRow[]>(SAMPLE_TABLE_DATA);
  const [treeData, setTreeData] = useState<TreeNodeData[]>(SAMPLE_TREE_DATA);
  const [hierarchyView] = useState<'function' | 'organization'>('function');
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyFilter>({ type: 'all' });
  const [currentCategoryTitle, setCurrentCategoryTitle] = useState('All Items');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'All Items', id: 'all' },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [imessageInitialUrls, setImessageInitialUrls] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [, setRefreshQueuedCount] = useState<number | null>(null);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [pendingEnrichmentIds, setPendingEnrichmentIds] = useState<Set<string>>(new Set());
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const debouncedColumnFilters = useDebouncedValue(columnFilters);
  const [SEGMENT_LABELS, setSegmentLabels] = useState<Record<string, string>>(DEFAULT_SEGMENT_LABELS);
  const [CATEGORY_LABELS, setCategoryLabels] = useState<Record<string, Record<string, string>>>(DEFAULT_CATEGORY_LABELS);
  const [allUserTags, setAllUserTags] = useState<UserTag[]>([]);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

  // ---- Keyboard shortcuts ----

  // Global Cmd+K handler for Command Palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Global Cmd+N / Ctrl+N opens Quick Add
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

  // ---- Command Palette data ----

  const paletteCategories = useMemo(() => {
    const cats: Array<{ id: string; label: string; segmentCode: string; catCode: string }> = [];
    for (const [segCode, catMap] of Object.entries(CATEGORY_LABELS)) {
      for (const [catCode, label] of Object.entries(catMap)) {
        cats.push({ id: `${segCode}-${catCode}`, label, segmentCode: segCode, catCode });
      }
    }
    return cats;
  }, [CATEGORY_LABELS]);

  const paletteItems = useMemo(() => {
    return tableData.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type,
      segmentCode: item.segmentCode,
      url: item.url,
    }));
  }, [tableData]);

  // ---- Sidebar resize ----

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(500, Math.max(180, e.clientX));
      setSidebarWidth(newWidth);
      document.documentElement.style.setProperty('--decant-sidebar-width', `${newWidth}px`);
    };
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleSidebarResizeStart = useCallback(() => {
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // ---- Data loading ----

  // Reload nodes helper (used by SSE, reclassify, import callbacks)
  const loadNodes = useCallback(async () => {
    try {
      const nodes = await nodesAPI.getAll();
      if (nodes && nodes.length > 0) {
        const mappedData = nodes.map((node: any) =>
          mapNodeToTableRow(node, SEGMENT_LABELS, CATEGORY_LABELS)
        );
        setTableData(mappedData);
      }
    } catch (error) {
      console.error('Failed to load nodes from API:', error);
    }
  }, [SEGMENT_LABELS, CATEGORY_LABELS]);

  // Load hierarchy tree from API
  const loadTree = useCallback(async () => {
    try {
      const result = await hierarchyAPI.getTree(hierarchyView);
      if (result && result.tree) {
        const transformNode = (node: any): TreeNodeData => ({
          id: node.id,
          name: node.title,
          iconHint: node.iconHint || 'bxs-folder',
          iconColor: GUMROAD_ICON_COLORS[node.color] || '#6b7280',
          children: (node.children || []).map(transformNode),
          isExpanded: false,
        });
        setTreeData(result.tree.map(transformNode));
      }
    } catch (error) {
      console.error('Failed to load hierarchy tree from API:', error);
    }
  }, [hierarchyView]);

  // Initial load: fetch taxonomy labels then nodes
  useEffect(() => {
    const init = async () => {
      try {
        let segLabels = { ...DEFAULT_SEGMENT_LABELS };
        let catLabels: Record<string, Record<string, string>> = {};
        for (const [k, v] of Object.entries(DEFAULT_CATEGORY_LABELS)) {
          catLabels[k] = { ...v };
        }
        try {
          const taxonomy = await hierarchyAPI.getTaxonomyLabels();
          if (taxonomy.segments && Object.keys(taxonomy.segments).length > 0) {
            segLabels = { ...segLabels, ...taxonomy.segments };
          }
          if (taxonomy.categories && Object.keys(taxonomy.categories).length > 0) {
            for (const [seg, cats] of Object.entries(taxonomy.categories)) {
              catLabels[seg] = { ...(catLabels[seg] || {}), ...cats };
            }
          }
        } catch {
          // Fall back to defaults silently
        }
        setSegmentLabels(segLabels);
        setCategoryLabels(catLabels);

        const nodes = await nodesAPI.getAll();
        if (nodes && nodes.length > 0) {
          setTableData(nodes.map((node: any) => mapNodeToTableRow(node, segLabels, catLabels)));
        }
      } catch (error) {
        console.error('Failed to load nodes from API:', error);
      }
    };
    init();
  }, []);

  // Load hierarchy tree on mount / view change
  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Load user tags on mount
  const loadUserTags = useCallback(async () => {
    try {
      const tags = await userTagsAPI.getAll();
      setAllUserTags(tags);
    } catch {
      // user_tags table may not exist yet
    }
  }, []);

  useEffect(() => {
    loadUserTags();
  }, [loadUserTags]);

  // SSE client for real-time enrichment updates
  useEffect(() => {
    const sseClient = createIntegratedSSEClient(
      (nodeId, hierarchyUpdates) => {
        setPendingEnrichmentIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        if (hierarchyUpdates) loadTree();
        loadNodes();
      },
      (event) => {
        console.log('Enrichment complete event:', event);
      }
    );
    return () => { sseClient.disconnect(); };
  }, [loadTree, loadNodes]);

  // ---- Derived data ----

  const sidebarItemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('all', tableData.length);
    for (const item of tableData) {
      const segKey = `seg-${item.segmentCode}`;
      const catKey = `cat-${item.segmentCode}-${item.categoryCode}`;
      counts.set(segKey, (counts.get(segKey) || 0) + 1);
      counts.set(catKey, (counts.get(catKey) || 0) + 1);
    }
    return counts;
  }, [tableData]);

  const selectedItem = useMemo(
    () => tableData.find((item) => item.id === selectedRowId) || null,
    [tableData, selectedRowId]
  );

  const filteredTableData = useMemo(() => {
    let filtered = tableData;

    // Hierarchy filter
    if (hierarchyFilter.type === 'segment' && hierarchyFilter.segmentCode) {
      filtered = filtered.filter(item => item.segmentCode === hierarchyFilter.segmentCode);
    } else if (hierarchyFilter.type === 'category' && hierarchyFilter.segmentCode && hierarchyFilter.categoryCode) {
      filtered = filtered.filter(
        item => item.segmentCode === hierarchyFilter.segmentCode && item.categoryCode === hierarchyFilter.categoryCode
      );
    }

    // Per-column filters
    const activeColFilters = Object.entries(debouncedColumnFilters).filter(([_, v]) => v.trim());
    if (activeColFilters.length > 0) {
      filtered = filtered.filter(row =>
        activeColFilters.every(([col, query]) => {
          const q = query.trim().toLowerCase();
          if (col === 'tags') return row.tags.some(tag => tag.label.toLowerCase().includes(q));
          const value = String((row as unknown as Record<string, unknown>)[col] || '').toLowerCase();
          return value.includes(q);
        })
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.company.toLowerCase().includes(query) ||
          item.quickPhrase.toLowerCase().includes(query) ||
          item.segment.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.label.toLowerCase().includes(query)) ||
          (item.aiSummary && item.aiSummary.toLowerCase().includes(query)) ||
          (item.shortDescription && item.shortDescription.toLowerCase().includes(query)) ||
          (item.keyConcepts && item.keyConcepts.some((c) => c.toLowerCase().includes(query)))
      );
    }

    // Starred filter
    if (showStarredOnly) filtered = filtered.filter(item => item.starred);

    return filtered;
  }, [tableData, hierarchyFilter, debouncedColumnFilters, searchQuery, showStarredOnly]);

  const groupedTableData = useMemo(() => {
    if (hierarchyFilter.type === 'all') {
      // Group by segment when showing all items
      const groups = new Map<string, { label: string; catCode: string; segCode: string; items: TableRow[] }>();
      for (const item of filteredTableData) {
        const key = item.segmentCode || 'X';
        if (!groups.has(key)) {
          groups.set(key, {
            label: SEGMENT_LABELS[key] || key,
            catCode: `seg-${key}`,
            segCode: key,
            items: [],
          });
        }
        groups.get(key)!.items.push(item);
      }
      return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
    }
    if (hierarchyFilter.type === 'segment') {
      // Group by category within a segment
      const groups = new Map<string, { label: string; catCode: string; items: TableRow[] }>();
      for (const item of filteredTableData) {
        const key = item.categoryCode || 'OTH';
        if (!groups.has(key)) {
          groups.set(key, { label: item.category, catCode: key, items: [] });
        }
        groups.get(key)!.items.push(item);
      }
      return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
    }
    return null;
  }, [filteredTableData, hierarchyFilter, SEGMENT_LABELS]);

  // ---- Event handlers ----

  const handleTreeSelect = useCallback((id: string, _node: TreeNodeData) => {
    setSelectedTreeId(id);
    if (id.startsWith('seg-')) {
      const segCode = id.replace('seg-', '');
      const segLabel = SEGMENT_LABELS[segCode] || segCode;
      setHierarchyFilter({ type: 'segment', segmentCode: segCode });
      setCurrentCategoryTitle(segLabel);
      setBreadcrumbs([{ label: 'All Items', id: 'all' }, { label: segLabel, id }]);
    } else if (id.startsWith('cat-')) {
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
      setHierarchyFilter({ type: 'all' });
      setCurrentCategoryTitle('All Items');
      setBreadcrumbs([{ label: 'All Items', id: 'all' }]);
    }
  }, [SEGMENT_LABELS, CATEGORY_LABELS]);

  const handleRowSelect = useCallback((id: string) => {
    setSelectedRowId(id);
    setRightPanelVisible(true);
  }, []);

  const handleToggleStar = useCallback((id: string) => {
    setTableData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, starred: !item.starred } : item))
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
    setBreadcrumbs([{ label: 'All Items', id: 'all' }, { label: segLabel, id: `seg-${segCode}` }]);
  }, [SEGMENT_LABELS]);

  const handleCategoryClick = useCallback((segCode: string, catCode: string) => {
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
  }, [SEGMENT_LABELS, CATEGORY_LABELS]);

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
  }, [SEGMENT_LABELS]);

  const handleClearFilter = useCallback(() => {
    setHierarchyFilter({ type: 'all' });
    setCurrentCategoryTitle('All Items');
    setBreadcrumbs([{ label: 'All Items', id: 'all' }]);
    setSelectedTreeId(null);
  }, []);

  const handleImessageImport = useCallback(async () => {
    try {
      const result = await imessageAPI.extractUrls(5);
      if (result.success && result.urls.length > 0) {
        setImessageInitialUrls(result.urls.join('\n'));
        setIsBatchImportOpen(true);
      } else {
        alert(result.error || 'No URLs found in recent iMessage self-texts.');
      }
    } catch {
      alert('Failed to read iMessages. Make sure Full Disk Access is granted in System Settings > Privacy & Security.');
    }
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

  const handleReclassifyAll = useCallback(async () => {
    if (isReclassifying) return;
    setIsReclassifying(true);
    try {
      const result = await reclassifyAPI.reclassifyAll();
      await loadNodes();
      await loadTree();
      alert(`Reclassification complete: ${result.changedNodes} of ${result.totalNodes} nodes updated.`);
    } catch (error) {
      console.error('Reclassification failed:', error);
      alert(`Reclassification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsReclassifying(false);
    }
  }, [isReclassifying, loadNodes, loadTree]);

  const handleCellEdit = useCallback(async (rowId: string, field: string, value: string) => {
    const apiField = FIELD_TO_API[field];
    if (!apiField) return;
    try {
      await nodesAPI.update(rowId, { [apiField]: value });
      setTableData(prev => prev.map(row =>
        row.id === rowId ? { ...row, [field]: value } : row
      ));
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  }, []);

  const handleBatchDelete = useCallback(async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => nodesAPI.delete(id)));
      setTableData(prev => prev.filter(row => !ids.includes(row.id)));
      loadTree();
    } catch (error) {
      console.error('Batch delete failed:', error);
    }
  }, [loadTree]);

  const handleBatchReclassify = useCallback(async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => reclassifyAPI.reclassifyNode(id)));
      await loadNodes();
      await loadTree();
    } catch (error) {
      console.error('Batch reclassify failed:', error);
    }
  }, [loadNodes, loadTree]);

  const handleBatchExport = useCallback((ids: string[]) => {
    const items = tableData.filter(row => ids.includes(row.id));
    const csv = [
      ['Title', 'Segment', 'Category', 'Type', 'URL', 'Date'].join(','),
      ...items.map(item =>
        [item.title, item.segment, item.category, item.type, item.url, item.date]
          .map(v => `"${(v || '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decant-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tableData]);

  const handleDropItem = useCallback(async (itemId: string, targetNodeId: string) => {
    // Parse target node to extract segment/category codes
    let segCode = '';
    let catCode = '';
    if (targetNodeId.startsWith('cat-')) {
      const parts = targetNodeId.replace('cat-', '').split('-');
      segCode = parts[0];
      catCode = parts[1];
    } else if (targetNodeId.startsWith('seg-')) {
      segCode = targetNodeId.replace('seg-', '');
    } else {
      return; // Can't drop on root
    }
    try {
      await nodesAPI.update(itemId, { segment_code: segCode, category_code: catCode });
      await loadNodes();
      await loadTree();
    } catch (error) {
      console.error('Drop reclassify failed:', error);
    }
  }, [loadNodes, loadTree]);

  const handleClosePanel = useCallback(() => setRightPanelVisible(false), []);
  const handleTogglePanel = useCallback(() => setRightPanelVisible(prev => !prev), []);
  const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

  // ---- User tag handlers ----

  const handleUserTagChange = useCallback(async (nodeId: string, tagIds: string[]) => {
    try {
      await userTagsAPI.setNodeTags(nodeId, tagIds);
      // Optimistic update: update local state immediately
      setTableData(prev => prev.map(row => {
        if (row.id !== nodeId) return row;
        const newTags = tagIds.map(tid => allUserTags.find(t => t.id === tid)).filter(Boolean) as { id: string; name: string; color: string }[];
        return { ...row, userTags: newTags };
      }));
    } catch (error) {
      console.error('Failed to update node tags:', error);
    }
  }, [allUserTags]);

  const handleCreateUserTag = useCallback(async (name: string, color: string) => {
    await userTagsAPI.create({ name, color });
    await loadUserTags();
  }, [loadUserTags]);

  const handleUpdateUserTag = useCallback(async (id: string, data: { name?: string; color?: string }) => {
    await userTagsAPI.update(id, data);
    await loadUserTags();
    await loadNodes(); // refresh tag data on rows
  }, [loadUserTags, loadNodes]);

  const handleDeleteUserTag = useCallback(async (id: string) => {
    await userTagsAPI.delete(id);
    await loadUserTags();
    await loadNodes(); // refresh tag data on rows
  }, [loadUserTags, loadNodes]);

  // ---- Render ----

  return (
    <div className="decant-app">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        breadcrumbs={breadcrumbs}
        onBreadcrumbClick={handleBreadcrumbClick}
        onClearFilter={handleClearFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onBatchImportClick={() => setIsBatchImportOpen(true)}
        onImessageImportClick={handleImessageImport}
        onQuickAddClick={() => setIsQuickAddOpen(true)}
        onRefreshAllClick={handleRefreshAll}
        onReclassifyClick={handleReclassifyAll}
        isReclassifying={isReclassifying}
        onSettingsClick={() => appActions.openSettingsDialog()}
        onUserClick={() => {}}
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
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          totalCount={tableData.length}
          width={sidebarWidth}
          onResizeStart={handleSidebarResizeStart}
          itemCounts={sidebarItemCounts}
          onDropItem={handleDropItem}
        />

        <main className="decant-main">
          {viewMode === 'dashboard' ? (
            <Dashboard
              data={tableData}
              onNavigateSegment={handleSegmentBadgeClick}
              onNavigateCategory={handleCategoryClick}
              onToggleStarred={() => setShowStarredOnly(prev => !prev)}
            />
          ) : (
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
              onCategoryClick={handleCategoryClick}
              pendingEnrichmentIds={pendingEnrichmentIds}
              columnFilters={columnFilters}
              onColumnFilterChange={setColumnFilters}
              onCellEdit={handleCellEdit}
              showStarredOnly={showStarredOnly}
              onToggleStarredFilter={() => setShowStarredOnly(prev => !prev)}
              onBatchDelete={handleBatchDelete}
              onBatchReclassify={handleBatchReclassify}
              onBatchExport={handleBatchExport}
              allUserTags={allUserTags}
              onUserTagChange={handleUserTagChange}
              onManageUserTags={() => setIsTagManagerOpen(true)}
            />
          )}
        </main>

        <PropertiesPanel
          item={selectedItem}
          onClose={handleClosePanel}
          onToggle={handleTogglePanel}
          isVisible={rightPanelVisible}
        />
      </div>

      {/* Full-width bottom bar for Collections & Tags panels */}
      <div className="decant-app__bottom-bar">
        <CollectionsPanel />
        <UserTagsPanel />
      </div>

      <HybridDetailCard
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onImported={(nodeId) => {
          setPendingEnrichmentIds(prev => new Set(prev).add(nodeId));
          getEnrichmentTracker().addPendingNode(nodeId);
          loadNodes();
          loadTree();
        }}
        onSwitchToBatch={() => {
          setIsQuickAddOpen(false);
          setIsBatchImportOpen(true);
        }}
      />

      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => { setIsBatchImportOpen(false); setImessageInitialUrls(''); }}
        initialUrls={imessageInitialUrls}
      />

      <SettingsDialog isOpen={appState.settingsDialogOpen} onClose={appActions.closeSettingsDialog} />

      <UserTagManager
        isOpen={isTagManagerOpen}
        onClose={() => setIsTagManagerOpen(false)}
        tags={allUserTags}
        onCreate={handleCreateUserTag}
        onUpdate={handleUpdateUserTag}
        onDelete={handleDeleteUserTag}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={paletteItems}
        categories={paletteCategories}
        onSelectItem={(id) => {
          setSelectedRowId(id);
          setRightPanelVisible(true);
        }}
        onNavigateCategory={handleCategoryClick}
        onImport={() => setIsQuickAddOpen(true)}
        onBatchImport={() => setIsBatchImportOpen(true)}
        onReclassify={handleReclassifyAll}
        onToggleStarred={() => setShowStarredOnly(prev => !prev)}
        onShowAll={handleClearFilter}
      />
    </div>
  );
}
