// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { QuotaService } from './quota.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  UserAPIQuota,
  WebhookQuota,
  EnrichedUserAPIQuota,
  EnrichedWebhookQuota,
} from '@app/types/quota.types';
import { AdminUser, AdminUserFilter, ListAdminUsersResponse } from '@app/types/user.types';

describe('QuotaService', () => {
  let service: QuotaService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Test data
  const testUserId = 'user-123';

  const mockUserAPIQuota: UserAPIQuota = {
    user_id: testUserId,
    requests_per_day: 1000,
    requests_per_hour: 100,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
  };

  const mockWebhookQuota: WebhookQuota = {
    owner_id: testUserId,
    max_webhooks: 10,
    max_deliveries_per_day: 1000,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
  };

  const mockAdminUser: AdminUser = {
    internal_uuid: testUserId,
    provider: 'google',
    provider_user_id: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-15T00:00:00Z',
    is_admin: false,
    groups: [],
    active_threat_models: 5,
  };

  const mockListUsersResponse: ListAdminUsersResponse = {
    users: [mockAdminUser],
    total: 1,
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks
    mockApiService = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    // Create service with mocked dependencies
    service = new QuotaService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('getUserAPIQuota()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockUserAPIQuota));

      service.getUserAPIQuota(testUserId).subscribe(quota => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/users/user-123');
        expect(quota).toEqual(mockUserAPIQuota);
      });
    });

    it('should handle API errors', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getUserAPIQuota(testUserId).subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('updateUserAPIQuota()', () => {
    it('should call API with correct endpoint and data', () => {
      const updateData = { requests_per_day: 2000 };
      mockApiService.put.mockReturnValue(of(mockUserAPIQuota));

      service.updateUserAPIQuota(testUserId, updateData).subscribe(quota => {
        expect(mockApiService.put).toHaveBeenCalledWith('/admin/quotas/users/user-123', updateData);
        expect(quota).toEqual(mockUserAPIQuota);
      });
    });
  });

  describe('deleteUserAPIQuota()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteUserAPIQuota(testUserId).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('/admin/quotas/users/user-123');
      });
    });
  });

  describe('getWebhookQuota()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockWebhookQuota));

      service.getWebhookQuota(testUserId).subscribe(quota => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/webhooks/user-123');
        expect(quota).toEqual(mockWebhookQuota);
      });
    });
  });

  describe('updateWebhookQuota()', () => {
    it('should call API with correct endpoint and data', () => {
      const updateData = { max_webhooks: 20 };
      mockApiService.put.mockReturnValue(of(mockWebhookQuota));

      service.updateWebhookQuota(testUserId, updateData).subscribe(quota => {
        expect(mockApiService.put).toHaveBeenCalledWith(
          '/admin/quotas/webhooks/user-123',
          updateData,
        );
        expect(quota).toEqual(mockWebhookQuota);
      });
    });
  });

  describe('deleteWebhookQuota()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteWebhookQuota(testUserId).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('/admin/quotas/webhooks/user-123');
      });
    });
  });

  describe('listUserAPIQuotas()', () => {
    it('should call API without params when not provided', () => {
      mockApiService.get.mockReturnValue(of([mockUserAPIQuota]));

      service.listUserAPIQuotas().subscribe(quotas => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/users', {});
        expect(quotas).toEqual([mockUserAPIQuota]);
      });
    });

    it('should call API with limit param', () => {
      mockApiService.get.mockReturnValue(of([mockUserAPIQuota]));

      service.listUserAPIQuotas(10).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/users', { limit: '10' });
      });
    });

    it('should call API with offset param', () => {
      mockApiService.get.mockReturnValue(of([mockUserAPIQuota]));

      service.listUserAPIQuotas(undefined, 20).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/users', { offset: '20' });
      });
    });

    it('should call API with both limit and offset params', () => {
      mockApiService.get.mockReturnValue(of([mockUserAPIQuota]));

      service.listUserAPIQuotas(10, 20).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/users', {
          limit: '10',
          offset: '20',
        });
      });
    });
  });

  describe('listWebhookQuotas()', () => {
    it('should call API without params when not provided', () => {
      mockApiService.get.mockReturnValue(of([mockWebhookQuota]));

      service.listWebhookQuotas().subscribe(quotas => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/webhooks', {});
        expect(quotas).toEqual([mockWebhookQuota]);
      });
    });

    it('should call API with limit and offset params', () => {
      mockApiService.get.mockReturnValue(of([mockWebhookQuota]));

      service.listWebhookQuotas(10, 20).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/quotas/webhooks', {
          limit: '10',
          offset: '20',
        });
      });
    });
  });

  describe('listUsers()', () => {
    it('should call API without params when filter not provided', () => {
      mockApiService.get.mockReturnValue(of(mockListUsersResponse));

      service.listUsers().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/users', {});
        expect(response).toEqual(mockListUsersResponse);
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

      mockApiService.get.mockReturnValue(of(mockListUsersResponse));

      service.listUsers(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/users', {
          provider: 'google',
          email: 'test@example.com',
          limit: '10',
          offset: '20',
          sort_by: 'email',
          sort_order: 'asc',
        });
      });
    });
  });

  describe('getUser()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockAdminUser));

      service.getUser(testUserId).subscribe(user => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/users/user-123');
        expect(user).toEqual(mockAdminUser);
      });
    });
  });

  describe('getEnrichedUserAPIQuota()', () => {
    it('should fetch quota and user data and enrich', () => {
      mockApiService.get.mockImplementation((endpoint: string) => {
        if (endpoint === '/admin/quotas/users/user-123') {
          return of(mockUserAPIQuota);
        }
        if (endpoint === '/admin/users/user-123') {
          return of(mockAdminUser);
        }
        return of(null);
      });

      service.getEnrichedUserAPIQuota(testUserId).subscribe(enrichedQuota => {
        expect(enrichedQuota).toEqual({
          ...mockUserAPIQuota,
          provider: 'google',
          user_name: 'Test User',
          user_email: 'test@example.com',
        } as EnrichedUserAPIQuota);
      });
    });
  });

  describe('getEnrichedWebhookQuota()', () => {
    it('should fetch quota and user data and enrich', () => {
      mockApiService.get.mockImplementation((endpoint: string) => {
        if (endpoint === '/admin/quotas/webhooks/user-123') {
          return of(mockWebhookQuota);
        }
        if (endpoint === '/admin/users/user-123') {
          return of(mockAdminUser);
        }
        return of(null);
      });

      service.getEnrichedWebhookQuota(testUserId).subscribe(enrichedQuota => {
        expect(enrichedQuota).toEqual({
          ...mockWebhookQuota,
          provider: 'google',
          user_name: 'Test User',
          user_email: 'test@example.com',
        } as EnrichedWebhookQuota);
      });
    });
  });

  describe('listEnrichedUserAPIQuotas()', () => {
    it('should return empty array when no quotas exist', () => {
      mockApiService.get.mockReturnValue(of({ quotas: [], total: 0, limit: 0, offset: 0 }));

      service.listEnrichedUserAPIQuotas().subscribe(enrichedQuotas => {
        expect(enrichedQuotas).toEqual([]);
      });
    });

    it('should enrich all quotas with user data', () => {
      mockApiService.get.mockImplementation((endpoint: string) => {
        if (endpoint === '/admin/quotas/users') {
          return of({ quotas: [mockUserAPIQuota], total: 1, limit: 100, offset: 0 });
        }
        if (endpoint === '/admin/quotas/users/user-123') {
          return of(mockUserAPIQuota);
        }
        if (endpoint === '/admin/users/user-123') {
          return of(mockAdminUser);
        }
        return of(null);
      });

      service.listEnrichedUserAPIQuotas().subscribe(enrichedQuotas => {
        expect(enrichedQuotas).toHaveLength(1);
        expect(enrichedQuotas[0]).toEqual({
          ...mockUserAPIQuota,
          provider: 'google',
          user_name: 'Test User',
          user_email: 'test@example.com',
        } as EnrichedUserAPIQuota);
      });
    });
  });

  describe('listEnrichedWebhookQuotas()', () => {
    it('should return empty array when no quotas exist', () => {
      mockApiService.get.mockReturnValue(of({ quotas: [], total: 0, limit: 0, offset: 0 }));

      service.listEnrichedWebhookQuotas().subscribe(enrichedQuotas => {
        expect(enrichedQuotas).toEqual([]);
      });
    });

    it('should enrich all quotas with user data', () => {
      mockApiService.get.mockImplementation((endpoint: string) => {
        if (endpoint === '/admin/quotas/webhooks') {
          return of({ quotas: [mockWebhookQuota], total: 1, limit: 100, offset: 0 });
        }
        if (endpoint === '/admin/quotas/webhooks/user-123') {
          return of(mockWebhookQuota);
        }
        if (endpoint === '/admin/users/user-123') {
          return of(mockAdminUser);
        }
        return of(null);
      });

      service.listEnrichedWebhookQuotas().subscribe(enrichedQuotas => {
        expect(enrichedQuotas).toHaveLength(1);
        expect(enrichedQuotas[0]).toEqual({
          ...mockWebhookQuota,
          provider: 'google',
          user_name: 'Test User',
          user_email: 'test@example.com',
        } as EnrichedWebhookQuota);
      });
    });
  });
});
