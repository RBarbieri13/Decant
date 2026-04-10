// ============================================================
// Natural Language Filter Parser (feature #9)
// ============================================================
// Takes a free-text search query like "voice generation from
// last week starred" and returns a structured filter payload
// the frontend can apply to columnFilters + hierarchyFilter.

import { z } from 'zod';
import { createProvider } from './llm/provider.js';
import { log } from '../logger/index.js';

export const NLFilterResultSchema = z.object({
  columnFilters: z.object({
    title: z.string().optional(),
    type: z.string().optional(),
    category: z.string().optional(),
    dateAdded: z.string().optional(),
    quickPhrase: z.string().optional(),
    function: z.string().optional(),
    tags: z.string().optional(),
    userTags: z.string().optional(),
  }).default({}),
  hierarchyFilter: z.object({
    segment: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
  }).nullable().optional(),
  starredOnly: z.boolean().optional(),
  surfaceMode: z.enum(['read_later', 'reference', 'all']).optional(),
  dateRange: z.object({
    from: z.string().nullable().optional(),
    to: z.string().nullable().optional(),
  }).nullable().optional(),
  humanReadable: z.string().max(200),
});

export type NLFilterResult = z.infer<typeof NLFilterResultSchema>;

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const SYSTEM_PROMPT = [
  'You convert natural language search queries into structured filter payloads for a knowledge-base UI.',
  '',
  'Given a free-text query, return JSON matching the schema. Rules:',
  '- columnFilters: partial matches (LIKE). Leave out keys that do not apply.',
  '- hierarchyFilter: only set segment/category when the query clearly names a taxonomic bucket.',
  '- starredOnly: true only if the query explicitly says "starred", "favorites", "bookmarked".',
  '- surfaceMode: "read_later" for "to read", "unread", "queue". "reference" for "archive", "library", "docs". Default omitted.',
  `- dateRange: parse relative dates into ISO 8601. Assume today is ${TODAY_ISO}.`,
  '- humanReadable: one short sentence echoing what you understood.',
  '',
  'Never invent fields. Never include raw SQL. Never include explanations outside the JSON.',
].join('\n');

const CACHE = new Map<string, { result: NLFilterResult; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 20;

function cacheGet(key: string): NLFilterResult | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return entry.result;
}

function cacheSet(key: string, result: NLFilterResult): void {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(key, { result, ts: Date.now() });
}

export async function parseNLQuery(
  query: string,
  apiKey: string,
): Promise<NLFilterResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      columnFilters: {},
      humanReadable: 'Empty query — no filters applied.',
    };
  }

  const cached = cacheGet(trimmed);
  if (cached) return cached;

  const provider = createProvider({ type: 'openai', apiKey, model: 'gpt-4o-mini' });

  try {
    const { data } = await provider.completeWithSchema(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
      NLFilterResultSchema,
      { temperature: 0.1, maxTokens: 500 },
    );

    cacheSet(trimmed, data);
    return data;
  } catch (err) {
    log.warn('nl_filter parse failed, falling back to title-only', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      columnFilters: { title: trimmed },
      humanReadable: `Couldn't parse — searching titles for "${trimmed}".`,
    };
  }
}
