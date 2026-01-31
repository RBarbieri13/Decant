// ============================================================
// Hierarchy Audit Usage Examples
// ============================================================

import {
  logCodeChange,
  getNodeHistory,
  getRecentChanges,
  getChangesByType,
  getBatchChanges,
  getChangesByTrigger,
  getChangeStatistics,
  type LogCodeChangeParams,
} from './audit.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Example 1: Log initial code assignment during import
 */
export function exampleInitialAssignment() {
  const nodeId = 'node-abc-123';

  logCodeChange({
    nodeId,
    hierarchyType: 'function',
    oldCode: null, // null for initial assignment
    newCode: 'A.LLM.T.1',
    changeType: 'created',
    triggeredBy: 'import',
    reason: 'AI classified as LLM tutorial content',
    metadata: {
      confidence: 0.95,
      modelVersion: 'gpt-4',
      importBatchId: 'batch-xyz-789',
    },
  });

  console.log('✓ Logged initial code assignment');
}

/**
 * Example 2: Log user moving a node in the hierarchy
 */
export function exampleUserMove() {
  const nodeId = 'node-abc-123';

  logCodeChange({
    nodeId,
    hierarchyType: 'function',
    oldCode: 'A.LLM.T.1',
    newCode: 'A.LLM.T.2',
    changeType: 'moved',
    triggeredBy: 'user_move',
    reason: 'User repositioned via drag-and-drop',
    metadata: {
      userId: 'user-123',
      timestamp: new Date().toISOString(),
    },
  });

  console.log('✓ Logged user move operation');
}

/**
 * Example 3: Log batch restructure operation
 */
export function exampleBatchRestructure() {
  const batchId = uuidv4();
  const affectedNodes = [
    { id: 'node-1', oldCode: 'A.LLM.T.1', newCode: 'A.LLM.T.1.a' },
    { id: 'node-2', oldCode: 'A.LLM.T.2', newCode: 'A.LLM.T.1.b' },
    { id: 'node-3', oldCode: 'A.LLM.T.3', newCode: 'A.LLM.T.2' },
  ];

  for (const node of affectedNodes) {
    logCodeChange({
      nodeId: node.id,
      hierarchyType: 'function',
      oldCode: node.oldCode,
      newCode: node.newCode,
      changeType: 'restructured',
      triggeredBy: 'restructure',
      reason: 'Reorganized LLM category hierarchy',
      relatedNodeIds: affectedNodes.map(n => n.id).filter(id => id !== node.id),
      metadata: {
        batchId,
        operation: 'category_split',
        totalAffected: affectedNodes.length,
      },
    });
  }

  console.log(`✓ Logged batch restructure affecting ${affectedNodes.length} nodes`);
}

/**
 * Example 4: View complete history for a node
 */
export function exampleViewNodeHistory() {
  const nodeId = 'node-abc-123';

  // Get all changes
  const allHistory = getNodeHistory(nodeId);
  console.log(`\nNode ${nodeId} has ${allHistory.length} changes:`);
  allHistory.forEach((change, i) => {
    console.log(`  ${i + 1}. ${change.changeType}: ${change.oldCode || 'null'} → ${change.newCode}`);
    console.log(`     Triggered by: ${change.triggeredBy} at ${change.changedAt}`);
    if (change.reason) console.log(`     Reason: ${change.reason}`);
  });

  // Get only function hierarchy changes
  const functionHistory = getNodeHistory(nodeId, {
    hierarchyType: 'function',
  });
  console.log(`\nFunction hierarchy: ${functionHistory.length} changes`);

  // Get last 5 changes
  const recent = getNodeHistory(nodeId, { limit: 5 });
  console.log(`\nLast 5 changes: ${recent.length} records`);
}

/**
 * Example 5: Audit recent system activity
 */
export function exampleAuditRecentActivity() {
  // Get last 20 changes across all nodes
  const recentChanges = getRecentChanges(20);

  console.log('\nRecent System Activity:');
  recentChanges.forEach(change => {
    console.log(`  Node ${change.nodeId}: ${change.changeType} (${change.triggeredBy})`);
    console.log(`    ${change.oldCode || 'null'} → ${change.newCode}`);
  });
}

/**
 * Example 6: Find all AI import errors
 */
export function exampleFindImportIssues() {
  // Get all import changes
  const imports = getChangesByTrigger('import', 1000);

  // Filter for potential issues (could add more sophisticated logic)
  const possibleIssues = imports.filter(change => {
    // Look for rapid changes (might indicate classification uncertainty)
    const sameNodeChanges = imports.filter(c => c.nodeId === change.nodeId);
    return sameNodeChanges.length > 2;
  });

  console.log(`\nFound ${possibleIssues.length} nodes with multiple import changes`);
  console.log('These might need manual review:');
  possibleIssues.forEach(issue => {
    console.log(`  Node ${issue.nodeId}: ${issue.newCode}`);
  });
}

/**
 * Example 7: Analyze restructure operations
 */
export function exampleAnalyzeRestructures() {
  const restructures = getChangesByType('restructured', 1000);

  // Group by batch
  const batches = new Map<string, typeof restructures>();
  restructures.forEach(change => {
    const batchId = change.metadata?.batchId;
    if (batchId) {
      if (!batches.has(batchId)) {
        batches.set(batchId, []);
      }
      batches.get(batchId)!.push(change);
    }
  });

  console.log(`\nFound ${batches.size} restructure batches:`);
  batches.forEach((changes, batchId) => {
    console.log(`  Batch ${batchId}: ${changes.length} nodes affected`);
    console.log(`    Reason: ${changes[0].reason || 'N/A'}`);
    console.log(`    Date: ${changes[0].changedAt}`);
  });
}

/**
 * Example 8: Generate audit report
 */
export function exampleGenerateReport() {
  const stats = getChangeStatistics();

  console.log('\n=== Hierarchy Audit Report ===');
  console.log(`\nTotal Changes: ${stats.totalChanges}`);

  console.log('\nBy Change Type:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\nBy Trigger Source:');
  Object.entries(stats.byTrigger).forEach(([trigger, count]) => {
    console.log(`  ${trigger}: ${count}`);
  });

  console.log('\nBy Hierarchy:');
  Object.entries(stats.byHierarchy).forEach(([hierarchy, count]) => {
    console.log(`  ${hierarchy}: ${count}`);
  });

  // Calculate AI vs. human changes
  const aiChanges = (stats.byTrigger.import || 0) + (stats.byTrigger.restructure || 0);
  const humanChanges = (stats.byTrigger.user_move || 0) + (stats.byTrigger.merge || 0);
  const aiPercentage = ((aiChanges / stats.totalChanges) * 100).toFixed(1);

  console.log(`\nAI-driven changes: ${aiPercentage}% (${aiChanges}/${stats.totalChanges})`);
  console.log(`Human-driven changes: ${((humanChanges / stats.totalChanges) * 100).toFixed(1)}% (${humanChanges}/${stats.totalChanges})`);
}

/**
 * Example 9: Investigate specific batch operation
 */
export function exampleInvestigateBatch() {
  const batchId = 'batch-xyz-789';
  const batchChanges = getBatchChanges(batchId);

  console.log(`\n=== Batch ${batchId} Analysis ===`);
  console.log(`Total nodes affected: ${batchChanges.length}`);

  if (batchChanges.length > 0) {
    const firstChange = batchChanges[0];
    console.log(`Operation: ${firstChange.changeType}`);
    console.log(`Triggered by: ${firstChange.triggeredBy}`);
    console.log(`Reason: ${firstChange.reason || 'N/A'}`);
    console.log(`Date: ${firstChange.changedAt}`);

    console.log('\nAffected nodes:');
    batchChanges.forEach(change => {
      console.log(`  ${change.nodeId}: ${change.oldCode} → ${change.newCode}`);
    });
  }
}

/**
 * Example 10: Detect code churn (nodes that change frequently)
 */
export function exampleDetectCodeChurn() {
  const recentChanges = getRecentChanges(1000);

  // Count changes per node
  const nodeChangeCounts = new Map<string, number>();
  recentChanges.forEach(change => {
    const count = nodeChangeCounts.get(change.nodeId) || 0;
    nodeChangeCounts.set(change.nodeId, count + 1);
  });

  // Find nodes with high churn (more than 3 changes)
  const highChurnNodes = Array.from(nodeChangeCounts.entries())
    .filter(([_, count]) => count > 3)
    .sort((a, b) => b[1] - a[1]);

  console.log('\n=== High Code Churn Nodes ===');
  console.log('These nodes have changed codes frequently:');
  highChurnNodes.forEach(([nodeId, count]) => {
    console.log(`  ${nodeId}: ${count} changes`);
    const history = getNodeHistory(nodeId, { limit: 5 });
    history.forEach(h => {
      console.log(`    ${h.changedAt}: ${h.oldCode} → ${h.newCode} (${h.triggeredBy})`);
    });
  });
}

// Run examples (uncomment to test)
// exampleInitialAssignment();
// exampleUserMove();
// exampleBatchRestructure();
// exampleViewNodeHistory();
// exampleAuditRecentActivity();
// exampleFindImportIssues();
// exampleAnalyzeRestructures();
// exampleGenerateReport();
// exampleInvestigateBatch();
// exampleDetectCodeChurn();
