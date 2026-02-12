// ============================================================
// API Service - Frontend HTTP Client
// ============================================================

const API_BASE = '/api';

export interface Node {
  id: string;
  title: string;
  url: string;
  source_domain: string;
  date_added: string;
  company?: string;
  phrase_description?: string;
  short_description?: string;
  logo_url?: string;
  ai_summary?: string;
  extracted_fields?: Record<string, any>;
  metadata_tags?: string[];
  metadata_codes?: Array<{ type: string; code: string; confidence?: number }>;
  key_concepts?: string[];
  function_parent_id?: string | null;
  organization_parent_id?: string | null;
  segment_code?: string | null;
  category_code?: string | null;
  content_type_code?: string | null;
  metadataCodes?: Record<string, string[]> | null;
}

export interface RelatedNode {
  node: {
    id: string;
    title: string;
    url: string;
    segment: string;
    category: string;
    contentType: string;
    logo_url?: string;
    phrase_description?: string;
  };
  similarityScore: number; // 0-100 percentage
  sharedAttributes: string[]; // The metadata codes they share
}

export interface RelatedNodesResponse {
  nodeId: string;
  related: RelatedNode[];
}

export interface Backlink {
  node: {
    id: string;
    title: string;
    segment: string;
    category: string;
    contentType: string;
    logo_url?: string;
    phrase_description?: string;
  };
  referenceType: 'similar' | 'sibling' | 'related' | 'manual';
  strength: number; // 0-100
  sharedAttributes: string[];
  computedAt: string;
}

export interface BacklinksResponse {
  nodeId: string;
  backlinks: Backlink[];
  grouped: Record<string, Backlink[]>;
  total: number;
}

// ============================================================
// Pagination Types
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ============================================================
// Nodes API
// ============================================================

export const nodesAPI = {
  /**
   * Get all nodes (backward compatible - no pagination)
   */
  async getAll(): Promise<Node[]> {
    const res = await fetch(`${API_BASE}/nodes`);
    if (!res.ok) throw new Error('Failed to fetch nodes');
    return res.json();
  },

  /**
   * Get nodes with pagination
   * @param params - Pagination parameters (page and limit)
   * @returns Paginated response with nodes and pagination metadata
   */
  async getPaginated(params?: PaginationParams): Promise<PaginatedResponse<Node>> {
    const urlParams = new URLSearchParams();
    if (params?.page !== undefined) {
      urlParams.append('page', String(params.page));
    }
    if (params?.limit !== undefined) {
      urlParams.append('limit', String(params.limit));
    }

    const queryString = urlParams.toString();
    const url = queryString ? `${API_BASE}/nodes?${queryString}` : `${API_BASE}/nodes?page=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch nodes');
    return res.json();
  },

  async get(id: string): Promise<Node> {
    const res = await fetch(`${API_BASE}/nodes/${id}`);
    if (!res.ok) throw new Error('Failed to fetch node');
    return res.json();
  },

  async create(data: Partial<Node>): Promise<Node> {
    const res = await fetch(`${API_BASE}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create node');
    return res.json();
  },

  async update(id: string, data: Partial<Node>): Promise<Node> {
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update node');
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete node');
  },

  async getRelated(id: string, limit: number = 5): Promise<RelatedNodesResponse> {
    const res = await fetch(`${API_BASE}/nodes/${id}/related?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch related nodes');
    return res.json();
  },

  async getBacklinks(id: string, limit: number = 10): Promise<BacklinksResponse> {
    const res = await fetch(`${API_BASE}/nodes/${id}/backlinks?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch backlinks');
    return res.json();
  },
};

// ============================================================
// Hierarchy API
// ============================================================

export const hierarchyAPI = {
  async getTree(view: 'function' | 'organization'): Promise<any> {
    const res = await fetch(`${API_BASE}/hierarchy/tree/${view}`);
    if (!res.ok) throw new Error(`Failed to fetch ${view} tree`);
    return res.json();
  },

  async getSegments(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/hierarchy/segments`);
    if (!res.ok) throw new Error('Failed to fetch segments');
    return res.json();
  },

  async getOrganizations(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/hierarchy/organizations`);
    if (!res.ok) throw new Error('Failed to fetch organizations');
    return res.json();
  },
};

// ============================================================
// Search API
// ============================================================

export const searchAPI = {
  /**
   * Search nodes (backward compatible - no pagination)
   */
  async search(query: string, filters?: any): Promise<Node[]> {
    const params = new URLSearchParams({ q: query });
    if (filters) {
      params.append('filters', JSON.stringify(filters));
    }
    const res = await fetch(`${API_BASE}/search?${params}`);
    if (!res.ok) throw new Error('Failed to search');
    return res.json();
  },

  /**
   * Search nodes with pagination
   * @param query - Search query string
   * @param pagination - Pagination parameters
   * @param filters - Optional search filters
   * @returns Paginated response with search results and pagination metadata
   */
  async searchPaginated(
    query: string,
    pagination?: PaginationParams,
    filters?: any
  ): Promise<PaginatedResponse<Node>> {
    const params = new URLSearchParams({ q: query });

    if (pagination?.page !== undefined) {
      params.append('page', String(pagination.page));
    }
    if (pagination?.limit !== undefined) {
      params.append('limit', String(pagination.limit));
    }
    if (filters) {
      params.append('filters', JSON.stringify(filters));
    }

    // Ensure at least page param is set to trigger paginated response
    if (pagination?.page === undefined && pagination?.limit === undefined) {
      params.append('page', '1');
    }

    const res = await fetch(`${API_BASE}/search?${params}`);
    if (!res.ok) throw new Error('Failed to search');
    return res.json();
  },
};

// ============================================================
// Import API
// ============================================================

export interface ImportResult {
  success: boolean;
  nodeId?: string;
  node?: Node;
  classification?: {
    segment: string;
    category: string;
    contentType: string;
    organization?: string;
    confidence?: number;
  };
  phase2?: {
    queued: boolean;
    jobId?: string;
  };
  error?: string;
}

export const importAPI = {
  async importUrl(url: string): Promise<ImportResult> {
    const res = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Import failed' };
    }
    return data;
  },
};

// ============================================================
// Merge API
// ============================================================

export const mergeAPI = {
  async merge(primaryId: string, secondaryId: string, options: { keepMetadata?: boolean; appendSummary?: boolean }): Promise<Node> {
    const res = await fetch(`${API_BASE}/nodes/${primaryId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secondaryId, options }),
    });
    if (!res.ok) throw new Error('Failed to merge nodes');
    return res.json();
  },
};

// ============================================================
// Hierarchy API - Move operations
// ============================================================

export const moveAPI = {
  async moveNode(nodeId: string, targetParentId: string, targetHierarchy: 'function' | 'organization'): Promise<Node> {
    const res = await fetch(`${API_BASE}/nodes/${nodeId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetParentId, targetHierarchy }),
    });
    if (!res.ok) throw new Error('Failed to move node');
    return res.json();
  },
};

// ============================================================
// Settings API
// ============================================================

export const settingsAPI = {
  async setApiKey(apiKey: string): Promise<void> {
    const res = await fetch(`${API_BASE}/settings/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) throw new Error('Failed to set API key');
  },

  async getApiKeyStatus(): Promise<{ configured: boolean }> {
    const res = await fetch(`${API_BASE}/settings/api-key/status`);
    if (!res.ok) throw new Error('Failed to get API key status');
    return res.json();
  },
};

// ============================================================
// Audit API - Hierarchy code change history
// ============================================================

export type HierarchyType = 'function' | 'organization';
export type ChangeType = 'created' | 'updated' | 'moved' | 'restructured';
export type TriggeredBy = 'import' | 'user_move' | 'restructure' | 'merge';

export interface AuditChange {
  id: string;
  hierarchyType: HierarchyType;
  oldCode: string | null;
  newCode: string;
  changeType: ChangeType;
  reason?: string;
  triggeredBy: TriggeredBy;
  changedAt: string;
  relatedNodes?: Array<{ id: string; title: string }>;
  metadata?: Record<string, unknown>;
}

export interface NodeAuditHistoryResponse {
  nodeId: string;
  changes: AuditChange[];
}

export interface GetNodeHistoryOptions {
  hierarchyType?: HierarchyType;
  limit?: number;
  offset?: number;
}

export interface RecentAuditChange extends AuditChange {
  nodeId: string;
  nodeTitle: string;
}

export interface RecentAuditChangesResponse {
  changes: RecentAuditChange[];
  total: number;
}

export interface AuditStatistics {
  totalChanges: number;
  byType: Record<ChangeType, number>;
  byTrigger: Record<TriggeredBy, number>;
  byHierarchy: Record<HierarchyType, number>;
}

// ============================================================
// Batch Import API
// ============================================================

import type {
  BatchImportOptions,
  BatchImportState,
  BatchImportItem,
  BatchImportStats,
} from '../../shared/types';

export interface BatchImportStartResult {
  success: boolean;
  batchId?: string;
  itemCount?: number;
  status?: string;
  error?: string;
}

export interface BatchImportStatusResult {
  success: boolean;
  batchId?: string;
  status?: BatchImportState['status'];
  items?: BatchImportItem[];
  stats?: BatchImportStats;
  options?: BatchImportOptions;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export const batchImportAPI = {
  /**
   * Start a batch import of multiple URLs
   */
  async start(urls: string[], options?: Partial<BatchImportOptions>): Promise<BatchImportStartResult> {
    const res = await fetch(`${API_BASE}/batch-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, options }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to start batch import' };
    }
    return data;
  },

  /**
   * Cancel an active batch import
   */
  async cancel(batchId: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/batch-import/${batchId}/cancel`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to cancel batch import' };
    }
    return data;
  },

  /**
   * Get the status of a batch import
   */
  async getStatus(batchId: string): Promise<BatchImportStatusResult> {
    const res = await fetch(`${API_BASE}/batch-import/${batchId}`);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to get batch status' };
    }
    return data;
  },
};

export interface ReclassifyResult {
  message: string;
  durationMs: number;
  totalNodes: number;
  changedNodes: number;
  segmentDistribution: Record<string, number>;
  results: Array<{
    nodeId: string;
    title: string;
    oldSegment: string | null;
    newSegment: string;
    oldCategory: string | null;
    newCategory: string;
    changed: boolean;
    confidence: number;
  }>;
}

export const reclassifyAPI = {
  async reclassifyAll(): Promise<ReclassifyResult> {
    const res = await fetch(`${API_BASE}/nodes/reclassify`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reclassify nodes');
    return res.json();
  },

  async reclassifyNode(id: string): Promise<{ message: string; classification: Record<string, unknown>; node: Node }> {
    const res = await fetch(`${API_BASE}/nodes/${id}/reclassify`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reclassify node');
    return res.json();
  },
};

export const auditAPI = {
  /**
   * Get audit history for a specific node
   */
  async getNodeHistory(
    nodeId: string,
    options?: GetNodeHistoryOptions
  ): Promise<NodeAuditHistoryResponse> {
    const params = new URLSearchParams();
    if (options?.hierarchyType) {
      params.append('hierarchyType', options.hierarchyType);
    }
    if (options?.limit !== undefined) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.append('offset', String(options.offset));
    }

    const queryString = params.toString();
    const url = queryString
      ? `${API_BASE}/nodes/${nodeId}/history?${queryString}`
      : `${API_BASE}/nodes/${nodeId}/history`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch node history');
    return res.json();
  },

  /**
   * Get recent changes across all nodes
   */
  async getRecentChanges(limit: number = 50): Promise<RecentAuditChangesResponse> {
    const res = await fetch(`${API_BASE}/audit/recent?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch recent changes');
    return res.json();
  },

  /**
   * Get audit statistics
   */
  async getStatistics(): Promise<AuditStatistics> {
    const res = await fetch(`${API_BASE}/audit/stats`);
    if (!res.ok) throw new Error('Failed to fetch audit statistics');
    return res.json();
  },
};
