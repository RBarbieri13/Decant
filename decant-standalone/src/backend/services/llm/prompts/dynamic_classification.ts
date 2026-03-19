// ============================================================
// Dynamic Classification Prompt and Schemas
// ============================================================
// Generates emergent taxonomy from the entire dataset rather than
// classifying against a static predefined taxonomy.

import { z } from 'zod';

// ============================================================
// Condensed Node (minimal representation for LLM input)
// ============================================================

export interface CondensedNode {
  id: string;
  title: string;
  domain: string;
  quickPhrase?: string;
  shortDescription?: string;
  keyConcepts?: string[];
}

// ============================================================
// Zod Schemas
// ============================================================

export const TaxonomySegmentSchema = z.object({
  code: z.string().min(1).max(1).describe('Single uppercase letter A-Z'),
  label: z.string().max(40).describe('Human-readable segment name'),
  description: z.string().max(100).describe('Brief description of what this segment covers'),
});

export const TaxonomyCategorySchema = z.object({
  segmentCode: z.string().min(1).max(1).describe('Parent segment code'),
  code: z.string().min(3).max(3).describe('Three uppercase letter category code'),
  label: z.string().max(60).describe('Human-readable category name'),
  description: z.string().max(100).describe('Brief description'),
});

export const DynamicTaxonomySchema = z.object({
  segments: z.array(TaxonomySegmentSchema).min(2).max(15),
  categories: z.array(TaxonomyCategorySchema).min(3).max(80),
});

export const NodeAssignmentSchema = z.object({
  nodeId: z.string(),
  segmentCode: z.string().min(1).max(1),
  categoryCode: z.string().min(3).max(3),
  subcategoryLabel: z.string().max(40),
  contentType: z.string().min(1).max(1),
  organization: z.string().max(4),
  quickPhrase: z.string().max(100),
  description: z.string().max(300),
  functionTags: z.string().max(200),
  confidence: z.number().min(0).max(1),
});

export const DynamicClassificationSchema = z.object({
  segments: z.array(TaxonomySegmentSchema).min(2).max(15),
  categories: z.array(TaxonomyCategorySchema).min(3).max(80),
  assignments: z.array(NodeAssignmentSchema),
});

export const AssignmentBatchSchema = z.object({
  assignments: z.array(NodeAssignmentSchema),
});

// ============================================================
// Type Exports
// ============================================================

export type DynamicTaxonomy = z.infer<typeof DynamicTaxonomySchema>;
export type NodeAssignment = z.infer<typeof NodeAssignmentSchema>;
export type DynamicClassification = z.infer<typeof DynamicClassificationSchema>;

// ============================================================
// Content Type Definitions (static — describes format, not topic)
// ============================================================

const CONTENT_TYPE_REFERENCE = `
Content Type Codes (assign the best-fit FORMAT type):
T = Tool/Software (interactive platform, SaaS, app, utility)
A = Article/Blog (written content, blog post, documentation)
V = Video (YouTube, Vimeo, video content)
P = Research Paper (academic paper, whitepaper, technical report)
R = Repository (GitHub, GitLab, code library, open source project)
G = Guide/Tutorial (how-to, tutorial, educational guide)
S = Service/Platform (platform, service provider, marketplace)
C = Course/Learning (online course, structured learning)
I = Image/Visual (infographic, diagram, visual content)
N = News (news article, current events, press release)
K = Knowledge Base (wiki, documentation site, reference)
U = Unknown (content type could not be determined)
`.trim();

// ============================================================
// System Prompts
// ============================================================

const COMBINED_SYSTEM_PROMPT = `You are a knowledge organizer. You will receive a collection of content items (web pages, tools, articles, etc.) and must:
1. Create an emergent hierarchical taxonomy by clustering items by semantic similarity
2. Assign every item to the taxonomy

TAXONOMY RULES:
- SEGMENTS are the top level. Each gets a unique single UPPERCASE letter code (A-Z). Create 3-12 segments depending on content diversity. Each segment must have a clear thematic focus.
- CATEGORIES are the second level under segments. Each gets a unique 3-letter UPPERCASE code within its segment. Create 2-10 categories per segment based on how many items cluster there.
- SUBCATEGORY LABELS are optional third-level labels. Only provide them when a category has many items. Labels should be 2-4 words in Title Case.

DENSITY-BASED GRANULARITY:
- 1-5 items on a topic → single category is fine
- 6-15 items on a topic → split into 2-3 categories
- 15+ items in an area → consider a dedicated segment with multiple categories
- 10+ items in a single category → assign meaningful subcategory labels to differentiate

GUIDELINES:
- Group by TOPIC similarity, not by source domain or format
- Reuse well-known segment letters when content warrants (e.g., A for AI topics, T for Tech) but do NOT force content into predefined buckets
- Ensure every segment has at least 2 categories, and every category has at least 1 item
- Category codes must be unique within their segment (but can repeat across segments)
- The taxonomy should feel natural and intuitive — how a human librarian would organize these items

SOCIAL MEDIA CLASSIFICATION RULES:
- When a URL is from a social media platform (x.com, twitter.com, threads.net, reddit.com), classify by the POST CONTENT AND TOPIC, not the platform.
- A tweet ABOUT an AI agent tool → belongs in the AI/Agents category, NOT "Social Media".
- A tweet ABOUT trading bots → belongs in AI Trading category, NOT "Social Media".
- Only classify something as "Social Media" when the content is truly ABOUT social media as a subject (e.g., social media marketing strategies, platform analytics), or is personal commentary with no clear topical focus.
- Personal status updates with no clear topic → General Commentary or similar catch-all.

${CONTENT_TYPE_REFERENCE}

ORGANIZATION CODE: 4 uppercase letters identifying the company/org behind each item. Use 'UNKN' if unknown. Common examples: OAIA (OpenAI), ANTH (Anthropic), GOOG (Google), MSFT (Microsoft), META (Meta), AMZN (Amazon).

ASSIGNMENT FIELDS (per item):
- nodeId: the item's ID (copy exactly from the input)
- segmentCode: 1-letter segment code from YOUR taxonomy
- categoryCode: 3-letter category code from YOUR taxonomy
- subcategoryLabel: 2-4 word label within the category (Title Case) or empty string
- contentType: 1-letter content type code from the static list above
- organization: 4-letter org code or UNKN
- quickPhrase: Ultra-brief tagline (max 100 chars, NO period at end)
- description: 1-2 sentence factual summary (max 300 chars)
- functionTags: Comma-separated use-case phrases, 2-5 phrases of 2-4 words each
- confidence: 0.0-1.0 how confident you are in this classification

RESPONSE FORMAT: JSON object with three top-level keys:
- "segments": array of {code, label, description}
- "categories": array of {segmentCode, code, label, description}
- "assignments": array of {nodeId, segmentCode, categoryCode, subcategoryLabel, contentType, organization, quickPhrase, description, functionTags, confidence}`;

const TAXONOMY_ONLY_SYSTEM_PROMPT = `You are a knowledge organizer. You will receive a collection of content items and must create a hierarchical taxonomy by clustering them by semantic similarity.

TAXONOMY RULES:
- SEGMENTS: Top level. Each gets a unique single UPPERCASE letter code (A-Z). Create 3-12 segments. Clear thematic focus each.
- CATEGORIES: Second level. Each gets a unique 3-letter UPPERCASE code within its segment. Create 2-10 per segment based on item density.

DENSITY-BASED GRANULARITY:
- 1-5 items on a topic → single category
- 6-15 items → 2-3 categories
- 15+ items → consider a dedicated segment with multiple categories

GUIDELINES:
- Group by TOPIC similarity, not source or format
- Reuse well-known codes when warranted (A for AI, T for Tech) but don't force
- Every segment needs at least 2 categories
- Category codes unique within segment

SOCIAL MEDIA CLASSIFICATION RULES:
- When a URL is from a social media platform (x.com, twitter.com, threads.net, reddit.com), classify by the POST CONTENT AND TOPIC, not the platform.
- A tweet ABOUT an AI agent tool → belongs in the AI/Agents category, NOT "Social Media".
- A tweet ABOUT trading bots → belongs in AI Trading category, NOT "Social Media".
- Only classify something as "Social Media" when the content is truly ABOUT social media as a subject (e.g., social media marketing strategies, platform analytics), or is personal commentary with no clear topical focus.
- Personal status updates with no clear topic → General Commentary or similar catch-all.

RESPONSE FORMAT: JSON object with two keys:
- "segments": array of {code, label, description}
- "categories": array of {segmentCode, code, label, description}`;

const ASSIGNMENT_SYSTEM_PROMPT = `You are a knowledge classifier. You will receive a taxonomy (segments and categories) and a batch of content items. Assign each item to the most appropriate segment and category from the provided taxonomy.

${CONTENT_TYPE_REFERENCE}

ORGANIZATION CODE: 4 uppercase letters for the company/org. Use 'UNKN' if unknown.

SOCIAL MEDIA CLASSIFICATION RULES:
- When a URL is from a social media platform (x.com, twitter.com, threads.net, reddit.com), classify by the POST CONTENT AND TOPIC, not the platform.
- A tweet ABOUT an AI agent tool → belongs in the AI/Agents category, NOT "Social Media".
- A tweet ABOUT trading bots → belongs in AI Trading category, NOT "Social Media".
- Only classify something as "Social Media" when the content is truly ABOUT social media as a subject (e.g., social media marketing strategies, platform analytics), or is personal commentary with no clear topical focus.
- Personal status updates with no clear topic → General Commentary or similar catch-all.

For each item, provide:
- nodeId: copy exactly from input
- segmentCode: from the provided taxonomy
- categoryCode: from the provided taxonomy
- subcategoryLabel: 2-4 word label (Title Case) or empty string
- contentType: 1-letter code from the content type list
- organization: 4-letter org code or UNKN
- quickPhrase: Ultra-brief tagline (max 100 chars, no period)
- description: 1-2 sentence summary (max 300 chars)
- functionTags: Comma-separated use-case phrases, 2-5 phrases
- confidence: 0.0-1.0

RESPONSE FORMAT: JSON object with key "assignments" containing array of assignment objects.`;

// ============================================================
// Prompt Builders
// ============================================================

function formatNodeForPrompt(node: CondensedNode, index: number): string {
  const parts = [`${index + 1}. [id:${node.id}] "${node.title}" — ${node.domain}`];
  if (node.quickPhrase) parts.push(`  Brief: ${node.quickPhrase}`);
  if (node.shortDescription) parts.push(`  Desc: ${node.shortDescription.slice(0, 150)}`);
  if (node.keyConcepts && node.keyConcepts.length > 0) {
    parts.push(`  Tags: ${node.keyConcepts.slice(0, 5).join(', ')}`);
  }
  // Flag social media posts so the LLM classifies by content topic, not platform
  if (node.domain && (node.domain.includes('x.com') || node.domain.includes('twitter.com') || node.domain.includes('reddit.com') || node.domain.includes('threads.net'))) {
    parts.push(`  [Source: social media post — classify by content topic, NOT platform]`);
  }
  return parts.join('\n');
}

/**
 * Build combined prompt for ≤150 nodes (taxonomy + assignments in one call)
 */
export function buildCombinedPrompt(nodes: CondensedNode[]): { system: string; user: string } {
  const itemList = nodes.map((n, i) => formatNodeForPrompt(n, i)).join('\n\n');
  return {
    system: COMBINED_SYSTEM_PROMPT,
    user: `Here are ${nodes.length} content items to organize. Create a taxonomy and assign every item.\n\nITEMS:\n${itemList}`,
  };
}

/**
 * Build taxonomy-only prompt for Phase A (>150 nodes)
 */
export function buildTaxonomyOnlyPrompt(nodes: CondensedNode[]): { system: string; user: string } {
  const itemList = nodes.map((n, i) => `${i + 1}. [${n.domain}] "${n.title}"${n.quickPhrase ? ` — ${n.quickPhrase}` : ''}`).join('\n');
  return {
    system: TAXONOMY_ONLY_SYSTEM_PROMPT,
    user: `Here are ${nodes.length} content items. Create a taxonomy that best organizes them.\n\nITEMS:\n${itemList}`,
  };
}

/**
 * Build assignment prompt for Phase B (batch of nodes against existing taxonomy)
 */
export function buildAssignmentPrompt(
  taxonomy: DynamicTaxonomy,
  nodes: CondensedNode[],
): { system: string; user: string } {
  const taxonomyStr = taxonomy.segments.map(seg => {
    const cats = taxonomy.categories
      .filter(c => c.segmentCode === seg.code)
      .map(c => `  ${c.code}: ${c.label}`)
      .join('\n');
    return `${seg.code}: ${seg.label}\n${cats}`;
  }).join('\n\n');

  const itemList = nodes.map((n, i) => formatNodeForPrompt(n, i)).join('\n\n');

  return {
    system: ASSIGNMENT_SYSTEM_PROMPT,
    user: `TAXONOMY:\n${taxonomyStr}\n\nITEMS (${nodes.length}):\n${itemList}`,
  };
}
