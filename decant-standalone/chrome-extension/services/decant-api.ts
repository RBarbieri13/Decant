// ============================================================
// Decant Local API Client
// Connects to the Decant Express server at localhost:3000
// ============================================================

import { ConnectionState, ImportResult, BatchImportResult, BrowserTab } from '../types/index.js';

const API_BASE = 'http://localhost:3000';
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Makes a request to the Decant local API with timeout support
 */
async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error((errorBody as { error?: string }).error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out — is Decant running?');
    }
    throw error;
  }
}

// ============================================================
// Public API Methods
// ============================================================

/**
 * Check if the Decant desktop app is running and reachable
 */
export async function checkConnection(): Promise<ConnectionState> {
  try {
    const result = await apiRequest<{ success: boolean; app: string; ready: boolean }>(
      '/api/health'
    );

    return {
      connected: result.success && result.ready,
      checking: false,
    };
  } catch (error: unknown) {
    return {
      connected: false,
      checking: false,
      error: error instanceof Error ? error.message : 'Cannot connect to Decant',
    };
  }
}

/**
 * Import a single URL into Decant
 */
export async function importUrl(
  url: string,
  title?: string,
  favicon?: string
): Promise<ImportResult> {
  return apiRequest<ImportResult>('/api/import', {
    method: 'POST',
    body: JSON.stringify({ url, title, favicon, autoClassify: true }),
  });
}

/**
 * Batch import multiple URLs via the existing batch-import route
 */
export async function batchImport(
  tabs: BrowserTab[],
  skipDuplicates: boolean = true
): Promise<BatchImportResult> {
  // The batch-import API expects urls as a plain string array
  const urls = tabs.map(tab => tab.url);

  return apiRequest<BatchImportResult>('/api/batch-import', {
    method: 'POST',
    body: JSON.stringify({
      urls,
      options: {
        autoClassify: true,
        skipDuplicates,
        showInTreeWhenDone: true,
        maxConcurrent: 2,
      },
    }),
  });
}
