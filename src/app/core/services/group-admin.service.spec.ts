// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { GroupAdminService } from './group-admin.service';
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

describe('GroupAdminService', () => {
  let service: GroupAdminService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Test data
  const mockGroup: AdminGroup = {
    internal_uuid: '123e4567-e89b-12d3-a456-426614174000',
    provider: '*',
    group_name: 'developers',
    name: 'Developers',
    description: 'Development team',
    first_used: '2024-01-01T00:00:00Z',
    last_used: '2024-01-15T00:00:00Z',
    usage_count: 10,
    used_in_authorizations: true,
    used_in_admin_grants: false,
    member_count: 5,
  };

  const mockListResponse: ListGroupsResponse = {
    groups: [mockGroup],
    total: 1,
    limit: 50,
    offset: 0,
  };

  const mockMember: GroupMember = {
    internal_uuid: '987e6543-e21b-43d2-a654-426614174111',
    provider: 'google',
    provider_user_id: 'google_12345',
    email: 'member@example.com',
    name: 'Group Member',
    added_at: '2024-01-01T00:00:00Z',
  };

  const mockMembersResponse: ListGroupMembersResponse = {
    members: [mockMember],
    total: 1,
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    // Create mocks
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    // Create the service with mocked dependencies
    service = new GroupAdminService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty groups observable', () => {
      service.groups$.subscribe(groups => {
        expect(groups).toEqual([]);
      });
    });
  });

  describe('list()', () => {
    it('should call API with no parameters when filter is not provided', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', undefined);
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should update groups$ observable with response data', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        service.groups$.subscribe(groups => {
          expect(groups).toEqual(mockListResponse.groups);
        });
      });
    });

    it('should log debug message with group count', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Groups loaded', {
          count: 1,
          total: 1,
        });
      });
    });

    it('should build query parameters from filter', () => {
      const filter: GroupFilter = {
        provider: '*',
        group_name: 'dev',
        used_in_authorizations: true,
        limit: 10,
        offset: 20,
        sort_by: 'group_name',
        sort_order: 'asc',
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', {
          provider: '*',
          group_name: 'dev',
          used_in_authorizations: true,
          limit: 10,
          offset: 20,
          sort_by: 'group_name',
          sort_order: 'asc',
        });
      });
    });

    it('should handle used_in_authorizations=false in filter', () => {
      const filter: GroupFilter = {
        used_in_authorizations: false,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', {
          used_in_authorizations: false,
        });
      });
    });

    it('should omit undefined filter values from query parameters', () => {
      const filter: GroupFilter = {
        provider: '*',
        group_name: undefined,
        limit: undefined,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', {
          provider: '*',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.list().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list groups', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('get()', () => {
    const testUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should call API with internal_uuid path parameter', () => {
      mockApiService.get.mockReturnValue(of(mockGroup));

      service.get(testUuid).subscribe(group => {
        expect(mockApiService.get).toHaveBeenCalledWith(`admin/groups/${testUuid}`);
        expect(group).toEqual(mockGroup);
      });
    });

    it('should log debug message with group details', () => {
      mockApiService.get.mockReturnValue(of(mockGroup));

      service.get(testUuid).subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Group loaded', {
          internal_uuid: testUuid,
          group_name: mockGroup.group_name,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Group not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.get(testUuid).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to get group', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('create()', () => {
    const createRequest: CreateGroupRequest = {
      group_name: 'new_group',
      name: 'New Group',
      description: 'A new test group',
    };

    it('should call API post with create request', () => {
      mockApiService.post.mockReturnValue(of(mockGroup));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(group => {
        expect(mockApiService.post).toHaveBeenCalledWith('admin/groups', createRequest);
        expect(group).toEqual(mockGroup);
      });
    });

    it('should log info message on successful creation', () => {
      mockApiService.post.mockReturnValue(of(mockGroup));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Group created', {
          id: mockGroup.internal_uuid,
        });
      });
    });

    it('should refresh groups list after creation', () => {
      mockApiService.post.mockReturnValue(of(mockGroup));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(createRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create group', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if creation fails', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(createRequest).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('listMembers()', () => {
    const groupUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should call API with no params when limit and offset not provided', () => {
      mockApiService.get.mockReturnValue(of(mockMembersResponse));

      service.listMembers(groupUuid).subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith(
          `admin/groups/${groupUuid}/members`,
          undefined,
        );
        expect(response).toEqual(mockMembersResponse);
      });
    });

    it('should include limit and offset in params when provided', () => {
      mockApiService.get.mockReturnValue(of(mockMembersResponse));

      service.listMembers(groupUuid, 10, 5).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith(`admin/groups/${groupUuid}/members`, {
          limit: 10,
          offset: 5,
        });
      });
    });

    it('should log debug message with member count', () => {
      mockApiService.get.mockReturnValue(of(mockMembersResponse));

      service.listMembers(groupUuid).subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Group members loaded', {
          internal_uuid: groupUuid,
          count: 1,
          total: 1,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Failed to load members');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listMembers(groupUuid).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list group members',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('addMember()', () => {
    const groupUuid = '123e4567-e89b-12d3-a456-426614174000';
    const addRequest: AddGroupMemberRequest = {
      provider: 'google',
      provider_user_id: 'google_12345',
    };

    it('should call API post with group UUID and add request', () => {
      mockApiService.post.mockReturnValue(of(mockMember));

      service.addMember(groupUuid, addRequest).subscribe(member => {
        expect(mockApiService.post).toHaveBeenCalledWith(
          `admin/groups/${groupUuid}/members`,
          addRequest,
        );
        expect(member).toEqual(mockMember);
      });
    });

    it('should log info message on successful addition', () => {
      mockApiService.post.mockReturnValue(of(mockMember));

      service.addMember(groupUuid, addRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Member added to group', {
          internal_uuid: groupUuid,
          user_uuid: mockMember.internal_uuid,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Failed to add member');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.addMember(groupUuid, addRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to add group member', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('removeMember()', () => {
    const groupUuid = '123e4567-e89b-12d3-a456-426614174000';
    const userUuid = '987e6543-e21b-43d2-a654-426614174111';

    it('should call API delete with group and user UUIDs', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.removeMember(groupUuid, userUuid).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith(
          `admin/groups/${groupUuid}/members/${userUuid}`,
        );
      });
    });

    it('should log info message on successful removal', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.removeMember(groupUuid, userUuid).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Member removed from group', {
          internal_uuid: groupUuid,
          user_uuid: userUuid,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Failed to remove member');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.removeMember(groupUuid, userUuid).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to remove group member',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('delete()', () => {
    const testUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should call API delete with internal_uuid path parameter', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testUuid).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith(`admin/groups/${testUuid}`);
      });
    });

    it('should log info message on successful deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testUuid).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Group deleted', {
          internal_uuid: testUuid,
        });
      });
    });

    it('should refresh groups list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testUuid).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testUuid).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete group', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if deletion fails', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testUuid).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('buildParams() - edge cases', () => {
    it('should handle limit=0 in filter', () => {
      const filter: GroupFilter = {
        limit: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', {
          limit: 0,
        });
      });
    });

    it('should handle offset=0 in filter', () => {
      const filter: GroupFilter = {
        offset: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', {
          offset: 0,
        });
      });
    });

    it('should return undefined params for empty filter object', () => {
      const filter: GroupFilter = {};

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/groups', undefined);
      });
    });
  });
});
