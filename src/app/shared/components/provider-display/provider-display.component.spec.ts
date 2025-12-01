// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderDisplayComponent } from './provider-display.component';

describe('ProviderDisplayComponent', () => {
  let component: ProviderDisplayComponent;

  beforeEach(() => {
    component = new ProviderDisplayComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getProviderLogoPath', () => {
    describe('with provider string input', () => {
      it('should return correct path for google', () => {
        component.provider = 'google';
        expect(component.getProviderLogoPath()).toBe('assets/signin-logos/google-signin-logo.svg');
      });

      it('should return correct path for github', () => {
        component.provider = 'github';
        expect(component.getProviderLogoPath()).toBe('assets/signin-logos/github-signin-logo.svg');
      });

      it('should return correct path for microsoft', () => {
        component.provider = 'microsoft';
        expect(component.getProviderLogoPath()).toBe(
          'assets/signin-logos/microsoft-signin-logo.svg',
        );
      });

      it('should return correct path for gitlab', () => {
        component.provider = 'gitlab';
        expect(component.getProviderLogoPath()).toBe('assets/signin-logos/gitlab-signin-logo.svg');
      });

      it('should return correct path for bitbucket', () => {
        component.provider = 'bitbucket';
        expect(component.getProviderLogoPath()).toBe(
          'assets/signin-logos/bitbucket-signin-logo.svg',
        );
      });

      it('should return correct path for apple', () => {
        component.provider = 'apple';
        expect(component.getProviderLogoPath()).toBe('assets/signin-logos/apple-signin-logo.svg');
      });

      it('should return correct path for test', () => {
        component.provider = 'test';
        expect(component.getProviderLogoPath()).toBe('TMI-Logo.svg');
      });

      it('should return null for unknown provider', () => {
        component.provider = 'unknown';
        expect(component.getProviderLogoPath()).toBeNull();
      });

      it('should be case-insensitive', () => {
        component.provider = 'GOOGLE';
        expect(component.getProviderLogoPath()).toBe('assets/signin-logos/google-signin-logo.svg');
      });
    });

    describe('with providerInfo object input', () => {
      it('should use absolute URL icon from API when available', () => {
        component.providerInfo = {
          id: 'custom',
          name: 'Custom Provider',
          icon: 'https://example.com/custom-icon.svg',
          auth_url: 'https://example.com/auth',
          token_url: 'https://example.com/token',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
        };
        expect(component.getProviderLogoPath()).toBe('https://example.com/custom-icon.svg');
      });

      it('should prepend API URL for relative icon paths (with leading slash)', () => {
        component.providerInfo = {
          id: 'custom',
          name: 'Custom Provider',
          icon: '/icons/custom.svg',
          auth_url: 'https://example.com/auth',
          token_url: 'https://example.com/token',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
        };
        // Should use environment.apiUrl (http://localhost:8080 in dev)
        expect(component.getProviderLogoPath()).toMatch(
          /^http:\/\/localhost:8080\/icons\/custom\.svg$/,
        );
      });

      it('should prepend API URL for relative icon paths (without leading slash)', () => {
        component.providerInfo = {
          id: 'custom',
          name: 'Custom Provider',
          icon: 'microsoft.svg',
          auth_url: 'https://example.com/auth',
          token_url: 'https://example.com/token',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
        };
        // Should add slash and prepend API URL
        expect(component.getProviderLogoPath()).toMatch(
          /^http:\/\/localhost:8080\/microsoft\.svg$/,
        );
      });

      it('should return null for FontAwesome icons', () => {
        component.providerInfo = {
          id: 'custom',
          name: 'Custom Provider',
          icon: 'fa-custom-icon',
          auth_url: 'https://example.com/auth',
          token_url: 'https://example.com/token',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
        };
        expect(component.getProviderLogoPath()).toBeNull();
      });

      it('should fall back to hardcoded path when icon not provided', () => {
        component.providerInfo = {
          id: 'google',
          name: 'Google',
          icon: '',
          auth_url: 'https://example.com/auth',
          token_url: 'https://example.com/token',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
        };
        expect(component.getProviderLogoPath()).toBe('assets/signin-logos/google-signin-logo.svg');
      });
    });
  });

  describe('isFontAwesomeIcon', () => {
    it('should return true for FontAwesome icon paths', () => {
      component.providerInfo = {
        id: 'custom',
        name: 'Custom',
        icon: 'fa-brands fa-microsoft',
        auth_url: 'https://example.com/auth',
        token_url: 'https://example.com/token',
        redirect_uri: 'https://example.com/callback',
        client_id: 'test-client',
      };
      expect(component.isFontAwesomeIcon()).toBe(true);
    });

    it('should return false for absolute URL icons', () => {
      component.providerInfo = {
        id: 'custom',
        name: 'Custom',
        icon: 'https://example.com/icon.svg',
        auth_url: 'https://example.com/auth',
        token_url: 'https://example.com/token',
        redirect_uri: 'https://example.com/callback',
        client_id: 'test-client',
      };
      expect(component.isFontAwesomeIcon()).toBe(false);
    });

    it('should return false for relative URL icons', () => {
      component.providerInfo = {
        id: 'custom',
        name: 'Custom',
        icon: 'microsoft.svg',
        auth_url: 'https://example.com/auth',
        token_url: 'https://example.com/token',
        redirect_uri: 'https://example.com/callback',
        client_id: 'test-client',
      };
      expect(component.isFontAwesomeIcon()).toBe(false);
    });

    it('should return false when no providerInfo', () => {
      expect(component.isFontAwesomeIcon()).toBe(false);
    });
  });

  describe('getFontAwesomeIcon', () => {
    it('should return the FontAwesome class string', () => {
      component.providerInfo = {
        id: 'custom',
        name: 'Custom',
        icon: 'fa-brands fa-microsoft',
        auth_url: 'https://example.com/auth',
        token_url: 'https://example.com/token',
        redirect_uri: 'https://example.com/callback',
        client_id: 'test-client',
      };
      expect(component.getFontAwesomeIcon()).toBe('fa-brands fa-microsoft');
    });

    it('should return empty string for non-FontAwesome icons', () => {
      component.providerInfo = {
        id: 'custom',
        name: 'Custom',
        icon: 'https://example.com/icon.svg',
        auth_url: 'https://example.com/auth',
        token_url: 'https://example.com/token',
        redirect_uri: 'https://example.com/callback',
        client_id: 'test-client',
      };
      expect(component.getFontAwesomeIcon()).toBe('');
    });

    it('should return empty string when no providerInfo', () => {
      expect(component.getFontAwesomeIcon()).toBe('');
    });
  });

  describe('getProviderName', () => {
    describe('with provider string input', () => {
      it('should return "GitHub" with capital H', () => {
        component.provider = 'github';
        expect(component.getProviderName()).toBe('GitHub');
      });

      it('should return "GitLab" with capital L', () => {
        component.provider = 'gitlab';
        expect(component.getProviderName()).toBe('GitLab');
      });

      it('should return "Google" capitalized', () => {
        component.provider = 'google';
        expect(component.getProviderName()).toBe('Google');
      });

      it('should return "Microsoft" capitalized', () => {
        component.provider = 'microsoft';
        expect(component.getProviderName()).toBe('Microsoft');
      });

      it('should return "Bitbucket" with only first letter capitalized', () => {
        component.provider = 'bitbucket';
        expect(component.getProviderName()).toBe('Bitbucket');
      });

      it('should return "Apple" capitalized', () => {
        component.provider = 'apple';
        expect(component.getProviderName()).toBe('Apple');
      });

      it('should return "TMI Test" for test provider', () => {
        component.provider = 'test';
        expect(component.getProviderName()).toBe('TMI Test');
      });

      it('should capitalize first letter for unknown providers', () => {
        component.provider = 'unknown';
        expect(component.getProviderName()).toBe('Unknown');
      });

      it('should be case-insensitive for known providers', () => {
        component.provider = 'GITHUB';
        expect(component.getProviderName()).toBe('GitHub');

        component.provider = 'GiTlAb';
        expect(component.getProviderName()).toBe('GitLab');
      });
    });

    describe('with providerInfo object input', () => {
      it('should use name from API when available', () => {
        component.providerInfo = {
          id: 'custom',
          name: 'Custom OAuth Provider',
          icon: 'https://example.com/icon.svg',
          auth_url: 'https://example.com/auth',
          token_url: 'https://example.com/token',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
        };
        expect(component.getProviderName()).toBe('Custom OAuth Provider');
      });

      it('should fall back to capitalizing ID when name not provided', () => {
        component.providerInfo = {
          id: 'github',
          name: '',
          auth_url: 'https://example.com/auth',
          token_url: 'https://example.com/token',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
          icon: 'https://example.com/icon.svg',
        };
        expect(component.getProviderName()).toBe('GitHub');
      });
    });
  });

  // Template rendering tests removed - these should be done with Playwright integration tests
  // The component's business logic (getProviderLogoPath and getProviderName) is fully tested above
});
