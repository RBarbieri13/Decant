// ============================================================
// Phase 2 Enricher Service
// Deep analysis service for comprehensive content classification
// ============================================================

import OpenAI from 'openai';
import { log } from '../logger/index.js';
import {
  PHASE2_SYSTEM_PROMPT,
  generatePhase2UserPrompt,
  parsePhase2Response,
  type Phase2EnrichmentOutput,
  type MetadataCodes,
  type MetadataCodeType,
  METADATA_CODE_TYPES,
} from './llm/prompts/phase2_enrichment.js';
import { readNode, updateNode } from '../database/nodes.js';
import {
  getOrCreateCode,
  setMetadataForNode,
  type MetadataInput,
  type MetadataCodeType as RegistryCodeType,
} from './metadata_registry.js';

/**
 * Input for Phase 2 enrichment
 */
export interface Phase2EnrichmentInput {
  nodeId: string;
  url: string;
  domain: string;
  title: string;
  description?: string;
  content?: string;
  keyConcepts?: string[];
  segment?: string;
  contentType?: string;
}

/**
 * Configuration for the enricher service
 */
export interface Phase2EnricherConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * Result of enrichment operation
 */
export interface EnrichmentResult {
  success: boolean;
  nodeId: string;
  enrichment?: Phase2EnrichmentOutput;
  metadataCodesRegistered?: number;
  error?: string;
  durationMs: number;
}

/**
 * Default confidence score for AI-generated metadata codes
 */
const DEFAULT_AI_CONFIDENCE = 0.9;

/**
 * Phase 2 Enricher Service
 * Performs deep AI-powered analysis of content for rich metadata extraction
 */
export class Phase2Enricher {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private timeout: number;

  constructor(config: Phase2EnricherConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout || 60000,
    });
    this.model = config.model || 'gpt-4o-mini';
    this.temperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens || 4000;
    this.timeout = config.timeout || 60000;
  }

  /**
   * Perform Phase 2 enrichment on content
   */
  async enrich(input: Phase2EnrichmentInput): Promise<EnrichmentResult> {
    const startTime = Date.now();

    log.debug('Starting Phase 2 enrichment', {
      nodeId: input.nodeId,
      url: input.url,
      module: 'phase2-enricher',
    });

    try {
      // Generate the prompt
      const userPrompt = generatePhase2UserPrompt({
        url: input.url,
        domain: input.domain,
        existingTitle: input.title,
        existingDescription: input.description,
        content: input.content,
        existingKeyConcepts: input.keyConcepts,
        existingSegment: input.segment,
        existingContentType: input.contentType,
      });

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: PHASE2_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from AI');
      }

      // Parse and validate the response, passing domain for descriptor string
      const enrichment = parsePhase2Response(content, input.domain);
      if (!enrichment) {
        throw new Error('Failed to parse AI response');
      }

      // Validate required fields are populated
      this.validateEnrichmentResult(enrichment);

      const durationMs = Date.now() - startTime;

      log.info('Phase 2 enrichment completed', {
        nodeId: input.nodeId,
        durationMs,
        keyConceptCount: enrichment.keyConcepts.length,
        metadataCodeCount: this.countMetadataCodes(enrichment.metadataCodes),
        hasAiSummary: !!enrichment.aiSummary,
        hasLogoUrl: !!enrichment.logoUrl,
        codeConfidence: enrichment.codeConfidence,
        module: 'phase2-enricher',
      });

      return {
        success: true,
        nodeId: input.nodeId,
        enrichment,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error('Phase 2 enrichment failed', {
        nodeId: input.nodeId,
        error: errorMessage,
        durationMs,
        module: 'phase2-enricher',
      });

      return {
        success: false,
        nodeId: input.nodeId,
        error: errorMessage,
        durationMs,
      };
    }
  }

  /**
   * Count total metadata codes across all types
   */
  private countMetadataCodes(codes: MetadataCodes): number {
    return Object.values(codes).reduce((sum, arr) => sum + arr.length, 0);
  }

  /**
   * Validate that required enrichment fields are populated
   */
  private validateEnrichmentResult(enrichment: Phase2EnrichmentOutput): void {
    const warnings: string[] = [];

    // Check required string fields
    if (!enrichment.title || enrichment.title.trim().length === 0) {
      warnings.push('title is empty');
    }
    if (!enrichment.company || enrichment.company.trim().length === 0) {
      warnings.push('company is empty');
    }
    if (!enrichment.phraseDescription || enrichment.phraseDescription.trim().length === 0) {
      warnings.push('phraseDescription is empty');
    }
    if (!enrichment.shortDescription || enrichment.shortDescription.trim().length === 0) {
      warnings.push('shortDescription is empty');
    }

    // Check arrays
    if (!enrichment.keyConcepts || enrichment.keyConcepts.length === 0) {
      warnings.push('keyConcepts is empty');
    }

    // Log warnings but don't fail - partial enrichment is better than none
    if (warnings.length > 0) {
      log.warn('Enrichment result has missing fields', {
        warnings,
        module: 'phase2-enricher',
      });
    }
  }

  /**
   * Register metadata codes with the registry and create node associations.
   *
   * For each code type and value:
   * 1. Calls getOrCreateCode(type, code) to ensure it exists in registry
   * 2. Calls setMetadataForNode(nodeId, codes) to create junction entries
   * 3. Uses confidence score from LLM if provided, defaults to 0.9 for AI-generated
   *
   * @param nodeId - The node ID to associate codes with
   * @param metadataCodes - The metadata codes from enrichment
   * @param confidence - Confidence score (0-1)
   * @returns Number of codes successfully registered
   */
  private registerMetadataCodes(
    nodeId: string,
    metadataCodes: MetadataCodes,
    confidence: number = DEFAULT_AI_CONFIDENCE
  ): number {
    const metadataInputs: MetadataInput[] = [];
    let registeredCount = 0;

    // Iterate through each code type
    for (const type of Object.keys(METADATA_CODE_TYPES) as MetadataCodeType[]) {
      const codes = metadataCodes[type];
      if (!codes || codes.length === 0) continue;

      // Limit to max 5 per type as specified
      const limitedCodes = codes.slice(0, 5);

      for (const code of limitedCodes) {
        // Validate code format (uppercase, no spaces)
        if (!this.isValidCode(code)) {
          log.warn('Skipping invalid metadata code', {
            nodeId,
            type,
            code,
            reason: 'Invalid format (must be uppercase alphanumeric with underscores)',
            module: 'phase2-enricher',
          });
          continue;
        }

        try {
          // Ensure code exists in registry (creates if not exists)
          // This auto-registers the code with a display name
          const codeEntry = getOrCreateCode(type as RegistryCodeType, code);

          if (codeEntry) {
            // Add to metadata inputs for node association
            metadataInputs.push({
              type: type as RegistryCodeType,
              code: code,
              confidence: confidence,
            });
            registeredCount++;

            log.debug('Metadata code registered', {
              nodeId,
              type,
              code,
              codeId: codeEntry.id,
              module: 'phase2-enricher',
            });
          }
        } catch (error) {
          log.warn('Failed to register metadata code', {
            nodeId,
            type,
            code,
            error: error instanceof Error ? error.message : String(error),
            module: 'phase2-enricher',
          });
        }
      }
    }

    // Set all metadata associations for the node
    if (metadataInputs.length > 0) {
      try {
        setMetadataForNode(nodeId, metadataInputs);
        log.debug('Metadata codes associated with node', {
          nodeId,
          count: metadataInputs.length,
          module: 'phase2-enricher',
        });
      } catch (error) {
        log.error('Failed to set node metadata associations', {
          nodeId,
          error: error instanceof Error ? error.message : String(error),
          module: 'phase2-enricher',
        });
      }
    }

    return registeredCount;
  }

  /**
   * Validate that a code follows the expected format:
   * - Uppercase only
   * - Alphanumeric with underscores
   * - Starts with a letter
   * - 1-50 characters (SEG and TYP are single-letter codes)
   * - No spaces
   */
  private isValidCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    if (code.length < 1 || code.length > 50) return false;
    if (!/^[A-Z][A-Z0-9_]*$/.test(code)) return false;
    return true;
  }

  /**
   * Enrich a node by ID and update it in the database
   */
  async enrichAndUpdateNode(nodeId: string): Promise<EnrichmentResult> {
    const startTime = Date.now();

    // Load the node
    const node = readNode(nodeId);
    if (!node) {
      return {
        success: false,
        nodeId,
        error: 'Node not found',
        durationMs: Date.now() - startTime,
      };
    }

    // Prepare input from node data
    const input: Phase2EnrichmentInput = {
      nodeId,
      url: node.url as string,
      domain: node.source_domain as string,
      title: node.title as string,
      description: (node.short_description || node.phrase_description) as string | undefined,
      content: node.ai_summary as string | undefined, // Use existing AI summary as content context
      keyConcepts: node.key_concepts as string[] | undefined,
      segment: (node.extracted_fields as Record<string, unknown>)?.segment as string | undefined,
      contentType: (node.extracted_fields as Record<string, unknown>)?.contentType as string | undefined,
    };

    // Perform enrichment
    const result = await this.enrich(input);

    if (result.success && result.enrichment) {
      // Update the node with enrichment data
      try {
        const updateData = this.mapEnrichmentToNodeUpdate(result.enrichment, node.source_domain as string);
        updateNode(nodeId, updateData);

        log.info('Node updated with Phase 2 enrichment', {
          nodeId,
          fieldsUpdated: Object.keys(updateData).filter(k => updateData[k as keyof typeof updateData] !== undefined),
          module: 'phase2-enricher',
        });
      } catch (updateError) {
        const errorMessage =
          updateError instanceof Error
            ? updateError.message
            : String(updateError);

        log.error('Failed to update node with enrichment', {
          nodeId,
          error: errorMessage,
          module: 'phase2-enricher',
        });

        return {
          success: false,
          nodeId,
          error: `Enrichment succeeded but update failed: ${errorMessage}`,
          durationMs: Date.now() - startTime,
        };
      }

      // Register metadata codes with the registry
      try {
        const confidence = result.enrichment.codeConfidence ?? DEFAULT_AI_CONFIDENCE;
        const registeredCount = this.registerMetadataCodes(
          nodeId,
          result.enrichment.metadataCodes,
          confidence
        );

        result.metadataCodesRegistered = registeredCount;

        log.info('Metadata codes registered with registry', {
          nodeId,
          registeredCount,
          confidence,
          module: 'phase2-enricher',
        });
      } catch (registryError) {
        // Log but don't fail the enrichment if registry fails
        // The codes are still stored in extracted_fields as a fallback
        log.warn('Failed to register metadata codes with registry (non-fatal)', {
          nodeId,
          error: registryError instanceof Error ? registryError.message : String(registryError),
          module: 'phase2-enricher',
        });
      }
    }

    return result;
  }

  /**
   * Map enrichment result to node update format
   * Ensures ALL spec-required fields are populated:
   * 1. title - Cleaned/improved title (max 500 chars)
   * 2. company - Organization behind the content
   * 3. phrase_description - Ultra-brief tagline (max 100 chars)
   * 4. short_description - 1-3 sentences (max 500 chars)
   * 5. ai_summary - Longer AI-generated summary
   * 6. key_concepts - Array of lowercase tags (max 20)
   * 7. logo_url - Extract favicon or logo from page
   * 8. metadata_tags - Basic tag array
   * 9. descriptor_string - Concatenated searchable text (in extracted_fields)
   */
  private mapEnrichmentToNodeUpdate(
    enrichment: Phase2EnrichmentOutput,
    sourceDomain: string
  ): {
    title?: string;
    company?: string;
    phrase_description?: string;
    short_description?: string;
    logo_url?: string;
    ai_summary?: string;
    key_concepts?: string[];
    metadata_tags?: string[];
    extracted_fields?: Record<string, unknown>;
    segment_code?: string;
    category_code?: string;
    content_type_code?: string;
  } {
    // Build the update object with all spec-required fields
    const update: {
      title?: string;
      company?: string;
      phrase_description?: string;
      short_description?: string;
      logo_url?: string;
      ai_summary?: string;
      key_concepts?: string[];
      metadata_tags?: string[];
      extracted_fields?: Record<string, unknown>;
      segment_code?: string;
      category_code?: string;
      content_type_code?: string;
    } = {};

    // 1. Title - Cleaned/improved title (max 500 chars)
    if (enrichment.title) {
      update.title = enrichment.title.slice(0, 500);
    }

    // 2. Company - Organization behind the content
    if (enrichment.company) {
      update.company = enrichment.company.slice(0, 200);
    }

    // 3. Phrase Description - Ultra-brief tagline (max 100 chars)
    if (enrichment.phraseDescription) {
      update.phrase_description = enrichment.phraseDescription.slice(0, 100);
    }

    // 4. Short Description - 1-3 sentences (max 500 chars)
    if (enrichment.shortDescription) {
      update.short_description = enrichment.shortDescription.slice(0, 500);
    }

    // 5. AI Summary - Longer AI-generated summary
    if (enrichment.aiSummary) {
      update.ai_summary = enrichment.aiSummary.slice(0, 2000);
    }

    // 6. Key Concepts - Array of lowercase tags (max 20)
    if (enrichment.keyConcepts && enrichment.keyConcepts.length > 0) {
      update.key_concepts = enrichment.keyConcepts
        .slice(0, 20)
        .map(c => c.toLowerCase().trim())
        .filter(c => c.length > 0);
    }

    // 7. Logo URL - Extract favicon or logo from page
    if (enrichment.logoUrl) {
      update.logo_url = enrichment.logoUrl;
    } else {
      // Fallback: generate favicon URL from domain
      update.logo_url = this.generateFaviconUrl(sourceDomain);
    }

    // 8. Metadata Tags - Basic tag array
    if (enrichment.metadataTags && enrichment.metadataTags.length > 0) {
      update.metadata_tags = enrichment.metadataTags
        .slice(0, 10)
        .map(t => t.toLowerCase().trim())
        .filter(t => t.length > 0);
    }

    // 9. Extracted Fields - includes descriptor_string and metadata codes
    update.extracted_fields = {
      // Metadata codes for faceted classification (UPPERCASE)
      metadataCodes: enrichment.metadataCodes,
      // Code confidence score from LLM
      codeConfidence: enrichment.codeConfidence ?? DEFAULT_AI_CONFIDENCE,
      // Descriptor string format: [Title]|[SourceDomain]|[Company]|[PhraseDesc]|[ShortDesc]|[KeyConcepts joined by |]
      descriptorString: enrichment.descriptorString,
      // Phase 2 completion tracking
      phase2Completed: true,
      phase2CompletedAt: new Date().toISOString(),
      phase2Version: '2.1', // Version with metadata registry integration
    };

    // 10. Classification Codes - Set primary codes from metadata for UI filtering
    if (enrichment.metadataCodes) {
      // Set segment_code from first SEG code
      if (enrichment.metadataCodes.SEG && enrichment.metadataCodes.SEG.length > 0) {
        update.segment_code = enrichment.metadataCodes.SEG[0];
      }
      // Set category_code from first CAT code
      if (enrichment.metadataCodes.CAT && enrichment.metadataCodes.CAT.length > 0) {
        update.category_code = enrichment.metadataCodes.CAT[0];
      }
      // Set content_type_code from first TYP code
      if (enrichment.metadataCodes.TYP && enrichment.metadataCodes.TYP.length > 0) {
        update.content_type_code = enrichment.metadataCodes.TYP[0];
      }
    }

    return update;
  }

  /**
   * Generate a favicon URL from domain
   * Falls back to common favicon locations
   */
  private generateFaviconUrl(domain: string): string {
    if (!domain) {
      return '';
    }

    // Clean domain (remove any protocol if present)
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Use Google's favicon service as a reliable fallback
    return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;
  }

  /**
   * Create an enricher with default configuration from environment
   */
  static fromEnv(): Phase2Enricher | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log.warn(
        'OPENAI_API_KEY not set, Phase 2 enricher unavailable',
        { module: 'phase2-enricher' }
      );
      return null;
    }

    return new Phase2Enricher({
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
    });
  }
}

/**
 * Singleton instance for convenience
 */
let defaultEnricher: Phase2Enricher | null = null;

/**
 * Get or create the default enricher instance
 */
export function getPhase2Enricher(): Phase2Enricher | null {
  if (!defaultEnricher) {
    defaultEnricher = Phase2Enricher.fromEnv();
  }
  return defaultEnricher;
}

/**
 * Enrich a node using the default enricher
 */
export async function enrichNode(nodeId: string): Promise<EnrichmentResult> {
  const enricher = getPhase2Enricher();
  if (!enricher) {
    return {
      success: false,
      nodeId,
      error: 'Phase 2 enricher not configured (missing OPENAI_API_KEY)',
      durationMs: 0,
    };
  }

  return enricher.enrichAndUpdateNode(nodeId);
}

/**
 * Batch enrich multiple nodes
 */
export async function enrichNodes(
  nodeIds: string[],
  options?: { concurrency?: number }
): Promise<EnrichmentResult[]> {
  const enricher = getPhase2Enricher();
  if (!enricher) {
    return nodeIds.map((nodeId) => ({
      success: false,
      nodeId,
      error: 'Phase 2 enricher not configured',
      durationMs: 0,
    }));
  }

  const concurrency = options?.concurrency || 3;
  const results: EnrichmentResult[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < nodeIds.length; i += concurrency) {
    const batch = nodeIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((nodeId) => enricher.enrichAndUpdateNode(nodeId))
    );
    results.push(...batchResults);

    // Small delay between batches to be nice to the API
    if (i + concurrency < nodeIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

// Re-export types for convenience
export type { Phase2EnrichmentOutput, MetadataCodes };
