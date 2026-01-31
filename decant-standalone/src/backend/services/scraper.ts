// ============================================================
// URL Scraper Service
// Extracts metadata from URLs using cheerio
// Includes SSRF protection and resource limits
// ============================================================

import * as cheerio from 'cheerio';
import { log } from '../logger/index.js';
import { config } from '../config/index.js';
import { SSRFError, AppError } from '../middleware/errorHandler.js';
import { withRetry, RetryPresets } from './retry/index.js';
import { getCircuitBreakerRegistry } from './retry/circuit-breaker.js';

// Type for cheerio instance
type CheerioInstance = ReturnType<typeof cheerio.load>;

export interface ScrapedContent {
  url: string;
  title: string;
  description: string | null;
  author: string | null;
  siteName: string | null;
  favicon: string | null;
  image: string | null;
  content: string | null;
  domain: string;
}

// ============================================================
// SSRF Protection
// ============================================================

/**
 * Private IP ranges that should be blocked
 * Prevents SSRF attacks by blocking internal network access
 */
const PRIVATE_IP_PATTERNS = [
  // IPv4 private ranges
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,           // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/,              // 192.168.0.0/16
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,          // 127.0.0.0/8 (loopback)
  /^0\.0\.0\.0$/,                               // 0.0.0.0
  /^169\.254\.\d{1,3}\.\d{1,3}$/,              // 169.254.0.0/16 (link-local)

  // IPv6 private/special ranges (when resolved)
  /^::1$/,                                      // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,                          // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,                          // IPv6 unique local
  /^fe80:/i,                                    // IPv6 link-local
];

/**
 * Blocked hostnames that should never be accessed
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'internal',
  'intranet',
  'local',
  'metadata.google.internal',  // GCP metadata service
  '169.254.169.254',           // AWS/GCP/Azure metadata service
];

/**
 * Check if a hostname/IP is a private address
 */
function isPrivateIP(hostname: string): boolean {
  // Check blocked hostnames
  const normalizedHost = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.some(blocked => normalizedHost === blocked || normalizedHost.endsWith(`.${blocked}`))) {
    return true;
  }

  // Check IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate URL for SSRF protection
 * Throws SSRFError if URL points to a private/blocked address
 */
function validateUrlForSSRF(url: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new AppError('Invalid URL format', 400, 'INVALID_URL');
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new SSRFError(`Protocol ${parsedUrl.protocol} is not allowed`);
  }

  // Check if hostname is a private/blocked address
  if (isPrivateIP(parsedUrl.hostname)) {
    log.warn('SSRF attempt blocked', {
      url,
      hostname: parsedUrl.hostname,
    });
    throw new SSRFError('Access to internal network addresses is forbidden');
  }

  // Block URLs with credentials
  if (parsedUrl.username || parsedUrl.password) {
    throw new SSRFError('URLs with credentials are not allowed');
  }

  return parsedUrl;
}

// ============================================================
// Fetch with Timeout and Size Limits
// ============================================================

/**
 * Fetch URL with timeout and size limits
 */
async function fetchWithLimits(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = config.SCRAPER_TIMEOUT_MS;
  const maxSizeBytes = config.SCRAPER_MAX_SIZE_BYTES;

  // Set up timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError(
        `Failed to fetch URL: ${response.status} ${response.statusText}`,
        response.status >= 500 ? 502 : 400,
        'FETCH_FAILED'
      );
    }

    // Check content-length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > maxSizeBytes) {
        throw new AppError(
          `Response too large: ${size} bytes exceeds limit of ${maxSizeBytes} bytes`,
          413,
          'CONTENT_TOO_LARGE'
        );
      }
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      log.debug('Non-HTML content type', { url, contentType });
      // Still allow it but log for debugging
    }

    // Stream body and check size as we receive it
    const reader = response.body?.getReader();
    if (!reader) {
      throw new AppError('No response body', 502, 'NO_BODY');
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      receivedBytes += value.length;

      // Check size limit while streaming
      if (receivedBytes > maxSizeBytes) {
        reader.cancel();
        throw new AppError(
          `Response too large: exceeded limit of ${maxSizeBytes} bytes`,
          413,
          'CONTENT_TOO_LARGE'
        );
      }

      chunks.push(value);
    }

    // Combine chunks into string
    const decoder = new TextDecoder('utf-8');
    return chunks.map(chunk => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();

  } catch (error) {
    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(
        `Request timeout after ${timeoutMs}ms`,
        504,
        'TIMEOUT'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Main Scraper Function
// ============================================================

/**
 * Scrape metadata from a URL
 * Includes SSRF protection and resource limits
 */
export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  // Validate URL for SSRF (throws if blocked)
  const parsedUrl = validateUrlForSSRF(url);
  const domain = parsedUrl.hostname.replace(/^www\./, '');

  log.debug('Scraping URL', { url, domain });

  // Get circuit breaker for this domain
  const circuitBreaker = getCircuitBreakerRegistry().getOrCreate(
    `scraper:${domain}`,
    {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      halfOpenRequests: 2,
      context: `scraper:${domain}`,
    }
  );

  // Wrap fetch with retry logic and circuit breaker
  const scrapeWithRetry = async (): Promise<ScrapedContent> => {
    return circuitBreaker.call(async () => {
      // Fetch with limits
      const html = await fetchWithLimits(url);
      const $ = cheerio.load(html);

      // Extract metadata
      const title = extractTitle($);
      const description = extractDescription($);
      const author = extractAuthor($);
      const siteName = extractSiteName($, domain);
      const favicon = extractFavicon($, parsedUrl);
      const image = extractImage($, parsedUrl);
      const content = extractMainContent($);

      log.debug('Scraped metadata', {
        url,
        title,
        hasDescription: !!description,
        hasAuthor: !!author,
        hasImage: !!image,
      });

      return {
        url,
        title,
        description,
        author,
        siteName,
        favicon,
        image,
        content,
        domain,
      };
    });
  };

  // Use fast retry preset for scraping (3 attempts with shorter delays)
  return withRetry(scrapeWithRetry, {
    ...RetryPresets.FAST,
    context: `scrape:${domain}`,
    retryableErrors: ['FETCH_FAILED', 'TIMEOUT', 'ECONNRESET', 'ETIMEDOUT'],
  });
}

// ============================================================
// Metadata Extraction Functions
// ============================================================

/**
 * Extract page title
 */
function extractTitle($: CheerioInstance): string {
  // Try OpenGraph title first
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) return ogTitle.trim();

  // Try Twitter title
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  if (twitterTitle) return twitterTitle.trim();

  // Fall back to <title> tag
  const titleTag = $('title').text();
  if (titleTag) return titleTag.trim();

  // Last resort: first h1
  const h1 = $('h1').first().text();
  if (h1) return h1.trim();

  return 'Untitled';
}

/**
 * Extract page description
 */
function extractDescription($: CheerioInstance): string | null {
  // Try OpenGraph description
  const ogDesc = $('meta[property="og:description"]').attr('content');
  if (ogDesc) return ogDesc.trim();

  // Try Twitter description
  const twitterDesc = $('meta[name="twitter:description"]').attr('content');
  if (twitterDesc) return twitterDesc.trim();

  // Try standard meta description
  const metaDesc = $('meta[name="description"]').attr('content');
  if (metaDesc) return metaDesc.trim();

  return null;
}

/**
 * Extract author
 */
function extractAuthor($: CheerioInstance): string | null {
  // Try meta author
  const metaAuthor = $('meta[name="author"]').attr('content');
  if (metaAuthor) return metaAuthor.trim();

  // Try article:author
  const articleAuthor = $('meta[property="article:author"]').attr('content');
  if (articleAuthor) return articleAuthor.trim();

  // Try schema.org author
  const schemaAuthor = $('[itemprop="author"]').first().text();
  if (schemaAuthor) return schemaAuthor.trim();

  return null;
}

/**
 * Extract site name
 */
function extractSiteName($: CheerioInstance, domain: string): string | null {
  // Try OpenGraph site_name
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName) return ogSiteName.trim();

  // Try application-name
  const appName = $('meta[name="application-name"]').attr('content');
  if (appName) return appName.trim();

  // Fall back to domain
  return domain;
}

/**
 * Extract favicon URL
 */
function extractFavicon($: CheerioInstance, baseUrl: URL): string | null {
  // Try various favicon link tags
  const iconSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ];

  for (const selector of iconSelectors) {
    const href = $(selector).attr('href');
    if (href) {
      return resolveUrl(href, baseUrl);
    }
  }

  // Default to /favicon.ico
  return `${baseUrl.protocol}//${baseUrl.host}/favicon.ico`;
}

/**
 * Extract main image
 */
function extractImage($: CheerioInstance, baseUrl: URL): string | null {
  // Try OpenGraph image
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) return resolveUrl(ogImage, baseUrl);

  // Try Twitter image
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage) return resolveUrl(twitterImage, baseUrl);

  // Try first large image in content
  const firstImage = $('article img, main img, .content img').first().attr('src');
  if (firstImage) return resolveUrl(firstImage, baseUrl);

  return null;
}

/**
 * Extract main content text (for AI analysis)
 */
function extractMainContent($: CheerioInstance): string | null {
  // Remove script, style, nav, footer, header elements
  $('script, style, nav, footer, header, aside, .sidebar, .comments, .advertisement').remove();

  // Try to find main content area
  const contentSelectors = ['article', 'main', '[role="main"]', '.content', '.post', '.entry'];

  for (const selector of contentSelectors) {
    const content = $(selector).first().text();
    if (content && content.trim().length > 100) {
      return cleanText(content).slice(0, 5000); // Limit to 5000 chars for AI
    }
  }

  // Fall back to body text
  const bodyText = $('body').text();
  return cleanText(bodyText).slice(0, 5000);
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(href: string, baseUrl: URL): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  if (href.startsWith('//')) {
    return `${baseUrl.protocol}${href}`;
  }
  if (href.startsWith('/')) {
    return `${baseUrl.protocol}//${baseUrl.host}${href}`;
  }
  return `${baseUrl.protocol}//${baseUrl.host}/${href}`;
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}
