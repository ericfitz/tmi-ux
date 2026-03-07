// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
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
import {
  ServerConnectionService,
  ServerConnectionStatus,
} from '../../core/services/server-connection.service';
import {
  AuthSession,
  JwtToken,
  UserProfile,
  OAuthResponse,
  AuthError,
  UserMeResponse,
  ProvidersResponse,
} from '../models/auth.models';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  createTypedMockHttpClient,
  type MockLoggerService,
  type MockRouter,
  type MockHttpClient,
} from '../../../testing/mocks';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    logLevel: 'DEBUG',
    apiUrl: 'http://localhost:8080',
    authTokenExpiryMinutes: 60,
    operatorName: 'TMI Operator (Test)',
    operatorContact: 'test@example.com',
    defaultAuthProvider: 'tmi', // Set to tmi provider for server-mode tests
  },
}));

import { environment } from '../../../environments/environment';

// Mock interfaces for type safety

interface MockStorage {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

interface MockCrypto {
  getRandomValues: ReturnType<typeof vi.fn>;
}

// Mock interfaces for ServerConnectionService
interface MockServerConnectionService {
  currentStatus: ServerConnectionStatus;
  connectionStatus$: {
    subscribe: ReturnType<typeof vi.fn>;
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpClient: MockHttpClient;
  let loggerService: MockLoggerService;
  let router: MockRouter;
  let serverConnectionService: MockServerConnectionService;
  let localStorageMock: MockStorage;
  let sessionStorageMock: MockStorage;
  let cryptoMock: MockCrypto;
  let mockPkceService: any;

  // Store original globals for restoration after tests
  const originalCrypto = global.crypto;
  const originalLocalStorage = global.localStorage;
  const originalSessionStorage = global.sessionStorage;
  const originalWindowLocation = global.window?.location;

  // Test data
  const mockJwtToken: JwtToken = {
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };

  const mockExpiredToken: JwtToken = {
    expiresIn: 3600,
    expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
  };

  const mockUserProfile: UserProfile = {
    provider: 'tmi',
    provider_id: 'test@example.com',
    display_name: 'Test User',
    email: 'test@example.com',
    groups: null,
    jwt_groups: null,
  };

  const mockUserMeResponse: UserMeResponse = {
    provider: 'tmi',
    provider_id: 'test@example.com',
    name: 'Test User',
    email: 'test@example.com',
    is_admin: false,
    groups: null,
  };

  const _mockOAuthResponse: OAuthResponse = {
    code: 'mock-auth-code',
    state: 'mock-state-value',
  };

  const mockTMITokenResponse: OAuthResponse = {
    access_token: 'some-opaque-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    state: 'mock-state-value',
  };

  const mockProvidersResponse: ProvidersResponse = {
    providers: [
      {
        id: 'tmi',
        name: 'TMI Provider',
        icon: 'science',
        auth_url: 'http://localhost:8080/oauth2/authorize/tmi',
        redirect_uri: 'http://localhost:8080/oauth2/callback',
        client_id: 'mock-client-id',
      },
    ],
  };

  const mockAuthError: AuthError = {
    code: 'test_error',
    message: 'Test error message',
    retryable: true,
  };

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Create mocks for dependencies
    loggerService = createTypedMockLoggerService();
    router = createTypedMockRouter();
    httpClient = createTypedMockHttpClient([]);

    // Create localStorage mock
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    // Create sessionStorage mock
    sessionStorageMock = {
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
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global, 'crypto', {
      value: cryptoMock,
      configurable: true,
      writable: true,
    });

    // Ensure window.localStorage, sessionStorage and window.crypto are also mocked if window exists
    if (global.window) {
      Object.defineProperty(global.window, 'localStorage', {
        value: localStorageMock,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global.window, 'sessionStorage', {
        value: sessionStorageMock,
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
      value: { href: '', origin: 'undefined' },
      writable: true,
      configurable: true,
    });

    // Create mock for ServerConnectionService
    serverConnectionService = {
      currentStatus: ServerConnectionStatus.CONNECTED,
      connectionStatus$: {
        subscribe: vi.fn(),
      },
    };

    // Create mock PKCE service
    mockPkceService = {
      generatePkceParameters: vi.fn().mockResolvedValue({
        codeVerifier: 'test-verifier-' + 'A'.repeat(30),
        codeChallenge: 'test-challenge-' + 'B'.repeat(29),
        codeChallengeMethod: 'S256',
        generatedAt: Date.now(),
      }),
      retrieveVerifier: vi.fn().mockReturnValue('test-verifier-' + 'A'.repeat(30)),
      clearVerifier: vi.fn(),
      hasStoredVerifier: vi.fn().mockReturnValue(false),
    };

    // Default httpClient.get to return 401 so the constructor's checkAuthStatus()
    // treats the user as unauthenticated. Individual tests override this as needed.
    vi.mocked(httpClient.get).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );

    // Create the service directly with mocked dependencies (5 params, no CryptoKeyStorageService)
    service = new AuthService(
      router as unknown as Router,
      httpClient as unknown as HttpClient,
      loggerService as unknown as LoggerService,
      serverConnectionService as unknown as ServerConnectionService,
      mockPkceService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();

    // Restore original globals to prevent test pollution
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global, 'sessionStorage', {
      value: originalSessionStorage,
      configurable: true,
      writable: true,
    });
    if (global.window) {
      Object.defineProperty(global.window, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global.window, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global.window, 'sessionStorage', {
        value: originalSessionStorage,
        configurable: true,
        writable: true,
      });
      if (originalWindowLocation) {
        Object.defineProperty(global.window, 'location', {
          value: originalWindowLocation,
          writable: true,
          configurable: true,
        });
      }
    }
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with unauthenticated state', async () => {
      // Mock GET /me to return null (not authenticated)
      vi.mocked(httpClient.get).mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 })),
      );

      await service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(service.username).toBe('');
      expect(service.userEmail).toBe('');
    });

    it('should restore authentication state from GET /me', async () => {
      // Mock GET /me to return user info
      vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

      await service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(true);
      expect(service.userProfile).toMatchObject({
        provider: 'tmi',
        provider_id: 'test@example.com',
        display_name: 'Test User',
        email: 'test@example.com',
      });
      expect(service.username).toBe('Test User');
      expect(service.userEmail).toBe('test@example.com');
    });

    it('should clear authentication state if GET /me fails', async () => {
      // Mock GET /me failure
      vi.mocked(httpClient.get).mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 })),
      );

      await service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      // Make checkAuthStatus throw by causing an unexpected error
      // First, clear any existing session so it tries GET /me
      service['sessionSubject'].next(null);
      service['isAuthenticatedSubject'].next(false);

      // Mock GET /me to reject (simulating network error)
      vi.mocked(httpClient.get).mockReturnValue(throwError(() => new Error('Network error')));

      await service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
    });
  }); /* End of Service Initialization describe block */

  describe('OAuth Login', () => {
    it('should initiate OAuth login flow with default provider', async () => {
      // Mock crypto to return predictable values
      const mockArray = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      cryptoMock.getRandomValues.mockReturnValue(mockArray);

      // Mock provider discovery
      vi.mocked(httpClient.get).mockReturnValue(of(mockProvidersResponse));

      service.initiateLogin();

      // Wait for async PKCE generation
      await vi.waitFor(() => {
        expect(mockPkceService.generatePkceParameters).toHaveBeenCalled();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('oauth_state', expect.any(String));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('oauth_provider', 'tmi');
      expect(window.location.href).toContain('http://localhost:8080/oauth2/authorize/tmi');
      expect(window.location.href).toContain('state=');
      expect(window.location.href).toContain('client_callback=');
      expect(window.location.href).toContain('scope=openid%20profile%20email');
      expect(window.location.href).toContain('code_challenge=');
      expect(window.location.href).toContain('code_challenge_method=S256');
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

    it('should get available providers from TMI server', () => {
      // Mock HTTP response
      vi.mocked(httpClient.get).mockReturnValue(of(mockProvidersResponse));

      const result$ = service.getAvailableProviders();

      result$.subscribe(providers => {
        // When server is connected, should only return server providers (no local)
        expect(providers).toEqual(mockProvidersResponse.providers);
      });

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/oauth2/providers`);
    });

    it('should handle provider discovery errors gracefully', () => {
      // Mock HTTP error
      vi.mocked(httpClient.get).mockReturnValue(throwError(() => new Error('Network error')));

      const result$ = service.getAvailableProviders();

      result$.subscribe({
        next: () => {
          // Should not reach here - error should be thrown
          expect(true).toBe(false);
        },
        error: error => {
          expect(error).toBeInstanceOf(Error);
          expect(loggerService.error).toHaveBeenCalledWith(
            'Failed to fetch OAuth providers',
            expect.any(Error),
          );
        },
      });
    });

    it('should cache provider results', () => {
      // Mock HTTP response
      vi.mocked(httpClient.get).mockReturnValue(of(mockProvidersResponse));

      // First call - this also triggers the constructor's checkAuthStatus GET /me
      service.getAvailableProviders().subscribe();
      // Second call should use cache
      service.getAvailableProviders().subscribe();

      // httpClient.get is called once for getAvailableProviders (second call uses cache)
      // plus once for checkAuthStatus in the constructor (GET /me)
      // So we check that getAvailableProviders only called the providers URL once
      const providerCalls = vi
        .mocked(httpClient.get)
        .mock.calls.filter(call => call[0] === `${environment.apiUrl}/oauth2/providers`);
      expect(providerCalls.length).toBe(1);
    });
  }); /* End of OAuth Login describe block */

  describe('OAuth Callback Handling', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });
    });

    it('should handle successful TMI OAuth proxy token response', async () => {
      // Mock for external provider
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      // Mock GET /me call that happens after successful token response
      vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

      const result$ = service.handleOAuthCallback(mockTMITokenResponse);

      const result = await result$.toPromise();

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(result).toBe(true);
      expect(service.isAuthenticated).toBe(true);
      expect(service.userProfile).toMatchObject({
        provider: expect.any(String),
        provider_id: expect.any(String),
        display_name: 'Test User',
        email: 'test@example.com',
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
    });

    it('should handle OAuth errors from TMI callback', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

      const errorResponse: OAuthResponse = {
        error: 'access_denied',
        error_description: 'User cancelled authorization',
      };

      const result$ = service.handleOAuthCallback(errorResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'access_denied',
          message: 'User cancelled authorization',
          retryable: false,
        });
      });
    });

    it('should handle authorization code exchange failure', () => {
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

      // Mock receiving code that needs to be exchanged
      const codeResponse: OAuthResponse = {
        code: 'auth-code',
        state: 'mock-state-value',
      };

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      // Mock HTTP request failure for token exchange
      const exchangeError = new Error('Token exchange failed');
      httpClient.post.mockReturnValue(throwError(() => exchangeError));

      const result$ = service.handleOAuthCallback(codeResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'code_exchange_failed',
          message: 'Failed to exchange authorization code: Token exchange failed',
          retryable: true,
        });
      });
    });

    it('should handle successful authorization code exchange', () => {
      // Mock receiving code that needs to be exchanged
      const codeResponse: OAuthResponse = {
        code: 'auth-code',
        state: 'mock-state-value',
      };

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'mock-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      // Mock successful token exchange
      const tokenResponse = {
        expires_in: 3600,
        token_type: 'Bearer',
      };
      httpClient.post.mockReturnValue(of(tokenResponse));

      // Mock GET /me call that happens after successful token exchange
      const johnUserMeResponse: UserMeResponse = {
        provider: 'tmi',
        provider_id: '1234567890',
        name: 'John Doe',
        email: 'john@example.com',
        is_admin: false,
        groups: null,
      };
      vi.mocked(httpClient.get).mockReturnValue(of(johnUserMeResponse));

      const result$ = service.handleOAuthCallback(codeResponse);

      result$.subscribe(result => {
        expect(result).toBe(true);
        expect(service.isAuthenticated).toBe(true);
        expect(service.userProfile?.email).toBe('john@example.com');
        expect(router.navigateByUrl).not.toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/intake']);
      });
    });

    it('should handle failed authentication due to invalid state for authorization code flow', () => {
      // Mock authorization code response (no access_token)
      const codeResponse: OAuthResponse = {
        code: 'test-code',
        state: 'different-state-value',
      };

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'original-state-value';
        if (key === 'oauth_provider') return 'google';
        return null;
      });
      const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

      const result$ = service.handleOAuthCallback(codeResponse);

      result$.subscribe(result => {
        expect(result).toBe(false);
        expect(handleAuthErrorSpy).toHaveBeenCalledWith({
          code: 'invalid_state',
          message: 'Invalid state parameter, possible CSRF attack',
          retryable: false,
        });
      });
    });

    it('should handle Base64 encoded state parameter from TMI server', async () => {
      const stateData = { csrf: 'test-csrf-12345', returnUrl: '/dashboard' };
      const encodedState = btoa(JSON.stringify(stateData));

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return encodedState;
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      const responseWithBase64State: OAuthResponse = {
        access_token: 'some-opaque-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        state: encodedState, // Matching state from server
      };

      router.navigate = vi.fn().mockResolvedValue(true);

      // Mock GET /me call that happens after successful token response
      vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

      const result$ = service.handleOAuthCallback(responseWithBase64State);

      const result = await result$.toPromise();

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(result).toBe(true);
      expect(service.isAuthenticated).toBe(true);
      expect(service.userProfile).toMatchObject({
        provider: expect.any(String),
        provider_id: expect.any(String),
        display_name: 'Test User',
        email: 'test@example.com',
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
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
          retryable: true,
        });
      });
    });
  }); /* End of OAuth Callback Handling describe block */

  describe('Token Management', () => {
    it('should store and retrieve session info correctly', () => {
      // Manually set up authenticated state
      const testEmail = 'demo.user@example.com';
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      const session: AuthSession = {
        expiresIn: 3600,
        expiresAt,
      };

      const userProfile: UserProfile = {
        provider: 'tmi',
        provider_id: testEmail,
        display_name: 'Demo User',
        email: testEmail,
        groups: null,
        jwt_groups: null,
      };

      service.storeSessionInfo(session);
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(userProfile);

      expect(service.isAuthenticated).toBe(true);
      expect(service.userEmail).toBe(testEmail);
      expect(service.getSessionInfo()).toEqual(session);
    });

    it('should return null if no session is stored', () => {
      const session = service.getStoredToken();

      expect(session).toBeNull();
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

    it('should detect session expiration', () => {
      // Set the expired session in the service
      service['sessionSubject'].next(mockExpiredToken);

      const isValid = service.isSessionValid();

      expect(isValid).toBe(false);
    });

    it('should not detect session expiration for a valid session', () => {
      // Set the session in the service
      service['sessionSubject'].next(mockJwtToken);

      const isValid = service.isSessionValid();

      expect(isValid).toBe(true);
    });

    it('should logout and clear state', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Set the session in the service
      service['sessionSubject'].next(mockJwtToken);

      // Mock the HTTP post method for logout (cookies sent automatically)
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${environment.apiUrl}/me/logout`,
        null,
        expect.objectContaining({
          context: expect.anything(),
        }),
      );
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  }); /* End of Token Management describe block */

  describe('Authentication State Management', () => {
    it('should emit authentication state changes', () => {
      const authStates: boolean[] = [];
      service.isAuthenticated$.subscribe(state => authStates.push(state));

      // The constructor calls checkAuthStatus which calls GET /me.
      // Since httpClient.get returns undefined by default, it will eventually
      // resolve. We need to check the initial state from the BehaviorSubject.
      // The first emission comes from the BehaviorSubject's initial value (false)
      // or from the constructor's checkAuthStatus.

      // Simulate successful login
      service['isAuthenticatedSubject'].next(true);

      // Simulate logout
      service['isAuthenticatedSubject'].next(false);

      // Check that we got false -> true -> false
      // There may be extra emissions from the constructor, so check the last 3
      const lastThree = authStates.slice(-3);
      expect(lastThree).toContain(false);
      expect(lastThree).toContain(true);
    });

    it('should emit user profile changes', () => {
      const profiles: (UserProfile | null)[] = [];
      service.userProfile$.subscribe(profile => profiles.push(profile));

      // Initially should be null
      expect(profiles[0]).toBeNull();

      // Simulate login
      service['userProfileSubject'].next(mockUserProfile);
      expect(profiles[profiles.length - 1]).toEqual(mockUserProfile);

      // Simulate logout
      service['userProfileSubject'].next(null);
      expect(profiles[profiles.length - 1]).toBeNull();
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

  describe('Security Reviewer and Landing Page', () => {
    it('should return true for isSecurityReviewer when profile has is_security_reviewer', () => {
      const reviewerProfile: UserProfile = {
        provider: 'google',
        provider_id: '123',
        display_name: 'Reviewer',
        email: 'reviewer@example.com',
        groups: null,
        jwt_groups: null,
        is_security_reviewer: true,
      };
      service['userProfileSubject'].next(reviewerProfile);

      expect(service.isSecurityReviewer).toBe(true);
    });

    it('should return false for isSecurityReviewer when not a reviewer', () => {
      const regularProfile: UserProfile = {
        provider: 'google',
        provider_id: '456',
        display_name: 'Regular',
        email: 'regular@example.com',
        groups: null,
        jwt_groups: null,
        is_security_reviewer: false,
      };
      service['userProfileSubject'].next(regularProfile);

      expect(service.isSecurityReviewer).toBe(false);
    });

    it('should return /dashboard for security reviewers via getLandingPage', () => {
      const reviewerProfile: UserProfile = {
        provider: 'google',
        provider_id: '123',
        display_name: 'Reviewer',
        email: 'reviewer@example.com',
        groups: null,
        jwt_groups: null,
        is_security_reviewer: true,
      };
      service['userProfileSubject'].next(reviewerProfile);

      expect(service.getLandingPage()).toBe('/dashboard');
    });

    it('should return /admin for administrators who are not reviewers', () => {
      const adminProfile: UserProfile = {
        provider: 'google',
        provider_id: '456',
        display_name: 'Admin',
        email: 'admin@example.com',
        groups: null,
        jwt_groups: null,
        is_admin: true,
        is_security_reviewer: false,
      };
      service['userProfileSubject'].next(adminProfile);

      expect(service.getLandingPage()).toBe('/admin');
    });

    it('should return /intake for users with no special roles', () => {
      const regularProfile: UserProfile = {
        provider: 'google',
        provider_id: '789',
        display_name: 'Regular',
        email: 'regular@example.com',
        groups: null,
        jwt_groups: null,
      };
      service['userProfileSubject'].next(regularProfile);

      expect(service.getLandingPage()).toBe('/intake');
    });

    it('should prioritize security_reviewer over administrator for landing page', () => {
      const dualRoleProfile: UserProfile = {
        provider: 'google',
        provider_id: '101',
        display_name: 'Both',
        email: 'both@example.com',
        groups: null,
        jwt_groups: null,
        is_admin: true,
        is_security_reviewer: true,
      };
      service['userProfileSubject'].next(dualRoleProfile);

      expect(service.getLandingPage()).toBe('/dashboard');
    });
  }); /* End of Security Reviewer and Landing Page describe block */

  describe('Enhanced Logout Functionality', () => {
    it('should send logout request with context (cookies sent automatically)', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Set session in memory
      service['sessionSubject'].next(mockJwtToken);

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${environment.apiUrl}/me/logout`,
        null,
        expect.objectContaining({
          context: expect.anything(),
        }),
      );
    });

    it('should send logout without Authorization header', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      // Verify the call does NOT include headers with Authorization
      const callArgs = vi.mocked(httpClient.post).mock.calls[0];
      const options = callArgs[2];
      expect(options?.headers).toBeUndefined();
    });

    it('should handle logout gracefully even without session', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // No session set

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${environment.apiUrl}/me/logout`,
        null,
        expect.objectContaining({
          context: expect.anything(),
        }),
      );
    });

    it('should call server logout for test users', () => {
      const testUserProfile = { ...mockUserProfile, email: 'user1@example.com' };
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(testUserProfile);

      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalled();
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle server unavailable during logout', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock network error (server unavailable)
      const networkError = new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
      });

      vi.mocked(httpClient.post).mockReturnValue(throwError(() => networkError));

      service.logout();

      expect(loggerService.warn).toHaveBeenCalledWith(
        'Server unavailable during logout - proceeding with client-side logout',
      );
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle server errors during logout gracefully', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock server error
      const serverError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        error: 'Server Error',
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

      vi.mocked(httpClient.post).mockReturnValue(of({ success: true }));

      service.logout();

      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
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

    it('should call server logout for all test user email patterns', () => {
      const testUsers = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
        'demo.user@example.com',
      ];

      testUsers.forEach(email => {
        const testUserProfile = { ...mockUserProfile, email };
        service['isAuthenticatedSubject'].next(true);
        service['userProfileSubject'].next(testUserProfile);
        service['isLoggingOut'] = false;

        vi.mocked(httpClient.post).mockReturnValue(of({}));

        service.logout();

        expect(httpClient.post).toHaveBeenCalled();
        expect(service.isAuthenticated).toBe(false);

        // Reset for next iteration
        vi.clearAllMocks();
      });
    });

    it('should call server logout for regular users', () => {
      const regularUserProfile = { ...mockUserProfile, email: 'regular.user@company.com' };
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(regularUserProfile);

      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalled();
    });

    it('should clear provider cache on logout', () => {
      // Set up initial state with cached providers
      service['cachedOAuthProviders'] = mockProvidersResponse.providers;
      service['oauthProvidersCacheTime'] = Date.now();
      service['samlProvidersCacheTime'] = Date.now();

      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Call logout
      service.logout();

      // Verify provider cache is cleared
      expect(service['cachedOAuthProviders']).toBeNull();
      expect(service['cachedSAMLProviders']).toBeNull();
      expect(service['oauthProvidersCacheTime']).toBe(0);
      expect(service['samlProvidersCacheTime']).toBe(0);

      // Verify auth data is also cleared
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
    });
    it('should prevent re-entrant logout calls', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      vi.mocked(httpClient.post).mockReturnValue(of({}));

      // First call should proceed
      service.logout();
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      // Reset the authenticated state as if re-entry happened before completion
      service['isAuthenticatedSubject'].next(true);
      service['isLoggingOut'] = true;

      // Second call while first is in progress should be ignored
      service.logout();
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it('should reset re-entrancy guard after logout completes', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      // After logout completes, the guard should be reset
      expect(service['isLoggingOut']).toBe(false);
    });
  }); /* End of Enhanced Logout Functionality describe block */

  describe('validateAndUpdateAuthState()', () => {
    it('should call logout when no session found but auth state is true', () => {
      service['isAuthenticatedSubject'].next(true);

      // No session in memory
      service['sessionSubject'].next(null);

      const logoutSpy = vi.spyOn(service, 'logout');

      service.validateAndUpdateAuthState();

      expect(logoutSpy).toHaveBeenCalled();
    });

    it('should call logout when session is expired but auth state is true', () => {
      service['isAuthenticatedSubject'].next(true);

      const expiredSession: AuthSession = {
        expiresIn: 3600,
        expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
      };

      // Set session in memory
      service['sessionSubject'].next(expiredSession);

      const logoutSpy = vi.spyOn(service, 'logout');

      service.validateAndUpdateAuthState();

      expect(logoutSpy).toHaveBeenCalled();
    });

    it('should not call logout when session is valid', () => {
      service['isAuthenticatedSubject'].next(true);

      const validSession: AuthSession = {
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000), // expires in 1 hour
      };

      // Set session in memory
      service['sessionSubject'].next(validSession);

      const logoutSpy = vi.spyOn(service, 'logout');

      service.validateAndUpdateAuthState();

      expect(logoutSpy).not.toHaveBeenCalled();
    });

    it('should not call logout when not authenticated', () => {
      service['isAuthenticatedSubject'].next(false);
      service['sessionSubject'].next(null);

      const logoutSpy = vi.spyOn(service, 'logout');

      service.validateAndUpdateAuthState();

      expect(logoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh Functionality', () => {
    describe('refreshToken()', () => {
      it('should successfully refresh session with cookie-based refresh', () => {
        const refreshResponse = {
          expires_in: 3600,
        };

        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));

        const result$ = service.refreshToken();

        result$.subscribe(newSession => {
          expect(newSession.expiresIn).toBe(3600);
          expect(newSession.expiresAt).toBeInstanceOf(Date);
          expect(newSession.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });

        // refreshToken() now POSTs with empty body (cookies sent automatically)
        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/oauth2/refresh`, {});
      });

      it('should handle refresh failure and clear auth data', () => {
        const error = new HttpErrorResponse({
          status: 401,
          statusText: 'Unauthorized',
          error: 'Invalid refresh token',
        });

        vi.mocked(httpClient.post).mockReturnValue(throwError(() => error));

        const result$ = service.refreshToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('Token refresh failed - please login again');
            expect(service.isAuthenticated).toBe(false);
            expect(service.userProfile).toBeNull();
          },
        });
      });

      it('should handle network errors during refresh', () => {
        const networkError = new HttpErrorResponse({
          status: 0,
          statusText: 'Unknown Error',
          error: new ProgressEvent('Network error'),
        });

        vi.mocked(httpClient.post).mockReturnValue(throwError(() => networkError));

        const result$ = service.refreshToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('Token refresh failed - please login again');
            expect(loggerService.error).toHaveBeenCalledWith('Token refresh failed', networkError);
          },
        });
      });
    });

    describe('shouldRefreshSession()', () => {
      it('should return true when session expires within 15 minutes', () => {
        const soonToExpireSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 30000), // 30 seconds from now
        };

        // Set session in memory
        service['sessionSubject'].next(soonToExpireSession);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(true);
      });

      it('should return false when session has plenty of time left', () => {
        const validSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 1800000), // 30 minutes from now
        };

        // Set session in memory
        service['sessionSubject'].next(validSession);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(false);
      });

      it('should return false when no session is stored', () => {
        // No session in memory
        service['sessionSubject'].next(null);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(false);
      });

      it('should handle exact boundary conditions', () => {
        // Test exactly 15 minutes from now (should refresh at <= 15 min)
        const exactBoundarySession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // exactly 15 minutes
        };

        // Set session in memory
        service['sessionSubject'].next(exactBoundarySession);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(true);
      });

      it('should handle already expired sessions', () => {
        const expiredSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        };

        // Set session in memory
        service['sessionSubject'].next(expiredSession);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(true);
      });
    });

    describe('getValidToken() / ensureValidSession()', () => {
      it('should return existing session when valid and no refresh needed', () => {
        const validSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 1800000), // 30 minutes from now
        };

        // Set session in memory
        service['sessionSubject'].next(validSession);

        const result$ = service.getValidToken();

        result$.subscribe(session => {
          expect(session).toEqual(validSession);
          expect(httpClient.post).not.toHaveBeenCalled();
        });
      });

      it('should automatically refresh session when needed and return new session', () => {
        const soonToExpireSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 30000), // 30 seconds from now
        };

        const refreshResponse = {
          expires_in: 3600,
        };

        // Set session in memory
        service['sessionSubject'].next(soonToExpireSession);
        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));

        const storeSessionSpy = vi.spyOn(service, 'storeSessionInfo');

        const result$ = service.getValidToken();

        result$.subscribe(session => {
          expect(session.expiresIn).toBe(3600);
          expect(storeSessionSpy).toHaveBeenCalled();
        });

        // refreshToken() POSTs with empty body
        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/oauth2/refresh`, {});
      });

      it('should return error when no session is available', () => {
        // No session in memory
        service['sessionSubject'].next(null);
        // Mark token ready so it doesn't wait
        service['tokenReadySubject'].next(true);

        const result$ = service.getValidToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('No session available');
          },
        });
      });

      it('should return error when session is expired', () => {
        const expiredSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() - 1000),
        };

        // Set expired session in memory
        service['sessionSubject'].next(expiredSession);

        // Mock refresh failure
        vi.mocked(httpClient.post).mockReturnValue(
          throwError(() => new HttpErrorResponse({ status: 401 })),
        );

        const result$ = service.getValidToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toContain('refresh failed');
          },
        });
      });

      it('should handle refresh failure and clear auth data', () => {
        const soonToExpireSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 30000),
        };

        // Set session in memory
        service['sessionSubject'].next(soonToExpireSession);

        const refreshError = new HttpErrorResponse({
          status: 401,
          statusText: 'Unauthorized',
          error: 'Invalid refresh token',
        });

        vi.mocked(httpClient.post).mockReturnValue(throwError(() => refreshError));

        const result$ = service.getValidToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('Token refresh failed - please login again');
            expect(service.isAuthenticated).toBe(false);
          },
        });
      });

      it('should handle no stored session', () => {
        // No session in memory
        service['sessionSubject'].next(null);
        service['tokenReadySubject'].next(true);

        const result$ = service.getValidToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('No session available');
          },
        });
      });
    });

    describe('Token Lifecycle Integration', () => {
      it('should handle complete session refresh cycle', () => {
        // Start with a session that needs refresh
        const expiringSoonSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 30000),
        };

        const refreshResponse = {
          expires_in: 3600,
        };

        // Set session in memory
        service['sessionSubject'].next(expiringSoonSession);
        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));

        // First call should trigger refresh
        const result1$ = service.getValidToken();

        result1$.subscribe(session => {
          expect(session.expiresIn).toBe(3600);
        });

        // The refresh stores a new session; second call with a valid session should not refresh
        const newSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000),
        };

        service['sessionSubject'].next(newSession);

        // Second call should not trigger refresh
        const result2$ = service.getValidToken();

        result2$.subscribe(session => {
          expect(session.expiresIn).toBe(3600);
        });

        // Should only have called refresh once
        expect(httpClient.post).toHaveBeenCalledTimes(1);
      });
    });
  }); /* End of Token Refresh Functionality describe block */

  describe('OAuth State / CSRF Validation (Security)', () => {
    describe('decodeState()', () => {
      it('should decode valid Base64-encoded structured state with csrf and returnUrl', () => {
        const stateData = { csrf: 'csrf-token-123', returnUrl: '/dashboard' };
        const encodedState = btoa(JSON.stringify(stateData));

        const result = service['decodeState'](encodedState);

        expect(result.csrf).toBe('csrf-token-123');
        expect(result.returnUrl).toBe('/dashboard');
      });

      it('should decode valid Base64-encoded structured state with csrf only', () => {
        const stateData = { csrf: 'csrf-only-token' };
        const encodedState = btoa(JSON.stringify(stateData));

        const result = service['decodeState'](encodedState);

        expect(result.csrf).toBe('csrf-only-token');
        expect(result.returnUrl).toBeUndefined();
      });

      it('should fall back to plain CSRF token for non-Base64 string', () => {
        const plainState = 'plain-csrf-token-!@#$%';

        const result = service['decodeState'](plainState);

        expect(result.csrf).toBe('plain-csrf-token-!@#$%');
        expect(result.returnUrl).toBeUndefined();
      });

      it('should fall back to plain CSRF token for valid Base64 but non-JSON content', () => {
        const nonJsonBase64 = btoa('this is not json');

        const result = service['decodeState'](nonJsonBase64);

        // Should fall back to treating the entire Base64 string as a plain CSRF token
        expect(result.csrf).toBe(nonJsonBase64);
        expect(result.returnUrl).toBeUndefined();
      });

      it('should handle Base64-encoded JSON without csrf field', () => {
        const stateData = { returnUrl: '/some-page' }; // Missing csrf field
        const encodedState = btoa(JSON.stringify(stateData));

        const result = service['decodeState'](encodedState);

        // csrf will be undefined from the decoded object
        expect(result.csrf).toBeUndefined();
        expect(result.returnUrl).toBe('/some-page');
      });

      it('should not throw for empty string input', () => {
        // isBase64 returns false for empty string, so this should fall back
        const result = service['decodeState']('');

        expect(result.csrf).toBe('');
        expect(result.returnUrl).toBeUndefined();
      });
    });

    describe('handleOAuthCallback() CSRF state validation', () => {
      it('should reject mismatched state even when access_token is present', () => {
        const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
        const forgedState = 'completely-forged-state';
        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return 'original-state-value';
          if (key === 'oauth_provider') return 'tmi';
          return null;
        });

        const response: OAuthResponse = {
          access_token: 'some-opaque-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          state: forgedState,
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(false);
          expect(handleAuthErrorSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              code: 'invalid_state',
              message: expect.stringContaining('possible CSRF attack'),
            }),
          );
        });
      });

      it('should accept matching state when access_token is present', () => {
        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return 'matching-state';
          if (key === 'oauth_provider') return 'tmi';
          return null;
        });

        // Mock GET /me call
        vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

        const response: OAuthResponse = {
          access_token: 'some-opaque-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          state: 'matching-state',
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(true);
        });
      });

      it('should process token when access_token present but no state at all', () => {
        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return 'stored-state';
          if (key === 'oauth_provider') return 'tmi';
          return null;
        });

        // Mock GET /me call
        vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

        const response: OAuthResponse = {
          access_token: 'some-opaque-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          // No state property at all
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(true);
        });
      });

      it('should reject mismatched state when no access_token (code flow)', () => {
        const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return 'stored-csrf-value';
          if (key === 'oauth_provider') return 'google';
          return null;
        });

        const response: OAuthResponse = {
          code: 'auth-code',
          state: 'different-csrf-value', // Mismatched plain state
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(false);
          expect(handleAuthErrorSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              code: 'invalid_state',
            }),
          );
        });
      });

      it('should accept matching state in code flow', () => {
        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return 'matching-state';
          if (key === 'oauth_provider') return 'google';
          return null;
        });

        // Mock code exchange
        const tokenResponse = {
          expires_in: 3600,
          token_type: 'Bearer',
        };
        httpClient.post.mockReturnValue(of(tokenResponse));

        // Mock GET /me
        vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

        const response: OAuthResponse = {
          code: 'auth-code',
          state: 'matching-state',
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(true);
        });
      });

      it('should handle structured state (Base64) matching in code flow', () => {
        const stateData = { csrf: 'csrf-123', returnUrl: '/tm/edit/42' };
        const encodedState = btoa(JSON.stringify(stateData));

        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return encodedState;
          if (key === 'oauth_provider') return 'google';
          return null;
        });

        // Mock code exchange
        const tokenResponse = {
          expires_in: 3600,
          token_type: 'Bearer',
        };
        httpClient.post.mockReturnValue(of(tokenResponse));
        vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

        const response: OAuthResponse = {
          code: 'auth-code',
          state: encodedState, // Same encoded state
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(true);
        });
      });

      it('should reject structured state with different csrf in code flow', () => {
        const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');
        const storedState = btoa(JSON.stringify({ csrf: 'original-csrf' }));
        const receivedState = btoa(JSON.stringify({ csrf: 'forged-csrf' }));

        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return storedState;
          if (key === 'oauth_provider') return 'google';
          return null;
        });

        const response: OAuthResponse = {
          code: 'auth-code',
          state: receivedState,
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(false);
          expect(handleAuthErrorSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              code: 'invalid_state',
              message: expect.stringContaining('possible CSRF attack'),
            }),
          );
        });
      });

      it('should handle OAuth error response before state validation', () => {
        const handleAuthErrorSpy = vi.spyOn(service, 'handleAuthError');

        const response: OAuthResponse = {
          error: 'server_error',
          error_description: 'Internal server error',
          state: 'some-state',
        };

        const result$ = service.handleOAuthCallback(response);

        result$.subscribe(result => {
          expect(result).toBe(false);
          expect(handleAuthErrorSpy).toHaveBeenCalled();
        });
      });

      it('should clean up oauth_state and oauth_provider after callback', async () => {
        localStorageMock.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return 'state-value';
          if (key === 'oauth_provider') return 'tmi';
          return null;
        });

        vi.mocked(httpClient.get).mockReturnValue(of(mockUserMeResponse));

        const response: OAuthResponse = {
          access_token: 'some-opaque-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          state: 'state-value',
        };

        await service.handleOAuthCallback(response).toPromise();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
      });
    });
  }); /* End of OAuth State / CSRF Validation describe block */

  describe('Session Refresh Boundary Conditions (Security)', () => {
    describe('shouldRefreshSession() 15-minute boundary', () => {
      it('should return true when session expires in exactly 15 minutes', () => {
        const boundarySession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // Exactly 15 minutes
        };

        service['sessionSubject'].next(boundarySession);

        // expiresAt <= fifteenMinutesFromNow should be true when equal
        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(true);
      });

      it('should return false when session expires in 16 minutes', () => {
        const safeSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 16 * 60 * 1000), // 16 minutes
        };

        service['sessionSubject'].next(safeSession);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(false);
      });

      it('should return true when session expires in 14 minutes', () => {
        const nearExpirySession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 14 * 60 * 1000), // 14 minutes
        };

        service['sessionSubject'].next(nearExpirySession);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(true);
      });

      it('should return false when no session is available', () => {
        service['sessionSubject'].next(null);

        const shouldRefresh = service['shouldRefreshSession']();
        expect(shouldRefresh).toBe(false);
      });

      it('should return false when called with null session and nothing cached', () => {
        // Ensure no cached session
        service['sessionSubject'].next(null);

        const shouldRefresh = service['shouldRefreshSession'](null);
        expect(shouldRefresh).toBe(false);
      });
    });

    describe('ensureValidSession() wait path', () => {
      it('should wait for tokenReady$ when session initialization is in progress', () => {
        // Set tokenReady to false to simulate init in progress
        service['tokenReadySubject'].next(false);

        // No cached session
        service['sessionSubject'].next(null);

        const result$ = service.getValidToken();
        const results: AuthSession[] = [];

        result$.subscribe({
          next: session => results.push(session),
          error: () => {},
        });

        // Should not have emitted yet (waiting for tokenReady$)
        expect(results.length).toBe(0);

        // Now simulate init completing with a valid session
        const validSession: AuthSession = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 1800000), // 30 minutes
        };
        service['sessionSubject'].next(validSession);
        service['tokenReadySubject'].next(true);

        // Now it should have emitted
        expect(results.length).toBe(1);
        expect(results[0]).toEqual(validSession);
      });
    });

    describe('refreshToken() HTTP interactions', () => {
      it('should POST to /oauth2/refresh with empty body', () => {
        const refreshResponse = {
          expires_in: 7200,
        };
        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));

        service.refreshToken().subscribe(session => {
          expect(session.expiresIn).toBe(7200);
        });

        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/oauth2/refresh`, {});
      });
    });
  }); /* End of Session Refresh Boundary Conditions describe block */
});
