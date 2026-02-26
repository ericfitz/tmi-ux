// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Params } from '@angular/router';
import { LoginComponent } from './login.component';
import { OAuthProviderInfo, SAMLProviderInfo } from '../../models/auth.models';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let queryParamsSubject: BehaviorSubject<Params>;
  let mockAuthService: {
    getAvailableProviders: ReturnType<typeof vi.fn>;
    getAvailableSAMLProviders: ReturnType<typeof vi.fn>;
  };
  let mockRoute: { queryParams: BehaviorSubject<Params> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };

  const mockOAuthProviders: OAuthProviderInfo[] = [
    {
      id: 'github',
      name: 'GitHub',
      icon: 'fa-github',
      auth_url: 'https://api.example.com/oauth/github',
      redirect_uri: 'http://localhost:4200/oauth2/callback',
      client_id: 'github-client-id',
    },
    {
      id: 'google',
      name: 'Google',
      icon: '/icons/google.png',
      auth_url: 'https://api.example.com/oauth/google',
      redirect_uri: 'http://localhost:4200/oauth2/callback',
      client_id: 'google-client-id',
    },
    {
      id: 'tmi',
      name: 'TMI',
      icon: '/icons/tmi.svg',
      auth_url: 'https://api.example.com/oauth/tmi',
      redirect_uri: 'http://localhost:4200/oauth2/callback',
      client_id: 'tmi-client-id',
    },
  ];

  const mockSAMLProviders: SAMLProviderInfo[] = [
    {
      id: 'okta',
      name: 'Okta',
      icon: '/icons/okta.png',
      auth_url: 'https://api.example.com/saml/okta',
      metadata_url: 'https://api.example.com/saml/okta/metadata',
      entity_id: 'okta-entity',
      acs_url: 'https://api.example.com/saml/okta/acs',
    },
  ];

  beforeEach(() => {
    queryParamsSubject = new BehaviorSubject<Params>({});

    mockAuthService = {
      getAvailableProviders: vi.fn().mockReturnValue(of(mockOAuthProviders)),
      getAvailableSAMLProviders: vi.fn().mockReturnValue(of(mockSAMLProviders)),
    };

    mockRoute = {
      queryParams: queryParamsSubject,
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    // Clear sessionStorage before each test
    sessionStorage.clear();

    component = new LoginComponent(
      mockAuthService as any,
      mockRoute as any,
      mockRouter as any,
      mockLogger as any,
    );
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should not be loading initially', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      expect(component.error).toBeNull();
    });

    it('should have providers loading initially', () => {
      expect(component.providersLoading).toBe(true);
    });

    it('should not show session expired initially', () => {
      expect(component.sessionExpired).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('should load OAuth and SAML providers', () => {
      component.ngOnInit();

      expect(mockAuthService.getAvailableProviders).toHaveBeenCalled();
      expect(mockAuthService.getAvailableSAMLProviders).toHaveBeenCalled();
    });

    it('should sort providers with tmi last', () => {
      component.ngOnInit();

      // tmi should be last
      const lastOAuth = component.oauthProviders[component.oauthProviders.length - 1];
      expect(lastOAuth.id).toBe('tmi');
    });

    it('should sort non-tmi providers alphabetically', () => {
      component.ngOnInit();

      // GitHub and Google should be sorted alphabetically before TMI
      expect(component.oauthProviders[0].id).toBe('github');
      expect(component.oauthProviders[1].id).toBe('google');
    });

    it('should set providersLoading to false after load', () => {
      component.ngOnInit();

      expect(component.providersLoading).toBe(false);
    });

    it('should handle provider load error', () => {
      mockAuthService.getAvailableProviders.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      component.ngOnInit();

      expect(component.providersLoading).toBe(false);
      expect(component.error).toBe('Failed to load authentication providers');
    });

    it('should detect session expired from query params', () => {
      queryParamsSubject.next({ reason: 'session_expired' });

      component.ngOnInit();

      expect(component.sessionExpired).toBe(true);
    });

    it('should capture returnUrl from query params', () => {
      queryParamsSubject.next({ returnUrl: '/threat-models/123' });

      component.ngOnInit();

      // Verify returnUrl is used in login navigation
      component.oauthProviders = mockOAuthProviders;
      component.loginWithOAuth('github');

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/oauth2/callback'],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            returnUrl: '/threat-models/123',
          }),
        }),
      );
    });

    it('should read auth_error from sessionStorage', () => {
      sessionStorage.setItem(
        'auth_error',
        JSON.stringify({ message: 'OAuth callback failed', code: 'callback_error' }),
      );

      component.ngOnInit();

      expect(component.error).toBe('OAuth callback failed');
    });

    it('should clear auth_error from sessionStorage after reading', () => {
      sessionStorage.setItem('auth_error', JSON.stringify({ message: 'Error' }));

      component.ngOnInit();

      expect(sessionStorage.getItem('auth_error')).toBeNull();
    });

    it('should handle malformed auth_error in sessionStorage', () => {
      sessionStorage.setItem('auth_error', 'not-json');

      component.ngOnInit();

      expect(component.error).toBe('Authentication failed');
    });
  });

  describe('loginWithOAuth', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should navigate to callback with provider params', () => {
      component.loginWithOAuth('github');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/oauth2/callback'], {
        queryParams: {
          action: 'login',
          providerId: 'github',
          providerName: 'GitHub',
          providerType: 'oauth',
          returnUrl: undefined,
        },
      });
    });

    it('should not navigate for unknown provider', () => {
      component.loginWithOAuth('nonexistent');

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('loginWithSAML', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should navigate to callback with SAML provider params', () => {
      component.loginWithSAML('okta');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/oauth2/callback'], {
        queryParams: {
          action: 'login',
          providerId: 'okta',
          providerName: 'Okta',
          providerType: 'saml',
          returnUrl: undefined,
        },
      });
    });

    it('should not navigate for unknown SAML provider', () => {
      component.loginWithSAML('nonexistent');

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should navigate to home page', () => {
      component.cancel();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('provider logo helpers', () => {
    it('should detect FontAwesome icons', () => {
      component.ngOnInit();

      // GitHub has fa-github icon
      expect(component.isFontAwesomeIcon('github')).toBe(true);
    });

    it('should return FontAwesome class', () => {
      component.ngOnInit();

      expect(component.getFontAwesomeIcon('github')).toBe('fa-github');
    });

    it('should return empty string for non-FontAwesome provider', () => {
      expect(component.getFontAwesomeIcon('nonexistent')).toBe('');
    });

    it('should return fallback logo for tmi provider', () => {
      expect(component.getProviderLogoPath('tmi')).toBe('assets/signin-logos/tmi.svg');
    });

    it('should return oauth fallback for unknown oauth provider', () => {
      expect(component.getProviderLogoPath('unknown', 'oauth')).toBe(
        'assets/signin-logos/oauth.svg',
      );
    });

    it('should return saml fallback for unknown saml provider', () => {
      expect(component.getProviderLogoPath('unknown', 'saml')).toBe('assets/signin-logos/saml.svg');
    });

    it('should delegate getSAMLProviderLogoPath to getProviderLogoPath with saml type', () => {
      expect(component.getSAMLProviderLogoPath('unknown')).toBe('assets/signin-logos/saml.svg');
    });
  });
});
