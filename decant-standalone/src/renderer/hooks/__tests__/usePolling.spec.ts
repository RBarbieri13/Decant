// ============================================================
// usePolling Hook Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePolling } from '../usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with null data and not polling', () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 5000,
        enabled: false,
      })
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should start polling automatically when enabled is true', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 'ok' });

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 5000,
        enabled: true,
      })
    );

    // Wait for initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ status: 'ok' });
    expect(result.current.isPolling).toBe(true);
  });

  it('should poll at regular intervals', async () => {
    const fetcher = vi.fn().mockResolvedValue({ count: 1 });

    renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
      })
    );

    // Initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // First interval
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Second interval
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('should update data on successful fetch', async () => {
    let responseData = { value: 1 };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(responseData));

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
      })
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.error).toBeNull();

    // Update response
    responseData = { value: 2 };

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.data).toEqual({ value: 2 });
  });

  it('should call onSuccess callback on successful fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ result: 'success' });
    const onSuccess = vi.fn();

    renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
        onSuccess,
      })
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(onSuccess).toHaveBeenCalledWith({ result: 'success' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors and call onError callback', async () => {
    const error = new Error('Fetch failed');
    const fetcher = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
        onError,
      })
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.data).toBeNull();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should convert non-Error rejections to Error objects', async () => {
    const fetcher = vi.fn().mockRejectedValue('String error');
    const onError = vi.fn();

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
        onError,
      })
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('String error');
    expect(onError).toHaveBeenCalled();
  });

  it('should clear error on successful fetch after error', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValue({ status: 'recovered' });

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
      })
    );

    // First fetch fails
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.error).toBeTruthy();

    // Second fetch succeeds
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ status: 'recovered' });
  });

  it('should stop polling when stop() is called', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
      })
    );

    // Initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Stop polling
    act(() => {
      result.current.stop();
    });

    expect(result.current.isPolling).toBe(false);

    // Advance time - should not fetch
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(fetcher).toHaveBeenCalledTimes(1); // Still only 1
  });

  it('should start polling when start() is called', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: false,
      })
    );

    expect(result.current.isPolling).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();

    // Start polling
    act(() => {
      result.current.start();
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.isPolling).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should not start multiple times when start() is called repeatedly', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: false,
      })
    );

    act(() => {
      result.current.start();
      result.current.start();
      result.current.start();
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should allow manual refetch without affecting polling state', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: false,
      })
    );

    expect(result.current.isPolling).toBe(false);

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.isPolling).toBe(false);
    expect(result.current.data).toEqual({ data: 'test' });
  });

  it('should stop polling when enabled changes to false', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        usePolling({
          fetcher,
          interval: 1000,
          enabled,
        }),
      { initialProps: { enabled: true } }
    );

    // Initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.isPolling).toBe(true);

    // Disable polling
    rerender({ enabled: false });

    expect(result.current.isPolling).toBe(false);

    // Should not poll anymore
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should start polling when enabled changes to true', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        usePolling({
          fetcher,
          interval: 1000,
          enabled,
        }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.isPolling).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();

    // Enable polling
    rerender({ enabled: true });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.isPolling).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should cleanup and stop polling on unmount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { unmount } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: true,
      })
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.runOnlyPendingTimersAsync();
    });

    // Should not fetch after unmount
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should not update state after unmount', async () => {
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: 'test' }), 500);
        })
    );

    const { result, unmount } = renderHook(() =>
      usePolling({
        fetcher,
        interval: 1000,
        enabled: false,
      })
    );

    // Start a manual refetch
    const refetchPromise = act(async () => {
      await result.current.refetch();
    });

    // Unmount immediately
    unmount();

    // Complete the fetch
    await act(async () => {
      vi.advanceTimersByTime(600);
      await refetchPromise;
    });

    // Should not throw or cause warnings
    // Data should remain null since component is unmounted
  });

  it('should handle changing interval', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const { rerender } = renderHook(
      ({ interval }) =>
        usePolling({
          fetcher,
          interval,
          enabled: true,
        }),
      { initialProps: { interval: 1000 } }
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Change interval
    rerender({ interval: 500 });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await vi.runOnlyPendingTimersAsync();
    });

    // Should poll at new interval
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should handle changing fetcher', async () => {
    const fetcher1 = vi.fn().mockResolvedValue({ source: 'fetcher1' });
    const fetcher2 = vi.fn().mockResolvedValue({ source: 'fetcher2' });

    const { result, rerender } = renderHook(
      ({ fetcher }) =>
        usePolling({
          fetcher,
          interval: 1000,
          enabled: false,
        }),
      { initialProps: { fetcher: fetcher1 } }
    );

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetcher1).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ source: 'fetcher1' });

    // Change fetcher
    rerender({ fetcher: fetcher2 });

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetcher2).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ source: 'fetcher2' });
  });
});
