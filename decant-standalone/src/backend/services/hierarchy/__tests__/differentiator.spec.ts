// ============================================================
// Differentiator Service Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  DIFFERENTIATOR_PRIORITY,
  extractBrand,
  extractVersion,
  extractVariant,
  extractCreator,
  extractDate,
  extractUniqueId,
  extractDifferentiator,
  findBestDifferentiator,
  groupNodesByDifferentiator,
  getAllDifferentiators,
  type DifferentiableNode,
} from '../differentiator.js';

// ============================================================
// Test Fixtures
// ============================================================

function makeNode(overrides: Partial<DifferentiableNode> = {}): DifferentiableNode {
  return {
    id: 'abcd1234-5678-90ab-cdef-0123456789ab',
    title: 'Test Node',
    company: null,
    source_domain: null,
    ...overrides,
  };
}

// ============================================================
// DIFFERENTIATOR_PRIORITY
// ============================================================

describe('DIFFERENTIATOR_PRIORITY', () => {
  it('should be an array of 6 differentiator types', () => {
    expect(DIFFERENTIATOR_PRIORITY).toHaveLength(6);
  });

  it('should start with brand and end with unique_id', () => {
    expect(DIFFERENTIATOR_PRIORITY[0]).toBe('brand');
    expect(DIFFERENTIATOR_PRIORITY[5]).toBe('unique_id');
  });

  it('should include all expected types', () => {
    expect(DIFFERENTIATOR_PRIORITY).toContain('brand');
    expect(DIFFERENTIATOR_PRIORITY).toContain('version');
    expect(DIFFERENTIATOR_PRIORITY).toContain('variant');
    expect(DIFFERENTIATOR_PRIORITY).toContain('creator');
    expect(DIFFERENTIATOR_PRIORITY).toContain('date');
    expect(DIFFERENTIATOR_PRIORITY).toContain('unique_id');
  });
});

// ============================================================
// extractBrand
// ============================================================

describe('extractBrand', () => {
  it('should return normalized company field first', () => {
    const node = makeNode({ company: 'Google LLC' });
    expect(extractBrand(node)).toBe('google_llc');
  });

  it('should return null when all sources are empty', () => {
    const node = makeNode();
    expect(extractBrand(node)).toBeNull();
  });

  it('should fall through to extracted_fields brand', () => {
    const node = makeNode({
      extracted_fields: { brand: 'OpenAI' },
    });
    expect(extractBrand(node)).toBe('openai');
  });

  it('should fall through to extracted_fields organization', () => {
    const node = makeNode({
      extracted_fields: { organization: 'Meta Inc' },
    });
    expect(extractBrand(node)).toBe('meta_inc');
  });

  it('should prefer company over extracted_fields', () => {
    const node = makeNode({
      company: 'Apple',
      extracted_fields: { brand: 'Microsoft' },
    });
    expect(extractBrand(node)).toBe('apple');
  });

  it('should extract brand from ORG: metadata tag', () => {
    const node = makeNode({
      metadata_tags: ['TOPIC:AI', 'ORG:Anthropic'],
    });
    expect(extractBrand(node)).toBe('anthropic');
  });

  it('should fall through to source_domain when no other source', () => {
    const node = makeNode({ source_domain: 'github.com' });
    expect(extractBrand(node)).toBe('github');
  });

  it('should strip www. prefix from domain', () => {
    const node = makeNode({ source_domain: 'www.twitter.com' });
    expect(extractBrand(node)).toBe('twitter');
  });

  it('should strip common domain suffixes', () => {
    const node = makeNode({ source_domain: 'openai.io' });
    expect(extractBrand(node)).toBe('openai');
  });

  it('should normalize whitespace-only company to null', () => {
    const node = makeNode({ company: '   ' });
    expect(extractBrand(node)).toBeNull();
  });

  it('should handle non-string brand in extracted_fields gracefully', () => {
    const node = makeNode({
      extracted_fields: { brand: 42 },
    });
    expect(extractBrand(node)).toBeNull();
  });
});

// ============================================================
// extractVersion
// ============================================================

describe('extractVersion', () => {
  it('should return null when no version found', () => {
    const node = makeNode({ title: 'Introduction to AI' });
    expect(extractVersion(node)).toBeNull();
  });

  it('should extract version from extracted_fields.version', () => {
    const node = makeNode({
      extracted_fields: { version: '3.5' },
    });
    expect(extractVersion(node)).toBe('3_5');
  });

  it('should extract version from extracted_fields.release', () => {
    const node = makeNode({
      extracted_fields: { release: '2.0.1' },
    });
    expect(extractVersion(node)).toBe('2_0_1');
  });

  it('should extract version from extracted_fields.api_version', () => {
    const node = makeNode({
      extracted_fields: { api_version: 'v4' },
    });
    expect(extractVersion(node)).toBe('v4');
  });

  it('should extract version number from title', () => {
    const node = makeNode({ title: 'React 18.2 Release Notes' });
    expect(extractVersion(node)).toBe('18.2');
  });

  it('should extract v-prefixed version from title', () => {
    const node = makeNode({ title: 'Node.js v20.0.0 LTS' });
    expect(extractVersion(node)).toBe('20.0.0');
  });

  it('should prefer extracted_fields over title', () => {
    const node = makeNode({
      title: 'Version 1.0',
      extracted_fields: { version: '2.0' },
    });
    expect(extractVersion(node)).toBe('2_0');
  });
});

// ============================================================
// extractVariant
// ============================================================

describe('extractVariant', () => {
  it('should return null when no variant found', () => {
    const node = makeNode({ title: 'An Ordinary Document' });
    expect(extractVariant(node)).toBeNull();
  });

  it('should extract variant from extracted_fields.variant', () => {
    const node = makeNode({
      extracted_fields: { variant: 'Enterprise' },
    });
    expect(extractVariant(node)).toBe('enterprise');
  });

  it('should extract from extracted_fields.edition', () => {
    const node = makeNode({
      extracted_fields: { edition: 'Developer' },
    });
    expect(extractVariant(node)).toBe('developer');
  });

  it('should extract from extracted_fields.tier', () => {
    const node = makeNode({
      extracted_fields: { tier: 'Plus' },
    });
    expect(extractVariant(node)).toBe('plus');
  });

  it('should extract from extracted_fields.plan', () => {
    const node = makeNode({
      extracted_fields: { plan: 'Free' },
    });
    expect(extractVariant(node)).toBe('free');
  });

  it('should extract Pro from title', () => {
    const node = makeNode({ title: 'ChatGPT Pro Subscription' });
    expect(extractVariant(node)).toBe('pro');
  });

  it('should extract Beta from title', () => {
    const node = makeNode({ title: 'New Feature Beta Release' });
    expect(extractVariant(node)).toBe('beta');
  });

  it('should extract Premium from title', () => {
    const node = makeNode({ title: 'Premium Plan Overview' });
    expect(extractVariant(node)).toBe('premium');
  });

  it('should be case-insensitive when matching title', () => {
    const node = makeNode({ title: 'ENTERPRISE Edition' });
    expect(extractVariant(node)).toBe('enterprise');
  });

  it('should prefer extracted_fields over title match', () => {
    const node = makeNode({
      title: 'Pro Plan',
      extracted_fields: { plan: 'Ultimate' },
    });
    expect(extractVariant(node)).toBe('ultimate');
  });
});

// ============================================================
// extractCreator
// ============================================================

describe('extractCreator', () => {
  it('should return null when no creator found', () => {
    const node = makeNode();
    expect(extractCreator(node)).toBeNull();
  });

  it('should extract from extracted_fields.author', () => {
    const node = makeNode({
      extracted_fields: { author: 'Jane Doe' },
    });
    expect(extractCreator(node)).toBe('jane_doe');
  });

  it('should extract from extracted_fields.creator', () => {
    const node = makeNode({
      extracted_fields: { creator: 'John Smith' },
    });
    expect(extractCreator(node)).toBe('john_smith');
  });

  it('should extract from extracted_fields.owner', () => {
    const node = makeNode({
      extracted_fields: { owner: 'Acme Corp' },
    });
    expect(extractCreator(node)).toBe('acme_corp');
  });

  it('should extract from extracted_fields.publisher', () => {
    const node = makeNode({
      extracted_fields: { publisher: 'MIT Press' },
    });
    expect(extractCreator(node)).toBe('mit_press');
  });

  it('should prefer author over other creator fields', () => {
    const node = makeNode({
      extracted_fields: { author: 'Alice', creator: 'Bob' },
    });
    expect(extractCreator(node)).toBe('alice');
  });
});

// ============================================================
// extractDate
// ============================================================

describe('extractDate', () => {
  it('should return null when no date found', () => {
    const node = makeNode();
    expect(extractDate(node)).toBeNull();
  });

  it('should extract from extracted_fields.date and format as YYYYMMDD', () => {
    const node = makeNode({
      extracted_fields: { date: '2024-03-15' },
    });
    expect(extractDate(node)).toBe('20240315');
  });

  it('should extract from extracted_fields.published_date', () => {
    const node = makeNode({
      extracted_fields: { published_date: '2023-01-01' },
    });
    expect(extractDate(node)).toBe('20230101');
  });

  it('should extract from extracted_fields.release_date', () => {
    const node = makeNode({
      extracted_fields: { release_date: '2025-06-30' },
    });
    expect(extractDate(node)).toBe('20250630');
  });

  it('should fall back to date_added', () => {
    const node = makeNode({ date_added: '2024-11-20' });
    expect(extractDate(node)).toBe('20241120');
  });

  it('should fall back to created_at', () => {
    const node = makeNode({ created_at: '2022-07-04' });
    expect(extractDate(node)).toBe('20220704');
  });

  it('should prefer extracted_fields.date over date_added', () => {
    const node = makeNode({
      extracted_fields: { date: '2024-01-01' },
      date_added: '2020-01-01',
    });
    expect(extractDate(node)).toBe('20240101');
  });

  it('should handle invalid date strings gracefully', () => {
    const node = makeNode({
      extracted_fields: { date: 'not-a-date' },
    });
    // Should not throw; returns fallback numeric extraction
    expect(() => extractDate(node)).not.toThrow();
  });
});

// ============================================================
// extractUniqueId
// ============================================================

describe('extractUniqueId', () => {
  it('should return first 8 characters of the node id', () => {
    const node = makeNode({ id: 'abcd1234-rest-of-id' });
    expect(extractUniqueId(node)).toBe('abcd1234');
  });

  it('should always return exactly 8 characters for UUID', () => {
    const node = makeNode({ id: '12345678-0000-0000-0000-000000000000' });
    expect(extractUniqueId(node)).toHaveLength(8);
    expect(extractUniqueId(node)).toBe('12345678');
  });
});

// ============================================================
// extractDifferentiator (dispatch)
// ============================================================

describe('extractDifferentiator', () => {
  it('should dispatch brand type to extractBrand', () => {
    const node = makeNode({ company: 'Stripe' });
    expect(extractDifferentiator(node, 'brand')).toBe('stripe');
  });

  it('should dispatch version type to extractVersion', () => {
    const node = makeNode({ title: 'API v3.0' });
    expect(extractDifferentiator(node, 'version')).toBe('3.0');
  });

  it('should dispatch variant type to extractVariant', () => {
    const node = makeNode({ title: 'Pro Plan' });
    expect(extractDifferentiator(node, 'variant')).toBe('pro');
  });

  it('should dispatch creator type to extractCreator', () => {
    const node = makeNode({ extracted_fields: { author: 'Alice' } });
    expect(extractDifferentiator(node, 'creator')).toBe('alice');
  });

  it('should dispatch date type to extractDate', () => {
    const node = makeNode({ date_added: '2024-05-01' });
    expect(extractDifferentiator(node, 'date')).toBe('20240501');
  });

  it('should dispatch unique_id type to extractUniqueId', () => {
    const node = makeNode({ id: 'xyz98765-0000-0000-0000-000000000000' });
    expect(extractDifferentiator(node, 'unique_id')).toBe('xyz98765');
  });
});

// ============================================================
// groupNodesByDifferentiator
// ============================================================

describe('groupNodesByDifferentiator', () => {
  it('should return empty array for empty input', () => {
    expect(groupNodesByDifferentiator([], 'brand')).toEqual([]);
  });

  it('should group nodes with the same brand together', () => {
    const nodes = [
      makeNode({ id: 'aaaa0001-0000-0000-0000-000000000000', company: 'Google' }),
      makeNode({ id: 'bbbb0002-0000-0000-0000-000000000000', company: 'Google' }),
      makeNode({ id: 'cccc0003-0000-0000-0000-000000000000', company: 'Meta' }),
    ];
    const groups = groupNodesByDifferentiator(nodes, 'brand');
    expect(groups).toHaveLength(2);
    const googleGroup = groups.find(g => g.value === 'google');
    expect(googleGroup?.nodes).toHaveLength(2);
    const metaGroup = groups.find(g => g.value === 'meta');
    expect(metaGroup?.nodes).toHaveLength(1);
  });

  it('should group unknown brand into __unknown__ bucket', () => {
    const nodes = [
      makeNode({ id: 'aaaa0001-0000-0000-0000-000000000000' }),
      makeNode({ id: 'bbbb0002-0000-0000-0000-000000000000' }),
    ];
    const groups = groupNodesByDifferentiator(nodes, 'brand');
    expect(groups).toHaveLength(1);
    expect(groups[0].value).toBe('__unknown__');
    expect(groups[0].nodes).toHaveLength(2);
  });

  it('should give each node its own group for unique_id', () => {
    const nodes = [
      makeNode({ id: 'aaaa1111-0000-0000-0000-000000000000' }),
      makeNode({ id: 'bbbb2222-0000-0000-0000-000000000000' }),
      makeNode({ id: 'cccc3333-0000-0000-0000-000000000000' }),
    ];
    const groups = groupNodesByDifferentiator(nodes, 'unique_id');
    expect(groups).toHaveLength(3);
  });

  it('should sort groups alphabetically by value', () => {
    const nodes = [
      makeNode({ id: 'aaaa0001-0000-0000-0000-000000000000', company: 'Zebra' }),
      makeNode({ id: 'bbbb0002-0000-0000-0000-000000000000', company: 'Apple' }),
      makeNode({ id: 'cccc0003-0000-0000-0000-000000000000', company: 'Meta' }),
    ];
    const groups = groupNodesByDifferentiator(nodes, 'brand');
    expect(groups[0].value).toBe('apple');
    expect(groups[1].value).toBe('meta');
    expect(groups[2].value).toBe('zebra');
  });
});

// ============================================================
// findBestDifferentiator
// ============================================================

describe('findBestDifferentiator', () => {
  it('should return unique_id with empty groups for empty input', () => {
    const result = findBestDifferentiator([]);
    expect(result.type).toBe('unique_id');
    expect(result.groups).toEqual([]);
  });

  it('should return unique_id for a single node', () => {
    const nodes = [makeNode({ id: 'solo1234-0000-0000-0000-000000000000' })];
    const result = findBestDifferentiator(nodes);
    expect(result.type).toBe('unique_id');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].nodes[0]).toBe(nodes[0]);
  });

  it('should prefer brand when nodes have different brands', () => {
    const nodes = [
      makeNode({ id: 'aaaa0001-0000-0000-0000-000000000000', company: 'Google' }),
      makeNode({ id: 'bbbb0002-0000-0000-0000-000000000000', company: 'Apple' }),
    ];
    const result = findBestDifferentiator(nodes);
    expect(result.type).toBe('brand');
    expect(result.groups).toHaveLength(2);
  });

  it('should fall through to version when brand is the same', () => {
    const nodes = [
      makeNode({
        id: 'aaaa0001-0000-0000-0000-000000000000',
        company: 'Google',
        title: 'Chrome 120',
      }),
      makeNode({
        id: 'bbbb0002-0000-0000-0000-000000000000',
        company: 'Google',
        title: 'Chrome 121',
      }),
    ];
    const result = findBestDifferentiator(nodes);
    expect(result.type).toBe('version');
    expect(result.groups).toHaveLength(2);
  });

  it('should fall back to unique_id when no differentiator splits the nodes', () => {
    // Nodes with identical brand, no version/variant/creator/date
    const nodes = [
      makeNode({ id: 'aaaa0001-0000-0000-0000-000000000000', company: 'Acme', title: 'Docs' }),
      makeNode({ id: 'bbbb0002-0000-0000-0000-000000000000', company: 'Acme', title: 'Docs' }),
    ];
    const result = findBestDifferentiator(nodes);
    expect(result.type).toBe('unique_id');
    expect(result.groups).toHaveLength(2);
  });

  it('should return groups that collectively contain all input nodes', () => {
    const nodes = [
      makeNode({ id: 'aaaa0001-0000-0000-0000-000000000000', company: 'A' }),
      makeNode({ id: 'bbbb0002-0000-0000-0000-000000000000', company: 'B' }),
      makeNode({ id: 'cccc0003-0000-0000-0000-000000000000', company: 'A' }),
    ];
    const result = findBestDifferentiator(nodes);
    const allNodes = result.groups.flatMap(g => g.nodes);
    expect(allNodes).toHaveLength(3);
  });
});

// ============================================================
// getAllDifferentiators
// ============================================================

describe('getAllDifferentiators', () => {
  it('should return all 6 differentiator keys', () => {
    const node = makeNode({ id: 'test1234-0000-0000-0000-000000000000' });
    const result = getAllDifferentiators(node);
    expect(Object.keys(result)).toHaveLength(6);
    expect(result).toHaveProperty('brand');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('variant');
    expect(result).toHaveProperty('creator');
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('unique_id');
  });

  it('should return null for missing brand/version/variant/creator/date', () => {
    const node = makeNode({ id: 'test1234-0000-0000-0000-000000000000' });
    const result = getAllDifferentiators(node);
    expect(result.brand).toBeNull();
    expect(result.version).toBeNull();
    expect(result.variant).toBeNull();
    expect(result.creator).toBeNull();
    expect(result.date).toBeNull();
  });

  it('unique_id should always be non-null', () => {
    const node = makeNode({ id: 'abcd1234-0000-0000-0000-000000000000' });
    const result = getAllDifferentiators(node);
    expect(result.unique_id).toBe('abcd1234');
  });

  it('should populate all available fields from a rich node', () => {
    const node = makeNode({
      id: 'richnode-0000-0000-0000-000000000000',
      company: 'Stripe',
      title: 'API v2.5 Pro',
      extracted_fields: {
        author: 'Jane',
        date: '2024-03-01',
      },
    });
    const result = getAllDifferentiators(node);
    expect(result.brand).toBe('stripe');
    expect(result.version).toBe('2.5');
    expect(result.variant).toBe('pro');
    expect(result.creator).toBe('jane');
    expect(result.date).toBe('20240301');
    expect(result.unique_id).toBe('richnode');
  });
});
