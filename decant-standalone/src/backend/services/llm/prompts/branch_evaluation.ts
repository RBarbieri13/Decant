// ============================================================
// Branch Evaluation Prompt & Schema
// ============================================================
// LLM prompt for evaluating whether a hierarchy branch should
// be split into sub-branches, and if so, which dimension to
// use as the discriminator.

import { z } from 'zod';

// ============================================================
// Types
// ============================================================

export const CANDIDATE_DIMENSIONS = [
  'function',
  'domain',
  'technology',
  'concept',
  'audience',
  'platform',
  'organization',
  'resource_type',
  'industry',
  'pricing',
  'topic_cluster',
] as const;

export type CandidateDimension = typeof CANDIDATE_DIMENSIONS[number];

// ============================================================
// Schema
// ============================================================

export const ProposedChildSchema = z.object({
  label: z.string().max(80).describe('Human-readable branch name. Title Case. Specific enough to distinguish from siblings.'),
  discriminatorValue: z.string().max(100).describe('The value of the chosen dimension for this child branch.'),
  nodeIds: z.array(z.string()).min(1).describe('IDs of nodes that belong in this child branch.'),
  cohesionScore: z.number().min(0).max(1).describe('How semantically tight this group is. 0.9+ = very cohesive.'),
});

export const BranchEvaluationSchema = z.object({
  shouldSplit: z.boolean().describe('Whether this branch should be split into sub-branches.'),
  reason: z.string().max(300).describe('Explanation of why the branch should or should not be split.'),
  bestDimension: z.enum(CANDIDATE_DIMENSIONS).describe('The dimension that produces the most meaningful split. Only relevant if shouldSplit is true.'),
  proposedChildren: z.array(ProposedChildSchema).describe('Proposed child branches. Empty array if shouldSplit is false.'),
  branchCohesion: z.number().min(0).max(1).describe('Overall cohesion of the current branch as-is. Low cohesion suggests splitting is needed.'),
  confidence: z.number().min(0).max(1).describe('Confidence in this evaluation.'),
});

export type BranchEvaluation = z.infer<typeof BranchEvaluationSchema>;
export type ProposedChild = z.infer<typeof ProposedChildSchema>;

// ============================================================
// Condensed Node for Branch Evaluation
// ============================================================

export interface BranchNodeSummary {
  id: string;
  title: string;
  company: string;
  primaryFunction: string;
  primaryDomain: string;
  resourceType: string;
  topConcepts: string[];
  topTechnologies: string[];
  audience: string[];
  platform: string[];
  phraseDescription: string;
}

export interface BranchContext {
  branchId: string;
  branchLabel: string;
  branchDepth: number;
  parentLabel: string | null;
  parentDimension: string | null;
  discriminatorDimension: string | null;
  discriminatorValue: string | null;
  nodes: BranchNodeSummary[];
}

// ============================================================
// Prompt Builders
// ============================================================

const SYSTEM_PROMPT = `You are a knowledge organization expert. You evaluate groups of resources and decide whether they should be subdivided into more specific sub-groups.

You are evaluating a single BRANCH in a dynamic hierarchy. The branch contains a set of resources (URLs/tools/articles/etc). Your job is to determine:

1. Is this branch internally diverse enough that splitting it would help users browse and understand the contents?
2. If yes, which DIMENSION produces the most meaningful and balanced split?
3. How should the resources be distributed across the proposed child branches?

CANDIDATE DIMENSIONS for splitting:
- function: What the resources DO (e.g., "code generation" vs "code review" vs "testing")
- domain: Knowledge area (e.g., "computer vision" vs "natural language processing")
- technology: Tech stack (e.g., "Python" vs "JavaScript" vs "Rust")
- concept: Core concepts (e.g., "transformers" vs "diffusion models" vs "reinforcement learning")
- audience: Who it's for (e.g., "developers" vs "researchers" vs "enterprise")
- platform: Where it runs (e.g., "web" vs "API" vs "CLI" vs "mobile")
- organization: Who made it (e.g., "OpenAI" vs "Anthropic" vs "Google")
- resource_type: What kind of content (e.g., "tools" vs "articles" vs "videos")
- industry: Vertical market (e.g., "healthcare" vs "finance" vs "education")
- pricing: Business model (e.g., "open source" vs "freemium" vs "enterprise")
- topic_cluster: When no single structured dimension works, identify semantic clusters by topic similarity

SPLITTING RULES:

1. DO NOT split if:
   - The branch has 3 or fewer resources
   - All resources are already semantically similar (cohesion > 0.85)
   - The proposed children would be too small (any child < 2 resources)
   - The distinction between children would be weak or confusing
   - Additional depth would not meaningfully help navigation

2. DO split when:
   - The branch spans multiple clearly distinct functions
   - The branch covers multiple separable concept clusters
   - The branch includes multiple technologies, audiences, or platforms that users would naturally want to browse separately
   - A single label is too broad to describe the branch contents well

3. QUALITY RULES for proposed children:
   - Every child must have at least 2 resources
   - Labels must be human-readable and specific (not "Other" or "Miscellaneous" unless truly necessary)
   - Children should be roughly balanced — avoid one giant group and several tiny ones
   - The chosen dimension should produce groups that a human would naturally recognize
   - Do NOT create an "Other" catch-all child unless some resources genuinely don't fit any other group

4. DIMENSION SELECTION:
   - Choose the dimension that creates the most INTERPRETABLE split
   - Prefer dimensions where the values are distinct and recognizable
   - If "function" produces clear groups, prefer it over "technology"
   - If resources are all the same function but differ by technology, use "technology"
   - The best dimension may change at different depths — don't assume the same dimension works everywhere

5. EVERY resource must be assigned to exactly one child branch. Do not leave any resource unassigned.

Respond with valid JSON in this exact format:
{
  "shouldSplit": true/false,
  "reason": "explanation string",
  "bestDimension": "one of: function|domain|technology|concept|audience|platform|organization|resource_type|industry|pricing|topic_cluster",
  "proposedChildren": [
    {
      "label": "Child Branch Name",
      "discriminatorValue": "the value for this group",
      "nodeIds": ["id1", "id2"],
      "cohesionScore": 0.85
    }
  ],
  "branchCohesion": 0.5,
  "confidence": 0.8
}

If shouldSplit is false, set proposedChildren to an empty array []. Always include ALL fields.`;

export function buildBranchEvaluationPrompt(context: BranchContext): {
  system: string;
  user: string;
} {
  const parts: string[] = [
    `BRANCH: "${context.branchLabel}"`,
    `Depth: ${context.branchDepth}`,
  ];

  if (context.parentLabel) {
    parts.push(`Parent: "${context.parentLabel}" (split by ${context.parentDimension || 'unknown'})`);
  }

  if (context.discriminatorDimension) {
    parts.push(`Current discriminator: ${context.discriminatorDimension} = "${context.discriminatorValue}"`);
  }

  parts.push(`\nResources in this branch (${context.nodes.length} total):\n`);

  for (const node of context.nodes) {
    const line = [
      `[${node.id}] "${node.title}"`,
      `  Company: ${node.company}`,
      `  Function: ${node.primaryFunction}`,
      `  Domain: ${node.primaryDomain}`,
      `  Type: ${node.resourceType}`,
      node.topConcepts.length > 0 ? `  Concepts: ${node.topConcepts.join(', ')}` : null,
      node.topTechnologies.length > 0 ? `  Technologies: ${node.topTechnologies.join(', ')}` : null,
      node.audience.length > 0 ? `  Audience: ${node.audience.join(', ')}` : null,
      node.platform.length > 0 ? `  Platform: ${node.platform.join(', ')}` : null,
      node.phraseDescription ? `  Description: ${node.phraseDescription}` : null,
    ].filter(Boolean).join('\n');

    parts.push(line);
    parts.push('');
  }

  parts.push('Evaluate whether this branch should be split. If yes, propose child branches with specific resource assignments.');

  return {
    system: SYSTEM_PROMPT,
    user: parts.join('\n'),
  };
}

// ============================================================
// Response Parsing
// ============================================================

export function parseBranchEvaluationResponse(raw: string): BranchEvaluation {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned);
  const result = BranchEvaluationSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Branch evaluation validation failed: ${issues}`);
  }

  return result.data;
}

// ============================================================
// Branch Label Generation Prompt
// ============================================================

export const BranchLabelSchema = z.object({
  label: z.string().max(80).describe('Human-readable branch name. Title Case.'),
  description: z.string().max(200).describe('Brief description of what this branch contains.'),
});

export type BranchLabel = z.infer<typeof BranchLabelSchema>;

export function buildBranchLabelPrompt(nodeTitles: string[], parentLabel: string | null): {
  system: string;
  user: string;
} {
  return {
    system: `You name categories in a knowledge hierarchy. Given a list of resource titles that belong together, generate a concise, human-readable label (2-5 words, Title Case) and a brief description. The label should clearly describe what unifies these resources. Respond with valid JSON.`,
    user: [
      parentLabel ? `Parent category: "${parentLabel}"` : '',
      `Resources:`,
      ...nodeTitles.map(t => `- ${t}`),
      '',
      'Generate a label and description for this group.',
    ].filter(Boolean).join('\n'),
  };
}
