// ============================================================
// Twitter OG Tag Fallback — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractAuthorFromUrl, fetchTweetViaOgTags } from '../twitter-og-fallback.js';

// Mock the logger to suppress output during tests
vi.mock('../../../logger/index.js', () => ({
  log: {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Twitter OG Tag Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // extractAuthorFromUrl
  // ============================================================

  describe('extractAuthorFromUrl', () => {
    it('should extract author from standard x.com tweet URL', () => {
      expect(extractAuthorFromUrl('https://x.com/elonmusk/status/1234567890')).toBe('elonmusk');
    });

    it('should extract author from twitter.com tweet URL', () => {
      expect(extractAuthorFromUrl('https://twitter.com/naval/status/9876543210')).toBe('naval');
    });

    it('should extract author from www-prefixed URL', () => {
      expect(extractAuthorFromUrl('https://www.x.com/someuser/status/111')).toBe('someuser');
    });

    it('should extract author from URL without /status path', () => {
      // Profile URL: https://x.com/username
      expect(extractAuthorFromUrl('https://x.com/username')).toBe('username');
    });

    it('should return null for /i/ internal routes', () => {
      // Internal routes like https://x.com/i/flow/login
      expect(extractAuthorFromUrl('https://x.com/i/flow/login')).toBeNull();
    });

    it('should return null for root URL with no path', () => {
      expect(extractAuthorFromUrl('https://x.com/')).toBeNull();
    });

    it('should return null for root URL without trailing slash', () => {
      expect(extractAuthorFromUrl('https://x.com')).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(extractAuthorFromUrl('not-a-url')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractAuthorFromUrl('')).toBeNull();
    });

    it('should handle URL with query parameters', () => {
      expect(extractAuthorFromUrl('https://x.com/johndoe/status/123?s=20&t=abc')).toBe('johndoe');
    });

    it('should handle URL with hash fragment', () => {
      expect(extractAuthorFromUrl('https://x.com/janedoe/status/456#section')).toBe('janedoe');
    });

    it('should handle URL with trailing slash', () => {
      expect(extractAuthorFromUrl('https://x.com/user123/')).toBe('user123');
    });
  });

  // ============================================================
  // fetchTweetViaOgTags — successful parsing
  // ============================================================

  describe('fetchTweetViaOgTags', () => {
    function buildHtml(ogTags: Record<string, string>, twitterTags?: Record<string, string>): string {
      const ogMeta = Object.entries(ogTags)
        .map(([prop, content]) => `<meta property="${prop}" content="${content}">`)
        .join('\n');
      const twMeta = twitterTags
        ? Object.entries(twitterTags)
            .map(([name, content]) => `<meta name="${name}" content="${content}">`)
            .join('\n')
        : '';

      return `<!DOCTYPE html>
<html>
<head>
  <title>X</title>
  ${ogMeta}
  ${twMeta}
</head>
<body><div id="react-root"></div></body>
</html>`;
    }

    it('should parse OG tags from HTML response', async () => {
      const html = buildHtml({
        'og:title': 'Elon Musk on X',
        'og:description': 'This is a test tweet about AI and technology.',
        'og:image': 'https://pbs.twimg.com/media/test-image.jpg',
        'og:site_name': 'X (formerly Twitter)',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/elonmusk/status/123');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Elon Musk on X');
      expect(result!.description).toBe('This is a test tweet about AI and technology.');
      expect(result!.image).toBe('https://pbs.twimg.com/media/test-image.jpg');
      expect(result!.authorHandle).toBe('elonmusk');
      expect(result!.siteName).toBe('X (formerly Twitter)');
    });

    it('should fall back to twitter: namespace tags when OG tags are missing', async () => {
      const html = buildHtml({}, {
        'twitter:title': 'Tweet Title via Twitter Tags',
        'twitter:description': 'Description from twitter namespace',
        'twitter:image': 'https://pbs.twimg.com/tw-image.jpg',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/someuser/status/456');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Tweet Title via Twitter Tags');
      expect(result!.description).toBe('Description from twitter namespace');
      expect(result!.image).toBe('https://pbs.twimg.com/tw-image.jpg');
      expect(result!.authorHandle).toBe('someuser');
    });

    it('should prefer OG tags over twitter: namespace tags', async () => {
      const html = buildHtml(
        {
          'og:title': 'OG Title',
          'og:description': 'OG Description',
          'og:image': 'https://og-image.jpg',
        },
        {
          'twitter:title': 'Twitter Title',
          'twitter:description': 'Twitter Description',
          'twitter:image': 'https://tw-image.jpg',
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/789');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('OG Title');
      expect(result!.description).toBe('OG Description');
      expect(result!.image).toBe('https://og-image.jpg');
    });

    it('should use default siteName when og:site_name is absent', async () => {
      const html = buildHtml({
        'og:title': 'Some Title',
        'og:description': 'Some Description',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/100');

      expect(result).not.toBeNull();
      expect(result!.siteName).toBe('X (Twitter)');
    });

    it('should handle description-only (no title)', async () => {
      const html = buildHtml({
        'og:description': 'A tweet with only description, no title tag.',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/200');

      expect(result).not.toBeNull();
      expect(result!.title).toBeNull();
      expect(result!.description).toBe('A tweet with only description, no title tag.');
    });

    it('should handle title-only (no description)', async () => {
      const html = buildHtml({
        'og:title': 'Title Only Tweet',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/300');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Title Only Tweet');
      expect(result!.description).toBeNull();
    });

    it('should trim whitespace from tag values', async () => {
      const html = `<!DOCTYPE html>
<html><head>
<meta property="og:title" content="  Spaced Title  ">
<meta property="og:description" content="  Spaced Desc  ">
</head><body></body></html>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/400');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Spaced Title');
      expect(result!.description).toBe('Spaced Desc');
    });

    // ============================================================
    // fetchTweetViaOgTags — failure cases
    // ============================================================

    it('should return null when no useful OG tags found', async () => {
      const html = buildHtml({});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/500');
      expect(result).toBeNull();
    });

    it('should return null on HTTP error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/600');
      expect(result).toBeNull();
    });

    it('should return null on 404 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/700');
      expect(result).toBeNull();
    });

    it('should return null when HTML is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/800');
      expect(result).toBeNull();
    });

    it('should return null when HTML is too short (under 100 chars)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><head></head><body></body></html>'),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/900');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'));

      const result = await fetchTweetViaOgTags('https://x.com/user/status/1000');
      expect(result).toBeNull();
    });

    it('should return null on fetch timeout (AbortError)', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetchTweetViaOgTags('https://x.com/user/status/1100');
      expect(result).toBeNull();
    });

    it('should return null on DNS resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND x.com'));

      const result = await fetchTweetViaOgTags('https://x.com/user/status/1200');
      expect(result).toBeNull();
    });

    // ============================================================
    // fetchTweetViaOgTags — fetch call verification
    // ============================================================

    it('should send correct headers including Googlebot user-agent', async () => {
      const html = buildHtml({ 'og:title': 'Test', 'og:description': 'Desc' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      await fetchTweetViaOgTags('https://x.com/user/status/1300');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://x.com/user/status/1300');
      expect(options.headers['User-Agent']).toContain('Googlebot');
      expect(options.headers['Accept']).toContain('text/html');
      expect(options.redirect).toBe('follow');
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('should handle image-only OG tags (no title or description) as no useful data', async () => {
      const html = buildHtml({
        'og:image': 'https://pbs.twimg.com/media/only-image.jpg',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://x.com/user/status/1400');
      // Image alone is not "useful" — need title or description
      expect(result).toBeNull();
    });

    it('should extract author handle from twitter.com URLs', async () => {
      const html = buildHtml({
        'og:title': 'Test Tweet',
        'og:description': 'Some content',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await fetchTweetViaOgTags('https://twitter.com/naval/status/1500');

      expect(result).not.toBeNull();
      expect(result!.authorHandle).toBe('naval');
    });
  });
});
