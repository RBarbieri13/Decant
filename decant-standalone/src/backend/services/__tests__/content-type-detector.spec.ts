// ============================================================
// Content Type Detector — Unit Tests
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import {
  detectContentType,
  quickDetectContentType,
  isSpecializedDomain,
  getExpectedContentType,
} from '../content-type-detector.js';

// Suppress logger output
vi.mock('../../logger/index.js', () => ({
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
// detectContentType — domain-based detection
// ============================================================

describe('detectContentType — domain detection', () => {
  it('detects YouTube as Video (V)', () => {
    const result = detectContentType('https://www.youtube.com/watch?v=abc123');
    expect(result.contentType).toBe('V');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('domain');
  });

  it('detects youtu.be short URL as Video (V)', () => {
    const result = detectContentType('https://youtu.be/abc123');
    expect(result.contentType).toBe('V');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('domain');
  });

  it('detects GitHub as Code Repo (G)', () => {
    const result = detectContentType('https://github.com/user/repo');
    expect(result.contentType).toBe('G');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('domain');
  });

  it('detects GitLab as Code Repo (G)', () => {
    const result = detectContentType('https://gitlab.com/user/project');
    expect(result.contentType).toBe('G');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('domain');
  });

  it('detects Twitter/X as Social (S)', () => {
    const result = detectContentType('https://twitter.com/user/status/123');
    expect(result.contentType).toBe('S');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('domain');
  });

  it('detects x.com as Social (S)', () => {
    const result = detectContentType('https://x.com/user/status/123');
    expect(result.contentType).toBe('S');
    expect(result.confidence).toBe('high');
  });

  it('detects Reddit as Social (S)', () => {
    const result = detectContentType('https://reddit.com/r/programming/comments/abc/title');
    expect(result.contentType).toBe('S');
    expect(result.confidence).toBe('high');
  });

  it('detects arxiv.org as Research (R)', () => {
    const result = detectContentType('https://arxiv.org/abs/2301.12345');
    expect(result.contentType).toBe('R');
    expect(result.confidence).toBe('high');
  });

  it('detects Spotify as Podcast (P)', () => {
    const result = detectContentType('https://open.spotify.com/episode/abc');
    expect(result.contentType).toBe('P');
    expect(result.confidence).toBe('high');
  });

  it('detects Udemy as Course (C)', () => {
    const result = detectContentType('https://www.udemy.com/course/javascript-basics/');
    expect(result.contentType).toBe('C');
    expect(result.confidence).toBe('high');
  });

  it('detects Substack as Newsletter (N)', () => {
    const result = detectContentType('https://someauthor.substack.com/p/article-title');
    expect(result.contentType).toBe('N');
    expect(result.confidence).toBe('high');
  });

  it('detects Dribbble as Image/Design (I)', () => {
    const result = detectContentType('https://dribbble.com/shots/12345-cool-design');
    expect(result.contentType).toBe('I');
    expect(result.confidence).toBe('high');
  });

  it('detects Goodreads as Book (K)', () => {
    const result = detectContentType('https://www.goodreads.com/book/show/123-title');
    expect(result.contentType).toBe('K');
    expect(result.confidence).toBe('high');
  });

  it('detects SoundCloud as Audio (U)', () => {
    const result = detectContentType('https://soundcloud.com/artist/track');
    expect(result.contentType).toBe('U');
    expect(result.confidence).toBe('high');
  });

  it('detects known tool domain as Tool (T)', () => {
    const result = detectContentType('https://vercel.com/dashboard');
    expect(result.contentType).toBe('T');
    expect(result.confidence).toBe('high');
  });

  it('detects Notion as Tool (T)', () => {
    const result = detectContentType('https://notion.so/workspace/page');
    expect(result.contentType).toBe('T');
    expect(result.confidence).toBe('high');
  });

  it('handles URL object input', () => {
    const url = new URL('https://github.com/user/repo');
    const result = detectContentType(url);
    expect(result.contentType).toBe('G');
  });

  it('strips www. prefix when matching domains', () => {
    const result = detectContentType('https://www.github.com/user/repo');
    expect(result.contentType).toBe('G');
    expect(result.confidence).toBe('high');
  });

  it('matches subdomain of known domain (e.g. gist.github.com)', () => {
    const result = detectContentType('https://gist.github.com/user/abc123');
    expect(result.contentType).toBe('G');
    expect(result.confidence).toBe('high');
  });
});

// ============================================================
// detectContentType — path-based detection
// ============================================================

describe('detectContentType — path detection (unknown domain)', () => {
  it('detects /blog/ path as Article (A)', () => {
    const result = detectContentType('https://unknown-site.com/blog/my-post');
    expect(result.contentType).toBe('A');
    expect(result.source).toBe('path');
    expect(result.confidence).toBe('medium');
  });

  it('detects /course/ path as Course (C)', () => {
    const result = detectContentType('https://unknown-site.com/course/advanced-ts');
    expect(result.contentType).toBe('C');
    expect(result.source).toBe('path');
    expect(result.confidence).toBe('medium');
  });

  it('detects /podcast/ path as Podcast (P)', () => {
    const result = detectContentType('https://unknown-site.com/podcast/episode-42');
    expect(result.contentType).toBe('P');
    expect(result.source).toBe('path');
    expect(result.confidence).toBe('medium');
  });

  it('detects .pdf extension as Research (R)', () => {
    const result = detectContentType('https://unknown-site.com/whitepaper/report.pdf');
    expect(result.contentType).toBe('R');
    expect(result.source).toBe('path');
  });

  it('detects /watch path as Video (V)', () => {
    const result = detectContentType('https://someplatform.com/watch?v=abc');
    expect(result.contentType).toBe('V');
    expect(result.source).toBe('path');
  });

  it('detects /pull/123 path as Code (G)', () => {
    const result = detectContentType('https://codeberg.org/user/repo/pull/42');
    // codeberg.org is in domain list → high confidence G
    expect(result.contentType).toBe('G');
  });

  it('detects /issues/123 on unknown domain as Code (G)', () => {
    const result = detectContentType('https://unknown-git.com/repo/issues/5');
    expect(result.contentType).toBe('G');
    expect(result.source).toBe('path');
  });

  it('detects /status/123 on unknown domain as Social (S)', () => {
    const result = detectContentType('https://unknown-social.com/user/status/12345678');
    expect(result.contentType).toBe('S');
    expect(result.source).toBe('path');
  });

  it('detects /abs/1234 path as Research (R) for arXiv-style', () => {
    const result = detectContentType('https://unknown-site.com/abs/2301.12345');
    expect(result.contentType).toBe('R');
    expect(result.source).toBe('path');
  });

  it('detects /research/ path as Research (R)', () => {
    const result = detectContentType('https://unknown-site.com/research/new-paper');
    expect(result.contentType).toBe('R');
    expect(result.source).toBe('path');
  });
});

// ============================================================
// detectContentType — metadata/HTML detection
// ============================================================

describe('detectContentType — metadata detection', () => {
  it('detects og:type video as Video (V)', () => {
    const html = `<html><head><meta property="og:type" content="video.movie"/></head></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('V');
    expect(result.source).toBe('metadata');
    expect(result.confidence).toBe('medium');
  });

  it('detects og:type article as Article (A)', () => {
    const html = `<html><head><meta property="og:type" content="article"/></head></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('A');
    expect(result.source).toBe('metadata');
  });

  it('detects og:type book as Book (K)', () => {
    const html = `<html><head><meta property="og:type" content="book"/></head></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('K');
    expect(result.source).toBe('metadata');
  });

  it('detects og:type music as Audio (U)', () => {
    const html = `<html><head><meta property="og:type" content="music.song"/></head></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('U');
    expect(result.source).toBe('metadata');
  });

  it('detects JSON-LD VideoObject as Video (V)', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type": "VideoObject", "name": "My Video"}
        </script>
      </head></html>
    `;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('V');
    expect(result.source).toBe('metadata');
  });

  it('detects JSON-LD Article as Article (A)', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type": "NewsArticle", "headline": "Breaking News"}
        </script>
      </head></html>
    `;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('A');
    expect(result.source).toBe('metadata');
  });

  it('detects JSON-LD Course as Course (C)', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type": "Course", "name": "Learn TypeScript"}
        </script>
      </head></html>
    `;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('C');
    expect(result.source).toBe('metadata');
  });

  it('detects JSON-LD Book as Book (K)', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type": "Book", "name": "The Pragmatic Programmer"}
        </script>
      </head></html>
    `;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('K');
    expect(result.source).toBe('metadata');
  });

  it('handles JSON-LD @graph array', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@graph": [{"@type": "PodcastEpisode", "name": "Episode 1"}]}
        </script>
      </head></html>
    `;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('P');
    expect(result.source).toBe('metadata');
  });

  it('handles malformed JSON-LD gracefully (no throw)', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{ this is not json }</script>
      </head></html>
    `;
    expect(() => detectContentType('https://unknown-site.com/page', html)).not.toThrow();
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.source).toBe('fallback');
  });
});

// ============================================================
// detectContentType — content-based detection
// ============================================================

describe('detectContentType — content detection', () => {
  it('detects video element with no substantial text as Video (V)', () => {
    const html = `<html><body><video src="clip.mp4"></video><p>Short.</p></body></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('V');
    expect(result.source).toBe('content');
  });

  it('detects YouTube iframe embed as Video (V)', () => {
    const html = `<html><body><iframe src="https://www.youtube.com/embed/abc"></iframe><p>Short.</p></body></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('V');
    expect(result.source).toBe('content');
  });

  it('detects audio element as Podcast (P)', () => {
    const html = `<html><body><audio src="episode.mp3"></audio><main>${'x'.repeat(600)}</main></body></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    expect(result.contentType).toBe('P');
    expect(result.source).toBe('content');
  });

  it('does NOT use video heuristic if page has substantial text content', () => {
    const longText = 'word '.repeat(200); // > 500 chars
    const html = `<html><body><video src="clip.mp4"></video><article>${longText}</article></body></html>`;
    const result = detectContentType('https://unknown-site.com/page', html);
    // Substantial content blocks the video heuristic → falls through to fallback
    expect(result.contentType).toBe('A'); // fallback
    expect(result.source).toBe('fallback');
  });
});

// ============================================================
// detectContentType — fallback
// ============================================================

describe('detectContentType — fallback', () => {
  it('returns Article (A) with low confidence for completely unknown URL', () => {
    const result = detectContentType('https://completely-unknown-site-xyz.io/some/random/path');
    expect(result.contentType).toBe('A');
    expect(result.confidence).toBe('low');
    expect(result.source).toBe('fallback');
  });

  it('returns Article fallback even with empty HTML', () => {
    const result = detectContentType('https://unknown.io/page', '<html></html>');
    expect(result.contentType).toBe('A');
    expect(result.source).toBe('fallback');
  });
});

// ============================================================
// quickDetectContentType
// ============================================================

describe('quickDetectContentType', () => {
  it('returns G for GitHub URL', () => {
    expect(quickDetectContentType('https://github.com/user/repo')).toBe('G');
  });

  it('returns V for YouTube URL', () => {
    expect(quickDetectContentType('https://www.youtube.com/watch?v=abc')).toBe('V');
  });

  it('returns A (fallback) for unknown domain without path match', () => {
    expect(quickDetectContentType('https://random-site.io/home')).toBe('A');
  });

  it('returns C for /course/ path on unknown domain', () => {
    expect(quickDetectContentType('https://unknown.io/course/intro-to-rust')).toBe('C');
  });

  it('accepts URL object', () => {
    const url = new URL('https://reddit.com/r/tech');
    expect(quickDetectContentType(url)).toBe('S');
  });
});

// ============================================================
// isSpecializedDomain
// ============================================================

describe('isSpecializedDomain', () => {
  it('returns true for YouTube', () => {
    expect(isSpecializedDomain('https://www.youtube.com/watch?v=1')).toBe(true);
  });

  it('returns true for GitHub', () => {
    expect(isSpecializedDomain('https://github.com/user/repo')).toBe(true);
  });

  it('returns true for a tool domain (Notion)', () => {
    expect(isSpecializedDomain('https://notion.so/page')).toBe(true);
  });

  it('returns false for a random unknown domain', () => {
    expect(isSpecializedDomain('https://my-personal-blog.io/post')).toBe(false);
  });

  it('returns true for subdomain of known domain', () => {
    expect(isSpecializedDomain('https://gist.github.com/user/abc')).toBe(true);
  });

  it('accepts URL object', () => {
    expect(isSpecializedDomain(new URL('https://arxiv.org/abs/1234'))).toBe(true);
  });
});

// ============================================================
// getExpectedContentType
// ============================================================

describe('getExpectedContentType', () => {
  it('returns V for youtube.com', () => {
    expect(getExpectedContentType('youtube.com')).toBe('V');
  });

  it('returns G for github.com', () => {
    expect(getExpectedContentType('github.com')).toBe('G');
  });

  it('returns S for twitter.com', () => {
    expect(getExpectedContentType('twitter.com')).toBe('S');
  });

  it('returns R for arxiv.org', () => {
    expect(getExpectedContentType('arxiv.org')).toBe('R');
  });

  it('returns null for unknown domain', () => {
    expect(getExpectedContentType('some-unknown-site.io')).toBeNull();
  });

  it('handles www. prefix', () => {
    // detectFromDomain normalizes, so www.github.com should still resolve
    expect(getExpectedContentType('www.github.com')).toBe('G');
  });
});
