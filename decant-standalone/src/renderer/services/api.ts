// ============================================================
// API Service - Frontend HTTP Client
// ============================================================

const API_BASE = '/api';

function getAccessToken(): string | null {
  try {
    return localStorage.getItem('decant_access_token');
  } catch {
    return null;
  }
}

function withAuthHeaders(headers?: HeadersInit): Headers {
  const h = new Headers(headers);
  const token = getAccessToken();
  if (token) {
    h.set('Authorization', `Bearer ${token}`);
  }
  return h;
}

async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: withAuthHeaders(init.headers),
  });
}

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
  subcategory_label?: string | null;
  function_tags?: string | null;
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
    const res = await fetchWithAuth(`${API_BASE}/nodes`);
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

    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch nodes');
    return res.json();
  },

  async get(id: string): Promise<Node> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${id}`);
    if (!res.ok) throw new Error('Failed to fetch node');
    return res.json();
  },

  async create(data: Partial<Node>): Promise<Node> {
    const res = await fetchWithAuth(`${API_BASE}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create node');
    return res.json();
  },

  async update(id: string, data: Partial<Node>): Promise<Node> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update node');
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete node');
  },

  async getRelated(id: string, limit: number = 5): Promise<RelatedNodesResponse> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${id}/related?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch related nodes');
    return res.json();
  },

  async getBacklinks(id: string, limit: number = 10): Promise<BacklinksResponse> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${id}/backlinks?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch backlinks');
    return res.json();
  },
};

// ============================================================
// Hierarchy API
// ============================================================

export const hierarchyAPI = {
  async getTree(_view?: 'function' | 'organization'): Promise<any> {
    // Dynamic hierarchy — single tree, view parameter ignored
    const res = await fetchWithAuth(`${API_BASE}/hierarchy/dynamic/tree`);
    if (!res.ok) {
      // Fallback to legacy endpoint if dynamic not available
      const legacyRes = await fetchWithAuth(`${API_BASE}/hierarchy/tree/${_view || 'function'}`);
      if (!legacyRes.ok) throw new Error('Failed to fetch tree');
      return legacyRes.json();
    }
    // Dynamic endpoint returns { root: [...] } — pass through as-is
    return res.json();
  },

  async getSegments(): Promise<any[]> {
    const res = await fetchWithAuth(`${API_BASE}/hierarchy/segments`);
    if (!res.ok) throw new Error('Failed to fetch segments');
    return res.json();
  },

  async getOrganizations(): Promise<any[]> {
    const res = await fetchWithAuth(`${API_BASE}/hierarchy/organizations`);
    if (!res.ok) throw new Error('Failed to fetch organizations');
    return res.json();
  },

  async getTaxonomyLabels(): Promise<{ segments: Record<string, string>; categories: Record<string, Record<string, string>> }> {
    const res = await fetchWithAuth(`${API_BASE}/taxonomy/labels`);
    if (!res.ok) throw new Error('Failed to fetch taxonomy labels');
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
    const res = await fetchWithAuth(`${API_BASE}/search?${params}`);
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

    const res = await fetchWithAuth(`${API_BASE}/search?${params}`);
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
  code?: string;
  details?: {
    existingNodeId?: string;
    existingTitle?: string;
  };
}

export const importAPI = {
  async importUrl(url: string): Promise<ImportResult> {
    const res = await fetchWithAuth(`${API_BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Import failed',
        code: data.code,
        details: data.details,
      };
    }
    return data;
  },
};

// ============================================================
// Merge API
// ============================================================

export const mergeAPI = {
  async merge(primaryId: string, secondaryId: string, options: { keepMetadata?: boolean; appendSummary?: boolean }): Promise<Node> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${primaryId}/merge`, {
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
    const res = await fetchWithAuth(`${API_BASE}/nodes/${nodeId}/move`, {
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
    const res = await fetchWithAuth(`${API_BASE}/settings/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) throw new Error('Failed to set API key');
  },

  async getApiKeyStatus(): Promise<{ configured: boolean }> {
    const res = await fetchWithAuth(`${API_BASE}/settings/api-key/status`);
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
    const res = await fetchWithAuth(`${API_BASE}/batch-import`, {
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
    const res = await fetchWithAuth(`${API_BASE}/batch-import/${batchId}/cancel`, {
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
    const res = await fetchWithAuth(`${API_BASE}/batch-import/${batchId}`);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to get batch status' };
    }
    return data;
  },
};

// ============================================================
// iMessage API
// ============================================================

export const imessageAPI = {
  /**
   * Extract recent URLs from iMessage self-text thread
   */
  async extractUrls(count = 5): Promise<{ success: boolean; urls: string[]; error?: string }> {
    const res = await fetchWithAuth(`${API_BASE}/imessage/extract-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, urls: [], error: data.error || 'Failed to extract iMessage URLs' };
    }
    return data;
  },
};

// ============================================================
// Admin API
// ============================================================

export const adminAPI = {
  async reEnrichAll(): Promise<{ queued: boolean; count: number }> {
    const res = await fetchWithAuth(`${API_BASE}/admin/enrich-all`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Re-enrich all failed: ${res.statusText}`);
    return res.json();
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
    const res = await fetchWithAuth(`${API_BASE}/nodes/reclassify`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reclassify nodes');
    return res.json();
  },

  async reclassifyNode(id: string): Promise<{ message: string; classification: Record<string, unknown>; node: Node }> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${id}/reclassify`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reclassify node');
    return res.json();
  },

  async getProgress(): Promise<{ isRunning: boolean; total: number; completed: number; failed: number; startedAt: string | null; completedAt: string | null; lastError: string | null }> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/reclassify/progress`);
    if (!res.ok) throw new Error('Failed to get reclassify progress');
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

    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch node history');
    return res.json();
  },

  /**
   * Get recent changes across all nodes
   */
  async getRecentChanges(limit: number = 50): Promise<RecentAuditChangesResponse> {
    const res = await fetchWithAuth(`${API_BASE}/audit/recent?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch recent changes');
    return res.json();
  },

  /**
   * Get audit statistics
   */
  async getStatistics(): Promise<AuditStatistics> {
    const res = await fetchWithAuth(`${API_BASE}/audit/stats`);
    if (!res.ok) throw new Error('Failed to fetch audit statistics');
    return res.json();
  },
};

// ============================================================
// Collections API
// ============================================================

export interface CollectionTreeNode {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
  position: number;
  nodeCount: number;
  children: CollectionTreeNode[];
  createdAt: string;
  updatedAt: string;
}

export const collectionsAPI = {
  async getTree(): Promise<CollectionTreeNode[]> {
    const res = await fetchWithAuth(`${API_BASE}/collections`);
    if (!res.ok) throw new Error('Failed to fetch collections');
    return res.json();
  },

  async create(data: { name: string; icon?: string; color?: string; parentId?: string | null }): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create collection');
    return res.json();
  },

  async update(id: string, data: { name?: string; icon?: string; color?: string; parentId?: string | null; position?: number }): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/collections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update collection');
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/collections/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete collection');
  },

  async reorder(parentId: string | null, orderedIds: string[]): Promise<void> {
    const endpoint = parentId ?? 'root';
    const res = await fetchWithAuth(`${API_BASE}/collections/${endpoint}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) throw new Error('Failed to reorder collections');
  },

  async getNodes(collectionId: string): Promise<string[]> {
    const res = await fetchWithAuth(`${API_BASE}/collections/${collectionId}/nodes`);
    if (!res.ok) throw new Error('Failed to fetch collection nodes');
    return res.json();
  },

  async addNode(collectionId: string, nodeId: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/collections/${collectionId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId }),
    });
    if (!res.ok) throw new Error('Failed to add node to collection');
  },

  async removeNode(collectionId: string, nodeId: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/collections/${collectionId}/nodes/${nodeId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove node from collection');
  },
};

// ============================================================
// User Tags API
// ============================================================

export interface UserTag {
  id: string;
  name: string;
  color: string;
  emblem: string;
  position: number;
  created_at: string;
}

export const userTagsAPI = {
  async getAll(): Promise<UserTag[]> {
    const res = await fetchWithAuth(`${API_BASE}/user-tags`);
    if (!res.ok) throw new Error('Failed to fetch user tags');
    return res.json();
  },

  async create(data: { name: string; color?: string; emblem?: string }): Promise<UserTag> {
    const res = await fetchWithAuth(`${API_BASE}/user-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create tag' }));
      throw new Error(err.error || 'Failed to create tag');
    }
    return res.json();
  },

  async update(id: string, data: { name?: string; color?: string; emblem?: string; position?: number }): Promise<UserTag> {
    const res = await fetchWithAuth(`${API_BASE}/user-tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update tag');
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/user-tags/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete tag');
  },

  async setNodeTags(nodeId: string, tagIds: string[]): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${nodeId}/user-tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds }),
    });
    if (!res.ok) throw new Error('Failed to set node tags');
  },
};

// ============================================================
// Summary API
// ============================================================

export interface NodeSummaryCategory {
  label: string;
  color: 'blue' | 'teal' | 'coral' | 'pink' | 'gray' | 'green' | 'amber' | 'red' | 'purple';
}

export interface NodeSummaryStat {
  label: string;
  value: string;
  color?: 'success' | 'danger' | 'warning' | 'info' | null;
}

export interface NodeSummaryEntity {
  name: string;
  abbreviation: string;
  role: string;
  color: 'blue' | 'teal' | 'coral' | 'pink' | 'gray' | 'green' | 'amber' | 'red' | 'purple';
}

export interface NodeSummaryRelationship {
  from: string;
  to: string;
  label: string;
}

export interface NodeSummaryTimelineItem {
  date: string;
  description: string;
  status: 'complete' | 'active' | 'upcoming';
}

export interface NodeSummaryData {
  category: NodeSummaryCategory;
  title: string;
  summary: string;
  quick_outline: { heading: string; bullets: string[] };
  stats: NodeSummaryStat[];
  entities: NodeSummaryEntity[];
  relationships: NodeSummaryRelationship[];
  timeline: NodeSummaryTimelineItem[];
  tags: string[];
  link_label: string | null;
}

export interface NodeSummaryResponse {
  nodeId: string;
  summary: NodeSummaryData | null;
  exists?: boolean;
  cached?: boolean;
}

export const summaryAPI = {
  /**
   * Get the cached summary for a node
   */
  async get(nodeId: string): Promise<NodeSummaryResponse> {
    const res = await fetchWithAuth(`${API_BASE}/nodes/${nodeId}/summary`);
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  },

  /**
   * Generate or regenerate the AI summary for a node
   * @param nodeId - Node ID
   * @param force - If true, regenerate even if cached summary exists
   */
  async generate(nodeId: string, force: boolean = false): Promise<NodeSummaryResponse> {
    const url = force
      ? `${API_BASE}/nodes/${nodeId}/summary/generate?force=true`
      : `${API_BASE}/nodes/${nodeId}/summary/generate`;
    const res = await fetchWithAuth(url, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Summary generation failed' }));
      throw new Error(err.error || 'Summary generation failed');
    }
    return res.json();
  },
};
