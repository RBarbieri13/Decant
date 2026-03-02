// ============================================================
// Apify Twitter Fallback — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTweetViaApify, mapApifyTweetToFields } from '../apify-twitter.js';

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

// Mock the config module
vi.mock('../../../config/index.js', () => ({
  config: {
    APIFY_API_KEY: 'test-apify-key-123',
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================
// mapApifyTweetToFields — pure mapping logic
// ============================================================

describe('mapApifyTweetToFields', () => {
  it('should map a fully populated tweet item to TwitterFields', () => {
    const tweet = {
      full_text: 'This is the full tweet text with #AI and @elonmusk',
      user: {
        screen_name: 'testuser',
        name: 'Test User',
        followers_count: 15000,
      },
      favorite_count: 420,
      retweet_count: 100,
      reply_count: 50,
      quote_count: 10,
      is_quote_status: true,
      quoted_status_permalink: { expanded: 'https://x.com/quoted/status/999' },
      entities: {
        hashtags: [{ text: 'AI' }],
        user_mentions: [{ screen_name: 'elonmusk' }],
        media: [{ media_url_https: 'https://pbs.twimg.com/media/low-res.jpg' }],
      },
      extended_entities: {
        media: [{ media_url_https: 'https://pbs.twimg.com/media/high-res.jpg' }],
      },
      created_at: 'Mon Jan 01 12:00:00 +0000 2024',
    };

    const fields = mapApifyTweetToFields(tweet, '12345');

    expect(fields.tweetId).toBe('12345');
    expect(fields.authorHandle).toBe('testuser');
    expect(fields.authorName).toBe('Test User');
    expect(fields.authorFollowers).toBe(15000);
    expect(fields.tweetText).toBe('This is the full tweet text with #AI and @elonmusk');
    expect(fields.likeCount).toBe(420);
    expect(fields.retweetCount).toBe(100);
    expect(fields.replyCount).toBe(50);
    expect(fields.quoteCount).toBe(10);
    expect(fields.isRetweet).toBe(false);
    expect(fields.isQuoteTweet).toBe(true);
    expect(fields.quotedTweetUrl).toBe('https://x.com/quoted/status/999');
    // extended_entities should take precedence over entities.media
    expect(fields.mediaUrls).toEqual(['https://pbs.twimg.com/media/high-res.jpg']);
    expect(fields.hashtags).toEqual(['AI']);
    expect(fields.mentions).toEqual(['elonmusk']);
    expect(fields.postedAt).toBe('Mon Jan 01 12:00:00 +0000 2024');
  });

  it('should fall back to text when full_text is absent', () => {
    const tweet = {
      text: 'Short tweet text',
      user: { screen_name: 'user2' },
    };

    const fields = mapApifyTweetToFields(tweet, '67890');

    expect(fields.tweetText).toBe('Short tweet text');
    expect(fields.authorHandle).toBe('user2');
  });

  it('should return null tweetText when both full_text and text are absent', () => {
    const tweet = {
      user: { screen_name: 'silentuser' },
    };

    const fields = mapApifyTweetToFields(tweet, '111');

    expect(fields.tweetText).toBeNull();
  });

  it('should detect retweets via retweeted_status', () => {
    const tweet = {
      full_text: 'RT @original: some text',
      retweeted_status: { id_str: '999' },
      user: { screen_name: 'retweeter' },
    };

    const fields = mapApifyTweetToFields(tweet, '222');

    expect(fields.isRetweet).toBe(true);
  });

  it('should not mark as retweet when retweeted_status is absent', () => {
    const tweet = {
      full_text: 'Original post',
      user: { screen_name: 'original_poster' },
    };

    const fields = mapApifyTweetToFields(tweet, '333');

    expect(fields.isRetweet).toBe(false);
  });

  it('should fall back to entities.media when extended_entities is absent', () => {
    const tweet = {
      full_text: 'Tweet with image',
      entities: {
        media: [{ media_url_https: 'https://pbs.twimg.com/media/entity-image.jpg' }],
      },
    };

    const fields = mapApifyTweetToFields(tweet, '444');

    expect(fields.mediaUrls).toEqual(['https://pbs.twimg.com/media/entity-image.jpg']);
  });

  it('should handle empty entities gracefully', () => {
    const tweet = {
      full_text: 'No entities at all',
    };

    const fields = mapApifyTweetToFields(tweet, '555');

    expect(fields.mediaUrls).toEqual([]);
    expect(fields.hashtags).toEqual([]);
    expect(fields.mentions).toEqual([]);
  });

  it('should handle missing user object', () => {
    const tweet = {
      full_text: 'Orphan tweet',
    };

    const fields = mapApifyTweetToFields(tweet, '666');

    expect(fields.authorHandle).toBeNull();
    expect(fields.authorName).toBeNull();
    expect(fields.authorFollowers).toBeNull();
  });

  it('should handle null/zero counts correctly', () => {
    const tweet = {
      full_text: 'Unpopular tweet',
      favorite_count: 0,
      retweet_count: 0,
      reply_count: 0,
      quote_count: 0,
    };

    const fields = mapApifyTweetToFields(tweet, '777');

    expect(fields.likeCount).toBe(0);
    expect(fields.retweetCount).toBe(0);
    expect(fields.replyCount).toBe(0);
    expect(fields.quoteCount).toBe(0);
  });

  it('should handle undefined counts as null', () => {
    const tweet = {
      full_text: 'No metrics tweet',
    };

    const fields = mapApifyTweetToFields(tweet, '888');

    expect(fields.likeCount).toBeNull();
    expect(fields.retweetCount).toBeNull();
    expect(fields.replyCount).toBeNull();
    expect(fields.quoteCount).toBeNull();
  });

  it('should filter out media entries without media_url_https', () => {
    const tweet = {
      full_text: 'Mixed media',
      entities: {
        media: [
          { media_url_https: 'https://pbs.twimg.com/valid.jpg' },
          { media_url_https: undefined },
          { media_url_https: 'https://pbs.twimg.com/also-valid.jpg' },
        ],
      },
    };

    const fields = mapApifyTweetToFields(tweet, '999');

    expect(fields.mediaUrls).toEqual([
      'https://pbs.twimg.com/valid.jpg',
      'https://pbs.twimg.com/also-valid.jpg',
    ]);
  });

  it('should handle multiple hashtags and mentions', () => {
    const tweet = {
      full_text: '#one #two @a @b @c',
      entities: {
        hashtags: [{ text: 'one' }, { text: 'two' }],
        user_mentions: [
          { screen_name: 'a' },
          { screen_name: 'b' },
          { screen_name: 'c' },
        ],
      },
    };

    const fields = mapApifyTweetToFields(tweet, '1010');

    expect(fields.hashtags).toEqual(['one', 'two']);
    expect(fields.mentions).toEqual(['a', 'b', 'c']);
  });

  it('should default isQuoteTweet to false when is_quote_status is absent', () => {
    const tweet = { full_text: 'Regular tweet' };

    const fields = mapApifyTweetToFields(tweet, '1111');

    expect(fields.isQuoteTweet).toBe(false);
    expect(fields.quotedTweetUrl).toBeNull();
  });
});

// ============================================================
// fetchTweetViaApify — integration with Apify API
// ============================================================

describe('fetchTweetViaApify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const TWEET_ID = '1234567890';
  const TWEET_URL = 'https://x.com/testuser/status/1234567890';

  function mockSuccessfulRun(tweetData: Record<string, unknown>) {
    // Call 1: Start actor run
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: {
          id: 'run-abc-123',
          status: 'SUCCEEDED',
          defaultDatasetId: 'dataset-xyz-456',
        },
      }),
    });

    // Call 2: Fetch dataset items (run already SUCCEEDED, no polling needed)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([tweetData]),
    });
  }

  function mockRunWithPolling(tweetData: Record<string, unknown>) {
    // Call 1: Start actor run (status: RUNNING)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: {
          id: 'run-abc-123',
          status: 'RUNNING',
          defaultDatasetId: 'dataset-xyz-456',
        },
      }),
    });

    // Call 2: Poll — still RUNNING
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: {
          id: 'run-abc-123',
          status: 'RUNNING',
          defaultDatasetId: 'dataset-xyz-456',
        },
      }),
    });

    // Call 3: Poll — SUCCEEDED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: {
          id: 'run-abc-123',
          status: 'SUCCEEDED',
          defaultDatasetId: 'dataset-xyz-456',
        },
      }),
    });

    // Call 4: Fetch dataset items
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([tweetData]),
    });
  }

  it('should return TwitterFields on successful extraction', async () => {
    mockSuccessfulRun({
      full_text: 'Hello from Apify!',
      user: { screen_name: 'apifyuser', name: 'Apify User', followers_count: 5000 },
      favorite_count: 10,
      retweet_count: 2,
      reply_count: 1,
      quote_count: 0,
      entities: { hashtags: [], user_mentions: [] },
      created_at: 'Wed Feb 01 10:00:00 +0000 2024',
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).not.toBeNull();
    expect(result!.tweetId).toBe(TWEET_ID);
    expect(result!.tweetText).toBe('Hello from Apify!');
    expect(result!.authorHandle).toBe('apifyuser');
    expect(result!.authorName).toBe('Apify User');
    expect(result!.authorFollowers).toBe(5000);
    expect(result!.likeCount).toBe(10);
  });

  it('should start the actor with correct URL and parameters', async () => {
    mockSuccessfulRun({ full_text: 'Test' });

    await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    const [startUrl, startOptions] = mockFetch.mock.calls[0];
    expect(startUrl).toContain('/acts/apidojo~tweet-scraper/runs');
    expect(startUrl).toContain('token=test-apify-key-123');
    expect(startOptions.method).toBe('POST');
    expect(startOptions.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(startOptions.body);
    expect(body.startUrls).toEqual([TWEET_URL]);
    expect(body.maxItems).toBe(1);
  });

  it('should poll for completion when run is not immediately done', async () => {
    mockRunWithPolling({
      full_text: 'Polled tweet',
      user: { screen_name: 'polluser' },
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).not.toBeNull();
    expect(result!.tweetText).toBe('Polled tweet');
    // Should have made 4 calls: start + 2 polls + dataset fetch
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('should return null when actor start returns non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null when actor run fails', async () => {
    // Start: status RUNNING
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-fail', status: 'RUNNING', defaultDatasetId: 'ds-1' },
      }),
    });

    // Poll: status FAILED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-fail', status: 'FAILED', defaultDatasetId: 'ds-1' },
      }),
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null when actor run is aborted', async () => {
    // Start: status RUNNING
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-abort', status: 'RUNNING', defaultDatasetId: 'ds-2' },
      }),
    });

    // Poll: status ABORTED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-abort', status: 'ABORTED', defaultDatasetId: 'ds-2' },
      }),
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null when dataset fetch fails', async () => {
    // Start: immediately SUCCEEDED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-ok', status: 'SUCCEEDED', defaultDatasetId: 'ds-3' },
      }),
    });

    // Dataset fetch: HTTP error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null when dataset is empty', async () => {
    // Start: immediately SUCCEEDED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-empty', status: 'SUCCEEDED', defaultDatasetId: 'ds-4' },
      }),
    });

    // Dataset: empty array
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null when dataset item has noResults flag', async () => {
    // Start: immediately SUCCEEDED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-nores', status: 'SUCCEEDED', defaultDatasetId: 'ds-5' },
      }),
    });

    // Dataset: noResults sentinel
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ noResults: true }]),
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null when poll request fails', async () => {
    // Start: status RUNNING
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'run-pollfail', status: 'RUNNING', defaultDatasetId: 'ds-6' },
      }),
    });

    // Poll: HTTP error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null on network error during actor start', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
  });

  it('should return null when APIFY_API_KEY is not configured', async () => {
    // Override the config mock for this specific test
    const configModule = await import('../../../config/index.js');
    const originalKey = configModule.config.APIFY_API_KEY;
    (configModule.config as Record<string, unknown>).APIFY_API_KEY = undefined;

    const result = await fetchTweetViaApify(TWEET_ID, TWEET_URL);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();

    // Restore
    (configModule.config as Record<string, unknown>).APIFY_API_KEY = originalKey;
  });
});
