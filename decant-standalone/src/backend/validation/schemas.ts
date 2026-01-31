// ============================================================
// Zod Validation Schemas
// ============================================================

import { z } from 'zod';

// ============================================================
// Node Schemas
// ============================================================

/**
 * Schema for creating a new node
 * Matches CreateNodeInput interface in database/nodes.ts
 */
export const CreateNodeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less'),
  url: z.string().url('Must be a valid URL'),
  source_domain: z.string().min(1, 'Source domain is required'),
  company: z.string().max(200, 'Company must be 200 characters or less').optional(),
  phrase_description: z.string().max(1000, 'Phrase description must be 1000 characters or less').optional(),
  short_description: z.string().max(2000, 'Short description must be 2000 characters or less').optional(),
  logo_url: z.string().url('Logo URL must be a valid URL').optional().or(z.literal('')).or(z.null()),
  ai_summary: z.string().max(5000, 'AI summary must be 5000 characters or less').optional(),
  extracted_fields: z.record(z.string(), z.any()).optional(),
  metadata_tags: z.array(z.string()).optional(),
  key_concepts: z.array(z.string()).optional(),
  function_parent_id: z.string().uuid('Function parent ID must be a valid UUID').nullable().optional(),
  organization_parent_id: z.string().uuid('Organization parent ID must be a valid UUID').nullable().optional(),
});

/**
 * Schema for updating an existing node
 * All fields are optional since it's a partial update
 */
export const UpdateNodeSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(500, 'Title must be 500 characters or less').optional(),
  company: z.string().max(200, 'Company must be 200 characters or less').optional(),
  phrase_description: z.string().max(1000, 'Phrase description must be 1000 characters or less').optional(),
  short_description: z.string().max(2000, 'Short description must be 2000 characters or less').optional(),
  logo_url: z.string().url('Logo URL must be a valid URL').optional().or(z.literal('')).or(z.null()),
  ai_summary: z.string().max(5000, 'AI summary must be 5000 characters or less').optional(),
  extracted_fields: z.record(z.string(), z.any()).optional(),
  metadata_tags: z.array(z.string()).optional(),
  key_concepts: z.array(z.string()).optional(),
  function_parent_id: z.string().uuid('Function parent ID must be a valid UUID').nullable().optional(),
  organization_parent_id: z.string().uuid('Organization parent ID must be a valid UUID').nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// ============================================================
// Import Schemas
// ============================================================

/**
 * Schema for URL import
 * Validates that the URL is well-formed and uses http/https protocol
 */
export const ImportUrlSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .url('Must be a valid URL')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'URL must use http or https protocol' }
    ),
});

/**
 * Schema for setting API key
 */
export const SetApiKeySchema = z.object({
  apiKey: z.string()
    .min(1, 'API key is required')
    .min(20, 'API key appears to be too short'),
});

// ============================================================
// Search Schemas
// ============================================================

/**
 * Schema for search query parameters
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query "q" is required').max(500, 'Search query must be 500 characters or less'),
  filters: z.string().optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional()
    .transform((val) => val ? parseInt(val, 10) : undefined)
    .pipe(z.number().min(1).max(100).optional()),
  offset: z.string().regex(/^\d+$/, 'Offset must be a number').optional()
    .transform((val) => val ? parseInt(val, 10) : undefined)
    .pipe(z.number().min(0).optional()),
});

/**
 * Schema for filtered search request body (POST /api/search/filtered)
 */
export const FilteredSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query must be 500 characters or less'),
  filters: z.object({
    segments: z.array(z.string().length(1, 'Segment code must be 1 character')).optional(),
    categories: z.array(z.string().max(10, 'Category code must be 10 characters or less')).optional(),
    contentTypes: z.array(z.string().length(1, 'Content type code must be 1 character')).optional(),
    organizations: z.array(z.string().max(200, 'Organization name must be 200 characters or less')).optional(),
    dateRange: z.object({
      start: z.string().datetime({ message: 'Start date must be a valid ISO date string' }).optional(),
      end: z.string().datetime({ message: 'End date must be a valid ISO date string' }).optional(),
    }).optional(),
    hasCompleteMetadata: z.boolean().optional(),
  }).optional(),
  page: z.number().int().min(1, 'Page must be at least 1').optional(),
  limit: z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100').optional(),
});

// ============================================================
// Move & Merge Schemas
// ============================================================

/**
 * Hierarchy type enum values
 */
const hierarchyValues = ['function', 'organization'] as const;

/**
 * Schema for moving a node to a new parent
 */
export const MoveNodeSchema = z.object({
  targetParentId: z.string().uuid('Target parent ID must be a valid UUID').nullable().optional(),
  targetHierarchy: z.enum(hierarchyValues, {
    message: 'Target hierarchy must be either "function" or "organization"',
  }),
});

/**
 * Schema for merging two nodes
 */
export const MergeNodesSchema = z.object({
  secondaryId: z.string().uuid('Secondary node ID must be a valid UUID'),
  options: z.object({
    keepMetadata: z.boolean().optional(),
    appendSummary: z.boolean().optional(),
  }).optional(),
});

// ============================================================
// URL Parameter Schemas
// ============================================================

/**
 * Schema for validating UUID path parameters
 */
export const UuidParamSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
});

/**
 * Schema for validating hierarchy view parameter
 */
export const HierarchyViewParamSchema = z.object({
  view: z.enum(hierarchyValues, {
    message: 'View must be either "function" or "organization"',
  }),
});

// ============================================================
// Type Exports
// ============================================================

export type CreateNodeInput = z.infer<typeof CreateNodeSchema>;
export type UpdateNodeInput = z.infer<typeof UpdateNodeSchema>;
export type ImportUrlInput = z.infer<typeof ImportUrlSchema>;
export type SetApiKeyInput = z.infer<typeof SetApiKeySchema>;
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type FilteredSearchInput = z.infer<typeof FilteredSearchSchema>;
export type MoveNodeInput = z.infer<typeof MoveNodeSchema>;
export type MergeNodesInput = z.infer<typeof MergeNodesSchema>;
export type UuidParam = z.infer<typeof UuidParamSchema>;
export type HierarchyViewParam = z.infer<typeof HierarchyViewParamSchema>;
