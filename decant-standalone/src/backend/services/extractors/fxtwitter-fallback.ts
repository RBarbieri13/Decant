// ============================================================
// FxTwitter API Fallback
// Fetches tweet data via the free FxTwitter/FixupX API
// No API key required — uses public JSON endpoint
// ============================================================

import { log } from '../../logger/index.js';
import type { TwitterFields } from './base.js';

const FXTWITTER_API_BASE = 'https://api.fxtwitter.com';
const FXTWITTER_TIMEOUT_MS = 15_000;

/**
 * FxTwitter API response types
 */
interface FxTweetResponse {
  code: number;
  message: string;
  tweet?: {
    id: string;
    url: string;
    text: string;
    created_at: string;
    created_timestamp: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    author: {
      id: string;
      name: string;
      screen_name: string;
      avatar_url: string;
      followers: number;
      following: number;
    };
    media?: {
      all: Array<{
        url: string;
        type: string;
        thumbnail_url?: string;
      }>;
    };
    replying_to?: string | null;
    quote?: {
      url: string;
      text: string;
      author: {
        screen_name: string;
      };
    };
  };
}

/**
 * Extract author handle from a tweet URL path
 * e.g., https://x.com/elonmusk/status/123 -> 'elonmusk'
 */
function extractAuthorFromUrl(tweetUrl: string): string | null {
  try {
    const parsed = new URL(tweetUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 1 && parts[0] !== 'i') {
      return parts[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch tweet data via the FxTwitter API (no auth required)
 * Returns null on any failure (graceful degradation)
 *
 * FxTwitter provides a free JSON API at https://api.fxtwitter.com/status/{id}
 * that returns full tweet data including text, author, metrics, and media.
 */
export async function fetchTweetViaFxTwitter(
  tweetId: string,
  tweetUrl: string
): Promise<TwitterFields | null> {
  log.info('Attempting FxTwitter API fallback for tweet extraction', {
    tweetId,
    module: 'fxtwitter-fallback',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FXTWITTER_TIMEOUT_MS);

  const startTime = Date.now();

  try {
    // Extract author handle from URL to construct proper API call
    const authorHandle = extractAuthorFromUrl(tweetUrl);
    // FxTwitter API format: /status/{id} or /{handle}/status/{id}
    const apiUrl = authorHandle
      ? `${FXTWITTER_API_BASE}/${authorHandle}/status/${tweetId}`
      : `${FXTWITTER_API_BASE}/i/status/${tweetId}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Decant/1.0 (URL metadata extractor)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      log.debug('FxTwitter API returned error status', {
        status: response.status,
        tweetId,
        module: 'fxtwitter-fallback',
      });
      return null;
    }

    const data = (await response.json()) as FxTweetResponse;

    if (data.code !== 200 || !data.tweet) {
      log.debug('FxTwitter API returned no tweet data', {
        code: data.code,
        message: data.message,
        tweetId,
        module: 'fxtwitter-fallback',
      });
      return null;
    }

    const tweet = data.tweet;
    const fields = mapFxTweetToFields(tweet, tweetId);

    log.info('FxTwitter API fallback extraction succeeded', {
      tweetId,
      hasText: !!fields.tweetText,
      author: fields.authorHandle,
      durationMs: Date.now() - startTime,
      module: 'fxtwitter-fallback',
    });

    return fields;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.debug('FxTwitter API request timed out', {
        tweetId,
        module: 'fxtwitter-fallback',
      });
    } else {
      log.debug('FxTwitter API fallback failed', {
        tweetId,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        module: 'fxtwitter-fallback',
      });
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map FxTwitter API response to TwitterFields
 */
function mapFxTweetToFields(
  tweet: NonNullable<FxTweetResponse['tweet']>,
  tweetId: string
): TwitterFields {
  const mediaUrls: string[] = [];
  if (tweet.media?.all) {
    for (const media of tweet.media.all) {
      const url = media.url || media.thumbnail_url;
      if (url) {
        mediaUrls.push(url);
      }
    }
  }

  // Extract hashtags from tweet text
  const hashtagMatches = tweet.text.match(/#(\w+)/g) || [];
  const hashtags = hashtagMatches.map(h => h.slice(1));

  // Extract mentions from tweet text
  const mentionMatches = tweet.text.match(/@(\w+)/g) || [];
  const mentions = mentionMatches.map(m => m.slice(1));

  return {
    tweetId,
    authorHandle: tweet.author.screen_name || null,
    authorName: tweet.author.name || null,
    authorFollowers: tweet.author.followers ?? null,
    tweetText: tweet.text || null,
    likeCount: tweet.likes ?? null,
    retweetCount: tweet.retweets ?? null,
    replyCount: tweet.replies ?? null,
    quoteCount: tweet.quotes ?? null,
    isRetweet: false,
    isQuoteTweet: !!tweet.quote,
    quotedTweetUrl: tweet.quote?.url || null,
    mediaUrls,
    hashtags,
    mentions,
    postedAt: tweet.created_at || null,
  };
}
