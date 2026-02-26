// ============================================================
// Extractor Registry
// Central registry for all content extractors
// Implements the registry pattern for dynamic extractor selection
// ============================================================

import {
  Extractor,
  ExtractorResult,
  ExtractionContext,
  BaseExtractor,
  YouTubeFields,
  GitHubFields,
  ArticleFields,
  TwitterFields,
} from './base.js';
import { YouTubeExtractor, youtubeExtractor } from './youtube.js';
import { GitHubExtractor, githubExtractor } from './github.js';
import { ArticleExtractor, articleExtractor } from './article.js';
import { TwitterExtractor, twitterExtractor } from './twitter.js';
import { log } from '../../logger/index.js';

// Re-export types and classes from base
export type {
  Extractor,
  ExtractorResult,
  ExtractionContext,
  YouTubeFields,
  GitHubFields,
  ArticleFields,
  TwitterFields,
};

export { BaseExtractor };

// Re-export concrete extractors
export { YouTubeExtractor, youtubeExtractor } from './youtube.js';
export { GitHubExtractor, githubExtractor } from './github.js';
export { ArticleExtractor, articleExtractor } from './article.js';
export { TwitterExtractor, twitterExtractor } from './twitter.js';

// ============================================================
// Extractor Registry
// ============================================================

/**
 * Registry that manages all content extractors
 * Selects the appropriate extractor based on URL patterns
 */
export class ExtractorRegistry {
  private extractors: Extractor[] = [];
  private fallbackExtractor: Extractor;

  constructor() {
    // Register built-in extractors
    this.register(youtubeExtractor);
    this.register(githubExtractor);
    this.register(twitterExtractor);

    // Article extractor is the fallback
    this.fallbackExtractor = articleExtractor;
  }

  /**
   * Register a new extractor
   * Extractors are sorted by priority (highest first)
   */
  register(extractor: Extractor): void {
    this.extractors.push(extractor);
    // Sort by priority (highest first)
    this.extractors.sort((a, b) => b.priority - a.priority);

    log.debug('Registered extractor', {
      name: extractor.name,
      priority: extractor.priority,
    });
  }

  /**
   * Unregister an extractor by name
   */
  unregister(name: string): boolean {
    const index = this.extractors.findIndex(e => e.name === name);
    if (index !== -1) {
      this.extractors.splice(index, 1);
      log.debug('Unregistered extractor', { name });
      return true;
    }
    return false;
  }

  /**
   * Get all registered extractors
   */
  getExtractors(): ReadonlyArray<Extractor> {
    return this.extractors;
  }

  /**
   * Get extractor by name
   */
  getExtractor(name: string): Extractor | undefined {
    return this.extractors.find(e => e.name === name);
  }

  /**
   * Find the best extractor for a URL
   * Returns the first extractor that can handle the URL (sorted by priority)
   */
  findExtractor(url: URL): Extractor {
    for (const extractor of this.extractors) {
      if (extractor.canHandle(url)) {
        log.debug('Found matching extractor', {
          url: url.href,
          extractor: extractor.name,
        });
        return extractor;
      }
    }

    log.debug('Using fallback extractor', {
      url: url.href,
      extractor: this.fallbackExtractor.name,
    });
    return this.fallbackExtractor;
  }

  /**
   * Extract content from a URL using the appropriate extractor
   */
  async extract(
    originalUrl: string,
    normalizedUrl: string,
    html: string,
    headers?: Record<string, string>,
    statusCode?: number
  ): Promise<ExtractorResult> {
    const url = new URL(normalizedUrl);

    const context: ExtractionContext = {
      originalUrl,
      normalizedUrl,
      url,
      headers,
      statusCode,
    };

    const extractor = this.findExtractor(url);

    log.info('Extracting content', {
      url: normalizedUrl,
      extractor: extractor.name,
    });

    try {
      const result = await extractor.extract(context, html);

      log.debug('Extraction complete', {
        url: normalizedUrl,
        extractor: extractor.name,
        title: result.title,
        contentType: result.contentType,
        hasContent: !!result.content,
      });

      return result;
    } catch (error) {
      log.error('Extraction failed, using fallback', {
        url: normalizedUrl,
        extractor: extractor.name,
        error: error instanceof Error ? error.message : String(error),
      });

      // If specialized extractor fails, try fallback
      if (extractor !== this.fallbackExtractor) {
        return this.fallbackExtractor.extract(context, html);
      }

      throw error;
    }
  }

  /**
   * Check if a specialized extractor exists for a URL
   */
  hasSpecializedExtractor(url: URL): boolean {
    const extractor = this.findExtractor(url);
    return extractor !== this.fallbackExtractor;
  }

  /**
   * Get list of domains handled by specialized extractors
   */
  getSpecializedDomains(): string[] {
    const domains: string[] = [];

    // Get domains from known extractors
    domains.push(
      'youtube.com',
      'youtu.be',
      'github.com',
      'gist.github.com',
      'twitter.com',
      'x.com'
    );

    return domains;
  }
}

// ============================================================
// Singleton Instance
// ============================================================

/**
 * Default extractor registry instance
 */
export const extractorRegistry = new ExtractorRegistry();

/**
 * Convenience function to extract content using the default registry
 */
export async function extractContent(
  originalUrl: string,
  normalizedUrl: string,
  html: string,
  headers?: Record<string, string>,
  statusCode?: number
): Promise<ExtractorResult> {
  return extractorRegistry.extract(originalUrl, normalizedUrl, html, headers, statusCode);
}

/**
 * Check if a URL has a specialized extractor
 */
export function hasSpecializedExtractor(url: string): boolean {
  try {
    return extractorRegistry.hasSpecializedExtractor(new URL(url));
  } catch {
    return false;
  }
}

export default extractorRegistry;
