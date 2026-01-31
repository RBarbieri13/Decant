// ============================================================
// Base Extractor Interface
// Defines the contract for all content extractors
// ============================================================

import type { ContentTypeCode } from '../../../shared/types.js';

// ============================================================
// Types
// ============================================================

/**
 * Result of content extraction from a URL
 */
export interface ExtractorResult {
  /** Page title */
  title: string;

  /** Page/content description */
  description: string | null;

  /** Content author */
  author: string | null;

  /** Website/platform name */
  siteName: string | null;

  /** Favicon URL */
  favicon: string | null;

  /** Main image/thumbnail URL */
  image: string | null;

  /** Main content text (for AI analysis) */
  content: string | null;

  /** Domain of the URL */
  domain: string;

  /** Detected content type */
  contentType: ContentTypeCode;

  /** Domain-specific extracted fields */
  extractedFields: Record<string, unknown>;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Metadata about the extraction process
 */
export interface ExtractionMetadata {
  /** Name of the extractor used */
  extractorName: string;

  /** Timestamp of extraction */
  extractedAt: string;

  /** Version of the extractor */
  extractorVersion: string;

  /** Whether this was a specialized or generic extraction */
  isSpecialized: boolean;

  /** Additional extraction notes/warnings */
  notes?: string[];
}

/**
 * Context passed to extractors
 */
export interface ExtractionContext {
  /** The original URL being processed */
  originalUrl: string;

  /** The normalized URL */
  normalizedUrl: string;

  /** Parsed URL object */
  url: URL;

  /** Response headers from fetch (if available) */
  headers?: Record<string, string>;

  /** HTTP status code */
  statusCode?: number;
}

/**
 * Interface for content extractors
 * Each extractor handles specific domains or content types
 */
export interface Extractor {
  /** Unique name of the extractor */
  readonly name: string;

  /** Version of the extractor */
  readonly version: string;

  /** Description of what this extractor handles */
  readonly description: string;

  /** Priority (higher = checked first) */
  readonly priority: number;

  /**
   * Check if this extractor can handle the given URL
   * @param url - Parsed URL object
   * @returns true if this extractor should handle the URL
   */
  canHandle(url: URL): boolean;

  /**
   * Extract content from the HTML
   * @param context - Extraction context with URL info
   * @param html - Raw HTML content
   * @returns Extracted content result
   */
  extract(context: ExtractionContext, html: string): Promise<ExtractorResult>;
}

// ============================================================
// Base Extractor Class
// ============================================================

/**
 * Abstract base class for extractors
 * Provides common functionality and default implementations
 */
export abstract class BaseExtractor implements Extractor {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly priority: number;

  abstract canHandle(url: URL): boolean;
  abstract extract(context: ExtractionContext, html: string): Promise<ExtractorResult>;

  /**
   * Create extraction metadata
   */
  protected createMetadata(isSpecialized: boolean, notes?: string[]): ExtractionMetadata {
    return {
      extractorName: this.name,
      extractedAt: new Date().toISOString(),
      extractorVersion: this.version,
      isSpecialized,
      notes,
    };
  }

  /**
   * Create a default/empty result
   */
  protected createDefaultResult(
    context: ExtractionContext,
    contentType: ContentTypeCode = 'A'
  ): ExtractorResult {
    return {
      title: 'Untitled',
      description: null,
      author: null,
      siteName: null,
      favicon: null,
      image: null,
      content: null,
      domain: context.url.hostname.replace(/^www\./, ''),
      contentType,
      extractedFields: {},
      metadata: this.createMetadata(false),
    };
  }

  /**
   * Resolve a relative URL to absolute
   */
  protected resolveUrl(href: string | undefined | null, baseUrl: URL): string | null {
    if (!href) return null;

    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }
      if (href.startsWith('//')) {
        return `${baseUrl.protocol}${href}`;
      }
      if (href.startsWith('/')) {
        return `${baseUrl.protocol}//${baseUrl.host}${href}`;
      }
      // Relative path
      return new URL(href, baseUrl.href).href;
    } catch {
      return null;
    }
  }

  /**
   * Clean extracted text (remove extra whitespace)
   */
  protected cleanText(text: string | undefined | null): string | null {
    if (!text) return null;
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim() || null;
  }

  /**
   * Truncate text to a maximum length
   */
  protected truncate(text: string | null, maxLength: number): string | null {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Parse JSON-LD script content
   */
  protected parseJsonLd(scriptContent: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(scriptContent);
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Extract duration from ISO 8601 duration string (PT1H30M15S)
   */
  protected parseDuration(isoDuration: string | undefined | null): number | null {
    if (!isoDuration) return null;

    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format duration in seconds to human-readable string
   */
  protected formatDuration(seconds: number | null): string | null {
    if (seconds === null || seconds < 0) return null;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// ============================================================
// Helper Types
// ============================================================

/**
 * YouTube-specific extracted fields
 */
export interface YouTubeFields {
  videoId: string;
  channelName: string | null;
  channelUrl: string | null;
  duration: number | null;
  durationFormatted: string | null;
  viewCount: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  embedUrl: string;
  isLive: boolean;
  category: string | null;
}

/**
 * GitHub-specific extracted fields
 */
export interface GitHubFields {
  owner: string;
  repoName: string | null;
  fullName: string | null;
  description: string | null;
  stars: number | null;
  forks: number | null;
  language: string | null;
  topics: string[];
  license: string | null;
  isPrivate: boolean;
  defaultBranch: string | null;
  resourceType: 'repository' | 'issue' | 'pull_request' | 'user' | 'organization' | 'gist' | 'other';
  issueNumber: number | null;
  pullRequestNumber: number | null;
}

/**
 * Article-specific extracted fields
 */
export interface ArticleFields {
  publishedDate: string | null;
  modifiedDate: string | null;
  readingTime: number | null;
  wordCount: number | null;
  section: string | null;
  tags: string[];
  isPaywalled: boolean;
  articleType: string | null;
}

export default {
  BaseExtractor,
};
