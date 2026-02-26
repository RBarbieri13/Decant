import { Request, Response } from 'express';
import { getAllNodes as dbGetAllNodes, readNode, updateNode } from '../database/nodes.js';
import { Phase1Classifier, type ClassifyInput } from '../services/phase1_classifier.js';
import * as keystore from '../services/keystore.js';
import { log } from '../logger/index.js';
import * as cache from '../cache/index.js';

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

    const classifier = new Phase1Classifier(apiKey, {
      model: 'gpt-4o-mini',
      enableCache: false,
    });

    const allNodes = dbGetAllNodes() as Array<Record<string, unknown>>;
    if (allNodes.length === 0) {
      res.json({ message: 'No nodes to reclassify', results: [], summary: {} });
      return;
    }

    const results: ReclassifyResult[] = [];
    let changedCount = 0;

    for (const node of allNodes) {
      try {
        const input: ClassifyInput = {
          url: (node.url as string) || '',
          title: (node.title as string) || '',
          domain: (node.source_domain as string) || undefined,
          description: (node.short_description as string) || (node.phrase_description as string) || undefined,
          content: (node.ai_summary as string) || undefined,
        };

        const classifyResult = await classifier.classify(input);
        const cls = classifyResult.classification;

        const oldSeg = (node.segment_code as string) || null;
        const oldCat = (node.category_code as string) || null;
        const oldCt = (node.content_type_code as string) || null;

        const changed = oldSeg !== cls.segment || oldCat !== cls.category || oldCt !== cls.contentType;

        updateNode(node.id as string, {
          segment_code: cls.segment,
          category_code: cls.category,
          content_type_code: cls.contentType,
          company: cls.organization !== 'UNKN' ? cls.organization : (node.company as string) || undefined,
          phrase_description: cls.quickPhrase || undefined,
          metadata_tags: [
            `segment:${cls.segment}`,
            `category:${cls.category}`,
            `type:${cls.contentType}`,
            `org:${cls.organization}`,
          ],
        });

        if (changed) changedCount++;

        results.push({
          nodeId: node.id as string,
          title: (node.title as string) || '',
          oldSegment: oldSeg,
          newSegment: cls.segment,
          oldCategory: oldCat,
          newCategory: cls.category,
          oldContentType: oldCt,
          newContentType: cls.contentType,
          organization: cls.organization,
          confidence: cls.confidence,
          changed,
        });

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        log.warn('Failed to reclassify node', {
          nodeId: node.id,
          error: err instanceof Error ? err.message : String(err),
          module: 'reclassify',
        });
      }
    }

    cache.invalidate('tree:*');

    const segmentSummary: Record<string, number> = {};
    for (const r of results) {
      segmentSummary[r.newSegment] = (segmentSummary[r.newSegment] || 0) + 1;
    }

    res.json({
      message: `Reclassified ${results.length} nodes (${changedCount} changed)`,
      durationMs: Date.now() - startTime,
      totalNodes: results.length,
      changedNodes: changedCount,
      segmentDistribution: segmentSummary,
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
