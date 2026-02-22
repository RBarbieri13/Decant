// ============================================================
// Chrome Extension Types
// ============================================================

export interface BrowserTab {
  id: number;
  url: string;
  title: string;
  favIconUrl: string;
  domain: string;
  selected: boolean;
  status: TabImportStatus;
  error?: string;
}

export type TabImportStatus =
  | 'idle'
  | 'importing'
  | 'success'
  | 'failed'
  | 'duplicate'
  | 'filtered';

export interface ConnectionState {
  connected: boolean;
  checking: boolean;
  appVersion?: string;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  data?: {
    id: string;
    title: string;
    classification?: {
      segment: string;
      category: string;
      contentType: string;
    };
  };
  error?: string;
}

export interface BatchImportResult {
  success: boolean;
  data?: {
    batchId: string;
    total: number;
    queued: number;
    skipped: number;
  };
  error?: string;
}

export type SelectionMode = 'all' | 'none' | 'current';
