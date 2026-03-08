// ============================================================
// GitHub Extractor — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubExtractor, githubExtractor } from '../github.js';
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

function buildHtml(overrides: {
  ogTitle?: string;
  ogDesc?: string;
  ogImage?: string;
  starsTitle?: string;
  forksTitle?: string;
  language?: string;
  topics?: string[];
  license?: string;
  issueTitle?: string;
  issueBody?: string;
  prTitle?: string;
  prBody?: string;
  authorLogin?: string;
  gistDesc?: string;
  displayName?: string;
  bio?: string;
} = {}): string {
  const metaTags: string[] = [];

  if (overrides.ogTitle !== undefined)
    metaTags.push(`<meta property="og:title" content="${overrides.ogTitle}">`);
  if (overrides.ogDesc !== undefined)
    metaTags.push(`<meta property="og:description" content="${overrides.ogDesc}">`);
  if (overrides.ogImage !== undefined)
    metaTags.push(`<meta property="og:image" content="${overrides.ogImage}">`);

  const starHtml = overrides.starsTitle !== undefined
    ? `<a href="/owner/repo/stargazers"><span class="Counter" title="${overrides.starsTitle}"></span></a>`
    : '';

  const forkHtml = overrides.forksTitle !== undefined
    ? `<a href="/owner/repo/forks"><span class="Counter" title="${overrides.forksTitle}"></span></a>`
    : '';

  const langHtml = overrides.language !== undefined
    ? `<span itemprop="programmingLanguage">${overrides.language}</span>`
    : '';

  const topicHtml = (overrides.topics ?? [])
    .map(t => `<a data-octo-click="topic_click">${t}</a>`)
    .join('\n');

  const licenseHtml = overrides.license !== undefined
    ? `<a href="/owner/repo/blob/main/LICENSE">${overrides.license}</a>`
    : '';

  const issueTitleHtml = overrides.issueTitle !== undefined
    ? `<bdi class="js-issue-title">${overrides.issueTitle}</bdi>`
    : '';

  const issueBodyHtml = overrides.issueBody !== undefined
    ? `<div class="js-comment-body">${overrides.issueBody}</div>`
    : '';

  const authorHtml = overrides.authorLogin !== undefined
    ? `<a class="author">${overrides.authorLogin}</a>`
    : '';

  const gistDescHtml = overrides.gistDesc !== undefined
    ? `<meta property="og:description" content="${overrides.gistDesc}">`
    : '';

  const displayNameHtml = overrides.displayName !== undefined
    ? `<span class="p-name">${overrides.displayName}</span>`
    : '';

  const bioHtml = overrides.bio !== undefined
    ? `<div class="p-note">${overrides.bio}</div>`
    : '';

  return `<!DOCTYPE html><html><head>
    ${metaTags.join('\n')}
    ${gistDescHtml}
  </head><body>
    ${starHtml}
    ${forkHtml}
    ${langHtml}
    ${topicHtml}
    ${licenseHtml}
    ${issueTitleHtml}
    ${issueBodyHtml}
    ${authorHtml}
    ${displayNameHtml}
    ${bioHtml}
  </body></html>`;
}

// ============================================================
// canHandle
// ============================================================

describe('GitHubExtractor.canHandle', () => {
  const extractor = new GitHubExtractor();

  it('handles github.com', () => {
    expect(extractor.canHandle(new URL('https://github.com/owner/repo'))).toBe(true);
  });

  it('handles www.github.com', () => {
    expect(extractor.canHandle(new URL('https://www.github.com/owner/repo'))).toBe(true);
  });

  it('handles gist.github.com', () => {
    expect(extractor.canHandle(new URL('https://gist.github.com/user/abc123'))).toBe(true);
  });

  it('does not handle other domains', () => {
    expect(extractor.canHandle(new URL('https://gitlab.com/owner/repo'))).toBe(false);
    expect(extractor.canHandle(new URL('https://bitbucket.org/owner/repo'))).toBe(false);
    expect(extractor.canHandle(new URL('https://example.com'))).toBe(false);
  });
});

// ============================================================
// Repository extraction
// ============================================================

describe('GitHubExtractor — repository', () => {
  const extractor = new GitHubExtractor();

  it('extracts repository title and description from og tags', async () => {
    const ctx = makeContext('https://github.com/owner/my-repo');
    const html = buildHtml({
      ogTitle: 'owner/my-repo',
      ogDesc: 'A cool repository',
      ogImage: 'https://opengraph.githubassets.com/img.png',
    });

    const result = await extractor.extract(ctx, html);

    expect(result.title).toBe('owner/my-repo');
    expect(result.description).toBe('A cool repository');
    expect(result.image).toBe('https://opengraph.githubassets.com/img.png');
    expect(result.contentType).toBe('G');
    expect(result.siteName).toBe('GitHub');
    expect(result.author).toBe('owner');
  });

  it('extracts star count from Counter title attribute', async () => {
    const ctx = makeContext('https://github.com/owner/repo');
    const html = buildHtml({ starsTitle: '1,234' });

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.stars).toBe(1234);
  });

  it('extracts fork count from Counter title attribute', async () => {
    const ctx = makeContext('https://github.com/owner/repo');
    const html = buildHtml({ forksTitle: '567' });

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.forks).toBe(567);
  });

  it('extracts primary language via itemprop', async () => {
    const ctx = makeContext('https://github.com/owner/repo');
    const html = buildHtml({ language: 'TypeScript' });

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.language).toBe('TypeScript');
  });

  it('extracts topics', async () => {
    const ctx = makeContext('https://github.com/owner/repo');
    const html = buildHtml({ topics: ['react', 'typescript', 'open-source'] });

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.topics).toEqual(['react', 'typescript', 'open-source']);
  });

  it('sets fullName correctly', async () => {
    const ctx = makeContext('https://github.com/myorg/myproject');
    const html = buildHtml({ ogTitle: 'myorg/myproject' });

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.owner).toBe('myorg');
    expect(fields.repoName).toBe('myproject');
    expect(fields.fullName).toBe('myorg/myproject');
    expect(fields.resourceType).toBe('repository');
  });

  it('falls back to GitHub Repository title when og:title is absent', async () => {
    const ctx = makeContext('https://github.com/owner/repo');
    const html = buildHtml(); // no og:title

    const result = await extractor.extract(ctx, html);

    expect(result.title).toBe('GitHub - owner/repo');
    expect(result.contentType).toBe('G');
  });
});

// ============================================================
// Issue extraction
// ============================================================

describe('GitHubExtractor — issue', () => {
  const extractor = new GitHubExtractor();

  it('extracts issue title and includes repo context', async () => {
    const ctx = makeContext('https://github.com/owner/repo/issues/42');
    // Author requires .js-issue-header-byline wrapper; omit to keep test focused on title
    const html = buildHtml({
      issueTitle: 'Fix the bug',
      issueBody: 'This bug causes a crash when the user clicks the button.',
    });

    const result = await extractor.extract(ctx, html);

    expect(result.title).toContain('Fix the bug');
    expect(result.title).toContain('owner/repo');
    expect(result.contentType).toBe('A');
    expect(result.siteName).toBe('GitHub');
  });

  it('extracts issue author when inside .js-issue-header-byline', async () => {
    const ctx = makeContext('https://github.com/owner/repo/issues/42');
    const html = `<html><body>
      <bdi class="js-issue-title">Issue Title</bdi>
      <span class="js-issue-header-byline"><a class="author">bugreporter</a></span>
    </body></html>`;

    const result = await extractor.extract(ctx, html);
    expect(result.author).toBe('bugreporter');
  });

  it('falls back to Issue #N title if .js-issue-title absent', async () => {
    const ctx = makeContext('https://github.com/owner/repo/issues/99');
    const html = buildHtml({});

    const result = await extractor.extract(ctx, html);

    expect(result.title).toContain('Issue #99');
  });

  it('sets resourceType to issue and issueNumber correctly', async () => {
    const ctx = makeContext('https://github.com/owner/repo/issues/7');
    const html = buildHtml({ issueTitle: 'Small issue' });

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.resourceType).toBe('issue');
    expect(fields.issueNumber).toBe(7);
  });
});

// ============================================================
// Pull request extraction
// ============================================================

describe('GitHubExtractor — pull request', () => {
  const extractor = new GitHubExtractor();

  it('extracts PR title and includes repo context', async () => {
    const ctx = makeContext('https://github.com/owner/repo/pull/101');
    const html = buildHtml({
      issueTitle: 'Add new feature',
      issueBody: 'This PR adds the feature.',
      authorLogin: 'contributor',
    });

    const result = await extractor.extract(ctx, html);

    expect(result.title).toContain('Add new feature');
    expect(result.title).toContain('owner/repo');
    expect(result.contentType).toBe('A');
  });

  it('falls back to Pull Request #N title if element absent', async () => {
    const ctx = makeContext('https://github.com/owner/repo/pull/55');
    const html = buildHtml({});

    const result = await extractor.extract(ctx, html);

    expect(result.title).toContain('Pull Request #55');
  });

  it('sets resourceType to pull_request and pullRequestNumber', async () => {
    const ctx = makeContext('https://github.com/owner/repo/pull/23');
    const html = buildHtml({ issueTitle: 'My PR' });

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(fields.resourceType).toBe('pull_request');
    expect(fields.pullRequestNumber).toBe(23);
  });
});

// ============================================================
// User / organization extraction
// ============================================================

describe('GitHubExtractor — user profile', () => {
  const extractor = new GitHubExtractor();

  it('extracts display name and bio', async () => {
    const ctx = makeContext('https://github.com/somedev');
    const html = buildHtml({
      displayName: 'Some Developer',
      bio: 'I write code for fun.',
    });

    const result = await extractor.extract(ctx, html);

    expect(result.title).toBe('Some Developer');
    expect(result.description).toContain('write code');
    expect(result.contentType).toBe('T');
  });

  it('falls back to username in title when displayName absent', async () => {
    const ctx = makeContext('https://github.com/somedev');
    const html = buildHtml({}); // no p-name

    const result = await extractor.extract(ctx, html);

    // Falls back to pathInfo.owner
    expect(result.title).toBe('somedev');
  });
});

// ============================================================
// Gist extraction
// ============================================================

describe('GitHubExtractor — gist', () => {
  const extractor = new GitHubExtractor();

  it('extracts gist description and author', async () => {
    const ctx = makeContext('https://gist.github.com/user/abc1234');
    const html = buildHtml({ gistDesc: 'A handy script for parsing JSON' });

    const result = await extractor.extract(ctx, html);

    expect(result.title).toContain('A handy script');
    expect(result.author).toBe('user');
    expect(result.siteName).toBe('GitHub Gist');
    expect(result.contentType).toBe('G');
  });

  it('falls back to GitHub Gist title when no description', async () => {
    const ctx = makeContext('https://gist.github.com/user/abc1234');
    const html = buildHtml({});

    const result = await extractor.extract(ctx, html);

    expect(result.title).toBe('GitHub Gist');
  });
});

// ============================================================
// URL path routing (resourceType detection)
// ============================================================

describe('GitHubExtractor — URL path routing', () => {
  const extractor = new GitHubExtractor();

  // Note: for user profiles, HTML extraction overrides resourceType to 'user' or
  // 'organization' based on meta[property="profile:username"]. Without that meta
  // the extractor defaults to 'organization'. We only assert contentType here.
  const cases: Array<[string, string, string | null]> = [
    ['https://github.com/owner/repo', 'G', 'repository'],
    ['https://github.com/owner/repo/tree/main', 'G', 'repository'],
    ['https://github.com/owner/repo/blob/main/file.ts', 'G', 'repository'],
    ['https://github.com/owner/repo/releases', 'G', 'repository'],
    ['https://github.com/owner/repo/issues/1', 'A', 'issue'],
    ['https://github.com/owner/repo/pull/1', 'A', 'pull_request'],
    ['https://github.com/owner', 'T', null], // resourceType overridden by HTML extraction
  ];

  it.each(cases)('%s → contentType=%s', async (url, expectedContentType, expectedResourceType) => {
    const ctx = makeContext(url);
    const html = buildHtml({});

    const result = await extractor.extract(ctx, html);
    const fields = result.extractedFields as Record<string, unknown>;

    expect(result.contentType).toBe(expectedContentType);
    if (expectedResourceType !== null) {
      expect(fields.resourceType).toBe(expectedResourceType);
    }
  });
});

// ============================================================
// Singleton export
// ============================================================

describe('githubExtractor singleton', () => {
  it('is a GitHubExtractor instance', () => {
    expect(githubExtractor).toBeInstanceOf(GitHubExtractor);
  });

  it('has correct name and priority', () => {
    expect(githubExtractor.name).toBe('github');
    expect(githubExtractor.priority).toBe(100);
  });
});
