// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { LocalOAuthProviderService } from './local-oauth-provider.service';
import { JwtToken, UserProfile, OAuthResponse, AuthError, UserRole } from '../models/auth.models';
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
      google: {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:4200/auth/callback',
      },
    },
  },
}));

import { environment } from '../../../environments/environment';

// Mock interfaces for type safety
interface MockLoggerService {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
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

      service.initiateLogin('nonexistent-provider');

      expect(handleAuthErrorSpy).toHaveBeenCalledWith({
        code: 'provider_not_found',
        message: 'Provider nonexistent-provider is not configured',
        retryable: false,
      });
    });

    it('should handle errors during local auth initialization', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

      // Make localProvider throw an error
      localProvider.buildAuthUrl = vi.fn().mockImplementation(() => {
        throw new Error('Local provider error');
      });

      service.initiateLogin('local');

      expect(handleAuthErrorSpy).toHaveBeenCalledWith({
        code: 'local_auth_error',
        message: 'Failed to initialize local authentication',
        retryable: true,
      });
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error initializing local authentication',
        expect.any(Error),
      );
    });

    it('should get available providers', () => {
      const providers = service.getAvailableProviders();
      
      expect(providers).toEqual([
        {
          id: 'local',
          name: 'Local Development',
          icon: 'fa-solid fa-laptop-code'
        }
      ]);
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

    it('should handle successful external provider authentication', () => {
      // Mock for external provider
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      const tokenResponse = { token: mockJwtToken.token, expires_in: 3600 };
      vi.mocked(httpClient.post).mockReturnValue(of(tokenResponse));

      const result$ = service.handleOAuthCallback(mockOAuthResponse);

      result$.subscribe(result => {
        expect(result).toBe(true);
        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/token`, {
          code: 'mock-auth-code',
          provider: 'google',
          redirect_uri: `${window.location.origin}/auth/callback`,
        });
        expect(service.isAuthenticated).toBe(true);
        expect(router.navigate).toHaveBeenCalledWith(['/tm']);
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

    it('should handle failed authentication due to token exchange error', () => {
      // Mock for external provider
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

      // Mock the HTTP post method to throw an error
      vi.mocked(httpClient.post).mockReturnValue(throwError(() => new Error('Network error')));

      const result$ = service.handleOAuthCallback(mockOAuthResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'token_exchange_error',
          message: 'Failed to exchange authorization code for token',
          retryable: true,
        });
        expect(loggerService.error).toHaveBeenCalledWith(
          'Error exchanging code for token',
          expect.any(Error),
        );
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

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/auth/logout`, {});
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
});
