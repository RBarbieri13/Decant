// ============================================================
// YouTube Extractor — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YouTubeExtractor, youtubeExtractor } from '../youtube.js';
import type { ExtractionContext } from '../base.js';

// Suppress logger output
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

// ============================================================
// Helpers
// ============================================================

function makeContext(url: string): ExtractionContext {
  const parsed = new URL(url);
  return {
    originalUrl: url,
    normalizedUrl: url,
    url: parsed,
  };
}

function buildVideoHtml(opts: {
  ogTitle?: string;
  ogDesc?: string;
  ogImage?: string;
  channelName?: string;
  channelUrl?: string;
  duration?: string;      // ISO 8601 e.g. PT1H2M3S
  genre?: string;
  viewCount?: number;
  isLive?: boolean;
} = {}): string {
  const metaTags: string[] = [];

  if (opts.ogTitle !== undefined)
    metaTags.push(`<meta property="og:title" content="${opts.ogTitle}">`);
  if (opts.ogDesc !== undefined)
    metaTags.push(`<meta property="og:description" content="${opts.ogDesc}">`);
  if (opts.ogImage !== undefined)
    metaTags.push(`<meta property="og:image" content="${opts.ogImage}">`);
  if (opts.genre !== undefined)
    metaTags.push(`<meta itemprop="genre" content="${opts.genre}">`);

  const channelHtml = opts.channelName !== undefined
    ? `<span itemprop="author"><link itemprop="name" content="${opts.channelName}"><link itemprop="url" href="${opts.channelUrl ?? '/channel/UC123'}"></span>`
    : '';

  const durationHtml = opts.duration !== undefined
    ? `<meta itemprop="duration" content="${opts.duration}">`
    : '';

  // Build JSON-LD VideoObject
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: opts.ogTitle ?? 'Test Video',
    ...(opts.duration ? { duration: opts.duration } : {}),
    ...(opts.viewCount !== undefined
      ? {
          interactionStatistic: [{
            '@type': 'InteractionCounter',
            interactionType: { '@type': 'WatchAction' },
            userInteractionCount: opts.viewCount,
          }],
        }
      : {}),
  };

  return `<!DOCTYPE html><html><head>
    ${metaTags.join('\n')}
    ${durationHtml}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head><body>
    ${channelHtml}
  </body></html>`;
}

// ============================================================
// canHandle
// ============================================================

describe('YouTubeExtractor.canHandle', () => {
  const extractor = new YouTubeExtractor();

  const validUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
  ];

  it.each(validUrls)('handles %s', (url) => {
    expect(extractor.canHandle(new URL(url))).toBe(true);
  });

  const invalidUrls = [
    'https://vimeo.com/123456',
    'https://example.com/video',
    'https://dailymotion.com/video/xyz',
  ];

  it.each(invalidUrls)('rejects %s', (url) => {
    expect(extractor.canHandle(new URL(url))).toBe(false);
  });
});

// ============================================================
// Video ID extraction (via extract)
// ============================================================

describe('YouTubeExtractor — video ID and basic fields', () => {
  const extractor = new YouTubeExtractor();

  it('extracts standard watch URL video ID', async () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const html = buildVideoHtml({ ogTitle: 'Never Gonna Give You Up', ogDesc: 'Classic.' });
    const result = await extractor.extract(makeContext(url), html);

    expect(result.title).toBe('Never Gonna Give You Up');
    expect(result.description).toBe('Classic.');
    expect(result.contentType).toBe('V');
    expect(result.siteName).toBe('YouTube');
    expect(result.favicon).toBe('https://www.youtube.com/favicon.ico');

    const fields = result.extractedFields as Record<string, unknown>;
    expect(fields.videoId).toBe('dQw4w9WgXcQ');
    expect(fields.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(fields.thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  });

  it('extracts youtu.be short URL video ID', async () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    const html = buildVideoHtml({ ogTitle: 'Short link video' });
    const result = await extractor.extract(makeContext(url), html);

    const fields = result.extractedFields as Record<string, unknown>;
    expect(fields.videoId).toBe('dQw4w9WgXcQ');
  });

  it('extracts /embed/ URL video ID', async () => {
    const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    const html = buildVideoHtml({ ogTitle: 'Embedded video' });
    const result = await extractor.extract(makeContext(url), html);

    const fields = result.extractedFields as Record<string, unknown>;
    expect(fields.videoId).toBe('dQw4w9WgXcQ');
  });

  it('extracts /shorts/ URL video ID', async () => {
    const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
    const html = buildVideoHtml({ ogTitle: 'YouTube Short' });
    const result = await extractor.extract(makeContext(url), html);

    const fields = result.extractedFields as Record<string, unknown>;
    expect(fields.videoId).toBe('dQw4w9WgXcQ');
  });
});

// ============================================================
// Channel metadata
// ============================================================

describe('YouTubeExtractor — channel metadata', () => {
  const extractor = new YouTubeExtractor();

  it('extracts channel name from itemprop', async () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const html = buildVideoHtml({
      ogTitle: 'A great video',
      channelName: 'RickAstleyVEVO',
      channelUrl: 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
    });

    const result = await extractor.extract(makeContext(url), html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.channelName).toBe('RickAstleyVEVO');
    expect(result.author).toBe('RickAstleyVEVO');
  });
});

// ============================================================
// Duration parsing from JSON-LD
// ============================================================

describe('YouTubeExtractor — duration parsing', () => {
  const extractor = new YouTubeExtractor();

  it('parses ISO 8601 duration from JSON-LD', async () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const html = buildVideoHtml({ duration: 'PT3M32S' });

    const result = await extractor.extract(makeContext(url), html);
    const fields = result.extractedFields as Record<string, unknown>;

    // 3*60+32 = 212 seconds
    expect(fields.duration).toBe(212);
    expect(fields.durationFormatted).toBe('3:32');
  });

  it('parses duration with hours', async () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const html = buildVideoHtml({ duration: 'PT1H2M3S' });

    const result = await extractor.extract(makeContext(url), html);
    const fields = result.extractedFields as Record<string, unknown>;

    // 1*3600+2*60+3 = 3723 seconds
    expect(fields.duration).toBe(3723);
    expect(fields.durationFormatted).toBe('1:02:03');
  });
});

// ============================================================
// Category
// ============================================================

describe('YouTubeExtractor — category', () => {
  const extractor = new YouTubeExtractor();

  it('extracts genre/category from itemprop meta', async () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const html = buildVideoHtml({ genre: 'Music' });

    const result = await extractor.extract(makeContext(url), html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.category).toBe('Music');
  });
});

// ============================================================
// Non-video pages (channels, playlists)
// ============================================================

describe('YouTubeExtractor — non-video pages', () => {
  const extractor = new YouTubeExtractor();

  it('handles channel URL gracefully without a video ID', async () => {
    const url = 'https://www.youtube.com/@RickAstleyVEVO';
    // og:title is returned as-is (suffix stripping only applies to <title> tags)
    const html = `<html><head>
      <meta property="og:title" content="RickAstleyVEVO - YouTube">
    </head><body></body></html>`;

    const result = await extractor.extract(makeContext(url), html);

    expect(result.title).toBe('RickAstleyVEVO - YouTube');
    expect(result.siteName).toBe('YouTube');
    expect(result.metadata.notes).toContain('Could not extract video ID');
  });

  it('handles playlist URL without crashing', async () => {
    const url = 'https://www.youtube.com/playlist?list=PLabcdef12345';
    const html = `<html><head>
      <meta property="og:title" content="My Playlist">
    </head><body></body></html>`;

    const result = await extractor.extract(makeContext(url), html);

    expect(result.title).toBe('My Playlist');
  });
});

// ============================================================
// Missing / invalid video ID
// ============================================================

describe('YouTubeExtractor — invalid or missing video ID', () => {
  const extractor = new YouTubeExtractor();

  it('falls back gracefully when no video ID in URL', async () => {
    const url = 'https://www.youtube.com/about';
    const html = `<html><head>
      <title>About YouTube</title>
    </head><body></body></html>`;

    const result = await extractor.extract(makeContext(url), html);

    expect(result.metadata.notes).toContain('Could not extract video ID');
  });
});

// ============================================================
// Singleton export
// ============================================================

describe('youtubeExtractor singleton', () => {
  it('is a YouTubeExtractor instance', () => {
    expect(youtubeExtractor).toBeInstanceOf(YouTubeExtractor);
  });

  it('has correct name and priority', () => {
    expect(youtubeExtractor.name).toBe('youtube');
    expect(youtubeExtractor.priority).toBe(100);
  });
});
