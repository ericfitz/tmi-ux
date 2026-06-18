/**
 * User Group Service
 *
 * Provides non-admin access to group membership data via /me/groups endpoints.
 * Unlike GroupAdminService (which requires admin privileges), this service
 * allows any authenticated user to query groups they belong to and their members.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { ListGroupMembersResponse } from '@app/types/group.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

@Injectable({
  providedIn: 'root',
})
// SEM@ec780ca190b16e9c25b3170baee0b36ce8194495: fetch group membership data for the authenticated user without admin privileges
export class UserGroupService {
  // SEM@6c071df61169a648a295f203e10831067d21bcaa: inject API and logger dependencies for group membership queries (pure)
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
  // SEM@ec780ca190b16e9c25b3170baee0b36ce8194495: fetch paginated members of a group the current user belongs to (reads DB)
  listMembers(
    groupUuid: string,
    limit?: number,
    offset?: number,
  ): Observable<ListGroupMembersResponse> {
    const params = buildHttpParams({ limit, offset });
    return this.apiService
      .get<ListGroupMembersResponse>(`me/groups/${groupUuid}/members`, params)
      .pipe(
        map(
          response => response ?? { members: [], total: 0, limit: limit ?? 0, offset: offset ?? 0 },
        ),
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
