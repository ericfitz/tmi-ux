// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { of, throwError, lastValueFrom } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ClientCredentialService } from './client-credential.service';
import type { ApiService } from './api.service';
import type { LoggerService } from './logger.service';
import type {
  ClientCredentialInfo,
  ClientCredentialResponse,
  ListClientCredentialsResponse,
} from '@app/types/client-credential.types';

describe('ClientCredentialService', () => {
  let service: ClientCredentialService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockCredential: ClientCredentialInfo = {
    id: 'cred-1',
    client_id: 'tmi_cc_abc123',
    name: 'Test Credential',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
  };

  const mockCreatedCredential: ClientCredentialResponse = {
    id: 'cred-2',
    client_id: 'tmi_cc_def456',
    client_secret: 'secret_xyz789',
    name: 'New Credential',
    created_at: '2024-01-02T00:00:00Z',
  };

  beforeEach(() => {
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new ClientCredentialService(
      mockApiService as unknown as ApiService,
      mockLogger as unknown as LoggerService,
    );
  });

  describe('list', () => {
    it('should GET me/client_credentials and extract credentials array', async () => {
      const response: ListClientCredentialsResponse = {
        client_credentials: [mockCredential],
        total: 1,
        limit: 50,
        offset: 0,
      };
      mockApiService.get.mockReturnValue(of(response));

      const result = await lastValueFrom(service.list());

      expect(mockApiService.get).toHaveBeenCalledWith('me/client_credentials');
      expect(result).toEqual([mockCredential]);
      expect(mockLogger.debug).toHaveBeenCalledWith('Client credentials loaded', {
        count: 1,
      });
    });

    it('should return empty array when response has no client_credentials', async () => {
      mockApiService.get.mockReturnValue(of({}));

      const result = await lastValueFrom(service.list());

      expect(result).toEqual([]);
    });

    it('should return empty array when client_credentials is undefined', async () => {
      mockApiService.get.mockReturnValue(of({ client_credentials: undefined }));

      const result = await lastValueFrom(service.list());

      expect(result).toEqual([]);
    });

    it('should return empty array when client_credentials is null', async () => {
      mockApiService.get.mockReturnValue(of({ client_credentials: null }));

      const result = await lastValueFrom(service.list());

      // null || [] evaluates to []
      expect(result).toEqual([]);
    });

    it('should propagate error from API and log it', async () => {
      const apiError = new Error('Network error');
      mockApiService.get.mockReturnValue(throwError(() => apiError));

      await expect(lastValueFrom(service.list())).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list client credentials', apiError);
    });
  });

  describe('create', () => {
    it('should POST to me/client_credentials with input data', async () => {
      mockApiService.post.mockReturnValue(of(mockCreatedCredential));

      const input = { name: 'New Credential' };
      const result = await lastValueFrom(service.create(input));

      expect(mockApiService.post).toHaveBeenCalledWith('me/client_credentials', input);
      expect(result).toEqual(mockCreatedCredential);
      expect(result.client_secret).toBe('secret_xyz789');
      expect(mockLogger.info).toHaveBeenCalledWith('Client credential created', {
        id: 'cred-2',
      });
    });

    it('should pass through all input properties including optional ones', async () => {
      mockApiService.post.mockReturnValue(of(mockCreatedCredential));

      const input = {
        name: 'Full Credential',
        description: 'Test description',
        expires_at: '2025-12-31T23:59:59Z',
      };
      await lastValueFrom(service.create(input));

      expect(mockApiService.post).toHaveBeenCalledWith('me/client_credentials', input);
    });

    it('should propagate error from API and log it', async () => {
      const apiError = new Error('Validation failed');
      mockApiService.post.mockReturnValue(throwError(() => apiError));

      await expect(lastValueFrom(service.create({ name: 'Test' }))).rejects.toThrow(
        'Validation failed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create client credential', apiError);
    });
  });

  describe('delete', () => {
    it('should DELETE me/client_credentials/{id}', async () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      await lastValueFrom(service.delete('cred-1'));

      expect(mockApiService.delete).toHaveBeenCalledWith('me/client_credentials/cred-1');
      expect(mockLogger.info).toHaveBeenCalledWith('Client credential deleted', {
        id: 'cred-1',
      });
    });

    it('should pass path traversal characters unsanitized in ID', async () => {
      // Security test: the template literal doesn't sanitize the ID
      // This documents the behavior — ApiService or server should handle this
      mockApiService.delete.mockReturnValue(of(undefined));

      await lastValueFrom(service.delete('../../admin/settings'));

      expect(mockApiService.delete).toHaveBeenCalledWith(
        'me/client_credentials/../../admin/settings',
      );
    });

    it('should pass URL-encoded characters unsanitized in ID', async () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      await lastValueFrom(service.delete('%2F..%2F..%2Fadmin'));

      expect(mockApiService.delete).toHaveBeenCalledWith(
        'me/client_credentials/%2F..%2F..%2Fadmin',
      );
    });

    it('should construct path with empty string ID', async () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      await lastValueFrom(service.delete(''));

      // Results in 'me/client_credentials/' — trailing slash
      expect(mockApiService.delete).toHaveBeenCalledWith('me/client_credentials/');
    });

    it('should propagate error from API and log it', async () => {
      const apiError = new Error('Not found');
      mockApiService.delete.mockReturnValue(throwError(() => apiError));

      await expect(lastValueFrom(service.delete('cred-1'))).rejects.toThrow('Not found');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete client credential', apiError);
    });
  });
});
