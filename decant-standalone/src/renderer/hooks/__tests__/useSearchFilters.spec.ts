// ============================================================
// useSearchFilters Hook Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchFilters } from '../useSearchFilters';

describe('useSearchFilters', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear URL params
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty filters', () => {
    const { result } = renderHook(() => useSearchFilters());

    expect(result.current.filters.segments).toEqual([]);
    expect(result.current.filters.categories).toEqual([]);
    expect(result.current.filters.contentTypes).toEqual([]);
    expect(result.current.filters.dateRange).toBeNull();
    expect(result.current.filters.hasCompleteMetadata).toBe(false);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('should update segments filter', () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.setSegments(['A', 'T']);
    });

    expect(result.current.filters.segments).toEqual(['A', 'T']);
    expect(result.current.activeFilters.length).toBe(2);
  });

  it('should update content types filter', () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.setContentTypes(['V', 'A']);
    });

    expect(result.current.filters.contentTypes).toEqual(['V', 'A']);
  });

  it('should update date range filter', () => {
    const { result } = renderHook(() => useSearchFilters());
    const dateRange = { start: '2024-01-01', end: '2024-12-31' };

    act(() => {
      result.current.setDateRange(dateRange);
    });

    expect(result.current.filters.dateRange).toEqual(dateRange);
  });

  it('should clear all filters', () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.setSegments(['A']);
      result.current.setContentTypes(['V']);
      result.current.setHasCompleteMetadata(true);
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filters.segments).toEqual([]);
    expect(result.current.filters.contentTypes).toEqual([]);
    expect(result.current.filters.hasCompleteMetadata).toBe(false);
  });

  it('should remove individual filter', () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.setSegments(['A', 'T', 'F']);
    });

    expect(result.current.filters.segments).toEqual(['A', 'T', 'F']);

    act(() => {
      result.current.removeFilter('segment', 'T');
    });

    expect(result.current.filters.segments).toEqual(['A', 'F']);
  });

  it('should generate active filters with labels', () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.setSegments(['A']);
      result.current.setContentTypes(['V']);
      result.current.setHasCompleteMetadata(true);
    });

    expect(result.current.activeFilters.length).toBe(3);
    expect(result.current.activeFilters[0].label).toContain('AI & ML');
    expect(result.current.activeFilters[1].label).toContain('Video');
    expect(result.current.activeFilters[2].label).toContain('complete metadata');
  });

  it('should persist filters to localStorage', async () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.setSegments(['A']);
    });

    // Wait for debounce (300ms)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const stored = localStorage.getItem('decant-search-filters');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.segments).toEqual(['A']);
  });

  it('should load filters from localStorage on init', () => {
    // Set filters in localStorage
    localStorage.setItem(
      'decant-search-filters',
      JSON.stringify({
        segments: ['T'],
        categories: ['AI'],
        contentTypes: ['A'],
        dateRange: null,
        hasCompleteMetadata: true,
      })
    );

    const { result } = renderHook(() => useSearchFilters());

    expect(result.current.filters.segments).toEqual(['T']);
    expect(result.current.filters.categories).toEqual(['AI']);
    expect(result.current.filters.contentTypes).toEqual(['A']);
    expect(result.current.filters.hasCompleteMetadata).toBe(true);
  });

  it('should handle URL params on mount', () => {
    // Set URL params
    window.history.replaceState({}, '', '/?segments=A,T&contentTypes=V');

    const { result } = renderHook(() => useSearchFilters());

    expect(result.current.filters.segments).toEqual(['A', 'T']);
    expect(result.current.filters.contentTypes).toEqual(['V']);
  });
});
