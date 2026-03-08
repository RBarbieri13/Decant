// ============================================================
// Tree Builder Utility Function Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  parseHierarchyCode,
  getHierarchyLevel,
  getParentCode,
} from '../tree_builder.js';

// ============================================================
// parseHierarchyCode
// ============================================================

describe('parseHierarchyCode', () => {
  it('returns empty object for null', () => {
    expect(parseHierarchyCode(null)).toEqual({});
  });

  it('parses segment-only code', () => {
    expect(parseHierarchyCode('A')).toEqual({
      segment: 'A',
      category: undefined,
      contentType: undefined,
      index: undefined,
    });
  });

  it('parses segment.category code', () => {
    expect(parseHierarchyCode('A.LLM')).toEqual({
      segment: 'A',
      category: 'LLM',
      contentType: undefined,
      index: undefined,
    });
  });

  it('parses segment.category.contentType code', () => {
    expect(parseHierarchyCode('A.LLM.T')).toEqual({
      segment: 'A',
      category: 'LLM',
      contentType: 'T',
      index: undefined,
    });
  });

  it('parses full 4-part code with index', () => {
    expect(parseHierarchyCode('A.LLM.T.1')).toEqual({
      segment: 'A',
      category: 'LLM',
      contentType: 'T',
      index: 1,
    });
  });

  it('parses index 0 as 0', () => {
    const result = parseHierarchyCode('T.WEB.A.0');
    expect(result.index).toBe(0);
  });

  it('parses multi-digit index', () => {
    const result = parseHierarchyCode('F.INV.A.42');
    expect(result.index).toBe(42);
  });

  it('parses all segment codes correctly', () => {
    const codes = ['A', 'T', 'F', 'S', 'H', 'B', 'E', 'L', 'X', 'C'];
    for (const code of codes) {
      const result = parseHierarchyCode(`${code}.OTH.A.1`);
      expect(result.segment).toBe(code);
    }
  });

  it('returns NaN index for non-numeric 4th part', () => {
    const result = parseHierarchyCode('A.LLM.T.abc');
    expect(Number.isNaN(result.index)).toBe(true);
  });

  it('handles subcategory chain codes beyond 4 parts', () => {
    // Extra parts beyond index 3 are ignored by parseHierarchyCode
    const result = parseHierarchyCode('A.LLM.T.1.2');
    expect(result.segment).toBe('A');
    expect(result.category).toBe('LLM');
    expect(result.contentType).toBe('T');
    expect(result.index).toBe(1);
  });

  it('returns empty object for empty string (treated same as null due to early return)', () => {
    // The function returns {} for falsy input (empty string is falsy)
    const result = parseHierarchyCode('');
    expect(result).toEqual({});
  });
});

// ============================================================
// getHierarchyLevel
// ============================================================

describe('getHierarchyLevel', () => {
  it('returns 0 for null', () => {
    expect(getHierarchyLevel(null)).toBe(0);
  });

  it('returns 1 for segment-only code', () => {
    expect(getHierarchyLevel('A')).toBe(1);
  });

  it('returns 2 for segment.category', () => {
    expect(getHierarchyLevel('A.LLM')).toBe(2);
  });

  it('returns 3 for segment.category.contentType', () => {
    expect(getHierarchyLevel('A.LLM.T')).toBe(3);
  });

  it('returns 4 for full item code', () => {
    expect(getHierarchyLevel('A.LLM.T.1')).toBe(4);
  });

  it('returns 5 for subcategory chain depth 2', () => {
    expect(getHierarchyLevel('A.LLM.T.1.2')).toBe(5);
  });

  it('returns 6 for subcategory chain depth 3', () => {
    expect(getHierarchyLevel('A.LLM.T.1.2.3')).toBe(6);
  });

  it('returns 0 for empty string (treated same as null due to early return)', () => {
    // Empty string is falsy, so the function returns 0 like null
    expect(getHierarchyLevel('')).toBe(0);
  });

  it('counts correctly for various organization codes', () => {
    expect(getHierarchyLevel('ANTH')).toBe(1);
    expect(getHierarchyLevel('ANTH.LLM')).toBe(2);
    expect(getHierarchyLevel('ANTH.LLM.T.1')).toBe(4);
  });
});

// ============================================================
// getParentCode
// ============================================================

describe('getParentCode', () => {
  it('returns null for null input', () => {
    expect(getParentCode(null)).toBeNull();
  });

  it('returns null for segment-only code (top level)', () => {
    expect(getParentCode('A')).toBeNull();
  });

  it('returns segment from segment.category code', () => {
    expect(getParentCode('A.LLM')).toBe('A');
  });

  it('returns segment.category from segment.category.contentType', () => {
    expect(getParentCode('A.LLM.T')).toBe('A.LLM');
  });

  it('returns segment.category.contentType from full item code', () => {
    expect(getParentCode('A.LLM.T.1')).toBe('A.LLM.T');
  });

  it('returns correct parent for subcategory chain', () => {
    expect(getParentCode('A.LLM.T.1.2')).toBe('A.LLM.T.1');
  });

  it('returns correct parent for deep subcategory', () => {
    expect(getParentCode('A.LLM.T.1.2.3')).toBe('A.LLM.T.1.2');
  });

  it('returns null for empty string (single segment)', () => {
    // ''.split('.') gives [''], length 1 → returns null
    expect(getParentCode('')).toBeNull();
  });

  it('returns correct parent for organization hierarchy', () => {
    expect(getParentCode('ANTH.LLM.T.1')).toBe('ANTH.LLM.T');
    expect(getParentCode('ANTH.LLM')).toBe('ANTH');
    expect(getParentCode('ANTH')).toBeNull();
  });

  it('parent of parent.child gives parent', () => {
    const code = 'T.WEB.A.5';
    const parent = getParentCode(code)!;
    expect(parent).toBe('T.WEB.A');
    const grandparent = getParentCode(parent)!;
    expect(grandparent).toBe('T.WEB');
    const greatGrandparent = getParentCode(grandparent)!;
    expect(greatGrandparent).toBe('T');
    expect(getParentCode(greatGrandparent)).toBeNull();
  });
});
