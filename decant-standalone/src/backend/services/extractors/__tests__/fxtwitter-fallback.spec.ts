// ============================================================
// FxTwitter Fallback — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTweetViaFxTwitter } from '../fxtwitter-fallback.js';

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

// Helpers
function buildFxResponse(partial?: Record<string, unknown>): Record<string, unknown> {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id: '1234567890',
      url: 'https://x.com/testuser/status/1234567890',
      text: 'Hello from FxTwitter! #test @mention',
      created_at: 'Sat Jan 01 00:00:00 +0000 2022',
      created_timestamp: 1640995200,
      likes: 42,
      retweets: 7,
      replies: 3,
      quotes: 1,
      author: {
        id: 'u1',
        name: 'Test User',
        screen_name: 'testuser',
        avatar_url: 'https://pbs.twimg.com/avatar.jpg',
        followers: 500,
        following: 100,
      },
      media: undefined,
      replying_to: null,
      quote: undefined,
      ...partial,
    },
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

describe('FxTwitter Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // Happy path — fields mapping
  // ============================================================

  describe('fetchTweetViaFxTwitter — success', () => {
    it('should return mapped TwitterFields on a complete response', async () => {
      mockOk(buildFxResponse());

      const result = await fetchTweetViaFxTwitter(
        '1234567890',
        'https://x.com/testuser/status/1234567890'
      );

      expect(result).not.toBeNull();
      expect(result!.tweetId).toBe('1234567890');
      expect(result!.authorHandle).toBe('testuser');
      expect(result!.authorName).toBe('Test User');
      expect(result!.authorFollowers).toBe(500);
      expect(result!.tweetText).toBe('Hello from FxTwitter! #test @mention');
      expect(result!.likeCount).toBe(42);
      expect(result!.retweetCount).toBe(7);
      expect(result!.replyCount).toBe(3);
      expect(result!.quoteCount).toBe(1);
      expect(result!.isRetweet).toBe(false);
      expect(result!.isQuoteTweet).toBe(false);
      expect(result!.postedAt).toBe('Sat Jan 01 00:00:00 +0000 2022');
    });

    it('should extract hashtags from tweet text', async () => {
      mockOk(buildFxResponse({ text: 'Check this out #AI #MachineLearning' }));

      const result = await fetchTweetViaFxTwitter('1', 'https://x.com/user/status/1');

      expect(result!.hashtags).toEqual(['AI', 'MachineLearning']);
    });

    it('should extract mentions from tweet text', async () => {
      mockOk(buildFxResponse({ text: 'Hello @alice and @bob!' }));

      const result = await fetchTweetViaFxTwitter('2', 'https://x.com/user/status/2');

      expect(result!.mentions).toEqual(['alice', 'bob']);
    });

    it('should return empty hashtags and mentions when none in text', async () => {
      mockOk(buildFxResponse({ text: 'Just a plain tweet.' }));

      const result = await fetchTweetViaFxTwitter('3', 'https://x.com/user/status/3');

      expect(result!.hashtags).toEqual([]);
      expect(result!.mentions).toEqual([]);
    });

    it('should map media URLs from media.all', async () => {
      mockOk(buildFxResponse({
        media: {
          all: [
            { url: 'https://pbs.twimg.com/photo1.jpg', type: 'photo' },
            { url: 'https://pbs.twimg.com/video1.mp4', type: 'video', thumbnail_url: 'https://pbs.twimg.com/thumb1.jpg' },
          ],
        },
      }));

      const result = await fetchTweetViaFxTwitter('4', 'https://x.com/user/status/4');

      expect(result!.mediaUrls).toContain('https://pbs.twimg.com/photo1.jpg');
      expect(result!.mediaUrls).toContain('https://pbs.twimg.com/video1.mp4');
    });

    it('should fall back to thumbnail_url when url is missing in media item', async () => {
      mockOk(buildFxResponse({
        media: {
          all: [
            { url: '', type: 'video', thumbnail_url: 'https://pbs.twimg.com/thumb.jpg' },
          ],
        },
      }));

      const result = await fetchTweetViaFxTwitter('5', 'https://x.com/user/status/5');

      expect(result!.mediaUrls).toContain('https://pbs.twimg.com/thumb.jpg');
    });

    it('should mark isQuoteTweet true and set quotedTweetUrl when quote is present', async () => {
      mockOk(buildFxResponse({
        quote: { url: 'https://x.com/other/status/999', text: 'Quoted!', author: { screen_name: 'other' } },
      }));

      const result = await fetchTweetViaFxTwitter('6', 'https://x.com/user/status/6');

      expect(result!.isQuoteTweet).toBe(true);
      expect(result!.quotedTweetUrl).toBe('https://x.com/other/status/999');
    });

    it('should use author handle from URL when building the API call (x.com)', async () => {
      mockOk(buildFxResponse());

      await fetchTweetViaFxTwitter('7', 'https://x.com/johndoe/status/7');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('johndoe');
      expect(url).toContain('7');
    });

    it('should fall back to /i/status/{id} when URL has no author (internal route)', async () => {
      mockOk(buildFxResponse());

      await fetchTweetViaFxTwitter('8', 'https://x.com/i/status/8');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/i/status/8');
    });
  });

  // ============================================================
  // Failure / edge cases
  // ============================================================

  describe('fetchTweetViaFxTwitter — failures', () => {
    it('should return null on HTTP error status', async () => {
      mockError(403);

      const result = await fetchTweetViaFxTwitter('10', 'https://x.com/user/status/10');
      expect(result).toBeNull();
    });

    it('should return null on 404 status', async () => {
      mockError(404);

      const result = await fetchTweetViaFxTwitter('11', 'https://x.com/user/status/11');
      expect(result).toBeNull();
    });

    it('should return null when API code is not 200', async () => {
      mockOk({ code: 404, message: 'Tweet not found', tweet: undefined });

      const result = await fetchTweetViaFxTwitter('12', 'https://x.com/user/status/12');
      expect(result).toBeNull();
    });

    it('should return null when tweet field is missing', async () => {
      mockOk({ code: 200, message: 'OK', tweet: undefined });

      const result = await fetchTweetViaFxTwitter('13', 'https://x.com/user/status/13');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'));

      const result = await fetchTweetViaFxTwitter('14', 'https://x.com/user/status/14');
      expect(result).toBeNull();
    });

    it('should return null on AbortError (timeout)', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetchTweetViaFxTwitter('15', 'https://x.com/user/status/15');
      expect(result).toBeNull();
    });

    it('should return null on DNS resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.fxtwitter.com'));

      const result = await fetchTweetViaFxTwitter('16', 'https://x.com/user/status/16');
      expect(result).toBeNull();
    });

    it('should handle zero-valued metrics gracefully', async () => {
      mockOk(buildFxResponse({ likes: 0, retweets: 0, replies: 0, quotes: 0 }));

      const result = await fetchTweetViaFxTwitter('17', 'https://x.com/user/status/17');

      expect(result).not.toBeNull();
      expect(result!.likeCount).toBe(0);
      expect(result!.retweetCount).toBe(0);
      expect(result!.replyCount).toBe(0);
      expect(result!.quoteCount).toBe(0);
    });
  });
});
