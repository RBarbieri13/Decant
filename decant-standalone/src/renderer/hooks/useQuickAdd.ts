// ============================================================
// useQuickAdd Hook — State management for Quick Add modal
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { importAPI } from '../services/api';
import type { AIClassification } from '../../shared/types';
import type { QuickAddPreviewMetadata } from '../components/import/QuickAddPreviewCard';

// ============================================
// TYPES
// ============================================

export interface QuickAddState {
  url: string;
  status: QuickAddStatus;
  isValidUrl: boolean;
  isLoading: boolean;
  metadata: QuickAddPreviewMetadata | null;
  classification: AIClassification | null;
  error: string | null;
  importedNodeId: string | null;
}

export type QuickAddStatus =
  | 'idle'           // No URL entered
  | 'typing'         // User is typing
  | 'validating'     // Checking URL format
  | 'ready'          // Valid URL, ready to import
  | 'importing'      // Import in progress
  | 'success'        // Successfully imported
  | 'error';         // Something went wrong

interface UseQuickAddReturn {
  state: QuickAddState;
  setUrl: (url: string) => void;
  pasteFromClipboard: () => Promise<void>;
  submitImport: () => Promise<string | null>; // Returns node ID or null
  reset: () => void;
}

// ============================================
// URL VALIDATION
// ============================================

function isValidUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return url;
  }
}

// ============================================
// HOOK
// ============================================

export function useQuickAdd(): UseQuickAddReturn {
  const [state, setState] = useState<QuickAddState>({
    url: '',
    status: 'idle',
    isValidUrl: false,
    isLoading: false,
    metadata: null,
    classification: null,
    error: null,
    importedNodeId: null,
  });

  // Debounce timer ref for URL validation
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----------------------------------------
  // Cleanup on unmount
  // ----------------------------------------
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ----------------------------------------
  // Set URL (called on every keystroke)
  // ----------------------------------------
  const setUrl = useCallback((url: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = url.trim();
    const valid = isValidUrl(trimmed);

    setState(prev => ({
      ...prev,
      url,
      isValidUrl: valid,
      status: trimmed.length === 0 ? 'idle' : valid ? 'validating' : 'typing',
      error: null,
      importedNodeId: null,
    }));

    // If valid URL, debounce to "ready" status and build preview metadata from URL
    if (valid) {
      debounceRef.current = setTimeout(() => {
        const domain = extractDomain(trimmed);
        setState(prev => ({
          ...prev,
          status: 'ready',
          metadata: {
            title: domain.replace(/^www\./, ''),
            description: trimmed,
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            domain,
          },
        }));
      }, 300);
    } else {
      setState(prev => ({
        ...prev,
        metadata: null,
        classification: null,
      }));
    }
  }, []);

  // ----------------------------------------
  // Paste from clipboard
  // ----------------------------------------
  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        setUrl(text.trim());
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  }, [setUrl]);

  // ----------------------------------------
  // Submit import — uses the existing import API
  // which handles fetch, classify, and save all at once
  // ----------------------------------------
  const submitImport = useCallback(async (): Promise<string | null> => {
    if (!state.isValidUrl || !state.url) return null;

    setState(prev => ({ ...prev, status: 'importing', isLoading: true, error: null }));

    try {
      const result = await importAPI.importUrl(state.url.trim());

      if (!result.success || !result.nodeId) {
        throw new Error(result.error || 'Failed to import');
      }

      // Update state with classification data from the import result
      setState(prev => ({
        ...prev,
        status: 'success',
        isLoading: false,
        importedNodeId: result.nodeId!,
        classification: result.classification ? {
          segment: result.classification.segment,
          category: result.classification.category,
          contentType: result.classification.contentType,
          organization: result.classification.organization || '',
          confidence: result.classification.confidence || 0,
          reasoning: '',
        } : prev.classification,
        // Update metadata with the title from the import result if available
        metadata: result.node ? {
          title: result.node.title || prev.metadata?.title || null,
          description: (result.node as any).phrase_description || prev.metadata?.description || null,
          favicon: (result.node as any).logo_url || prev.metadata?.favicon || null,
          domain: prev.metadata?.domain || extractDomain(state.url),
        } : prev.metadata,
      }));

      return result.nodeId;

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        status: 'error',
        isLoading: false,
        error: error.message || 'Import failed',
      }));
      return null;
    }
  }, [state.url, state.isValidUrl]);

  // ----------------------------------------
  // Reset
  // ----------------------------------------
  const reset = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setState({
      url: '',
      status: 'idle',
      isValidUrl: false,
      isLoading: false,
      metadata: null,
      classification: null,
      error: null,
      importedNodeId: null,
    });
  }, []);

  return {
    state,
    setUrl,
    pasteFromClipboard,
    submitImport,
    reset,
  };
}
