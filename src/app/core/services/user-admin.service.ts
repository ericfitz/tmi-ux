import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AdminUser, AdminUserFilter, ListAdminUsersResponse } from '@app/types/user.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

/**
 * Service for managing users in the admin interface
 * Handles listing and deleting users
 */
@Injectable({
  providedIn: 'root',
})
export class UserAdminService {
  private usersSubject$ = new BehaviorSubject<AdminUser[]>([]);
  public users$: Observable<AdminUser[]> = this.usersSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all users with optional filtering
   */
  public list(filter?: AdminUserFilter): Observable<ListAdminUsersResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListAdminUsersResponse>('admin/users', params).pipe(
      tap(response => {
        this.usersSubject$.next(response.users);
        this.logger.debug('Users loaded', {
          count: response.users.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list users', error);
        throw error;
      }),
    );
  }

  /**
   * Delete a user by internal UUID
   * Deletes a user and all associated data.
   * Transfers sole-owned threat models or deletes them if no other owners exist.
   */
  public delete(internal_uuid: string): Observable<void> {
    return this.apiService.delete<void>(`admin/users/${internal_uuid}`).pipe(
      tap(() => {
        this.logger.info('User deleted', { internal_uuid });
        // Refresh the users list
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete user', error);
        throw error;
      }),
    );
  }
}
