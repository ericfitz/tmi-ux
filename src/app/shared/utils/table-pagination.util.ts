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

export interface PaginationRequestParams {
  limit: number;
  offset: number;
}

export class TablePaginationManager<T> {
  pageIndex = 0;
  pageSize: number;
  total = 0;
  readonly pageSizeOptions: readonly number[];

  private items: T[] = [];

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
  getRequestParams(): PaginationRequestParams {
    return {
      limit: this.pageSize,
      offset: calculateOffset(this.pageIndex, this.pageSize),
    };
  }

  /**
   * Update pagination state from an API response
   */
  updateFromResponse(items: T[], total: number): void {
    this.items = items;
    this.total = total;
  }

  /**
   * Handle a page change event from MatPaginator
   * Returns true if the page changed and data should be reloaded
   */
  onPageChange(event: PageEvent): boolean {
    const pageChanged = event.pageIndex !== this.pageIndex || event.pageSize !== this.pageSize;

    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;

    return pageChanged;
  }

  /**
   * Reset to the first page (e.g., after filtering or data changes)
   */
  resetToFirstPage(): void {
    this.pageIndex = 0;
  }

  /**
   * Adjust page after an item deletion
   * Returns true if the page index changed
   */
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
export function createSubtablePagination<T>(): TablePaginationManager<T> {
  return new TablePaginationManager<T>(SUBTABLE_PAGE_SIZE_OPTIONS, DEFAULT_SUBTABLE_PAGE_SIZE);
}
