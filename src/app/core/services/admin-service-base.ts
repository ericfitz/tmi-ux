/**
 * Abstract base class for admin services.
 * Provides common patterns for state management, error handling, and CRUD operations.
 *
 * @template T The entity type (e.g., Administrator, AdminUser, AdminGroup)
 * @template F The filter type for list operations
 */

import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

/**
 * Configuration for an admin service
 */
export interface AdminServiceConfig {
  /** Base API endpoint (e.g., 'admin/users', 'admin/groups') */
  endpoint: string;
  /** Entity name for logging (e.g., 'user', 'group', 'administrator') */
  entityName: string;
}

/**
 * Abstract base class for admin services with common CRUD patterns
 */
export abstract class AdminServiceBase<T, F extends object = object> {
  protected itemsSubject$ = new BehaviorSubject<T[]>([]);
  public items$: Observable<T[]> = this.itemsSubject$.asObservable();

  constructor(
    protected apiService: ApiService,
    protected logger: LoggerService,
    protected config: AdminServiceConfig,
  ) {}

  /**
   * Extract items array from the list response.
   * Override this in derived classes to handle different response structures.
   * @param response The API response
   * @returns Array of items
   */
  protected abstract extractItems(response: unknown): T[];

  /**
   * Get the ID field from an item for logging.
   * Override this in derived classes if the ID field is named differently.
   * @param item The item to get the ID from
   * @returns The item's ID as a string
   */
  protected getItemId(item: T): string {
    const record = item as Record<string, unknown>;
    return (record['id'] ?? record['internal_uuid'] ?? 'unknown') as string;
  }

  /**
   * List items with optional filtering.
   * Derived classes should call this and cast the return type appropriately.
   */
  protected listItems<R>(filter?: F): Observable<R> {
    const params = buildHttpParams(filter);
    return this.apiService.get<R>(this.config.endpoint, params).pipe(
      tap(response => {
        const items = this.extractItems(response);
        this.itemsSubject$.next(items);
        this.logger.debug(`${this.capitalize(this.config.entityName)}s loaded`, {
          count: items.length,
        });
      }),
      catchError(error => {
        this.logger.error(`Failed to list ${this.config.entityName}s`, error);
        throw error;
      }),
    );
  }

  /**
   * Get a single item by ID.
   * Derived classes should call this and cast the return type appropriately.
   */
  protected getItem(id: string): Observable<T> {
    return this.apiService.get<T>(`${this.config.endpoint}/${id}`).pipe(
      tap(item => {
        this.logger.debug(`${this.capitalize(this.config.entityName)} loaded`, {
          id: this.getItemId(item),
        });
      }),
      catchError(error => {
        this.logger.error(`Failed to get ${this.config.entityName}`, error);
        throw error;
      }),
    );
  }

  /**
   * Create a new item.
   * Derived classes should call this and cast the return type appropriately.
   * @param request The creation request data
   * @param refreshAfter Whether to refresh the list after creation (default: true)
   */
  protected createItem(request: Record<string, unknown>, refreshAfter = true): Observable<T> {
    return this.apiService.post<T>(this.config.endpoint, request).pipe(
      tap(item => {
        this.logger.info(`${this.capitalize(this.config.entityName)} created`, {
          id: this.getItemId(item),
        });
        if (refreshAfter) {
          this.refreshList();
        }
      }),
      catchError(error => {
        this.logger.error(`Failed to create ${this.config.entityName}`, error);
        throw error;
      }),
    );
  }

  /**
   * Update an existing item.
   * @param id The item's ID
   * @param request The update request data
   * @param refreshAfter Whether to refresh the list after update (default: true)
   */
  protected updateItem(
    id: string,
    request: Record<string, unknown>,
    refreshAfter = true,
  ): Observable<T> {
    return this.apiService.put<T>(`${this.config.endpoint}/${id}`, request).pipe(
      tap(item => {
        this.logger.info(`${this.capitalize(this.config.entityName)} updated`, {
          id: this.getItemId(item),
        });
        if (refreshAfter) {
          this.refreshList();
        }
      }),
      catchError(error => {
        this.logger.error(`Failed to update ${this.config.entityName}`, error);
        throw error;
      }),
    );
  }

  /**
   * Delete an item by ID.
   * @param id The item's ID
   * @param refreshAfter Whether to refresh the list after deletion (default: true)
   */
  protected deleteItem(id: string, refreshAfter = true): Observable<void> {
    return this.apiService.delete<void>(`${this.config.endpoint}/${id}`).pipe(
      tap(() => {
        this.logger.info(`${this.capitalize(this.config.entityName)} deleted`, { id });
        if (refreshAfter) {
          this.refreshList();
        }
      }),
      catchError(error => {
        this.logger.error(`Failed to delete ${this.config.entityName}`, error);
        throw error;
      }),
    );
  }

  /**
   * Refresh the items list. Override in derived classes if needed.
   */
  protected refreshList(): void {
    // Derived classes should implement this to call their list() method
  }

  /**
   * Capitalize the first letter of a string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
