// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { UserGroupService } from './user-group.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { GroupMember, ListGroupMembersResponse } from '@app/types/group.types';

describe('UserGroupService', () => {
  let service: UserGroupService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockMember: GroupMember = {
    id: 'a10eabcd-e89b-41d4-a716-446655440001',
    group_internal_uuid: '123e4567-e89b-12d3-a456-426614174000',
    subject_type: 'user',
    user_internal_uuid: '987e6543-e21b-43d2-a654-426614174111',
    user_provider: 'google',
    user_provider_user_id: 'google_12345',
    user_email: 'reviewer@example.com',
    user_name: 'Security Reviewer',
    added_at: '2024-01-01T00:00:00Z',
  };

  const mockMembersResponse: ListGroupMembersResponse = {
    members: [mockMember],
    total: 1,
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    mockApiService = {
      get: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    service = new UserGroupService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('listMembers()', () => {
    const groupUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should call API with correct endpoint and no params when limit/offset not provided', () => {
      mockApiService.get.mockReturnValue(of(mockMembersResponse));

      service.listMembers(groupUuid).subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith(
          `me/groups/${groupUuid}/members`,
          undefined,
        );
        expect(response).toEqual(mockMembersResponse);
      });
    });

    it('should include limit and offset in params when provided', () => {
      mockApiService.get.mockReturnValue(of(mockMembersResponse));

      service.listMembers(groupUuid, 10, 5).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith(`me/groups/${groupUuid}/members`, {
          limit: 10,
          offset: 5,
        });
      });
    });

    it('should log debug message with member count', () => {
      mockApiService.get.mockReturnValue(of(mockMembersResponse));

      service.listMembers(groupUuid).subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('User group members loaded', {
          groupUuid,
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
            'Failed to list user group members',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });

    it('should handle empty members response', () => {
      const emptyResponse: ListGroupMembersResponse = {
        members: [],
        total: 0,
        limit: 50,
        offset: 0,
      };
      mockApiService.get.mockReturnValue(of(emptyResponse));

      service.listMembers(groupUuid).subscribe(response => {
        expect(response.members).toEqual([]);
        expect(response.total).toBe(0);
      });
    });
  });
});
