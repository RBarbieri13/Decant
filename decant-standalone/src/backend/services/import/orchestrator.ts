// ============================================================
// Import Orchestrator
// Coordinates the full import flow: extraction, classification,
// hierarchy code generation, node creation, and Phase 2 queueing
// ============================================================

import { log } from '../../logger/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCode } from '../../errors/index.js';
import { scrapeUrl, type ScrapedContent } from '../scraper.js';
import {
  Phase1Classifier,
  type ClassifyInput,
  type ClassifyResult,
  type Phase1Classification,
} from '../phase1_classifier.js';
import {
  regenerateNodeHierarchyCode,
  type CodeGenerationResult,
} from '../hierarchy/code_generator.js';
import { enqueueForEnrichment, getProcessingQueue } from '../processing_queue.js';
import { createNode, readNode, type CreateNodeInput } from '../../database/nodes.js';
import {
  getImportCache,
  normalizeUrlForCache,
  type CachedImportResult,
} from './cache.js';
import * as keystore from '../keystore.js';

// ============================================================
// Constants
// ============================================================

/** Default priority for Phase 2 enrichment jobs */
const DEFAULT_PHASE2_PRIORITY = 5;

// ============================================================
// Types
// ============================================================

/**
 * Import request input
 */
export interface ImportRequest {
  url: string;
  /** Skip cache lookup and force fresh import */
  forceRefresh?: boolean;
  /** Priority for Phase 2 enrichment (higher = sooner, default: 5) */
  priority?: number;
}

/**
 * Successful import result
 */
export interface ImportResult {
  success: true;
  nodeId: string;
  cached: boolean;
  classification: {
    segment: string;
    category: string;
    contentType: string;
    organization: string;
    confidence: number;
  };
  hierarchyCodes: {
    function: string | null;
    organization: string | null;
  };
  metadata: {
    title: string;
    description: string | null;
    favicon: string | null;
    image: string | null;
  };
  phase2Queued: boolean;
  phase2JobId?: string;
  /** Error message if Phase 2 queueing failed (import still succeeded) */
  phase2QueueError?: string;
}

/**
 * Import error result
 */
export interface ImportError {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Import orchestrator options
 */
export interface OrchestratorOptions {
  /** Enable import result caching */
  enableCache?: boolean;
  /** Skip Phase 2 enrichment queueing */
  skipPhase2?: boolean;
  /** Phase 1 classifier model */
  classifierModel?: string;
  /** Default priority for Phase 2 jobs (default: 5) */
  defaultPhase2Priority?: number;
}

// ============================================================
// URL Validation
// ============================================================

/**
 * Validate and normalize a URL for import
 * Returns the normalized URL or throws AppError
 */
export function validateAndNormalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new AppError('URL is required', 400, ErrorCode.URL_REQUIRED);
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    throw new AppError('URL cannot be empty', 400, ErrorCode.URL_EMPTY);
  }

  // Parse and validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new AppError('Invalid URL format', 400, ErrorCode.URL_INVALID);
  }

  // Validate protocol
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new AppError(
      `Invalid URL protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are supported.`,
      400,
      ErrorCode.URL_INVALID_PROTOCOL
    );
  }

  // Validate hostname exists
  if (!parsedUrl.hostname) {
    throw new AppError('URL must include a hostname', 400, ErrorCode.URL_NO_HOSTNAME);
  }

  return trimmedUrl;
}

// ============================================================
// Import Orchestrator Class
// ============================================================

/**
 * Main import orchestrator that coordinates the entire import flow
 */
export class ImportOrchestrator {
  private options: Required<OrchestratorOptions>;
  private classifierInstance: Phase1Classifier | null = null;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      skipPhase2: options.skipPhase2 ?? false,
      classifierModel: options.classifierModel ?? 'gpt-4o-mini',
      defaultPhase2Priority: options.defaultPhase2Priority ?? DEFAULT_PHASE2_PRIORITY,
    };
  }

  /**
   * Execute the full import flow for a URL
   */
  async import(request: ImportRequest): Promise<ImportResult | ImportError> {
    const startTime = Date.now();
    const logContext = { module: 'import-orchestrator' };

    try {
      // Step 1: Validate and normalize URL
      const validatedUrl = validateAndNormalizeUrl(request.url);
      const normalizedUrl = normalizeUrlForCache(validatedUrl);

      log.info('Starting import', { url: normalizedUrl, ...logContext });

      // Step 2: Check cache (unless force refresh)
      if (this.options.enableCache && !request.forceRefresh) {
        const cached = this.checkCache(normalizedUrl);
        if (cached) {
          log.info('Import served from cache', {
            url: normalizedUrl,
            nodeId: cached.nodeId,
            durationMs: Date.now() - startTime,
            ...logContext,
          });

          return {
            success: true,
            nodeId: cached.nodeId,
            cached: true,
            classification: cached.classification,
            hierarchyCodes: cached.hierarchyCodes,
            metadata: cached.metadata,
            phase2Queued: false,
          };
        }
      }

      // Step 3: Get API key
      const apiKey = await this.getApiKey();

      // Step 4: Fetch and extract content
      log.debug('Extracting content...', { url: normalizedUrl, ...logContext });
      const scraped = await this.extractContent(validatedUrl);

      // Step 5: Run Phase 1 classification
      log.debug('Running Phase 1 classification...', { url: normalizedUrl, ...logContext });
      const classifyResult = await this.classifyContent(scraped, apiKey);

      // Step 6: Create node in database
      log.debug('Creating node...', { url: normalizedUrl, ...logContext });
      const node = await this.createNodeFromImport(
        validatedUrl,
        scraped,
        classifyResult.classification
      );

      // Step 7: Generate hierarchy codes
      log.debug('Generating hierarchy codes...', { nodeId: node.id, ...logContext });
      const hierarchyCodes = this.generateHierarchyCodes(node.id);

      // Step 8: Queue Phase 2 enrichment
      // Note: This is done after node creation to ensure the node exists
      // Queueing failures should not fail the import
      let phase2JobId: string | undefined;
      let phase2Queued = false;
      let phase2QueueError: string | undefined;

      if (!this.options.skipPhase2) {
        const priority = request.priority ?? this.options.defaultPhase2Priority;
        log.info('Queueing Phase 2 enrichment', {
          nodeId: node.id,
          priority,
          ...logContext,
        });

        const queueResult = this.queuePhase2Enrichment(node.id, priority);
        phase2JobId = queueResult.jobId;
        phase2Queued = queueResult.success;
        phase2QueueError = queueResult.error;

        if (queueResult.success) {
          log.info('Phase 2 enrichment job created', {
            nodeId: node.id,
            jobId: phase2JobId,
            priority,
            queueActive: queueResult.queueActive,
            ...logContext,
          });
        } else {
          log.warn('Phase 2 enrichment queueing failed, import will continue', {
            nodeId: node.id,
            error: phase2QueueError,
            ...logContext,
          });
        }
      }

      // Build result
      const result: ImportResult = {
        success: true,
        nodeId: node.id,
        cached: false,
        classification: {
          segment: classifyResult.classification.segment,
          category: classifyResult.classification.category,
          contentType: classifyResult.classification.contentType,
          organization: classifyResult.classification.organization,
          confidence: classifyResult.classification.confidence,
        },
        hierarchyCodes: {
          function: hierarchyCodes?.functionHierarchyCode ?? null,
          organization: hierarchyCodes?.organizationHierarchyCode ?? null,
        },
        metadata: {
          title: node.title,
          description: scraped.description,
          favicon: scraped.favicon,
          image: scraped.image,
        },
        phase2Queued,
        phase2JobId,
        phase2QueueError,
      };

      // Step 9: Cache the result
      if (this.options.enableCache) {
        this.cacheResult(normalizedUrl, result);
      }

      log.info('Import completed successfully', {
        url: normalizedUrl,
        nodeId: node.id,
        segment: result.classification.segment,
        category: result.classification.category,
        phase2Queued,
        phase2JobId,
        durationMs: Date.now() - startTime,
        ...logContext,
      });

      return result;

    } catch (error) {
      return this.handleError(error, startTime);
    }
  }

  /**
   * Check if a URL is already cached
   */
  isCached(url: string): boolean {
    if (!this.options.enableCache) {
      return false;
    }

    const normalizedUrl = normalizeUrlForCache(url);
    const cache = getImportCache();
    return cache.has(normalizedUrl);
  }

  /**
   * Invalidate cache for a URL
   */
  invalidateCache(url: string): boolean {
    const cache = getImportCache();
    return cache.invalidate(url);
  }

  /**
   * Invalidate cache for a node ID
   */
  invalidateCacheByNodeId(nodeId: string): number {
    const cache = getImportCache();
    return cache.invalidateByNodeId(nodeId);
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Check cache for existing import result
   */
  private checkCache(normalizedUrl: string): CachedImportResult | null {
    const cache = getImportCache();
    const cached = cache.get(normalizedUrl);

    if (cached) {
      // Verify the node still exists
      const node = readNode(cached.nodeId);
      if (!node) {
        // Node was deleted, invalidate cache
        cache.invalidate(normalizedUrl);
        log.debug('Cached node no longer exists, invalidating', {
          url: normalizedUrl,
          nodeId: cached.nodeId,
          module: 'import-orchestrator',
        });
        return null;
      }
    }

    return cached;
  }

  /**
   * Get API key from keystore
   */
  private async getApiKey(): Promise<string> {
    const apiKey = await keystore.getApiKey('openai');

    if (!apiKey) {
      throw new AppError(
        'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or configure via settings.',
        400,
        ErrorCode.API_KEY_MISSING
      );
    }

    return apiKey;
  }

  /**
   * Extract content from URL using scraper
   */
  private async extractContent(url: string): Promise<ScrapedContent> {
    try {
      return await scrapeUrl(url);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown extraction error';
      throw new AppError(
        `Failed to extract content from URL: ${message}`,
        400,
        ErrorCode.EXTRACTION_FAILED
      );
    }
  }

  /**
   * Classify content using Phase 1 classifier
   */
  private async classifyContent(
    scraped: ScrapedContent,
    apiKey: string
  ): Promise<ClassifyResult> {
    // Lazy initialize classifier
    if (!this.classifierInstance) {
      this.classifierInstance = new Phase1Classifier(apiKey, {
        model: this.options.classifierModel,
        enableCache: true,
      });
    }

    const input: ClassifyInput = {
      url: scraped.url,
      title: scraped.title,
      domain: scraped.domain,
      description: scraped.description ?? undefined,
      author: scraped.author ?? undefined,
      siteName: scraped.siteName ?? undefined,
      content: scraped.content ?? undefined,
    };

    try {
      return await this.classifierInstance.classify(input);
    } catch (error) {
      // Classification errors should use fallback, not fail the import
      log.warn('Phase 1 classification failed, using fallback', {
        url: scraped.url,
        error: error instanceof Error ? error.message : String(error),
        module: 'import-orchestrator',
      });

      // Return a basic fallback classification
      return {
        classification: {
          segment: 'T',
          category: 'OTH',
          contentType: 'A',
          organization: 'UNKN',
          confidence: 0.1,
          reasoning: 'Fallback due to classification error',
        },
        fromCache: false,
      };
    }
  }

  /**
   * Create a node from import data
   */
  private async createNodeFromImport(
    url: string,
    scraped: ScrapedContent,
    classification: Phase1Classification
  ): Promise<any> {
    const nodeInput: CreateNodeInput = {
      title: classification.title || scraped.title,
      url: url,
      source_domain: scraped.domain,
      company: classification.organization !== 'UNKN' ? classification.organization : undefined,
      phrase_description: classification.reasoning?.slice(0, 100),
      short_description: scraped.description ?? undefined,
      logo_url: scraped.favicon ?? undefined,
      ai_summary: scraped.description ?? undefined,
      segment_code: classification.segment,
      category_code: classification.category,
      content_type_code: classification.contentType,
      extracted_fields: {
        author: scraped.author,
        siteName: scraped.siteName,
        image: scraped.image,
        segment: classification.segment,
        category: classification.category,
        contentType: classification.contentType,
        organization: classification.organization,
        confidence: classification.confidence,
      },
      metadata_tags: [
        `segment:${classification.segment}`,
        `category:${classification.category}`,
        `type:${classification.contentType}`,
        `org:${classification.organization}`,
      ],
      key_concepts: [],
      function_parent_id: null,
      organization_parent_id: null,
    };

    return createNode(nodeInput);
  }

  /**
   * Generate hierarchy codes for a node
   */
  private generateHierarchyCodes(nodeId: string): CodeGenerationResult | null {
    try {
      return regenerateNodeHierarchyCode(nodeId);
    } catch (error) {
      log.warn('Failed to generate hierarchy codes', {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
        module: 'import-orchestrator',
      });
      return null;
    }
  }

  /**
   * Queue node for Phase 2 enrichment
   * Returns the job ID if successful, handles errors gracefully
   */
  private queuePhase2Enrichment(
    nodeId: string,
    priority: number
  ): { success: boolean; jobId?: string; error?: string; queueActive?: boolean } {
    try {
      // Check if queue is available
      const queue = getProcessingQueue();
      const queueActive = queue.isActive();

      // Enqueue the job regardless of whether queue is running
      // Jobs will be processed when the queue starts
      const jobId = enqueueForEnrichment(nodeId, priority);

      if (!queueActive) {
        log.warn('Processing queue is not running, job will be processed when queue starts', {
          nodeId,
          jobId,
          module: 'import-orchestrator',
        });
      }

      return {
        success: true,
        jobId,
        queueActive,
      };
    } catch (error) {
      // Queue enrollment failure should not fail the import
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Failed to enqueue Phase 2 enrichment', {
        nodeId,
        priority,
        error: errorMessage,
        module: 'import-orchestrator',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Cache the import result
   */
  private cacheResult(normalizedUrl: string, result: ImportResult): void {
    const cache = getImportCache();
    cache.set(normalizedUrl, {
      nodeId: result.nodeId,
      classification: result.classification,
      hierarchyCodes: result.hierarchyCodes,
      metadata: result.metadata,
      cachedAt: Date.now(),
    });
  }

  /**
   * Handle errors and convert to ImportError
   */
  private handleError(error: unknown, startTime: number): ImportError {
    const durationMs = Date.now() - startTime;

    if (error instanceof AppError) {
      log.error('Import failed', {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        durationMs,
        module: 'import-orchestrator',
      });

      return {
        success: false,
        error: error.message,
        code: error.code || 'IMPORT_FAILED',
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    log.error('Import failed with unexpected error', {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs,
      module: 'import-orchestrator',
    });

    return {
      success: false,
      error: `Import failed: ${message}`,
      code: 'IMPORT_FAILED',
    };
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let orchestratorInstance: ImportOrchestrator | null = null;

/**
 * Get the singleton import orchestrator instance
 */
export function getImportOrchestrator(options?: OrchestratorOptions): ImportOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ImportOrchestrator(options);
    log.info('Import orchestrator initialized', { module: 'import-orchestrator' });
  }
  return orchestratorInstance;
}

/**
 * Reset the import orchestrator (useful for testing)
 */
export function resetImportOrchestrator(): void {
  orchestratorInstance = null;
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Import a URL using the default orchestrator
 */
export async function importUrl(
  url: string,
  options?: { forceRefresh?: boolean; priority?: number }
): Promise<ImportResult | ImportError> {
  const orchestrator = getImportOrchestrator();
  return orchestrator.import({
    url,
    forceRefresh: options?.forceRefresh,
    priority: options?.priority,
  });
}

/**
 * Check if a URL is already imported (cached)
 */
export function isUrlCached(url: string): boolean {
  const orchestrator = getImportOrchestrator();
  return orchestrator.isCached(url);
}

/**
 * Invalidate cache for a URL
 */
export function invalidateUrlCache(url: string): boolean {
  const orchestrator = getImportOrchestrator();
  return orchestrator.invalidateCache(url);
}
