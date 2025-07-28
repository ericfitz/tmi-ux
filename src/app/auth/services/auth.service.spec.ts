// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { LocalOAuthProviderService } from './local-oauth-provider.service';
import { JwtToken, UserProfile, OAuthResponse, AuthError, UserRole, ProvidersResponse } from '../models/auth.models';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    logLevel: 'DEBUG',
    apiUrl: 'http://localhost:8080',
    authTokenExpiryMinutes: 60,
    operatorName: 'TMI Operator (Test)',
    operatorContact: 'test@example.com',
    oauth: {
      local: {
        enabled: true,
        icon: 'fa-solid fa-laptop-code',
        users: [
          { id: 'user1', name: 'Test User', email: 'user1@example.com' },
        ],
      },
    },
  },
}));

import { environment } from '../../../environments/environment';

// Mock interfaces for type safety
interface MockLoggerService {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  debugComponent: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  logInit: ReturnType<typeof vi.fn>;
}

interface MockRouter {
  navigate: ReturnType<typeof vi.fn>;
}

interface MockStorage {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

interface MockCrypto {
  getRandomValues: ReturnType<typeof vi.fn>;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpClient: HttpClient;
  let loggerService: MockLoggerService;
  let router: MockRouter;
  let localProvider: LocalOAuthProviderService;
  let localStorageMock: MockStorage;
  let cryptoMock: MockCrypto;

  // Test data
  const mockJwtToken: JwtToken = {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwicGljdHVyZSI6Imh0dHA6Ly9leGFtcGxlLmNvbS9waWMuanBnIiwiaWF0IjoxNTE2MjM5MDIyfQ.signature',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };

  const mockExpiredToken: JwtToken = {
    token: 'expired.jwt.token',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
  };

  const mockUserProfile: UserProfile = {
    email: 'test@example.com',
    name: 'Test User',
    picture: 'http://example.com/pic.jpg',
  };

  const mockOAuthResponse: OAuthResponse = {
    code: 'mock-auth-code',
    state: 'mock-state-value',
  };

  const mockTMITokenResponse: OAuthResponse = {
    access_token: mockJwtToken.token,
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    state: 'mock-state-value',
  };

  const mockProvidersResponse: ProvidersResponse = {
    providers: [
      {
        id: 'google',
        name: 'Google',
        icon: 'fa-brands fa-google',
        auth_url: 'http://localhost:8080/auth/authorize/google',
        redirect_uri: 'http://localhost:8080/auth/callback',
        client_id: 'mock-client-id'
      }
    ]
  };

  const mockAuthError: AuthError = {
    code: 'test_error',
    message: 'Test error message',
    retryable: true,
  };

  // Temporarily comment out beforeAll to rely on global setup
  /*
  beforeAll(() => {
    try {
      // Only initialize if not already initialized
      if (!TestBed.platform) {
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
          teardown: { destroyAfterEach: true },
        });
      }
    } catch (error) {
      // If already initialized, that's fine - just continue
      console.warn('TestBed already initialized:', error);
    }
  });
  */

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Create mocks for dependencies
    loggerService = {
      info: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      logInit: vi.fn(),
    };

    router = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    // Create a properly typed mock for HttpClient
    httpClient = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as HttpClient;

    // Create localStorage mock
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    // Create crypto mock
    const mockArray = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    cryptoMock = {
      getRandomValues: vi.fn().mockReturnValue(mockArray),
    };

    // Mock global objects for Node.js environment
    // Use Object.defineProperty for localStorage and crypto since they're read-only in browser environments
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global, 'crypto', {
      value: cryptoMock,
      configurable: true,
      writable: true,
    });

    // Ensure window.localStorage and window.crypto are also mocked if window exists
    if (global.window) {
      Object.defineProperty(global.window, 'localStorage', {
        value: localStorageMock,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global.window, 'crypto', {
        value: cryptoMock,
        configurable: true,
        writable: true,
      });
    }
    Object.defineProperty(global.window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    // Create mock for LocalOAuthProviderService
    localProvider = {
      buildAuthUrl: vi.fn().mockReturnValue('http://localhost:4200/local/auth?state=mock-state'),
      exchangeCodeForUser: vi.fn().mockReturnValue({
        email: 'test@example.com',
        name: 'Test User',
        picture: 'http://example.com/pic.jpg'
      })
    } as unknown as LocalOAuthProviderService;

    // Create the service directly with mocked dependencies
    service = new AuthService(
      router as unknown as Router,
      httpClient,
      loggerService as unknown as LoggerService,
      localProvider,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
      expect(loggerService.info).toHaveBeenCalledWith('Auth Service initialized');
    });

    it('should initialize with unauthenticated state', () => {
      localStorageMock.getItem.mockReturnValue(null);

      service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(service.username).toBe('');
      expect(service.userEmail).toBe('');
    });

    it('should restore authentication state from localStorage', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') {
          return JSON.stringify(mockJwtToken);
        }
        if (key === 'user_profile') {
          return JSON.stringify(mockUserProfile);
        }
        return null;
      });

      service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(true);
      expect(service.userProfile).toEqual(mockUserProfile);
      expect(service.username).toBe('Test User');
      expect(service.userEmail).toBe('test@example.com');
    });

    it('should clear authentication state if token is expired', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') {
          return JSON.stringify(mockExpiredToken);
        }
        return null;
      });

      service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error retrieving stored token',
        expect.any(Error),
      );
    });
  }); /* End of Service Initialization describe block */

  describe('OAuth Login', () => {
    it('should initiate OAuth login flow with default provider', () => {
      // Mock crypto to return predictable values
      const mockArray = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      cryptoMock.getRandomValues.mockReturnValue(mockArray);

      // Mock provider discovery
      vi.mocked(httpClient.get).mockReturnValue(of(mockProvidersResponse));

      service.initiateLogin();

      expect(cryptoMock.getRandomValues).toHaveBeenCalled();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('oauth_state', expect.any(String));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('oauth_provider', 'local');
      expect(localProvider.buildAuthUrl).toHaveBeenCalledWith(expect.any(String));
      expect(window.location.href).toBe('http://localhost:4200/local/auth?state=mock-state');
      expect(loggerService.info).toHaveBeenCalledWith('Initiating local provider login');
    });

    it('should handle missing provider configuration', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
      
      // Mock provider discovery to return empty providers
      vi.mocked(httpClient.get).mockReturnValue(of({ providers: [] }));

      service.initiateLogin('nonexistent-provider');

      expect(handleAuthErrorSpy).toHaveBeenCalledWith({
        code: 'provider_not_found',
        message: 'Provider nonexistent-provider is not configured',
        retryable: false,
      });
    });

    it('should handle errors during local auth initialization', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

      // Mock provider discovery to return empty providers (forces error)
      vi.mocked(httpClient.get).mockReturnValue(throwError(() => new Error('Network error')));

      // Make localProvider throw an error for when it gets to local provider
      localProvider.buildAuthUrl = vi.fn().mockImplementation(() => {
        throw new Error('Local provider error');
      });

      service.initiateLogin('local');

      expect(handleAuthErrorSpy).toHaveBeenCalledWith({
        code: 'provider_discovery_error',
        message: 'Failed to discover OAuth providers',
        retryable: true,
      });
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error discovering OAuth providers',
        expect.any(Error),
      );
    });

    it('should get available providers from TMI server', () => {
      // Mock HTTP response
      vi.mocked(httpClient.get).mockReturnValue(of(mockProvidersResponse));
      
      const result$ = service.getAvailableProviders();
      
      result$.subscribe(providers => {
        expect(providers).toEqual([
          ...mockProvidersResponse.providers,
          {
            id: 'local',
            name: 'Local Development',
            icon: 'fa-solid fa-laptop-code',
            auth_url: expect.stringContaining('http://localhost:4200/local/auth'),
            redirect_uri: expect.stringContaining('/auth/callback'),
            client_id: 'local-development'
          }
        ]);
      });
      
      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/auth/providers`);
    });

    it('should handle provider discovery errors gracefully', () => {
      // Mock HTTP error
      vi.mocked(httpClient.get).mockReturnValue(throwError(() => new Error('Network error')));
      
      const result$ = service.getAvailableProviders();
      
      result$.subscribe(providers => {
        expect(providers).toEqual([
          {
            id: 'local',
            name: 'Local Development',
            icon: 'fa-solid fa-laptop-code',
            auth_url: expect.stringContaining('http://localhost:4200/local/auth'),
            redirect_uri: expect.stringContaining('/auth/callback'),
            client_id: 'local-development'
          }
        ]);
      });
      
      expect(loggerService.error).toHaveBeenCalledWith('Failed to fetch OAuth providers', expect.any(Error));
    });

    it('should cache provider results', () => {
      // Mock HTTP response
      vi.mocked(httpClient.get).mockReturnValue(of(mockProvidersResponse));
      
      // First call
      service.getAvailableProviders().subscribe();
      // Second call should use cache
      service.getAvailableProviders().subscribe();
      
      // Should only call HTTP once due to caching
      expect(httpClient.get).toHaveBeenCalledTimes(1);
    });
  }); /* End of OAuth Login describe block */

  describe('OAuth Callback Handling', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'local';
        return null;
      });
    });

    it('should handle successful local authentication', () => {
      const result$ = service.handleOAuthCallback(mockOAuthResponse);

      result$.subscribe(result => {
        expect(result).toBe(true);
        expect(localProvider.exchangeCodeForUser).toHaveBeenCalledWith('mock-auth-code');
        expect(service.isAuthenticated).toBe(true);
        expect(service.userProfile).toEqual(
          expect.objectContaining({
            email: 'test@example.com',
            name: 'Test User',
          }),
        );
        expect(router.navigate).toHaveBeenCalledWith(['/tm']);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', expect.any(String));
        expect(localStorageMock.setItem).toHaveBeenCalledWith('user_profile', expect.any(String));
      });
    });

    it('should handle successful TMI OAuth proxy token response', () => {
      // Mock for external provider
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      const result$ = service.handleOAuthCallback(mockTMITokenResponse);

      result$.subscribe(result => {
        expect(result).toBe(true);
        expect(service.isAuthenticated).toBe(true);
        expect(service.userProfile).toEqual(
          expect.objectContaining({
            email: 'test@example.com',
            name: 'Test User',
          }),
        );
        expect(router.navigate).toHaveBeenCalledWith(['/tm']);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', expect.any(String));
        expect(localStorageMock.setItem).toHaveBeenCalledWith('user_profile', expect.any(String));
      });
    });

    it('should handle OAuth errors from TMI callback', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
      
      const errorResponse: OAuthResponse = {
        error: 'access_denied',
        error_description: 'User cancelled authorization'
      };

      const result$ = service.handleOAuthCallback(errorResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'access_denied',
          message: 'User cancelled authorization',
          retryable: false
        });
      });
    });

    it('should handle unexpected callback format', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
      
      // Mock receiving code instead of tokens (old-style callback)
      const oldStyleResponse: OAuthResponse = {
        code: 'auth-code',
        state: 'mock-state-value'
      };
      
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google'; // Not local
        return null;
      });

      const result$ = service.handleOAuthCallback(oldStyleResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'unexpected_callback_format',
          message: 'Received authorization code instead of access token from TMI server',
          retryable: true
        });
      });
    });

    it('should handle failed authentication due to invalid state', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'different-state-value';
        if (key === 'oauth_provider') return 'local';
        return null;
      });
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

      const result$ = service.handleOAuthCallback(mockOAuthResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'invalid_state',
          message: 'Invalid state parameter, possible CSRF attack',
          retryable: false,
        });
      });
    });

    it('should handle failed local authentication', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
      
      // Make local provider return null (failed authentication)
      localProvider.exchangeCodeForUser = vi.fn().mockReturnValue(null);

      const result$ = service.handleOAuthCallback(mockOAuthResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'local_auth_error',
          message: 'Failed to authenticate with local provider',
          retryable: true,
        });
      });
    });

    it('should handle invalid callback with no valid data', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
      
      const invalidResponse: OAuthResponse = {};

      const result$ = service.handleOAuthCallback(invalidResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'invalid_callback',
          message: 'No valid authentication data received in callback',
          retryable: true
        });
      });
    });
  }); /* End of OAuth Callback Handling describe block */

  describe('Token Management', () => {
    it('should store and retrieve tokens correctly using demoLogin', () => {
      const testEmail = 'demo.user@example.com';

      service.demoLogin(testEmail);

      expect(service.isAuthenticated).toBe(true);
      expect(service.userEmail).toBe(testEmail);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', expect.any(String));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user_profile', expect.any(String));
    });

    it('should return null if no token is stored', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const token = service.getStoredToken();

      expect(token).toBeNull();
    });

    it('should handle authentication errors gracefully', () => {
      const errors: (AuthError | null)[] = [];
      service.authError$.subscribe(error => errors.push(error));

      service.handleAuthError(mockAuthError);

      expect(errors[1]).toEqual(mockAuthError);
      expect(loggerService.error).toHaveBeenCalledWith(
        `Auth error: ${mockAuthError.code} - ${mockAuthError.message}`,
      );
    });

    it('should detect token expiration', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockExpiredToken));

      const isValid = service['isTokenValid']();

      expect(isValid).toBe(false);
    });

    it('should not detect token expiration for a valid token', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockJwtToken));

      const isValid = service['isTokenValid']();

      expect(isValid).toBe(true);
    });

    it('should logout and clear local storage', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock stored token for logout request
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/logout`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockJwtToken.token}`
        }
      });
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_profile');
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  }); /* End of Token Management describe block */

  describe('Authentication State Management', () => {
    it('should emit authentication state changes', () => {
      const authStates: boolean[] = [];
      service.isAuthenticated$.subscribe(state => authStates.push(state));

      // Initially should be false
      expect(authStates[0]).toBe(false);

      // Simulate successful login
      service['isAuthenticatedSubject'].next(true);
      expect(authStates[1]).toBe(true);

      // Simulate logout
      service['isAuthenticatedSubject'].next(false);
      expect(authStates[2]).toBe(false);
    });

    it('should emit user profile changes', () => {
      const profiles: (UserProfile | null)[] = [];
      service.userProfile$.subscribe(profile => profiles.push(profile));

      // Initially should be null
      expect(profiles[0]).toBeNull();

      // Simulate login
      service['userProfileSubject'].next(mockUserProfile);
      expect(profiles[1]).toEqual(mockUserProfile);

      // Simulate logout
      service['userProfileSubject'].next(null);
      expect(profiles[2]).toBeNull();
    });

    it('should emit username changes', () => {
      const usernames: string[] = [];
      service.username$.subscribe(username => usernames.push(username));

      // Initially should be empty
      expect(usernames[0]).toBe('');

      // Simulate login
      service['userProfileSubject'].next(mockUserProfile);
      expect(usernames[1]).toBe('Test User');

      // Simulate logout
      service['userProfileSubject'].next(null);
      expect(usernames[2]).toBe('');
    });
  }); /* End of Authentication State Management describe block */

  describe('Role-based Authorization', () => {
    it('should return true for any role when authenticated', () => {
      service['isAuthenticatedSubject'].next(true);

      expect(service.hasRole(UserRole.Owner)).toBe(true);
      expect(service.hasRole(UserRole.Writer)).toBe(true);
      expect(service.hasRole(UserRole.Reader)).toBe(true);
    });

    it('should return false for any role when not authenticated', () => {
      service['isAuthenticatedSubject'].next(false);

      expect(service.hasRole(UserRole.Owner)).toBe(false);
      expect(service.hasRole(UserRole.Writer)).toBe(false);
      expect(service.hasRole(UserRole.Reader)).toBe(false);
    });
  }); /* End of Role-based Authorization describe block */

  describe('Enhanced Logout Functionality', () => {
    it('should include Authorization header when token is available', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock stored token for logout request
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/logout`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockJwtToken.token}`
        }
      });
    });

    it('should exclude Authorization header when no token is available', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock no stored token
      localStorageMock.getItem.mockReturnValue(null);

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/logout`, {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle malformed token gracefully', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock malformed token
      localStorageMock.getItem.mockReturnValue('invalid-json');

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/logout`, {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should skip server logout for test users', () => {
      const testUserProfile = { ...mockUserProfile, email: 'user1@example.com' };
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(testUserProfile);

      service.logout();

      expect(httpClient.post).not.toHaveBeenCalled();
      expect(loggerService.debugComponent).toHaveBeenCalledWith('Auth', 'Skipping server logout for test user');
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle server unavailable during logout', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

      // Mock network error (server unavailable)
      const networkError = new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
        name: 'HttpErrorResponse'
      });

      vi.mocked(httpClient.post).mockReturnValue(throwError(() => networkError));

      service.logout();

      expect(loggerService.warn).toHaveBeenCalledWith('Server unavailable during logout - proceeding with client-side logout');
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle server errors during logout gracefully', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

      // Mock server error
      const serverError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        error: 'Server Error'
      });

      vi.mocked(httpClient.post).mockReturnValue(throwError(() => serverError));

      service.logout();

      // Should eventually clear auth data and navigate regardless of server error
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle successful server logout', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

      vi.mocked(httpClient.post).mockReturnValue(of({ success: true }));

      service.logout();

      expect(loggerService.debug).toHaveBeenCalledWith('Server logout request completed');
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_profile');
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle logout when not authenticated', () => {
      service['isAuthenticatedSubject'].next(false);

      service.logout();

      expect(httpClient.post).not.toHaveBeenCalled();
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle different test user email patterns', () => {
      const testUsers = [
        'user1@example.com',
        'user2@example.com', 
        'user3@example.com',
        'demo.user@example.com'
      ];

      testUsers.forEach(email => {
        const testUserProfile = { ...mockUserProfile, email };
        service['isAuthenticatedSubject'].next(true);
        service['userProfileSubject'].next(testUserProfile);

        service.logout();

        expect(httpClient.post).not.toHaveBeenCalled();
        expect(service.isAuthenticated).toBe(false);
        
        // Reset for next iteration
        vi.clearAllMocks();
      });
    });

    it('should not skip server logout for regular users', () => {
      const regularUserProfile = { ...mockUserProfile, email: 'regular.user@company.com' };
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(regularUserProfile);

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalled();
      expect(loggerService.debugComponent).not.toHaveBeenCalledWith('Auth', 'Skipping server logout for test user');
    });
  }); /* End of Enhanced Logout Functionality describe block */

  describe('Token Refresh Functionality', () => {
    describe('refreshToken()', () => {
      it('should successfully refresh token with valid refresh token', () => {
        const currentToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'valid-refresh-token'
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(currentToken));
        
        const refreshResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        };
        
        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));
        
        const result$ = service.refreshToken();
        
        result$.subscribe(newToken => {
          expect(newToken.token).toBe('new-access-token');
          expect(newToken.refreshToken).toBe('new-refresh-token');
          expect(newToken.expiresIn).toBe(3600);
          expect(newToken.expiresAt).toBeInstanceOf(Date);
          expect(newToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
        
        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/refresh`, {
          refresh_token: 'valid-refresh-token'
        });
      });

      it('should handle refresh token failure and clear auth data', () => {
        const currentToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'expired-refresh-token'
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(currentToken));
        
        const error = new HttpErrorResponse({
          status: 401,
          statusText: 'Unauthorized',
          error: 'Invalid refresh token'
        });
        
        vi.mocked(httpClient.post).mockReturnValue(throwError(() => error));
        
        const result$ = service.refreshToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('Token refresh failed - please login again');
            expect(service.isAuthenticated).toBe(false);
            expect(service.userProfile).toBeNull();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_profile');
          }
        });
      });

      it('should return error when no refresh token is available', () => {
        const tokenWithoutRefresh: JwtToken = {
          ...mockJwtToken,
          refreshToken: undefined
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(tokenWithoutRefresh));
        
        const result$ = service.refreshToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('No refresh token available');
            expect(httpClient.post).not.toHaveBeenCalled();
          }
        });
      });

      it('should return error when no token is stored', () => {
        localStorageMock.getItem.mockReturnValue(null);
        
        const result$ = service.refreshToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('No refresh token available');
            expect(httpClient.post).not.toHaveBeenCalled();
          }
        });
      });

      it('should handle network errors during refresh', () => {
        const currentToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'valid-refresh-token'
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(currentToken));
        
        const networkError = new HttpErrorResponse({
          status: 0,
          statusText: 'Unknown Error',
          error: new ProgressEvent('Network error')
        });
        
        vi.mocked(httpClient.post).mockReturnValue(throwError(() => networkError));
        
        const result$ = service.refreshToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('Token refresh failed - please login again');
            expect(loggerService.error).toHaveBeenCalledWith('Token refresh failed', networkError);
          }
        });
      });
    });

    describe('shouldRefreshToken()', () => {
      it('should return true when token expires within 1 minute', () => {
        const soonToExpireToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 30000) // 30 seconds from now
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(soonToExpireToken));
        
        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(true);
      });

      it('should return false when token has plenty of time left', () => {
        const validToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 1800000) // 30 minutes from now
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(validToken));
        
        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(false);
      });

      it('should return false when no refresh token is available', () => {
        const tokenWithoutRefresh: JwtToken = {
          ...mockJwtToken,
          refreshToken: undefined,
          expiresAt: new Date(Date.now() + 30000)
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(tokenWithoutRefresh));
        
        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(false);
      });

      it('should return false when no token is stored', () => {
        localStorageMock.getItem.mockReturnValue(null);
        
        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(false);
      });

      it('should handle exact boundary conditions', () => {
        // Test exactly 1 minute from now
        const exactBoundaryToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 60000) // exactly 1 minute
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(exactBoundaryToken));
        
        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(true);
      });

      it('should handle already expired tokens', () => {
        const expiredToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() - 1000) // 1 second ago
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredToken));
        
        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(true);
      });
    });

    describe('getValidToken()', () => {
      it('should return existing token when valid and no refresh needed', () => {
        const validToken: JwtToken = {
          ...mockJwtToken,
          expiresAt: new Date(Date.now() + 1800000) // 30 minutes from now
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(validToken));
        
        const result$ = service.getValidToken();
        
        result$.subscribe(token => {
          expect(token).toEqual(validToken);
          expect(httpClient.post).not.toHaveBeenCalled();
        });
      });

      it('should automatically refresh token when needed and return new token', () => {
        const soonToExpireToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 30000) // 30 seconds from now
        };
        
        const refreshResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(soonToExpireToken));
        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));
        
        const storeTokenSpy = vi.spyOn(service as any, 'storeToken');
        
        const result$ = service.getValidToken();
        
        result$.subscribe(token => {
          expect(token.token).toBe('new-access-token');
          expect(token.refreshToken).toBe('new-refresh-token');
          expect(storeTokenSpy).toHaveBeenCalledWith(token);
        });
        
        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/refresh`, {
          refresh_token: 'refresh-token'
        });
      });

      it('should return error when no token is available', () => {
        localStorageMock.getItem.mockReturnValue(null);
        
        const result$ = service.getValidToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('No token available');
          }
        });
      });

      it('should return error when token is expired and no refresh token available', () => {
        const expiredTokenWithoutRefresh: JwtToken = {
          ...mockJwtToken,
          refreshToken: undefined,
          expiresAt: new Date(Date.now() - 1000)
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredTokenWithoutRefresh));
        
        const result$ = service.getValidToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('Token expired and no refresh token available');
            expect(service.isAuthenticated).toBe(false);
            expect(service.userProfile).toBeNull();
          }
        });
      });

      it('should handle refresh failure and clear auth data', () => {
        const soonToExpireToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'invalid-refresh-token',
          expiresAt: new Date(Date.now() + 30000)
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(soonToExpireToken));
        
        const refreshError = new HttpErrorResponse({
          status: 401,
          statusText: 'Unauthorized',
          error: 'Invalid refresh token'
        });
        
        vi.mocked(httpClient.post).mockReturnValue(throwError(() => refreshError));
        
        const result$ = service.getValidToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('Token refresh failed - please login again');
            expect(service.isAuthenticated).toBe(false);
          }
        });
      });

      it('should handle malformed stored token', () => {
        localStorageMock.getItem.mockReturnValue('invalid-json');
        
        const result$ = service.getValidToken();
        
        result$.subscribe({
          next: () => {},
          error: (err) => {
            expect(err.message).toBe('No token available');
          }
        });
      });
    });

    describe('Token Lifecycle Integration', () => {
      it('should handle complete token refresh cycle', () => {
        // Start with a token that needs refresh
        const expiringSoonToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token-123',
          expiresAt: new Date(Date.now() + 30000)
        };
        
        const refreshResponse = {
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiringSoonToken));
        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));
        
        // First call should trigger refresh
        const result1$ = service.getValidToken();
        
        result1$.subscribe(token => {
          expect(token.token).toBe('refreshed-access-token');
          expect(token.refreshToken).toBe('new-refresh-token');
        });
        
        // Update mock to return the new token
        const newToken: JwtToken = {
          token: 'refreshed-access-token', 
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000)
        };
        
        localStorageMock.getItem.mockReturnValue(JSON.stringify(newToken));
        
        // Second call should not trigger refresh
        const result2$ = service.getValidToken();
        
        result2$.subscribe(token => {
          expect(token.token).toBe('refreshed-access-token');
        });
        
        // Should only have called refresh once
        expect(httpClient.post).toHaveBeenCalledTimes(1);
      });
    });
  }); /* End of Token Refresh Functionality describe block */
});
