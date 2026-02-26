/**
 * User Group Service
 *
 * Provides non-admin access to group membership data via /me/groups endpoints.
 * Unlike GroupAdminService (which requires admin privileges), this service
 * allows any authenticated user to query groups they belong to and their members.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { ListGroupMembersResponse } from '@app/types/group.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

@Injectable({
  providedIn: 'root',
})
export class UserGroupService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List members of a group the current user belongs to
   * @param groupUuid Internal UUID of the group
   * @param limit Maximum number of results to return
   * @param offset Number of results to skip
   * @returns Observable with group members
   */
  listMembers(
    groupUuid: string,
    limit?: number,
    offset?: number,
  ): Observable<ListGroupMembersResponse> {
    const params = buildHttpParams({ limit, offset });
    return this.apiService
      .get<ListGroupMembersResponse>(`me/groups/${groupUuid}/members`, params)
      .pipe(
        tap(response => {
          this.logger.debug('User group members loaded', {
            groupUuid,
            count: response.members.length,
            total: response.total,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list user group members', error);
          throw error;
        }),
      );
  }
}
