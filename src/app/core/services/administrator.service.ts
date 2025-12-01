import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  Administrator,
  AdministratorFilter,
  CreateAdministratorRequest,
  ListAdministratorsResponse,
} from '@app/types/administrator.types';

/**
 * Service for managing system administrators
 * Handles CRUD operations for administrator grants
 */
@Injectable({
  providedIn: 'root',
})
export class AdministratorService {
  private administratorsSubject$ = new BehaviorSubject<Administrator[]>([]);
  public administrators$: Observable<Administrator[]> = this.administratorsSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all administrators with optional filtering
   */
  public list(filter?: AdministratorFilter): Observable<Administrator[]> {
    const params = this.buildParams(filter);
    return this.apiService.get<ListAdministratorsResponse>('/admin/administrators', params).pipe(
      map(response => response.administrators),
      tap(administrators => {
        this.administratorsSubject$.next(administrators);
        this.logger.debug('Administrators loaded', { count: administrators.length });
      }),
      catchError(error => {
        this.logger.error('Failed to list administrators', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new administrator grant
   */
  public create(request: CreateAdministratorRequest): Observable<Administrator> {
    return this.apiService
      .post<Administrator>('/admin/administrators', request as unknown as Record<string, unknown>)
      .pipe(
        tap(admin => {
          this.logger.info('Administrator created', { id: admin.id });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create administrator', error);
          throw error;
        }),
      );
  }

  /**
   * Delete an administrator grant
   */
  public delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`/admin/administrators/${id}`).pipe(
      tap(() => {
        this.logger.info('Administrator deleted', { id });
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete administrator', error);
        throw error;
      }),
    );
  }

  /**
   * Build query parameters from filter
   */
  private buildParams(
    filter?: AdministratorFilter,
  ): Record<string, string | number | boolean> | undefined {
    if (!filter) {
      return undefined;
    }

    const params: Record<string, string | number | boolean> = {};

    if (filter.provider) {
      params['provider'] = filter.provider;
    }
    if (filter.user_id) {
      params['user_id'] = filter.user_id;
    }
    if (filter.group_id) {
      params['group_id'] = filter.group_id;
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
