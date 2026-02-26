import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AdminServiceBase } from './admin-service-base';
import {
  Addon,
  AddonFilter,
  CreateAddonRequest,
  InvokeAddonRequest,
  InvokeAddonResponse,
  ListAddonsResponse,
} from '@app/types/addon.types';

/**
 * Service for managing addons
 * Handles CRUD operations for system addons
 */
@Injectable({
  providedIn: 'root',
})
export class AddonService extends AdminServiceBase<Addon, AddonFilter> {
  public addons$: Observable<Addon[]> = this.items$;

  constructor(apiService: ApiService, logger: LoggerService) {
    super(apiService, logger, {
      endpoint: 'addons',
      entityName: 'addon',
    });
  }

  protected extractItems(response: unknown): Addon[] {
    const listResponse = response as ListAddonsResponse;
    const addons = listResponse.addons ?? [];
    if (!listResponse.addons) {
      this.logger.warn('API response missing addons array', { response });
    }
    return addons;
  }

  /**
   * List all addons with optional filtering
   */
  public list(filter?: AddonFilter): Observable<ListAddonsResponse> {
    return this.listItems<ListAddonsResponse>(filter);
  }

  /**
   * Get a specific addon by ID
   */
  public get(id: string): Observable<Addon> {
    return this.getItem(id);
  }

  /**
   * Create a new addon
   */
  public create(request: CreateAddonRequest): Observable<Addon> {
    return this.createItem(request as unknown as Record<string, unknown>);
  }

  /**
   * Update an existing addon
   */
  public update(id: string, request: CreateAddonRequest): Observable<Addon> {
    return this.updateItem(id, request as unknown as Record<string, unknown>);
  }

  /**
   * Delete an addon
   */
  public delete(id: string): Observable<void> {
    return this.deleteItem(id);
  }

  /**
   * Invoke an addon with the given parameters
   * @param id The addon ID to invoke
   * @param request The invocation request parameters
   * @returns Observable with the invocation response (202 Accepted)
   */
  public invoke(id: string, request: InvokeAddonRequest): Observable<InvokeAddonResponse> {
    return this.apiService
      .post<InvokeAddonResponse>(
        `${this.config.endpoint}/${id}/invoke`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(response => {
          this.logger.info('Addon invoked', {
            addon_id: id,
            invocation_id: response.invocation_id,
            status: response.status,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to invoke addon', error);
          throw error;
        }),
      );
  }

  protected override refreshList(): void {
    this.list().subscribe();
  }
}
