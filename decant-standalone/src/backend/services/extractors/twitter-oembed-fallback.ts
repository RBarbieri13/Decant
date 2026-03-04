// ============================================================
// Twitter oEmbed Fallback
// Fetches basic tweet data via Twitter's official oEmbed API
// No API key required — public endpoint
// ============================================================

import { log } from '../../logger/index.js';
import type { TwitterFields } from './base.js';

const OEMBED_URL = 'https://publish.twitter.com/oembed';
const OEMBED_TIMEOUT_MS = 15_000;

/**
 * Twitter oEmbed response
 */
interface OEmbedResponse {
  url: string;
  author_name: string;
  author_url: string;
  html: string;
  width: number;
  height: number | null;
  type: string;
  cache_age: string;
  provider_name: string;
  provider_url: string;
  version: string;
}

/**
 * Extract author handle from an author URL
 * e.g., https://twitter.com/elonmusk -> 'elonmusk'
 */
function extractHandleFromAuthorUrl(authorUrl: string): string | null {
  try {
    const parsed = new URL(authorUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

/**
 * Strip HTML tags and decode entities to get plain text from oEmbed HTML
 */
function stripHtmlToText(html: string): string {
  // Remove <script> and <style> blocks entirely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Remove blockquote cite attributes and links to pic.twitter.com (media links)
  // but keep the text content
  // Replace <br> and <p> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

/**
 * Extract tweet text from oEmbed HTML blockquote
 * The HTML contains a <blockquote> with the tweet text, followed by attribution
 */
function extractTweetTextFromHtml(html: string): string | null {
  // The oEmbed HTML structure is:
  // <blockquote class="twitter-tweet"><p lang="en" dir="ltr">TWEET TEXT</p>
  // &mdash; Author Name (@handle) <a href="...">date</a></blockquote>
  // <script ...></script>

  // Extract the <p> content from the blockquote
  const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pMatch) {
    const pContent = pMatch[1];
    // Strip HTML from the paragraph content but keep text and links
    const text = stripHtmlToText(pContent);
    if (text) return text;
  }

  // Fallback: try to get all text from blockquote
  const blockquoteMatch = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (blockquoteMatch) {
    const text = stripHtmlToText(blockquoteMatch[1]);
    // Remove the attribution line (starts with dash/mdash)
    const lines = text.split('\n').filter(line => !line.trim().startsWith('\u2014'));
    return lines.join('\n').trim() || null;
  }

  return null;
}

/**
 * Fetch tweet data via Twitter's official oEmbed API
 * Returns null on any failure (graceful degradation)
 *
 * The oEmbed endpoint returns basic tweet HTML and author info.
 * It doesn't require authentication and works reliably.
 * Limited data: no metrics, no media URLs, no hashtag/mention lists
 */
export async function fetchTweetViaOEmbed(
  tweetId: string,
  tweetUrl: string
): Promise<TwitterFields | null> {
  log.info('Attempting Twitter oEmbed fallback for tweet extraction', {
    tweetId,
    module: 'twitter-oembed-fallback',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);

  const startTime = Date.now();

  try {
    // Build oEmbed request URL
    const params = new URLSearchParams({
      url: tweetUrl,
      omit_script: 'true', // Don't need the widget JS
      lang: 'en',
    });

    const response = await fetch(`${OEMBED_URL}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Decant/1.0 (URL metadata extractor)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      log.debug('Twitter oEmbed returned error status', {
        status: response.status,
        tweetId,
        module: 'twitter-oembed-fallback',
      });
      return null;
    }

    const data = (await response.json()) as OEmbedResponse;

    if (!data.html || !data.author_name) {
      log.debug('Twitter oEmbed returned incomplete data', {
        hasHtml: !!data.html,
        hasAuthor: !!data.author_name,
        tweetId,
        module: 'twitter-oembed-fallback',
      });
      return null;
    }

    const fields = mapOEmbedToFields(data, tweetId);

    log.info('Twitter oEmbed fallback extraction succeeded', {
      tweetId,
      hasText: !!fields.tweetText,
      author: fields.authorHandle,
      durationMs: Date.now() - startTime,
      module: 'twitter-oembed-fallback',
    });

    return fields;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.debug('Twitter oEmbed request timed out', {
        tweetId,
        module: 'twitter-oembed-fallback',
      });
    } else {
      log.debug('Twitter oEmbed fallback failed', {
        tweetId,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        module: 'twitter-oembed-fallback',
      });
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map oEmbed response to TwitterFields
 * Note: oEmbed provides limited data — no metrics, no media, no entities
 */
function mapOEmbedToFields(
  data: OEmbedResponse,
  tweetId: string
): TwitterFields {
  const tweetText = extractTweetTextFromHtml(data.html);
  const authorHandle = extractHandleFromAuthorUrl(data.author_url);

  // Extract hashtags from tweet text if available
  const hashtagMatches = tweetText?.match(/#(\w+)/g) || [];
  const hashtags = hashtagMatches.map(h => h.slice(1));

  // Extract mentions from tweet text if available
  const mentionMatches = tweetText?.match(/@(\w+)/g) || [];
  const mentions = mentionMatches.map(m => m.slice(1));

  return {
    tweetId,
    authorHandle: authorHandle,
    authorName: data.author_name || null,
    authorFollowers: null, // Not available via oEmbed
    tweetText: tweetText,
    likeCount: null, // Not available via oEmbed
    retweetCount: null,
    replyCount: null,
    quoteCount: null,
    isRetweet: false,
    isQuoteTweet: false,
    quotedTweetUrl: null,
    mediaUrls: [], // Not available via oEmbed
    hashtags,
    mentions,
    postedAt: null, // Not available in structured form via oEmbed
  };
}
