// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { AddonService } from './addon.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { Addon, AddonFilter, CreateAddonRequest, ListAddonsResponse } from '@app/types/addon.types';

describe('AddonService', () => {
  let service: AddonService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Test data
  const mockAddon: Addon = {
    id: 'addon-123',
    threat_model_id: 'tm-456',
    name: 'Test Addon',
    type: 'script',
    config: { key: 'value' },
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
  };

  const mockListResponse: ListAddonsResponse = {
    addons: [mockAddon],
    total: 1,
    limit: 50,
    offset: 0,
  };

  const mockCreateRequest: CreateAddonRequest = {
    threat_model_id: 'tm-456',
    name: 'New Addon',
    type: 'webhook',
    config: { url: 'https://example.com' },
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    // Create service with mocked dependencies
    service = new AddonService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty addons observable', () => {
      service.addons$.subscribe(addons => {
        expect(addons).toEqual([]);
      });
    });
  });

  describe('list()', () => {
    it('should call API with no parameters when filter is not provided', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(addons => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', undefined);
        expect(addons).toEqual(mockListResponse.addons);
      });
    });

    it('should return addons from API response', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(addons => {
        expect(addons).toEqual([mockAddon]);
      });
    });

    it('should update addons$ observable with response data', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        service.addons$.subscribe(addons => {
          expect(addons).toEqual([mockAddon]);
        });
      });
    });

    it('should log debug message with addon count', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Addons loaded', { count: 1 });
      });
    });

    it('should build query parameters from filter with threat_model_id', () => {
      const filter: AddonFilter = {
        threat_model_id: 'tm-789',
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', {
          threat_model_id: 'tm-789',
        });
      });
    });

    it('should build query parameters from filter with limit and offset', () => {
      const filter: AddonFilter = {
        limit: 10,
        offset: 20,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', {
          limit: 10,
          offset: 20,
        });
      });
    });

    it('should build query parameters from filter with all fields', () => {
      const filter: AddonFilter = {
        threat_model_id: 'tm-789',
        limit: 10,
        offset: 20,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', {
          threat_model_id: 'tm-789',
          limit: 10,
          offset: 20,
        });
      });
    });

    it('should handle limit=0 in filter', () => {
      const filter: AddonFilter = {
        limit: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', {
          limit: 0,
        });
      });
    });

    it('should handle offset=0 in filter', () => {
      const filter: AddonFilter = {
        offset: 0,
      };

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', {
          offset: 0,
        });
      });
    });

    it('should return undefined params for empty filter object', () => {
      const filter: AddonFilter = {};

      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(filter).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.list().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list addons', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('get()', () => {
    const testId = 'addon-123';

    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockAddon));

      service.get(testId).subscribe(addon => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons/addon-123');
        expect(addon).toEqual(mockAddon);
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockAddon));

      service.get(testId).subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Addon loaded', { id: testId });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.get(testId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to get addon', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('create()', () => {
    it('should call API with correct endpoint and data', () => {
      mockApiService.post.mockReturnValue(of(mockAddon));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(mockCreateRequest).subscribe(addon => {
        expect(mockApiService.post).toHaveBeenCalledWith('addons', mockCreateRequest);
        expect(addon).toEqual(mockAddon);
      });
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockAddon));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(mockCreateRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Addon created', { id: mockAddon.id });
      });
    });

    it('should refresh addon list after creation', () => {
      mockApiService.post.mockReturnValue(of(mockAddon));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(mockCreateRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(mockCreateRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create addon', error);
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

  describe('update()', () => {
    const testId = 'addon-123';

    it('should call API with correct endpoint and data', () => {
      mockApiService.put.mockReturnValue(of(mockAddon));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.update(testId, mockCreateRequest).subscribe(addon => {
        expect(mockApiService.put).toHaveBeenCalledWith('addons/addon-123', mockCreateRequest);
        expect(addon).toEqual(mockAddon);
      });
    });

    it('should log info message on success', () => {
      mockApiService.put.mockReturnValue(of(mockAddon));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.update(testId, mockCreateRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Addon updated', { id: mockAddon.id });
      });
    });

    it('should refresh addon list after update', () => {
      mockApiService.put.mockReturnValue(of(mockAddon));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.update(testId, mockCreateRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.update(testId, mockCreateRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to update addon', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if update fails', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.update(testId, mockCreateRequest).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('delete()', () => {
    const testId = 'addon-123';

    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testId).subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('addons/addon-123');
      });
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testId).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Addon deleted', { id: testId });
      });
    });

    it('should refresh addon list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.delete(testId).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('addons', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.delete(testId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete addon', error);
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
