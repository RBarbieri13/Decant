// ============================================================
// Article Extractor
// Generic fallback extractor for articles and web pages
// Uses Open Graph, meta tags, and JSON-LD for extraction
// ============================================================

import * as cheerio from 'cheerio';
import {
  BaseExtractor,
  ExtractionContext,
  ExtractorResult,
  ArticleFields,
} from './base.js';
import { log } from '../../logger/index.js';
import type { ContentTypeCode } from '../../../shared/types.js';

// Type for cheerio instance
type CheerioInstance = ReturnType<typeof cheerio.load>;

// ============================================================
// Article Extractor Class
// ============================================================

export class ArticleExtractor extends BaseExtractor {
  readonly name = 'article';
  readonly version = '1.0.0';
  readonly description = 'Generic extractor for articles and web pages';
  readonly priority = 0; // Lowest priority - fallback extractor

  /**
   * Article extractor handles everything as a fallback
   */
  canHandle(_url: URL): boolean {
    return true;
  }

  /**
   * Extract metadata from generic web page
   */
  async extract(context: ExtractionContext, html: string): Promise<ExtractorResult> {
    const $ = cheerio.load(html);

    log.debug('Extracting article content', {
      url: context.normalizedUrl,
    });

    const result = this.createDefaultResult(context, 'A');

    // Extract using multiple strategies
    const jsonLdData = this.extractJsonLd($);
    const ogData = this.extractOpenGraph($);
    const metaData = this.extractMetaTags($);
    const pageData = this.extractFromPage($, context.url);

    // Merge data with priority: JSON-LD > OpenGraph > Meta > Page
    result.title = jsonLdData.title || ogData.title || metaData.title || pageData.title || 'Untitled';
    result.description = jsonLdData.description || ogData.description || metaData.description || pageData.description;
    result.author = jsonLdData.author || ogData.author || metaData.author || pageData.author;
    result.siteName = ogData.siteName || metaData.siteName || context.url.hostname.replace(/^www\./, '');
    result.favicon = pageData.favicon;
    result.image = jsonLdData.image || ogData.image || metaData.image || pageData.image;
    result.content = pageData.content;

    // Determine content type
    result.contentType = this.detectContentType($, context.url, jsonLdData, ogData);

    // Build article-specific fields
    const fields: ArticleFields = {
      publishedDate: jsonLdData.publishedDate || ogData.publishedDate || metaData.publishedDate || null,
      modifiedDate: jsonLdData.modifiedDate || null,
      readingTime: pageData.readingTime,
      wordCount: pageData.wordCount,
      section: ogData.section || null,
      tags: [...new Set([...jsonLdData.tags, ...ogData.tags, ...metaData.tags])],
      isPaywalled: jsonLdData.isPaywalled || pageData.isPaywalled,
      articleType: jsonLdData.articleType || ogData.articleType || null,
    };

    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(false);

    return result;
  }

  /**
   * Extract data from JSON-LD structured data
   */
  private extractJsonLd($: CheerioInstance): {
    title: string | null;
    description: string | null;
    author: string | null;
    image: string | null;
    publishedDate: string | null;
    modifiedDate: string | null;
    tags: string[];
    isPaywalled: boolean;
    articleType: string | null;
  } {
    const result = {
      title: null as string | null,
      description: null as string | null,
      author: null as string | null,
      image: null as string | null,
      publishedDate: null as string | null,
      modifiedDate: null as string | null,
      tags: [] as string[],
      isPaywalled: false,
      articleType: null as string | null,
    };

    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).html();
      if (!content) return;

      const jsonLd = this.parseJsonLd(content);
      if (!jsonLd) return;

      // Handle @graph arrays
      const items = jsonLd['@graph'] ? (jsonLd['@graph'] as Record<string, unknown>[]) : [jsonLd];

      for (const item of items) {
        const type = item['@type'] as string;

        // Article types
        if (['Article', 'NewsArticle', 'BlogPosting', 'TechArticle', 'ScholarlyArticle', 'Report'].includes(type)) {
          result.articleType = type;

          if (item.headline && !result.title) {
            result.title = item.headline as string;
          }

          if (item.description && !result.description) {
            result.description = item.description as string;
          }

          if (item.author && !result.author) {
            const author = item.author;
            if (typeof author === 'string') {
              result.author = author;
            } else if (typeof author === 'object') {
              const authorObj = author as Record<string, unknown>;
              result.author = (authorObj.name as string) || null;
            } else if (Array.isArray(author) && author.length > 0) {
              const firstAuthor = author[0];
              if (typeof firstAuthor === 'string') {
                result.author = firstAuthor;
              } else if (typeof firstAuthor === 'object') {
                result.author = (firstAuthor as Record<string, unknown>).name as string || null;
              }
            }
          }

          if (item.image && !result.image) {
            const image = item.image;
            if (typeof image === 'string') {
              result.image = image;
            } else if (typeof image === 'object') {
              const imageObj = image as Record<string, unknown>;
              result.image = (imageObj.url as string) || null;
            } else if (Array.isArray(image) && image.length > 0) {
              const firstImage = image[0];
              if (typeof firstImage === 'string') {
                result.image = firstImage;
              } else if (typeof firstImage === 'object') {
                result.image = (firstImage as Record<string, unknown>).url as string || null;
              }
            }
          }

          if (item.datePublished && !result.publishedDate) {
            result.publishedDate = item.datePublished as string;
          }

          if (item.dateModified && !result.modifiedDate) {
            result.modifiedDate = item.dateModified as string;
          }

          if (item.keywords) {
            const keywords = item.keywords;
            if (typeof keywords === 'string') {
              result.tags.push(...keywords.split(',').map(k => k.trim()));
            } else if (Array.isArray(keywords)) {
              result.tags.push(...keywords.map(k => String(k).trim()));
            }
          }

          if (item.isAccessibleForFree === false) {
            result.isPaywalled = true;
          }
        }

        // WebPage type
        if (type === 'WebPage') {
          if (item.name && !result.title) {
            result.title = item.name as string;
          }
          if (item.description && !result.description) {
            result.description = item.description as string;
          }
        }
      }
    });

    return result;
  }

  /**
   * Extract Open Graph metadata
   */
  private extractOpenGraph($: CheerioInstance): {
    title: string | null;
    description: string | null;
    author: string | null;
    siteName: string | null;
    image: string | null;
    publishedDate: string | null;
    section: string | null;
    tags: string[];
    articleType: string | null;
  } {
    return {
      title: $('meta[property="og:title"]').attr('content')?.trim() || null,
      description: $('meta[property="og:description"]').attr('content')?.trim() || null,
      author: $('meta[property="article:author"]').attr('content')?.trim() || null,
      siteName: $('meta[property="og:site_name"]').attr('content')?.trim() || null,
      image: $('meta[property="og:image"]').attr('content')?.trim() || null,
      publishedDate: $('meta[property="article:published_time"]').attr('content')?.trim() || null,
      section: $('meta[property="article:section"]').attr('content')?.trim() || null,
      tags: $('meta[property="article:tag"]').map((_, el) => $(el).attr('content')?.trim()).get().filter(Boolean) as string[],
      articleType: $('meta[property="og:type"]').attr('content')?.trim() || null,
    };
  }

  /**
   * Extract standard meta tags
   */
  private extractMetaTags($: CheerioInstance): {
    title: string | null;
    description: string | null;
    author: string | null;
    siteName: string | null;
    image: string | null;
    publishedDate: string | null;
    tags: string[];
  } {
    // Twitter card as fallback
    const twitterImage = $('meta[name="twitter:image"]').attr('content')?.trim() ||
                        $('meta[name="twitter:image:src"]').attr('content')?.trim();

    return {
      title: $('meta[name="title"]').attr('content')?.trim() ||
             $('meta[name="twitter:title"]').attr('content')?.trim() || null,
      description: $('meta[name="description"]').attr('content')?.trim() ||
                   $('meta[name="twitter:description"]').attr('content')?.trim() || null,
      author: $('meta[name="author"]').attr('content')?.trim() ||
              $('meta[name="twitter:creator"]').attr('content')?.trim() || null,
      siteName: $('meta[name="application-name"]').attr('content')?.trim() ||
                $('meta[name="twitter:site"]').attr('content')?.trim() || null,
      image: twitterImage || null,
      publishedDate: $('meta[name="date"]').attr('content')?.trim() ||
                     $('meta[name="pubdate"]').attr('content')?.trim() || null,
      tags: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()).filter(Boolean) || [],
    };
  }

  /**
   * Extract data directly from page content
   */
  private extractFromPage($: CheerioInstance, baseUrl: URL): {
    title: string | null;
    description: string | null;
    author: string | null;
    favicon: string | null;
    image: string | null;
    content: string | null;
    readingTime: number | null;
    wordCount: number | null;
    isPaywalled: boolean;
  } {
    // Clone for content extraction (we'll remove elements)
    const $content = cheerio.load($.html());

    // Title from <title> tag
    let title = $('title').text().trim() || null;

    // Fallback to first h1
    if (!title) {
      title = $('h1').first().text().trim() || null;
    }

    // Description from first paragraph if needed
    let description: string | null = null;
    const firstPara = $('article p, main p, .content p').first().text().trim();
    if (firstPara && firstPara.length > 50) {
      description = this.truncate(this.cleanText(firstPara), 300);
    }

    // Author from byline patterns
    let author: string | null = null;
    const bylineSelectors = [
      '[rel="author"]',
      '.author',
      '.byline',
      '.author-name',
      '[itemprop="author"]',
      '.post-author',
      '.entry-author',
    ];
    for (const selector of bylineSelectors) {
      const authorEl = $(selector).first().text().trim();
      if (authorEl) {
        author = authorEl;
        break;
      }
    }

    // Favicon
    const favicon = this.extractFavicon($, baseUrl);

    // Main image from content
    let image: string | null = null;
    const imageSelectors = [
      'article img',
      'main img',
      '.content img',
      '.post img',
      '.entry-content img',
    ];
    for (const selector of imageSelectors) {
      const imgSrc = $(selector).first().attr('src');
      if (imgSrc) {
        image = this.resolveUrl(imgSrc, baseUrl);
        break;
      }
    }

    // Extract main content
    // Remove non-content elements
    $content('script, style, nav, footer, header, aside, .sidebar, .comments, .advertisement, .ad, .social-share, .related-posts').remove();

    // Try to find main content area
    const contentSelectors = ['article', 'main', '[role="main"]', '.content', '.post', '.entry-content', '.article-body'];
    let content: string | null = null;

    for (const selector of contentSelectors) {
      const contentText = $content(selector).first().text();
      if (contentText && contentText.trim().length > 100) {
        content = this.cleanText(contentText);
        break;
      }
    }

    // Fallback to body
    if (!content) {
      content = this.cleanText($content('body').text());
    }

    // Truncate content for AI
    content = this.truncate(content, 5000);

    // Calculate reading time and word count
    let wordCount: number | null = null;
    let readingTime: number | null = null;
    if (content) {
      const words = content.split(/\s+/).filter(w => w.length > 0);
      wordCount = words.length;
      // Average reading speed: 200-250 words per minute
      readingTime = Math.ceil(wordCount / 225);
    }

    // Check for paywall indicators
    const isPaywalled = this.detectPaywall($);

    return {
      title,
      description,
      author,
      favicon,
      image,
      content,
      readingTime,
      wordCount,
      isPaywalled,
    };
  }

  /**
   * Extract favicon URL
   */
  private extractFavicon($: CheerioInstance, baseUrl: URL): string | null {
    const iconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
    ];

    for (const selector of iconSelectors) {
      const href = $(selector).attr('href');
      if (href) {
        return this.resolveUrl(href, baseUrl);
      }
    }

    // Default to /favicon.ico
    return `${baseUrl.protocol}//${baseUrl.host}/favicon.ico`;
  }

  /**
   * Detect if page has a paywall
   */
  private detectPaywall($: CheerioInstance): boolean {
    // Check for common paywall indicators
    const paywallSelectors = [
      '.paywall',
      '.subscription-required',
      '.premium-content',
      '.locked-content',
      '[data-paywall]',
      '.piano-offer',
      '.subscribe-wall',
    ];

    for (const selector of paywallSelectors) {
      if ($(selector).length > 0) {
        return true;
      }
    }

    // Check meta tags
    const accessibleForFree = $('meta[name="article:content_tier"]').attr('content');
    if (accessibleForFree === 'locked' || accessibleForFree === 'metered') {
      return true;
    }

    return false;
  }

  /**
   * Detect content type based on page signals
   */
  private detectContentType(
    $: CheerioInstance,
    url: URL,
    jsonLd: { articleType: string | null },
    og: { articleType: string | null }
  ): ContentTypeCode {
    // Check og:type first
    const ogType = og.articleType?.toLowerCase();
    if (ogType) {
      if (ogType.includes('video')) return 'V';
      if (ogType.includes('music') || ogType.includes('audio')) return 'U';
      if (ogType.includes('book')) return 'K';
      if (ogType.includes('profile')) return 'T';
      if (ogType.includes('product')) return 'T';
    }

    // Check JSON-LD type
    const articleType = jsonLd.articleType?.toLowerCase();
    if (articleType) {
      if (articleType.includes('scholarly') || articleType.includes('research')) return 'R';
      if (articleType.includes('tech')) return 'A';
    }

    // Check URL patterns
    const pathname = url.pathname.toLowerCase();
    if (pathname.includes('/research/') || pathname.includes('/paper/') || pathname.includes('/publication/')) {
      return 'R';
    }
    if (pathname.includes('/video/') || pathname.includes('/watch/')) {
      return 'V';
    }
    if (pathname.includes('/podcast/') || pathname.includes('/episode/')) {
      return 'P';
    }
    if (pathname.includes('/course/') || pathname.includes('/tutorial/') || pathname.includes('/learn/')) {
      return 'C';
    }

    // Check for video embeds
    if ($('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]').length > 0) {
      // Has video but might be an article with embedded video
      const hasArticleContent = $('article, .content').text().trim().length > 500;
      if (!hasArticleContent) {
        return 'V';
      }
    }

    // Check for podcast players
    if ($('audio, .podcast-player, [data-podcast]').length > 0) {
      return 'P';
    }

    // Default to Article
    return 'A';
  }
}

// Export singleton instance
export const articleExtractor = new ArticleExtractor();

export default ArticleExtractor;
