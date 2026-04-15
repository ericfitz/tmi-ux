// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { SettingsAdminService } from './settings-admin.service';
import { ApiService } from './api.service';
import { SystemSetting, SystemSettingUpdate } from '@app/types/settings.types';

describe('SettingsAdminService', () => {
  let service: SettingsAdminService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const mockSetting: SystemSetting = {
    key: 'rate_limit.requests_per_minute',
    value: '100',
    type: 'int',
    description: 'Maximum API requests per minute per user',
    modified_at: '2026-01-15T10:30:00Z',
    modified_by: '550e8400-e29b-41d4-a716-446655440000',
    source: 'database',
    read_only: false,
  };

  const mockSettings: SystemSetting[] = [
    mockSetting,
    {
      key: 'feature.websocket_enabled',
      value: 'true',
      type: 'bool',
      description: 'Whether WebSocket collaboration is enabled',
      modified_at: '2026-01-10T08:00:00Z',
      source: 'config',
      read_only: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiService = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    service = new SettingsAdminService(mockApiService as unknown as ApiService);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('listSettings()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockSettings));

      service.listSettings().subscribe(settings => {
        expect(mockApiService.get).toHaveBeenCalledWith('/admin/settings');
        expect(settings).toEqual(mockSettings);
        expect(settings).toHaveLength(2);
      });
    });

    it('should handle API errors', () => {
      const error = new Error('Server error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listSettings().subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getSetting()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockSetting));

      service.getSetting('rate_limit.requests_per_minute').subscribe(setting => {
        expect(mockApiService.get).toHaveBeenCalledWith(
          '/admin/settings/rate_limit.requests_per_minute',
        );
        expect(setting).toEqual(mockSetting);
      });
    });

    it('should handle API errors', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getSetting('nonexistent').subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('updateSetting()', () => {
    it('should call API with correct endpoint and data', () => {
      const update: SystemSettingUpdate = {
        value: '150',
        type: 'int',
        description: 'Updated rate limit',
      };
      mockApiService.put.mockReturnValue(of(mockSetting));

      service.updateSetting('rate_limit.requests_per_minute', update).subscribe(setting => {
        expect(mockApiService.put).toHaveBeenCalledWith(
          '/admin/settings/rate_limit.requests_per_minute',
          update,
        );
        expect(setting).toEqual(mockSetting);
      });
    });

    it('should handle update without description', () => {
      const update: SystemSettingUpdate = {
        value: 'true',
        type: 'bool',
      };
      mockApiService.put.mockReturnValue(of(mockSetting));

      service.updateSetting('feature.websocket_enabled', update).subscribe(() => {
        expect(mockApiService.put).toHaveBeenCalledWith(
          '/admin/settings/feature.websocket_enabled',
          update,
        );
      });
    });
  });

  describe('deleteSetting()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteSetting('rate_limit.requests_per_minute').subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith(
          '/admin/settings/rate_limit.requests_per_minute',
        );
      });
    });

    it('should handle API errors', () => {
      const error = new Error('Forbidden');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteSetting('rate_limit.requests_per_minute').subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });
    });
  });
});
