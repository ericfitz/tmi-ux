// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationPrepareService } from './authorization-prepare.service';
import type { ProviderAdapterService } from './provider-adapter.service';
import type { LoggerService } from '@app/core/services/logger.service';
import type { Authorization } from '../../models/threat-model.model';

describe('AuthorizationPrepareService', () => {
  let service: AuthorizationPrepareService;
  let mockProviderAdapter: {
    transformProviderForApi: ReturnType<typeof vi.fn>;
    isValidForPrincipalType: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock ProviderAdapterService
    mockProviderAdapter = {
      transformProviderForApi: vi.fn(provider => provider), // Default: pass through
      isValidForPrincipalType: vi.fn(() => true), // Default: valid
    };

    // Create mock LoggerService
    mockLogger = {
      warn: vi.fn(),
    };

    // Instantiate service with mock dependencies
    service = new AuthorizationPrepareService(
      mockProviderAdapter as unknown as ProviderAdapterService,
      mockLogger as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('parseSubject()', () => {
    describe('Rule 1: Provider "tmi" or principal_type "group"', () => {
      it('should treat subject as provider_id when provider is "tmi"', () => {
        const result = service.parseSubject('user-123', 'tmi', 'user');

        expect(result).toEqual({
          provider_id: 'user-123',
          email: undefined,
        });
      });

      it('should treat subject as provider_id when principal_type is "group"', () => {
        const result = service.parseSubject('group-456', 'google', 'group');

        expect(result).toEqual({
          provider_id: 'group-456',
          email: undefined,
        });
      });

      it('should treat subject as provider_id when both provider is "tmi" AND principal_type is "group"', () => {
        const result = service.parseSubject('tmi-group-789', 'tmi', 'group');

        expect(result).toEqual({
          provider_id: 'tmi-group-789',
          email: undefined,
        });
      });

      it('should trim whitespace when treating as provider_id', () => {
        const result = service.parseSubject('  user-123  ', 'tmi', 'user');

        expect(result).toEqual({
          provider_id: 'user-123',
          email: undefined,
        });
      });
    });

    describe('Rule 2: Email format detection', () => {
      it('should treat valid email as email', () => {
        const result = service.parseSubject('user@example.com', 'google', 'user');

        expect(result).toEqual({
          provider_id: '',
          email: 'user@example.com',
        });
      });

      it('should handle email with subdomains', () => {
        const result = service.parseSubject('user@mail.example.com', 'github', 'user');

        expect(result).toEqual({
          provider_id: '',
          email: 'user@mail.example.com',
        });
      });

      it('should handle email with plus addressing', () => {
        const result = service.parseSubject('user+tag@example.com', 'google', 'user');

        expect(result).toEqual({
          provider_id: '',
          email: 'user+tag@example.com',
        });
      });

      it('should trim whitespace from email', () => {
        const result = service.parseSubject('  user@example.com  ', 'google', 'user');

        expect(result).toEqual({
          provider_id: '',
          email: 'user@example.com',
        });
      });
    });

    describe('Rule 3: Fallback to provider_id', () => {
      it('should treat non-email as provider_id', () => {
        const result = service.parseSubject('google-oauth-id-123', 'google', 'user');

        expect(result).toEqual({
          provider_id: 'google-oauth-id-123',
          email: undefined,
        });
      });

      it('should treat invalid email formats as provider_id', () => {
        const testCases = ['not-an-email', 'missing@domain', '@missing-user.com', 'no-at-sign.com'];

        testCases.forEach(subject => {
          const result = service.parseSubject(subject, 'github', 'user');
          expect(result).toEqual({
            provider_id: subject.trim(),
            email: undefined,
          });
        });
      });

      it('should handle empty string', () => {
        const result = service.parseSubject('', 'google', 'user');

        expect(result).toEqual({
          provider_id: '',
          email: undefined,
        });
      });

      it('should handle whitespace-only string', () => {
        const result = service.parseSubject('   ', 'google', 'user');

        expect(result).toEqual({
          provider_id: '',
          email: undefined,
        });
      });
    });
  });

  describe('validate()', () => {
    it('should return null for valid authorization with provider_id', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const auth: Authorization = {
        provider: 'google',
        provider_id: 'google-123',
        email: undefined,
        principal_type: 'user',
        role: 'writer',
      };

      const result = service.validate(auth);

      expect(result).toBeNull();
      expect(mockProviderAdapter.isValidForPrincipalType).toHaveBeenCalledWith('google', 'user');
    });

    it('should return null for valid authorization with email', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const auth: Authorization = {
        provider: 'google',
        provider_id: '',
        email: 'user@example.com',
        principal_type: 'user',
        role: 'reader',
      };

      const result = service.validate(auth);

      expect(result).toBeNull();
    });

    it('should return error when provider does not support principal type', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(false);

      const auth: Authorization = {
        provider: 'tmi',
        provider_id: 'user-123',
        email: undefined,
        principal_type: 'group',
        role: 'writer',
      };

      const result = service.validate(auth);

      expect(result).toBe('Provider "tmi" does not support "group" principals');
    });

    it('should return error when both provider_id and email are missing', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const auth: Authorization = {
        provider: 'google',
        provider_id: '',
        email: undefined,
        principal_type: 'user',
        role: 'writer',
      };

      const result = service.validate(auth);

      expect(result).toBe('Either provider_id or email is required');
    });

    it('should return error when both provider_id and email are whitespace', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const auth: Authorization = {
        provider: 'google',
        provider_id: '   ',
        email: '   ',
        principal_type: 'user',
        role: 'writer',
      };

      const result = service.validate(auth);

      expect(result).toBe('Either provider_id or email is required');
    });
  });

  describe('prepareForApi()', () => {
    it('should prepare authorization with provider_id', () => {
      mockProviderAdapter.transformProviderForApi.mockReturnValue('*');
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations = [
        {
          _subject: 'user-123',
          provider: 'tmi',
          principal_type: 'user' as const,
          role: 'writer' as const,
        },
      ];

      const result = service.prepareForApi(authorizations as Authorization[]);

      expect(result).toEqual([
        {
          provider: '*',
          provider_id: 'user-123',
          email: undefined,
          principal_type: 'user',
          role: 'writer',
        },
      ]);
      expect(mockProviderAdapter.transformProviderForApi).toHaveBeenCalledWith('tmi');
    });

    it('should prepare authorization with email', () => {
      mockProviderAdapter.transformProviderForApi.mockReturnValue('google');
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations = [
        {
          _subject: 'user@example.com',
          provider: 'google',
          principal_type: 'user' as const,
          role: 'reader' as const,
        },
      ];

      const result = service.prepareForApi(authorizations as Authorization[]);

      expect(result).toEqual([
        {
          provider: 'google',
          provider_id: '',
          email: 'user@example.com',
          principal_type: 'user',
          role: 'reader',
        },
      ]);
    });

    it('should remove _subject field from prepared authorization', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations = [
        {
          _subject: 'user@example.com',
          provider: 'google',
          principal_type: 'user' as const,
          role: 'writer' as const,
        },
      ];

      const result = service.prepareForApi(authorizations as Authorization[]);

      expect(result[0]).not.toHaveProperty('_subject');
    });

    it('should remove display_name field from prepared authorization', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations = [
        {
          _subject: 'user@example.com',
          provider: 'google',
          principal_type: 'user' as const,
          role: 'writer' as const,
          display_name: 'John Doe',
        },
      ];

      const result = service.prepareForApi(authorizations as Authorization[]);

      expect(result[0]).not.toHaveProperty('display_name');
    });

    it('should use existing provider_id if _subject is missing', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations: Authorization[] = [
        {
          provider: 'google',
          provider_id: 'existing-id',
          email: undefined,
          principal_type: 'user',
          role: 'writer',
        },
      ];

      const result = service.prepareForApi(authorizations);

      expect(result[0].provider_id).toBe('existing-id');
    });

    it('should use existing email if _subject is missing', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations: Authorization[] = [
        {
          provider: 'google',
          provider_id: '',
          email: 'existing@example.com',
          principal_type: 'user',
          role: 'writer',
        },
      ];

      const result = service.prepareForApi(authorizations);

      expect(result[0].email).toBe('existing@example.com');
    });

    it('should log warning for invalid authorizations', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(false);

      const authorizations = [
        {
          _subject: 'user-123',
          provider: 'tmi',
          principal_type: 'group' as const,
          role: 'writer' as const,
        },
      ];

      service.prepareForApi(authorizations as Authorization[]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid authorization: Provider "tmi" does not support "group" principals',
        expect.objectContaining({
          provider: expect.any(String),
          principal_type: 'group',
        }),
      );
    });

    it('should prepare multiple authorizations', () => {
      mockProviderAdapter.transformProviderForApi.mockImplementation(p => (p === 'tmi' ? '*' : p));
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations = [
        {
          _subject: 'user-123',
          provider: 'tmi',
          principal_type: 'user' as const,
          role: 'writer' as const,
        },
        {
          _subject: 'user@example.com',
          provider: 'google',
          principal_type: 'user' as const,
          role: 'reader' as const,
        },
        {
          _subject: 'group-456',
          provider: 'github',
          principal_type: 'group' as const,
          role: 'writer' as const,
        },
      ];

      const result = service.prepareForApi(authorizations as Authorization[]);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        provider: '*',
        provider_id: 'user-123',
        email: undefined,
        principal_type: 'user',
        role: 'writer',
      });
      expect(result[1]).toEqual({
        provider: 'google',
        provider_id: '',
        email: 'user@example.com',
        principal_type: 'user',
        role: 'reader',
      });
      expect(result[2]).toEqual({
        provider: 'github',
        provider_id: 'group-456',
        email: undefined,
        principal_type: 'group',
        role: 'writer',
      });
    });

    it('should handle empty authorizations array', () => {
      const result = service.prepareForApi([]);

      expect(result).toEqual([]);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should preserve other authorization fields', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);

      const authorizations = [
        {
          _subject: 'user-123',
          provider: 'tmi',
          principal_type: 'user' as const,
          role: 'writer' as const,
          custom_field: 'custom-value',
        },
      ];

      const result = service.prepareForApi(authorizations as Authorization[]);

      expect(result[0]).toHaveProperty('custom_field', 'custom-value');
    });
  });
});
