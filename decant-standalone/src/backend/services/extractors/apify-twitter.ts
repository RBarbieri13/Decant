// ============================================================
// Apify Twitter Fallback
// Fetches tweet data via Apify's Tweet Scraper when X API is unavailable
// ============================================================

import { config } from '../../config/index.js';
import { log } from '../../logger/index.js';
import type { TwitterFields } from './base.js';

const APIFY_ACTOR = 'apidojo~tweet-scraper';
const APIFY_BASE_URL = 'https://api.apify.com/v2';
const APIFY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface ApifyTweetItem {
  id_str?: string;
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
  is_quote_status?: boolean;
  quoted_status_permalink?: { expanded?: string };
  entities?: {
    hashtags?: Array<{ text: string }>;
    user_mentions?: Array<{ screen_name: string }>;
    media?: Array<{ media_url_https?: string }>;
  };
  extended_entities?: {
    media?: Array<{ media_url_https?: string }>;
  };
  created_at?: string;
  retweeted_status?: object;
}

/**
 * Fetch tweet data via Apify's Tweet Scraper actor
 * Returns null on any failure (graceful degradation)
 */
export async function fetchTweetViaApify(
  tweetId: string,
  tweetUrl: string
): Promise<TwitterFields | null> {
  const apiKey = config.APIFY_API_KEY;
  if (!apiKey) {
    log.debug('Apify API key not configured, skipping Apify fallback', {
      module: 'apify-twitter',
    });
    return null;
  }

  log.info('Attempting Apify fallback for tweet extraction', {
    tweetId,
    module: 'apify-twitter',
  });

  const startTime = Date.now();

  try {
    // Step 1: Start the actor run
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${APIFY_ACTOR}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [tweetUrl],
          maxItems: 1,
        }),
      }
    );

    if (!runResponse.ok) {
      log.warn('Apify actor start failed', {
        status: runResponse.status,
        tweetId,
        module: 'apify-twitter',
      });
      return null;
    }

    const runData = (await runResponse.json()) as ApifyRunResponse;
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    log.debug('Apify run started', { runId, datasetId, module: 'apify-twitter' });

    // Step 2: Poll for completion
    let status = runData.data.status;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED') {
      if (Date.now() - startTime > APIFY_TIMEOUT_MS) {
        log.warn('Apify run timed out', { runId, tweetId, module: 'apify-twitter' });
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollResponse = await fetch(
        `${APIFY_BASE_URL}/actor-runs/${runId}?token=${apiKey}`
      );
      if (!pollResponse.ok) {
        log.warn('Apify poll failed', { status: pollResponse.status, module: 'apify-twitter' });
        return null;
      }

      const pollData = (await pollResponse.json()) as ApifyRunResponse;
      status = pollData.data.status;
    }

    if (status !== 'SUCCEEDED') {
      log.warn('Apify run did not succeed', { status, runId, module: 'apify-twitter' });
      return null;
    }

    // Step 3: Fetch results
    const itemsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiKey}&limit=1`
    );
    if (!itemsResponse.ok) {
      log.warn('Apify dataset fetch failed', { status: itemsResponse.status, module: 'apify-twitter' });
      return null;
    }

    const items = (await itemsResponse.json()) as ApifyTweetItem[];
    if (!items || items.length === 0 || (items[0] as Record<string, unknown>).noResults) {
      log.warn('Apify returned no tweet data', { tweetId, module: 'apify-twitter' });
      return null;
    }

    const tweet = items[0];
    const fields = mapApifyTweetToFields(tweet, tweetId);

    log.info('Apify fallback extraction succeeded', {
      tweetId,
      hasText: !!fields.tweetText,
      author: fields.authorHandle,
      durationMs: Date.now() - startTime,
      module: 'apify-twitter',
    });

    return fields;

  } catch (error) {
    log.warn('Apify fallback failed', {
      tweetId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      module: 'apify-twitter',
    });
    return null;
  }
}

/**
 * Map Apify tweet scraper response to TwitterFields
 */
export function mapApifyTweetToFields(tweet: ApifyTweetItem, tweetId: string): TwitterFields {
  const tweetText = tweet.full_text || tweet.text || null;
  const mediaUrls: string[] = [];

  // Try extended_entities first (higher quality), then regular entities
  const mediaEntities = tweet.extended_entities?.media || tweet.entities?.media || [];
  for (const media of mediaEntities) {
    if (media.media_url_https) {
      mediaUrls.push(media.media_url_https);
    }
  }

  const hashtags = (tweet.entities?.hashtags || [])
    .map(h => h.text)
    .filter((t): t is string => !!t);

  const mentions = (tweet.entities?.user_mentions || [])
    .map(m => m.screen_name)
    .filter((s): s is string => !!s);

  return {
    tweetId,
    authorHandle: tweet.user?.screen_name || null,
    authorName: tweet.user?.name || null,
    authorFollowers: tweet.user?.followers_count ?? null,
    tweetText,
    likeCount: tweet.favorite_count ?? null,
    retweetCount: tweet.retweet_count ?? null,
    replyCount: tweet.reply_count ?? null,
    quoteCount: tweet.quote_count ?? null,
    isRetweet: !!tweet.retweeted_status,
    isQuoteTweet: tweet.is_quote_status ?? false,
    quotedTweetUrl: tweet.quoted_status_permalink?.expanded || null,
    mediaUrls,
    hashtags,
    mentions,
    postedAt: tweet.created_at || null,
  };
}
