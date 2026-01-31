// ============================================================
// usePolling Hook - Generic Polling for Real-Time Updates
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval: number; // ms
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UsePollingResult<T> {
  data: T | null;
  isPolling: boolean;
  error: Error | null;
  start: () => void;
  stop: () => void;
  refetch: () => Promise<void>;
}

/**
 * Generic hook for polling data at regular intervals
 *
 * @example
 * const { data, isPolling } = usePolling({
 *   fetcher: () => fetch('/api/status').then(r => r.json()),
 *   interval: 5000,
 *   enabled: true
 * });
 */
export function usePolling<T>(options: UsePollingOptions<T>): UsePollingResult<T> {
  const {
    fetcher,
    interval,
    enabled = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Fetch function that handles errors
  const fetch = useCallback(async () => {
    try {
      const result = await fetcher();

      if (!isMountedRef.current) return;

      setData(result);
      setError(null);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);

      if (onError) {
        onError(error);
      }
    }
  }, [fetcher, onSuccess, onError]);

  // Schedule next poll
  const scheduleNext = useCallback(() => {
    if (!isActiveRef.current) return;

    timerRef.current = setTimeout(async () => {
      await fetch();
      scheduleNext();
    }, interval);
  }, [fetch, interval]);

  // Start polling
  const start = useCallback(() => {
    if (isActiveRef.current) return;

    isActiveRef.current = true;
    setIsPolling(true);

    // Immediate first fetch
    fetch().then(() => {
      scheduleNext();
    });
  }, [fetch, scheduleNext]);

  // Stop polling
  const stop = useCallback(() => {
    isActiveRef.current = false;
    setIsPolling(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Manual refetch (doesn't affect polling state)
  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => {
      stop();
    };
  }, [enabled, start, stop]);

  return {
    data,
    isPolling,
    error,
    start,
    stop,
    refetch,
  };
}
