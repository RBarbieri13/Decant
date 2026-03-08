// ============================================================
// Restructure Service Unit Tests (pure logic, no DB)
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import {
  detectConflict,
  planRestructure,
  validateRestructure,
  type RestructureContext,
} from '../restructure.js';
import type { DifferentiableNode } from '../differentiator.js';
import Database from 'better-sqlite3';

// Set up an in-memory DB with the hierarchy columns planRestructure needs
const testDb = new Database(':memory:');
testDb.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    title TEXT,
    function_hierarchy_code TEXT,
    organization_hierarchy_code TEXT,
    is_deleted INTEGER DEFAULT 0
  );
`);

vi.mock('../../../database/connection.js', () => ({
  getDatabase: () => testDb,
}));

// ============================================================
// Test Fixtures
// ============================================================

function makeNode(overrides: Partial<DifferentiableNode> = {}): DifferentiableNode {
  return {
    id: `node-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Article',
    company: null,
    source_domain: 'example.com',
    extracted_fields: {},
    metadata_tags: [],
    date_added: '2024-01-15',
    created_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

const TARGET_PATH = 'A.LLM.T';

// ============================================================
// detectConflict
// ============================================================

describe('detectConflict', () => {
  it('returns no conflict when no existing nodes', () => {
    const newNode = makeNode({ id: 'new-node' });
    const result = detectConflict(newNode, []);
    expect(result.hasConflict).toBe(false);
    expect(result.conflictingNodes).toHaveLength(0);
    expect(result.conflictingCodePattern).toBeNull();
  });

  it('returns no conflict when only the same node is in existing list', () => {
    const node = makeNode({ id: 'same-node' });
    const result = detectConflict(node, [node]);
    expect(result.hasConflict).toBe(false);
    expect(result.conflictingNodes).toHaveLength(0);
  });

  it('detects conflict with one other existing node', () => {
    const newNode = makeNode({ id: 'new-node', title: 'New Article' });
    const existing = makeNode({ id: 'old-node', title: 'Old Article' });
    const result = detectConflict(newNode, [existing]);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingNodes).toHaveLength(1);
    expect(result.conflictingNodes[0].id).toBe('old-node');
  });

  it('detects conflict with multiple existing nodes', () => {
    const newNode = makeNode({ id: 'new-node' });
    const existing1 = makeNode({ id: 'node-1' });
    const existing2 = makeNode({ id: 'node-2' });
    const result = detectConflict(newNode, [existing1, existing2]);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingNodes).toHaveLength(2);
  });

  it('filters out new node from existing list before checking', () => {
    const node = makeNode({ id: 'target-node' });
    const other = makeNode({ id: 'other-node' });
    // Pass node itself plus another — should detect conflict with the other
    const result = detectConflict(node, [node, other]);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingNodes).toHaveLength(1);
    expect(result.conflictingNodes[0].id).toBe('other-node');
  });

  it('conflictingCodePattern is null (determined during restructure)', () => {
    const newNode = makeNode({ id: 'new-node' });
    const existing = makeNode({ id: 'old-node' });
    const result = detectConflict(newNode, [existing]);
    expect(result.conflictingCodePattern).toBeNull();
  });
});

// ============================================================
// planRestructure
// ============================================================

describe('planRestructure', () => {
  it('assigns .1 code when only new node at path', () => {
    const newNode = makeNode({ id: 'new-node', title: 'Solo Node' });
    const context: RestructureContext = {
      newNodeId: 'new-node',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [],
      hierarchyType: 'function',
    };

    const result = planRestructure(context);

    expect(result.newNodeCode).toBe('A.LLM.T.1');
    expect(result.restructuringNeeded).toBe(false);
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].nodeId).toBe('new-node');
    expect(result.mutations[0].newCode).toBe('A.LLM.T.1');
    expect(result.mutations[0].oldCode).toBeNull();
    expect(result.mutations[0].hierarchyType).toBe('function');
  });

  it('produces codes under target path', () => {
    const newNode = makeNode({ id: 'node-a', title: 'GPT-4 Article', company: 'OpenAI' });
    const existing = makeNode({ id: 'node-b', title: 'Claude Article', company: 'Anthropic' });
    const context: RestructureContext = {
      newNodeId: 'node-a',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [existing],
      hierarchyType: 'function',
    };

    const result = planRestructure(context);

    // Both codes must start with the target path
    expect(result.newNodeCode).toMatch(/^A\.LLM\.T\./);
    for (const mutation of result.mutations) {
      expect(mutation.newCode).toMatch(/^A\.LLM\.T\./);
    }
  });

  it('generates mutation for each node when restructuring needed', () => {
    const newNode = makeNode({ id: 'node-new', title: 'New Tool', company: 'CompanyA' });
    const existing = makeNode({ id: 'node-old', title: 'Old Tool', company: 'CompanyB' });
    const context: RestructureContext = {
      newNodeId: 'node-new',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [existing],
      hierarchyType: 'function',
    };

    const result = planRestructure(context);

    // Should have mutations for both nodes
    expect(result.mutations.length).toBeGreaterThanOrEqual(2);
    const mutationIds = result.mutations.map(m => m.nodeId);
    expect(mutationIds).toContain('node-new');
    expect(mutationIds).toContain('node-old');
  });

  it('sets restructuringNeeded to true when multiple nodes', () => {
    const newNode = makeNode({ id: 'node-new' });
    const existing = makeNode({ id: 'node-existing' });
    const context: RestructureContext = {
      newNodeId: 'node-new',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [existing],
      hierarchyType: 'function',
    };

    const result = planRestructure(context);
    expect(result.restructuringNeeded).toBe(true);
  });

  it('all generated codes are unique', () => {
    const nodes = Array.from({ length: 5 }, (_, i) =>
      makeNode({ id: `node-${i}`, title: `Article ${i}`, company: `Company${i}` })
    );
    const [newNode, ...rest] = nodes;
    const context: RestructureContext = {
      newNodeId: newNode.id,
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: rest,
      hierarchyType: 'function',
    };

    const result = planRestructure(context);
    const codes = result.mutations.map(m => m.newCode);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('works with organization hierarchy type', () => {
    const newNode = makeNode({ id: 'org-node', title: 'Org Article' });
    const context: RestructureContext = {
      newNodeId: 'org-node',
      newNodeAttributes: newNode,
      targetPath: 'ANTH.LLM.T',
      existingNodes: [],
      hierarchyType: 'organization',
    };

    const result = planRestructure(context);
    expect(result.newNodeCode).toBe('ANTH.LLM.T.1');
    expect(result.mutations[0].hierarchyType).toBe('organization');
  });

  it('returns empty subcategoriesCreated when single node', () => {
    const newNode = makeNode({ id: 'solo-node' });
    const context: RestructureContext = {
      newNodeId: 'solo-node',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [],
      hierarchyType: 'function',
    };

    const result = planRestructure(context);
    expect(result.subcategoriesCreated).toHaveLength(0);
  });

  it('handles many nodes without infinite recursion', () => {
    const existingNodes = Array.from({ length: 20 }, (_, i) =>
      makeNode({ id: `mass-node-${i}`, title: `Item ${i}` })
    );
    const newNode = makeNode({ id: 'mass-new', title: 'New Item' });
    const context: RestructureContext = {
      newNodeId: 'mass-new',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: existingNodes,
      hierarchyType: 'function',
    };

    expect(() => planRestructure(context)).not.toThrow();
    const result = planRestructure(context);
    expect(result.newNodeCode).toMatch(/^A\.LLM\.T\./);
  });

  it('new node code matches a mutation entry', () => {
    const newNode = makeNode({ id: 'check-node', title: 'Check Article' });
    const existing = makeNode({ id: 'existing-check' });
    const context: RestructureContext = {
      newNodeId: 'check-node',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [existing],
      hierarchyType: 'function',
    };

    const result = planRestructure(context);
    const newNodeMutation = result.mutations.find(m => m.nodeId === 'check-node');
    expect(newNodeMutation).toBeDefined();
    expect(newNodeMutation?.newCode).toBe(result.newNodeCode);
  });
});

// ============================================================
// validateRestructure
// ============================================================

describe('validateRestructure', () => {
  it('returns valid for a well-formed single mutation', () => {
    const result = {
      newNodeCode: 'A.LLM.T.1',
      mutations: [{
        nodeId: 'node-1',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        hierarchyType: 'function' as const,
      }],
      subcategoriesCreated: [],
      restructuringNeeded: false,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('detects duplicate new codes in mutations', () => {
    const result = {
      newNodeCode: 'A.LLM.T.1',
      mutations: [
        { nodeId: 'node-1', oldCode: null, newCode: 'A.LLM.T.1', hierarchyType: 'function' as const },
        { nodeId: 'node-2', oldCode: null, newCode: 'A.LLM.T.1', hierarchyType: 'function' as const },
      ],
      subcategoriesCreated: [],
      restructuringNeeded: true,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some(i => i.includes('Duplicate code'))).toBe(true);
  });

  it('detects empty code in mutations', () => {
    const result = {
      newNodeCode: '',
      mutations: [{
        nodeId: 'node-1',
        oldCode: null,
        newCode: '',
        hierarchyType: 'function' as const,
      }],
      subcategoriesCreated: [],
      restructuringNeeded: false,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some(i => i.includes('Empty code'))).toBe(true);
  });

  it('detects whitespace-only code as empty', () => {
    const result = {
      newNodeCode: '   ',
      mutations: [{
        nodeId: 'node-1',
        oldCode: null,
        newCode: '   ',
        hierarchyType: 'function' as const,
      }],
      subcategoriesCreated: [],
      restructuringNeeded: false,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some(i => i.includes('Empty code'))).toBe(true);
  });

  it('detects invalid code format', () => {
    const result = {
      newNodeCode: 'invalid-code',
      mutations: [{
        nodeId: 'node-1',
        oldCode: null,
        newCode: 'invalid-code',
        hierarchyType: 'function' as const,
      }],
      subcategoriesCreated: [],
      restructuringNeeded: false,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some(i => i.includes('Invalid code format'))).toBe(true);
  });

  it('accepts valid format A.LLM.T.1', () => {
    const result = {
      newNodeCode: 'A.LLM.T.1',
      mutations: [{
        nodeId: 'node-1',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        hierarchyType: 'function' as const,
      }],
      subcategoriesCreated: [],
      restructuringNeeded: false,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(true);
  });

  it('accepts valid format with subcategory chain A.LLM.T.1.2', () => {
    const result = {
      newNodeCode: 'A.LLM.T.1.2',
      mutations: [
        { nodeId: 'node-1', oldCode: null, newCode: 'A.LLM.T.1.2', hierarchyType: 'function' as const },
        { nodeId: 'node-2', oldCode: null, newCode: 'A.LLM.T.2.1', hierarchyType: 'function' as const },
      ],
      subcategoriesCreated: ['Split by brand: OpenAI, Anthropic'],
      restructuringNeeded: true,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(true);
  });

  it('collects multiple issues at once', () => {
    const result = {
      newNodeCode: '',
      mutations: [
        { nodeId: 'node-1', oldCode: null, newCode: '', hierarchyType: 'function' as const },
        { nodeId: 'node-2', oldCode: null, newCode: 'bad format!', hierarchyType: 'function' as const },
        { nodeId: 'node-3', oldCode: null, newCode: 'bad format!', hierarchyType: 'function' as const },
      ],
      subcategoriesCreated: [],
      restructuringNeeded: true,
    };

    const validation = validateRestructure(result);
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('returns valid for empty mutations array', () => {
    const result = {
      newNodeCode: '',
      mutations: [],
      subcategoriesCreated: [],
      restructuringNeeded: false,
    };

    // No mutations = no issues to find
    const validation = validateRestructure(result);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('validates planRestructure output for single node', () => {
    const newNode = makeNode({ id: 'valid-node', title: 'Valid Article' });
    const context: RestructureContext = {
      newNodeId: 'valid-node',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [],
      hierarchyType: 'function',
    };

    const planned = planRestructure(context);
    const validation = validateRestructure(planned);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('validates planRestructure output for two nodes', () => {
    const newNode = makeNode({ id: 'node-x', title: 'Article X', company: 'CompX' });
    const existing = makeNode({ id: 'node-y', title: 'Article Y', company: 'CompY' });
    const context: RestructureContext = {
      newNodeId: 'node-x',
      newNodeAttributes: newNode,
      targetPath: TARGET_PATH,
      existingNodes: [existing],
      hierarchyType: 'function',
    };

    const planned = planRestructure(context);
    const validation = validateRestructure(planned);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });
});
