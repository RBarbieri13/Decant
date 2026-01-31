// ============================================================
// AI Classifier Service
// Uses OpenAI to classify and enrich URL content
// ============================================================

import OpenAI from 'openai';
import type { ScrapedContent } from './scraper.js';

export interface ClassificationResult {
  title: string;
  company: string | null;
  phraseDescription: string;
  shortDescription: string;
  keyConcepts: string[];
  segment: string;
  contentType: string;
  functionParentId: string | null;
  organizationParentId: string | null;
}

// Segment codes from the master plan
const SEGMENTS = {
  A: 'AI (artificial intelligence, ML, LLMs)',
  T: 'Technology (software, hardware, dev tools)',
  F: 'Finance (money, investing, FP&A)',
  S: 'Sports (football, fantasy, athletics)',
  H: 'Health (medical, wellness, accessibility)',
  B: 'Business (strategy, operations, management)',
  E: 'Entertainment (media, gaming, music)',
  L: 'Lifestyle (home, fashion, food, travel)',
  X: 'Science (research, academia)',
  C: 'Creative (design, art, writing)',
};

// Content type codes
const CONTENT_TYPES = {
  T: 'Website/Tool (interactive platform, SaaS)',
  A: 'Article (written content, blog, docs)',
  V: 'Video (YouTube, Vimeo)',
  P: 'Podcast (episodic audio/video)',
  R: 'Research Paper (academic, whitepaper)',
  G: 'Repository (GitHub, code libraries)',
  S: 'Social Post (Twitter, LinkedIn)',
  C: 'Course/Tutorial (structured learning)',
  I: 'Image/Graphic (infographics)',
  N: 'Newsletter (email content)',
  K: 'Book/eBook',
  U: 'Audio (music, sound files)',
};

const CLASSIFICATION_PROMPT = `You are an AI content classifier for a knowledge curation platform called Decant.

Analyze the following URL content and provide a structured classification.

SEGMENTS (choose one letter):
${Object.entries(SEGMENTS).map(([code, desc]) => `- ${code}: ${desc}`).join('\n')}

CONTENT TYPES (choose one letter):
${Object.entries(CONTENT_TYPES).map(([code, desc]) => `- ${code}: ${desc}`).join('\n')}

Respond with a JSON object containing:
{
  "title": "Improved/cleaned title (max 100 chars)",
  "company": "Company/organization name if identifiable, or null",
  "phraseDescription": "Ultra-brief tagline describing the content (max 100 chars)",
  "shortDescription": "1-3 sentence summary of what this content is about (max 500 chars)",
  "keyConcepts": ["array", "of", "lowercase", "tags", "max 10 items"],
  "segment": "Single letter code from SEGMENTS",
  "contentType": "Single letter code from CONTENT TYPES"
}

Be concise and accurate. Focus on the core value proposition of the content.`;

/**
 * Classify and enrich scraped content using AI
 */
export async function classifyContent(
  scraped: ScrapedContent,
  apiKey: string
): Promise<ClassificationResult> {
  const openai = new OpenAI({ apiKey });

  const userContent = `
URL: ${scraped.url}
Domain: ${scraped.domain}
Title: ${scraped.title}
Description: ${scraped.description || 'N/A'}
Author: ${scraped.author || 'N/A'}
Site Name: ${scraped.siteName || 'N/A'}

Content excerpt:
${scraped.content?.slice(0, 2000) || 'No content available'}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: CLASSIFICATION_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI classifier');
  }

  const parsed = JSON.parse(content);

  // Validate and sanitize the response
  return {
    title: sanitizeString(parsed.title, scraped.title, 100),
    company: parsed.company ? sanitizeString(parsed.company, null, 100) : null,
    phraseDescription: sanitizeString(parsed.phraseDescription, '', 100),
    shortDescription: sanitizeString(parsed.shortDescription, scraped.description || '', 500),
    keyConcepts: sanitizeKeyConcepts(parsed.keyConcepts),
    segment: validateCode(parsed.segment, Object.keys(SEGMENTS), 'T'),
    contentType: validateCode(parsed.contentType, Object.keys(CONTENT_TYPES), 'A'),
    functionParentId: null, // Will be set based on segment
    organizationParentId: null, // Will be set based on company
  };
}

/**
 * Sanitize a string value
 */
function sanitizeString(value: unknown, fallback: string | null, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback || '';
  }
  return value.trim().slice(0, maxLength);
}

/**
 * Sanitize key concepts array
 */
function sanitizeKeyConcepts(concepts: unknown): string[] {
  if (!Array.isArray(concepts)) {
    return [];
  }
  return concepts
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map(c => c.toLowerCase().trim())
    .slice(0, 10);
}

/**
 * Validate a code against allowed values
 */
function validateCode(value: unknown, allowed: string[], fallback: string): string {
  if (typeof value === 'string' && allowed.includes(value.toUpperCase())) {
    return value.toUpperCase();
  }
  return fallback;
}

/**
 * Get segment name from code
 */
export function getSegmentName(code: string): string {
  return SEGMENTS[code as keyof typeof SEGMENTS] || 'Unknown';
}

/**
 * Get content type name from code
 */
export function getContentTypeName(code: string): string {
  return CONTENT_TYPES[code as keyof typeof CONTENT_TYPES] || 'Unknown';
}
