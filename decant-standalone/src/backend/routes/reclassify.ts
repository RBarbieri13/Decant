import { Request, Response } from 'express';
import { getAllNodes as dbGetAllNodes, readNode, updateNode } from '../database/nodes.js';
import { Phase1Classifier, type ClassifyInput } from '../services/phase1_classifier.js';
import { DynamicClassifier, type CondensedNode } from '../services/dynamic_classifier.js';
import { replaceTaxonomy } from '../database/taxonomy_ops.js';
import * as keystore from '../services/keystore.js';
import { log } from '../logger/index.js';
import * as cache from '../cache/index.js';
import { enrichNodes } from '../services/phase2_enricher.js';
import { isGarbageTitle } from '../services/extractors/twitter.js';

interface ReclassifyResult {
  nodeId: string;
  title: string;
  oldSegment: string | null;
  newSegment: string;
  oldCategory: string | null;
  newCategory: string;
  oldContentType: string | null;
  newContentType: string;
  organization: string;
  confidence: number;
  changed: boolean;
}

export async function reclassifyAll(_req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    const apiKey = await keystore.getApiKey('openai');
    if (!apiKey) {
      res.status(400).json({ error: 'OpenAI API key not configured' });
      return;
    }

    const allNodes = dbGetAllNodes() as Array<Record<string, unknown>>;
    if (allNodes.length === 0) {
      res.json({ message: 'No nodes to reclassify', results: [], summary: {} });
      return;
    }

    // Condense nodes for the dynamic classifier
    const condensed: CondensedNode[] = allNodes.map(node => ({
      id: node.id as string,
      title: (node.title as string) || '',
      domain: (node.source_domain as string) || '',
      quickPhrase: (node.phrase_description as string) || undefined,
      shortDescription: (node.short_description as string) || undefined,
      keyConcepts: Array.isArray(node.key_concepts)
        ? (node.key_concepts as string[]).slice(0, 5)
        : undefined,
    }));

    // Run dynamic classification (all nodes at once)
    const classifier = new DynamicClassifier(apiKey);
    const classificationResult = await classifier.classifyAll(condensed);

    log.info('Dynamic classification complete', {
      module: 'reclassify',
      segments: classificationResult.taxonomy.segments.length,
      categories: classificationResult.taxonomy.categories.length,
      assignments: classificationResult.assignments.length,
      tokens: classificationResult.tokenUsage.totalTokens,
    });

    // Persist the new taxonomy to DB
    replaceTaxonomy(classificationResult.taxonomy);

    // Apply assignments to nodes
    const results: ReclassifyResult[] = [];
    let changedCount = 0;

    // Build a lookup for fast assignment access
    const assignmentMap = new Map(classificationResult.assignments.map(a => [a.nodeId, a]));

    for (const node of allNodes) {
      const nodeId = node.id as string;
      const assignment = assignmentMap.get(nodeId);
      if (!assignment) continue;

      const oldSeg = (node.segment_code as string) || null;
      const oldCat = (node.category_code as string) || null;
      const oldCt = (node.content_type_code as string) || null;

      const changed = oldSeg !== assignment.segmentCode || oldCat !== assignment.categoryCode || oldCt !== assignment.contentType;

      updateNode(nodeId, {
        segment_code: assignment.segmentCode,
        category_code: assignment.categoryCode,
        content_type_code: assignment.contentType,
        company: assignment.organization !== 'UNKN' ? assignment.organization : (node.company as string) || undefined,
        phrase_description: assignment.quickPhrase || undefined,
        subcategory_label: assignment.subcategoryLabel || undefined,
        short_description: assignment.description || undefined,
        function_tags: assignment.functionTags || undefined,
        metadata_tags: [
          `segment:${assignment.segmentCode}`,
          `category:${assignment.categoryCode}`,
          `type:${assignment.contentType}`,
          `org:${assignment.organization}`,
        ],
      });

      if (changed) changedCount++;

      results.push({
        nodeId,
        title: (node.title as string) || '',
        oldSegment: oldSeg,
        newSegment: assignment.segmentCode,
        oldCategory: oldCat,
        newCategory: assignment.categoryCode,
        oldContentType: oldCt,
        newContentType: assignment.contentType,
        organization: assignment.organization,
        confidence: assignment.confidence,
        changed,
      });
    }

    cache.invalidate('tree:*');

    // Phase 2 re-enrichment for changed nodes AND nodes with garbage/boilerplate titles
    const changedNodeIds = new Set(results.filter(r => r.changed).map(r => r.nodeId));
    const garbageTitleNodeIds = allNodes
      .filter(n => isGarbageTitle(n.title as string))
      .map(n => n.id as string);
    for (const id of garbageTitleNodeIds) changedNodeIds.add(id);
    const enrichNodeIds = Array.from(changedNodeIds);

    let enrichmentResults: { success: boolean; nodeId: string; error?: string }[] = [];
    if (enrichNodeIds.length > 0) {
      log.info(`Running Phase 2 re-enrichment on ${enrichNodeIds.length} nodes (${garbageTitleNodeIds.length} with boilerplate titles)`, {
        module: 'reclassify',
      });
      enrichmentResults = await enrichNodes(enrichNodeIds, { concurrency: 2 });
      cache.invalidate('tree:*');
    }

    const segmentSummary: Record<string, number> = {};
    for (const r of results) {
      segmentSummary[r.newSegment] = (segmentSummary[r.newSegment] || 0) + 1;
    }

    const enrichedCount = enrichmentResults.filter(r => r.success).length;

    // Build taxonomy summary for response
    const taxonomySummary = classificationResult.taxonomy.segments.map(seg => ({
      code: seg.code,
      label: seg.label,
      categories: classificationResult.taxonomy.categories
        .filter(c => c.segmentCode === seg.code)
        .map(c => ({ code: c.code, label: c.label })),
    }));

    res.json({
      message: `Reclassified ${results.length} nodes (${changedCount} changed, ${enrichedCount} re-enriched)`,
      durationMs: Date.now() - startTime,
      totalNodes: results.length,
      changedNodes: changedCount,
      enrichedNodes: enrichedCount,
      segmentDistribution: segmentSummary,
      taxonomy: taxonomySummary,
      tokenUsage: classificationResult.tokenUsage,
      results,
    });
  } catch (error) {
    log.error('Bulk reclassification failed', {
      error: error instanceof Error ? error.message : String(error),
      module: 'reclassify',
    });
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function reclassifyNode(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const node = readNode(id);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const apiKey = await keystore.getApiKey('openai');
    if (!apiKey) {
      res.status(400).json({ error: 'OpenAI API key not configured' });
      return;
    }

    const classifier = new Phase1Classifier(apiKey, {
      model: 'gpt-4o-mini',
      enableCache: false,
    });

    const input: ClassifyInput = {
      url: (node.url as string) || '',
      title: (node.title as string) || '',
      domain: (node.source_domain as string) || undefined,
      description: (node.short_description as string) || (node.phrase_description as string) || undefined,
      content: (node.ai_summary as string) || undefined,
    };

    const classifyResult = await classifier.classify(input);
    const cls = classifyResult.classification;

    updateNode(id, {
      segment_code: cls.segment,
      category_code: cls.category,
      content_type_code: cls.contentType,
      company: cls.organization !== 'UNKN' ? cls.organization : (node.company as string) || undefined,
      phrase_description: cls.quickPhrase || undefined,
      subcategory_label: cls.subcategory || undefined,
      short_description: cls.description || undefined,
      function_tags: cls.functionTags || undefined,
      metadata_tags: [
        `segment:${cls.segment}`,
        `category:${cls.category}`,
        `type:${cls.contentType}`,
        `org:${cls.organization}`,
      ],
    });

    cache.invalidate('tree:*');

    const updatedNode = readNode(id);

    res.json({
      message: 'Node reclassified successfully',
      classification: cls,
      node: updatedNode,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
