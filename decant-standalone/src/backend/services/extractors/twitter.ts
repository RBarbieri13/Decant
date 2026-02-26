// ============================================================
// Twitter/X Extractor
// Specialized extractor for Twitter/X posts using X API v2
// Falls back to blank metadata if no API key is configured
// ============================================================

import {
  BaseExtractor,
  ExtractionContext,
  ExtractorResult,
  TwitterFields,
} from './base.js';
import { log } from '../../logger/index.js';
import * as keystore from '../keystore.js';

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
  readonly version = '2.0.0';
  readonly description = 'Extracts metadata from Twitter/X posts via X API v2';
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
      log.debug('X API Bearer Token not configured — using blank fallback');
      result.extractedFields = { tweetId } as unknown as Record<string, unknown>;
      result.metadata = this.createMetadata(true, ['X API Bearer Token not configured — blank fallback']);
      return result;
    }

    if (!rateLimiter.canMakeRequest()) {
      const waitMs = rateLimiter.getWaitTimeMs();
      log.warn('X API rate limit approaching, using blank fallback', { tweetId, waitMs });
      result.extractedFields = { tweetId } as unknown as Record<string, unknown>;
      result.metadata = this.createMetadata(true, [`Rate limited — retry after ${Math.ceil(waitMs / 1000)}s`]);
      return result;
    }

    try {
      const apiResponse = await fetchFromXApi(tweetId, bearerToken, 30_000);

      if (apiResponse.errors && !apiResponse.data) {
        const errMsg = apiResponse.errors.map(e => e.message).join('; ');
        log.warn('X API returned errors', { tweetId, errors: errMsg });
        result.extractedFields = { tweetId } as unknown as Record<string, unknown>;
        result.metadata = this.createMetadata(true, [`X API error: ${errMsg}`]);
        return result;
      }

      if (!apiResponse.data) {
        log.warn('X API returned no data for tweet', { tweetId });
        result.extractedFields = { tweetId } as unknown as Record<string, unknown>;
        result.metadata = this.createMetadata(true, ['X API returned no data — blank fallback']);
        return result;
      }

      const fields = mapXApiResponseToFields(apiResponse, tweetId);

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
      result.metadata = this.createMetadata(true, ['Extracted via X API v2']);

      log.info('Twitter/X content extracted via X API v2', {
        tweetId,
        author: fields.authorHandle,
        hasMedia: fields.mediaUrls.length > 0,
      });

      return result;

    } catch (err) {
      log.warn('X API extraction failed, using blank fallback', {
        tweetId,
        error: err instanceof Error ? err.message : String(err),
      });
      result.extractedFields = { tweetId } as unknown as Record<string, unknown>;
      result.metadata = this.createMetadata(true, ['X API unavailable — blank fallback']);
      return result;
    }
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
