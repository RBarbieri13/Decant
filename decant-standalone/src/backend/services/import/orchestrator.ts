// ============================================================
// Import Orchestrator
// ============================================================
// Coordinates the full import flow: extraction, semantic profiling,
// node creation, hierarchy placement, and scoped refinement.
// Single synchronous step — no Phase 1/Phase 2 split.

import { log } from '../../logger/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCode } from '../../errors/index.js';
import { scrapeUrl, fetchWithLimits, type ScrapedContent } from '../scraper.js';
import { extractorRegistry } from '../extractors/index.js';
import type { ExtractorResult } from '../extractors/base.js';
import {
  SemanticProfiler,
  type SemanticProfile,
  type SemanticProfileInput,
  type ProfileResult,
} from '../semantic_profiler.js';
import { getHierarchyEngine, hasHierarchyEngine, type PlacementResult } from '../hierarchy/hierarchy_engine.js';
import {
  createNode, readNode, findNodeByUrl, findNodeByNormalizedUrl, updateNode,
  type CreateNodeInput,
} from '../../database/nodes.js';
import { registerMetadataCodesFromProfile } from '../../database/metadata.js';
import {
  getImportCache,
  normalizeUrlForCache,
  type CachedImportResult,
} from './cache.js';
import * as keystore from '../keystore.js';
import * as appCache from '../../cache/index.js';

// ============================================================
// Constants
// ============================================================

const FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';

// ============================================================
// Types
// ============================================================

export interface ImportRequest {
  url: string;
  forceRefresh?: boolean;
  priority?: number;
}

export interface ImportResult {
  success: true;
  nodeId: string;
  cached: boolean;
  profile: {
    title: string;
    company: string;
    primaryFunction: string;
    primaryDomain: string;
    resourceType: string;
    confidence: number;
  };
  placement: {
    branchId: string;
    branchLabel: string;
    branchDepth: number;
    path: string[];
  };
  metadata: {
    title: string;
    description: string | null;
    favicon: string | null;
    image: string | null;
  };
  refinement: {
    ran: boolean;
    branchesModified: number;
    durationMs: number;
  };
}

export interface ImportError {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export interface OrchestratorOptions {
  enableCache?: boolean;
  skipRefinement?: boolean;
  profilerModel?: string;
}

// ============================================================
// URL Validation
// ============================================================

export function validateAndNormalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new AppError('URL is required', 400, ErrorCode.URL_REQUIRED);
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new AppError('URL cannot be empty', 400, ErrorCode.URL_EMPTY);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new AppError('Invalid URL format', 400, ErrorCode.URL_INVALID);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new AppError(
      `Invalid URL protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are supported.`,
      400,
      ErrorCode.URL_INVALID_PROTOCOL,
    );
  }

  if (!parsedUrl.hostname) {
    throw new AppError('URL must include a hostname', 400, ErrorCode.URL_NO_HOSTNAME);
  }

  return trimmedUrl;
}

// ============================================================
// Import Orchestrator Class
// ============================================================

export class ImportOrchestrator {
  private options: Required<OrchestratorOptions>;
  private profiler: SemanticProfiler | null = null;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      skipRefinement: options.skipRefinement ?? false,
      profilerModel: options.profilerModel ?? 'gpt-4o',
    };
  }

  /**
   * Execute the full import flow for a URL.
   * Single synchronous step: extract → profile → create → place → refine.
   */
  async import(request: ImportRequest): Promise<ImportResult | ImportError> {
    const startTime = Date.now();
    const ctx = { module: 'import-orchestrator' };

    try {
      // Step 1: Validate URL
      const validatedUrl = validateAndNormalizeUrl(request.url);
      const normalizedUrl = normalizeUrlForCache(validatedUrl);

      log.info('Starting import', { url: normalizedUrl, ...ctx });

      // Step 2: Cache check
      if (this.options.enableCache && !request.forceRefresh) {
        const cached = this.checkCache(normalizedUrl);
        if (cached) {
          log.info('Import served from cache', { url: normalizedUrl, nodeId: cached.nodeId, ...ctx });
          return {
            success: true,
            nodeId: cached.nodeId,
            cached: true,
            profile: cached.profile ?? cached.classification as any,
            placement: cached.placement ?? { branchId: '', branchLabel: '', branchDepth: 0, path: [] },
            metadata: cached.metadata,
            refinement: { ran: false, branchesModified: 0, durationMs: 0 },
          };
        }
      }

      // Step 2b: Duplicate check
      if (!request.forceRefresh) {
        const existing = findNodeByNormalizedUrl(normalizedUrl);
        if (existing) {
          return {
            success: false,
            error: `This URL is already in your library as "${existing.title}"`,
            code: 'DUPLICATE_URL',
            details: { existingNodeId: existing.id, existingTitle: existing.title },
          };
        }
      }

      // Step 3: Get API key
      const apiKey = await this.getApiKey();

      // Step 4: Extract content
      log.debug('Extracting content...', { url: normalizedUrl, ...ctx });
      const scraped = await this.extractContent(validatedUrl);

      // Step 5: Generate semantic profile (single LLM call — replaces Phase 1 + Phase 2)
      log.debug('Generating semantic profile...', { url: normalizedUrl, ...ctx });
      const profileResult = await this.generateProfile(scraped, apiKey);
      const profile = profileResult.profile;

      // Step 6: Create node in database
      log.debug('Creating node...', { url: normalizedUrl, ...ctx });
      const node = this.createNodeFromImport(validatedUrl, scraped, profile, profileResult.descriptorString);

      // Step 7: Register faceted metadata codes
      try {
        registerMetadataCodesFromProfile(node.id as string, profile);
      } catch (err) {
        log.warn('Metadata code registration failed', {
          nodeId: node.id, error: err instanceof Error ? err.message : String(err), ...ctx,
        });
      }

      // Step 8: Place into hierarchy
      let placement: PlacementResult = {
        branchId: '', branchLabel: 'Unplaced', branchDepth: 0, confidence: 0, path: [],
      };
      if (hasHierarchyEngine()) {
        log.debug('Placing in hierarchy...', { nodeId: node.id, ...ctx });
        placement = getHierarchyEngine().placeNode(node.id as string, profile);
      }

      // Step 9: Scoped global refinement (dirty branches only)
      let refinement = { ran: false, branchesModified: 0, durationMs: 0 };
      if (!this.options.skipRefinement && hasHierarchyEngine()) {
        try {
          log.debug('Running scoped refinement...', { nodeId: node.id, ...ctx });
          const refResult = await getHierarchyEngine().refineHierarchy('scoped', 'import');
          refinement = { ran: true, branchesModified: refResult.branchesModified, durationMs: refResult.durationMs };
        } catch (err) {
          log.warn('Post-import refinement failed', {
            nodeId: node.id, error: err instanceof Error ? err.message : String(err), ...ctx,
          });
        }
      }

      // Invalidate tree cache
      appCache.invalidate('tree:*');

      // Build result
      const result: ImportResult = {
        success: true,
        nodeId: node.id as string,
        cached: false,
        profile: {
          title: profile.title,
          company: profile.company,
          primaryFunction: profile.primaryFunction,
          primaryDomain: profile.primaryDomain,
          resourceType: profile.resourceType,
          confidence: profile.confidence,
        },
        placement: {
          branchId: placement.branchId,
          branchLabel: placement.branchLabel,
          branchDepth: placement.branchDepth,
          path: placement.path,
        },
        metadata: {
          title: profile.title,
          description: profile.shortDescription,
          favicon: scraped.favicon,
          image: scraped.image,
        },
        refinement,
      };

      // Step 10: Cache
      if (this.options.enableCache) {
        this.cacheResult(normalizedUrl, result);
      }

      log.info('Import completed', {
        url: normalizedUrl,
        nodeId: node.id,
        function: profile.primaryFunction,
        domain: profile.primaryDomain,
        branchLabel: placement.branchLabel,
        branchDepth: placement.branchDepth,
        refinement: refinement.ran ? `${refinement.branchesModified} branches modified` : 'skipped',
        durationMs: Date.now() - startTime,
        ...ctx,
      });

      return result;
    } catch (error) {
      return this.handleError(error, startTime);
    }
  }

  isCached(url: string): boolean {
    if (!this.options.enableCache) return false;
    const cache = getImportCache();
    return cache.has(normalizeUrlForCache(url));
  }

  invalidateCache(url: string): boolean {
    const cache = getImportCache();
    return cache.invalidate(url);
  }

  invalidateCacheByNodeId(nodeId: string): number {
    const cache = getImportCache();
    return cache.invalidateByNodeId(nodeId);
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private checkCache(normalizedUrl: string): CachedImportResult | null {
    const cache = getImportCache();
    const cached = cache.get(normalizedUrl);
    if (cached) {
      const node = readNode(cached.nodeId);
      if (!node) {
        cache.invalidate(normalizedUrl);
        return null;
      }
    }
    return cached;
  }

  private async getApiKey(): Promise<string> {
    const apiKey = await keystore.getApiKey('openai');
    if (!apiKey) {
      throw new AppError(
        'OpenAI API key not configured.',
        400,
        ErrorCode.API_KEY_MISSING,
      );
    }
    return apiKey;
  }

  private extractorResultToScrapedContent(result: ExtractorResult, url: string): ScrapedContent {
    return {
      url,
      title: result.title,
      description: result.description,
      author: result.author,
      siteName: result.siteName,
      favicon: result.favicon,
      image: result.image,
      content: result.content,
      domain: result.domain,
    };
  }

  private async extractContent(url: string): Promise<ScrapedContent> {
    try {
      const parsedUrl = new URL(url);
      if (extractorRegistry.hasSpecializedExtractor(parsedUrl)) {
        let html = '';
        try {
          html = await fetchWithLimits(url);
        } catch { /* best-effort */ }

        const result = await extractorRegistry.extract(url, url, html, undefined, undefined);
        return this.extractorResultToScrapedContent(result, url);
      }
      return await scrapeUrl(url);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown extraction error';
      throw new AppError(`Failed to extract content: ${msg}`, 400, ErrorCode.EXTRACTION_FAILED);
    }
  }

  private async generateProfile(scraped: ScrapedContent, apiKey: string): Promise<ProfileResult> {
    if (!this.profiler) {
      this.profiler = new SemanticProfiler(apiKey, { model: this.options.profilerModel });
    }

    const input: SemanticProfileInput = {
      url: scraped.url,
      title: scraped.title,
      domain: scraped.domain,
      description: scraped.description ?? undefined,
      author: scraped.author ?? undefined,
      siteName: scraped.siteName ?? undefined,
      content: scraped.content ?? undefined,
      image: scraped.image ?? undefined,
      favicon: scraped.favicon ?? undefined,
    };

    return this.profiler.profile(input);
  }

  private createNodeFromImport(
    url: string,
    scraped: ScrapedContent,
    profile: SemanticProfile,
    descriptorString: string,
  ): any {
    const existingNode = findNodeByUrl(url);
    if (existingNode) {
      // Update existing node with better data
      updateNode(existingNode.id as string, {
        title: profile.title,
        company: profile.company,
        phrase_description: profile.phraseDescription,
        short_description: profile.shortDescription,
        logo_url: profile.logoUrl || scraped.favicon || undefined,
        ai_summary: profile.aiSummary?.slice(0, 2000) || undefined,
        // Keep old classification columns populated for backward compat during migration
        segment_code: undefined,
        category_code: undefined,
        content_type_code: this.mapResourceTypeToContentTypeCode(profile.resourceType),
        function_tags: profile.functionTags || undefined,
        extracted_fields: {
          ...this.buildExtractedFields(profile, scraped),
          descriptorString,
        },
        metadata_tags: profile.metadataTags,
        extraction_quality: this.determineExtractionQuality(scraped),
      });

      return readNode(existingNode.id as string) ?? existingNode;
    }

    const nodeInput: CreateNodeInput = {
      title: profile.title,
      url,
      source_domain: scraped.domain,
      company: profile.company,
      phrase_description: profile.phraseDescription,
      short_description: profile.shortDescription,
      logo_url: profile.logoUrl || scraped.favicon || this.generateFaviconUrl(scraped.domain) || undefined,
      ai_summary: profile.aiSummary?.slice(0, 2000) || scraped.description || undefined,
      content_type_code: this.mapResourceTypeToContentTypeCode(profile.resourceType),
      function_tags: profile.functionTags || null,
      extracted_fields: {
        ...this.buildExtractedFields(profile, scraped),
        descriptorString,
      },
      metadata_tags: profile.metadataTags,
      key_concepts: profile.keyConcepts,
      extraction_quality: this.determineExtractionQuality(scraped),
      // These will be null — hierarchy placement is via hierarchy_branches now
      function_parent_id: null,
      organization_parent_id: null,
    };

    return createNode(nodeInput);
  }

  private buildExtractedFields(profile: SemanticProfile, scraped: ScrapedContent): Record<string, unknown> {
    return {
      // Core identity from semantic profile
      primaryFunction: profile.primaryFunction,
      primaryDomain: profile.primaryDomain,
      resourceType: profile.resourceType,
      technologies: profile.technologies,
      concepts: profile.concepts,
      audience: profile.audience,
      platform: profile.platform,
      industry: profile.industry,
      pricing: profile.pricing,
      confidence: profile.confidence,
      // Original scrape metadata
      author: scraped.author,
      siteName: scraped.siteName,
      image: scraped.image,
      // Phase 2 tracking (kept for backward compat queries)
      phase2Completed: true,
      phase2CompletedAt: new Date().toISOString(),
      phase2Version: '3.0',
    };
  }

  private determineExtractionQuality(scraped: ScrapedContent): string {
    if (scraped.content && scraped.title !== 'Untitled') return 'full';
    if (scraped.description || (scraped.content && scraped.title === 'Untitled')) return 'partial';
    return 'minimal';
  }

  private mapResourceTypeToContentTypeCode(resourceType: string): string {
    const mapping: Record<string, string> = {
      tool: 'T', article: 'A', video: 'V', paper: 'R',
      repository: 'G', guide: 'G', service: 'S', course: 'C',
      image: 'I', news: 'N', knowledge_base: 'K', dataset: 'A',
      podcast: 'P', newsletter: 'N', community: 'A', other: 'U',
    };
    return mapping[resourceType] || 'U';
  }

  private generateFaviconUrl(domain: string | null): string | undefined {
    if (!domain) return undefined;
    const clean = domain.replace(/^www\./, '');
    return `${FAVICON_BASE}${clean}&sz=64`;
  }

  private cacheResult(normalizedUrl: string, result: ImportResult): void {
    const cache = getImportCache();
    cache.set(normalizedUrl, {
      nodeId: result.nodeId,
      classification: result.profile as any,
      profile: result.profile,
      hierarchyCodes: { function: null, organization: null },
      placement: result.placement,
      metadata: result.metadata,
      cachedAt: Date.now(),
    });
  }

  private handleError(error: unknown, startTime: number): ImportError {
    const durationMs = Date.now() - startTime;

    if (error instanceof AppError) {
      log.error('Import failed', {
        code: error.code, message: error.message, durationMs, module: 'import-orchestrator',
      });
      return { success: false, error: error.message, code: error.code || 'IMPORT_FAILED' };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Import failed with unexpected error', {
      error: message, durationMs, module: 'import-orchestrator',
    });
    return { success: false, error: `Import failed: ${message}`, code: 'IMPORT_FAILED' };
  }
}

// ============================================================
// Singleton
// ============================================================

let orchestratorInstance: ImportOrchestrator | null = null;

export function getImportOrchestrator(options?: OrchestratorOptions): ImportOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ImportOrchestrator(options);
    log.info('Import orchestrator initialized', { module: 'import-orchestrator' });
  }
  return orchestratorInstance;
}

export function resetImportOrchestrator(): void {
  orchestratorInstance = null;
}

export async function importUrl(
  url: string,
  options?: { forceRefresh?: boolean; priority?: number },
): Promise<ImportResult | ImportError> {
  const orchestrator = getImportOrchestrator();
  return orchestrator.import({ url, forceRefresh: options?.forceRefresh, priority: options?.priority });
}

export function isUrlCached(url: string): boolean {
  const orchestrator = getImportOrchestrator();
  return orchestrator.isCached(url);
}

export function invalidateUrlCache(url: string): boolean {
  const orchestrator = getImportOrchestrator();
  return orchestrator.invalidateCache(url);
}
