// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { AdministratorService } from './administrator.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  Administrator,
  AdministratorFilter,
  CreateAdministratorRequest,
  ListAdministratorsResponse,
} from '@app/types/administrator.types';

describe('AdministratorService', () => {
  let service: AdministratorService;
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
  const mockAdministrator: Administrator = {
    id: 'admin-123',
    provider: 'google',
    user_id: 'user-456',
    group_id: null,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
  };

  const mockListResponse: ListAdministratorsResponse = {
    administrators: [mockAdministrator],
    total: 1,
    limit: 50,
    offset: 0,
  };

  const mockCreateRequest: CreateAdministratorRequest = {
    provider: 'google',
    user_id: 'user-789',
  };

  beforeEach(() => {
    vi.clearAllMocks();

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

    // Create service with mocked dependencies
    service = new AdministratorService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty administrators observable', () => {
      service.administrators$.subscribe(administrators => {
        expect(administrators).toEqual([]);
      });
    });
  });

  describe('list()', () => {
    it('should call API with no parameters when filter is not provided', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', undefined);
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should update administrators$ observable with response data', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        service.administrators$.subscribe(administrators => {
          expect(administrators).toEqual(mockListResponse.administrators);
        });
      });
    });

    it('should log debug message with administrator count', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Administrators loaded', {
          count: 1,
          total: 1,
        });
      });
    });

    it('should build query parameters from filter with provider', () => {
      const filter: AdministratorFilter = {
        provider: 'google',
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', {
          provider: 'google',
        });
      });
    });

    it('should build query parameters from filter with user_id', () => {
      const filter: AdministratorFilter = {
        user_id: 'user-123',
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', {
          user_id: 'user-123',
        });
      });
    });

    it('should build query parameters from filter with group_id', () => {
      const filter: AdministratorFilter = {
        group_id: 'group-456',
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', {
          group_id: 'group-456',
        });
      });
    });

    it('should build query parameters from filter with limit and offset', () => {
      const filter: AdministratorFilter = {
        limit: 10,
        offset: 20,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', {
          limit: 10,
          offset: 20,
        });
      });
    });

    it('should build query parameters from filter with all fields', () => {
      const filter: AdministratorFilter = {
        provider: 'google',
        user_id: 'user-123',
        group_id: 'group-456',
        limit: 10,
        offset: 20,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', {
          provider: 'google',
          user_id: 'user-123',
          group_id: 'group-456',
          limit: 10,
          offset: 20,
        });
      });
    });

    it('should handle limit=0 in filter', () => {
      const filter: AdministratorFilter = {
        limit: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', {
          limit: 0,
        });
      });
    });

    it('should handle offset=0 in filter', () => {
      const filter: AdministratorFilter = {
        offset: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', {
          offset: 0,
        });
      });
    });

    it('should return undefined params for empty filter object', () => {
      const filter: AdministratorFilter = {};

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.list().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list administrators',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('create()', () => {
    it('should call API with correct endpoint and data', () => {
      mockApiService.post.mockReturnValue(of(mockAdministrator));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(mockCreateRequest).subscribe(admin => {
        expect(mockApiService.post).toHaveBeenCalledWith('admin/administrators', mockCreateRequest);
        expect(admin).toEqual(mockAdministrator);
      });
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockAdministrator));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(mockCreateRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Administrator created', {
          id: mockAdministrator.id,
        });
      });
    });

    it('should refresh administrator list after creation', () => {
      mockApiService.post.mockReturnValue(of(mockAdministrator));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(mockCreateRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(mockCreateRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to create administrator',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if creation fails', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(mockCreateRequest).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('delete()', () => {
    const testId = 'admin-123';

    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testId).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('admin/administrators/admin-123');
      });
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testId).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Administrator deleted', {
          id: testId,
        });
      });
    });

    it('should refresh administrator list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testId).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/administrators', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to delete administrator',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if deletion fails', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testId).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });
});
