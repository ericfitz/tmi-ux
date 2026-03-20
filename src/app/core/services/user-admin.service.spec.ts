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
import {
  AdminUser,
  AdminUserFilter,
  CreateAutomationAccountRequest,
  CreateAutomationAccountResponse,
  ListAdminUsersResponse,
} from '@app/types/user.types';
import {
  ClientCredentialResponse,
  CreateClientCredentialRequest,
  ListClientCredentialsResponse,
} from '@app/types/client-credential.types';

describe('UserAdminService', () => {
  let service: UserAdminService;
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
      post: vi.fn(),
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

  describe('list() with automation filter', () => {
    it('should pass automation=true filter to API', () => {
      const filter: AdminUserFilter = { automation: true };
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', { automation: true });
      });
    });

    it('should pass automation=false filter to API', () => {
      const filter: AdminUserFilter = { automation: false };
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/users', { automation: false });
      });
    });
  });

  describe('createAutomationUser()', () => {
    const mockRequest: CreateAutomationAccountRequest = {
      name: 'my-automation-bot',
    };

    const mockResponse: CreateAutomationAccountResponse = {
      user: {
        internal_uuid: 'auto-uuid-123',
        provider: 'automation',
        provider_user_id: 'auto-uuid-123',
        email: '',
        name: 'my-automation-bot',
        email_verified: false,
        created_at: '2024-01-01T00:00:00Z',
        modified_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-01T00:00:00Z',
        is_admin: false,
        groups: [],
        active_threat_models: 0,
      },
      client_credential: {
        id: 'cred-abc-123',
        client_id: 'tmi_cc_abc123',
        client_secret: 'super-secret-value',
        name: 'default',
        created_at: '2024-01-01T00:00:00Z',
      },
    };

    it('should POST to admin/users/automation', () => {
      mockApiService.post.mockReturnValue(of(mockResponse));

      service.createAutomationUser(mockRequest).subscribe(() => {
        expect(mockApiService.post).toHaveBeenCalledWith('admin/users/automation', mockRequest);
      });
    });

    it('should log info on success with user name', () => {
      mockApiService.post.mockReturnValue(of(mockResponse));

      service.createAutomationUser(mockRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Automation user created', {
          name: 'my-automation-bot',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.createAutomationUser(mockRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to create automation user',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('listUserCredentials()', () => {
    const testUuid = '123e4567-e89b-12d3-a456-426614174000';

    const mockCredentialsResponse: ListClientCredentialsResponse = {
      credentials: [
        {
          id: 'cred-abc-123',
          client_id: 'tmi_cc_abc123',
          name: 'ci-token',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          modified_at: '2024-01-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };

    it('should GET admin/users/{uuid}/client_credentials', () => {
      mockApiService.get.mockReturnValue(of(mockCredentialsResponse));

      service.listUserCredentials(testUuid).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith(
          `admin/users/${testUuid}/client_credentials`,
        );
      });
    });

    it('should log debug on success with count', () => {
      mockApiService.get.mockReturnValue(of(mockCredentialsResponse));

      service.listUserCredentials(testUuid).subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('User credentials loaded', {
          internalUuid: testUuid,
          count: 1,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listUserCredentials(testUuid).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list user credentials',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('createUserCredential()', () => {
    const testUuid = '123e4567-e89b-12d3-a456-426614174000';
    const mockInput: CreateClientCredentialRequest = { name: 'my-ci-token' };

    const mockCredentialResponse: ClientCredentialResponse = {
      id: 'cred-abc-123',
      client_id: 'tmi_cc_abc123',
      client_secret: 'super-secret-value',
      name: 'my-ci-token',
      created_at: '2024-01-01T00:00:00Z',
    };

    it('should POST to admin/users/{uuid}/client_credentials', () => {
      mockApiService.post.mockReturnValue(of(mockCredentialResponse));

      service.createUserCredential(testUuid, mockInput).subscribe(() => {
        expect(mockApiService.post).toHaveBeenCalledWith(
          `admin/users/${testUuid}/client_credentials`,
          mockInput,
        );
      });
    });

    it('should log info on success with internalUuid and credentialId', () => {
      mockApiService.post.mockReturnValue(of(mockCredentialResponse));

      service.createUserCredential(testUuid, mockInput).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('User credential created', {
          internalUuid: testUuid,
          credentialId: 'cred-abc-123',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.createUserCredential(testUuid, mockInput).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to create user credential',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('deleteUserCredential()', () => {
    const testUuid = '123e4567-e89b-12d3-a456-426614174000';
    const testCredId = 'cred-abc-123';

    it('should DELETE admin/users/{uuid}/client_credentials/{credId}', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteUserCredential(testUuid, testCredId).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith(
          `admin/users/${testUuid}/client_credentials/${testCredId}`,
        );
      });
    });

    it('should log info on success with internalUuid and credentialId', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteUserCredential(testUuid, testCredId).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('User credential deleted', {
          internalUuid: testUuid,
          credentialId: testCredId,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteUserCredential(testUuid, testCredId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to delete user credential',
            error,
          );
          expect(err).toBe(error);
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
