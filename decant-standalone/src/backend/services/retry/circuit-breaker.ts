// ============================================================
// Circuit Breaker Pattern Implementation
// Prevents cascading failures by failing fast when service is down
// ============================================================

import { log } from '../../logger/index.js';

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /**
   * Number of consecutive failures before opening the circuit
   */
  failureThreshold: number;

  /**
   * Time in milliseconds to wait before attempting to close the circuit
   */
  resetTimeoutMs: number;

  /**
   * Number of successful requests in half-open state before closing
   */
  halfOpenRequests: number;

  /**
   * Context string for logging
   */
  context?: string;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  stateChangedAt: number;
}

/**
 * Error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(context: string, resetTimeMs: number) {
    super(
      `Circuit breaker is open for "${context}". ` +
        `Service will be available again in ${Math.round(resetTimeMs / 1000)}s`
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit Breaker implementation
 * Protects services from cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private totalRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private stateChangedAt = Date.now();
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(private options: CircuitBreakerOptions) {}

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Async function to execute
   * @returns Result of the function execution
   * @throws CircuitBreakerOpenError if circuit is open
   * @throws Original error if function fails
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'open') {
      const timeSinceOpen = Date.now() - this.stateChangedAt;

      if (timeSinceOpen >= this.options.resetTimeoutMs) {
        // Move to half-open state
        this.transitionTo('half-open');
      } else {
        // Circuit is still open, fail fast
        const resetTimeMs = this.options.resetTimeoutMs - timeSinceOpen;
        log.debug('Circuit breaker is open, rejecting request', {
          context: this.options.context,
          state: this.state,
          resetTimeMs,
          module: 'circuit-breaker',
        });
        throw new CircuitBreakerOpenError(
          this.options.context || 'service',
          resetTimeMs
        );
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    // If in half-open state, check if we should close
    if (this.state === 'half-open') {
      if (this.consecutiveSuccesses >= this.options.halfOpenRequests) {
        // Success threshold met, close the circuit
        this.transitionTo('closed');
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();

    log.debug('Circuit breaker recorded failure', {
      context: this.options.context,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.options.failureThreshold,
      error: error instanceof Error ? error.message : String(error),
      module: 'circuit-breaker',
    });

    // If in half-open state, one failure reopens the circuit
    if (this.state === 'half-open') {
      this.transitionTo('open');
      return;
    }

    // If in closed state, check if we should open
    if (this.state === 'closed') {
      if (this.consecutiveFailures >= this.options.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.stateChangedAt = Date.now();

    log.info('Circuit breaker state changed', {
      context: this.options.context,
      oldState,
      newState,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      module: 'circuit-breaker',
    });

    // Clear any existing reset timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    // If transitioning to open, schedule transition to half-open
    if (newState === 'open') {
      this.resetTimer = setTimeout(() => {
        this.transitionTo('half-open');
      }, this.options.resetTimeoutMs);
    }

    // Reset consecutive counters on state change
    if (newState === 'closed') {
      this.consecutiveFailures = 0;
    }
    if (newState === 'half-open') {
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.stateChangedAt = Date.now();

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    log.info('Circuit breaker manually reset', {
      context: this.options.context,
      module: 'circuit-breaker',
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}

/**
 * Preset circuit breaker configurations
 */
export const CircuitBreakerPresets = {
  /**
   * Sensitive breaker that opens quickly (5 failures, 30s timeout)
   */
  SENSITIVE: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenRequests: 2,
  } as CircuitBreakerOptions,

  /**
   * Standard breaker for most services (10 failures, 60s timeout)
   */
  STANDARD: {
    failureThreshold: 10,
    resetTimeoutMs: 60000,
    halfOpenRequests: 3,
  } as CircuitBreakerOptions,

  /**
   * Tolerant breaker for unreliable services (20 failures, 120s timeout)
   */
  TOLERANT: {
    failureThreshold: 20,
    resetTimeoutMs: 120000,
    halfOpenRequests: 5,
  } as CircuitBreakerOptions,
};

/**
 * Circuit breaker registry for managing multiple breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a named service
   */
  getOrCreate(
    name: string,
    options?: CircuitBreakerOptions
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({
        ...CircuitBreakerPresets.STANDARD,
        ...options,
        context: name,
      });
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Cleanup all circuit breakers
   */
  destroyAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

// Global circuit breaker registry
const globalRegistry = new CircuitBreakerRegistry();

/**
 * Get the global circuit breaker registry
 */
export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
  return globalRegistry;
}
