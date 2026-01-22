import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
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
export class AddonService {
  private addonsSubject$ = new BehaviorSubject<Addon[]>([]);
  public addons$: Observable<Addon[]> = this.addonsSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all addons with optional filtering
   */
  public list(filter?: AddonFilter): Observable<Addon[]> {
    const params = this.buildParams(filter);
    return this.apiService.get<ListAddonsResponse>('addons', params).pipe(
      map(response => response.addons),
      tap(addons => {
        this.addonsSubject$.next(addons);
        this.logger.debug('Addons loaded', { count: addons.length });
      }),
      catchError(error => {
        this.logger.error('Failed to list addons', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific addon by ID
   */
  public get(id: string): Observable<Addon> {
    return this.apiService.get<Addon>(`addons/${id}`).pipe(
      tap(addon => this.logger.debug('Addon loaded', { id: addon.id })),
      catchError(error => {
        this.logger.error('Failed to get addon', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new addon
   */
  public create(request: CreateAddonRequest): Observable<Addon> {
    return this.apiService
      .post<Addon>('addons', request as unknown as Record<string, unknown>)
      .pipe(
        tap(addon => {
          this.logger.info('Addon created', { id: addon.id });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create addon', error);
          throw error;
        }),
      );
  }

  /**
   * Update an existing addon
   */
  public update(id: string, request: CreateAddonRequest): Observable<Addon> {
    return this.apiService
      .put<Addon>(`addons/${id}`, request as unknown as Record<string, unknown>)
      .pipe(
        tap(addon => {
          this.logger.info('Addon updated', { id: addon.id });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update addon', error);
          throw error;
        }),
      );
  }

  /**
   * Delete an addon
   */
  public delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`addons/${id}`).pipe(
      tap(() => {
        this.logger.info('Addon deleted', { id });
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete addon', error);
        throw error;
      }),
    );
  }

  /**
   * Invoke an addon with the given parameters
   * @param id The addon ID to invoke
   * @param request The invocation request parameters
   * @returns Observable with the invocation response (202 Accepted)
   */
  public invoke(id: string, request: InvokeAddonRequest): Observable<InvokeAddonResponse> {
    return this.apiService
      .post<InvokeAddonResponse>(`addons/${id}/invoke`, request as unknown as Record<string, unknown>)
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

  /**
   * Build query parameters from filter
   */
  private buildParams(filter?: AddonFilter): Record<string, string | number | boolean> | undefined {
    if (!filter) {
      return undefined;
    }

    const params: Record<string, string | number | boolean> = {};

    if (filter.threat_model_id) {
      params['threat_model_id'] = filter.threat_model_id;
    }
    if (filter.limit !== undefined) {
      params['limit'] = filter.limit;
    }
    if (filter.offset !== undefined) {
      params['offset'] = filter.offset;
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }
}
