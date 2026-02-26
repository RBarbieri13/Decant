// ============================================================
// Real-Time Service - Queue Status & Node Enrichment Tracking
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

// ============================================================
// Types
// ============================================================

export interface QueueStatus {
  pending: number;
  processing: number;
  complete: number;
  failed: number;
  isRunning: boolean;
}

export interface JobDetail {
  id: string;
  nodeId: string;
  phase: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface JobForNodeResponse {
  job: JobDetail | null;
}

// SSE Event Types
export interface EnrichmentCompleteEvent {
  type: 'enrichment_complete';
  nodeId: string;
  success: boolean;
  timestamp: string;
  errorMessage?: string;
  hierarchyUpdates?: {
    segmentCode?: string;
    categoryCode?: string;
    contentTypeCode?: string;
    title?: string;
    functionCode?: string;
    organizationCode?: string;
  };
}

export interface QueueStatusEvent {
  type: 'queue_status';
  pending: number;
  processing: number;
  complete: number;
  failed: number;
  timestamp: string;
}

export interface SSEConnectedEvent {
  timestamp: string;
}

export interface SSEPingEvent {
  timestamp: string;
}

// Batch Import SSE Event Types
import type {
  BatchImportItemStatus,
  AIClassification,
  BatchImportStats,
} from '../../shared/types';

export interface BatchImportProgressEvent {
  type: 'batch_import_progress';
  batchId: string;
  itemId: string;
  url: string;
  status: BatchImportItemStatus;
  progress: number;
  nodeId?: string;
  title?: string;
  favicon?: string;
  classification?: AIClassification;
  error?: string;
}

export interface BatchImportCompleteEvent {
  type: 'batch_import_complete';
  batchId: string;
  stats: BatchImportStats;
}

export type SSEEvent = EnrichmentCompleteEvent | QueueStatusEvent | BatchImportProgressEvent | BatchImportCompleteEvent;

// ============================================================
// Queue API
// ============================================================

export const queueAPI = {
  /**
   * Get overall queue statistics
   */
  async getStatus(): Promise<QueueStatus> {
    const res = await fetchWithAuth(`${API_BASE}/queue/status`);
    if (!res.ok) throw new Error('Failed to fetch queue status');
    return res.json();
  },

  /**
   * Get job status for a specific node
   */
  async getJobForNode(nodeId: string): Promise<JobForNodeResponse> {
    const res = await fetchWithAuth(`${API_BASE}/queue/jobs/${nodeId}`);
    if (!res.ok) throw new Error('Failed to fetch job for node');
    return res.json();
  },

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetchWithAuth(`${API_BASE}/queue/retry/${jobId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to retry job');
    return res.json();
  },
};

// ============================================================
// Enrichment Tracker
// ============================================================

export class EnrichmentTracker {
  private pendingNodes = new Set<string>();
  private listeners = new Map<string, Set<(job: JobDetail | null) => void>>();

  /**
   * Mark a node as pending enrichment
   */
  addPendingNode(nodeId: string): void {
    this.pendingNodes.add(nodeId);
  }

  /**
   * Remove a node from pending enrichment
   */
  removePendingNode(nodeId: string): void {
    this.pendingNodes.delete(nodeId);
  }

  /**
   * Check if a node has pending enrichment
   */
  isPending(nodeId: string): boolean {
    return this.pendingNodes.has(nodeId);
  }

  /**
   * Get all pending node IDs
   */
  getPendingNodes(): string[] {
    return Array.from(this.pendingNodes);
  }

  /**
   * Subscribe to updates for a specific node
   */
  subscribe(nodeId: string, callback: (job: JobDetail | null) => void): () => void {
    if (!this.listeners.has(nodeId)) {
      this.listeners.set(nodeId, new Set());
    }
    this.listeners.get(nodeId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(nodeId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(nodeId);
        }
      }
    };
  }

  /**
   * Notify all listeners for a node
   */
  notify(nodeId: string, job: JobDetail | null): void {
    const listeners = this.listeners.get(nodeId);
    if (listeners) {
      listeners.forEach((callback) => callback(job));
    }
  }

  /**
   * Check status of all pending nodes
   */
  async checkPendingNodes(): Promise<void> {
    const nodes = this.getPendingNodes();

    for (const nodeId of nodes) {
      try {
        const response = await queueAPI.getJobForNode(nodeId);
        const job = response.job;

        // Notify listeners
        this.notify(nodeId, job);

        // If job is complete or doesn't exist, remove from pending
        if (!job || job.status === 'complete') {
          this.removePendingNode(nodeId);
        }
      } catch (error) {
        console.error(`Failed to check job status for node ${nodeId}:`, error);
      }
    }
  }

  /**
   * Clear all pending nodes
   */
  clear(): void {
    this.pendingNodes.clear();
  }

  /**
   * Get count of pending nodes
   */
  get count(): number {
    return this.pendingNodes.size;
  }
}

// ============================================================
// SSE Client
// ============================================================

export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SSEClientOptions {
  onEnrichmentComplete?: (event: EnrichmentCompleteEvent) => void;
  onQueueStatus?: (event: QueueStatusEvent) => void;
  onBatchImportProgress?: (event: BatchImportProgressEvent) => void;
  onBatchImportComplete?: (event: BatchImportCompleteEvent) => void;
  onConnectionChange?: (state: SSEConnectionState) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * SSE Client for real-time notifications from the backend
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private options: Required<SSEClientOptions>;
  private connectionState: SSEConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(options: SSEClientOptions = {}) {
    this.options = {
      onEnrichmentComplete: options.onEnrichmentComplete || (() => {}),
      onQueueStatus: options.onQueueStatus || (() => {}),
      onBatchImportProgress: options.onBatchImportProgress || (() => {}),
      onBatchImportComplete: options.onBatchImportComplete || (() => {}),
      onConnectionChange: options.onConnectionChange || (() => {}),
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
    };
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      console.warn('SSE client already connected');
      return;
    }

    this.setConnectionState('connecting');

    try {
      const token = getAccessToken();
      const url = token
        ? `${API_BASE}/events?token=${encodeURIComponent(token)}`
        : `${API_BASE}/events`;
      this.eventSource = new EventSource(url);

      // Handle connection open
      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
      };

      // Handle connection error
      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.setConnectionState('error');
        this.handleDisconnect();
      };

      // Handle 'connected' event
      this.eventSource.addEventListener('connected', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as SSEConnectedEvent;
          console.log('SSE connected at:', data.timestamp);
        } catch (e) {
          console.error('Failed to parse connected event:', e);
        }
      });

      // Handle 'ping' event (keep-alive)
      this.eventSource.addEventListener('ping', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as SSEPingEvent;
          console.debug('SSE ping received at:', data.timestamp);
        } catch (e) {
          console.error('Failed to parse ping event:', e);
        }
      });

      // Handle 'enrichment_complete' event
      this.eventSource.addEventListener('enrichment_complete', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as EnrichmentCompleteEvent;
          console.log('Enrichment complete event:', data);
          this.options.onEnrichmentComplete(data);
        } catch (e) {
          console.error('Failed to parse enrichment_complete event:', e);
        }
      });

      // Handle 'queue_status' event
      this.eventSource.addEventListener('queue_status', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as QueueStatusEvent;
          console.log('Queue status event:', data);
          this.options.onQueueStatus(data);
        } catch (e) {
          console.error('Failed to parse queue_status event:', e);
        }
      });

      // Handle 'batch_import_progress' event
      this.eventSource.addEventListener('batch_import_progress', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as BatchImportProgressEvent;
          console.log('Batch import progress event:', data);
          this.options.onBatchImportProgress(data);
        } catch (e) {
          console.error('Failed to parse batch_import_progress event:', e);
        }
      });

      // Handle 'batch_import_complete' event
      this.eventSource.addEventListener('batch_import_complete', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as BatchImportCompleteEvent;
          console.log('Batch import complete event:', data);
          this.options.onBatchImportComplete(data);
        } catch (e) {
          console.error('Failed to parse batch_import_complete event:', e);
        }
      });
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      this.setConnectionState('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setConnectionState('disconnected');
    console.log('SSE client disconnected');
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.scheduleReconnect();
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max SSE reconnection attempts reached');
      this.setConnectionState('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectInterval * Math.min(this.reconnectAttempts, 5);

    console.log(`Scheduling SSE reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: SSEConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.options.onConnectionChange(state);
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): SSEConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
}

// ============================================================
// Singleton Instances
// ============================================================

let enrichmentTracker: EnrichmentTracker | null = null;
let sseClient: SSEClient | null = null;

export function getEnrichmentTracker(): EnrichmentTracker {
  if (!enrichmentTracker) {
    enrichmentTracker = new EnrichmentTracker();
  }
  return enrichmentTracker;
}

export function getSSEClient(): SSEClient | null {
  return sseClient;
}

/**
 * Initialize the SSE client with handlers
 */
export function initializeSSEClient(options: SSEClientOptions): SSEClient {
  if (sseClient) {
    sseClient.disconnect();
  }

  sseClient = new SSEClient(options);
  sseClient.connect();

  return sseClient;
}

/**
 * Create and connect an SSE client that integrates with the EnrichmentTracker
 */
export function createIntegratedSSEClient(
  onNodeRefresh: (nodeId: string, hierarchyUpdates?: EnrichmentCompleteEvent['hierarchyUpdates']) => void,
  onEnrichmentComplete?: (event: EnrichmentCompleteEvent) => void,
  onConnectionChange?: (state: SSEConnectionState) => void
): SSEClient {
  const tracker = getEnrichmentTracker();

  return initializeSSEClient({
    onEnrichmentComplete: (event) => {
      // Remove from pending tracking
      tracker.removePendingNode(event.nodeId);

      // Notify any direct subscribers
      tracker.notify(event.nodeId, null);

      // Trigger node refresh callback with hierarchy updates
      onNodeRefresh(event.nodeId, event.hierarchyUpdates);

      // Call external enrichment complete handler (for toasts)
      if (onEnrichmentComplete) {
        onEnrichmentComplete(event);
      }

      console.log(
        `Enrichment ${event.success ? 'completed' : 'failed'} for node ${event.nodeId}`,
        event.hierarchyUpdates ? 'with hierarchy updates' : ''
      );
    },
    onConnectionChange: onConnectionChange,
  });
}
