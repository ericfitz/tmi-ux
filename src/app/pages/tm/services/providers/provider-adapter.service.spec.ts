// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderAdapterService } from './provider-adapter.service';

describe('ProviderAdapterService', () => {
  let service: ProviderAdapterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProviderAdapterService();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('isValidForPrincipalType()', () => {
    describe('TMI Provider', () => {
      it('should not support user-type principals', () => {
        const result = service.isValidForPrincipalType('tmi', 'user');

        expect(result).toBe(false);
      });

      it('should support group-type principals', () => {
        const result = service.isValidForPrincipalType('tmi', 'group');

        expect(result).toBe(true);
      });
    });

    describe('OAuth/SAML Providers (default rule)', () => {
      it('should support user-type principals for google', () => {
        const result = service.isValidForPrincipalType('google', 'user');

        expect(result).toBe(true);
      });

      it('should support group-type principals for google', () => {
        const result = service.isValidForPrincipalType('google', 'group');

        expect(result).toBe(true);
      });

      it('should support user-type principals for github', () => {
        const result = service.isValidForPrincipalType('github', 'user');

        expect(result).toBe(true);
      });

      it('should support group-type principals for github', () => {
        const result = service.isValidForPrincipalType('github', 'group');

        expect(result).toBe(true);
      });

      it('should support user-type principals for unknown provider', () => {
        const result = service.isValidForPrincipalType('unknown-provider', 'user');

        expect(result).toBe(true);
      });

      it('should support group-type principals for unknown provider', () => {
        const result = service.isValidForPrincipalType('unknown-provider', 'group');

        expect(result).toBe(true);
      });
    });
  });

  describe('getDefaultSubject()', () => {
    it('should return "everyone" for tmi provider', () => {
      const result = service.getDefaultSubject('tmi', 'group');

      expect(result).toBe('everyone');
    });

    it('should return "everyone" for tmi provider regardless of principal type', () => {
      const userResult = service.getDefaultSubject('tmi', 'user');
      const groupResult = service.getDefaultSubject('tmi', 'group');

      expect(userResult).toBe('everyone');
      expect(groupResult).toBe('everyone');
    });

    it('should return null for OAuth providers', () => {
      const googleResult = service.getDefaultSubject('google', 'user');
      const githubResult = service.getDefaultSubject('github', 'user');

      expect(googleResult).toBeNull();
      expect(githubResult).toBeNull();
    });

    it('should return null for unknown providers', () => {
      const result = service.getDefaultSubject('unknown-provider', 'user');

      expect(result).toBeNull();
    });
  });

  describe('transformProviderForApi()', () => {
    it('should transform "tmi" to "*"', () => {
      const result = service.transformProviderForApi('tmi');

      expect(result).toBe('*');
    });

    it('should return OAuth provider as-is (google)', () => {
      const result = service.transformProviderForApi('google');

      expect(result).toBe('google');
    });

    it('should return OAuth provider as-is (github)', () => {
      const result = service.transformProviderForApi('github');

      expect(result).toBe('github');
    });

    it('should return unknown provider as-is', () => {
      const result = service.transformProviderForApi('custom-provider');

      expect(result).toBe('custom-provider');
    });

    it('should handle empty string', () => {
      const result = service.transformProviderForApi('');

      expect(result).toBe('');
    });
  });

  describe('transformProviderForDisplay()', () => {
    it('should transform "*" to "tmi"', () => {
      const result = service.transformProviderForDisplay('*');

      expect(result).toBe('tmi');
    });

    it('should return OAuth provider as-is (google)', () => {
      const result = service.transformProviderForDisplay('google');

      expect(result).toBe('google');
    });

    it('should return OAuth provider as-is (github)', () => {
      const result = service.transformProviderForDisplay('github');

      expect(result).toBe('github');
    });

    it('should return unknown provider as-is', () => {
      const result = service.transformProviderForDisplay('unknown-provider');

      expect(result).toBe('unknown-provider');
    });

    it('should handle empty string', () => {
      const result = service.transformProviderForDisplay('');

      expect(result).toBe('');
    });

    it('should correctly reverse transform tmi → * → tmi', () => {
      const apiProvider = service.transformProviderForApi('tmi');
      const uiProvider = service.transformProviderForDisplay(apiProvider);

      expect(apiProvider).toBe('*');
      expect(uiProvider).toBe('tmi');
    });
  });

  describe('getProviderDisplayName()', () => {
    it('should return "TMI" for tmi provider', () => {
      const result = service.getProviderDisplayName('tmi');

      expect(result).toBe('TMI');
    });

    it('should capitalize first letter for OAuth providers (google)', () => {
      const result = service.getProviderDisplayName('google');

      expect(result).toBe('Google');
    });

    it('should capitalize first letter for OAuth providers (github)', () => {
      const result = service.getProviderDisplayName('github');

      expect(result).toBe('Github');
    });

    it('should capitalize first letter for unknown providers', () => {
      const result = service.getProviderDisplayName('custom-provider');

      expect(result).toBe('Custom-provider');
    });

    it('should handle single-character provider names', () => {
      const result = service.getProviderDisplayName('x');

      expect(result).toBe('X');
    });

    it('should handle empty string', () => {
      const result = service.getProviderDisplayName('');

      expect(result).toBe('');
    });

    it('should handle already-capitalized provider names', () => {
      const result = service.getProviderDisplayName('Azure');

      expect(result).toBe('Azure');
    });

    it('should preserve case for all characters except first', () => {
      const result = service.getProviderDisplayName('myCustomProvider');

      expect(result).toBe('MyCustomProvider');
    });
  });

  describe('getBuiltInProviders()', () => {
    it('should return TMI as a built-in provider', () => {
      const providers = service.getBuiltInProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('tmi');
      expect(providers[0].name).toBe('TMI');
    });

    it('should return OAuthProviderInfo-compatible objects', () => {
      const providers = service.getBuiltInProviders();

      for (const provider of providers) {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('icon');
        expect(provider).toHaveProperty('auth_url');
        expect(provider).toHaveProperty('redirect_uri');
        expect(provider).toHaveProperty('client_id');
      }
    });

    it('should set empty strings for OAuth-specific fields', () => {
      const providers = service.getBuiltInProviders();
      const tmi = providers.find(p => p.id === 'tmi');

      expect(tmi?.auth_url).toBe('');
      expect(tmi?.redirect_uri).toBe('');
      expect(tmi?.client_id).toBe('');
    });
  });

  describe('Provider Rule Integration', () => {
    it('should consistently handle tmi provider across all methods', () => {
      // tmi provider rules
      expect(service.isValidForPrincipalType('tmi', 'user')).toBe(false);
      expect(service.isValidForPrincipalType('tmi', 'group')).toBe(true);
      expect(service.getDefaultSubject('tmi', 'group')).toBe('everyone');
      expect(service.transformProviderForApi('tmi')).toBe('*');
      expect(service.getProviderDisplayName('tmi')).toBe('TMI');
    });

    it('should consistently handle OAuth providers across all methods', () => {
      // google provider rules (default)
      expect(service.isValidForPrincipalType('google', 'user')).toBe(true);
      expect(service.isValidForPrincipalType('google', 'group')).toBe(true);
      expect(service.getDefaultSubject('google', 'user')).toBeNull();
      expect(service.transformProviderForApi('google')).toBe('google');
      expect(service.getProviderDisplayName('google')).toBe('Google');
    });

    it('should consistently handle unknown providers with default rules', () => {
      // unknown provider gets default rules
      expect(service.isValidForPrincipalType('unknown', 'user')).toBe(true);
      expect(service.isValidForPrincipalType('unknown', 'group')).toBe(true);
      expect(service.getDefaultSubject('unknown', 'user')).toBeNull();
      expect(service.transformProviderForApi('unknown')).toBe('unknown');
      expect(service.getProviderDisplayName('unknown')).toBe('Unknown');
    });
  });

  describe('Edge Cases', () => {
    it('should handle providers with special characters', () => {
      const provider = 'provider-with-dashes';

      expect(service.isValidForPrincipalType(provider, 'user')).toBe(true);
      expect(service.transformProviderForApi(provider)).toBe(provider);
      expect(service.getProviderDisplayName(provider)).toBe('Provider-with-dashes');
    });

    it('should handle providers with numbers', () => {
      const provider = 'oauth2';

      expect(service.isValidForPrincipalType(provider, 'user')).toBe(true);
      expect(service.transformProviderForApi(provider)).toBe(provider);
      expect(service.getProviderDisplayName(provider)).toBe('Oauth2');
    });

    it('should handle case-sensitive provider lookup', () => {
      // Provider rules are case-sensitive
      expect(service.transformProviderForApi('TMI')).toBe('TMI'); // Not 'tmi', so no transformation
      expect(service.transformProviderForApi('tmi')).toBe('*'); // Exact match
    });
  });
});
