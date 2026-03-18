// ============================================================
// Migration: 018_add_dynamic_hierarchy
// Adds hierarchy_branches, node_branch_placements, and
// hierarchy_refinement_log tables for the dynamic recursive
// hierarchy system. Migrates existing nodes from flat taxonomy
// columns into the new branch structure.
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '018_add_dynamic_hierarchy',
  up(db) {
    // --------------------------------------------------------
    // 1. Create hierarchy_branches table
    // --------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS hierarchy_branches (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES hierarchy_branches(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 0,
        discriminator_dimension TEXT,
        discriminator_value TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        node_count INTEGER NOT NULL DEFAULT 0,
        cohesion_score REAL,
        is_dirty INTEGER NOT NULL DEFAULT 0,
        last_refined_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_branches_parent
        ON hierarchy_branches(parent_id);
      CREATE INDEX IF NOT EXISTS idx_branches_depth
        ON hierarchy_branches(depth);
      CREATE INDEX IF NOT EXISTS idx_branches_active
        ON hierarchy_branches(is_active) WHERE is_active = 1;
      CREATE INDEX IF NOT EXISTS idx_branches_dirty
        ON hierarchy_branches(is_dirty) WHERE is_dirty = 1;
      CREATE INDEX IF NOT EXISTS idx_branches_parent_sort
        ON hierarchy_branches(parent_id, sort_order);
    `);

    // --------------------------------------------------------
    // 2. Create node_branch_placements table
    // --------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS node_branch_placements (
        node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        branch_id TEXT NOT NULL REFERENCES hierarchy_branches(id) ON DELETE CASCADE,
        is_primary INTEGER NOT NULL DEFAULT 1,
        placement_confidence REAL NOT NULL DEFAULT 0.5,
        placement_source TEXT NOT NULL DEFAULT 'import',
        placed_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (node_id, branch_id)
      );

      CREATE INDEX IF NOT EXISTS idx_placements_branch
        ON node_branch_placements(branch_id);
      CREATE INDEX IF NOT EXISTS idx_placements_primary
        ON node_branch_placements(node_id) WHERE is_primary = 1;
      CREATE INDEX IF NOT EXISTS idx_placements_source
        ON node_branch_placements(placement_source);
    `);

    // --------------------------------------------------------
    // 3. Create hierarchy_refinement_log table
    // --------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS hierarchy_refinement_log (
        id TEXT PRIMARY KEY,
        trigger TEXT NOT NULL,
        scope TEXT NOT NULL,
        branches_evaluated INTEGER NOT NULL DEFAULT 0,
        branches_modified INTEGER NOT NULL DEFAULT 0,
        nodes_moved INTEGER NOT NULL DEFAULT 0,
        llm_calls INTEGER NOT NULL DEFAULT 0,
        token_usage INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        details_json TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_refinement_trigger
        ON hierarchy_refinement_log(trigger);
      CREATE INDEX IF NOT EXISTS idx_refinement_started
        ON hierarchy_refinement_log(started_at);
    `);

    // --------------------------------------------------------
    // 4. Migrate existing nodes into branch structure
    //    Build branches from current segment_code + category_code
    //    + subcategory_label groupings
    // --------------------------------------------------------
    const existingNodes = db.prepare(`
      SELECT
        id,
        segment_code,
        category_code,
        content_type_code,
        subcategory_label,
        company
      FROM nodes
      WHERE is_deleted = 0
    `).all() as Array<{
      id: string;
      segment_code: string | null;
      category_code: string | null;
      content_type_code: string | null;
      subcategory_label: string | null;
      company: string | null;
    }>;

    if (existingNodes.length === 0) return;

    // Read segment and category labels for branch names
    const segmentRows = db.prepare(
      'SELECT code, name FROM segments'
    ).all() as Array<{ code: string; name: string }>;
    const segmentLabels = new Map(segmentRows.map(r => [r.code, r.name]));

    const categoryRows = db.prepare(
      'SELECT segment_code, category_code, display_name FROM categories'
    ).all() as Array<{ segment_code: string; category_code: string; display_name: string }>;
    const categoryLabels = new Map(
      categoryRows.map(r => [`${r.segment_code}:${r.category_code}`, r.display_name])
    );

    // Fallback labels
    const defaultSegLabels: Record<string, string> = {
      A: 'AI & Machine Learning', T: 'Technology & Development',
      F: 'Finance & Economics', S: 'Sports & Fitness',
      H: 'Health & Wellness', B: 'Business & Productivity',
      E: 'Entertainment & Media', L: 'Lifestyle & Personal',
      X: 'Science & Research', C: 'Creative & Design',
    };

    // Build the branch tree: segment → category → subcategory
    // Group nodes by their hierarchy path
    interface BranchGroup {
      segCode: string;
      catCode: string;
      subcatLabel: string;
      nodeIds: string[];
    }

    const groups = new Map<string, BranchGroup>();
    for (const node of existingNodes) {
      const seg = node.segment_code || 'X';
      const cat = node.category_code || 'OTH';
      const subcat = (node.subcategory_label?.trim() && node.subcategory_label.trim().length > 2)
        ? node.subcategory_label.trim()
        : 'General';
      const key = `${seg}:${cat}:${subcat}`;

      if (!groups.has(key)) {
        groups.set(key, { segCode: seg, catCode: cat, subcatLabel: subcat, nodeIds: [] });
      }
      groups.get(key)!.nodeIds.push(node.id);
    }

    // UUID generation helper (simple v4-like for migration context)
    let counter = 0;
    function migrationId(prefix: string): string {
      counter++;
      const ts = Date.now().toString(36);
      const seq = counter.toString(36).padStart(4, '0');
      return `${prefix}-${ts}-${seq}`;
    }

    // Insert branches and placements
    const insertBranch = db.prepare(`
      INSERT INTO hierarchy_branches
        (id, parent_id, label, depth, discriminator_dimension, discriminator_value,
         confidence, description, sort_order, is_active, node_count, is_dirty, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, datetime('now'), datetime('now'))
    `);

    const insertPlacement = db.prepare(`
      INSERT INTO node_branch_placements
        (node_id, branch_id, is_primary, placement_confidence, placement_source, placed_at)
      VALUES (?, ?, 1, 0.5, 'migration', datetime('now'))
    `);

    // Track created segment and category branches to avoid duplicates
    const segBranches = new Map<string, string>(); // segCode → branchId
    const catBranches = new Map<string, string>(); // segCode:catCode → branchId

    // Collect unique segments and categories, sorted for deterministic ordering
    const uniqueSegs = [...new Set([...groups.values()].map(g => g.segCode))].sort();

    let segSort = 0;
    for (const segCode of uniqueSegs) {
      const segId = migrationId('seg');
      const segLabel = segmentLabels.get(segCode) || defaultSegLabels[segCode] || segCode;
      const segNodeCount = [...groups.values()]
        .filter(g => g.segCode === segCode)
        .reduce((sum, g) => sum + g.nodeIds.length, 0);

      insertBranch.run(
        segId, null, segLabel, 0,
        'segment', segCode, 0.8, `Migrated from segment ${segCode}`,
        segSort++, segNodeCount
      );
      segBranches.set(segCode, segId);
    }

    // Create category branches
    const uniqueCats = [...new Set([...groups.values()].map(g => `${g.segCode}:${g.catCode}`))].sort();

    let catSort = 0;
    for (const catKey of uniqueCats) {
      const [segCode, catCode] = catKey.split(':');
      const catId = migrationId('cat');
      const parentId = segBranches.get(segCode)!;
      const catLabel = categoryLabels.get(catKey) || catCode;
      const catNodeCount = [...groups.values()]
        .filter(g => g.segCode === segCode && g.catCode === catCode)
        .reduce((sum, g) => sum + g.nodeIds.length, 0);

      insertBranch.run(
        catId, parentId, catLabel, 1,
        'category', catCode, 0.7, `Migrated from category ${segCode}.${catCode}`,
        catSort++, catNodeCount
      );
      catBranches.set(catKey, catId);
    }

    // Create subcategory branches and place nodes
    let subcatSort = 0;
    for (const [, group] of groups) {
      const catKey = `${group.segCode}:${group.catCode}`;
      const parentId = catBranches.get(catKey)!;

      // If subcategory is 'General' and it's the only subcat for this category,
      // place nodes directly under the category branch
      const siblingGroups = [...groups.values()].filter(
        g => g.segCode === group.segCode && g.catCode === group.catCode
      );
      const shouldFlatten = siblingGroups.length === 1 && group.subcatLabel === 'General';

      let targetBranchId: string;
      if (shouldFlatten) {
        targetBranchId = parentId;
      } else {
        const subcatId = migrationId('sub');
        insertBranch.run(
          subcatId, parentId, group.subcatLabel, 2,
          'subcategory', group.subcatLabel, 0.6,
          `Migrated subcategory: ${group.subcatLabel}`,
          subcatSort++, group.nodeIds.length
        );
        targetBranchId = subcatId;
      }

      // Place all nodes in this group
      for (const nodeId of group.nodeIds) {
        insertPlacement.run(nodeId, targetBranchId);
      }
    }
  },

  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_refinement_started;
      DROP INDEX IF EXISTS idx_refinement_trigger;
      DROP TABLE IF EXISTS hierarchy_refinement_log;

      DROP INDEX IF EXISTS idx_placements_source;
      DROP INDEX IF EXISTS idx_placements_primary;
      DROP INDEX IF EXISTS idx_placements_branch;
      DROP TABLE IF EXISTS node_branch_placements;

      DROP INDEX IF EXISTS idx_branches_parent_sort;
      DROP INDEX IF EXISTS idx_branches_dirty;
      DROP INDEX IF EXISTS idx_branches_active;
      DROP INDEX IF EXISTS idx_branches_depth;
      DROP INDEX IF EXISTS idx_branches_parent;
      DROP TABLE IF EXISTS hierarchy_branches;
    `);
  },
};

export default migration;