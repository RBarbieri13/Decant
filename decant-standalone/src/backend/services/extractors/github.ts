// ============================================================
// GitHub Extractor
// Specialized extractor for GitHub pages (repos, issues, PRs, etc.)
// ============================================================

import * as cheerio from 'cheerio';
import {
  BaseExtractor,
  ExtractionContext,
  ExtractorResult,
  GitHubFields,
} from './base.js';
import { log } from '../../logger/index.js';
import type { ContentTypeCode } from '../../../shared/types.js';

// Type for cheerio instance
type CheerioInstance = ReturnType<typeof cheerio.load>;

// ============================================================
// GitHub URL Pattern Detection
// ============================================================

interface GitHubPathInfo {
  resourceType: GitHubFields['resourceType'];
  owner: string;
  repoName: string | null;
  issueNumber: number | null;
  pullRequestNumber: number | null;
  gistId: string | null;
}

/**
 * Parse GitHub URL path to determine resource type
 */
function parseGitHubPath(url: URL): GitHubPathInfo {
  const pathname = url.pathname;
  const parts = pathname.split('/').filter(Boolean);

  // Default info
  const info: GitHubPathInfo = {
    resourceType: 'other',
    owner: '',
    repoName: null,
    issueNumber: null,
    pullRequestNumber: null,
    gistId: null,
  };

  // Handle gist.github.com
  if (url.hostname === 'gist.github.com') {
    info.resourceType = 'gist';
    if (parts.length >= 1) {
      info.owner = parts[0];
    }
    if (parts.length >= 2) {
      info.gistId = parts[1];
    }
    return info;
  }

  // Empty path = homepage
  if (parts.length === 0) {
    return info;
  }

  // Single segment = user or organization
  if (parts.length === 1) {
    info.owner = parts[0];
    // Check if it's a special page
    if (['features', 'enterprise', 'pricing', 'explore', 'topics', 'trending', 'collections', 'sponsors', 'search'].includes(parts[0].toLowerCase())) {
      return info;
    }
    info.resourceType = 'user'; // Could be user or org
    return info;
  }

  // Two segments = repository (usually)
  info.owner = parts[0];
  info.repoName = parts[1];

  // Check for special second segments
  if (['followers', 'following', 'stars', 'repositories', 'projects', 'packages', 'sponsoring'].includes(parts[1].toLowerCase())) {
    info.resourceType = 'user';
    info.repoName = null;
    return info;
  }

  // Two segments = repository
  if (parts.length === 2) {
    info.resourceType = 'repository';
    return info;
  }

  // Three or more segments
  const action = parts[2]?.toLowerCase();

  // Issues
  if (action === 'issues') {
    if (parts.length >= 4 && /^\d+$/.test(parts[3])) {
      info.resourceType = 'issue';
      info.issueNumber = parseInt(parts[3], 10);
    } else {
      info.resourceType = 'repository'; // Issues list
    }
    return info;
  }

  // Pull requests
  if (action === 'pull' || action === 'pulls') {
    if (parts.length >= 4 && /^\d+$/.test(parts[3])) {
      info.resourceType = 'pull_request';
      info.pullRequestNumber = parseInt(parts[3], 10);
    } else {
      info.resourceType = 'repository'; // PR list
    }
    return info;
  }

  // Other repo pages (tree, blob, wiki, etc.) are still repositories
  if (['tree', 'blob', 'wiki', 'commits', 'releases', 'tags', 'branches', 'actions', 'projects', 'security', 'pulse', 'graphs', 'network', 'settings', 'discussions'].includes(action)) {
    info.resourceType = 'repository';
    return info;
  }

  // Default to repository
  info.resourceType = 'repository';
  return info;
}

/**
 * Determine content type based on GitHub resource
 */
function getContentType(resourceType: GitHubFields['resourceType']): ContentTypeCode {
  switch (resourceType) {
    case 'repository':
    case 'gist':
      return 'G'; // Repository/code
    case 'issue':
    case 'pull_request':
      return 'A'; // Treat as article/discussion
    case 'user':
    case 'organization':
      return 'T'; // Treat as tool/website
    default:
      return 'A'; // Default to article
  }
}

// ============================================================
// GitHub Extractor Class
// ============================================================

export class GitHubExtractor extends BaseExtractor {
  readonly name = 'github';
  readonly version = '1.0.0';
  readonly description = 'Extracts metadata from GitHub pages (repos, issues, PRs, etc.)';
  readonly priority = 100; // High priority for domain-specific extractor

  /**
   * Check if URL is a GitHub URL
   */
  canHandle(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'github.com' ||
      hostname === 'www.github.com' ||
      hostname === 'gist.github.com'
    );
  }

  /**
   * Extract metadata from GitHub page
   */
  async extract(context: ExtractionContext, html: string): Promise<ExtractorResult> {
    const $ = cheerio.load(html);
    const pathInfo = parseGitHubPath(context.url);

    log.debug('Extracting GitHub content', {
      url: context.normalizedUrl,
      resourceType: pathInfo.resourceType,
      owner: pathInfo.owner,
      repo: pathInfo.repoName,
    });

    // Build result based on resource type
    switch (pathInfo.resourceType) {
      case 'repository':
        return this.extractRepository($, context, pathInfo);
      case 'issue':
        return this.extractIssue($, context, pathInfo);
      case 'pull_request':
        return this.extractPullRequest($, context, pathInfo);
      case 'user':
      case 'organization':
        return this.extractUserOrOrg($, context, pathInfo);
      case 'gist':
        return this.extractGist($, context, pathInfo);
      default:
        return this.extractGeneric($, context, pathInfo);
    }
  }

  /**
   * Extract repository metadata
   */
  private extractRepository(
    $: CheerioInstance,
    context: ExtractionContext,
    pathInfo: GitHubPathInfo
  ): ExtractorResult {
    const result = this.createDefaultResult(context, 'G');

    // Build fields
    const fields: GitHubFields = {
      owner: pathInfo.owner,
      repoName: pathInfo.repoName,
      fullName: pathInfo.repoName ? `${pathInfo.owner}/${pathInfo.repoName}` : null,
      description: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      isPrivate: false,
      defaultBranch: null,
      resourceType: 'repository',
      issueNumber: null,
      pullRequestNumber: null,
    };

    // Extract from meta tags
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');

    result.title = ogTitle || (fields.fullName ? `GitHub - ${fields.fullName}` : 'GitHub Repository');
    result.description = this.cleanText(ogDesc);
    fields.description = result.description;

    // Extract from Open Graph image (often shows repo card)
    result.image = $('meta[property="og:image"]').attr('content') || null;

    // Extract repository-specific data from page
    // Stars
    const starsEl = $('a[href$="/stargazers"] .Counter, #repo-stars-counter-star').first();
    const starsText = starsEl.attr('title') || starsEl.text();
    if (starsText) {
      const starsNum = parseInt(starsText.replace(/[,\s]/g, ''), 10);
      if (!isNaN(starsNum)) {
        fields.stars = starsNum;
      }
    }

    // Forks
    const forksEl = $('a[href$="/forks"] .Counter, #repo-network-counter').first();
    const forksText = forksEl.attr('title') || forksEl.text();
    if (forksText) {
      const forksNum = parseInt(forksText.replace(/[,\s]/g, ''), 10);
      if (!isNaN(forksNum)) {
        fields.forks = forksNum;
      }
    }

    // Primary language
    const languageEl = $('[data-ga-click*="language"] .repo-language-color + span, .BorderGrid-cell .color-fg-default').first();
    if (languageEl.length) {
      fields.language = languageEl.text().trim() || null;
    }

    // Alternative language extraction from meta or page
    const programmingLanguage = $('span[itemprop="programmingLanguage"]').text().trim();
    if (programmingLanguage && !fields.language) {
      fields.language = programmingLanguage;
    }

    // Topics
    $('a[data-octo-click="topic_click"]').each((_, el) => {
      const topic = $(el).text().trim();
      if (topic) {
        fields.topics.push(topic);
      }
    });

    // License
    const licenseEl = $('a[data-analytics-event*="license"], a[href*="/blob/"][href*="LICENSE"]').first();
    const licenseText = licenseEl.text().trim();
    if (licenseText && licenseText.toLowerCase() !== 'license') {
      fields.license = licenseText;
    }

    // About section description
    const aboutDesc = $('p.f4.my-3, .BorderGrid-cell p').first().text().trim();
    if (aboutDesc && !fields.description) {
      fields.description = this.cleanText(aboutDesc);
      result.description = fields.description;
    }

    // Author is the owner
    result.author = pathInfo.owner;
    result.siteName = 'GitHub';
    result.favicon = 'https://github.com/favicon.ico';
    result.contentType = 'G';
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true);

    // Content for AI analysis
    result.content = this.buildRepoContent(fields);

    return result;
  }

  /**
   * Extract issue metadata
   */
  private extractIssue(
    $: CheerioInstance,
    context: ExtractionContext,
    pathInfo: GitHubPathInfo
  ): ExtractorResult {
    const result = this.createDefaultResult(context, 'A');

    const fields: GitHubFields = {
      owner: pathInfo.owner,
      repoName: pathInfo.repoName,
      fullName: pathInfo.repoName ? `${pathInfo.owner}/${pathInfo.repoName}` : null,
      description: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      isPrivate: false,
      defaultBranch: null,
      resourceType: 'issue',
      issueNumber: pathInfo.issueNumber,
      pullRequestNumber: null,
    };

    // Extract title
    const issueTitle = $('bdi.js-issue-title, .gh-header-title .js-issue-title').first().text().trim();
    result.title = issueTitle || `Issue #${pathInfo.issueNumber}`;

    // Add repo context to title
    if (fields.fullName) {
      result.title = `${result.title} - ${fields.fullName}`;
    }

    // Extract issue body
    const issueBody = $('.js-comment-body').first().text().trim();
    result.description = this.truncate(this.cleanText(issueBody), 500);
    result.content = this.truncate(this.cleanText(issueBody), 5000);

    // Extract author
    const authorEl = $('.js-issue-header-byline a.author, .author.text-bold').first();
    result.author = authorEl.text().trim() || null;

    result.siteName = 'GitHub';
    result.favicon = 'https://github.com/favicon.ico';
    result.image = $('meta[property="og:image"]').attr('content') || null;
    result.contentType = 'A';
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true);

    return result;
  }

  /**
   * Extract pull request metadata
   */
  private extractPullRequest(
    $: CheerioInstance,
    context: ExtractionContext,
    pathInfo: GitHubPathInfo
  ): ExtractorResult {
    const result = this.createDefaultResult(context, 'A');

    const fields: GitHubFields = {
      owner: pathInfo.owner,
      repoName: pathInfo.repoName,
      fullName: pathInfo.repoName ? `${pathInfo.owner}/${pathInfo.repoName}` : null,
      description: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      isPrivate: false,
      defaultBranch: null,
      resourceType: 'pull_request',
      issueNumber: null,
      pullRequestNumber: pathInfo.pullRequestNumber,
    };

    // Extract title
    const prTitle = $('bdi.js-issue-title, .gh-header-title .js-issue-title').first().text().trim();
    result.title = prTitle || `Pull Request #${pathInfo.pullRequestNumber}`;

    // Add repo context to title
    if (fields.fullName) {
      result.title = `${result.title} - ${fields.fullName}`;
    }

    // Extract PR description
    const prBody = $('.js-comment-body').first().text().trim();
    result.description = this.truncate(this.cleanText(prBody), 500);
    result.content = this.truncate(this.cleanText(prBody), 5000);

    // Extract author
    const authorEl = $('.js-issue-header-byline a.author, .author.text-bold').first();
    result.author = authorEl.text().trim() || null;

    result.siteName = 'GitHub';
    result.favicon = 'https://github.com/favicon.ico';
    result.image = $('meta[property="og:image"]').attr('content') || null;
    result.contentType = 'A';
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true);

    return result;
  }

  /**
   * Extract user or organization profile
   */
  private extractUserOrOrg(
    $: CheerioInstance,
    context: ExtractionContext,
    pathInfo: GitHubPathInfo
  ): ExtractorResult {
    const result = this.createDefaultResult(context, 'T');

    const fields: GitHubFields = {
      owner: pathInfo.owner,
      repoName: null,
      fullName: null,
      description: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      isPrivate: false,
      defaultBranch: null,
      resourceType: 'user',
      issueNumber: null,
      pullRequestNumber: null,
    };

    // Check if organization
    const isOrg = $('meta[name="twitter:site"]').attr('content') === '@github';
    const profileType = $('meta[property="profile:username"]').attr('content') ? 'user' : 'organization';
    fields.resourceType = profileType === 'user' ? 'user' : 'organization';

    // Extract name
    const displayName = $('span.p-name, h1.vcard-names .p-name').first().text().trim();
    const username = $('span.p-nickname, h1.vcard-names .p-nickname').first().text().trim();
    result.title = displayName || username || pathInfo.owner;
    result.author = username || pathInfo.owner;

    // Extract bio
    const bio = $('div.p-note, .user-profile-bio').first().text().trim();
    result.description = this.cleanText(bio);

    // Extract avatar
    const avatarUrl = $('img.avatar-user, img.avatar').first().attr('src');
    result.image = avatarUrl || null;

    result.siteName = 'GitHub';
    result.favicon = 'https://github.com/favicon.ico';
    result.contentType = 'T';
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true);

    return result;
  }

  /**
   * Extract gist metadata
   */
  private extractGist(
    $: CheerioInstance,
    context: ExtractionContext,
    pathInfo: GitHubPathInfo
  ): ExtractorResult {
    const result = this.createDefaultResult(context, 'G');

    const fields: GitHubFields = {
      owner: pathInfo.owner,
      repoName: null,
      fullName: null,
      description: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      isPrivate: false,
      defaultBranch: null,
      resourceType: 'gist',
      issueNumber: null,
      pullRequestNumber: null,
    };

    // Extract title from first file or description
    const gistDesc = $('meta[property="og:description"]').attr('content');
    const firstFileName = $('.file-header .file-info .gist-blob-name').first().text().trim();
    result.title = gistDesc || firstFileName || 'GitHub Gist';

    result.description = this.cleanText(gistDesc);
    result.author = pathInfo.owner;

    // Extract gist content
    const gistContent = $('.blob-wrapper').first().text().trim();
    result.content = this.truncate(gistContent, 5000);

    result.siteName = 'GitHub Gist';
    result.favicon = 'https://github.com/favicon.ico';
    result.contentType = 'G';
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(true);

    return result;
  }

  /**
   * Generic GitHub page extraction
   */
  private extractGeneric(
    $: CheerioInstance,
    context: ExtractionContext,
    pathInfo: GitHubPathInfo
  ): ExtractorResult {
    const result = this.createDefaultResult(context, getContentType(pathInfo.resourceType));

    const fields: GitHubFields = {
      owner: pathInfo.owner,
      repoName: pathInfo.repoName,
      fullName: pathInfo.repoName ? `${pathInfo.owner}/${pathInfo.repoName}` : null,
      description: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      isPrivate: false,
      defaultBranch: null,
      resourceType: pathInfo.resourceType,
      issueNumber: pathInfo.issueNumber,
      pullRequestNumber: pathInfo.pullRequestNumber,
    };

    // Use Open Graph data
    result.title = $('meta[property="og:title"]').attr('content') || 'GitHub';
    result.description = this.cleanText($('meta[property="og:description"]').attr('content'));
    result.image = $('meta[property="og:image"]').attr('content') || null;
    result.siteName = 'GitHub';
    result.favicon = 'https://github.com/favicon.ico';
    result.extractedFields = fields as unknown as Record<string, unknown>;
    result.metadata = this.createMetadata(false, ['Generic extraction used']);

    return result;
  }

  /**
   * Build content string for AI analysis from repo fields
   */
  private buildRepoContent(fields: GitHubFields): string {
    const parts: string[] = [];

    if (fields.fullName) {
      parts.push(`Repository: ${fields.fullName}`);
    }

    if (fields.description) {
      parts.push(`Description: ${fields.description}`);
    }

    if (fields.language) {
      parts.push(`Primary Language: ${fields.language}`);
    }

    if (fields.topics.length > 0) {
      parts.push(`Topics: ${fields.topics.join(', ')}`);
    }

    if (fields.stars !== null) {
      parts.push(`Stars: ${fields.stars.toLocaleString()}`);
    }

    if (fields.forks !== null) {
      parts.push(`Forks: ${fields.forks.toLocaleString()}`);
    }

    if (fields.license) {
      parts.push(`License: ${fields.license}`);
    }

    return parts.join('\n');
  }
}

// Export singleton instance
export const githubExtractor = new GitHubExtractor();

export default GitHubExtractor;
