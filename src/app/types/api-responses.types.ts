/**
 * Base pagination types for API list responses
 * All list endpoints return wrapped responses with pagination metadata
 */

/**
 * Pagination metadata included in all list responses
 */
export interface PaginationMetadata {
  /** Total number of items matching the query (before pagination) */
  total: number;
  /** Maximum number of items returned per page */
  limit: number;
  /** Number of items skipped from the beginning */
  offset: number;
}
