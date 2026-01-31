# Node Similarity Quick Reference

## Installation

The similarity system is automatically available after migration `008_add_similarity` runs.

```bash
# Migrations run automatically on app startup
npm run server:start
```

## Quick Start

```typescript
import {
  setSimilarity,
  getSimilarNodes,
  batchSetSimilarity
} from './database';

// Set similarity between two nodes
setSimilarity('node-1', 'node-2', 0.85, 'cosine');

// Get similar nodes
const similar = getSimilarNodes('node-1', 10);

// Batch insert
batchSetSimilarity([
  { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.85 },
  { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.72 },
]);
```

## Common Operations

### Store Similarity

```typescript
// Basic
setSimilarity('node-a', 'node-b', 0.85);

// With method
setSimilarity('node-a', 'node-b', 0.85, 'cosine');

// Batch (atomic transaction)
const count = batchSetSimilarity([
  { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.9 },
  { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.8 },
]);
```

### Query Similarity

```typescript
// Get top N similar nodes
const similar = getSimilarNodes('node-1', 5);

// Get specific relationship
const record = getSimilarity('node-1', 'node-2');

// Get average similarity
const avg = getAverageSimilarity('node-1');
```

### Delete Similarity

```typescript
// Delete all relationships for a node
const deleted = deleteSimilarityForNode('node-1');
```

### Analytics

```typescript
// Global statistics
const stats = getSimilarityStats();
// Returns: { count, min_score, max_score, avg_score }

// Total count
const total = countSimilarities();

// All records (limited)
const all = getAllSimilarities(100);
```

### Advanced Queries

```typescript
// Find items similar to multiple targets
const common = findCommonSimilarNodes(
  ['node-1', 'node-2', 'node-3'],
  0.5,  // min score
  10    // limit
);
```

## Data Types

```typescript
interface SimilarityRecord {
  id: string;
  node_a_id: string;
  node_b_id: string;
  similarity_score: number;      // 0.0 to 1.0
  computation_method: string;    // 'jaccard_weighted', 'cosine', etc.
  computed_at: string;
}

interface SimilarNode {
  node_id: string;
  similarity_score: number;
  computation_method: string;
  computed_at: string;
}

type ComputationMethod =
  | 'jaccard_weighted'
  | 'cosine'
  | 'tfidf'
  | 'manual';
```

## Constraints

- **Score Range**: 0.0 to 1.0 (enforced by CHECK constraint)
- **No Self-Similarity**: Cannot set similarity between a node and itself
- **Unique Pairs**: Each node pair can have only one similarity record
- **Normalized Storage**: Always stored with node_a_id < node_b_id

## Performance Tips

1. **Use Batch Operations**: `batchSetSimilarity()` is much faster than individual calls
2. **Filter Low Scores**: Only store similarities above a meaningful threshold (e.g., 0.3)
3. **Limit Results**: Use the `limit` parameter to avoid loading too many records
4. **Index Coverage**: All common queries are covered by indexes

## Common Patterns

### Recommendation System

```typescript
function getRecommendations(userId: string) {
  // Get user's liked items
  const userItems = getUserLikedItems(userId);

  // Find items similar to user's collection
  return findCommonSimilarNodes(
    userItems.map(item => item.id),
    0.5,
    20
  );
}
```

### Similar Items Widget

```typescript
function renderSimilarItems(nodeId: string) {
  const similar = getSimilarNodes(nodeId, 5);

  return similar.map(item => ({
    ...getNodeById(item.node_id),
    similarity: item.similarity_score
  }));
}
```

### Periodic Cleanup

```typescript
async function cleanupStaleSimilarities() {
  // Custom SQL to delete old/low-quality records
  const db = getDatabase();
  db.prepare(`
    DELETE FROM node_similarity
    WHERE similarity_score < 0.3
       OR computed_at < datetime('now', '-90 days')
  `).run();
}
```

## Error Handling

```typescript
try {
  setSimilarity('node-1', 'node-2', 1.5); // Invalid score
} catch (error) {
  // Error: Similarity score must be between 0.0 and 1.0
}

try {
  setSimilarity('node-1', 'node-1', 0.5); // Self-similarity
} catch (error) {
  // Error: Cannot set similarity between a node and itself
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { setSimilarity, getSimilarNodes } from './database';

describe('Similarity Features', () => {
  it('should store and retrieve similarity', () => {
    setSimilarity('node-1', 'node-2', 0.85);
    const similar = getSimilarNodes('node-1');

    expect(similar[0].node_id).toBe('node-2');
    expect(similar[0].similarity_score).toBe(0.85);
  });
});
```

## Migration Status

Check if migration is applied:

```typescript
import { getMigrationStatus } from './database';

const status = getMigrationStatus(db);
const similarityMigration = status.find(m => m.name === '008_add_similarity');

if (similarityMigration?.applied) {
  console.log('Similarity system ready!');
}
```

## Rollback (Development Only)

```typescript
import { rollbackMigration } from './database';

// WARNING: This deletes all similarity data!
rollbackMigration(db, '008_add_similarity');
```

## Example Computation Algorithm

```typescript
function computeCosineSimilarity(
  vector1: number[],
  vector2: number[]
): number {
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }

  const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Use with similarity system
const score = computeCosineSimilarity(embedding1, embedding2);
setSimilarity(node1.id, node2.id, score, 'cosine');
```

## API Routes (Optional)

If exposing via REST API:

```typescript
// GET /api/nodes/:id/similar
router.get('/nodes/:id/similar', (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;

  const similar = getSimilarNodes(id, limit);
  res.json(similar);
});

// POST /api/similarity
router.post('/similarity', (req, res) => {
  const { nodeAId, nodeBId, score, method } = req.body;

  const record = setSimilarity(nodeAId, nodeBId, score, method);
  res.json(record);
});

// GET /api/similarity/stats
router.get('/similarity/stats', (req, res) => {
  const stats = getSimilarityStats();
  res.json(stats);
});
```

## Troubleshooting

### No similarities found

```typescript
// Check if data exists
const count = countSimilarities();
console.log(`Total similarities: ${count}`);

// Check specific pair
const record = getSimilarity('node-1', 'node-2');
console.log('Record:', record);
```

### Slow queries

```sql
-- Verify indexes exist
SELECT name FROM sqlite_master
WHERE type='index' AND tbl_name='node_similarity';

-- Should return:
-- idx_similarity_node_a
-- idx_similarity_node_b
-- idx_similarity_score
-- idx_similarity_node_a_score
-- idx_similarity_node_b_score
```

### Duplicate entries

```typescript
// The system prevents duplicates automatically via:
// 1. UNIQUE(node_a_id, node_b_id) constraint
// 2. normalizeNodePair() function
// 3. INSERT OR REPLACE for upserts
```

## Files Reference

- **Migration**: `/src/backend/database/migrations/008_add_similarity.ts`
- **Implementation**: `/src/backend/database/similarity.ts`
- **Tests**: `/src/backend/database/similarity.spec.ts`
- **Exports**: `/src/backend/database/index.ts`
- **Example**: `/docs/examples/similarity-usage-example.ts`
- **Full Docs**: `/docs/SIMILARITY_IMPLEMENTATION.md`
