// ============================================================
// Pagination Helper Functions Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  validatePaginationParams,
  buildPaginatedResponse,
  calculateOffset,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
  type PaginatedResponse,
} from '../pagination.js';

describe('Pagination Helper Functions', () => {
  // ============================================================
  // validatePaginationParams Tests
  // ============================================================

  describe('validatePaginationParams', () => {
    it('should return defaults when no params provided', () => {
      const result = validatePaginationParams();

      expect(result.page).toBe(DEFAULT_PAGE);
      expect(result.limit).toBe(DEFAULT_LIMIT);
    });

    it('should return defaults when null params provided', () => {
      const result = validatePaginationParams(null, null);

      expect(result.page).toBe(DEFAULT_PAGE);
      expect(result.limit).toBe(DEFAULT_LIMIT);
    });

    it('should accept valid numeric page and limit', () => {
      const result = validatePaginationParams(2, 10);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('should accept string numbers and parse them', () => {
      const result = validatePaginationParams('3', '15');

      expect(result.page).toBe(3);
      expect(result.limit).toBe(15);
    });

    it('should clamp limit to MAX_LIMIT', () => {
      const result = validatePaginationParams(1, 200);

      expect(result.limit).toBe(MAX_LIMIT);
    });

    it('should clamp limit to MIN_LIMIT', () => {
      const result = validatePaginationParams(1, 0);

      expect(result.limit).toBe(MIN_LIMIT);
    });

    it('should clamp limit to MIN_LIMIT for negative values', () => {
      const result = validatePaginationParams(1, -5);

      expect(result.limit).toBe(MIN_LIMIT);
    });

    it('should default page to 1 for negative page numbers', () => {
      const result = validatePaginationParams(-1, 10);

      expect(result.page).toBe(DEFAULT_PAGE);
    });

    it('should default page to 1 for zero page', () => {
      const result = validatePaginationParams(0, 10);

      expect(result.page).toBe(DEFAULT_PAGE);
    });

    it('should handle invalid string page gracefully', () => {
      const result = validatePaginationParams('abc', 10);

      expect(result.page).toBe(DEFAULT_PAGE);
    });

    it('should handle invalid string limit gracefully', () => {
      const result = validatePaginationParams(1, 'xyz');

      expect(result.limit).toBe(DEFAULT_LIMIT);
    });

    it('should handle NaN values', () => {
      const result = validatePaginationParams(NaN, NaN);

      expect(result.page).toBe(DEFAULT_PAGE);
      expect(result.limit).toBe(DEFAULT_LIMIT);
    });

    it('should handle floating point numbers by truncating', () => {
      const result = validatePaginationParams(2.7, 15.9);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(15);
    });

    it('should handle very large page numbers', () => {
      const result = validatePaginationParams(999999, 10);

      expect(result.page).toBe(999999);
      expect(result.limit).toBe(10);
    });

    it('should accept limit at exactly MAX_LIMIT', () => {
      const result = validatePaginationParams(1, MAX_LIMIT);

      expect(result.limit).toBe(MAX_LIMIT);
    });

    it('should accept limit at exactly MIN_LIMIT', () => {
      const result = validatePaginationParams(1, MIN_LIMIT);

      expect(result.limit).toBe(MIN_LIMIT);
    });
  });

  // ============================================================
  // calculateOffset Tests
  // ============================================================

  describe('calculateOffset', () => {
    it('should calculate offset for page 1', () => {
      const offset = calculateOffset(1, 20);

      expect(offset).toBe(0);
    });

    it('should calculate offset for page 2', () => {
      const offset = calculateOffset(2, 20);

      expect(offset).toBe(20);
    });

    it('should calculate offset for page 3', () => {
      const offset = calculateOffset(3, 10);

      expect(offset).toBe(20);
    });

    it('should calculate offset for custom limit', () => {
      const offset = calculateOffset(5, 15);

      expect(offset).toBe(60); // (5 - 1) * 15 = 60
    });

    it('should calculate offset for page 1 with limit 1', () => {
      const offset = calculateOffset(1, 1);

      expect(offset).toBe(0);
    });

    it('should calculate offset for page 10 with limit 100', () => {
      const offset = calculateOffset(10, 100);

      expect(offset).toBe(900);
    });

    it('should handle large page numbers', () => {
      const offset = calculateOffset(1000, 50);

      expect(offset).toBe(49950);
    });
  });

  // ============================================================
  // buildPaginatedResponse Tests
  // ============================================================

  describe('buildPaginatedResponse', () => {
    it('should build response with correct structure', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = buildPaginatedResponse(data, 10, 1, 5);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toEqual(data);
    });

    it('should calculate totalPages correctly', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 25, 1, 10);

      expect(result.pagination.totalPages).toBe(3); // Math.ceil(25/10) = 3
    });

    it('should set hasMore to true when more pages exist', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 50, 1, 20);

      expect(result.pagination.hasMore).toBe(true);
    });

    it('should set hasMore to false on last page', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 50, 3, 20);

      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should set hasMore to false when on exactly last page', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 20, 2, 10);

      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should handle empty data array', () => {
      const result = buildPaginatedResponse([], 0, 1, 20);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle page beyond total pages', () => {
      const result = buildPaginatedResponse([], 10, 5, 20);

      expect(result.data).toEqual([]);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should include all pagination metadata', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = buildPaginatedResponse(data, 15, 2, 5);

      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('limit');
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('totalPages');
      expect(result.pagination).toHaveProperty('hasMore');
    });

    it('should preserve exact values passed', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 100, 3, 25);

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(25);
      expect(result.pagination.total).toBe(100);
    });

    it('should calculate totalPages as 1 when total equals limit', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 20, 1, 20);

      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle single item with limit greater than 1', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 1, 1, 20);

      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should preserve data array types', () => {
      interface TestData {
        id: number;
        name: string;
      }
      const data: TestData[] = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ];
      const result: PaginatedResponse<TestData> = buildPaginatedResponse(data, 10, 1, 5);

      expect(result.data[0].name).toBe('Test 1');
      expect(result.data[1].name).toBe('Test 2');
    });

    it('should calculate totalPages correctly for exact divisions', () => {
      const data: any[] = [];
      const result = buildPaginatedResponse(data, 100, 1, 25);

      expect(result.pagination.totalPages).toBe(4); // 100 / 25 = 4
    });

    it('should calculate totalPages correctly for inexact divisions', () => {
      const data: any[] = [];
      const result = buildPaginatedResponse(data, 101, 1, 25);

      expect(result.pagination.totalPages).toBe(5); // Math.ceil(101 / 25) = 5
    });

    it('should handle very large totals', () => {
      const data: any[] = [];
      const result = buildPaginatedResponse(data, 1000000, 1, 100);

      expect(result.pagination.totalPages).toBe(10000);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should correctly identify middle pages', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 100, 5, 10);

      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  // ============================================================
  // Integration Tests
  // ============================================================

  describe('Helper Functions Integration', () => {
    it('should work together for a typical pagination flow', () => {
      // Step 1: Validate params from query string
      const params = validatePaginationParams('2', '10');

      // Step 2: Calculate offset
      const offset = calculateOffset(params.page, params.limit);

      // Step 3: Simulate fetching data (would hit database here)
      const mockData = [{ id: 11 }, { id: 12 }, { id: 13 }];
      const mockTotal = 25;

      // Step 4: Build response
      const response = buildPaginatedResponse(mockData, mockTotal, params.page, params.limit);

      expect(offset).toBe(10);
      expect(response.pagination.page).toBe(2);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.total).toBe(25);
      expect(response.pagination.totalPages).toBe(3);
      expect(response.pagination.hasMore).toBe(true);
    });

    it('should handle edge case of last page with partial results', () => {
      const params = validatePaginationParams('3', '10');
      const offset = calculateOffset(params.page, params.limit);
      const mockData = [{ id: 21 }, { id: 22 }, { id: 23 }, { id: 24 }, { id: 25 }];
      const mockTotal = 25;

      const response = buildPaginatedResponse(mockData, mockTotal, params.page, params.limit);

      expect(offset).toBe(20);
      expect(response.data).toHaveLength(5);
      expect(response.pagination.hasMore).toBe(false);
    });

    it('should handle first page with fewer results than limit', () => {
      const params = validatePaginationParams('1', '20');
      const offset = calculateOffset(params.page, params.limit);
      const mockData = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const mockTotal = 3;

      const response = buildPaginatedResponse(mockData, mockTotal, params.page, params.limit);

      expect(offset).toBe(0);
      expect(response.data).toHaveLength(3);
      expect(response.pagination.hasMore).toBe(false);
      expect(response.pagination.totalPages).toBe(1);
    });

    it('should validate and clamp extreme values', () => {
      const params = validatePaginationParams('0', '500');

      expect(params.page).toBe(DEFAULT_PAGE);
      expect(params.limit).toBe(MAX_LIMIT);

      const offset = calculateOffset(params.page, params.limit);
      expect(offset).toBe(0);
    });
  });
});
