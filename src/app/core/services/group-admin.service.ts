import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  AdminGroup,
  GroupFilter,
  ListGroupsResponse,
  CreateGroupRequest,
  GroupMember,
  ListGroupMembersResponse,
  AddGroupMemberRequest,
} from '@app/types/group.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

/**
 * Service for managing groups in the admin interface
 * Handles CRUD operations for groups and group membership
 */
@Injectable({
  providedIn: 'root',
})
// SEM@ec780ca190b16e9c25b3170baee0b36ce8194495: manage admin group CRUD and membership via the API, caching groups in a reactive stream
export class GroupAdminService {
  private groupsSubject$ = new BehaviorSubject<AdminGroup[]>([]);
  public groups$: Observable<AdminGroup[]> = this.groupsSubject$.asObservable();

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: inject API service and logger dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all groups with optional filtering
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch admin groups with optional filter and update the cached groups stream (reads DB)
  public list(filter?: GroupFilter): Observable<ListGroupsResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListGroupsResponse>('admin/groups', params).pipe(
      tap(response => {
        this.groupsSubject$.next(response.groups);
        this.logger.debug('Groups loaded', {
          count: response.groups.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list groups', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific group by internal UUID
   */
  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: fetch a single admin group by internal UUID from the API (reads DB)
  public get(internal_uuid: string): Observable<AdminGroup> {
    return this.apiService.get<AdminGroup>(`admin/groups/${internal_uuid}`).pipe(
      tap(group => {
        this.logger.debug('Group loaded', { internal_uuid, group_name: group.group_name });
      }),
      catchError(error => {
        this.logger.error('Failed to get group', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new provider-independent group (TMI provider)
   */
  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: create a TMI-managed group via the API and refresh the cached groups list (reads DB)
  public create(request: CreateGroupRequest): Observable<AdminGroup> {
    return this.apiService
      .post<AdminGroup>('admin/groups', request as unknown as Record<string, unknown>)
      .pipe(
        tap(group => {
          this.logger.info('Group created', { id: group.internal_uuid });
          // Refresh the groups list
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create group', error);
          throw error;
        }),
      );
  }

  /**
   * List members of a group
   */
  // SEM@ec780ca190b16e9c25b3170baee0b36ce8194495: fetch paginated members of a group from the API (reads DB)
  public listMembers(
    internal_uuid: string,
    limit?: number,
    offset?: number,
  ): Observable<ListGroupMembersResponse> {
    const params = buildHttpParams({ limit, offset });
    return this.apiService
      .get<ListGroupMembersResponse>(`admin/groups/${internal_uuid}/members`, params)
      .pipe(
        map(
          response => response ?? { members: [], total: 0, limit: limit ?? 0, offset: offset ?? 0 },
        ),
        tap(response => {
          this.logger.debug('Group members loaded', {
            internal_uuid,
            count: response.members.length,
            total: response.total,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list group members', error);
          throw error;
        }),
      );
  }

  /**
   * Add a member to a group
   */
  // SEM@3909264b66e2522d047d4a908c09e2a1d7a3afb8: add a user or group member to an admin group via the API (reads DB)
  public addMember(internal_uuid: string, request: AddGroupMemberRequest): Observable<GroupMember> {
    return this.apiService
      .post<GroupMember>(
        `admin/groups/${internal_uuid}/members`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(member => {
          this.logger.info('Member added to group', {
            internal_uuid,
            member_id: member.id,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to add group member', error);
          throw error;
        }),
      );
  }

  /**
   * Remove a member from a group
   */
  // SEM@42b37b76c1bd3acbcdef0b5996b338e0c647783a: delete a member from an admin group by UUID and subject type via the API (reads DB)
  public removeMember(
    internal_uuid: string,
    member_uuid: string,
    subject_type: 'user' | 'group',
  ): Observable<void> {
    return this.apiService
      .deleteWithParams<void>(`admin/groups/${internal_uuid}/members/${member_uuid}`, {
        subject_type,
      })
      .pipe(
        tap(() => {
          this.logger.info('Member removed from group', {
            internal_uuid,
            member_uuid,
            subject_type,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to remove group member', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a group by internal UUID
   * Deletes a TMI-managed group and handles threat model cleanup.
   * Protected groups like 'everyone' cannot be deleted.
   */
  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: delete an admin group by UUID and refresh the cached groups list (reads DB)
  public delete(internal_uuid: string): Observable<void> {
    return this.apiService.delete<void>(`admin/groups/${internal_uuid}`).pipe(
      tap(() => {
        this.logger.info('Group deleted', { internal_uuid });
        // Refresh the groups list
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete group', error);
        throw error;
      }),
    );
  }
}
