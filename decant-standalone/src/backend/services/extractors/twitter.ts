// ============================================================
// Twitter/X Extractor
// Specialized extractor for Twitter/X posts
// Fallback chain: X API v2 → Apify → FxTwitter → oEmbed → OG tags → blank
// ============================================================

import {
  BaseExtractor,
  ExtractionContext,
  ExtractorResult,
  TwitterFields,
} from './base.js';
import { log } from '../../logger/index.js';
import * as keystore from '../keystore.js';
import { fetchTweetViaApify } from './apify-twitter.js';
import { fetchTweetViaFxTwitter } from './fxtwitter-fallback.js';
import { fetchTweetViaOEmbed } from './twitter-oembed-fallback.js';
import { fetchTweetViaOgTags } from './twitter-og-fallback.js';

// ============================================================
// X API v2 Response Types
// ============================================================

interface XApiTweetData {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  conversation_id?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
    mentions?: Array<{ username: string }>;
  };
  attachments?: {
    media_keys?: string[];
  };
}

interface XApiUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface XApiMedia {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
}

interface XApiTweetResponse {
  data?: XApiTweetData;
  includes?: {
    users?: XApiUser[];
    media?: XApiMedia[];
  };
  errors?: Array<{ message: string; title?: string }>;
}

// ============================================================
// Rate Limiter
// ============================================================

class XApiRateLimiter {
  private timestamps: number[] = [];
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxRequests = 450;
  private readonly safetyMargin = 50;

  canMakeRequest(): boolean {
    this.pruneOldTimestamps();
    return this.timestamps.length < (this.maxRequests - this.safetyMargin);
  }

  recordRequest(): void {
    this.timestamps.push(Date.now());
  }

  getWaitTimeMs(): number {
    this.pruneOldTimestamps();
    if (this.timestamps.length < (this.maxRequests - this.safetyMargin)) {
      return 0;
    }
    const oldest = this.timestamps[0];
    return oldest + this.windowMs - Date.now() + 100;
  }

  private pruneOldTimestamps(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  }
}

const rateLimiter = new XApiRateLimiter();

// ============================================================
// Helpers
// ============================================================

/** Known garbage titles that X serves to bots/unauthenticated requests */
const GARBAGE_TITLES = [
  'user update on x',
  'post on x',
  'x',
  'twitter',
];

/** Regex patterns that match LLM-generated boilerplate titles for X/Twitter posts */
const BOILERPLATE_TITLE_PATTERNS = [
  /^(user|personal)\s+(status\s+)?update\s+on\s+x$/i,
  /^trending\s+topic(s)?\s+(analysis\s+)?on\s+x$/i,
  /^(recent\s+)?advancements?\s+in\s+\w+(\s+\w+)?\s+(discussion|technology)?$/i,
  /^(personal\s+)?insights?\s+on\s+current\s+events$/i,
  /^media\s+trends\s+and\s+insights$/i,
  /^(a\s+)?(status|update)\s+(update\s+)?on\s+x$/i,
  /^x\s+platform\s+\w+\s+update$/i,
  /^\w+\s+status\s+update$/i,
  /^(cognition|engagement|social\s+media)\s+status\s+update$/i,
];

function isGarbageTitle(title: string | null): boolean {
  if (!title) return true;
  const t = title.toLowerCase().trim();
  if (GARBAGE_TITLES.includes(t)) return true;
  return BOILERPLATE_TITLE_PATTERNS.some(p => p.test(t));
}

/** Exported version for use by reclassify to detect nodes needing re-enrichment */
export { isGarbageTitle, BOILERPLATE_TITLE_PATTERNS };

function extractTweetId(url: URL): string | null {
  const match = url.pathname.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

async function fetchFromXApi(
  tweetId: string,
  bearerToken: string,
  timeoutMs: number
): Promise<XApiTweetResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const params = new URLSearchParams({
    'tweet.fields': 'text,author_id,created_at,public_metrics,entities,attachments,conversation_id',
    'user.fields': 'name,username,profile_image_url,public_metrics',
    'media.fields': 'url,preview_image_url,type',
    'expansions': 'author_id,attachments.media_keys',
  });

  try {
    rateLimiter.recordRequest();
    const response = await fetch(
      `https://api.x.com/2/tweets/${tweetId}?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${bearerToken}` },
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      throw new Error(`X API error: ${response.status} ${response.statusText}`);
    }
    return await response.json() as XApiTweetResponse;
  } finally {
    clearTimeout(timer);
  }
}

function mapXApiResponseToFields(
  response: XApiTweetResponse,
  tweetId: string
): TwitterFields {
  const tweet = response.data;
  const user = response.includes?.users?.[0];
  const media = response.includes?.media ?? [];

  const mediaUrls = media
    .map(m => m.url ?? m.preview_image_url)
    .filter((u): u is string => !!u);

  const hashtags = (tweet?.entities?.hashtags ?? [])
    .map(h => h.tag)
    .filter((t): t is string => !!t);

  const mentions = (tweet?.entities?.mentions ?? [])
    .map(m => m.username)
    .filter((s): s is string => !!s);

  return {
    tweetId,
    authorHandle: user?.username ?? null,
    authorName: user?.name ?? null,
    authorFollowers: user?.public_metrics?.followers_count ?? null,
    tweetText: tweet?.text ?? null,
    likeCount: tweet?.public_metrics?.like_count ?? null,
    retweetCount: tweet?.public_metrics?.retweet_count ?? null,
    replyCount: tweet?.public_metrics?.reply_count ?? null,
    quoteCount: tweet?.public_metrics?.quote_count ?? null,
    isRetweet: false,
    isQuoteTweet: false,
    quotedTweetUrl: null,
    mediaUrls,
    hashtags,
    mentions,
    postedAt: tweet?.created_at ?? null,
  };
}

// ============================================================
// Twitter Extractor Class
// ============================================================

export class TwitterExtractor extends BaseExtractor {
  readonly name = 'twitter';
  readonly version = '3.0.0';
  readonly description = 'Extracts metadata from Twitter/X posts via 5-tier fallback chain';
  readonly priority = 100;

  canHandle(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'twitter.com' ||
      hostname === 'www.twitter.com' ||
      hostname === 'x.com' ||
      hostname === 'www.x.com'
    );
  }

  async extract(context: ExtractionContext, _html: string): Promise<ExtractorResult> {
    const tweetId = extractTweetId(context.url);
    const result = this.createDefaultResult(context, 'S' as any);
    result.siteName = 'X (Twitter)';
    result.favicon = 'https://abs.twimg.com/favicons/twitter.3.ico';

    log.debug('Extracting Twitter/X content', {
      url: context.normalizedUrl,
      tweetId,
    });

    if (!tweetId) {
      log.warn('Could not extract tweet ID from URL', { url: context.normalizedUrl });
      result.metadata = this.createMetadata(true, ['No tweet ID found in URL — blank fallback']);
      return result;
    }

    const bearerToken = await keystore.getApiKey('x_api');

    if (!bearerToken) {
      log.debug('X API Bearer Token not configured — trying fallbacks');
      return this.tryAllFallbacks(context, tweetId, result, 'X API Bearer Token not configured');
    }

    if (!rateLimiter.canMakeRequest()) {
      const waitMs = rateLimiter.getWaitTimeMs();
      log.warn('X API rate limit approaching, trying fallbacks', { tweetId, waitMs });
      return this.tryAllFallbacks(context, tweetId, result, `Rate limited — retry after ${Math.ceil(waitMs / 1000)}s`);
    }

    try {
      const apiResponse = await fetchFromXApi(tweetId, bearerToken, 30_000);

      if (apiResponse.errors && !apiResponse.data) {
        const errMsg = apiResponse.errors.map(e => e.message).join('; ');
        log.warn('X API returned errors, trying fallbacks', { tweetId, errors: errMsg });
        return this.tryAllFallbacks(context, tweetId, result, `X API error: ${errMsg}`);
      }

      if (!apiResponse.data) {
        log.warn('X API returned no data, trying fallbacks', { tweetId });
        return this.tryAllFallbacks(context, tweetId, result, 'X API returned no data');
      }

      const fields = mapXApiResponseToFields(apiResponse, tweetId);
      return this.populateResultFromFields(result, fields, 'Extracted via X API v2');

    } catch (err) {
      log.warn('X API extraction failed, trying fallbacks', {
        tweetId,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.tryAllFallbacks(context, tweetId, result, 'X API unavailable');
    }
  }

  /**
   * Try all fallback tiers in order:
   * 1. Apify Tweet Scraper (paid, full data)
   * 2. FxTwitter API (free, full data — no auth required)
   * 3. Twitter oEmbed API (official, basic data — no auth required)
   * 4. HTML OG tags (last resort, minimal data)
   *
   * Returns the first successful result, or a blank result if all fail.
   */
  private async tryAllFallbacks(
    context: ExtractionContext,
    tweetId: string,
    baseResult: ExtractorResult,
    reason: string
  ): Promise<ExtractorResult> {
    // Tier 2: Apify
    const apifyResult = await this.tryApifyFallback(context, tweetId, baseResult);
    if (apifyResult) return apifyResult;

    // Tier 3: FxTwitter (free, no API key needed)
    const fxResult = await this.tryFxTwitterFallback(context, tweetId, baseResult);
    if (fxResult) return fxResult;

    // Tier 4: Twitter oEmbed (official, no API key needed)
    const oembedResult = await this.tryOEmbedFallback(context, tweetId, baseResult);
    if (oembedResult) return oembedResult;

    // Tier 5: OG tags from HTML
    const ogResult = await this.tryOgFallback(context, tweetId, baseResult);
    if (ogResult) return ogResult;

    // All fallbacks failed
    const result = { ...baseResult };
    result.extractedFields = { tweetId } as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true, [`${reason}, all fallbacks failed — blank`]);
    return result;
  }

  /**
   * Try OG tag HTML scraping as a last-resort fallback
   */
  private async tryOgFallback(
    context: ExtractionContext,
    tweetId: string,
    baseResult: ExtractorResult
  ): Promise<ExtractorResult | null> {
    try {
      const ogData = await fetchTweetViaOgTags(context.normalizedUrl);
      if (!ogData) return null;

      const result = { ...baseResult };
      const authorDisplay = ogData.authorHandle ? `@${ogData.authorHandle}` : 'Unknown';

      const ogTitle = ogData.title && !isGarbageTitle(ogData.title) ? ogData.title : null;
      result.title = ogTitle || (ogData.description ? this.truncate(ogData.description, 100) ?? `Tweet by ${authorDisplay}` : `Tweet by ${authorDisplay}`);
      result.description = ogData.description || null;
      result.author = authorDisplay;
      result.image = ogData.image || null;

      // Build minimal content for AI from available data
      const contentParts: string[] = [];
      if (ogData.description) contentParts.push(`Tweet: ${ogData.description}`);
      if (ogData.authorHandle) contentParts.push(`Author: @${ogData.authorHandle}`);
      result.content = contentParts.length > 0 ? contentParts.join('\n') : null;

      result.extractedFields = {
        tweetId,
        authorHandle: ogData.authorHandle,
        tweetText: ogData.description,
      } as unknown as Record<string, unknown>;
      result.metadata = this.createMetadata(true, ['Extracted via HTML OG tags (degraded)']);

      log.info('Twitter OG tag fallback succeeded', {
        tweetId,
        hasTitle: !!result.title,
        hasContent: !!result.content,
      });

      return result;
    } catch (error) {
      log.debug('OG tag fallback failed', {
        tweetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Try Apify Tweet Scraper as a fallback when X API is unavailable
   */
  private async tryApifyFallback(
    context: ExtractionContext,
    tweetId: string,
    baseResult: ExtractorResult
  ): Promise<ExtractorResult | null> {
    try {
      const apifyFields = await fetchTweetViaApify(tweetId, context.normalizedUrl);
      if (!apifyFields) return null;

      return this.populateResultFromFields(
        { ...baseResult },
        apifyFields,
        'Extracted via Apify fallback'
      );
    } catch (error) {
      log.debug('Apify fallback failed', {
        tweetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Try FxTwitter API as a fallback (free, no API key required)
   * Provides full tweet data including text, author, metrics, and media
   */
  private async tryFxTwitterFallback(
    context: ExtractionContext,
    tweetId: string,
    baseResult: ExtractorResult
  ): Promise<ExtractorResult | null> {
    try {
      const fxFields = await fetchTweetViaFxTwitter(tweetId, context.normalizedUrl);
      if (!fxFields) return null;

      return this.populateResultFromFields(
        { ...baseResult },
        fxFields,
        'Extracted via FxTwitter API fallback'
      );
    } catch (error) {
      log.debug('FxTwitter fallback failed', {
        tweetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Try Twitter oEmbed API as a fallback (official, no API key required)
   * Provides tweet text and author info, but no metrics or media
   */
  private async tryOEmbedFallback(
    context: ExtractionContext,
    tweetId: string,
    baseResult: ExtractorResult
  ): Promise<ExtractorResult | null> {
    try {
      const oembedFields = await fetchTweetViaOEmbed(tweetId, context.normalizedUrl);
      if (!oembedFields) return null;

      return this.populateResultFromFields(
        { ...baseResult },
        oembedFields,
        'Extracted via Twitter oEmbed fallback'
      );
    } catch (error) {
      log.debug('oEmbed fallback failed', {
        tweetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Populate an ExtractorResult from TwitterFields
   */
  private populateResultFromFields(
    result: ExtractorResult,
    fields: TwitterFields,
    source: string
  ): ExtractorResult {
    const tweetText = fields.tweetText ?? '';
    const authorDisplay = fields.authorName
      ? `${fields.authorName} (@${fields.authorHandle})`
      : fields.authorHandle
        ? `@${fields.authorHandle}`
        : 'Unknown';

    const truncatedTitle = this.truncate(tweetText, 100);
    result.title = (truncatedTitle && !isGarbageTitle(truncatedTitle))
      ? truncatedTitle
      : `Tweet by ${authorDisplay}`;
    result.description = tweetText || null;
    result.author = authorDisplay;
    result.image = fields.mediaUrls[0] ?? null;
    result.content = this.buildContentForAi(fields);
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true, [source]);

    return result;
  }

  private buildContentForAi(fields: TwitterFields): string {
    const parts: string[] = [];
    if (fields.tweetText) parts.push(`Tweet: ${fields.tweetText}`);
    if (fields.authorName || fields.authorHandle) {
      const who = [fields.authorName, fields.authorHandle ? `@${fields.authorHandle}` : null]
        .filter(Boolean).join(' ');
      parts.push(`Author: ${who}`);
    }
    if (fields.authorFollowers !== null) parts.push(`Followers: ${fields.authorFollowers.toLocaleString()}`);
    if (fields.hashtags.length > 0) parts.push(`Hashtags: ${fields.hashtags.map(h => `#${h}`).join(', ')}`);
    if (fields.mentions.length > 0) parts.push(`Mentions: ${fields.mentions.map(m => `@${m}`).join(', ')}`);
    const stats: string[] = [];
    if (fields.likeCount !== null) stats.push(`${fields.likeCount} likes`);
    if (fields.retweetCount !== null) stats.push(`${fields.retweetCount} retweets`);
    if (fields.replyCount !== null) stats.push(`${fields.replyCount} replies`);
    if (stats.length > 0) parts.push(`Engagement: ${stats.join(', ')}`);
    if (fields.postedAt) parts.push(`Posted: ${fields.postedAt}`);
    return parts.join('\n');
  }
}

export const twitterExtractor = new TwitterExtractor();
export default TwitterExtractor;
