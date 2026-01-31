# Similarity Computer Service

Computes similarity between nodes based on shared metadata codes using a weighted Jaccard similarity algorithm.

## Overview

The Similarity Computer Service is part of the Decant application's Phase 3 processing pipeline. It runs after Phase 2 enrichment has assigned metadata codes to nodes, computing how similar each node is to others based on their shared metadata.

## Algorithm: Weighted Jaccard Similarity

The service uses a weighted Jaccard similarity metric that considers both:
1. Which metadata codes are shared between nodes
2. The importance (weight) of each code type

### Formula

```
similarity = sum(min(weight_A, weight_B)) / sum(max(weight_A, weight_B))
```

Where:
- `weight_A` = weight of a code in node A (or 0 if not present)
- `weight_B` = weight of a code in node B (or 0 if not present)
- The sum is computed over all unique codes present in either node

### Metadata Weights

Different code types have different importance weights:

| Type | Weight | Description |
|------|--------|-------------|
| ORG (Organization) | 2.0 | Highest - organization/company is very important |
| FNC (Function) | 1.5 | Important - what the content does |
| DOM (Domain) | 1.5 | Important - field of expertise |
| IND (Industry) | 1.5 | Important - industry sector |
| TEC (Technology) | 1.0 | Moderate - tech stack/tools |
| CON (Concept) | 1.0 | Moderate - abstract themes |
| AUD (Audience) | 1.0 | Moderate - target users |
| PLT (Platform) | 1.0 | Moderate - deployment target |
| PRC (Pricing) | 0.5 | Lower - cost model |
| LIC (License) | 0.5 | Lower - software license |
| LNG (Language) | 0.5 | Lower - human language |

### Example Calculation

**Node A** has metadata:
- ORG: OPENAI (weight 2.0)
- DOM: AI (weight 1.5)
- TEC: GPT (weight 1.0)

**Node B** has metadata:
- ORG: OPENAI (weight 2.0)
- DOM: AI (weight 1.5)
- TEC: PYTORCH (weight 1.0)

Calculation:
- OPENAI: min(2.0, 2.0) / max(2.0, 2.0) = 2.0 / 2.0
- AI: min(1.5, 1.5) / max(1.5, 1.5) = 1.5 / 1.5
- GPT: min(1.0, 0) / max(1.0, 0) = 0 / 1.0
- PYTORCH: min(0, 1.0) / max(0, 1.0) = 0 / 1.0

Numerator: 2.0 + 1.5 + 0 + 0 = 3.5
Denominator: 2.0 + 1.5 + 1.0 + 1.0 = 5.5

**Similarity = 3.5 / 5.5 ≈ 0.636**

## API Reference

### Core Functions

#### `computeSimilarity(nodeAId: string, nodeBId: string): SimilarityResult | null`

Compute similarity between two specific nodes.

**Returns:**
```typescript
{
  nodeAId: string;
  nodeBId: string;
  score: number;        // 0.0 to 1.0
  sharedCodes: string[]; // Codes present in both nodes
  method: 'jaccard_weighted';
}
```

Returns `null` if either node has no metadata or if there are no shared codes.

**Example:**
```typescript
import { computeSimilarity } from './services/similarity';

const result = computeSimilarity('node-123', 'node-456');
if (result) {
  console.log(`Similarity: ${result.score.toFixed(3)}`);
  console.log(`Shared codes: ${result.sharedCodes.join(', ')}`);
}
```

#### `computeSimilarityForNode(nodeId: string, options?: ComputeOptions): Promise<SimilarityResult[]>`

Compute similarity for a node against ALL other nodes in the database.

**Options:**
```typescript
{
  minScore?: number;      // Default: 0.01
  logProgress?: boolean;  // Default: true
  batchSize?: number;     // Default: 100
}
```

**Example:**
```typescript
const results = await computeSimilarityForNode('node-123', {
  minScore: 0.1,
  logProgress: true
});

console.log(`Found ${results.length} similar nodes`);
```

#### `batchComputeSimilarities(nodeIds: string[], options?: ComputeOptions): Promise<BatchComputeResult>`

Efficiently compute similarities for multiple nodes.

**Returns:**
```typescript
{
  computed: number;   // Total comparisons made
  stored: number;     // Similarities above threshold
  skipped: number;    // Below threshold or no shared codes
  errors: number;     // Computation errors
  durationMs: number; // Total time taken
}
```

**Example:**
```typescript
const nodeIds = ['node-1', 'node-2', 'node-3'];
const result = await batchComputeSimilarities(nodeIds);

console.log(`Computed ${result.computed} similarities`);
console.log(`Stored ${result.stored} above threshold`);
```

#### `recomputeAllSimilarities(options?: ComputeOptions): Promise<BatchComputeResult>`

Recompute ALL similarities in the database from scratch.

**Warning:** This deletes existing similarities and can be slow on large databases.

**Example:**
```typescript
const result = await recomputeAllSimilarities({
  minScore: 0.05,
  logProgress: true
});

console.log(`Recomputed ${result.stored} similarities`);
```

#### `updateSimilaritiesForNode(nodeId: string, options?: ComputeOptions): Promise<SimilarityResult[]>`

Update similarities for a node after its metadata has changed.

More efficient than full recomputation - only updates similarities involving this specific node.

**Example:**
```typescript
// After updating node metadata
await setNodeMetadata(nodeId, newCodes);

// Update its similarities
const results = await updateSimilaritiesForNode(nodeId);
console.log(`Updated ${results.length} similarities`);
```

### Utility Functions

#### `getDetailedSimilarity(nodeAId: string, nodeBId: string): SimilarityResult | null`

Get detailed similarity including shared codes (always recomputes fresh).

#### `getMetadataWeight(type: MetadataCodeType): number`

Get the weight for a specific metadata code type.

#### `getAllMetadataWeights(): Record<MetadataCodeType, number>`

Get all metadata weights.

#### `getMinimumThreshold(): number`

Get the minimum similarity threshold (0.01).

## Usage in Processing Pipeline

### Phase 2 → Phase 3 Integration

After Phase 2 enrichment assigns metadata codes to a node:

```typescript
import { enrichNode } from './services/phase2_enricher';
import { updateSimilaritiesForNode } from './services/similarity';

// Phase 2: Enrich node with metadata
const enrichmentResult = await enrichNode(nodeId);

if (enrichmentResult.success) {
  // Phase 3: Compute similarities
  await updateSimilaritiesForNode(nodeId);
}
```

### Batch Processing

For processing many nodes (e.g., backfill):

```typescript
import { getAllNodes } from './database/nodes';
import { batchComputeSimilarities } from './services/similarity';

const allNodes = getAllNodes();
const nodeIds = allNodes.map(n => n.id as string);

const result = await batchComputeSimilarities(nodeIds, {
  minScore: 0.05,
  batchSize: 50
});

console.log(`Processed ${nodeIds.length} nodes`);
console.log(`Created ${result.stored} similarity relationships`);
```

## Performance Considerations

### Minimum Score Threshold

Only similarities with scores ≥ 0.01 are stored by default. This:
- Reduces storage for noise
- Improves query performance
- Focuses on meaningful relationships

You can adjust this threshold:
```typescript
computeSimilarityForNode(nodeId, { minScore: 0.1 }); // Stricter
```

### Batch Size

For large datasets, adjust batch size to balance memory and performance:
```typescript
batchComputeSimilarities(nodeIds, { batchSize: 200 }); // Larger batches
```

### Complexity

- **Single node**: O(N × M) where N = total nodes, M = avg metadata per node
- **All nodes**: O(N² × M) - grows quadratically with node count
- **Memory**: Batch operations process in chunks to avoid memory issues

## Storage

Similarities are stored in the `node_similarity` table with:
- Symmetric storage (node_a_id < node_b_id)
- Automatic deduplication via UNIQUE constraint
- Cascading deletes when nodes are removed
- Indexed for fast queries

## Querying Similarities

Use the database operations for efficient queries:

```typescript
import { getSimilarNodes } from './database/similarity';

// Get top 10 similar nodes
const similar = getSimilarNodes('node-123', 10);

for (const item of similar) {
  console.log(`${item.node_id}: ${item.similarity_score.toFixed(3)}`);
}
```

## Testing

Run tests with:
```bash
npm test -- similarity/computer.spec.ts
```

Tests cover:
- Basic similarity computation
- Weight application
- Edge cases (no metadata, no shared codes)
- Perfect similarity (identical metadata)
- Partial overlap

## Future Enhancements

Potential improvements:
1. **Incremental updates**: Track metadata changes and only recompute affected similarities
2. **Alternative algorithms**: Add cosine similarity, TF-IDF options
3. **Time decay**: Weight recent metadata changes higher
4. **User feedback**: Incorporate manual similarity adjustments
5. **Clustering**: Group highly similar nodes automatically
