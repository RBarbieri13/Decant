// ============================================================
// App Context - Global State Management
// ============================================================

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { hierarchyAPI, nodesAPI, searchAPI, importAPI, settingsAPI, mergeAPI, moveAPI } from '../services/api';

// ============================================================
// State Types
// ============================================================

export interface ImportProgress {
  phase: 'idle' | 'validating' | 'fetching' | 'classifying' | 'saving' | 'complete' | 'error';
  message: string;
  percentage: number;
  nodeId?: string;
  classification?: {
    segment: string;
    category: string;
    contentType: string;
  };
  error?: string;
}

interface AppState {
  currentView: 'function' | 'organization';
  segments: any[];
  organizations: any[];
  tree: any[];
  selectedNodeId: string | null;
  selectedNode: any | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: any[];
  importDialogOpen: boolean;
  batchImportDialogOpen: boolean;
  mergeDialogOpen: boolean;
  mergeSourceNodeId: string | null;
  selectedSegmentId: string | null;
  selectedOrganizationId: string | null;
  expandedNodeIds: Set<string>;
  searchResultIds: Set<string>;
  treeLoading: boolean;
  settingsDialogOpen: boolean;
  importProgress: Map<string, ImportProgress>;
  pendingEnrichments: Set<string>;
}

type AppAction =
  | { type: 'SET_VIEW'; view: 'function' | 'organization' }
  | { type: 'SET_SEGMENTS'; segments: any[] }
  | { type: 'SET_ORGANIZATIONS'; organizations: any[] }
  | { type: 'SET_TREE'; tree: any[] }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'SET_SELECTED_NODE'; node: any }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SEARCH_RESULTS'; results: any[] }
  | { type: 'OPEN_IMPORT_DIALOG' }
  | { type: 'CLOSE_IMPORT_DIALOG' }
  | { type: 'OPEN_BATCH_IMPORT_DIALOG' }
  | { type: 'CLOSE_BATCH_IMPORT_DIALOG' }
  | { type: 'OPEN_MERGE_DIALOG'; nodeId: string }
  | { type: 'CLOSE_MERGE_DIALOG' }
  | { type: 'SELECT_SEGMENT'; id: string | null }
  | { type: 'SELECT_ORGANIZATION'; id: string | null }
  | { type: 'SET_SELECTED_SEGMENT'; id: string | null }
  | { type: 'SET_SELECTED_ORGANIZATION'; id: string | null }
  | { type: 'TOGGLE_NODE_EXPANDED'; id: string }
  | { type: 'EXPAND_NODE'; id: string }
  | { type: 'COLLAPSE_NODE'; id: string }
  | { type: 'SET_TREE_LOADING'; loading: boolean }
  | { type: 'SET_SEARCH_RESULT_IDS'; ids: Set<string> }
  | { type: 'OPEN_SETTINGS_DIALOG' }
  | { type: 'CLOSE_SETTINGS_DIALOG' }
  | { type: 'START_IMPORT'; importId: string; url: string }
  | { type: 'UPDATE_IMPORT_PROGRESS'; importId: string; progress: Partial<ImportProgress> }
  | { type: 'COMPLETE_IMPORT'; importId: string; nodeId: string; classification?: any }
  | { type: 'FAIL_IMPORT'; importId: string; error: string }
  | { type: 'ADD_PENDING_ENRICHMENT'; nodeId: string }
  | { type: 'REMOVE_PENDING_ENRICHMENT'; nodeId: string };

// ============================================================
// Initial State
// ============================================================

const initialState: AppState = {
  currentView: 'function',
  segments: [],
  organizations: [],
  tree: [],
  selectedNodeId: null,
  selectedNode: null,
  loading: true,
  error: null,
  searchQuery: '',
  searchResults: [],
  importDialogOpen: false,
  batchImportDialogOpen: false,
  mergeDialogOpen: false,
  mergeSourceNodeId: null,
  selectedSegmentId: null,
  selectedOrganizationId: null,
  expandedNodeIds: new Set(),
  searchResultIds: new Set(),
  treeLoading: true,
  settingsDialogOpen: false,
  importProgress: new Map(),
  pendingEnrichments: new Set(),
};

// ============================================================
// Reducer
// ============================================================

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.view };
    case 'SET_SEGMENTS':
      return { ...state, segments: action.segments };
    case 'SET_ORGANIZATIONS':
      return { ...state, organizations: action.organizations };
    case 'SET_TREE':
      return { ...state, tree: action.tree };
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.id };
    case 'SET_SELECTED_NODE':
      return { ...state, selectedNode: action.node };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.results };
    case 'OPEN_IMPORT_DIALOG':
      return { ...state, importDialogOpen: true };
    case 'CLOSE_IMPORT_DIALOG':
      return { ...state, importDialogOpen: false };
    case 'OPEN_BATCH_IMPORT_DIALOG':
      return { ...state, batchImportDialogOpen: true };
    case 'CLOSE_BATCH_IMPORT_DIALOG':
      return { ...state, batchImportDialogOpen: false };
    case 'OPEN_MERGE_DIALOG':
      return { ...state, mergeDialogOpen: true, mergeSourceNodeId: action.nodeId };
    case 'CLOSE_MERGE_DIALOG':
      return { ...state, mergeDialogOpen: false, mergeSourceNodeId: null };
    case 'SET_SELECTED_SEGMENT':
      return { ...state, selectedSegmentId: action.id };
    case 'SET_SELECTED_ORGANIZATION':
      return { ...state, selectedOrganizationId: action.id };
    case 'SELECT_SEGMENT':
      // Store selection and reload tree
      localStorage.setItem('selectedSegmentId', action.id || '');
      return { ...state, selectedSegmentId: action.id };
    case 'SELECT_ORGANIZATION':
      // Store selection and reload tree
      localStorage.setItem('selectedOrganizationId', action.id || '');
      return { ...state, selectedOrganizationId: action.id };
    case 'TOGGLE_NODE_EXPANDED': {
      const newSet = new Set(state.expandedNodeIds);
      if (newSet.has(action.id)) {
        newSet.delete(action.id);
      } else {
        newSet.add(action.id);
      }
      return { ...state, expandedNodeIds: newSet };
    }
    case 'EXPAND_NODE': {
      const newSet = new Set(state.expandedNodeIds);
      newSet.add(action.id);
      return { ...state, expandedNodeIds: newSet };
    }
    case 'COLLAPSE_NODE': {
      const newSet = new Set(state.expandedNodeIds);
      newSet.delete(action.id);
      return { ...state, expandedNodeIds: newSet };
    }
    case 'SET_TREE_LOADING':
      return { ...state, treeLoading: action.loading };
    case 'SET_SEARCH_RESULT_IDS':
      return { ...state, searchResultIds: action.ids };
    case 'OPEN_SETTINGS_DIALOG':
      return { ...state, settingsDialogOpen: true };
    case 'CLOSE_SETTINGS_DIALOG':
      return { ...state, settingsDialogOpen: false };

    // Import progress actions
    case 'START_IMPORT': {
      const newProgress = new Map(state.importProgress);
      newProgress.set(action.importId, {
        phase: 'validating',
        message: 'Validating URL...',
        percentage: 10,
      });
      return { ...state, importProgress: newProgress };
    }
    case 'UPDATE_IMPORT_PROGRESS': {
      const newProgress = new Map(state.importProgress);
      const current = newProgress.get(action.importId);
      if (current) {
        newProgress.set(action.importId, { ...current, ...action.progress });
      }
      return { ...state, importProgress: newProgress };
    }
    case 'COMPLETE_IMPORT': {
      const newProgress = new Map(state.importProgress);
      newProgress.set(action.importId, {
        phase: 'complete',
        message: 'Import complete!',
        percentage: 100,
        nodeId: action.nodeId,
        classification: action.classification,
      });
      return { ...state, importProgress: newProgress };
    }
    case 'FAIL_IMPORT': {
      const newProgress = new Map(state.importProgress);
      newProgress.set(action.importId, {
        phase: 'error',
        message: action.error,
        percentage: 0,
        error: action.error,
      });
      return { ...state, importProgress: newProgress };
    }
    case 'ADD_PENDING_ENRICHMENT': {
      const newPending = new Set(state.pendingEnrichments);
      newPending.add(action.nodeId);
      return { ...state, pendingEnrichments: newPending };
    }
    case 'REMOVE_PENDING_ENRICHMENT': {
      const newPending = new Set(state.pendingEnrichments);
      newPending.delete(action.nodeId);
      return { ...state, pendingEnrichments: newPending };
    }
    default:
      return state;
  }
}

// ============================================================
// Context
// ============================================================

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: {
    loadSegments: () => Promise<void>;
    loadOrganizations: () => Promise<void>;
    loadTree: () => Promise<void>;
    selectNode: (id: string | null) => Promise<void>;
    updateNode: (id: string, data: any) => Promise<void>;
    deleteNode: (id: string) => Promise<void>;
    toggleView: () => void;
    search: (query: string) => Promise<void>;
    setSearchQuery: (query: string, resultIds: Set<string>) => void;
    clearSearch: () => void;
    refreshTree: () => Promise<void>;
    importUrl: (url: string, importId: string) => Promise<{ success: boolean; nodeId?: string; error?: string }>;
    setApiKey: (apiKey: string) => Promise<void>;
    checkApiKeyStatus: () => Promise<boolean>;
    openImportDialog: () => void;
    closeImportDialog: () => void;
    openBatchImportDialog: () => void;
    closeBatchImportDialog: () => void;
    openMergeDialog: (nodeId: string) => void;
    closeMergeDialog: () => void;
    mergeNodes: (primaryId: string, secondaryId: string, options: { keepMetadata?: boolean; appendSummary?: boolean }) => Promise<void>;
    moveNode: (nodeId: string, targetParentId: string) => Promise<void>;
    openSettingsDialog: () => void;
    closeSettingsDialog: () => void;
    startImport: (importId: string, url: string) => void;
    updateImportProgress: (importId: string, progress: Partial<ImportProgress>) => void;
    completeImport: (importId: string, nodeId: string, classification?: any) => void;
    failImport: (importId: string, error: string) => void;
    enrichmentComplete: (nodeId: string) => void;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const loadSegments = useCallback(async () => {
    try {
      const segments = await hierarchyAPI.getSegments();
      dispatch({ type: 'SET_SEGMENTS', segments });
    } catch (err) {
      console.error('Failed to load segments:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to load segments' });
    }
  }, []);

  const loadOrganizations = useCallback(async () => {
    try {
      const organizations = await hierarchyAPI.getOrganizations();
      dispatch({ type: 'SET_ORGANIZATIONS', organizations });
    } catch (err) {
      console.error('Failed to load organizations:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to load organizations' });
    }
  }, []);

  const loadTree = useCallback(async () => {
    dispatch({ type: 'SET_TREE_LOADING', loading: true });
    try {
      const response = await hierarchyAPI.getTree(state.currentView);
      // The API returns { taxonomy, root } - we want to display root nodes
      const tree = response.root || [];
      dispatch({ type: 'SET_TREE', tree });
    } catch (err) {
      console.error('Failed to load tree:', err);
      dispatch({ type: 'SET_TREE', tree: [] });
    } finally {
      dispatch({ type: 'SET_TREE_LOADING', loading: false });
    }
  }, [state.currentView]);

  const selectNode = useCallback(async (id: string | null) => {
    dispatch({ type: 'SELECT_NODE', id });

    if (id) {
      try {
        const node = await nodesAPI.get(id);
        dispatch({ type: 'SET_SELECTED_NODE', node });
      } catch (err) {
        console.error('Failed to load node details:', err);
        dispatch({ type: 'SET_SELECTED_NODE', node: null });
      }
    } else {
      dispatch({ type: 'SET_SELECTED_NODE', node: null });
    }
  }, []);

  const updateNode = useCallback(async (id: string, data: any) => {
    try {
      const updatedNode = await nodesAPI.update(id, data);
      dispatch({ type: 'SET_SELECTED_NODE', node: updatedNode });
      await loadTree();
    } catch (err) {
      console.error('Failed to update node:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to update node' });
    }
  }, [loadTree]);

  const deleteNode = useCallback(async (id: string) => {
    try {
      await nodesAPI.delete(id);
      dispatch({ type: 'SELECT_NODE', id: null });
      dispatch({ type: 'SET_SELECTED_NODE', node: null });
      await loadTree();
    } catch (err) {
      console.error('Failed to delete node:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to delete node' });
    }
  }, [loadTree]);

  const toggleView = useCallback(() => {
    const newView = state.currentView === 'function' ? 'organization' : 'function';
    dispatch({ type: 'SET_VIEW', view: newView });
  }, [state.currentView]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
      dispatch({ type: 'SET_SEARCH_RESULTS', results: [] });
      return;
    }

    try {
      const results = await searchAPI.search(query);
      dispatch({ type: 'SET_SEARCH_QUERY', query });
      dispatch({ type: 'SET_SEARCH_RESULTS', results });
    } catch (err) {
      console.error('Search failed:', err);
      dispatch({ type: 'SET_ERROR', error: 'Search failed' });
    }
  }, []);

  const refreshTree = useCallback(async () => {
    await loadTree();
  }, [loadTree]);

  const importUrl = useCallback(async (url: string, importId: string) => {
    try {
      // Start import tracking
      dispatch({ type: 'START_IMPORT', importId, url });

      // Update to fetching phase
      dispatch({
        type: 'UPDATE_IMPORT_PROGRESS',
        importId,
        progress: {
          phase: 'fetching',
          message: 'Fetching content...',
          percentage: 30,
        },
      });

      // Make API call
      const result = await importAPI.importUrl(url);

      if (!result.success) {
        dispatch({ type: 'FAIL_IMPORT', importId, error: result.error || 'Import failed' });
        return result;
      }

      // Update to saving phase
      dispatch({
        type: 'UPDATE_IMPORT_PROGRESS',
        importId,
        progress: {
          phase: 'saving',
          message: 'Saving node...',
          percentage: 90,
        },
      });

      // Complete import
      dispatch({
        type: 'COMPLETE_IMPORT',
        importId,
        nodeId: result.nodeId!,
        classification: result.classification,
      });

      // Add to pending enrichments if Phase 2 was queued
      if (result.phase2?.queued && result.nodeId) {
        dispatch({ type: 'ADD_PENDING_ENRICHMENT', nodeId: result.nodeId });
      }

      // Refresh tree to show the new node
      await loadTree();

      // Select the newly imported node
      if (result.nodeId) {
        await selectNode(result.nodeId);
      }

      return result;
    } catch (err) {
      console.error('Import failed:', err);
      const error = err instanceof Error ? err.message : 'Import failed';
      dispatch({ type: 'FAIL_IMPORT', importId, error });
      return { success: false, error };
    }
  }, [loadTree, selectNode]);

  const setApiKey = useCallback(async (apiKey: string) => {
    await settingsAPI.setApiKey(apiKey);
  }, []);

  const checkApiKeyStatus = useCallback(async () => {
    const status = await settingsAPI.getApiKeyStatus();
    return status.configured;
  }, []);

  const openImportDialog = useCallback(() => {
    dispatch({ type: 'OPEN_IMPORT_DIALOG' });
  }, []);

  const closeImportDialog = useCallback(() => {
    dispatch({ type: 'CLOSE_IMPORT_DIALOG' });
  }, []);

  const openBatchImportDialog = useCallback(() => {
    dispatch({ type: 'OPEN_BATCH_IMPORT_DIALOG' });
  }, []);

  const closeBatchImportDialog = useCallback(() => {
    dispatch({ type: 'CLOSE_BATCH_IMPORT_DIALOG' });
  }, []);

  const openMergeDialog = useCallback((nodeId: string) => {
    dispatch({ type: 'OPEN_MERGE_DIALOG', nodeId });
  }, []);

  const closeMergeDialog = useCallback(() => {
    dispatch({ type: 'CLOSE_MERGE_DIALOG' });
  }, []);

  const mergeNodes = useCallback(async (primaryId: string, secondaryId: string, options: { keepMetadata?: boolean; appendSummary?: boolean }) => {
    try {
      await mergeAPI.merge(primaryId, secondaryId, options);
      dispatch({ type: 'CLOSE_MERGE_DIALOG' });
      await loadTree();
      await selectNode(primaryId);
    } catch (err) {
      console.error('Failed to merge nodes:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to merge nodes' });
    }
  }, [loadTree, selectNode]);

  const moveNode = useCallback(async (nodeId: string, targetParentId: string) => {
    try {
      await moveAPI.moveNode(nodeId, targetParentId, state.currentView);
      await loadTree();
    } catch (err) {
      console.error('Failed to move node:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to move node' });
    }
  }, [loadTree, state.currentView]);

  const openSettingsDialog = useCallback(() => {
    dispatch({ type: 'OPEN_SETTINGS_DIALOG' });
  }, []);

  const closeSettingsDialog = useCallback(() => {
    dispatch({ type: 'CLOSE_SETTINGS_DIALOG' });
  }, []);

  // Import progress actions
  const startImport = useCallback((importId: string, url: string) => {
    dispatch({ type: 'START_IMPORT', importId, url });
  }, []);

  const updateImportProgress = useCallback((importId: string, progress: Partial<ImportProgress>) => {
    dispatch({ type: 'UPDATE_IMPORT_PROGRESS', importId, progress });
  }, []);

  const completeImport = useCallback((importId: string, nodeId: string, classification?: any) => {
    dispatch({ type: 'COMPLETE_IMPORT', importId, nodeId, classification });
  }, []);

  const failImport = useCallback((importId: string, error: string) => {
    dispatch({ type: 'FAIL_IMPORT', importId, error });
  }, []);

  const enrichmentComplete = useCallback((nodeId: string) => {
    dispatch({ type: 'REMOVE_PENDING_ENRICHMENT', nodeId });
  }, []);

  // Search actions
  const setSearchQuery = useCallback((query: string, resultIds: Set<string>) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
    dispatch({ type: 'SET_SEARCH_RESULT_IDS', ids: resultIds });
  }, []);

  const clearSearch = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
    dispatch({ type: 'SET_SEARCH_RESULTS', results: [] });
    dispatch({ type: 'SET_SEARCH_RESULT_IDS', ids: new Set() });
  }, []);

  // Load initial data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Promise.all([loadSegments(), loadOrganizations()]);
        // Load tree with current view
        dispatch({ type: 'SET_TREE_LOADING', loading: true });
        try {
          const response = await hierarchyAPI.getTree(state.currentView);
          const tree = response.root || [];
          dispatch({ type: 'SET_TREE', tree });
        } catch (err) {
          console.error('Failed to load tree:', err);
          dispatch({ type: 'SET_TREE', tree: [] });
        } finally {
          dispatch({ type: 'SET_TREE_LOADING', loading: false });
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        dispatch({ type: 'SET_ERROR', error: 'Failed to initialize app' });
      }
    };
    initializeApp();
  }, []);

  const value: AppContextValue = {
    state,
    dispatch,
    actions: {
      loadSegments,
      loadOrganizations,
      loadTree,
      selectNode,
      updateNode,
      deleteNode,
      toggleView,
      search,
      setSearchQuery,
      clearSearch,
      refreshTree,
      importUrl,
      setApiKey,
      checkApiKeyStatus,
      openImportDialog,
      closeImportDialog,
      openBatchImportDialog,
      closeBatchImportDialog,
      openMergeDialog,
      closeMergeDialog,
      mergeNodes,
      moveNode,
      openSettingsDialog,
      closeSettingsDialog,
      startImport,
      updateImportProgress,
      completeImport,
      failImport,
      enrichmentComplete,
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============================================================
// Hook
// ============================================================

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
