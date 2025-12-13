// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { UserAdminService } from './user-admin.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AdminUser, AdminUserFilter, ListAdminUsersResponse } from '@app/types/user.types';

describe('UserAdminService', () => {
  let service: UserAdminService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Test data
  const mockUser: AdminUser = {
    internal_uuid: '123e4567-e89b-12d3-a456-426614174000',
    provider: 'google',
    provider_user_id: 'google_12345',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-15T00:00:00Z',
    is_admin: false,
    groups: ['developers', 'users'],
    active_threat_models: 5,
  };

  const mockListResponse: ListAdminUsersResponse = {
    users: [mockUser],
    total: 1,
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    // Create mocks
    mockApiService = {
      get: vi.fn(),
      delete: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    // Create the service with mocked dependencies
    service = new UserAdminService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty users observable', () => {
      service.users$.subscribe(users => {
        expect(users).toEqual([]);
      });
    });
  });

  describe('list()', () => {
    it('should call API with no parameters when filter is not provided', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', undefined);
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should update users$ observable with response data', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        service.users$.subscribe(users => {
          expect(users).toEqual(mockListResponse.users);
        });
      });
    });

    it('should log debug message with user count', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Users loaded', {
          count: 1,
          total: 1,
        });
      });
    });

    it('should build query parameters from filter', () => {
      const filter: AdminUserFilter = {
        provider: 'google',
        email: 'test@example.com',
        limit: 10,
        offset: 20,
        sort_by: 'email',
        sort_order: 'asc',
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', {
          provider: 'google',
          email: 'test@example.com',
          limit: 10,
          offset: 20,
          sort_by: 'email',
          sort_order: 'asc',
        });
      });
    });

    it('should include date filters in query parameters', () => {
      const filter: AdminUserFilter = {
        created_after: '2024-01-01T00:00:00Z',
        created_before: '2024-12-31T23:59:59Z',
        last_login_after: '2024-06-01T00:00:00Z',
        last_login_before: '2024-12-31T23:59:59Z',
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', {
          created_after: '2024-01-01T00:00:00Z',
          created_before: '2024-12-31T23:59:59Z',
          last_login_after: '2024-06-01T00:00:00Z',
          last_login_before: '2024-12-31T23:59:59Z',
        });
      });
    });

    it('should omit undefined filter values from query parameters', () => {
      const filter: AdminUserFilter = {
        provider: 'google',
        email: undefined,
        limit: undefined,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', {
          provider: 'google',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.list().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list users', error);
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
        expect(mockApiService.delete).toHaveBeenCalledWith(`admin/users/${testUuid}`);
      });
    });

    it('should log info message on successful deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testUuid).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('User deleted', {
          internal_uuid: testUuid,
        });
      });
    });

    it('should refresh users list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testUuid).subscribe(() => {
        // The delete operation triggers a list() call
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testUuid).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete user', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if deletion fails', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testUuid).subscribe({
        error: () => {
          // list() should not be called since delete failed
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('buildParams() - edge cases', () => {
    it('should handle limit=0 in filter', () => {
      const filter: AdminUserFilter = {
        limit: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', {
          limit: 0,
        });
      });
    });

    it('should handle offset=0 in filter', () => {
      const filter: AdminUserFilter = {
        offset: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', {
          offset: 0,
        });
      });
    });

    it('should return undefined params for empty filter object', () => {
      const filter: AdminUserFilter = {};

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', undefined);
      });
    });
  });
});
