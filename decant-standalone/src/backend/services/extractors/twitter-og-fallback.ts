// ============================================================
// Twitter OG Tag Fallback
// Extracts basic tweet metadata from HTML Open Graph tags
// Used as last resort when X API and Apify are unavailable
// ============================================================

import * as cheerio from 'cheerio';
import { log } from '../../logger/index.js';

const OG_FETCH_TIMEOUT_MS = 15_000;

export interface OgTweetData {
  title: string | null;
  description: string | null;
  image: string | null;
  authorHandle: string | null;
  siteName: string | null;
}

/**
 * Extract tweet author handle from URL path
 * e.g., https://x.com/elonmusk/status/123 -> 'elonmusk'
 */
export function extractAuthorFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Path format: /username/status/tweetId
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
 * Fetch tweet data via HTML OG tags as a last-resort fallback
 * Returns null on any failure
 */
export async function fetchTweetViaOgTags(tweetUrl: string): Promise<OgTweetData | null> {
  log.debug('Attempting OG tag fallback for tweet', { url: tweetUrl, module: 'twitter-og-fallback' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OG_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(tweetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      log.debug('OG tag fetch failed with status', { status: response.status, module: 'twitter-og-fallback' });
      return null;
    }

    const html = await response.text();
    if (!html || html.length < 100) {
      log.debug('OG tag fetch returned empty/minimal HTML', { module: 'twitter-og-fallback' });
      return null;
    }

    const $ = cheerio.load(html);

    // Extract OG tags
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null;
    const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || null;
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || null;
    const ogSiteName = $('meta[property="og:site_name"]').attr('content')?.trim() || null;

    // Try twitter: namespace tags as fallback
    const twitterTitle = $('meta[name="twitter:title"]').attr('content')?.trim() || null;
    const twitterDescription = $('meta[name="twitter:description"]').attr('content')?.trim() || null;
    const twitterImage = $('meta[name="twitter:image"]').attr('content')?.trim() || null;

    const title = ogTitle || twitterTitle;
    const description = ogDescription || twitterDescription;
    const image = ogImage || twitterImage;

    // If we got nothing useful, return null
    if (!title && !description) {
      log.debug('OG tag fallback found no useful metadata', { module: 'twitter-og-fallback' });
      return null;
    }

    const authorHandle = extractAuthorFromUrl(tweetUrl);

    const result: OgTweetData = {
      title,
      description,
      image,
      authorHandle,
      siteName: ogSiteName || 'X (Twitter)',
    };

    log.info('OG tag fallback extracted metadata', {
      hasTitle: !!title,
      hasDescription: !!description,
      hasImage: !!image,
      author: authorHandle,
      module: 'twitter-og-fallback',
    });

    return result;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.debug('OG tag fetch timed out', { module: 'twitter-og-fallback' });
    } else {
      log.debug('OG tag fallback failed', {
        error: error instanceof Error ? error.message : String(error),
        module: 'twitter-og-fallback',
      });
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
