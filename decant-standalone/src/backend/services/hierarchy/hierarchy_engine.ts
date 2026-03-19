// ============================================================
// Hierarchy Engine
// ============================================================
// Core engine for the dynamic recursive hierarchy system.
// Three modes: full build, incremental placement, global refinement.

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../database/connection.js';
import { withTransaction } from '../../database/transaction.js';
import {
  BranchDiscriminator,
  type BranchContext,
  type BranchNodeSummary,
  type EvaluationResult,
} from './branch_discriminator.js';
import type { SemanticProfile } from '../semantic_profiler.js';
import { log } from '../../logger/index.js';

// ============================================================
// Types
// ============================================================

export interface HierarchyBranch {
  id: string;
  parentId: string | null;
  label: string;
  depth: number;
  discriminatorDimension: string | null;
  discriminatorValue: string | null;
  confidence: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  nodeCount: number;
  cohesionScore: number | null;
  isDirty: boolean;
  lastRefinedAt: string | null;
}

export interface PlacementResult {
  branchId: string;
  branchLabel: string;
  branchDepth: number;
  confidence: number;
  path: string[]; // labels from root to leaf
}

export interface RefinementResult {
  trigger: string;
  scope: string;
  branchesEvaluated: number;
  branchesModified: number;
  nodesMoved: number;
  llmCalls: number;
  tokenUsage: number;
  durationMs: number;
}

export interface FullBuildResult {
  branchesCreated: number;
  nodesPlaced: number;
  llmCalls: number;
  tokenUsage: number;
  durationMs: number;
}

// ============================================================
// HierarchyEngine
// ============================================================

export class HierarchyEngine {
  private discriminator: BranchDiscriminator;

  constructor(discriminator: BranchDiscriminator) {
    this.discriminator = discriminator;
  }

  // ============================================================
  // Mode 1: Full Build
  // ============================================================

  /**
   * Build the entire hierarchy from scratch.
   * Clears all existing branches and placements, then recursively
   * clusters all nodes into a new tree.
   */
  async buildFullHierarchy(): Promise<FullBuildResult> {
    const startTime = Date.now();
    const db = getDatabase();
    let llmCalls = 0;
    let totalTokens = 0;

    // Load all active nodes with their semantic profile data
    const allNodes = db.prepare(`
      SELECT
        id, title, company, extracted_fields, phrase_description
      FROM nodes
      WHERE is_deleted = 0
      ORDER BY date_added ASC
    `).all() as Array<{
      id: string;
      title: string;
      company: string | null;
      extracted_fields: string | null;
      phrase_description: string | null;
    }>;

    if (allNodes.length === 0) {
      return { branchesCreated: 0, nodesPlaced: 0, llmCalls: 0, tokenUsage: 0, durationMs: Date.now() - startTime };
    }

    log.info(`Full hierarchy build starting for ${allNodes.length} nodes`, {
      module: 'hierarchy-engine',
    });

    // Clear existing hierarchy
    withTransaction(() => {
      db.prepare('DELETE FROM node_branch_placements').run();
      db.prepare('DELETE FROM hierarchy_branches').run();
    });

    // Create root branch
    const rootId = uuidv4();
    db.prepare(`
      INSERT INTO hierarchy_branches
        (id, parent_id, label, depth, discriminator_dimension, confidence, node_count, is_dirty, created_at, updated_at)
      VALUES (?, NULL, 'All Resources', 0, NULL, 1.0, ?, 0, datetime('now'), datetime('now'))
    `).run(rootId, allNodes.length);

    // Place all nodes under root initially
    const insertPlacement = db.prepare(`
      INSERT INTO node_branch_placements (node_id, branch_id, is_primary, placement_confidence, placement_source)
      VALUES (?, ?, 1, 0.5, 'build')
    `);

    withTransaction(() => {
      for (const node of allNodes) {
        insertPlacement.run(node.id, rootId);
      }
    });

    // Recursively split branches starting from root
    const splitResult = await this.recursiveSplit(rootId);
    llmCalls += splitResult.llmCalls;
    totalTokens += splitResult.tokenUsage;

    // Update node counts for all branches
    this.refreshNodeCounts();

    const branchCount = (db.prepare('SELECT COUNT(*) as cnt FROM hierarchy_branches WHERE is_active = 1').get() as { cnt: number }).cnt;

    log.info('Full hierarchy build complete', {
      module: 'hierarchy-engine',
      branches: branchCount,
      nodes: allNodes.length,
      llmCalls,
      tokens: totalTokens,
      durationMs: Date.now() - startTime,
    });

    // Log to refinement table
    this.logRefinement('manual', 'global_full', branchCount, branchCount, 0, llmCalls, totalTokens, Date.now() - startTime);

    return {
      branchesCreated: branchCount,
      nodesPlaced: allNodes.length,
      llmCalls,
      tokenUsage: totalTokens,
      durationMs: Date.now() - startTime,
    };
  }

  // ============================================================
  // Mode 1b: Direct Classification Build
  // ============================================================

  /**
   * Build hierarchy directly from a DynamicClassifier's taxonomy and assignments.
   * Caller passes the output of DynamicClassifier.classifyAll() — one LLM call
   * classifies all nodes holistically, so no branch discriminator is needed here.
   *
   * This replaces the recursive branch discriminator approach with a direct
   * taxonomy-to-hierarchy mapping.
   */
  async buildFromClassification(
    taxonomy: {
      segments: Array<{ code: string; label: string; description: string }>;
      categories: Array<{ segmentCode: string; code: string; label: string; description: string }>;
    },
    assignments: Array<{
      nodeId: string;
      segmentCode: string;
      categoryCode: string;
      subcategoryLabel: string;
      confidence: number;
    }>,
  ): Promise<FullBuildResult> {
    const startTime = Date.now();
    const db = getDatabase();

    log.info(`Classification-driven hierarchy build starting`, {
      module: 'hierarchy-engine',
      segments: taxonomy.segments.length,
      categories: taxonomy.categories.length,
      nodes: assignments.length,
    });

    // Branch ID maps built during the transaction and used for placement
    let rootId = '';
    const segmentBranchIds = new Map<string, string>();
    const categoryBranchIds = new Map<string, string>();
    const subcategoryBranchIds = new Map<string, string>();

    withTransaction(() => {
      // Step 1: Clear existing hierarchy
      db.prepare('DELETE FROM node_branch_placements').run();
      db.prepare('DELETE FROM hierarchy_branches').run();

      // Step 2: Create root branch
      rootId = uuidv4();
      db.prepare(`
        INSERT INTO hierarchy_branches
          (id, parent_id, label, depth, discriminator_dimension, discriminator_value,
           confidence, node_count, is_dirty, created_at, updated_at)
        VALUES (?, NULL, 'All Resources', 0, NULL, NULL, 1.0, ?, 0, datetime('now'), datetime('now'))
      `).run(rootId, assignments.length);

      // Step 3: Create segment branches (depth 1)
      const insertBranch = db.prepare(`
        INSERT INTO hierarchy_branches
          (id, parent_id, label, depth, discriminator_dimension, discriminator_value,
           description, sort_order, is_active, confidence, node_count, is_dirty,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1.0, 0, 0, datetime('now'), datetime('now'))
      `);

      for (let i = 0; i < taxonomy.segments.length; i++) {
        const segment = taxonomy.segments[i];
        const segmentId = uuidv4();
        insertBranch.run(
          segmentId, rootId, segment.label, 1,
          'segment', segment.code, segment.description, i,
        );
        segmentBranchIds.set(segment.code, segmentId);
      }

      // Step 4: Create category branches (depth 2)
      for (let i = 0; i < taxonomy.categories.length; i++) {
        const category = taxonomy.categories[i];
        const segmentBranchId = segmentBranchIds.get(category.segmentCode);
        if (!segmentBranchId) continue;

        const categoryId = uuidv4();
        insertBranch.run(
          categoryId, segmentBranchId, category.label, 2,
          'category', category.code, category.description, i,
        );
        categoryBranchIds.set(`${category.segmentCode}:${category.code}`, categoryId);
      }

      // Step 5: Create subcategory branches (depth 3) for groups with 3+ nodes
      // Group assignments by (segmentCode, categoryCode, subcategoryLabel)
      const subcategoryGroups = new Map<string, string[]>();
      for (const assignment of assignments) {
        if (!assignment.subcategoryLabel) continue;
        const key = `${assignment.segmentCode}:${assignment.categoryCode}:${assignment.subcategoryLabel}`;
        const group = subcategoryGroups.get(key);
        if (group) {
          group.push(assignment.nodeId);
        } else {
          subcategoryGroups.set(key, [assignment.nodeId]);
        }
      }

      let subcategorySortOrder = 0;
      for (const [key, nodeIds] of subcategoryGroups) {
        if (nodeIds.length < 3) continue;

        const [segCode, catCode, subLabel] = key.split(':');
        const parentCategoryId = categoryBranchIds.get(`${segCode}:${catCode}`);
        if (!parentCategoryId) continue;

        const subId = uuidv4();
        insertBranch.run(
          subId, parentCategoryId, subLabel, 3,
          'subcategory', subLabel, null, subcategorySortOrder++,
        );
        subcategoryBranchIds.set(key, subId);
      }

      // Step 6: Place each node into the deepest matching branch
      const insertPlacement = db.prepare(`
        INSERT INTO node_branch_placements
          (node_id, branch_id, is_primary, placement_confidence, placement_source, placed_at)
        VALUES (?, ?, 1, ?, 'build', datetime('now'))
      `);

      for (const assignment of assignments) {
        const subcategoryKey = `${assignment.segmentCode}:${assignment.categoryCode}:${assignment.subcategoryLabel}`;
        const categoryKey = `${assignment.segmentCode}:${assignment.categoryCode}`;

        const targetBranchId =
          subcategoryBranchIds.get(subcategoryKey) ??
          categoryBranchIds.get(categoryKey) ??
          segmentBranchIds.get(assignment.segmentCode) ??
          rootId;

        insertPlacement.run(assignment.nodeId, targetBranchId, assignment.confidence);
      }
    });

    // Step 7: Refresh node counts (propagates counts up the tree)
    this.refreshNodeCounts();

    const branchCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM hierarchy_branches WHERE is_active = 1'
    ).get() as { cnt: number }).cnt;

    const durationMs = Date.now() - startTime;

    log.info('Classification-driven hierarchy build complete', {
      module: 'hierarchy-engine',
      branches: branchCount,
      nodes: assignments.length,
      durationMs,
    });

    // 0 LLM calls — the DynamicClassifier already performed that work
    this.logRefinement('manual', 'global_full', branchCount, branchCount, 0, 0, 0, durationMs);

    return {
      branchesCreated: branchCount,
      nodesPlaced: assignments.length,
      llmCalls: 0,
      tokenUsage: 0,
      durationMs,
    };
  }

  // ============================================================
  // Mode 2: Incremental Placement
  // ============================================================

  /**
   * Place a single node into the best existing branch.
   * Descends the tree matching the node's profile to branch discriminators.
   */
  placeNode(nodeId: string, profile: SemanticProfile): PlacementResult {
    const db = getDatabase();

    // Start at root (depth 0, no parent)
    const roots = db.prepare(`
      SELECT id, label, depth, discriminator_dimension, discriminator_value
      FROM hierarchy_branches
      WHERE parent_id IS NULL AND is_active = 1
      ORDER BY sort_order ASC
    `).all() as Array<{
      id: string; label: string; depth: number;
      discriminator_dimension: string | null; discriminator_value: string | null;
    }>;

    if (roots.length === 0) {
      // No hierarchy exists yet — create a root and place there
      const rootId = uuidv4();
      db.prepare(`
        INSERT INTO hierarchy_branches (id, parent_id, label, depth, confidence, node_count, is_dirty)
        VALUES (?, NULL, 'All Resources', 0, 1.0, 1, 1)
      `).run(rootId);

      this.insertPlacement(nodeId, rootId, 0.5, 'import');
      return { branchId: rootId, branchLabel: 'All Resources', branchDepth: 0, confidence: 0.5, path: ['All Resources'] };
    }

    // For a single-root tree, start descent from root
    let currentBranchId = roots[0].id;
    let currentLabel = roots[0].label;
    let currentDepth = roots[0].depth;
    const path = [currentLabel];

    // Descend through the tree
    while (true) {
      const children = db.prepare(`
        SELECT id, label, depth, discriminator_dimension, discriminator_value
        FROM hierarchy_branches
        WHERE parent_id = ? AND is_active = 1
        ORDER BY sort_order ASC
      `).all(currentBranchId) as Array<{
        id: string; label: string; depth: number;
        discriminator_dimension: string | null; discriminator_value: string | null;
      }>;

      // Leaf branch — place here
      if (children.length === 0) break;

      // Find best matching child
      const bestChild = this.findBestChild(children, profile);
      if (!bestChild) break;

      currentBranchId = bestChild.id;
      currentLabel = bestChild.label;
      currentDepth = bestChild.depth;
      path.push(currentLabel);
    }

    // Place the node
    const confidence = this.computePlacementConfidence(profile, currentBranchId);
    this.insertPlacement(nodeId, currentBranchId, confidence, 'import');

    // Mark branch and parent as dirty for next refinement pass
    this.markBranchDirty(currentBranchId);

    // Update node counts up the chain
    this.incrementNodeCounts(currentBranchId);

    return {
      branchId: currentBranchId,
      branchLabel: currentLabel,
      branchDepth: currentDepth,
      confidence,
      path,
    };
  }

  // ============================================================
  // Mode 3: Global Refinement
  // ============================================================

  /**
   * Run a refinement pass over the hierarchy.
   * 'scoped' mode only evaluates dirty branches.
   * 'full' mode evaluates all branches.
   */
  async refineHierarchy(
    scope: 'scoped' | 'full',
    trigger: string = 'import'
  ): Promise<RefinementResult> {
    const startTime = Date.now();
    const db = getDatabase();
    let branchesEvaluated = 0;
    let branchesModified = 0;
    let nodesMoved = 0;
    let llmCalls = 0;
    let totalTokens = 0;

    // Get branches to evaluate, deepest first (bottom-up)
    const whereClause = scope === 'scoped' ? 'AND b.is_dirty = 1' : '';
    const branches = db.prepare(`
      SELECT b.id, b.depth, b.node_count
      FROM hierarchy_branches b
      WHERE b.is_active = 1 ${whereClause}
      ORDER BY b.depth DESC, b.sort_order ASC
    `).all() as Array<{ id: string; depth: number; node_count: number }>;

    log.info(`Refinement pass starting (${scope})`, {
      module: 'hierarchy-engine',
      trigger,
      branchesToEvaluate: branches.length,
    });

    for (const branch of branches) {
      // Build context from DB
      const context = this.discriminator.buildContextFromDb(branch.id);
      if (!context || context.nodes.length === 0) {
        // Check if branch has active children before retiring
        const hasChildren = (db.prepare(
          'SELECT COUNT(*) as cnt FROM hierarchy_branches WHERE parent_id = ? AND is_active = 1'
        ).get(branch.id) as { cnt: number }).cnt > 0;

        if (!hasChildren) {
          this.retireBranch(branch.id);
          branchesModified++;
        }
        continue;
      }

      // Evaluate
      const evalResult = await this.discriminator.evaluate(context);
      branchesEvaluated++;

      if (!evalResult.skipped) {
        llmCalls++;
        totalTokens += evalResult.tokenUsage.totalTokens;
      }

      if (evalResult.evaluation.shouldSplit && evalResult.evaluation.proposedChildren.length >= 2) {
        // Apply the split
        const splitNodesMoved = this.applySplit(branch.id, evalResult.evaluation);
        nodesMoved += splitNodesMoved;
        branchesModified++;
      }

      // Update branch metadata
      db.prepare(`
        UPDATE hierarchy_branches
        SET cohesion_score = ?, is_dirty = 0, last_refined_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(evalResult.evaluation.branchCohesion, branch.id);
    }

    // Top-down cleanup: retire empty branches, merge tiny branches
    const mergeResult = this.cleanupPass();
    branchesModified += mergeResult.branchesMerged;
    nodesMoved += mergeResult.nodesMoved;

    // Refresh node counts
    this.refreshNodeCounts();

    const durationMs = Date.now() - startTime;

    log.info('Refinement pass complete', {
      module: 'hierarchy-engine',
      scope,
      trigger,
      branchesEvaluated,
      branchesModified,
      nodesMoved,
      llmCalls,
      tokens: totalTokens,
      durationMs,
    });

    this.logRefinement(trigger, scope === 'scoped' ? 'global_scoped' : 'global_full',
      branchesEvaluated, branchesModified, nodesMoved, llmCalls, totalTokens, durationMs);

    return { trigger, scope, branchesEvaluated, branchesModified, nodesMoved, llmCalls, tokenUsage: totalTokens, durationMs };
  }

  // ============================================================
  // Branch Operations
  // ============================================================

  /**
   * Recursively split a branch if it's diverse enough.
   */
  private async recursiveSplit(branchId: string): Promise<{ llmCalls: number; tokenUsage: number }> {
    let llmCalls = 0;
    let totalTokens = 0;

    const context = this.discriminator.buildContextFromDb(branchId);
    if (!context) return { llmCalls: 0, tokenUsage: 0 };

    const evalResult = await this.discriminator.evaluate(context);

    if (!evalResult.skipped) {
      llmCalls++;
      totalTokens += evalResult.tokenUsage.totalTokens;
    }

    if (!evalResult.evaluation.shouldSplit || evalResult.evaluation.proposedChildren.length < 2) {
      // Update cohesion score
      const db = getDatabase();
      db.prepare(`
        UPDATE hierarchy_branches SET cohesion_score = ?, is_dirty = 0, last_refined_at = datetime('now')
        WHERE id = ?
      `).run(evalResult.evaluation.branchCohesion, branchId);
      return { llmCalls, tokenUsage: totalTokens };
    }

    // Apply the split
    this.applySplit(branchId, evalResult.evaluation);

    // Recurse into each new child branch
    const db = getDatabase();
    const children = db.prepare(`
      SELECT id FROM hierarchy_branches WHERE parent_id = ? AND is_active = 1
    `).all(branchId) as Array<{ id: string }>;

    for (const child of children) {
      const childResult = await this.recursiveSplit(child.id);
      llmCalls += childResult.llmCalls;
      totalTokens += childResult.tokenUsage;
    }

    return { llmCalls, tokenUsage: totalTokens };
  }

  /**
   * Apply a split evaluation to a branch — create children and move nodes.
   * Returns the number of nodes moved.
   */
  private applySplit(branchId: string, evaluation: import('./branch_discriminator.js').BranchEvaluation): number {
    const db = getDatabase();
    let nodesMoved = 0;

    const parentBranch = db.prepare(`
      SELECT depth FROM hierarchy_branches WHERE id = ?
    `).get(branchId) as { depth: number } | undefined;

    if (!parentBranch) return 0;

    const childDepth = parentBranch.depth + 1;

    withTransaction(() => {
      for (let i = 0; i < evaluation.proposedChildren.length; i++) {
        const child = evaluation.proposedChildren[i];
        const childId = uuidv4();

        // Create child branch
        db.prepare(`
          INSERT INTO hierarchy_branches
            (id, parent_id, label, depth, discriminator_dimension, discriminator_value,
             confidence, description, sort_order, is_active, node_count, cohesion_score, is_dirty)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
        `).run(
          childId,
          branchId,
          child.label,
          childDepth,
          evaluation.bestDimension,
          child.discriminatorValue,
          evaluation.confidence,
          null,
          i,
          child.nodeIds.length,
          child.cohesionScore,
        );

        // Move node placements from parent to child
        for (const nodeId of child.nodeIds) {
          // Delete old placement at parent
          db.prepare(`
            DELETE FROM node_branch_placements
            WHERE node_id = ? AND branch_id = ?
          `).run(nodeId, branchId);

          // Insert new placement at child
          db.prepare(`
            INSERT OR REPLACE INTO node_branch_placements
              (node_id, branch_id, is_primary, placement_confidence, placement_source, placed_at)
            VALUES (?, ?, 1, ?, 'refinement', datetime('now'))
          `).run(nodeId, childId, evaluation.confidence);

          nodesMoved++;
        }
      }

      // Update parent branch metadata
      db.prepare(`
        UPDATE hierarchy_branches
        SET cohesion_score = ?, is_dirty = 0, last_refined_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(evaluation.branchCohesion, branchId);
    });

    return nodesMoved;
  }

  // ============================================================
  // Placement Helpers
  // ============================================================

  /**
   * Find the best matching child branch for a given profile.
   */
  private findBestChild(
    children: Array<{ id: string; label: string; depth: number; discriminator_dimension: string | null; discriminator_value: string | null }>,
    profile: SemanticProfile,
  ): typeof children[0] | null {
    if (children.length === 0) return null;

    let bestChild = children[0];
    let bestScore = -1;

    for (const child of children) {
      const score = this.scoreBranchMatch(child, profile);
      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }

    return bestChild;
  }

  /**
   * Score how well a node's profile matches a branch's discriminator.
   */
  private scoreBranchMatch(
    branch: { discriminator_dimension: string | null; discriminator_value: string | null; label: string },
    profile: SemanticProfile,
  ): number {
    const dim = branch.discriminator_dimension;
    const val = branch.discriminator_value?.toLowerCase();

    if (!dim || !val) return 0;

    const profileValues = this.getProfileValuesForDimension(dim, profile);

    // Exact match
    for (const pv of profileValues) {
      if (pv.toLowerCase() === val) return 1.0;
    }

    // Substring match
    for (const pv of profileValues) {
      const pvl = pv.toLowerCase();
      if (pvl.includes(val) || val.includes(pvl)) return 0.7;
    }

    // Label-based fuzzy match
    const labelLower = branch.label.toLowerCase();
    for (const pv of profileValues) {
      if (labelLower.includes(pv.toLowerCase())) return 0.5;
    }

    return 0.1;
  }

  /**
   * Extract the relevant profile values for a given dimension.
   */
  private getProfileValuesForDimension(dimension: string, profile: SemanticProfile): string[] {
    switch (dimension) {
      case 'function': return [profile.primaryFunction];
      case 'domain': return [profile.primaryDomain];
      case 'technology': return profile.technologies;
      case 'concept': return profile.concepts;
      case 'audience': return profile.audience;
      case 'platform': return profile.platform;
      case 'organization': return [profile.company];
      case 'resource_type': return [profile.resourceType];
      case 'industry': return profile.industry;
      case 'pricing': return profile.pricing;
      case 'topic_cluster': return [...profile.keyConcepts.slice(0, 3)];
      case 'segment': return [profile.primaryDomain]; // legacy compat
      case 'category': return [profile.primaryFunction]; // legacy compat
      case 'subcategory': return profile.concepts.slice(0, 3); // legacy compat
      default: return [];
    }
  }

  private computePlacementConfidence(profile: SemanticProfile, branchId: string): number {
    const db = getDatabase();
    const branch = db.prepare(`
      SELECT discriminator_dimension, discriminator_value
      FROM hierarchy_branches WHERE id = ?
    `).get(branchId) as { discriminator_dimension: string | null; discriminator_value: string | null } | undefined;

    if (!branch || !branch.discriminator_dimension) return 0.5;

    return this.scoreBranchMatch(
      { discriminator_dimension: branch.discriminator_dimension, discriminator_value: branch.discriminator_value, label: '' },
      profile,
    );
  }

  private insertPlacement(nodeId: string, branchId: string, confidence: number, source: string): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO node_branch_placements
        (node_id, branch_id, is_primary, placement_confidence, placement_source, placed_at)
      VALUES (?, ?, 1, ?, ?, datetime('now'))
    `).run(nodeId, branchId, confidence, source);
  }

  // ============================================================
  // Branch Maintenance
  // ============================================================

  private markBranchDirty(branchId: string): void {
    const db = getDatabase();
    // Mark this branch and all ancestors as dirty
    let currentId: string | null = branchId;
    while (currentId) {
      db.prepare(`
        UPDATE hierarchy_branches SET is_dirty = 1, updated_at = datetime('now') WHERE id = ?
      `).run(currentId);

      const parent = db.prepare(`
        SELECT parent_id FROM hierarchy_branches WHERE id = ?
      `).get(currentId) as { parent_id: string | null } | undefined;

      currentId = parent?.parent_id ?? null;
    }
  }

  private incrementNodeCounts(branchId: string): void {
    const db = getDatabase();
    let currentId: string | null = branchId;
    while (currentId) {
      db.prepare(`
        UPDATE hierarchy_branches SET node_count = node_count + 1 WHERE id = ?
      `).run(currentId);

      const parent = db.prepare(`
        SELECT parent_id FROM hierarchy_branches WHERE id = ?
      `).get(currentId) as { parent_id: string | null } | undefined;

      currentId = parent?.parent_id ?? null;
    }
  }

  private retireBranch(branchId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE hierarchy_branches SET is_active = 0, updated_at = datetime('now') WHERE id = ?
    `).run(branchId);
  }

  /**
   * Refresh all node_count values from actual placements.
   */
  private refreshNodeCounts(): void {
    const db = getDatabase();

    // Reset all counts to 0
    db.prepare('UPDATE hierarchy_branches SET node_count = 0').run();

    // Count direct placements per branch
    const directCounts = db.prepare(`
      SELECT p.branch_id, COUNT(*) as cnt
      FROM node_branch_placements p
      JOIN nodes n ON n.id = p.node_id AND n.is_deleted = 0
      WHERE p.is_primary = 1
      GROUP BY p.branch_id
    `).all() as Array<{ branch_id: string; cnt: number }>;

    // Set direct counts
    const updateStmt = db.prepare('UPDATE hierarchy_branches SET node_count = ? WHERE id = ?');
    for (const row of directCounts) {
      updateStmt.run(row.cnt, row.branch_id);
    }

    // Propagate counts up the tree (bottom-up by depth)
    const maxDepth = (db.prepare('SELECT MAX(depth) as d FROM hierarchy_branches WHERE is_active = 1').get() as { d: number | null })?.d ?? 0;

    for (let depth = maxDepth; depth >= 0; depth--) {
      db.prepare(`
        UPDATE hierarchy_branches
        SET node_count = node_count + COALESCE((
          SELECT SUM(child.node_count)
          FROM hierarchy_branches child
          WHERE child.parent_id = hierarchy_branches.id AND child.is_active = 1
        ), 0)
        WHERE depth = ? AND is_active = 1
      `).run(depth);
    }
  }

  /**
   * Cleanup pass: retire empty branches, merge branches with < 2 nodes into parent.
   */
  private cleanupPass(): { branchesMerged: number; nodesMoved: number } {
    const db = getDatabase();
    let branchesMerged = 0;
    let nodesMoved = 0;

    // Retire branches with 0 direct nodes and 0 active children
    const emptyBranches = db.prepare(`
      SELECT b.id
      FROM hierarchy_branches b
      WHERE b.is_active = 1
        AND b.parent_id IS NOT NULL
        AND (SELECT COUNT(*) FROM node_branch_placements p
             JOIN nodes n ON n.id = p.node_id AND n.is_deleted = 0
             WHERE p.branch_id = b.id AND p.is_primary = 1) = 0
        AND (SELECT COUNT(*) FROM hierarchy_branches c
             WHERE c.parent_id = b.id AND c.is_active = 1) = 0
    `).all() as Array<{ id: string }>;

    for (const branch of emptyBranches) {
      this.retireBranch(branch.id);
      branchesMerged++;
    }

    return { branchesMerged, nodesMoved };
  }

  // ============================================================
  // Logging
  // ============================================================

  private logRefinement(
    trigger: string, scope: string,
    evaluated: number, modified: number, moved: number,
    llmCalls: number, tokens: number, durationMs: number,
  ): void {
    const db = getDatabase();
    try {
      db.prepare(`
        INSERT INTO hierarchy_refinement_log
          (id, trigger, scope, branches_evaluated, branches_modified, nodes_moved,
           llm_calls, token_usage, duration_ms, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' seconds'), datetime('now'))
      `).run(
        uuidv4(), trigger, scope, evaluated, modified, moved,
        llmCalls, tokens, durationMs, Math.round(durationMs / 1000),
      );
    } catch {
      // Log table may not exist in tests
    }
  }

  // ============================================================
  // Query Helpers
  // ============================================================

  /**
   * Manually move a node to a different branch.
   */
  moveNode(nodeId: string, targetBranchId: string): void {
    const db = getDatabase();

    // Verify target branch exists
    const target = db.prepare('SELECT id FROM hierarchy_branches WHERE id = ? AND is_active = 1').get(targetBranchId);
    if (!target) throw new Error(`Target branch not found: ${targetBranchId}`);

    // Get the node's current branch (to mark it dirty)
    const currentPlacement = db.prepare(`
      SELECT branch_id FROM node_branch_placements WHERE node_id = ? AND is_primary = 1
    `).get(nodeId) as { branch_id: string } | undefined;

    withTransaction(() => {
      // Remove old primary placement
      db.prepare('DELETE FROM node_branch_placements WHERE node_id = ? AND is_primary = 1').run(nodeId);

      // Insert new placement
      db.prepare(`
        INSERT INTO node_branch_placements (node_id, branch_id, is_primary, placement_confidence, placement_source, placed_at)
        VALUES (?, ?, 1, 1.0, 'manual', datetime('now'))
      `).run(nodeId, targetBranchId);
    });

    // Mark both old and new branches as dirty
    if (currentPlacement) this.markBranchDirty(currentPlacement.branch_id);
    this.markBranchDirty(targetBranchId);

    // Refresh counts
    this.refreshNodeCounts();
  }

  /**
   * Get the full path (labels) from root to a specific branch.
   */
  getBranchPath(branchId: string): string[] {
    const db = getDatabase();
    const path: string[] = [];
    let currentId: string | null = branchId;

    while (currentId) {
      const branch = db.prepare(`
        SELECT id, parent_id, label FROM hierarchy_branches WHERE id = ?
      `).get(currentId) as { id: string; parent_id: string | null; label: string } | undefined;

      if (!branch) break;
      path.unshift(branch.label);
      currentId = branch.parent_id;
    }

    return path;
  }

  /**
   * Get hierarchy stats for the API.
   */
  getStats(): {
    totalBranches: number;
    activeBranches: number;
    maxDepth: number;
    dirtyBranches: number;
    totalPlacements: number;
    depthDistribution: Record<number, number>;
  } {
    const db = getDatabase();

    const total = (db.prepare('SELECT COUNT(*) as cnt FROM hierarchy_branches').get() as { cnt: number }).cnt;
    const active = (db.prepare('SELECT COUNT(*) as cnt FROM hierarchy_branches WHERE is_active = 1').get() as { cnt: number }).cnt;
    const maxDepth = (db.prepare('SELECT MAX(depth) as d FROM hierarchy_branches WHERE is_active = 1').get() as { d: number | null })?.d ?? 0;
    const dirty = (db.prepare('SELECT COUNT(*) as cnt FROM hierarchy_branches WHERE is_dirty = 1 AND is_active = 1').get() as { cnt: number }).cnt;
    const placements = (db.prepare('SELECT COUNT(*) as cnt FROM node_branch_placements WHERE is_primary = 1').get() as { cnt: number }).cnt;

    const depthRows = db.prepare(`
      SELECT depth, COUNT(*) as cnt FROM hierarchy_branches WHERE is_active = 1 GROUP BY depth ORDER BY depth
    `).all() as Array<{ depth: number; cnt: number }>;

    const depthDistribution: Record<number, number> = {};
    for (const row of depthRows) {
      depthDistribution[row.depth] = row.cnt;
    }

    return { totalBranches: total, activeBranches: active, maxDepth, dirtyBranches: dirty, totalPlacements: placements, depthDistribution };
  }
}

// ============================================================
// Singleton
// ============================================================

let engineInstance: HierarchyEngine | null = null;

export function initializeHierarchyEngine(discriminator: BranchDiscriminator): HierarchyEngine {
  engineInstance = new HierarchyEngine(discriminator);
  return engineInstance;
}

export function getHierarchyEngine(): HierarchyEngine {
  if (!engineInstance) {
    throw new Error('HierarchyEngine not initialized. Call initializeHierarchyEngine() first.');
  }
  return engineInstance;
}

export function hasHierarchyEngine(): boolean {
  return engineInstance !== null;
}

export function clearHierarchyEngine(): void {
  engineInstance = null;
}
