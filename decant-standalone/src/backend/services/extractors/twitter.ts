// ============================================================
// Twitter/X Extractor
// Specialized extractor for Twitter/X posts using Apify scraper
// Falls back to meta-tag extraction if no API key is configured
// ============================================================

import * as cheerio from 'cheerio';
import {
  BaseExtractor,
  ExtractionContext,
  ExtractorResult,
  TwitterFields,
} from './base.js';
import { log } from '../../logger/index.js';

// ============================================================
// Apify Response Types
// ============================================================

interface ApifyTweetItem {
  id?: string;
  full_text?: string;
  text?: string;
  user?: {
    screen_name?: string;
    name?: string;
    followers_count?: number;
  };
  favorite_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  retweeted?: boolean;
  is_quote_status?: boolean;
  quoted_status_id_str?: string;
  created_at?: string;
  entities?: {
    hashtags?: Array<{ text?: string }>;
    user_mentions?: Array<{ screen_name?: string }>;
    media?: Array<{ media_url_https?: string; type?: string }>;
  };
  extended_entities?: {
    media?: Array<{ media_url_https?: string; type?: string }>;
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Extract tweet ID from Twitter/X URL path
 * Handles: /username/status/TWEET_ID
 */
function extractTweetId(url: URL): string | null {
  const match = url.pathname.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Call Apify twitter-scraper actor synchronously and return dataset items
 */
async function fetchFromApify(
  tweetUrl: string,
  apiKey: string,
  timeoutMs: number
): Promise<ApifyTweetItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      'https://api.apify.com/v2/acts/apify~twitter-scraper/run-sync-get-dataset-items',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: [tweetUrl],
          maxItems: 1,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as ApifyTweetItem[];
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map an Apify tweet item to TwitterFields
 */
function mapApifyItemToFields(item: ApifyTweetItem, tweetId: string): TwitterFields {
  const media = item.extended_entities?.media ?? item.entities?.media ?? [];
  const mediaUrls = media
    .map(m => m.media_url_https)
    .filter((u): u is string => !!u);

  const hashtags = (item.entities?.hashtags ?? [])
    .map(h => h.text)
    .filter((t): t is string => !!t);

  const mentions = (item.entities?.user_mentions ?? [])
    .map(m => m.screen_name)
    .filter((s): s is string => !!s);

  let quotedTweetUrl: string | null = null;
  if (item.is_quote_status && item.quoted_status_id_str && item.user?.screen_name) {
    quotedTweetUrl = `https://x.com/${item.user.screen_name}/status/${item.quoted_status_id_str}`;
  }

  return {
    tweetId,
    authorHandle: item.user?.screen_name ?? null,
    authorName: item.user?.name ?? null,
    authorFollowers: item.user?.followers_count ?? null,
    tweetText: item.full_text ?? item.text ?? null,
    likeCount: item.favorite_count ?? null,
    retweetCount: item.retweet_count ?? null,
    replyCount: item.reply_count ?? null,
    quoteCount: item.quote_count ?? null,
    isRetweet: item.retweeted ?? false,
    isQuoteTweet: item.is_quote_status ?? false,
    quotedTweetUrl,
    mediaUrls,
    hashtags,
    mentions,
    postedAt: item.created_at ?? null,
  };
}

// ============================================================
// Twitter Extractor Class
// ============================================================

export class TwitterExtractor extends BaseExtractor {
  readonly name = 'twitter';
  readonly version = '1.0.0';
  readonly description = 'Extracts metadata from Twitter/X posts via Apify scraper';
  readonly priority = 100; // High priority — same as YouTube and GitHub extractors

  /**
   * Handle twitter.com and x.com URLs
   */
  canHandle(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'twitter.com' ||
      hostname === 'www.twitter.com' ||
      hostname === 'x.com' ||
      hostname === 'www.x.com'
    );
  }

  /**
   * Extract tweet content.
   * Uses Apify if APIFY_API_KEY is set; otherwise falls back to meta-tag extraction.
   */
  async extract(context: ExtractionContext, html: string): Promise<ExtractorResult> {
    const tweetId = extractTweetId(context.url);
    const result = this.createDefaultResult(context, 'S' as any);
    result.siteName = 'X (Twitter)';
    result.favicon = 'https://abs.twimg.com/favicons/twitter.3.ico';

    log.debug('Extracting Twitter/X content', {
      url: context.normalizedUrl,
      tweetId,
    });

    const apiKey = process.env.APIFY_API_KEY;

    if (apiKey && tweetId) {
      try {
        const items = await fetchFromApify(
          context.normalizedUrl,
          apiKey,
          30_000
        );

        if (items.length > 0) {
          const item = items[0];
          const fields = mapApifyItemToFields(item, tweetId);

          const tweetText = fields.tweetText ?? '';
          const authorDisplay = fields.authorName
            ? `${fields.authorName} (@${fields.authorHandle})`
            : fields.authorHandle
              ? `@${fields.authorHandle}`
              : 'Unknown';

          result.title = this.truncate(tweetText, 100) ?? `Tweet by ${authorDisplay}`;
          result.description = tweetText || null;
          result.author = authorDisplay;
          result.image = fields.mediaUrls[0] ?? null;
          result.content = this.buildContentForAi(fields);
          result.extractedFields = fields as unknown as Record<string, unknown>;
          result.metadata = this.createMetadata(true, ['Extracted via Apify twitter-scraper']);

          log.info('Twitter/X content extracted via Apify', {
            tweetId,
            author: fields.authorHandle,
            hasMedia: fields.mediaUrls.length > 0,
          });

          return result;
        }

        log.warn('Apify returned no items for tweet', { tweetId, url: context.normalizedUrl });
      } catch (err) {
        log.warn('Apify extraction failed, falling back to meta-tag extraction', {
          tweetId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (!apiKey) {
      log.debug('APIFY_API_KEY not set — using meta-tag extraction for Twitter/X URL');
    }

    // Fallback: extract what we can from Open Graph / Twitter meta tags
    return this.extractFromMetaTags(context, html, tweetId, result);
  }

  /**
   * Build a rich content string for the AI enrichment pipeline
   */
  private buildContentForAi(fields: TwitterFields): string {
    const parts: string[] = [];

    if (fields.tweetText) {
      parts.push(`Tweet: ${fields.tweetText}`);
    }

    if (fields.authorName || fields.authorHandle) {
      const who = [fields.authorName, fields.authorHandle ? `@${fields.authorHandle}` : null]
        .filter(Boolean)
        .join(' ');
      parts.push(`Author: ${who}`);
    }

    if (fields.authorFollowers !== null) {
      parts.push(`Followers: ${fields.authorFollowers.toLocaleString()}`);
    }

    if (fields.hashtags.length > 0) {
      parts.push(`Hashtags: ${fields.hashtags.map(h => `#${h}`).join(', ')}`);
    }

    if (fields.mentions.length > 0) {
      parts.push(`Mentions: ${fields.mentions.map(m => `@${m}`).join(', ')}`);
    }

    const stats: string[] = [];
    if (fields.likeCount !== null) stats.push(`${fields.likeCount} likes`);
    if (fields.retweetCount !== null) stats.push(`${fields.retweetCount} retweets`);
    if (fields.replyCount !== null) stats.push(`${fields.replyCount} replies`);
    if (stats.length > 0) {
      parts.push(`Engagement: ${stats.join(', ')}`);
    }

    if (fields.postedAt) {
      parts.push(`Posted: ${fields.postedAt}`);
    }

    return parts.join('\n');
  }

  /**
   * Fallback: extract from Open Graph / Twitter meta tags in the HTML
   */
  private extractFromMetaTags(
    context: ExtractionContext,
    html: string,
    tweetId: string | null,
    result: ExtractorResult
  ): ExtractorResult {
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const twitterDescription = $('meta[name="twitter:description"]').attr('content');
    const twitterCreator = $('meta[name="twitter:creator"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');

    result.title = this.cleanText(ogTitle ?? twitterTitle ?? $('title').text()) ?? result.title;
    result.description = this.cleanText(ogDescription ?? twitterDescription);
    result.author = twitterCreator ?? null;
    result.image = ogImage ?? twitterImage ?? null;
    result.content = this.cleanText(ogDescription ?? twitterDescription);

    if (tweetId) {
      result.extractedFields = {
        tweetId,
        authorHandle: twitterCreator ?? null,
        authorName: null,
        authorFollowers: null,
        tweetText: this.cleanText(ogDescription ?? twitterDescription),
        likeCount: null,
        retweetCount: null,
        replyCount: null,
        quoteCount: null,
        isRetweet: false,
        isQuoteTweet: false,
        quotedTweetUrl: null,
        mediaUrls: ogImage ? [ogImage] : [],
        hashtags: [],
        mentions: [],
        postedAt: null,
      } satisfies TwitterFields as unknown as Record<string, unknown>;
    }

    result.metadata = this.createMetadata(true, ['Fallback meta-tag extraction (no Apify key)']);

    return result;
  }
}

// Export singleton instance
export const twitterExtractor = new TwitterExtractor();

export default TwitterExtractor;
