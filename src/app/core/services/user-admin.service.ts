import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AdminUser, AdminUserFilter, ListAdminUsersResponse } from '@app/types/user.types';

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
    const params = this.buildParams(filter);
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
   * Delete a user by provider and provider_user_id
   * Deletes a user and all associated data.
   * Transfers sole-owned threat models or deletes them if no other owners exist.
   */
  public delete(provider: string, provider_user_id: string): Observable<void> {
    const params = {
      provider,
      provider_user_id,
    };
    return this.apiService.deleteWithParams<void>('admin/users', params).pipe(
      tap(() => {
        this.logger.info('User deleted', { provider, provider_user_id });
        // Refresh the users list
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete user', error);
        throw error;
      }),
    );
  }

  /**
   * Build query parameters from filter
   */
  private buildParams(
    filter?: AdminUserFilter,
  ): Record<string, string | number | boolean> | undefined {
    if (!filter) {
      return undefined;
    }

    const params: Record<string, string | number | boolean> = {};

    if (filter.provider) {
      params['provider'] = filter.provider;
    }
    if (filter.email) {
      params['email'] = filter.email;
    }
    if (filter.created_after) {
      params['created_after'] = filter.created_after;
    }
    if (filter.created_before) {
      params['created_before'] = filter.created_before;
    }
    if (filter.last_login_after) {
      params['last_login_after'] = filter.last_login_after;
    }
    if (filter.last_login_before) {
      params['last_login_before'] = filter.last_login_before;
    }
    if (filter.limit !== undefined) {
      params['limit'] = filter.limit;
    }
    if (filter.offset !== undefined) {
      params['offset'] = filter.offset;
    }
    if (filter.sort_by) {
      params['sort_by'] = filter.sort_by;
    }
    if (filter.sort_order) {
      params['sort_order'] = filter.sort_order;
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }
}
