// ============================================================
// Article Extractor — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArticleExtractor, articleExtractor } from '../article.js';
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

function buildHtml(opts: {
  title?: string;
  h1?: string;
  metaDesc?: string;
  metaAuthor?: string;
  metaKeywords?: string;
  metaDate?: string;
  ogTitle?: string;
  ogDesc?: string;
  ogSiteName?: string;
  ogImage?: string;
  ogType?: string;
  ogPublishedTime?: string;
  ogSection?: string;
  ogTags?: string[];
  twitterTitle?: string;
  twitterDesc?: string;
  twitterImage?: string;
  twitterSite?: string;
  jsonLd?: object;
  body?: string;
  faviconHref?: string;
  paywallClass?: boolean;
  paywallMeta?: string;
  articleContentTier?: string;
} = {}): string {
  const head: string[] = [];

  if (opts.title !== undefined) head.push(`<title>${opts.title}</title>`);
  if (opts.metaDesc !== undefined) head.push(`<meta name="description" content="${opts.metaDesc}">`);
  if (opts.metaAuthor !== undefined) head.push(`<meta name="author" content="${opts.metaAuthor}">`);
  if (opts.metaKeywords !== undefined) head.push(`<meta name="keywords" content="${opts.metaKeywords}">`);
  if (opts.metaDate !== undefined) head.push(`<meta name="date" content="${opts.metaDate}">`);

  if (opts.ogTitle !== undefined) head.push(`<meta property="og:title" content="${opts.ogTitle}">`);
  if (opts.ogDesc !== undefined) head.push(`<meta property="og:description" content="${opts.ogDesc}">`);
  if (opts.ogSiteName !== undefined) head.push(`<meta property="og:site_name" content="${opts.ogSiteName}">`);
  if (opts.ogImage !== undefined) head.push(`<meta property="og:image" content="${opts.ogImage}">`);
  if (opts.ogType !== undefined) head.push(`<meta property="og:type" content="${opts.ogType}">`);
  if (opts.ogPublishedTime !== undefined) head.push(`<meta property="article:published_time" content="${opts.ogPublishedTime}">`);
  if (opts.ogSection !== undefined) head.push(`<meta property="article:section" content="${opts.ogSection}">`);
  for (const tag of opts.ogTags ?? []) head.push(`<meta property="article:tag" content="${tag}">`);

  if (opts.twitterTitle !== undefined) head.push(`<meta name="twitter:title" content="${opts.twitterTitle}">`);
  if (opts.twitterDesc !== undefined) head.push(`<meta name="twitter:description" content="${opts.twitterDesc}">`);
  if (opts.twitterImage !== undefined) head.push(`<meta name="twitter:image" content="${opts.twitterImage}">`);
  if (opts.twitterSite !== undefined) head.push(`<meta name="twitter:site" content="${opts.twitterSite}">`);

  if (opts.faviconHref !== undefined) head.push(`<link rel="icon" href="${opts.faviconHref}">`);
  if (opts.articleContentTier !== undefined) head.push(`<meta name="article:content_tier" content="${opts.articleContentTier}">`);

  if (opts.jsonLd !== undefined) {
    head.push(`<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`);
  }

  const bodyContent = opts.body ?? '';
  const paywallDiv = opts.paywallClass ? '<div class="paywall">Subscribe</div>' : '';

  return `<!DOCTYPE html><html><head>${head.join('')}</head><body>${bodyContent}${paywallDiv}</body></html>`;
}

// ============================================================
// canHandle
// ============================================================

describe('ArticleExtractor.canHandle', () => {
  it('returns true for any URL', () => {
    const extractor = new ArticleExtractor();
    expect(extractor.canHandle(new URL('https://example.com'))).toBe(true);
    expect(extractor.canHandle(new URL('https://youtube.com/watch?v=abc'))).toBe(true);
    expect(extractor.canHandle(new URL('https://github.com/owner/repo'))).toBe(true);
  });
});

// ============================================================
// Title extraction priority
// ============================================================

describe('ArticleExtractor — title extraction', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('uses JSON-LD headline first', async () => {
    const html = buildHtml({
      title: 'HTML Title',
      ogTitle: 'OG Title',
      jsonLd: { '@type': 'Article', headline: 'JSON-LD Headline' },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.title).toBe('JSON-LD Headline');
  });

  it('falls back to og:title when JSON-LD absent', async () => {
    const html = buildHtml({ title: 'HTML Title', ogTitle: 'OG Title' });
    const result = await extractor.extract(ctx, html);
    expect(result.title).toBe('OG Title');
  });

  it('falls back to <title> tag when no OG', async () => {
    const html = buildHtml({ title: 'HTML Title' });
    const result = await extractor.extract(ctx, html);
    expect(result.title).toBe('HTML Title');
  });

  it('falls back to h1 when no <title> tag', async () => {
    const html = buildHtml({ body: '<h1>The H1 Title</h1>' });
    const result = await extractor.extract(ctx, html);
    expect(result.title).toBe('The H1 Title');
  });

  it('returns Untitled when no title found', async () => {
    const result = await extractor.extract(ctx, '<html><body></body></html>');
    expect(result.title).toBe('Untitled');
  });
});

// ============================================================
// Description extraction
// ============================================================

describe('ArticleExtractor — description extraction', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('uses JSON-LD description first', async () => {
    const html = buildHtml({
      metaDesc: 'Meta desc',
      ogDesc: 'OG desc',
      jsonLd: { '@type': 'Article', headline: 'Title', description: 'JSON-LD desc' },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.description).toBe('JSON-LD desc');
  });

  it('uses og:description as fallback', async () => {
    const html = buildHtml({ metaDesc: 'Meta desc', ogDesc: 'OG desc' });
    const result = await extractor.extract(ctx, html);
    expect(result.description).toBe('OG desc');
  });

  it('uses meta description as further fallback', async () => {
    const html = buildHtml({ metaDesc: 'Meta desc' });
    const result = await extractor.extract(ctx, html);
    expect(result.description).toBe('Meta desc');
  });

  it('uses twitter:description when meta absent', async () => {
    const html = buildHtml({ twitterDesc: 'Twitter desc' });
    const result = await extractor.extract(ctx, html);
    expect(result.description).toBe('Twitter desc');
  });
});

// ============================================================
// Author extraction
// ============================================================

describe('ArticleExtractor — author extraction', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('uses JSON-LD author string', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'Article', headline: 'Title', author: 'Jane Doe' },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.author).toBe('Jane Doe');
  });

  it('uses JSON-LD author object with name', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'Article', headline: 'Title', author: { '@type': 'Person', name: 'John Smith' } },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.author).toBe('John Smith');
  });

  it('uses JSON-LD author array (first author)', async () => {
    const html = buildHtml({
      jsonLd: {
        '@type': 'Article',
        headline: 'Title',
        author: [{ '@type': 'Person', name: 'First Author' }, { '@type': 'Person', name: 'Second Author' }],
      },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.author).toBe('First Author');
  });

  it('falls back to article:author OG tag', async () => {
    const html = `<html><head>
      <meta property="article:author" content="OG Author">
    </head><body></body></html>`;
    const result = await extractor.extract(ctx, html);
    expect(result.author).toBe('OG Author');
  });

  it('falls back to meta[name=author]', async () => {
    const html = buildHtml({ metaAuthor: 'Meta Author' });
    const result = await extractor.extract(ctx, html);
    expect(result.author).toBe('Meta Author');
  });

  it('extracts author from .author byline', async () => {
    const html = buildHtml({ body: '<div class="author">Byline Author</div>' });
    const result = await extractor.extract(ctx, html);
    expect(result.author).toBe('Byline Author');
  });
});

// ============================================================
// Site name extraction
// ============================================================

describe('ArticleExtractor — site name', () => {
  const extractor = new ArticleExtractor();

  it('uses og:site_name when present', async () => {
    const html = buildHtml({ ogSiteName: 'My Blog' });
    const result = await extractor.extract(makeContext('https://myblog.com/post'), html);
    expect(result.siteName).toBe('My Blog');
  });

  it('falls back to hostname (strips www)', async () => {
    const html = buildHtml({});
    const result = await extractor.extract(makeContext('https://www.example.com/post'), html);
    expect(result.siteName).toBe('example.com');
  });
});

// ============================================================
// Image extraction
// ============================================================

describe('ArticleExtractor — image extraction', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('uses JSON-LD image string', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'Article', headline: 'Title', image: 'https://example.com/img.jpg' },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.image).toBe('https://example.com/img.jpg');
  });

  it('uses JSON-LD image object url', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'Article', headline: 'Title', image: { url: 'https://example.com/img2.jpg' } },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.image).toBe('https://example.com/img2.jpg');
  });

  it('uses og:image as fallback', async () => {
    const html = buildHtml({ ogImage: 'https://example.com/og.jpg' });
    const result = await extractor.extract(ctx, html);
    expect(result.image).toBe('https://example.com/og.jpg');
  });

  it('uses twitter:image as further fallback', async () => {
    const html = buildHtml({ twitterImage: 'https://example.com/tw.jpg' });
    const result = await extractor.extract(ctx, html);
    expect(result.image).toBe('https://example.com/tw.jpg');
  });

  it('resolves relative image from article content', async () => {
    const html = buildHtml({ body: '<article><img src="/images/photo.jpg" alt="photo"></article>' });
    const result = await extractor.extract(ctx, html);
    expect(result.image).toBe('https://example.com/images/photo.jpg');
  });
});

// ============================================================
// Favicon extraction
// ============================================================

describe('ArticleExtractor — favicon', () => {
  const extractor = new ArticleExtractor();

  it('returns favicon from <link rel="icon">', async () => {
    const html = buildHtml({ faviconHref: '/favicon.png' });
    const result = await extractor.extract(makeContext('https://example.com/post'), html);
    expect(result.favicon).toBe('https://example.com/favicon.png');
  });

  it('defaults to /favicon.ico when no link tag', async () => {
    const html = buildHtml({});
    const result = await extractor.extract(makeContext('https://example.com/post'), html);
    expect(result.favicon).toBe('https://example.com/favicon.ico');
  });

  it('resolves absolute favicon href as-is', async () => {
    const html = buildHtml({ faviconHref: 'https://cdn.example.com/favicon.png' });
    const result = await extractor.extract(makeContext('https://example.com/post'), html);
    expect(result.favicon).toBe('https://cdn.example.com/favicon.png');
  });
});

// ============================================================
// Published date extraction
// ============================================================

describe('ArticleExtractor — published date', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('uses JSON-LD datePublished first', async () => {
    const html = buildHtml({
      ogPublishedTime: '2024-01-01T00:00:00Z',
      jsonLd: { '@type': 'Article', headline: 'Title', datePublished: '2023-06-15' },
    });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { publishedDate: string | null };
    expect(fields.publishedDate).toBe('2023-06-15');
  });

  it('falls back to article:published_time OG tag', async () => {
    const html = buildHtml({ ogPublishedTime: '2024-02-20T12:00:00Z' });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { publishedDate: string | null };
    expect(fields.publishedDate).toBe('2024-02-20T12:00:00Z');
  });

  it('falls back to meta[name=date]', async () => {
    const html = buildHtml({ metaDate: '2024-03-10' });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { publishedDate: string | null };
    expect(fields.publishedDate).toBe('2024-03-10');
  });

  it('uses JSON-LD dateModified', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'Article', headline: 'Title', dateModified: '2024-04-01' },
    });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { modifiedDate: string | null };
    expect(fields.modifiedDate).toBe('2024-04-01');
  });
});

// ============================================================
// Tags / Keywords extraction
// ============================================================

describe('ArticleExtractor — tags extraction', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('extracts keywords from meta[name=keywords] as tags', async () => {
    const html = buildHtml({ metaKeywords: 'javascript, nodejs, testing' });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { tags: string[] };
    expect(fields.tags).toContain('javascript');
    expect(fields.tags).toContain('nodejs');
    expect(fields.tags).toContain('testing');
  });

  it('extracts article:tag OG properties', async () => {
    const html = buildHtml({ ogTags: ['React', 'TypeScript'] });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { tags: string[] };
    expect(fields.tags).toContain('React');
    expect(fields.tags).toContain('TypeScript');
  });

  it('extracts JSON-LD keywords string', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'Article', headline: 'Title', keywords: 'a, b, c' },
    });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { tags: string[] };
    expect(fields.tags).toContain('a');
    expect(fields.tags).toContain('b');
    expect(fields.tags).toContain('c');
  });

  it('deduplicates tags from multiple sources', async () => {
    const html = buildHtml({
      metaKeywords: 'React',
      ogTags: ['React', 'TypeScript'],
    });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { tags: string[] };
    const reactCount = fields.tags.filter(t => t === 'React').length;
    expect(reactCount).toBe(1);
  });
});

// ============================================================
// Paywall detection
// ============================================================

describe('ArticleExtractor — paywall detection', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('detects .paywall class', async () => {
    const html = buildHtml({ paywallClass: true });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { isPaywalled: boolean };
    expect(fields.isPaywalled).toBe(true);
  });

  it('detects article:content_tier=locked meta tag', async () => {
    const html = buildHtml({ articleContentTier: 'locked' });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { isPaywalled: boolean };
    expect(fields.isPaywalled).toBe(true);
  });

  it('detects article:content_tier=metered meta tag', async () => {
    const html = buildHtml({ articleContentTier: 'metered' });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { isPaywalled: boolean };
    expect(fields.isPaywalled).toBe(true);
  });

  it('detects JSON-LD isAccessibleForFree=false', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'Article', headline: 'Title', isAccessibleForFree: false },
    });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { isPaywalled: boolean };
    expect(fields.isPaywalled).toBe(true);
  });

  it('returns false for normal content', async () => {
    const html = buildHtml({ body: '<article><p>Free content here.</p></article>' });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { isPaywalled: boolean };
    expect(fields.isPaywalled).toBe(false);
  });
});

// ============================================================
// Content type detection
// ============================================================

describe('ArticleExtractor — content type detection', () => {
  const extractor = new ArticleExtractor();

  it('returns A (Article) by default', async () => {
    const html = buildHtml({ body: '<article><p>Content</p></article>' });
    const result = await extractor.extract(makeContext('https://example.com/post'), html);
    expect(result.contentType).toBe('A');
  });

  it('returns V for og:type=video.other', async () => {
    const html = buildHtml({ ogType: 'video.other' });
    const result = await extractor.extract(makeContext('https://example.com/video'), html);
    expect(result.contentType).toBe('V');
  });

  it('returns R for /research/ URL path', async () => {
    const html = buildHtml({});
    const result = await extractor.extract(makeContext('https://example.com/research/paper-123'), html);
    expect(result.contentType).toBe('R');
  });

  it('returns R for ScholarlyArticle JSON-LD type', async () => {
    const html = buildHtml({
      jsonLd: { '@type': 'ScholarlyArticle', headline: 'Research Paper' },
    });
    const result = await extractor.extract(makeContext('https://example.com/paper'), html);
    expect(result.contentType).toBe('R');
  });

  it('returns P for /podcast/ URL path', async () => {
    const html = buildHtml({});
    const result = await extractor.extract(makeContext('https://example.com/podcast/episode-5'), html);
    expect(result.contentType).toBe('P');
  });

  it('returns C for /course/ URL path', async () => {
    const html = buildHtml({});
    const result = await extractor.extract(makeContext('https://example.com/course/intro-to-ts'), html);
    expect(result.contentType).toBe('C');
  });

  it('returns V for page with only an embedded YouTube iframe', async () => {
    const html = buildHtml({
      body: '<iframe src="https://youtube.com/embed/abc"></iframe>',
    });
    const result = await extractor.extract(makeContext('https://example.com/media'), html);
    expect(result.contentType).toBe('V');
  });

  it('returns A for page with embedded video AND article content', async () => {
    const longContent = 'word '.repeat(120);
    const html = buildHtml({
      body: `<article>${longContent}</article><iframe src="https://youtube.com/embed/abc"></iframe>`,
    });
    const result = await extractor.extract(makeContext('https://example.com/post'), html);
    expect(result.contentType).toBe('A');
  });
});

// ============================================================
// Content and reading time
// ============================================================

describe('ArticleExtractor — content and reading time', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('extracts text content from <article>', async () => {
    const html = buildHtml({ body: '<article><p>Hello world content here.</p></article>' });
    const result = await extractor.extract(ctx, html);
    expect(result.content).toContain('Hello world content here');
  });

  it('calculates wordCount and readingTime', async () => {
    // 225 words → 1 minute reading time
    const words = Array.from({ length: 225 }, (_, i) => `word${i}`).join(' ');
    const html = buildHtml({ body: `<article><p>${words}</p></article>` });
    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as { wordCount: number; readingTime: number };
    expect(fields.wordCount).toBeGreaterThanOrEqual(225);
    expect(fields.readingTime).toBe(1);
  });

  it('removes scripts, styles, and nav from content', async () => {
    const html = buildHtml({
      body: '<article><p>Real content</p></article><nav>Navigation links</nav><script>alert(1)</script>',
    });
    const result = await extractor.extract(ctx, html);
    expect(result.content).not.toContain('Navigation links');
    expect(result.content).not.toContain('alert(1)');
  });

  it('truncates content to 5000 chars max', async () => {
    const longBody = 'word '.repeat(5000);
    const html = buildHtml({ body: `<article><p>${longBody}</p></article>` });
    const result = await extractor.extract(ctx, html);
    expect(result.content!.length).toBeLessThanOrEqual(5000);
  });
});

// ============================================================
// JSON-LD @graph support
// ============================================================

describe('ArticleExtractor — JSON-LD @graph', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/article');

  it('extracts article data from @graph array', async () => {
    const html = buildHtml({
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Test Site' },
          { '@type': 'Article', headline: 'Graph Article', author: { name: 'Graph Author' } },
        ],
      },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.title).toBe('Graph Article');
    expect(result.author).toBe('Graph Author');
  });
});

// ============================================================
// WebPage JSON-LD type
// ============================================================

describe('ArticleExtractor — WebPage JSON-LD', () => {
  const extractor = new ArticleExtractor();
  const ctx = makeContext('https://example.com/page');

  it('extracts title and description from WebPage type', async () => {
    const html = buildHtml({
      jsonLd: {
        '@type': 'WebPage',
        name: 'WebPage Title',
        description: 'WebPage description text',
      },
    });
    const result = await extractor.extract(ctx, html);
    expect(result.title).toBe('WebPage Title');
    expect(result.description).toBe('WebPage description text');
  });
});

// ============================================================
// Domain and metadata
// ============================================================

describe('ArticleExtractor — metadata', () => {
  const extractor = new ArticleExtractor();

  it('sets domain from URL hostname (strips www)', async () => {
    const html = buildHtml({});
    const result = await extractor.extract(makeContext('https://www.example.com/post'), html);
    expect(result.domain).toBe('example.com');
  });

  it('sets isSpecialized=false in metadata', async () => {
    const html = buildHtml({});
    const result = await extractor.extract(makeContext('https://example.com'), html);
    expect(result.metadata.isSpecialized).toBe(false);
    expect(result.metadata.extractorName).toBe('article');
  });
});

// ============================================================
// Singleton export
// ============================================================

describe('articleExtractor singleton', () => {
  it('is an instance of ArticleExtractor', () => {
    expect(articleExtractor).toBeInstanceOf(ArticleExtractor);
  });

  it('has priority 0 (lowest)', () => {
    expect(articleExtractor.priority).toBe(0);
  });
});
