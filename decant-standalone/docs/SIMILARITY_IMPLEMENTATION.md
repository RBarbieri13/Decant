# Node Similarity Implementation

## Overview

The node similarity system tracks and queries similarity relationships between nodes in the Decant application. It enables features like "similar items", "related content", and recommendation systems.

## Database Schema

### Table: `node_similarity`

```sql
CREATE TABLE node_similarity (
  id TEXT PRIMARY KEY,
  node_a_id TEXT NOT NULL,
  node_b_id TEXT NOT NULL,
  similarity_score REAL NOT NULL CHECK(similarity_score >= 0.0 AND similarity_score <= 1.0),
  computation_method TEXT NOT NULL DEFAULT 'jaccard_weighted',
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_a_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (node_b_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(node_a_id, node_b_id),
  CHECK(node_a_id < node_b_id)
);
```

### Key Design Decisions

1. **Symmetric Storage**: Relationships are stored with `node_a_id < node_b_id` to prevent duplicates and ensure consistency
2. **Score Range**: Similarity scores are constrained to [0.0, 1.0] where 0.0 = completely dissimilar, 1.0 = identical
3. **Cascade Deletion**: When a node is deleted, all its similarity relationships are automatically removed
4. **Method Tracking**: The `computation_method` field tracks how similarity was calculated for debugging and comparison

### Indexes

Five indexes optimize common query patterns:

```sql
-- Lookup similarities for node_a
CREATE INDEX idx_similarity_node_a ON node_similarity(node_a_id);

-- Lookup similarities for node_b
CREATE INDEX idx_similarity_node_b ON node_similarity(node_b_id);

-- Find top similar items globally
CREATE INDEX idx_similarity_score ON node_similarity(similarity_score DESC);

-- Find top similar items for specific node_a
CREATE INDEX idx_similarity_node_a_score ON node_similarity(node_a_id, similarity_score DESC);

-- Find top similar items for specific node_b
CREATE INDEX idx_similarity_node_b_score ON node_similarity(node_b_id, similarity_score DESC);
```

## API Functions

### Core Operations

#### `setSimilarity(nodeAId, nodeBId, score, method?)`

Set or update similarity between two nodes.

```typescript
import { setSimilarity } from './database';

// Set similarity using cosine method
setSimilarity('node-123', 'node-456', 0.85, 'cosine');

// Update existing similarity
setSimilarity('node-123', 'node-456', 0.92, 'tfidf');
```

**Parameters:**
- `nodeAId`: First node ID
- `nodeBId`: Second node ID
- `score`: Similarity score (0.0 to 1.0)
- `method`: Computation method (default: 'jaccard_weighted')

**Throws:**
- Error if score is outside [0.0, 1.0]
- Error if nodeAId === nodeBId (self-similarity)

#### `getSimilarNodes(nodeId, limit?)`

Get top N similar nodes for a given node, sorted by similarity score descending.

```typescript
import { getSimilarNodes } from './database';

// Get top 10 similar nodes
const similar = getSimilarNodes('node-123', 10);

for (const item of similar) {
  console.log(`${item.node_id}: ${item.similarity_score}`);
}
```

**Parameters:**
- `nodeId`: Node to find similar items for
- `limit`: Maximum results (default: 10)

**Returns:** Array of `SimilarNode` objects with:
- `node_id`: ID of similar node
- `similarity_score`: Similarity score
- `computation_method`: How similarity was computed
- `computed_at`: Timestamp of computation

#### `getSimilarity(nodeAId, nodeBId)`

Get specific similarity record between two nodes.

```typescript
import { getSimilarity } from './database';

const record = getSimilarity('node-123', 'node-456');
if (record) {
  console.log(`Similarity: ${record.similarity_score}`);
}
```

**Returns:** `SimilarityRecord` or `null` if no relationship exists

#### `deleteSimilarityForNode(nodeId)`

Delete all similarity relationships for a node.

```typescript
import { deleteSimilarityForNode } from './database';

const deleted = deleteSimilarityForNode('node-123');
console.log(`Removed ${deleted} similarity records`);
```

**Returns:** Number of records deleted

### Batch Operations

#### `batchSetSimilarity(similarities)`

Set multiple similarities in a single transaction (atomic operation).

```typescript
import { batchSetSimilarity } from './database';

const similarities = [
  { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.85, method: 'cosine' },
  { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.72, method: 'cosine' },
  { nodeAId: 'node-2', nodeBId: 'node-3', score: 0.68, method: 'cosine' },
];

const count = batchSetSimilarity(similarities);
console.log(`Updated ${count} similarity records`);
```

**Features:**
- All-or-nothing transaction (atomicity)
- Skips invalid scores silently
- Skips self-similarities silently
- Returns count of successful inserts/updates

### Analytics

#### `getAverageSimilarity(nodeId)`

Calculate average similarity score for a node across all its relationships.

```typescript
import { getAverageSimilarity } from './database';

const avg = getAverageSimilarity('node-123');
if (avg !== null) {
  console.log(`Average similarity: ${avg.toFixed(3)}`);
}
```

**Returns:** Average score or `null` if no similarities exist

#### `getSimilarityStats()`

Get global statistics about similarity data.

```typescript
import { getSimilarityStats } from './database';

const stats = getSimilarityStats();
console.log(`Total: ${stats.count}`);
console.log(`Range: ${stats.min_score} - ${stats.max_score}`);
console.log(`Average: ${stats.avg_score}`);
```

**Returns:**
```typescript
{
  count: number;
  min_score: number | null;
  max_score: number | null;
  avg_score: number | null;
}
```

#### `countSimilarities()`

Count total number of similarity records.

```typescript
import { countSimilarities } from './database';

const total = countSimilarities();
console.log(`Total similarity records: ${total}`);
```

### Advanced Queries

#### `findCommonSimilarNodes(nodeIds, minScore?, limit?)`

Find nodes similar to multiple target nodes (intersection of similar items).

```typescript
import { findCommonSimilarNodes } from './database';

// Find items similar to both node-1 and node-2
const common = findCommonSimilarNodes(
  ['node-1', 'node-2'],
  0.5,  // Minimum similarity score
  10    // Max results
);

for (const item of common) {
  console.log(`${item.node_id}: matches ${item.match_count} targets, total score ${item.total_score}`);
}
```

**Use Cases:**
- "People who liked X and Y also liked Z"
- Finding items related to a collection
- Multi-criteria recommendations

**Returns:** Array sorted by total_score DESC, then match_count DESC

#### `getAllSimilarities(limit?)`

Get all similarity records (use with caution on large datasets).

```typescript
import { getAllSimilarities } from './database';

const all = getAllSimilarities(1000); // Limit to 1000 records
```

### Utility Functions

#### `normalizeNodePair(nodeAId, nodeBId)`

Normalize node pair to ensure consistent ordering.

```typescript
import { normalizeNodePair } from './database';

const [a, b] = normalizeNodePair('node-2', 'node-1');
// Returns: ['node-1', 'node-2'] (always sorted)
```

**Purpose:** Internal helper to maintain `node_a_id < node_b_id` constraint

## Computation Methods

The system supports multiple similarity computation methods:

| Method | Description | Use Case |
|--------|-------------|----------|
| `jaccard_weighted` | Weighted Jaccard similarity | Default, good for tag-based similarity |
| `cosine` | Cosine similarity | Text/vector embeddings |
| `tfidf` | TF-IDF based similarity | Document similarity |
| `manual` | Manually set by user | User-curated relationships |

## Migration

The similarity feature is added via migration `008_add_similarity.ts`:

```bash
# Migration runs automatically on app startup
# Or manually via CLI:
npm run db:migrate
```

### Rollback

```typescript
import { rollbackMigration } from './database';

rollbackMigration(db, '008_add_similarity');
```

**Note:** Rollback will fail if later migrations depend on this one.

## Usage Examples

### Basic Similarity Tracking

```typescript
import { setSimilarity, getSimilarNodes } from './database';

// After computing similarity between nodes
setSimilarity('article-1', 'article-2', 0.87, 'tfidf');
setSimilarity('article-1', 'article-3', 0.72, 'tfidf');

// Later, get similar articles
const similar = getSimilarNodes('article-1', 5);
console.log('Top 5 similar articles:', similar);
```

### Batch Computation

```typescript
import { batchSetSimilarity } from './database';

async function computeAllSimilarities(nodes) {
  const similarities = [];

  // Compute similarities (your algorithm here)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const score = computeSimilarity(nodes[i], nodes[j]);
      if (score > 0.5) {  // Only store meaningful similarities
        similarities.push({
          nodeAId: nodes[i].id,
          nodeBId: nodes[j].id,
          score,
          method: 'cosine'
        });
      }
    }
  }

  // Store all at once (atomic)
  const count = batchSetSimilarity(similarities);
  console.log(`Stored ${count} similarity relationships`);
}
```

### Recommendation System

```typescript
import { getSimilarNodes, findCommonSimilarNodes } from './database';

// Recommend based on single item
function recommendSimilar(nodeId: string) {
  return getSimilarNodes(nodeId, 10);
}

// Recommend based on user's collection
function recommendForCollection(userNodeIds: string[]) {
  return findCommonSimilarNodes(
    userNodeIds,
    0.6,  // Minimum similarity
    20    // Top 20 recommendations
  );
}
```

### Cleaning Up

```typescript
import { deleteSimilarityForNode } from './database';

// When deleting a node, clean up its similarities
function deleteNodeWithSimilarities(nodeId: string) {
  // Note: CASCADE DELETE handles this automatically!
  // But you can manually call if needed:
  deleteSimilarityForNode(nodeId);
  deleteNode(nodeId);
}
```

## Performance Considerations

### Index Usage

The indexes are designed for these common query patterns:

1. **Find similar nodes for one node**: Uses `idx_similarity_node_a_score` or `idx_similarity_node_b_score`
2. **Find top similar pairs globally**: Uses `idx_similarity_score`
3. **Batch lookups**: Uses `idx_similarity_node_a` or `idx_similarity_node_b`

### Scaling Guidelines

- **Small datasets (<10k nodes)**: All operations are fast, no optimization needed
- **Medium datasets (10k-100k nodes)**: Use batch operations, consider pruning low-score similarities
- **Large datasets (>100k nodes)**:
  - Only store similarities above threshold (e.g., >0.5)
  - Consider periodic cleanup of old/stale similarities
  - Use background jobs for computation
  - Consider partitioning by node type or category

### Storage Optimization

For N nodes, maximum possible similarity pairs = N*(N-1)/2

Example storage requirements:
- 1,000 nodes: max 499,500 pairs
- 10,000 nodes: max 49,995,000 pairs

**Recommendations:**
- Only store meaningful similarities (score > threshold)
- Prune low-value relationships periodically
- Use TTL if similarity changes over time

## Testing

Comprehensive test suite in `similarity.spec.ts`:

```bash
npm test -- similarity.spec.ts
```

Tests cover:
- Basic CRUD operations
- Node pair normalization
- Batch operations
- Statistics and analytics
- Advanced queries
- Edge cases (invalid scores, self-similarity, etc.)

## Type Definitions

```typescript
interface SimilarityRecord {
  id: string;
  node_a_id: string;
  node_b_id: string;
  similarity_score: number;
  computation_method: string;
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

## Future Enhancements

Potential improvements:

1. **Incremental Updates**: Track node changes and update only affected similarities
2. **Similarity Decay**: Time-based decay for dynamic content
3. **Method Comparison**: A/B testing different computation methods
4. **Confidence Scores**: Track confidence in similarity calculation
5. **Explanation**: Store why nodes are similar (matching features)
6. **Graph Queries**: Find similarity paths, clusters, communities
7. **Caching**: Cache top-N similar nodes for frequently accessed items

## Files

- `/src/backend/database/migrations/008_add_similarity.ts` - Database migration
- `/src/backend/database/similarity.ts` - Core implementation
- `/src/backend/database/similarity.spec.ts` - Test suite
- `/src/backend/database/index.ts` - Exports (updated)
- `/src/backend/database/migrations/runner.ts` - Migration registry (updated)
