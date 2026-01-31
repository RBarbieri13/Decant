// ============================================================
// Content Type Detector
// Detects content type based on URL patterns, domain, and metadata
// ============================================================

import * as cheerio from 'cheerio';
import type { ContentTypeCode } from '../../shared/types.js';
import { log } from '../logger/index.js';

// Type for cheerio instance
type CheerioInstance = ReturnType<typeof cheerio.load>;

// ============================================================
// Domain-Based Detection Rules
// ============================================================

/**
 * Domain patterns and their associated content types
 */
const DOMAIN_CONTENT_TYPES: Array<{
  pattern: RegExp | string[];
  contentType: ContentTypeCode;
  description: string;
}> = [
  // Video platforms
  {
    pattern: ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'twitch.tv'],
    contentType: 'V',
    description: 'Video platform',
  },

  // Code repositories
  {
    pattern: ['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org', 'sr.ht', 'gist.github.com'],
    contentType: 'G',
    description: 'Code repository',
  },

  // Podcast platforms
  {
    pattern: ['podcasts.apple.com', 'spotify.com', 'anchor.fm', 'transistor.fm', 'pocketcasts.com', 'overcast.fm'],
    contentType: 'P',
    description: 'Podcast platform',
  },

  // Academic/Research
  {
    pattern: ['arxiv.org', 'scholar.google.com', 'researchgate.net', 'academia.edu', 'jstor.org', 'pubmed.ncbi.nlm.nih.gov', 'semanticscholar.org', 'sciencedirect.com', 'nature.com', 'science.org', 'ieee.org', 'acm.org', 'springer.com', 'wiley.com', 'ssrn.com', 'biorxiv.org', 'medrxiv.org'],
    contentType: 'R',
    description: 'Academic/research paper',
  },

  // Social platforms
  {
    pattern: ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'threads.net', 'mastodon.social', 'reddit.com'],
    contentType: 'S',
    description: 'Social post',
  },

  // Learning platforms (Courses)
  {
    pattern: ['udemy.com', 'coursera.org', 'udacity.com', 'edx.org', 'pluralsight.com', 'skillshare.com', 'linkedin.com/learning', 'codecademy.com', 'freecodecamp.org', 'khanacademy.org', 'egghead.io', 'frontendmasters.com', 'laracasts.com'],
    contentType: 'C',
    description: 'Course/tutorial',
  },

  // Newsletter platforms
  {
    pattern: ['substack.com', 'beehiiv.com', 'buttondown.email', 'mailchimp.com', 'ghost.io', 'revue.co'],
    contentType: 'N',
    description: 'Newsletter',
  },

  // Image/Design platforms
  {
    pattern: ['dribbble.com', 'behance.net', 'figma.com', 'pinterest.com', 'unsplash.com', 'flickr.com'],
    contentType: 'I',
    description: 'Image/graphic',
  },

  // Book platforms
  {
    pattern: ['goodreads.com', 'amazon.com/kindle', 'amazon.com/dp', 'leanpub.com', 'gumroad.com'],
    contentType: 'K',
    description: 'Book/eBook',
  },

  // Audio platforms (music)
  {
    pattern: ['soundcloud.com', 'bandcamp.com', 'music.apple.com', 'music.youtube.com'],
    contentType: 'U',
    description: 'Audio/music',
  },
];

/**
 * SaaS/Tool domains that should be classified as 'T' (Tool/Website)
 */
const TOOL_DOMAINS: string[] = [
  // Development tools
  'vercel.com',
  'netlify.com',
  'heroku.com',
  'railway.app',
  'render.com',
  'fly.io',
  'supabase.com',
  'firebase.google.com',
  'aws.amazon.com',
  'cloud.google.com',
  'azure.microsoft.com',

  // Productivity
  'notion.so',
  'airtable.com',
  'coda.io',
  'monday.com',
  'asana.com',
  'trello.com',
  'clickup.com',
  'linear.app',

  // AI/ML tools
  'openai.com',
  'anthropic.com',
  'huggingface.co',
  'replicate.com',
  'runpod.io',
  'modal.com',
  'cohere.ai',

  // Design tools
  'canva.com',
  'miro.com',
  'whimsical.com',

  // Communication
  'slack.com',
  'discord.com',
  'zoom.us',
];

// ============================================================
// URL Path Pattern Detection
// ============================================================

/**
 * URL path patterns and their content types
 */
const PATH_PATTERNS: Array<{
  pattern: RegExp;
  contentType: ContentTypeCode;
  description: string;
}> = [
  // Video paths
  { pattern: /\/watch\b/i, contentType: 'V', description: 'Video watch page' },
  { pattern: /\/video[s]?\//i, contentType: 'V', description: 'Video path' },
  { pattern: /\/embed\//i, contentType: 'V', description: 'Embedded content' },
  { pattern: /\/shorts\//i, contentType: 'V', description: 'Short video' },

  // Document types by extension
  { pattern: /\.pdf(\?|$)/i, contentType: 'R', description: 'PDF document' },
  { pattern: /\.docx?(\?|$)/i, contentType: 'A', description: 'Word document' },
  { pattern: /\.pptx?(\?|$)/i, contentType: 'A', description: 'Presentation' },

  // Research/academic paths
  { pattern: /\/paper[s]?\//i, contentType: 'R', description: 'Research paper path' },
  { pattern: /\/publication[s]?\//i, contentType: 'R', description: 'Publication path' },
  { pattern: /\/research\//i, contentType: 'R', description: 'Research path' },
  { pattern: /\/abs\/\d/i, contentType: 'R', description: 'arXiv abstract' },
  { pattern: /\/doi\//i, contentType: 'R', description: 'DOI link' },

  // Podcast paths
  { pattern: /\/podcast[s]?\//i, contentType: 'P', description: 'Podcast path' },
  { pattern: /\/episode[s]?\//i, contentType: 'P', description: 'Episode path' },
  { pattern: /\/show\//i, contentType: 'P', description: 'Show path' },

  // Course/learning paths
  { pattern: /\/course[s]?\//i, contentType: 'C', description: 'Course path' },
  { pattern: /\/tutorial[s]?\//i, contentType: 'C', description: 'Tutorial path' },
  { pattern: /\/learn\//i, contentType: 'C', description: 'Learning path' },
  { pattern: /\/lesson[s]?\//i, contentType: 'C', description: 'Lesson path' },

  // Blog/article paths
  { pattern: /\/blog\//i, contentType: 'A', description: 'Blog path' },
  { pattern: /\/article[s]?\//i, contentType: 'A', description: 'Article path' },
  { pattern: /\/post[s]?\//i, contentType: 'A', description: 'Post path' },
  { pattern: /\/news\//i, contentType: 'A', description: 'News path' },

  // Repository paths
  { pattern: /\/pull\/\d+/i, contentType: 'G', description: 'Pull request' },
  { pattern: /\/issues?\/\d+/i, contentType: 'G', description: 'Issue' },
  { pattern: /\/releases?\//i, contentType: 'G', description: 'Release page' },

  // Social paths
  { pattern: /\/status\/\d+/i, contentType: 'S', description: 'Twitter/X status' },
  { pattern: /\/tweet[s]?\//i, contentType: 'S', description: 'Tweet path' },
];

// ============================================================
// Detection Functions
// ============================================================

/**
 * Detect content type from domain
 */
function detectFromDomain(hostname: string): ContentTypeCode | null {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');

  // Check domain content type rules
  for (const rule of DOMAIN_CONTENT_TYPES) {
    if (Array.isArray(rule.pattern)) {
      if (rule.pattern.some(domain => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`))) {
        log.debug('Content type detected from domain', {
          hostname: normalizedHost,
          contentType: rule.contentType,
          reason: rule.description,
        });
        return rule.contentType;
      }
    } else if (rule.pattern.test(normalizedHost)) {
      log.debug('Content type detected from domain pattern', {
        hostname: normalizedHost,
        contentType: rule.contentType,
        reason: rule.description,
      });
      return rule.contentType;
    }
  }

  // Check if it's a known tool domain
  if (TOOL_DOMAINS.some(domain => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`))) {
    log.debug('Content type detected as tool/website', {
      hostname: normalizedHost,
      contentType: 'T',
    });
    return 'T';
  }

  return null;
}

/**
 * Detect content type from URL path
 */
function detectFromPath(pathname: string): ContentTypeCode | null {
  for (const rule of PATH_PATTERNS) {
    if (rule.pattern.test(pathname)) {
      log.debug('Content type detected from path', {
        pathname,
        contentType: rule.contentType,
        reason: rule.description,
      });
      return rule.contentType;
    }
  }
  return null;
}

/**
 * Detect content type from page metadata
 */
function detectFromMetadata($: CheerioInstance): ContentTypeCode | null {
  // Check og:type
  const ogType = $('meta[property="og:type"]').attr('content')?.toLowerCase();
  if (ogType) {
    if (ogType.includes('video')) return 'V';
    if (ogType.includes('music') || ogType.includes('audio')) return 'U';
    if (ogType.includes('book')) return 'K';
    if (ogType === 'article' || ogType === 'blog') return 'A';
    if (ogType === 'profile') return 'T';
    if (ogType === 'product' || ogType === 'website') return 'T';
  }

  // Check JSON-LD for schema types
  let schemaType: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);

      // Handle @graph
      const items = data['@graph'] || [data];
      for (const item of items) {
        const type = item['@type'];
        if (type) {
          const types = Array.isArray(type) ? type : [type];
          for (const t of types) {
            const typeLower = t.toLowerCase();
            if (typeLower.includes('video')) schemaType = 'V';
            else if (typeLower.includes('podcast') || typeLower.includes('episode')) schemaType = 'P';
            else if (typeLower.includes('article') || typeLower.includes('blog') || typeLower.includes('news')) schemaType = 'A';
            else if (typeLower.includes('course') || typeLower.includes('learning')) schemaType = 'C';
            else if (typeLower.includes('book')) schemaType = 'K';
            else if (typeLower.includes('scholarly') || typeLower.includes('research')) schemaType = 'R';
            else if (typeLower.includes('software') || typeLower.includes('application')) schemaType = 'T';
            else if (typeLower.includes('image')) schemaType = 'I';

            if (schemaType) break;
          }
          if (schemaType) break;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  });

  if (schemaType) {
    log.debug('Content type detected from schema', {
      contentType: schemaType,
    });
    return schemaType as ContentTypeCode;
  }

  return null;
}

/**
 * Detect content type from page content signals
 */
function detectFromContent($: CheerioInstance): ContentTypeCode | null {
  // Check for video embeds
  const hasVideo = $('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"], .video-player').length > 0;

  // Check for audio/podcast elements
  const hasAudio = $('audio, .podcast-player, [data-podcast], .audio-player').length > 0;

  // Check for substantial article content
  const articleContent = $('article, .content, .post-content, .entry-content, main').text().trim();
  const hasSubstantialContent = articleContent.length > 500;

  // If there's video but not much text content, it's likely a video page
  if (hasVideo && !hasSubstantialContent) {
    return 'V';
  }

  // If there's audio, likely a podcast
  if (hasAudio) {
    return 'P';
  }

  return null;
}

// ============================================================
// Main Detection Function
// ============================================================

export interface ContentTypeDetectionResult {
  contentType: ContentTypeCode;
  confidence: 'high' | 'medium' | 'low';
  source: 'domain' | 'path' | 'metadata' | 'content' | 'fallback';
  reason: string;
}

/**
 * Detect content type using multiple strategies
 * Priority: domain > path > metadata > content > fallback
 *
 * @param url - The URL to analyze
 * @param html - Optional HTML content for deeper analysis
 * @returns Content type detection result with confidence
 */
export function detectContentType(
  url: string | URL,
  html?: string
): ContentTypeDetectionResult {
  const parsedUrl = typeof url === 'string' ? new URL(url) : url;

  log.debug('Detecting content type', { url: parsedUrl.href });

  // 1. Try domain-based detection (highest confidence)
  const domainType = detectFromDomain(parsedUrl.hostname);
  if (domainType) {
    return {
      contentType: domainType,
      confidence: 'high',
      source: 'domain',
      reason: `Domain ${parsedUrl.hostname} is a known ${domainType} platform`,
    };
  }

  // 2. Try path-based detection
  const pathType = detectFromPath(parsedUrl.pathname);
  if (pathType) {
    return {
      contentType: pathType,
      confidence: 'medium',
      source: 'path',
      reason: `URL path pattern matches ${pathType} content`,
    };
  }

  // 3. If HTML is provided, try metadata and content analysis
  if (html) {
    const $ = cheerio.load(html);

    // Try metadata
    const metaType = detectFromMetadata($);
    if (metaType) {
      return {
        contentType: metaType,
        confidence: 'medium',
        source: 'metadata',
        reason: 'Detected from page metadata (og:type or schema.org)',
      };
    }

    // Try content analysis
    const contentType = detectFromContent($);
    if (contentType) {
      return {
        contentType: contentType,
        confidence: 'low',
        source: 'content',
        reason: 'Inferred from page content structure',
      };
    }
  }

  // 4. Fallback to Article
  return {
    contentType: 'A',
    confidence: 'low',
    source: 'fallback',
    reason: 'No specific type detected, defaulting to Article',
  };
}

/**
 * Quick content type detection from URL only (no HTML parsing)
 */
export function quickDetectContentType(url: string | URL): ContentTypeCode {
  const parsedUrl = typeof url === 'string' ? new URL(url) : url;

  // Try domain
  const domainType = detectFromDomain(parsedUrl.hostname);
  if (domainType) return domainType;

  // Try path
  const pathType = detectFromPath(parsedUrl.pathname);
  if (pathType) return pathType;

  // Fallback
  return 'A';
}

/**
 * Check if URL is from a known specialized domain
 */
export function isSpecializedDomain(url: string | URL): boolean {
  const parsedUrl = typeof url === 'string' ? new URL(url) : url;
  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');

  for (const rule of DOMAIN_CONTENT_TYPES) {
    if (Array.isArray(rule.pattern)) {
      if (rule.pattern.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
        return true;
      }
    } else if (rule.pattern.test(hostname)) {
      return true;
    }
  }

  return TOOL_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Get the expected content type for a domain (if known)
 */
export function getExpectedContentType(hostname: string): ContentTypeCode | null {
  return detectFromDomain(hostname);
}

export default {
  detectContentType,
  quickDetectContentType,
  isSpecializedDomain,
  getExpectedContentType,
};
