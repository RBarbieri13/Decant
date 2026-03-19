// ============================================================
// Semantic Profile Prompt & Schema
// ============================================================
// Single unified LLM call that replaces Phase 1 classification
// and Phase 2 enrichment. Produces a complete semantic identity
// for a node from scraped content.

import { z } from 'zod';

// ============================================================
// Schema
// ============================================================

export const SemanticProfileSchema = z.object({
  // Identity
  title: z.string().max(500).describe('True subject name — not the HTML page title. Strip marketing fluff, site name suffixes, and click-bait wrappers.'),
  company: z.string().max(200).describe('Source organization or company. Use canonical name (e.g., "Anthropic" not "anthropic.com").'),
  phraseDescription: z.string().max(100).describe('Ultra-brief tagline. No period at end. Title Case. Describe what it IS, not what the page is about.'),
  shortDescription: z.string().max(500).describe('1-3 sentence description. Concrete and specific — mention actual capabilities, not vague claims.'),
  aiSummary: z.string().max(5000).describe('Detailed 3-8 paragraph analysis. MUST include specific features, capabilities, use cases, pricing if available, competitors, and adoption metrics. No generic language.'),

  // Faceted identity — these drive hierarchy placement
  primaryFunction: z.string().max(100).describe('What this resource DOES. Use a verb phrase (e.g., "code generation", "image editing", "portfolio management", "team communication").'),
  primaryDomain: z.string().max(100).describe('Knowledge area or field (e.g., "machine learning", "web development", "personal finance", "sports analytics").'),
  resourceType: z.enum(['tool', 'article', 'video', 'paper', 'repository', 'guide', 'service', 'course', 'image', 'news', 'knowledge_base', 'dataset', 'podcast', 'newsletter', 'community', 'other']).describe('What kind of content/resource this is.'),
  technologies: z.array(z.string().max(60)).max(5).describe('Specific technologies, frameworks, or languages involved (e.g., "Python", "React", "GPT-4", "PostgreSQL").'),
  concepts: z.array(z.string().max(60)).max(10).describe('Key concepts and topics (e.g., "prompt engineering", "retrieval augmented generation", "zero-shot learning").'),
  audience: z.array(z.string().max(60)).max(3).describe('Who this is for (e.g., "software developers", "data scientists", "enterprise teams", "beginners").'),
  platform: z.array(z.string().max(60)).max(3).describe('Where it lives or runs (e.g., "web", "API", "CLI", "mobile", "desktop", "browser extension").'),
  industry: z.array(z.string().max(60)).max(3).describe('Industry verticals if applicable (e.g., "healthcare", "fintech", "education").'),
  pricing: z.array(z.string().max(60)).max(2).describe('Pricing model (e.g., "free", "freemium", "open source", "paid", "enterprise").'),

  // Descriptive tags
  keyConcepts: z.array(z.string().max(60)).max(20).describe('Lowercase tags for search and filtering. Specific and concrete.'),
  metadataTags: z.array(z.string().max(60)).max(10).describe('Lowercase supplementary tags. Focus on attributes not captured by the faceted fields above.'),
  functionTags: z.string().max(300).describe('Comma-separated use-case phrases (e.g., "code review automation, pull request analysis, CI/CD integration").'),

  // Quality
  confidence: z.number().min(0).max(1).describe('How confident you are in this profile. 0.9+ for clear content, 0.5-0.8 for ambiguous, <0.5 for very uncertain.'),
  logoUrl: z.string().url().nullable().optional().describe('Direct URL to the logo or icon image if found in the page metadata. null if not found.'),
});

export type SemanticProfile = z.infer<typeof SemanticProfileSchema>;

// ============================================================
// Prompt Builders
// ============================================================

export interface SemanticProfileInput {
  url: string;
  title: string;
  domain?: string;
  description?: string;
  author?: string;
  siteName?: string;
  content?: string;
  image?: string;
  favicon?: string;
}

const SYSTEM_PROMPT = `You are a content analyst that produces structured semantic profiles for web resources.

Your job is to analyze a URL and its extracted content, then produce a comprehensive semantic identity that captures:
- WHAT the resource is
- WHAT it does / what function it serves
- WHO made it / where it comes from
- WHAT domain of knowledge it belongs to
- WHAT concepts and technologies it involves
- WHO it is for
- WHAT platform or medium it lives on
- HOW it is priced or licensed

CRITICAL RULES:

1. TITLE: Extract the TRUE subject name. Not the HTML <title> tag. Not "Home | Company Name". Not "The Best Tool for X". The actual name of the thing being described. If it's a product, use the product name. If it's an article, use a descriptive title that captures the subject matter.

2. SPECIFICITY: Every field must be concrete and specific. Never use vague words like "powerful", "innovative", "cutting-edge", "comprehensive", "robust" without concrete supporting detail. If you can't be specific, say less rather than saying something vague.

3. AI SUMMARY: This is the most important text field. It must contain:
   - Specific features and capabilities (not vague claims)
   - Actual use cases with concrete examples
   - Pricing tiers with real numbers if available
   - Comparison to alternatives/competitors with specifics
   - Adoption metrics if available (GitHub stars, users, downloads)
   - Technical architecture details if relevant
   - Limitations and tradeoffs

4. FACETED IDENTITY: These fields drive how the resource gets organized in a dynamic hierarchy. Be precise:
   - primaryFunction: Use a clear verb phrase. "code generation" not "AI tool". "team chat" not "communication platform".
   - primaryDomain: Use the most specific domain that applies. "natural language processing" not "artificial intelligence" (unless it truly spans all of AI).
   - technologies: Only list technologies actually used or discussed. Don't guess.
   - concepts: Focus on the core intellectual concepts, not generic terms.
   - audience: Be specific about who would actually use this.

5. RESOURCE TYPE: Choose the single best match. A GitHub repo is "repository" even if it contains documentation. A YouTube video is "video" even if it's educational. A blog post is "article" even if it's a tutorial.

6. TAGS: All tags must be lowercase. keyConcepts should be specific enough to distinguish this resource from similar ones. Avoid tags that would match everything in the same domain.

7. COMPANY: Use the canonical company name. "OpenAI" not "openai" or "Open AI". "Anthropic" not "anthropic.com". If it's an individual's project, use their name or handle.

8. SOCIAL MEDIA POSTS (Twitter/X, LinkedIn, Reddit, etc.): When the URL is a social media post, classify by the CONTENT AND TOPIC of the post, NOT the platform. The platform (e.g., "twitter", "x.com") belongs ONLY in the \`platform\` array. \`primaryDomain\` and \`primaryFunction\` must reflect what the post is ACTUALLY ABOUT:
   - A tweet about an AI model release → primaryDomain="artificial intelligence", primaryFunction="AI research communication"
   - A tweet about stock market trends → primaryDomain="finance", primaryFunction="market analysis"
   - A tweet about a software tool → primaryDomain="software development", primaryFunction="developer tooling news"
   - A tweet about a person's thoughts on productivity → primaryDomain="productivity", primaryFunction="personal insight sharing"
   The \`resourceType\` should be "news" or "article" for most posts. The \`title\` should describe the TOPIC, not "Tweet by @handle".
   NEVER set primaryDomain="social media" or primaryFunction="social media engagement" unless the resource is LITERALLY about social media marketing strategy as its subject matter.

Respond with valid JSON matching the required schema. Do not include any text outside the JSON object.`;

export function buildSemanticProfilePrompt(input: SemanticProfileInput): {
  system: string;
  user: string;
} {
  const parts: string[] = [
    `URL: ${input.url}`,
    `Title: ${input.title}`,
  ];

  if (input.domain) parts.push(`Domain: ${input.domain}`);
  if (input.siteName) parts.push(`Site Name: ${input.siteName}`);
  if (input.author) parts.push(`Author: ${input.author}`);
  if (input.description) parts.push(`Description: ${input.description}`);
  if (input.image) parts.push(`Image URL: ${input.image}`);
  if (input.favicon) parts.push(`Favicon URL: ${input.favicon}`);

  if (input.content) {
    const truncated = input.content.slice(0, 4000);
    parts.push(`\nContent excerpt:\n${truncated}`);
  }

  return {
    system: SYSTEM_PROMPT,
    user: parts.join('\n'),
  };
}

// ============================================================
// Response Parsing
// ============================================================

export function parseSemanticProfileResponse(raw: string): SemanticProfile {
  // Handle markdown code blocks
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned);
  const result = SemanticProfileSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Semantic profile validation failed: ${issues}`);
  }

  return result.data;
}

// ============================================================
// Descriptor String Builder
// ============================================================

export function buildDescriptorString(profile: SemanticProfile, domain?: string): string {
  const parts = [
    profile.title,
    domain || '',
    profile.company,
    profile.phraseDescription,
    profile.shortDescription,
    profile.primaryFunction,
    profile.primaryDomain,
    profile.resourceType,
    ...profile.technologies,
    ...profile.concepts,
    ...profile.audience,
    ...profile.platform,
    ...profile.keyConcepts,
    ...profile.metadataTags,
  ].filter(Boolean);

  return parts.map(p => p.toLowerCase()).join('|');
}

// ============================================================
// Fallback Profile
// ============================================================

export function createFallbackProfile(input: SemanticProfileInput): SemanticProfile {
  return {
    title: input.title || 'Untitled',
    company: input.siteName || input.domain || 'Unknown',
    phraseDescription: input.description?.slice(0, 100) || input.title || '',
    shortDescription: input.description || '',
    aiSummary: input.content?.slice(0, 2000) || input.description || '',
    primaryFunction: 'unknown',
    primaryDomain: 'general',
    resourceType: 'other',
    technologies: [],
    concepts: [],
    audience: [],
    platform: input.domain ? ['web'] : [],
    industry: [],
    pricing: [],
    keyConcepts: [],
    metadataTags: [],
    functionTags: '',
    confidence: 0.1,
    logoUrl: input.favicon || null,
  };
}
