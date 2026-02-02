/**
 * Utility functions for pagination calculations and URL state management.
 */

import { Params } from '@angular/router';
import {
  PaginationState,
  DEFAULT_PAGE_SIZE,
  PAGINATION_QUERY_PARAMS,
} from '../../types/pagination.types';

/**
 * Calculates the offset for API calls based on page index and page size.
 *
 * @param pageIndex - The current page index (0-based)
 * @param pageSize - The number of items per page
 * @returns The offset value for the API request
 *
 * @example
 * ```typescript
 * calculateOffset(0, 25); // 0 (first page)
 * calculateOffset(1, 25); // 25 (second page)
 * calculateOffset(2, 10); // 20 (third page with 10 items per page)
 * ```
 */
export function calculateOffset(pageIndex: number, pageSize: number): number {
  return pageIndex * pageSize;
}

/**
 * Calculates the page index from an API offset value.
 *
 * @param offset - The offset from the API response
 * @param pageSize - The number of items per page
 * @returns The page index (0-based)
 *
 * @example
 * ```typescript
 * calculatePageIndex(0, 25);  // 0
 * calculatePageIndex(25, 25); // 1
 * calculatePageIndex(20, 10); // 2
 * ```
 */
export function calculatePageIndex(offset: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 0;
  }
  return Math.floor(offset / pageSize);
}

/**
 * Parses pagination state from URL query parameters.
 *
 * @param params - The query parameters from ActivatedRoute
 * @param defaultPageSize - The default page size if not specified in URL
 * @returns Partial pagination state from URL params
 *
 * @example
 * ```typescript
 * const params = { page: '2', size: '50' };
 * parsePaginationFromUrl(params);
 * // { pageIndex: 2, pageSize: 50 }
 * ```
 */
export function parsePaginationFromUrl(
  params: Params,
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): Pick<PaginationState, 'pageIndex' | 'pageSize'> {
  const pageParam = params[PAGINATION_QUERY_PARAMS.PAGE];
  const sizeParam = params[PAGINATION_QUERY_PARAMS.SIZE];
  const pageIndex = parseInt(typeof pageParam === 'string' ? pageParam : '0', 10);
  const pageSize = parseInt(typeof sizeParam === 'string' ? sizeParam : String(defaultPageSize), 10);

  return {
    pageIndex: isNaN(pageIndex) || pageIndex < 0 ? 0 : pageIndex,
    pageSize: isNaN(pageSize) || pageSize <= 0 ? defaultPageSize : pageSize,
  };
}

/**
 * Builds URL query parameters from pagination state and optional filter.
 * Only includes non-default values to keep URLs clean.
 *
 * @param state - The pagination state
 * @param filterText - Optional filter text
 * @param defaultPageSize - The default page size (excluded from URL if matching)
 * @returns Query params object for router navigation
 *
 * @example
 * ```typescript
 * buildPaginationQueryParams({ pageIndex: 2, pageSize: 50, total: 100 }, 'search');
 * // { page: '2', size: '50', filter: 'search' }
 *
 * buildPaginationQueryParams({ pageIndex: 0, pageSize: 25, total: 100 });
 * // {} (all defaults, empty params)
 * ```
 */
export function buildPaginationQueryParams(
  state: PaginationState,
  filterText?: string,
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): Params {
  const params: Params = {};

  // Only include page if not first page
  if (state.pageIndex > 0) {
    params[PAGINATION_QUERY_PARAMS.PAGE] = String(state.pageIndex);
  }

  // Only include size if not default
  if (state.pageSize !== defaultPageSize) {
    params[PAGINATION_QUERY_PARAMS.SIZE] = String(state.pageSize);
  }

  // Only include filter if non-empty
  if (filterText && filterText.trim()) {
    params[PAGINATION_QUERY_PARAMS.FILTER] = filterText.trim();
  }

  return params;
}

/**
 * Determines if the current page should be adjusted after a deletion.
 * When the last item on a page is deleted, we should go back one page.
 *
 * @param currentPageIndex - Current page index
 * @param itemsOnPage - Number of items remaining on the current page after deletion
 * @param total - Total items after deletion
 * @returns The adjusted page index
 *
 * @example
 * ```typescript
 * // Last item on page 2 deleted, go back to page 1
 * adjustPageAfterDeletion(2, 0, 50); // 1
 *
 * // Still items on current page, stay there
 * adjustPageAfterDeletion(2, 5, 50); // 2
 *
 * // First page, stay there
 * adjustPageAfterDeletion(0, 0, 0); // 0
 * ```
 */
export function adjustPageAfterDeletion(
  currentPageIndex: number,
  itemsOnPage: number,
  total: number,
): number {
  // If there are still items on the page, stay on current page
  if (itemsOnPage > 0) {
    return currentPageIndex;
  }

  // If on first page or no items left, stay on first page
  if (currentPageIndex === 0 || total === 0) {
    return 0;
  }

  // Go back one page
  return currentPageIndex - 1;
}
