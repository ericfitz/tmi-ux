import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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
export class GroupAdminService {
  private groupsSubject$ = new BehaviorSubject<AdminGroup[]>([]);
  public groups$: Observable<AdminGroup[]> = this.groupsSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all groups with optional filtering
   */
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
  public listMembers(
    internal_uuid: string,
    limit?: number,
    offset?: number,
  ): Observable<ListGroupMembersResponse> {
    const params = buildHttpParams({ limit, offset });
    return this.apiService
      .get<ListGroupMembersResponse>(`admin/groups/${internal_uuid}/members`, params)
      .pipe(
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
