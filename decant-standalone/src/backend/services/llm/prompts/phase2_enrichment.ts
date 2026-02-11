// ============================================================
// Phase 2 Enrichment Prompt and Schema
// Deep analysis for comprehensive content classification
// ============================================================

import { z } from 'zod';

/**
 * Metadata code type identifiers
 * These must match the metadata_codes table type values
 */
export const METADATA_CODE_TYPES = {
  ORG: 'ORG', // Organization (e.g., ANTHROPIC, OPENAI, GOOGLE)
  DOM: 'DOM', // Domain (e.g., AI_SAFETY, ML_OPS, DEVTOOLS)
  FNC: 'FNC', // Functions (e.g., CODEGEN, REASONING, EMBEDDING)
  TEC: 'TEC', // Technologies (e.g., API, PYTHON, TYPESCRIPT)
  CON: 'CON', // Concepts (e.g., LLM, AI_SAFETY, PROMPT_ENGINEERING)
  IND: 'IND', // Industries (e.g., TECHNOLOGY, HEALTHCARE, FINANCE)
  AUD: 'AUD', // Audience (e.g., DEVELOPER, ENTERPRISE, RESEARCHER)
  PRC: 'PRC', // Pricing (e.g., PAID, FREE, FREEMIUM, API_CREDITS)
  PLT: 'PLT', // Platforms (e.g., WEB, API, CLI, MOBILE)
} as const;

export type MetadataCodeType = keyof typeof METADATA_CODE_TYPES;

/**
 * Metadata code categories with descriptions for LLM guidance
 */
export const METADATA_CODE_CATEGORIES = {
  ORG: 'Organization - The company/entity (UPPERCASE, e.g., ANTHROPIC, OPENAI, GOOGLE, MICROSOFT)',
  DOM: 'Domain - Primary business/tech domain (UPPERCASE, e.g., AI_SAFETY, ML_OPS, DEVTOOLS, CLOUD)',
  FNC: 'Function - What it does/capabilities (UPPERCASE, e.g., CODEGEN, REASONING, EMBEDDING, SEARCH)',
  TEC: 'Technology - Specific technologies used (UPPERCASE, e.g., API, PYTHON, TYPESCRIPT, REACT)',
  CON: 'Concept - Key concepts/topics (UPPERCASE, e.g., LLM, PROMPT_ENGINEERING, RAG, FINE_TUNING)',
  IND: 'Industry - Target industries (UPPERCASE, e.g., TECHNOLOGY, HEALTHCARE, FINANCE, EDUCATION)',
  AUD: 'Audience - Target users (UPPERCASE, e.g., DEVELOPER, ENTERPRISE, RESEARCHER, BEGINNER)',
  PRC: 'Pricing - Pricing model (UPPERCASE, e.g., PAID, FREE, FREEMIUM, OPEN_SOURCE, API_CREDITS)',
  PLT: 'Platform - Deployment platforms (UPPERCASE, e.g., WEB, API, CLI, MOBILE, DESKTOP)',
} as const;

/**
 * Schema for individual metadata code
 * Must be uppercase alphanumeric with underscores
 */
export const MetadataCodeSchema = z.string()
  .max(50, 'Code max 50 characters');

/**
 * Schema for metadata codes object returned by LLM
 */
export const MetadataCodesSchema = z.object({
  ORG: z.array(MetadataCodeSchema).max(5).default([]).describe('Organization codes'),
  DOM: z.array(MetadataCodeSchema).max(5).default([]).describe('Domain codes'),
  FNC: z.array(MetadataCodeSchema).max(5).default([]).describe('Function codes'),
  TEC: z.array(MetadataCodeSchema).max(5).default([]).describe('Technology codes'),
  CON: z.array(MetadataCodeSchema).max(5).default([]).describe('Concept codes'),
  IND: z.array(MetadataCodeSchema).max(5).default([]).describe('Industry codes'),
  AUD: z.array(MetadataCodeSchema).max(5).default([]).describe('Audience codes'),
  PRC: z.array(MetadataCodeSchema).max(5).default([]).describe('Pricing codes'),
  PLT: z.array(MetadataCodeSchema).max(5).default([]).describe('Platform codes'),
});

export type MetadataCodes = z.infer<typeof MetadataCodesSchema>;

/**
 * Zod schema for Phase 2 enrichment result
 */
export const Phase2EnrichmentSchema = z.object({
  title: z
    .string()
    .max(500)
    .describe('Improved/cleaned title, max 500 characters'),
  company: z
    .string()
    .max(200)
    .describe('Organization or company behind the content'),
  phraseDescription: z
    .string()
    .max(100)
    .describe('Ultra-brief tagline, max 100 characters'),
  shortDescription: z
    .string()
    .max(500)
    .describe('1-3 sentence summary, max 500 characters'),
  aiSummary: z
    .string()
    .max(5000)
    .optional()
    .describe('Comprehensive AI-generated summary with detailed analysis, max 5000 characters'),
  keyConcepts: z
    .array(z.string().toLowerCase())
    .max(20)
    .describe('Lowercase tags/keywords, max 20 items'),
  metadataTags: z
    .array(z.string().toLowerCase())
    .max(10)
    .optional()
    .describe('Basic metadata tags for categorization, max 10 items'),
  logoUrl: z
    .string()
    .url()
    .optional()
    .nullable()
    .describe('URL to favicon or logo extracted from the page'),
  metadataCodes: MetadataCodesSchema
    .describe('Faceted metadata classification codes (UPPERCASE)'),
  codeConfidence: z
    .number()
    .min(0)
    .max(1)
    .default(0.9)
    .optional()
    .describe('Confidence score for metadata codes (0-1)'),
});

export type Phase2EnrichmentResult = z.infer<typeof Phase2EnrichmentSchema>;

/**
 * Extended result including derived fields
 */
export interface Phase2EnrichmentOutput extends Phase2EnrichmentResult {
  descriptorString: string;
}

/**
 * Phase 2 system prompt for deep content analysis
 */
export const PHASE2_SYSTEM_PROMPT = `You are an expert content analyst for Decant, a knowledge curation platform. Your task is to perform deep analysis of web content to extract comprehensive metadata for organization and discovery.

## Your Role

Analyze the provided content and extract structured metadata following the schema exactly. Be thorough, accurate, and consistent in your classifications.

## Metadata Code Categories

For each category, provide relevant UPPERCASE codes that describe the content. Use underscores for multi-word codes (e.g., AI_SAFETY not AISAFETY).

${Object.entries(METADATA_CODE_CATEGORIES)
  .map(([code, desc]) => `- **${code}**: ${desc}`)
  .join('\n')}

## Code Format Rules

1. **UPPERCASE ONLY**: All metadata codes must be uppercase (e.g., ANTHROPIC not anthropic)
2. **UNDERSCORES for spaces**: Use underscores between words (e.g., AI_SAFETY not "AI SAFETY")
3. **ALPHANUMERIC + UNDERSCORE**: Only letters, numbers, and underscores allowed
4. **MAX 5 per category**: Limit to the most relevant codes per category
5. **BE SPECIFIC**: Prefer specific codes over generic ones (e.g., TYPESCRIPT over CODE)

## Code Examples by Category

- **ORG**: ANTHROPIC, OPENAI, GOOGLE, MICROSOFT, META, NVIDIA, HUGGINGFACE
- **DOM**: AI_SAFETY, ML_OPS, DEVTOOLS, CLOUD, DATA_SCIENCE, SECURITY
- **FNC**: CODEGEN, REASONING, EMBEDDING, SEARCH, CLASSIFICATION, SUMMARIZATION
- **TEC**: API, PYTHON, TYPESCRIPT, REACT, KUBERNETES, DOCKER, PYTORCH
- **CON**: LLM, PROMPT_ENGINEERING, RAG, FINE_TUNING, AGENT, MULTIMODAL
- **IND**: TECHNOLOGY, HEALTHCARE, FINANCE, EDUCATION, LEGAL, RETAIL
- **AUD**: DEVELOPER, ENTERPRISE, RESEARCHER, BEGINNER, DATA_SCIENTIST
- **PRC**: PAID, FREE, FREEMIUM, OPEN_SOURCE, API_CREDITS, ENTERPRISE_ONLY
- **PLT**: WEB, API, CLI, MOBILE, DESKTOP, BROWSER_EXTENSION, SLACK_APP

## Guidelines

1. **Title**: Clean and improve the title if needed. Remove site names, unnecessary punctuation, or marketing language. Keep it concise but descriptive. Max 500 characters.

2. **Company**: Identify the organization behind the content. For open-source projects, use the project name. For personal blogs, use the author's name or "Independent".

3. **Phrase Description**: Create a punchy, memorable tagline (max 100 chars). Think elevator pitch.

4. **Short Description**: Write 1-3 clear sentences explaining what this content is and why someone would find it valuable. Max 500 characters.

5. **AI Summary**: Write a DETAILED, comprehensive analysis (5-8 substantial paragraphs) covering:
   - **WHAT IT IS**: Detailed explanation with SPECIFIC features, capabilities, technical architecture, and implementation details (NEVER use generic words like "powerful", "flexible", "robust" without specific examples)

   - **WHY IT EXISTS**: The SPECIFIC problem this solves, WHO faces this problem (concrete user personas with job titles, company sizes, industries), and WHAT the pain points are (with real-world examples)

   - **HOW IT WORKS**: Key features with CONCRETE examples:
     * Actual API endpoints and methods (e.g., "POST /v1/chat/completions")
     * Specific technical capabilities (e.g., "supports 128k context window")
     * Real implementation examples (e.g., "integrates via REST API or Python SDK")
     * NOT "useful for many applications" - instead: "enables X by doing Y"

   - **WHO SHOULD USE IT**: Ideal user personas with SPECIFICS:
     * Job titles (e.g., "ML Engineers at Series B-C startups")
     * Company characteristics (e.g., "teams of 10-50 with <$5M ARR")
     * Technical skill level (e.g., "requires Python 3.8+ and API experience")
     * Use case categories (e.g., "RAG systems, customer support chatbots, document Q&A")

   - **WHAT MAKES IT UNIQUE**: Comparative analysis:
     * Mention 2-3 specific alternatives/competitors by name
     * State quantitative differences (e.g., "3x faster than GPT-3.5", "$0.002 per 1K tokens vs $0.004")
     * Unique features competitors lack (with specifics)
     * Trade-offs vs alternatives (what you gain and what you lose)

   - **MARKET CONTEXT & ADOPTION**:
     * Pricing tiers with SPECIFIC numbers (e.g., "Free: 1M tokens/month, Pro: $20/month for 10M tokens")
     * Technical constraints (e.g., "100 requests/minute rate limit, requires HTTPS")
     * Platform requirements (e.g., "Node.js 16+, Python 3.8+, or REST API")
     * Adoption indicators (e.g., "10,000+ GitHub stars", "Used by Airbnb, Stripe")
     * Limitations and gotchas (e.g., "no streaming for batch jobs", "24hr data retention")

   CRITICAL DEPTH REQUIREMENTS - VIOLATIONS WILL BE REJECTED:
   ✅ DO: "Claude 3 Opus supports 200k token context window, costs $15 per 1M input tokens, and achieves 88.7% on MMLU"
   ❌ DON'T: "Claude is a powerful AI that can handle many tasks"

   ✅ DO: "Ideal for ML engineers at mid-stage startups (Series B-C, 10-100 employees) building RAG systems"
   ❌ DON'T: "Great for developers who need AI capabilities"

   ✅ DO: "Compared to GPT-4, Claude 3 Opus is 2x more expensive but excels at complex reasoning and longer documents"
   ❌ DON'T: "Better than alternatives for various use cases"

   Max 5000 characters (approximately 700-900 words of dense, specific analysis).

6. **Key Concepts**: Extract 10-20 lowercase tags covering:
   - Primary topics and themes
   - Technologies mentioned
   - Use cases and applications
   - Target audience indicators

7. **Metadata Tags**: Provide 5-10 basic lowercase tags for general categorization.

8. **Logo URL**: If you can determine the favicon or logo URL from the domain, provide it. If uncertain, omit this field or set to null.

9. **Metadata Codes**: Classify using UPPERCASE codes following the format rules above.

10. **Code Confidence**: Provide a confidence score (0-1) for how certain you are about the metadata codes. Use 0.9+ for very clear cases, 0.7-0.9 for moderate confidence, below 0.7 for uncertain.

11. **Quality Standards for Metadata Codes**: When generating metadata codes, ensure:
   - **ORG codes**: Include the actual company/project name (e.g., "ORG:OpenAI", not generic "ORG:AI_Company")
   - **FNC codes**: Be specific about the function (e.g., "FNC:Text_to_Speech", not "FNC:AI")
   - **TEC codes**: List actual technologies/languages (e.g., "TEC:Python", "TEC:React", "TEC:PostgreSQL")
   - **IND codes**: Specify actual industries (e.g., "IND:Healthcare", "IND:Finance", not "IND:Business")
   - **AUD codes**: Define clear user personas (e.g., "AUD:Data_Scientists", "AUD:Frontend_Developers")
   - **PRC codes**: Include actual pricing info if available (e.g., "PRC:Freemium", "PRC:Enterprise_Only", "PRC:Open_Source")
   - **CON codes**: Extract specific concepts from content (e.g., "CON:Neural_Networks", "CON:API_Design")
   - Aim for 8-15 total metadata codes covering all relevant categories
   - Prioritize specificity and accuracy over quantity

## Output Format

Respond with valid JSON matching the schema. Key concepts and metadata tags should be lowercase, but metadata codes should be UPPERCASE. Be comprehensive but accurate - only include codes that genuinely apply to the content.`;

/**
 * Generate user prompt for Phase 2 enrichment
 */
export function generatePhase2UserPrompt(input: {
  url: string;
  domain: string;
  existingTitle: string;
  existingDescription?: string;
  content?: string;
  existingKeyConcepts?: string[];
  existingSegment?: string;
  existingContentType?: string;
}): string {
  const sections: string[] = [
    `## URL Analysis Request`,
    ``,
    `**URL**: ${input.url}`,
    `**Domain**: ${input.domain}`,
    `**Current Title**: ${input.existingTitle}`,
  ];

  if (input.existingDescription) {
    sections.push(`**Current Description**: ${input.existingDescription}`);
  }

  if (input.existingKeyConcepts && input.existingKeyConcepts.length > 0) {
    sections.push(
      `**Existing Tags**: ${input.existingKeyConcepts.join(', ')}`
    );
  }

  if (input.existingSegment) {
    sections.push(`**Initial Segment**: ${input.existingSegment}`);
  }

  if (input.existingContentType) {
    sections.push(`**Content Type**: ${input.existingContentType}`);
  }

  if (input.content) {
    sections.push(``);
    sections.push(`## Content Excerpt`);
    sections.push(``);
    sections.push('```');
    sections.push(input.content.slice(0, 3000));
    sections.push('```');
  }

  sections.push(``);
  sections.push(
    `Analyze this content and provide comprehensive Phase 2 enrichment metadata. Remember: metadata codes must be UPPERCASE with underscores (e.g., AI_SAFETY, PROMPT_ENGINEERING). Include codeConfidence score.`
  );

  return sections.join('\n');
}

/**
 * Generate descriptor string from enrichment result
 * Format: [Title]|[SourceDomain]|[Company]|[PhraseDesc]|[ShortDesc]|[KeyConcepts joined by |]
 */
export function generateDescriptorString(
  result: Phase2EnrichmentResult,
  sourceDomain: string
): string {
  const parts: string[] = [];

  // Add title
  if (result.title) {
    parts.push(result.title);
  }

  // Add source domain
  if (sourceDomain) {
    parts.push(sourceDomain);
  }

  // Add company
  if (result.company) {
    parts.push(result.company);
  }

  // Add phrase description
  if (result.phraseDescription) {
    parts.push(result.phraseDescription);
  }

  // Add short description
  if (result.shortDescription) {
    parts.push(result.shortDescription);
  }

  // Add key concepts
  if (result.keyConcepts && result.keyConcepts.length > 0) {
    parts.push(...result.keyConcepts);
  }

  // Add metadata codes (as lowercase for search)
  for (const [, codes] of Object.entries(result.metadataCodes)) {
    if (codes && codes.length > 0) {
      parts.push(...codes.map(c => c.toLowerCase()));
    }
  }

  // Join with pipe delimiter and normalize
  return parts
    .filter((p) => p && p.trim().length > 0)
    .join('|')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a metadata code to ensure proper format
 * - Uppercase
 * - Replace spaces/hyphens with underscores
 * - Remove invalid characters
 * - Limit length to 50
 */
export function normalizeMetadataCode(code: string): string | null {
  if (!code || typeof code !== 'string') return null;

  const normalized = code
    .toUpperCase()
    .replace(/[\s-]+/g, '_')       // Replace spaces/hyphens with underscores
    .replace(/[^A-Z0-9_]/g, '')    // Remove invalid characters
    .replace(/^_+|_+$/g, '')       // Trim leading/trailing underscores
    .replace(/_+/g, '_')           // Collapse multiple underscores
    .slice(0, 50);                 // Limit length

  // Must start with a letter and have at least 2 characters
  if (normalized.length < 2 || !/^[A-Z]/.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Validate and normalize metadata codes from LLM response
 * Returns cleaned codes with invalid ones filtered out
 */
export function normalizeMetadataCodes(codes: Partial<MetadataCodes>): MetadataCodes {
  const result: MetadataCodes = {
    ORG: [],
    DOM: [],
    FNC: [],
    TEC: [],
    CON: [],
    IND: [],
    AUD: [],
    PRC: [],
    PLT: [],
  };

  for (const type of Object.keys(result) as MetadataCodeType[]) {
    const inputCodes = codes[type];
    if (Array.isArray(inputCodes)) {
      const normalized = inputCodes
        .map(normalizeMetadataCode)
        .filter((c): c is string => c !== null)
        .slice(0, 5); // Max 5 per type
      result[type] = normalized;
    }
  }

  return result;
}

/**
 * Validate and parse Phase 2 enrichment response
 */
export function parsePhase2Response(
  response: string,
  sourceDomain: string
): Phase2EnrichmentOutput | null {
  try {
    // Try to extract JSON from the response
    let jsonStr = response;

    // Handle markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr);

    // Normalize metadata codes before validation
    if (parsed.metadataCodes) {
      parsed.metadataCodes = normalizeMetadataCodes(parsed.metadataCodes);
    }

    const validated = Phase2EnrichmentSchema.parse(parsed);

    // Generate descriptor string with spec-compliant format
    const descriptorString = generateDescriptorString(validated, sourceDomain);

    return {
      ...validated,
      descriptorString,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Default/empty enrichment result
 */
export function createEmptyEnrichmentResult(
  title: string,
  company: string = 'Unknown',
  sourceDomain: string = ''
): Phase2EnrichmentOutput {
  const result: Phase2EnrichmentResult = {
    title,
    company,
    phraseDescription: '',
    shortDescription: '',
    aiSummary: '',
    keyConcepts: [],
    metadataTags: [],
    logoUrl: null,
    metadataCodes: {
      ORG: [],
      DOM: [],
      FNC: [],
      TEC: [],
      CON: [],
      IND: [],
      AUD: [],
      PRC: [],
      PLT: [],
    },
    codeConfidence: 0,
  };

  return {
    ...result,
    descriptorString: generateDescriptorString(result, sourceDomain),
  };
}
