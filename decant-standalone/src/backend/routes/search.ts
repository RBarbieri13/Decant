// ============================================================
// Search API Routes
// ============================================================

import { Request, Response } from 'express';
import {
  searchNodes as dbSearchNodes,
  countSearchResults,
  searchNodesAdvanced,
  SearchFilters,
} from '../database/search.js';
import {
  validatePaginationParams,
  buildPaginatedResponse,
} from '../types/pagination.js';

/**
 * Parse search filters from query parameters
 */
function parseSearchFilters(query: any): SearchFilters | undefined {
  const filters: SearchFilters = {};
  let hasFilters = false;

  // Segment filter
  if (query.segment && typeof query.segment === 'string') {
    filters.segment = query.segment.toUpperCase();
    hasFilters = true;
  }

  // Category filter
  if (query.category && typeof query.category === 'string') {
    filters.category = query.category.toUpperCase();
    hasFilters = true;
  }

  // Content type filter
  if (query.contentType && typeof query.contentType === 'string') {
    filters.contentType = query.contentType.toUpperCase();
    hasFilters = true;
  }

  // Organization filter
  if (query.organization && typeof query.organization === 'string') {
    filters.organization = query.organization;
    hasFilters = true;
  }

  // Date range filter
  if (query.dateStart || query.dateEnd) {
    filters.dateRange = {};
    if (query.dateStart && typeof query.dateStart === 'string') {
      filters.dateRange.start = query.dateStart;
    }
    if (query.dateEnd && typeof query.dateEnd === 'string') {
      filters.dateRange.end = query.dateEnd;
    }
    hasFilters = true;
  }

  // Has metadata filter
  if (query.hasMetadata !== undefined) {
    const hasMetadataValue = query.hasMetadata === 'true' || query.hasMetadata === '1';
    filters.hasMetadata = hasMetadataValue;
    hasFilters = true;
  }

  return hasFilters ? filters : undefined;
}

/**
 * GET /api/search
 * Basic search endpoint (backward compatible)
 * Required: ?q=searchterm
 * Optional pagination: ?page=1&limit=20
 * If no pagination params are provided, returns results without pagination wrapper (backward compatible)
 * If pagination params are provided, returns paginated response with metadata
 */
export async function search(req: Request, res: Response): Promise<void> {
  try {
    const { q: query, filters, page, limit } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    // Check if pagination was requested
    const hasPaginationParams = page !== undefined || limit !== undefined;

    if (hasPaginationParams) {
      // Validate and normalize pagination parameters
      const pagination = validatePaginationParams(
        page as string | undefined,
        limit as string | undefined
      );

      // Get paginated results and total count
      const results = dbSearchNodes(query, filters, pagination);
      const total = countSearchResults(query, filters);

      // Return paginated response
      res.json(buildPaginatedResponse(results, total, pagination.page, pagination.limit));
    } else {
      // Backward compatible: return results without pagination wrapper
      const results = dbSearchNodes(query, filters);
      res.json(results);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/search/advanced
 * Advanced search endpoint with filters and facets
 *
 * Query Parameters:
 * - q (required): Search query string
 * - segment: Filter by segment code (A, E, R, S, M)
 * - category: Filter by category code (e.g., LLM, AGT, FND)
 * - contentType: Filter by content type code (T, V, D, G, C)
 * - organization: Filter by organization/company name (partial match)
 * - dateStart: Filter by start date (ISO date string)
 * - dateEnd: Filter by end date (ISO date string)
 * - hasMetadata: Only show nodes with Phase 2 enrichment (true/false)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 *
 * Response Format:
 * {
 *   results: Array<SearchResultItem>,
 *   facets: {
 *     segments: Record<string, number>,
 *     categories: Record<string, number>,
 *     contentTypes: Record<string, number>,
 *     organizations: Array<{ name: string; count: number }>
 *   },
 *   total: number,
 *   page: number,
 *   pageSize: number
 * }
 *
 * Example:
 * GET /api/search/advanced?q=machine+learning&segment=A&contentType=T&page=1&limit=20
 */
export async function searchAdvanced(req: Request, res: Response): Promise<void> {
  try {
    const { q: query, page, limit } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    // Parse filters from query parameters
    const filters = parseSearchFilters(req.query);

    // Validate and normalize pagination parameters
    const pagination = validatePaginationParams(
      page as string | undefined,
      limit as string | undefined
    );

    // Execute advanced search with filters and facets
    const response = searchNodesAdvanced(query, filters, pagination);

    res.json(response);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
