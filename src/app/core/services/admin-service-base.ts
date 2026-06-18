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
// SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: abstract base providing reactive CRUD operations and state for admin entity services (mutates shared state)
export abstract class AdminServiceBase<T, F extends object = object> {
  protected itemsSubject$ = new BehaviorSubject<T[]>([]);
  public items$: Observable<T[]> = this.itemsSubject$.asObservable();

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: inject API service, logger, and endpoint config into the base admin service (pure)
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: abstract hook to parse the entity array from an API list response (pure)
  protected abstract extractItems(response: unknown): T[];

  /**
   * Get the ID field from an item for logging.
   * Override this in derived classes if the ID field is named differently.
   * @param item The item to get the ID from
   * @returns The item's ID as a string
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: resolve the string ID from an entity record for logging purposes (pure)
  protected getItemId(item: T): string {
    const record = item as Record<string, unknown>;
    return (record['id'] ?? record['internal_uuid'] ?? 'unknown') as string;
  }

  /**
   * List items with optional filtering.
   * Derived classes should call this and cast the return type appropriately.
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch entities from the API with optional filter params and update the shared list (reads DB)
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch a single admin entity by ID from the API
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: store a new admin entity via POST and optionally refresh the list
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: update an existing admin entity by ID via PUT and optionally refresh the list
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: delete an admin entity by ID and optionally refresh the list
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: hook for derived classes to reload the entity list (mutates shared state)
  protected refreshList(): void {
    // Derived classes should implement this to call their list() method
  }

  /**
   * Capitalize the first letter of a string
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: convert a string's first character to uppercase (pure)
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
