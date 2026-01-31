// ============================================================
// Pagination Types and Helpers
// ============================================================

/**
 * Parameters for paginated queries
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Pagination metadata included in paginated responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const MIN_LIMIT = 1;

/**
 * Builds a paginated response object from query results
 *
 * @param data - The array of items for the current page
 * @param total - Total count of items across all pages
 * @param page - Current page number (1-indexed)
 * @param limit - Number of items per page
 * @returns A PaginatedResponse object
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore,
    },
  };
}

/**
 * Calculates the SQL OFFSET value from page and limit
 *
 * @param page - Current page number (1-indexed)
 * @param limit - Number of items per page
 * @returns The offset value for SQL queries
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Validates and normalizes pagination parameters
 *
 * @param page - Raw page parameter (may be undefined or invalid)
 * @param limit - Raw limit parameter (may be undefined or invalid)
 * @returns Validated pagination parameters with defaults applied
 */
export function validatePaginationParams(
  page?: number | string | null,
  limit?: number | string | null
): PaginationParams {
  let normalizedPage = DEFAULT_PAGE;
  let normalizedLimit = DEFAULT_LIMIT;

  // Parse and validate page
  if (page !== undefined && page !== null) {
    const parsedPage = typeof page === 'string' ? parseInt(page, 10) : page;
    if (!isNaN(parsedPage) && parsedPage >= 1) {
      normalizedPage = parsedPage;
    }
  }

  // Parse and validate limit
  if (limit !== undefined && limit !== null) {
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    if (!isNaN(parsedLimit)) {
      normalizedLimit = Math.min(Math.max(parsedLimit, MIN_LIMIT), MAX_LIMIT);
    }
  }

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
}
