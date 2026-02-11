// ============================================================
// Notification Service
// Event-driven notification system for real-time updates
// ============================================================

import { log } from '../../logger/index.js';

// ============================================================
// Event Types
// ============================================================

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

export type NotificationEvent = EnrichmentCompleteEvent | QueueStatusEvent;

export type EventType = NotificationEvent['type'];

// ============================================================
// Notification Service
// ============================================================

type EventCallback<T = NotificationEvent> = (event: T) => void;

/**
 * Notification Service - Simple event emitter pattern for real-time updates
 */
class NotificationService {
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();
  private globalListeners: Set<EventCallback<NotificationEvent>> = new Set();

  /**
   * Subscribe to a specific event type
   * @returns Unsubscribe function
   */
  subscribe<T extends NotificationEvent>(
    eventType: T['type'],
    callback: EventCallback<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    log.debug('Notification subscriber added', {
      eventType,
      listenerCount: this.listeners.get(eventType)!.size,
      module: 'notifications',
    });

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
        log.debug('Notification subscriber removed', {
          eventType,
          listenerCount: listeners.size,
          module: 'notifications',
        });
      }
    };
  }

  /**
   * Subscribe to all events (useful for SSE endpoints)
   * @returns Unsubscribe function
   */
  subscribeAll(callback: EventCallback<NotificationEvent>): () => void {
    this.globalListeners.add(callback);

    log.debug('Global notification subscriber added', {
      globalListenerCount: this.globalListeners.size,
      module: 'notifications',
    });

    return () => {
      this.globalListeners.delete(callback);
      log.debug('Global notification subscriber removed', {
        globalListenerCount: this.globalListeners.size,
        module: 'notifications',
      });
    };
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T extends NotificationEvent>(event: T): void {
    log.debug('Emitting notification event', {
      eventType: event.type,
      module: 'notifications',
    });

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          log.error('Error in notification listener', {
            eventType: event.type,
            error: error instanceof Error ? error.message : String(error),
            module: 'notifications',
          });
        }
      });
    }

    // Notify global listeners
    this.globalListeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        log.error('Error in global notification listener', {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
          module: 'notifications',
        });
      }
    });
  }

  /**
   * Get count of listeners for an event type
   */
  getListenerCount(eventType?: EventType): number {
    if (eventType) {
      return (this.listeners.get(eventType)?.size || 0) + this.globalListeners.size;
    }
    let total = this.globalListeners.size;
    this.listeners.forEach((listeners) => {
      total += listeners.size;
    });
    return total;
  }

  /**
   * Check if there are any listeners
   */
  hasListeners(): boolean {
    return this.globalListeners.size > 0 || this.listeners.size > 0;
  }

  /**
   * Clear all listeners (useful for testing)
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
    log.debug('All notification listeners cleared', { module: 'notifications' });
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let notificationService: NotificationService | null = null;

/**
 * Get the singleton notification service instance
 */
export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService();
  }
  return notificationService;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Emit an enrichment complete event
 */
export function emitEnrichmentComplete(
  nodeId: string,
  success: boolean,
  hierarchyUpdates?: {
    segmentCode?: string;
    categoryCode?: string;
    contentTypeCode?: string;
    title?: string;
    functionCode?: string;
    organizationCode?: string;
  },
  errorMessage?: string
): void {
  const service = getNotificationService();
  service.emit({
    type: 'enrichment_complete',
    nodeId,
    success,
    timestamp: new Date().toISOString(),
    hierarchyUpdates,
    errorMessage,
  });
}

/**
 * Emit a queue status update event
 */
export function emitQueueStatus(stats: {
  pending: number;
  processing: number;
  complete: number;
  failed: number;
}): void {
  const service = getNotificationService();
  service.emit({
    type: 'queue_status',
    ...stats,
    timestamp: new Date().toISOString(),
  });
}
