// ============================================================
// useBatchImport Hook
// Manages batch import state, SSE subscriptions, and actions
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { batchImportAPI } from '../services/api';
import {
  getSSEClient,
  type BatchImportProgressEvent,
  type BatchImportCompleteEvent,
} from '../services/realtimeService';
import type {
  BatchImportItem,
  BatchImportOptions,
  BatchImportState,
  BatchImportStats,
} from '../../shared/types';

// ============================================================
// Default Options
// ============================================================

const DEFAULT_OPTIONS: BatchImportOptions = {
  autoClassify: true,
  skipDuplicates: true,
  showInTreeWhenDone: true,
  maxConcurrent: 2,
};

// ============================================================
// Hook Interface
// ============================================================

export interface UseBatchImportReturn {
  // State
  state: BatchImportState | null;
  urlText: string;
  parsedUrls: Array<{ url: string; lineNumber: number }>;
  options: BatchImportOptions;
  showDetails: boolean;
  isActive: boolean;
  isComplete: boolean;

  // Actions
  setUrlText: (text: string) => void;
  setOptions: (options: Partial<BatchImportOptions>) => void;
  toggleDetails: () => void;
  startImport: () => Promise<void>;
  cancelImport: () => Promise<void>;
  reset: () => void;

  // Computed
  stats: BatchImportStats;
  progressPercent: number;
  validUrlCount: number;
}

// ============================================================
// URL Parsing Helper
// ============================================================

function parseUrls(text: string): Array<{ url: string; lineNumber: number }> {
  return text
    .split('\n')
    .map((line, index) => ({
      url: line.trim(),
      lineNumber: index + 1,
    }))
    .filter(({ url }) => {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    });
}

// ============================================================
// Hook Implementation
// ============================================================

export function useBatchImport(): UseBatchImportReturn {
  // Local state
  const [state, setState] = useState<BatchImportState | null>(null);
  const [urlText, setUrlText] = useState<string>('');
  const [options, setOptionsState] = useState<BatchImportOptions>(DEFAULT_OPTIONS);
  const [showDetails, setShowDetails] = useState<boolean>(true);

  // Track active batch ID for SSE filtering
  const batchIdRef = useRef<string | null>(null);

  // Parse URLs from text
  const parsedUrls = useMemo(() => parseUrls(urlText), [urlText]);
  const validUrlCount = parsedUrls.length;

  // ----------------------------------------
  // SSE Event Handlers
  // ----------------------------------------

  const handleBatchProgress = useCallback((event: BatchImportProgressEvent) => {
    // Only handle events for our active batch
    if (event.batchId !== batchIdRef.current) return;

    setState((prev) => {
      if (!prev) return prev;

      const itemIndex = prev.items.findIndex((i) => i.id === event.itemId);
      if (itemIndex === -1) return prev;

      const newItems = [...prev.items];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        status: event.status,
        progress: event.progress,
        nodeId: event.nodeId,
        title: event.title,
        favicon: event.favicon,
        classification: event.classification,
        error: event.error,
        completedAt: ['imported', 'failed', 'duplicate'].includes(event.status)
          ? new Date().toISOString()
          : newItems[itemIndex].completedAt,
      };

      return { ...prev, items: newItems };
    });
  }, []);

  const handleBatchComplete = useCallback((event: BatchImportCompleteEvent) => {
    // Only handle events for our active batch
    if (event.batchId !== batchIdRef.current) return;

    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: 'complete',
        completedAt: new Date().toISOString(),
      };
    });
  }, []);

  // ----------------------------------------
  // SSE Subscription
  // ----------------------------------------

  useEffect(() => {
    const sseClient = getSSEClient();
    if (!sseClient) return;

    // The SSE client uses options callbacks, so we need to update them
    // This is a limitation of the current SSE client design
    // For now, we'll rely on the callbacks being set when the client is created
    // A better approach would be to use an event emitter pattern

    // Since we can't easily add/remove listeners dynamically with the current
    // SSE client design, we'll poll for state updates as a fallback
    // The SSE events will be handled by the App-level SSE client

    return () => {
      // Cleanup
    };
  }, []);

  // ----------------------------------------
  // Actions
  // ----------------------------------------

  const setOptions = useCallback((newOptions: Partial<BatchImportOptions>) => {
    setOptionsState((prev) => ({ ...prev, ...newOptions }));
  }, []);

  const toggleDetails = useCallback(() => {
    setShowDetails((prev) => !prev);
  }, []);

  const startImport = useCallback(async () => {
    if (parsedUrls.length === 0) return;

    const urls = parsedUrls.map((p) => p.url);

    try {
      const result = await batchImportAPI.start(urls, options);

      if (!result.success || !result.batchId) {
        console.error('Failed to start batch import:', result.error);
        return;
      }

      // Store batch ID for SSE filtering
      batchIdRef.current = result.batchId;

      // Create initial state from parsed URLs
      const initialItems: BatchImportItem[] = parsedUrls.map((p, index) => ({
        id: `item_${index}`, // Will be replaced by actual IDs from server
        url: p.url,
        lineNumber: p.lineNumber,
        status: 'queued',
        progress: 0,
      }));

      setState({
        batchId: result.batchId,
        items: initialItems,
        options,
        status: 'importing',
        startedAt: new Date().toISOString(),
      });

      // Fetch initial state from server to get actual item IDs
      const statusResult = await batchImportAPI.getStatus(result.batchId);
      if (statusResult.success && statusResult.items) {
        setState((prev) => ({
          ...prev!,
          items: statusResult.items!,
        }));
      }
    } catch (error) {
      console.error('Failed to start batch import:', error);
    }
  }, [parsedUrls, options]);

  const cancelImport = useCallback(async () => {
    if (!batchIdRef.current) return;

    try {
      await batchImportAPI.cancel(batchIdRef.current);
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'cancelled',
          completedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      console.error('Failed to cancel batch import:', error);
    }
  }, []);

  const reset = useCallback(() => {
    batchIdRef.current = null;
    setState(null);
    setUrlText('');
    setOptionsState(DEFAULT_OPTIONS);
  }, []);

  // ----------------------------------------
  // Polling for state updates (fallback)
  // ----------------------------------------

  useEffect(() => {
    if (!state || state.status !== 'importing' || !batchIdRef.current) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await batchImportAPI.getStatus(batchIdRef.current!);
        if (result.success && result.items) {
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              items: result.items!,
              status: result.status || prev.status,
              completedAt: result.completedAt,
            };
          });

          // Stop polling if complete
          if (result.status === 'complete' || result.status === 'cancelled') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Failed to poll batch status:', error);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [state?.status]);

  // ----------------------------------------
  // Computed Values
  // ----------------------------------------

  const stats: BatchImportStats = useMemo(() => {
    if (!state?.items) {
      return {
        total: 0,
        imported: 0,
        processing: 0,
        queued: 0,
        failed: 0,
        duplicates: 0,
      };
    }

    return {
      total: state.items.length,
      imported: state.items.filter((i) => i.status === 'imported').length,
      processing: state.items.filter((i) =>
        ['validating', 'fetching', 'classifying', 'saving'].includes(i.status)
      ).length,
      queued: state.items.filter((i) => i.status === 'queued').length,
      failed: state.items.filter((i) => i.status === 'failed').length,
      duplicates: state.items.filter((i) => i.status === 'duplicate').length,
    };
  }, [state?.items]);

  const progressPercent = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round(((stats.imported + stats.duplicates) / stats.total) * 100);
  }, [stats]);

  const isActive = state?.status === 'importing';
  const isComplete = state?.status === 'complete' || state?.status === 'cancelled';

  // ----------------------------------------
  // Return
  // ----------------------------------------

  return {
    state,
    urlText,
    parsedUrls,
    options,
    showDetails,
    isActive,
    isComplete,
    setUrlText,
    setOptions,
    toggleDetails,
    startImport,
    cancelImport,
    reset,
    stats,
    progressPercent,
    validUrlCount,
  };
}

// Export event handlers for App-level SSE integration
export { type BatchImportProgressEvent, type BatchImportCompleteEvent };
