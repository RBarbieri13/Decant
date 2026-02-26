#!/usr/bin/env tsx
/**
 * Regenerate all hierarchy codes for nodes in the database.
 * Run: DATABASE_PATH=./data/decant.db npx tsx scripts/regenerate-hierarchy.ts
 */

import path from 'path';

// Set database path to local data directory
process.env.DATABASE_PATH = path.resolve(import.meta.dirname || '.', '..', 'data', 'decant.db');

import { regenerateAllHierarchyCodes, validateHierarchyCodeUniqueness } from '../src/backend/services/hierarchy/code_generator.js';

console.log('Regenerating all hierarchy codes...');
const results = regenerateAllHierarchyCodes();
console.log(`Updated ${results.length} nodes`);

for (const r of results) {
  console.log(`  ${r.nodeId.slice(0, 8)}... | SEG=${r.segmentCode} CAT=${r.categoryCode} TYP=${r.contentTypeCode} | func=${r.functionHierarchyCode} | org=${r.organizationHierarchyCode}`);
}

// Validate uniqueness
const validation = validateHierarchyCodeUniqueness();
if (validation.functionDuplicates.length > 0) {
  console.warn('WARNING: Function hierarchy duplicates found:');
  for (const d of validation.functionDuplicates) {
    console.warn(`  Code ${d.code}: ${d.nodeIds.length} nodes`);
  }
} else {
  console.log('All function hierarchy codes are unique.');
}

if (validation.organizationDuplicates.length > 0) {
  console.warn('WARNING: Organization hierarchy duplicates found:');
  for (const d of validation.organizationDuplicates) {
    console.warn(`  Code ${d.code}: ${d.nodeIds.length} nodes`);
  }
} else {
  console.log('All organization hierarchy codes are unique.');
}

console.log('Done!');
