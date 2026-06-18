/**
 * Reusable table pagination state manager.
 * Encapsulates pagination state and handlers for mat-table with mat-paginator.
 *
 * Usage:
 * ```typescript
 * // In component class:
 * assetsPagination = new TablePaginationManager<Asset>(
 *   SUBTABLE_PAGE_SIZE_OPTIONS,
 *   DEFAULT_SUBTABLE_PAGE_SIZE
 * );
 *
 * // In load method:
 * loadAssets(): void {
 *   const { limit, offset } = this.assetsPagination.getRequestParams();
 *   this.service.getAssets(id, limit, offset).subscribe(response => {
 *     this.assetsPagination.updateFromResponse(response.assets, response.total);
 *     this.assetsDataSource.data = response.assets;
 *   });
 * }
 *
 * // In template:
 * <mat-paginator
 *   [length]="assetsPagination.total"
 *   [pageSize]="assetsPagination.pageSize"
 *   [pageIndex]="assetsPagination.pageIndex"
 *   [pageSizeOptions]="assetsPagination.pageSizeOptions"
 *   (page)="onAssetsPageChange($event)">
 * </mat-paginator>
 * ```
 */

import { PageEvent } from '@angular/material/paginator';
import {
  DEFAULT_SUBTABLE_PAGE_SIZE,
  SUBTABLE_PAGE_SIZE_OPTIONS,
} from '../../types/pagination.types';
import { calculateOffset } from './pagination.util';

interface PaginationRequestParams {
  limit: number;
  offset: number;
}

// SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: manage paginator state and API request params for a mat-table (mutates shared state)
export class TablePaginationManager<T> {
  pageIndex = 0;
  pageSize: number;
  total = 0;
  readonly pageSizeOptions: readonly number[];

  private items: T[] = [];

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: initialize pagination state with configurable page size options and default size
  constructor(
    pageSizeOptions: readonly number[] = SUBTABLE_PAGE_SIZE_OPTIONS,
    defaultPageSize: number = DEFAULT_SUBTABLE_PAGE_SIZE,
  ) {
    this.pageSizeOptions = pageSizeOptions;
    this.pageSize = defaultPageSize;
  }

  /**
   * Get the limit and offset parameters for an API request
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: compute the limit and offset params for the current page API request (pure)
  getRequestParams(): PaginationRequestParams {
    return {
      limit: this.pageSize,
      offset: calculateOffset(this.pageIndex, this.pageSize),
    };
  }

  /**
   * Update pagination state from an API response
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: store items and total count from an API response (mutates shared state)
  updateFromResponse(items: T[], total: number): void {
    this.items = items;
    this.total = total;
  }

  /**
   * Handle a page change event from MatPaginator
   * Returns true if the page changed and data should be reloaded
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle a paginator page event and signal whether a data reload is needed (mutates shared state)
  onPageChange(event: PageEvent): boolean {
    const pageChanged = event.pageIndex !== this.pageIndex || event.pageSize !== this.pageSize;

    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;

    return pageChanged;
  }

  /**
   * Reset to the first page (e.g., after filtering or data changes)
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: reset pagination cursor to page zero (mutates shared state)
  resetToFirstPage(): void {
    this.pageIndex = 0;
  }

  /**
   * Adjust page after an item deletion
   * Returns true if the page index changed
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: decrement page index and total after an item deletion (mutates shared state)
  adjustAfterDeletion(): boolean {
    const itemsOnPage = this.items.length - 1;
    const newTotal = this.total - 1;

    if (itemsOnPage <= 0 && this.pageIndex > 0) {
      this.pageIndex--;
      this.total = newTotal;
      return true;
    }

    this.total = newTotal;
    return false;
  }

  /**
   * Check if pagination should be shown (more than one page of items)
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: compute whether total items exceed one page size (pure)
  shouldShowPaginator(): boolean {
    return this.total > this.pageSizeOptions[0];
  }

  /**
   * Get current items count
   */
  get itemCount(): number {
    return this.items.length;
  }
}

/**
 * Factory function to create a pagination manager for sub-tables
 */
// SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: build a pagination manager pre-configured for sub-table page sizes (pure)
export function createSubtablePagination<T>(): TablePaginationManager<T> {
  return new TablePaginationManager<T>(SUBTABLE_PAGE_SIZE_OPTIONS, DEFAULT_SUBTABLE_PAGE_SIZE);
}
