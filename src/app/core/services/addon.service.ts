import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AdminServiceBase } from './admin-service-base';
import { JsonPatchOperation } from '@app/shared/utils/json-patch.util';
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
// SEM@e19c6684da148f53fab89e000721a9721f83d6d2: manage addon CRUD and invocation via the admin API (reads DB)
export class AddonService extends AdminServiceBase<Addon, AddonFilter> {
  public addons$: Observable<Addon[]> = this.items$;

  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: configure the base admin service with the addons API endpoint (pure)
  constructor(apiService: ApiService, logger: LoggerService) {
    super(apiService, logger, {
      endpoint: 'addons',
      entityName: 'addon',
    });
  }

  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: parse addon list from an API list response, returning an empty array on missing field (pure)
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
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: fetch all addons from the API with optional filter criteria (reads DB)
  public list(filter?: AddonFilter): Observable<ListAddonsResponse> {
    return this.listItems<ListAddonsResponse>(filter);
  }

  /**
   * Get a specific addon by ID
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: fetch a single addon by ID from the API (reads DB)
  public get(id: string): Observable<Addon> {
    return this.getItem(id);
  }

  /**
   * Create a new addon
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: store a new addon via the API and refresh the addon list (reads DB)
  public create(request: CreateAddonRequest): Observable<Addon> {
    return this.createItem(request as unknown as Record<string, unknown>);
  }

  /**
   * Partially update an existing addon with JSON Patch operations
   */
  public patch(id: string, operations: JsonPatchOperation[]): Observable<Addon> {
    return this.patchItem(id, operations);
  }

  /**
   * Delete an addon
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: delete an addon by ID via the API and refresh the addon list (reads DB)
  public delete(id: string): Observable<void> {
    return this.deleteItem(id);
  }

  /**
   * Invoke an addon with the given parameters
   * @param id The addon ID to invoke
   * @param request The invocation request parameters
   * @returns Observable with the invocation response (202 Accepted)
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: dispatch an addon invocation request and return the accepted response (reads DB)
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

  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: re-fetch the addon list and update the shared items observable (reads DB)
  protected override refreshList(): void {
    this.list().subscribe();
  }
}
