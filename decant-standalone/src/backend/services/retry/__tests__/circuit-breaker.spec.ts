// ============================================================
// Circuit Breaker Tests
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  CircuitBreakerPresets,
} from '../circuit-breaker.js';

describe('Circuit Breaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CircuitBreaker', () => {
    it('should start in closed state', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      expect(breaker.getState()).toBe('closed');
      expect(breaker.getStats().state).toBe('closed');
    });

    it('should allow successful calls in closed state', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const fn = vi.fn().mockResolvedValue('success');
      const result = await breaker.call(fn);

      expect(result).toBe('success');
      expect(breaker.getStats().successes).toBe(1);
    });

    it('should open after threshold failures', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const error = new Error('Service error');
      const fn = vi.fn().mockRejectedValue(error);

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await expect(breaker.call(fn)).rejects.toThrow('Service error');
      }

      expect(breaker.getState()).toBe('open');
      expect(breaker.getStats().consecutiveFailures).toBe(3);
    });

    it('should reject requests when open', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 5000,
        halfOpenRequests: 2,
        context: 'test-service',
      });

      const error = new Error('Service error');
      const fn = vi.fn().mockRejectedValue(error);

      // Open the circuit
      await expect(breaker.call(fn)).rejects.toThrow();
      await expect(breaker.call(fn)).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      // Next call should fail fast
      await expect(breaker.call(fn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(fn).toHaveBeenCalledTimes(2); // Should not call fn again
    });

    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers();

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const error = new Error('Service error');
      const fn = vi.fn().mockRejectedValue(error);

      // Open the circuit
      await expect(breaker.call(fn)).rejects.toThrow();
      await expect(breaker.call(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      expect(breaker.getState()).toBe('half-open');

      vi.useRealTimers();
    });

    it('should close after successful half-open requests', async () => {
      vi.useFakeTimers();

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const error = new Error('Service error');
      const failFn = vi.fn().mockRejectedValue(error);
      const successFn = vi.fn().mockResolvedValue('success');

      // Open the circuit
      await expect(breaker.call(failFn)).rejects.toThrow();
      await expect(breaker.call(failFn)).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);
      expect(breaker.getState()).toBe('half-open');

      // Succeed twice to close
      await breaker.call(successFn);
      expect(breaker.getState()).toBe('half-open');

      await breaker.call(successFn);
      expect(breaker.getState()).toBe('closed');

      vi.useRealTimers();
    });

    it('should reopen on failure in half-open state', async () => {
      vi.useFakeTimers();

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const error = new Error('Service error');
      const fn = vi.fn().mockRejectedValue(error);

      // Open the circuit
      await expect(breaker.call(fn)).rejects.toThrow();
      await expect(breaker.call(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);
      expect(breaker.getState()).toBe('half-open');

      // Fail once should reopen
      await expect(breaker.call(fn)).rejects.toThrow('Service error');
      expect(breaker.getState()).toBe('open');

      vi.useRealTimers();
    });

    it('should track statistics correctly', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const successFn = vi.fn().mockResolvedValue('success');
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));

      // 3 successes
      await breaker.call(successFn);
      await breaker.call(successFn);
      await breaker.call(successFn);

      // 2 failures
      await expect(breaker.call(failFn)).rejects.toThrow();
      await expect(breaker.call(failFn)).rejects.toThrow();

      const stats = breaker.getStats();
      expect(stats.successes).toBe(3);
      expect(stats.failures).toBe(2);
      expect(stats.totalRequests).toBe(5);
      expect(stats.consecutiveFailures).toBe(2);
      expect(stats.consecutiveSuccesses).toBe(0);
    });

    it('should reset correctly', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const error = new Error('Service error');
      const fn = vi.fn().mockRejectedValue(error);

      // Open the circuit
      await expect(breaker.call(fn)).rejects.toThrow();
      await expect(breaker.call(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      // Manual reset
      breaker.reset();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getStats().consecutiveFailures).toBe(0);
    });

    it('should cleanup timers on destroy', () => {
      vi.useFakeTimers();

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      breaker.destroy();

      // Should not crash when advancing timers
      vi.advanceTimersByTime(1000);

      vi.useRealTimers();
    });
  });

  describe('CircuitBreakerRegistry', () => {
    let registry: CircuitBreakerRegistry;

    beforeEach(() => {
      registry = new CircuitBreakerRegistry();
    });

    afterEach(() => {
      registry.destroyAll();
    });

    it('should create and retrieve circuit breakers', () => {
      const breaker1 = registry.getOrCreate('service1');
      const breaker2 = registry.getOrCreate('service2');
      const breaker1Again = registry.getOrCreate('service1');

      expect(breaker1).toBe(breaker1Again);
      expect(breaker1).not.toBe(breaker2);
    });

    it('should use custom options', () => {
      const breaker = registry.getOrCreate('service', {
        failureThreshold: 10,
        resetTimeoutMs: 5000,
        halfOpenRequests: 3,
      });

      expect(breaker).toBeDefined();
      expect(breaker.getState()).toBe('closed');
    });

    it('should get all stats', async () => {
      const breaker1 = registry.getOrCreate('service1');
      const breaker2 = registry.getOrCreate('service2');

      const fn = vi.fn().mockResolvedValue('success');
      await breaker1.call(fn);
      await breaker2.call(fn);
      await breaker2.call(fn);

      const stats = registry.getAllStats();

      expect(stats.service1.successes).toBe(1);
      expect(stats.service2.successes).toBe(2);
    });

    it('should reset all circuit breakers', async () => {
      const breaker1 = registry.getOrCreate('service1', {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const breaker2 = registry.getOrCreate('service2', {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });

      const error = new Error('fail');
      const fn = vi.fn().mockRejectedValue(error);

      // Open both circuits
      await expect(breaker1.call(fn)).rejects.toThrow();
      await expect(breaker1.call(fn)).rejects.toThrow();
      await expect(breaker2.call(fn)).rejects.toThrow();
      await expect(breaker2.call(fn)).rejects.toThrow();

      expect(breaker1.getState()).toBe('open');
      expect(breaker2.getState()).toBe('open');

      // Reset all
      registry.resetAll();

      expect(breaker1.getState()).toBe('closed');
      expect(breaker2.getState()).toBe('closed');
    });

    it('should destroy all circuit breakers', () => {
      registry.getOrCreate('service1');
      registry.getOrCreate('service2');
      registry.getOrCreate('service3');

      const statsBefore = registry.getAllStats();
      expect(Object.keys(statsBefore)).toHaveLength(3);

      registry.destroyAll();

      const statsAfter = registry.getAllStats();
      expect(Object.keys(statsAfter)).toHaveLength(0);
    });
  });

  describe('CircuitBreakerPresets', () => {
    it('should have SENSITIVE preset', () => {
      expect(CircuitBreakerPresets.SENSITIVE).toEqual({
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        halfOpenRequests: 2,
      });
    });

    it('should have STANDARD preset', () => {
      expect(CircuitBreakerPresets.STANDARD).toEqual({
        failureThreshold: 10,
        resetTimeoutMs: 60000,
        halfOpenRequests: 3,
      });
    });

    it('should have TOLERANT preset', () => {
      expect(CircuitBreakerPresets.TOLERANT).toEqual({
        failureThreshold: 20,
        resetTimeoutMs: 120000,
        halfOpenRequests: 5,
      });
    });
  });
});
