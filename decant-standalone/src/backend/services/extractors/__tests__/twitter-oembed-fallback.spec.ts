// ============================================================
// Twitter oEmbed Fallback — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTweetViaOEmbed } from '../twitter-oembed-fallback.js';

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

// Sample oEmbed HTML — mirrors Twitter's actual response structure
const OEMBED_HTML_FULL = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">This is the tweet text! <a href="https://t.co/link">#hashtag</a></p>&mdash; Test User (@testhandle) <a href="https://twitter.com/testhandle/status/1234567890?ref_src=twsrc%5Etfw">January 1, 2022</a></blockquote>`;

function buildOEmbedResponse(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    url: 'https://twitter.com/testhandle/status/1234567890',
    author_name: 'Test User',
    author_url: 'https://twitter.com/testhandle',
    html: OEMBED_HTML_FULL,
    width: 550,
    height: null,
    type: 'rich',
    cache_age: '3153600000',
    provider_name: 'Twitter',
    provider_url: 'https://twitter.com',
    version: '1.0',
    ...overrides,
  };
}

function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
  });
}

describe('Twitter oEmbed Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // Happy path — fields mapping
  // ============================================================

  describe('fetchTweetViaOEmbed — success', () => {
    it('should return mapped TwitterFields from a standard oEmbed response', async () => {
      mockOk(buildOEmbedResponse());

      const result = await fetchTweetViaOEmbed(
        '1234567890',
        'https://x.com/testhandle/status/1234567890'
      );

      expect(result).not.toBeNull();
      expect(result!.tweetId).toBe('1234567890');
      expect(result!.authorHandle).toBe('testhandle');
      expect(result!.authorName).toBe('Test User');
    });

    it('should extract tweet text from blockquote <p> element', async () => {
      mockOk(buildOEmbedResponse());

      const result = await fetchTweetViaOEmbed('1', 'https://x.com/testhandle/status/1');

      expect(result).not.toBeNull();
      expect(result!.tweetText).toContain('This is the tweet text!');
    });

    it('should extract author handle from author_url', async () => {
      mockOk(buildOEmbedResponse({ author_url: 'https://twitter.com/someuser' }));

      const result = await fetchTweetViaOEmbed('2', 'https://x.com/someuser/status/2');

      expect(result!.authorHandle).toBe('someuser');
    });

    it('should handle author_url without trailing slash', async () => {
      mockOk(buildOEmbedResponse({ author_url: 'https://twitter.com/notrailing' }));

      const result = await fetchTweetViaOEmbed('3', 'https://x.com/notrailing/status/3');

      expect(result!.authorHandle).toBe('notrailing');
    });

    it('should return null for metrics not available via oEmbed', async () => {
      mockOk(buildOEmbedResponse());

      const result = await fetchTweetViaOEmbed('4', 'https://x.com/user/status/4');

      expect(result!.likeCount).toBeNull();
      expect(result!.retweetCount).toBeNull();
      expect(result!.replyCount).toBeNull();
      expect(result!.quoteCount).toBeNull();
      expect(result!.authorFollowers).toBeNull();
      expect(result!.postedAt).toBeNull();
    });

    it('should return empty mediaUrls (not available via oEmbed)', async () => {
      mockOk(buildOEmbedResponse());

      const result = await fetchTweetViaOEmbed('5', 'https://x.com/user/status/5');

      expect(result!.mediaUrls).toEqual([]);
    });

    it('should return isRetweet and isQuoteTweet as false (unavailable)', async () => {
      mockOk(buildOEmbedResponse());

      const result = await fetchTweetViaOEmbed('6', 'https://x.com/user/status/6');

      expect(result!.isRetweet).toBe(false);
      expect(result!.isQuoteTweet).toBe(false);
    });

    it('should extract hashtags from tweet text', async () => {
      const html = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Loving <a href="#">#AI</a> and <a href="#">#ML</a> today</p>&mdash; Author (@handle) <a href="#">date</a></blockquote>`;
      mockOk(buildOEmbedResponse({ html }));

      const result = await fetchTweetViaOEmbed('7', 'https://x.com/user/status/7');

      expect(result!.hashtags).toContain('AI');
      expect(result!.hashtags).toContain('ML');
    });

    it('should extract mentions from tweet text', async () => {
      const html = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Hello @alice and @bob</p>&mdash; Author (@handle) <a href="#">date</a></blockquote>`;
      mockOk(buildOEmbedResponse({ html }));

      const result = await fetchTweetViaOEmbed('8', 'https://x.com/user/status/8');

      expect(result!.mentions).toContain('alice');
      expect(result!.mentions).toContain('bob');
    });

    it('should decode HTML entities in tweet text', async () => {
      const html = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">AT&amp;T &lt;rocks&gt;</p>&mdash; Author (@h) <a href="#">d</a></blockquote>`;
      mockOk(buildOEmbedResponse({ html }));

      const result = await fetchTweetViaOEmbed('9', 'https://x.com/user/status/9');

      expect(result!.tweetText).toContain('AT&T');
      expect(result!.tweetText).toContain('<rocks>');
    });

    it('should pass the tweet URL as the oEmbed url param', async () => {
      mockOk(buildOEmbedResponse());

      const tweetUrl = 'https://x.com/testhandle/status/42';
      await fetchTweetViaOEmbed('42', tweetUrl);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(encodeURIComponent(tweetUrl));
    });

    it('should include omit_script and lang params in oEmbed request', async () => {
      mockOk(buildOEmbedResponse());

      await fetchTweetViaOEmbed('43', 'https://x.com/user/status/43');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('omit_script=true');
      expect(url).toContain('lang=en');
    });
  });

  // ============================================================
  // Failure / edge cases
  // ============================================================

  describe('fetchTweetViaOEmbed — failures', () => {
    it('should return null on HTTP 403', async () => {
      mockError(403);

      const result = await fetchTweetViaOEmbed('20', 'https://x.com/user/status/20');
      expect(result).toBeNull();
    });

    it('should return null on HTTP 404', async () => {
      mockError(404);

      const result = await fetchTweetViaOEmbed('21', 'https://x.com/user/status/21');
      expect(result).toBeNull();
    });

    it('should return null when html field is missing', async () => {
      mockOk(buildOEmbedResponse({ html: '' }));

      const result = await fetchTweetViaOEmbed('22', 'https://x.com/user/status/22');
      expect(result).toBeNull();
    });

    it('should return null when author_name field is missing', async () => {
      mockOk(buildOEmbedResponse({ author_name: '' }));

      const result = await fetchTweetViaOEmbed('23', 'https://x.com/user/status/23');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'));

      const result = await fetchTweetViaOEmbed('24', 'https://x.com/user/status/24');
      expect(result).toBeNull();
    });

    it('should return null on AbortError (timeout)', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetchTweetViaOEmbed('25', 'https://x.com/user/status/25');
      expect(result).toBeNull();
    });

    it('should return null on DNS resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND publish.twitter.com'));

      const result = await fetchTweetViaOEmbed('26', 'https://x.com/user/status/26');
      expect(result).toBeNull();
    });

    it('should handle HTML with no blockquote gracefully (returns tweetText as null)', async () => {
      const html = `<div>No blockquote here at all</div>`;
      mockOk(buildOEmbedResponse({ html, author_name: 'User' }));

      const result = await fetchTweetViaOEmbed('27', 'https://x.com/user/status/27');

      // Should succeed (author_name is present) but tweetText may be null or minimal
      expect(result).not.toBeNull();
    });
  });
});
