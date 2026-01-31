// ============================================================
// Phase 1 Classification Prompt and Schema
// Quick classification for immediate organization
// ============================================================

import { z } from 'zod';

// ============================================================
// Segment and Content Type Definitions
// ============================================================

/**
 * Segment codes with descriptions
 */
export const SEGMENTS = {
  A: 'AI & Machine Learning - artificial intelligence, ML, LLMs, neural networks, NLP',
  T: 'Technology & Development - software, hardware, dev tools, programming, infrastructure',
  F: 'Finance & Economics - money, investing, FP&A, banking, crypto, markets',
  S: 'Sports & Fitness - football, fantasy, athletics, exercise, training',
  H: 'Health & Wellness - medical, wellness, accessibility, mental health, nutrition',
  B: 'Business & Productivity - strategy, operations, management, startups, SaaS',
  E: 'Entertainment & Media - movies, gaming, music, streaming, pop culture',
  L: 'Lifestyle & Personal - home, fashion, food, travel, hobbies',
  X: 'Science & Research - research, academia, physics, biology, chemistry',
  C: 'Creative & Design - design, art, writing, photography, visual arts',
} as const;

export type SegmentCode = keyof typeof SEGMENTS;

/**
 * Content type codes with descriptions
 */
export const CONTENT_TYPES = {
  T: 'Tool/Software - interactive platform, SaaS, app, utility',
  A: 'Article/Blog - written content, blog post, documentation',
  V: 'Video - YouTube, Vimeo, video content',
  P: 'Research Paper - academic paper, whitepaper, technical report',
  R: 'Repository - GitHub, GitLab, code library, open source project',
  G: 'Guide/Tutorial - how-to, tutorial, educational guide',
  S: 'Service/Platform - platform, service provider, marketplace',
  C: 'Course/Learning - online course, structured learning, bootcamp',
  I: 'Image/Visual - infographic, diagram, visual content',
  N: 'News - news article, current events, press release',
  K: 'Knowledge Base - wiki, documentation site, reference',
  U: 'Unknown - content type could not be determined',
} as const;

export type ContentTypeCode = keyof typeof CONTENT_TYPES;

/**
 * Category codes by segment (3 uppercase letters)
 */
export const CATEGORIES = {
  // AI & Machine Learning
  A: {
    LLM: 'Large Language Models',
    AGT: 'AI Agents',
    FND: 'Foundation Models',
    MLO: 'MLOps',
    NLP: 'Natural Language Processing',
    CVS: 'Computer Vision',
    GEN: 'Generative AI',
    ETH: 'AI Ethics',
    RES: 'AI Research',
    OTH: 'Other AI',
  },
  // Technology & Development
  T: {
    WEB: 'Web Development',
    MOB: 'Mobile Development',
    DEV: 'Developer Tools',
    CLD: 'Cloud & Infrastructure',
    SEC: 'Security',
    DAT: 'Data Engineering',
    API: 'APIs & Integrations',
    OPS: 'DevOps',
    HRD: 'Hardware',
    OTH: 'Other Tech',
  },
  // Finance & Economics
  F: {
    INV: 'Investing',
    CRY: 'Crypto & Blockchain',
    FPA: 'FP&A',
    BNK: 'Banking',
    TAX: 'Tax & Accounting',
    PFN: 'Personal Finance',
    MKT: 'Markets',
    REL: 'Real Estate',
    ECN: 'Economics',
    OTH: 'Other Finance',
  },
  // Sports & Fitness
  S: {
    NFL: 'NFL Football',
    FAN: 'Fantasy Sports',
    FIT: 'Fitness',
    RUN: 'Running',
    GYM: 'Gym & Training',
    NBA: 'Basketball',
    MLB: 'Baseball',
    SOC: 'Soccer',
    OLY: 'Olympics',
    OTH: 'Other Sports',
  },
  // Health & Wellness
  H: {
    MED: 'Medical',
    MNT: 'Mental Health',
    NUT: 'Nutrition',
    SLP: 'Sleep',
    ACC: 'Accessibility',
    WEL: 'Wellness',
    FRT: 'Fertility',
    AGE: 'Aging',
    DIS: 'Disease',
    OTH: 'Other Health',
  },
  // Business & Productivity
  B: {
    STR: 'Strategy',
    MNG: 'Management',
    PRD: 'Product',
    MKT: 'Marketing',
    SAL: 'Sales',
    OPS: 'Operations',
    HRS: 'HR & People',
    STP: 'Startups',
    ENT: 'Enterprise',
    OTH: 'Other Business',
  },
  // Entertainment & Media
  E: {
    GAM: 'Gaming',
    MUS: 'Music',
    MOV: 'Movies & TV',
    STR: 'Streaming',
    SOC: 'Social Media',
    POP: 'Pop Culture',
    POD: 'Podcasts',
    CEL: 'Celebrities',
    EVT: 'Events',
    OTH: 'Other Entertainment',
  },
  // Lifestyle & Personal
  L: {
    HOM: 'Home',
    FAS: 'Fashion',
    FOD: 'Food & Cooking',
    TRV: 'Travel',
    REL: 'Relationships',
    PAR: 'Parenting',
    PET: 'Pets',
    HOB: 'Hobbies',
    GAR: 'Garden',
    OTH: 'Other Lifestyle',
  },
  // Science & Research
  X: {
    PHY: 'Physics',
    BIO: 'Biology',
    CHM: 'Chemistry',
    AST: 'Astronomy',
    ENV: 'Environment',
    MAT: 'Mathematics',
    ENG: 'Engineering',
    SOC: 'Social Sciences',
    PSY: 'Psychology',
    OTH: 'Other Science',
  },
  // Creative & Design
  C: {
    UXD: 'UX Design',
    GRD: 'Graphic Design',
    WRT: 'Writing',
    PHO: 'Photography',
    VID: 'Video Production',
    AUD: 'Audio Production',
    ART: 'Fine Art',
    ANI: 'Animation',
    TYP: 'Typography',
    OTH: 'Other Creative',
  },
} as const;

/**
 * Common organization codes (4 uppercase letters)
 */
export const COMMON_ORGANIZATIONS = {
  ANTH: 'Anthropic',
  OAIA: 'OpenAI',
  GOOG: 'Google',
  MSFT: 'Microsoft',
  META: 'Meta',
  AMZN: 'Amazon',
  AAPL: 'Apple',
  NFLX: 'Netflix',
  NVDA: 'NVIDIA',
  GHUB: 'GitHub',
  STRP: 'Stripe',
  TWTR: 'Twitter/X',
  LINK: 'LinkedIn',
  SPOT: 'Spotify',
  SLCK: 'Slack',
  ZOOM: 'Zoom',
  FIGM: 'Figma',
  NTON: 'Notion',
  DSCR: 'Discord',
  RDIT: 'Reddit',
  YCTB: 'Y Combinator',
  HWRD: 'Harvard',
  STFD: 'Stanford',
  MIT_: 'MIT',
  UNKN: 'Unknown',
} as const;

// ============================================================
// Zod Schema for Phase 1 Classification Response
// ============================================================

/**
 * Schema for validating Phase 1 classification response from LLM
 */
export const Phase1ClassificationSchema = z.object({
  segment: z
    .string()
    .length(1)
    .regex(/^[ATFSHBELXC]$/, 'Must be a valid segment code')
    .describe('Single uppercase letter segment code'),

  category: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Must be 3 uppercase letters')
    .describe('Three uppercase letter category code'),

  contentType: z
    .string()
    .length(1)
    .regex(/^[TAVPRGSCINKU]$/, 'Must be a valid content type code')
    .describe('Single uppercase letter content type code'),

  organization: z
    .string()
    .length(4)
    .regex(/^[A-Z_]{4}$/, 'Must be 4 uppercase letters or underscores')
    .describe('Four uppercase letter organization code'),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0 and 1'),

  reasoning: z
    .string()
    .max(200)
    .optional()
    .describe('Brief explanation for the classification'),
});

export type Phase1Classification = z.infer<typeof Phase1ClassificationSchema>;

// ============================================================
// System Prompt for Phase 1 Classification
// ============================================================

export const PHASE1_SYSTEM_PROMPT = `You are a content classification AI for Decant, a knowledge curation platform.

Your task is to quickly classify web content into predefined categories. Be decisive and confident.

## SEGMENTS (choose one letter):
${Object.entries(SEGMENTS).map(([code, desc]) => `- ${code}: ${desc}`).join('\n')}

## CONTENT TYPES (choose one letter):
${Object.entries(CONTENT_TYPES).map(([code, desc]) => `- ${code}: ${desc}`).join('\n')}

## CATEGORIES (3 uppercase letters based on segment):

### AI & Machine Learning (A):
${Object.entries(CATEGORIES.A).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Technology & Development (T):
${Object.entries(CATEGORIES.T).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Finance & Economics (F):
${Object.entries(CATEGORIES.F).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Sports & Fitness (S):
${Object.entries(CATEGORIES.S).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Health & Wellness (H):
${Object.entries(CATEGORIES.H).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Business & Productivity (B):
${Object.entries(CATEGORIES.B).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Entertainment & Media (E):
${Object.entries(CATEGORIES.E).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Lifestyle & Personal (L):
${Object.entries(CATEGORIES.L).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Science & Research (X):
${Object.entries(CATEGORIES.X).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

### Creative & Design (C):
${Object.entries(CATEGORIES.C).map(([code, name]) => `- ${code}: ${name}`).join('\n')}

## ORGANIZATION CODES (4 uppercase letters):
Identify the primary company/organization. Use standard codes like:
${Object.entries(COMMON_ORGANIZATIONS).slice(0, 15).map(([code, name]) => `- ${code}: ${name}`).join('\n')}
- For other organizations, create a sensible 4-letter code
- Use UNKN if organization is unclear

## RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "segment": "X",           // 1 uppercase letter
  "category": "XXX",        // 3 uppercase letters matching segment
  "contentType": "X",       // 1 uppercase letter
  "organization": "XXXX",   // 4 uppercase letters
  "confidence": 0.0-1.0,    // How confident you are
  "reasoning": "Brief explanation (optional, max 200 chars)"
}

## GUIDELINES:
1. Choose the MOST RELEVANT segment, even if content spans multiple
2. Category MUST match the chosen segment's categories
3. For content type, analyze the format not just the topic
4. Confidence: >0.9 for clear cases, 0.7-0.9 for typical, <0.7 if uncertain
5. Be decisive - avoid "Unknown" unless truly ambiguous`;

// ============================================================
// User Prompt Builder
// ============================================================

export interface Phase1PromptInput {
  url: string;
  title: string;
  domain?: string;
  description?: string;
  author?: string;
  siteName?: string;
  contentExcerpt?: string;
}

/**
 * Build the user prompt for Phase 1 classification
 */
export function buildPhase1UserPrompt(input: Phase1PromptInput): string {
  const parts: string[] = [
    `Classify this web content:`,
    ``,
    `URL: ${input.url}`,
    `Title: ${input.title}`,
  ];

  if (input.domain) {
    parts.push(`Domain: ${input.domain}`);
  }

  if (input.description) {
    parts.push(`Description: ${input.description}`);
  }

  if (input.author) {
    parts.push(`Author: ${input.author}`);
  }

  if (input.siteName) {
    parts.push(`Site Name: ${input.siteName}`);
  }

  if (input.contentExcerpt) {
    parts.push(``);
    parts.push(`Content excerpt:`);
    // Limit content to ~1500 chars to save tokens
    parts.push(input.contentExcerpt.slice(0, 1500));
  }

  return parts.join('\n');
}

// ============================================================
// Default/Fallback Classification
// ============================================================

/**
 * Default classification when AI fails or is unavailable
 */
export const DEFAULT_CLASSIFICATION: Phase1Classification = {
  segment: 'T',
  category: 'OTH',
  contentType: 'A',
  organization: 'UNKN',
  confidence: 0,
  reasoning: 'Fallback classification - AI classification failed',
};

/**
 * Create a fallback classification with partial information
 */
export function createFallbackClassification(
  partial?: Partial<Phase1Classification>
): Phase1Classification {
  return {
    ...DEFAULT_CLASSIFICATION,
    ...partial,
    confidence: partial?.confidence ?? 0,
    reasoning: partial?.reasoning ?? 'Fallback classification applied',
  };
}
