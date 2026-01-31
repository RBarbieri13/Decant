// ============================================================
// YouTube Extractor
// Specialized extractor for YouTube video pages
// ============================================================

import * as cheerio from 'cheerio';
import {
  BaseExtractor,
  ExtractionContext,
  ExtractorResult,
  YouTubeFields,
} from './base.js';
import { log } from '../../logger/index.js';

// Type for cheerio instance
type CheerioInstance = ReturnType<typeof cheerio.load>;

// ============================================================
// YouTube URL Patterns
// ============================================================

/**
 * Patterns to match YouTube URLs and extract video IDs
 */
const YOUTUBE_PATTERNS = {
  // Standard watch URL: youtube.com/watch?v=VIDEO_ID
  watch: /^(?:www\.)?youtube\.com$/,

  // Short URL: youtu.be/VIDEO_ID
  short: /^youtu\.be$/,

  // Embed URL: youtube.com/embed/VIDEO_ID
  embed: /^(?:www\.)?youtube\.com$/,

  // Mobile URL: m.youtube.com/watch?v=VIDEO_ID
  mobile: /^m\.youtube\.com$/,

  // Music URL: music.youtube.com
  music: /^music\.youtube\.com$/,

  // YouTube Shorts: youtube.com/shorts/VIDEO_ID
  shorts: /^(?:www\.)?youtube\.com$/,
};

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const params = url.searchParams;

  // youtu.be/VIDEO_ID
  if (hostname === 'youtu.be') {
    const id = pathname.slice(1).split('/')[0];
    return isValidVideoId(id) ? id : null;
  }

  // youtube.com/watch?v=VIDEO_ID
  if (params.has('v')) {
    const id = params.get('v');
    return id && isValidVideoId(id) ? id : null;
  }

  // youtube.com/embed/VIDEO_ID
  const embedMatch = pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) {
    return embedMatch[1];
  }

  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) {
    return shortsMatch[1];
  }

  // youtube.com/v/VIDEO_ID
  const vMatch = pathname.match(/^\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch) {
    return vMatch[1];
  }

  return null;
}

/**
 * Check if a string is a valid YouTube video ID
 * Video IDs are 11 characters, base64-like
 */
function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

// ============================================================
// YouTube Extractor Class
// ============================================================

export class YouTubeExtractor extends BaseExtractor {
  readonly name = 'youtube';
  readonly version = '1.0.0';
  readonly description = 'Extracts metadata from YouTube video pages';
  readonly priority = 100; // High priority for domain-specific extractor

  /**
   * Check if URL is a YouTube URL
   */
  canHandle(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtu.be' ||
      hostname === 'music.youtube.com'
    );
  }

  /**
   * Extract metadata from YouTube page
   */
  async extract(context: ExtractionContext, html: string): Promise<ExtractorResult> {
    const $ = cheerio.load(html);
    const videoId = extractVideoId(context.url);

    log.debug('Extracting YouTube content', {
      url: context.normalizedUrl,
      videoId,
    });

    // Start with default result
    const result = this.createDefaultResult(context, 'V');

    if (!videoId) {
      log.warn('Could not extract video ID from YouTube URL', {
        url: context.normalizedUrl,
      });
      result.metadata.notes = ['Could not extract video ID'];
      return this.extractGenericYouTubePage($, context, result);
    }

    // Extract from page
    const fields = this.extractYouTubeFields($, videoId, context.url);

    // Build result
    result.title = this.extractTitle($) || `YouTube Video: ${videoId}`;
    result.description = this.extractDescription($);
    result.author = fields.channelName;
    result.siteName = 'YouTube';
    result.favicon = 'https://www.youtube.com/favicon.ico';
    result.image = fields.thumbnailUrl;
    result.content = this.extractContent($);
    result.contentType = 'V';
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true);

    return result;
  }

  /**
   * Extract YouTube-specific fields
   */
  private extractYouTubeFields(
    $: CheerioInstance,
    videoId: string,
    baseUrl: URL
  ): YouTubeFields {
    const fields: YouTubeFields = {
      videoId,
      channelName: null,
      channelUrl: null,
      duration: null,
      durationFormatted: null,
      viewCount: null,
      publishedAt: null,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      isLive: false,
      category: null,
    };

    // Try to extract from JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).html();
      if (!content) return;

      const jsonLd = this.parseJsonLd(content);
      if (!jsonLd) return;

      // Handle VideoObject schema
      if (jsonLd['@type'] === 'VideoObject') {
        if (jsonLd.name && !fields.channelName) {
          // This is usually video title, not channel
        }

        if (jsonLd.duration) {
          fields.duration = this.parseDuration(jsonLd.duration as string);
          fields.durationFormatted = this.formatDuration(fields.duration);
        }

        if (jsonLd.uploadDate) {
          fields.publishedAt = jsonLd.uploadDate as string;
        }

        if (jsonLd.thumbnailUrl) {
          const thumbnails = jsonLd.thumbnailUrl;
          if (Array.isArray(thumbnails) && thumbnails.length > 0) {
            fields.thumbnailUrl = thumbnails[thumbnails.length - 1] as string;
          } else if (typeof thumbnails === 'string') {
            fields.thumbnailUrl = thumbnails;
          }
        }

        if (jsonLd.interactionStatistic) {
          const stats = jsonLd.interactionStatistic as Array<Record<string, unknown>>;
          if (Array.isArray(stats)) {
            const viewStat = stats.find(
              s => s.interactionType === 'http://schema.org/WatchAction' ||
                   (s.interactionType as Record<string, string>)?.['@type'] === 'WatchAction'
            );
            if (viewStat?.userInteractionCount) {
              fields.viewCount = String(viewStat.userInteractionCount);
            }
          }
        }

        if (jsonLd.publication) {
          const pub = jsonLd.publication as Record<string, unknown>;
          if (pub.isLiveBroadcast) {
            fields.isLive = true;
          }
        }
      }
    });

    // Extract channel info from meta tags or page content
    const channelLink = $('link[itemprop="name"]').attr('content');
    if (channelLink) {
      fields.channelName = channelLink;
    }

    // Try meta tags for channel
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName && ogSiteName !== 'YouTube') {
      // Sometimes og:site_name contains channel name
    }

    // Try to get channel from itemprop
    const channelNameEl = $('[itemprop="author"] [itemprop="name"]').attr('content');
    if (channelNameEl) {
      fields.channelName = channelNameEl;
    }

    // Channel URL
    const channelUrlEl = $('[itemprop="author"] link[itemprop="url"]').attr('href');
    if (channelUrlEl) {
      fields.channelUrl = this.resolveUrl(channelUrlEl, baseUrl);
    }

    // Check for live indicator
    const isLiveText = $('meta[property="og:title"]').attr('content');
    if (isLiveText?.toLowerCase().includes('live')) {
      fields.isLive = true;
    }

    // Try to get duration from meta
    const durationMeta = $('meta[itemprop="duration"]').attr('content');
    if (durationMeta && !fields.duration) {
      fields.duration = this.parseDuration(durationMeta);
      fields.durationFormatted = this.formatDuration(fields.duration);
    }

    // Get category
    const categoryMeta = $('meta[itemprop="genre"]').attr('content');
    if (categoryMeta) {
      fields.category = categoryMeta;
    }

    return fields;
  }

  /**
   * Extract page title
   */
  private extractTitle($: CheerioInstance): string | null {
    // Try OpenGraph title
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) return ogTitle.trim();

    // Try Twitter title
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    if (twitterTitle) return twitterTitle.trim();

    // Try title tag
    const titleTag = $('title').text();
    if (titleTag) {
      // Remove " - YouTube" suffix
      return titleTag.replace(/\s*-\s*YouTube\s*$/, '').trim();
    }

    return null;
  }

  /**
   * Extract description
   */
  private extractDescription($: CheerioInstance): string | null {
    // Try OpenGraph description
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc) return this.cleanText(ogDesc);

    // Try meta description
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) return this.cleanText(metaDesc);

    return null;
  }

  /**
   * Extract main content/transcript placeholder
   */
  private extractContent($: CheerioInstance): string | null {
    // YouTube video pages don't have traditional content
    // Return description as content for AI analysis
    const description = this.extractDescription($);
    return description ? this.truncate(description, 5000) : null;
  }

  /**
   * Handle non-video YouTube pages (channels, playlists, etc.)
   */
  private extractGenericYouTubePage(
    $: CheerioInstance,
    context: ExtractionContext,
    result: ExtractorResult
  ): ExtractorResult {
    result.title = this.extractTitle($) || 'YouTube Page';
    result.description = this.extractDescription($);
    result.siteName = 'YouTube';
    result.favicon = 'https://www.youtube.com/favicon.ico';

    // Check if it's a channel or playlist
    const pathname = context.url.pathname.toLowerCase();
    if (pathname.includes('/channel/') || pathname.includes('/@')) {
      result.contentType = 'T'; // Treat channels as websites/tools
      result.extractedFields = { resourceType: 'channel' };
    } else if (pathname.includes('/playlist')) {
      result.extractedFields = { resourceType: 'playlist' };
    }

    return result;
  }
}

// Export singleton instance
export const youtubeExtractor = new YouTubeExtractor();

export default YouTubeExtractor;
