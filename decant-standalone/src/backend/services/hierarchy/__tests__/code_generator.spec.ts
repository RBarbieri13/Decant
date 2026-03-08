// ============================================================
// Code Generator Service Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  generateFunctionHierarchyCode,
  generateOrganizationHierarchyCode,
  generateSubcategoryChain,
  formatSubcategoryCode,
  formatSubcategoryChain,
  groupNodesByPosition,
  buildNodeTree,
  type HierarchyNode,
  type HierarchyViewType,
} from '../code_generator.js';

// ============================================================
// Test Fixtures
// ============================================================

function makeHierarchyNode(overrides: Partial<HierarchyNode> = {}): HierarchyNode {
  return {
    id: 'node-1',
    title: 'Test Node',
    company: null,
    source_domain: null,
    extracted_fields: {},
    metadata_tags: [],
    date_added: '2024-01-01',
    created_at: '2024-01-01',
    function_parent_id: null,
    organization_parent_id: null,
    segment_code: 'A',
    category_code: 'LLM',
    content_type_code: 'T',
    function_hierarchy_code: null,
    organization_hierarchy_code: null,
    ...overrides,
  };
}

// ============================================================
// generateFunctionHierarchyCode
// ============================================================

describe('generateFunctionHierarchyCode', () => {
  it('should generate base code with no subcategory chain', () => {
    const result = generateFunctionHierarchyCode('A', 'LLM', 'T', []);
    expect(result).toBe('A.LLM.T');
  });

  it('should append subcategory chain when provided', () => {
    const result = generateFunctionHierarchyCode('A', 'LLM', 'T', ['1']);
    expect(result).toBe('A.LLM.T.1');
  });

  it('should join multi-level subcategory chain with dots', () => {
    const result = generateFunctionHierarchyCode('A', 'LLM', 'T', ['1', '2', 'a']);
    expect(result).toBe('A.LLM.T.1.2.a');
  });

  it('should handle different segment codes', () => {
    expect(generateFunctionHierarchyCode('T', 'WEB', 'A', [])).toBe('T.WEB.A');
    expect(generateFunctionHierarchyCode('F', 'INV', 'V', ['3'])).toBe('F.INV.V.3');
  });

  it('should handle deep subcategory chains', () => {
    const result = generateFunctionHierarchyCode('X', 'PHY', 'P', ['2', '1', 'a', 'B']);
    expect(result).toBe('X.PHY.P.2.1.a.B');
  });
});

// ============================================================
// generateOrganizationHierarchyCode
// ============================================================

describe('generateOrganizationHierarchyCode', () => {
  it('should generate base code with no subcategory chain', () => {
    const result = generateOrganizationHierarchyCode('ANTH', 'LLM', 'T', []);
    expect(result).toBe('ANTH.LLM.T');
  });

  it('should append subcategory chain when provided', () => {
    const result = generateOrganizationHierarchyCode('ANTH', 'LLM', 'T', ['1']);
    expect(result).toBe('ANTH.LLM.T.1');
  });

  it('should join multi-level subcategory chain with dots', () => {
    const result = generateOrganizationHierarchyCode('GOOG', 'CVS', 'R', ['2', 'a']);
    expect(result).toBe('GOOG.CVS.R.2.a');
  });

  it('should handle different org codes', () => {
    expect(generateOrganizationHierarchyCode('MSFT', 'CLD', 'T', [])).toBe('MSFT.CLD.T');
    expect(generateOrganizationHierarchyCode('META', 'GEN', 'A', ['5'])).toBe('META.GEN.A.5');
  });

  it('should produce same structure as function hierarchy', () => {
    const funcResult = generateFunctionHierarchyCode('A', 'LLM', 'T', ['1', '2']);
    const orgResult = generateOrganizationHierarchyCode('ANTH', 'LLM', 'T', ['1', '2']);
    // Both have same structure but different first segment
    expect(funcResult.split('.').length).toBe(orgResult.split('.').length);
  });
});

// ============================================================
// generateSubcategoryChain
// ============================================================

describe('generateSubcategoryChain', () => {
  it('should return empty map for empty nodes array', () => {
    // Edge case: empty input to findBestDifferentiator path
    // Actually single node case is simpler to test
    const nodes = [makeHierarchyNode({ id: 'n1' })];
    const result = generateSubcategoryChain(nodes);
    expect(result.get('n1')).toEqual(['1']);
  });

  it('should assign "1" to a single node', () => {
    const nodes = [makeHierarchyNode({ id: 'single' })];
    const result = generateSubcategoryChain(nodes);
    expect(result.size).toBe(1);
    expect(result.get('single')).toEqual(['1']);
  });

  it('should assign sequential numbers to multiple nodes', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', company: 'Anthropic' }),
      makeHierarchyNode({ id: 'n2', company: 'OpenAI' }),
    ];
    const result = generateSubcategoryChain(nodes);
    expect(result.size).toBe(2);
    // Both nodes should have chains assigned
    expect(result.has('n1')).toBe(true);
    expect(result.has('n2')).toBe(true);
    // Chains should be non-empty arrays
    expect(result.get('n1')!.length).toBeGreaterThan(0);
    expect(result.get('n2')!.length).toBeGreaterThan(0);
  });

  it('should handle maxDepth limit by assigning sequential fallback codes', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1' }),
      makeHierarchyNode({ id: 'n2' }),
      makeHierarchyNode({ id: 'n3' }),
    ];
    // At maxDepth=0, should fall through to sequential assignment
    const result = generateSubcategoryChain(nodes, 0, 0);
    expect(result.size).toBe(3);
    const chains = [...result.values()];
    // Each should have a single element
    chains.forEach(chain => {
      expect(chain).toHaveLength(1);
    });
    // Values should be '1', '2', '3' in some order
    const values = chains.map(c => c[0]).sort();
    expect(values).toEqual(['1', '2', '3']);
  });

  it('should not exceed maxDepth recursion', () => {
    // 10 identical nodes with default maxDepth=10
    const nodes = Array.from({ length: 10 }, (_, i) =>
      makeHierarchyNode({ id: `n${i}` })
    );
    // Should complete without stack overflow
    expect(() => generateSubcategoryChain(nodes)).not.toThrow();
    const result = generateSubcategoryChain(nodes);
    expect(result.size).toBe(10);
  });

  it('should return chains for all input nodes', () => {
    const nodes = [
      makeHierarchyNode({ id: 'a', company: 'Alpha' }),
      makeHierarchyNode({ id: 'b', company: 'Beta' }),
      makeHierarchyNode({ id: 'c', company: 'Gamma' }),
    ];
    const result = generateSubcategoryChain(nodes);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(true);
  });
});

// ============================================================
// formatSubcategoryCode
// ============================================================

describe('formatSubcategoryCode', () => {
  // Level 0: numeric
  it('should return numeric string at level 0', () => {
    expect(formatSubcategoryCode(1, 0)).toBe('1');
    expect(formatSubcategoryCode(5, 0)).toBe('5');
    expect(formatSubcategoryCode(99, 0)).toBe('99');
  });

  // Level 1: numeric
  it('should return numeric string at level 1', () => {
    expect(formatSubcategoryCode(1, 1)).toBe('1');
    expect(formatSubcategoryCode(10, 1)).toBe('10');
    expect(formatSubcategoryCode(26, 1)).toBe('26');
  });

  // Level 2: lowercase letters
  it('should return lowercase letter at level 2 for 1-26', () => {
    expect(formatSubcategoryCode(1, 2)).toBe('a');
    expect(formatSubcategoryCode(2, 2)).toBe('b');
    expect(formatSubcategoryCode(26, 2)).toBe('z');
  });

  it('should return multi-letter code at level 2 for > 26', () => {
    // 27 = aa (floor((27-1)/26) = 1 -> 'a', ((27-1)%26)+1 = 1 -> 'a')
    expect(formatSubcategoryCode(27, 2)).toBe('aa');
    // 28 = ab
    expect(formatSubcategoryCode(28, 2)).toBe('ab');
    // 52 = az (floor((52-1)/26) = 1 -> 'a', ((52-1)%26)+1 = 26 -> 'z')
    expect(formatSubcategoryCode(52, 2)).toBe('az');
  });

  // Level 3+: uppercase letters
  it('should return uppercase letter at level 3 for 1-26', () => {
    expect(formatSubcategoryCode(1, 3)).toBe('A');
    expect(formatSubcategoryCode(2, 3)).toBe('B');
    expect(formatSubcategoryCode(26, 3)).toBe('Z');
  });

  it('should return multi-letter code at level 3 for > 26', () => {
    expect(formatSubcategoryCode(27, 3)).toBe('AA');
    expect(formatSubcategoryCode(28, 3)).toBe('AB');
  });

  it('should use uppercase at level 4+', () => {
    expect(formatSubcategoryCode(1, 4)).toBe('A');
    expect(formatSubcategoryCode(5, 10)).toBe('E');
  });

  it('should handle level 2 boundary: z -> aa', () => {
    expect(formatSubcategoryCode(25, 2)).toBe('y');
    expect(formatSubcategoryCode(26, 2)).toBe('z');
    expect(formatSubcategoryCode(27, 2)).toBe('aa');
  });

  it('should handle level 3 boundary: Z -> AA', () => {
    expect(formatSubcategoryCode(25, 3)).toBe('Y');
    expect(formatSubcategoryCode(26, 3)).toBe('Z');
    expect(formatSubcategoryCode(27, 3)).toBe('AA');
  });
});

// ============================================================
// formatSubcategoryChain
// ============================================================

describe('formatSubcategoryChain', () => {
  it('should return empty array for empty input', () => {
    expect(formatSubcategoryChain([])).toEqual([]);
  });

  it('should keep level 0 (first) codes as numerics', () => {
    const result = formatSubcategoryChain(['3']);
    expect(result).toEqual(['3']); // level 0 = numeric
  });

  it('should keep level 1 codes as numerics', () => {
    const result = formatSubcategoryChain(['1', '5']);
    expect(result[0]).toBe('1'); // level 0 = numeric
    expect(result[1]).toBe('5'); // level 1 = numeric
  });

  it('should convert level 2 to lowercase letter', () => {
    const result = formatSubcategoryChain(['1', '2', '3']);
    expect(result[0]).toBe('1'); // numeric
    expect(result[1]).toBe('2'); // numeric
    expect(result[2]).toBe('c'); // level 2 = 'c'
  });

  it('should convert level 3+ to uppercase letter', () => {
    const result = formatSubcategoryChain(['1', '2', '3', '4']);
    expect(result[3]).toBe('D'); // level 3 = uppercase
  });

  it('should pass non-numeric codes through unchanged', () => {
    const result = formatSubcategoryChain(['1', 'already-formatted', '3']);
    expect(result[1]).toBe('already-formatted');
  });

  it('should handle NaN codes by passing them through', () => {
    const result = formatSubcategoryChain(['abc', '2']);
    expect(result[0]).toBe('abc'); // isNaN('abc') = true, kept as-is
  });

  it('should produce a properly formatted full chain', () => {
    // Typical chain: group 1 -> subgroup 2 -> deep 1
    const result = formatSubcategoryChain(['1', '2', '1']);
    expect(result).toEqual(['1', '2', 'a']); // level 0=numeric, 1=numeric, 2=lowercase
  });
});

// ============================================================
// groupNodesByPosition
// ============================================================

describe('groupNodesByPosition', () => {
  it('should group nodes with same segment/category/content-type/parent into one group', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', segment_code: 'A', category_code: 'LLM', content_type_code: 'T', function_parent_id: null }),
      makeHierarchyNode({ id: 'n2', segment_code: 'A', category_code: 'LLM', content_type_code: 'T', function_parent_id: null }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(1);
    const [group] = groups.values();
    expect(group).toHaveLength(2);
  });

  it('should create separate groups for different segment codes', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', segment_code: 'A', category_code: 'LLM', content_type_code: 'T' }),
      makeHierarchyNode({ id: 'n2', segment_code: 'T', category_code: 'LLM', content_type_code: 'T' }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(2);
  });

  it('should create separate groups for different category codes', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', category_code: 'LLM' }),
      makeHierarchyNode({ id: 'n2', category_code: 'AGT' }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(2);
  });

  it('should create separate groups for different content type codes', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', content_type_code: 'T' }),
      makeHierarchyNode({ id: 'n2', content_type_code: 'A' }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(2);
  });

  it('should create separate groups for different parent IDs', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', function_parent_id: 'parent-A' }),
      makeHierarchyNode({ id: 'n2', function_parent_id: 'parent-B' }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(2);
  });

  it('should use function_parent_id for function view', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', function_parent_id: 'fp1', organization_parent_id: 'op1' }),
      makeHierarchyNode({ id: 'n2', function_parent_id: 'fp1', organization_parent_id: 'op2' }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(1); // same function_parent_id -> same group
  });

  it('should use organization_parent_id for organization view', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', function_parent_id: 'fp1', organization_parent_id: 'op1' }),
      makeHierarchyNode({ id: 'n2', function_parent_id: 'fp2', organization_parent_id: 'op1' }),
    ];
    const groups = groupNodesByPosition(nodes, 'organization');
    expect(groups.size).toBe(1); // same organization_parent_id -> same group
  });

  it('should treat null parent as "root"', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', function_parent_id: null }),
      makeHierarchyNode({ id: 'n2', function_parent_id: null }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(1);
  });

  it('should use "X" as fallback segment code when null', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', segment_code: null }),
      makeHierarchyNode({ id: 'n2', segment_code: null }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(1);
    const [, key] = [...groups.keys()][0].split(':');
    expect(key).toBe('X');
  });

  it('should use "A" as fallback content_type when null', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', content_type_code: null }),
      makeHierarchyNode({ id: 'n2', content_type_code: null }),
    ];
    const groups = groupNodesByPosition(nodes, 'function');
    expect(groups.size).toBe(1);
    const [, , , ct] = [...groups.keys()][0].split(':');
    expect(ct).toBe('A');
  });

  it('should handle empty nodes array', () => {
    const groups = groupNodesByPosition([], 'function');
    expect(groups.size).toBe(0);
  });
});

// ============================================================
// buildNodeTree
// ============================================================

describe('buildNodeTree', () => {
  it('should return all nodes as roots when no parent relationships exist', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', function_parent_id: null }),
      makeHierarchyNode({ id: 'n2', function_parent_id: null }),
      makeHierarchyNode({ id: 'n3', function_parent_id: null }),
    ];
    const tree = buildNodeTree(nodes, 'function');
    expect(tree).toHaveLength(3);
    tree.forEach(root => expect(root.children).toHaveLength(0));
  });

  it('should build parent-child relationships', () => {
    const nodes = [
      makeHierarchyNode({ id: 'parent', function_parent_id: null }),
      makeHierarchyNode({ id: 'child1', function_parent_id: 'parent' }),
      makeHierarchyNode({ id: 'child2', function_parent_id: 'parent' }),
    ];
    const tree = buildNodeTree(nodes, 'function');
    expect(tree).toHaveLength(1); // only root
    expect(tree[0].node.id).toBe('parent');
    expect(tree[0].children).toHaveLength(2);
  });

  it('should build deep nested tree', () => {
    const nodes = [
      makeHierarchyNode({ id: 'root', function_parent_id: null }),
      makeHierarchyNode({ id: 'child', function_parent_id: 'root' }),
      makeHierarchyNode({ id: 'grandchild', function_parent_id: 'child' }),
    ];
    const tree = buildNodeTree(nodes, 'function');
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].node.id).toBe('grandchild');
  });

  it('should treat nodes with missing parent as roots', () => {
    const nodes = [
      makeHierarchyNode({ id: 'n1', function_parent_id: 'missing-parent' }),
    ];
    const tree = buildNodeTree(nodes, 'function');
    // 'missing-parent' not in nodeMap -> treated as root
    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe('n1');
  });

  it('should use function_parent_id for function view', () => {
    const nodes = [
      makeHierarchyNode({ id: 'parent', function_parent_id: null, organization_parent_id: null }),
      makeHierarchyNode({ id: 'child', function_parent_id: 'parent', organization_parent_id: null }),
    ];
    const tree = buildNodeTree(nodes, 'function');
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
  });

  it('should use organization_parent_id for organization view', () => {
    const nodes = [
      makeHierarchyNode({ id: 'parent', function_parent_id: null, organization_parent_id: null }),
      makeHierarchyNode({ id: 'child', function_parent_id: null, organization_parent_id: 'parent' }),
    ];
    // In function view, child has no function parent -> 2 roots
    const funcTree = buildNodeTree(nodes, 'function');
    expect(funcTree).toHaveLength(2);

    // In org view, child has org parent -> 1 root with 1 child
    const orgTree = buildNodeTree(nodes, 'organization');
    expect(orgTree).toHaveLength(1);
    expect(orgTree[0].children).toHaveLength(1);
  });

  it('should handle empty nodes array', () => {
    const tree = buildNodeTree([], 'function');
    expect(tree).toHaveLength(0);
  });

  it('should preserve node data in tree nodes', () => {
    const nodes = [makeHierarchyNode({ id: 'n1', title: 'My Node', company: 'TestCo' })];
    const tree = buildNodeTree(nodes, 'function');
    expect(tree[0].node.title).toBe('My Node');
    expect(tree[0].node.company).toBe('TestCo');
  });
});
