/**
 * Pagination types and constants for list interfaces
 * Used with MatPaginator for server-side pagination
 */

/**
 * State object for tracking pagination in components
 */
export interface PaginationState {
  /** Current page index (0-based) */
  pageIndex: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  total: number;
}

/**
 * Default page size for list views
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Default page size for sub-tables within a view (e.g., diagrams within TM edit)
 */
export const DEFAULT_SUBTABLE_PAGE_SIZE = 10;

/**
 * Available page size options for paginator dropdowns
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Page size options for sub-tables (smaller set)
 */
export const SUBTABLE_PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

/**
 * URL query parameter names for pagination and filter state
 */
export const PAGINATION_QUERY_PARAMS = {
  PAGE: 'page',
  SIZE: 'size',
  /** @deprecated Use SEARCH instead — kept for admin page backward compatibility */
  FILTER: 'filter',
  SEARCH: 'search',
  NAME: 'name',
  DESCRIPTION: 'description',
  STATUS: 'status',
  OWNER: 'owner',
  ISSUE_URI: 'issue_uri',
  CREATED_AFTER: 'created_after',
  CREATED_BEFORE: 'created_before',
  MODIFIED_AFTER: 'modified_after',
  MODIFIED_BEFORE: 'modified_before',
  STATUS_UPDATED_AFTER: 'status_updated_after',
  STATUS_UPDATED_BEFORE: 'status_updated_before',
} as const;
