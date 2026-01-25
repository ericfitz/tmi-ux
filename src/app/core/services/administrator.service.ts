import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  Administrator,
  AdministratorFilter,
  CreateAdministratorRequest,
  ListAdministratorsResponse,
} from '@app/types/administrator.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

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
  public list(filter?: AdministratorFilter): Observable<ListAdministratorsResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListAdministratorsResponse>('admin/administrators', params).pipe(
      tap(response => {
        this.administratorsSubject$.next(response.administrators);
        this.logger.debug('Administrators loaded', {
          count: response.administrators.length,
          total: response.total,
        });
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
      .post<Administrator>('admin/administrators', request as unknown as Record<string, unknown>)
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
    return this.apiService.delete<void>(`admin/administrators/${id}`).pipe(
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
}
