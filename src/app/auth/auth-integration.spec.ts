// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { HttpClient, HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';

import { AuthService } from './services/auth.service';
import { JwtInterceptor } from './interceptors/jwt.interceptor';
import { authGuard } from './guards/auth.guard';

import { LoggerService } from '../core/services/logger.service';
import { ServerConnectionService } from '../core/services/server-connection.service';
import { environment } from '../../environments/environment';
import { JwtToken, UserProfile } from './models/auth.models';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  createTypedMockHttpClient,
  type MockLoggerService,
  type MockRouter,
  type MockHttpClient,
} from '../../testing/mocks';

// Mock interfaces for type safety

interface MockStorage {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

/**
 * Integration tests for authentication components
 * Tests that all authentication pieces work together correctly
 */
describe('Authentication Integration', () => {
  let authService: AuthService;
  let router: MockRouter;
  let logger: MockLoggerService;
  let httpClient: MockHttpClient;
  let localStorageMock: MockStorage;
  let sessionStorageMock: MockStorage;
  let serverConnectionService: { currentStatus: string };
  let mockPkceService: any;

  // Store original globals for restoration after tests
  const originalLocalStorage = global.localStorage;
  const originalSessionStorage = global.sessionStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks for dependencies
    logger = createTypedMockLoggerService();

    router = createTypedMockRouter('/test');

    httpClient = createTypedMockHttpClient([]);

    localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    sessionStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    // Mock global localStorage and sessionStorage
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

    // Create mock server connection service
    serverConnectionService = {
      currentStatus: 'connected',
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

    // Mock httpClient.get to return 401 by default so constructor's checkAuthStatus()
    // does not auto-authenticate
    vi.mocked(httpClient.get).mockReturnValue(
      throwError(() => ({ status: 401, statusText: 'Unauthorized' })),
    );

    // Create the service with mocked dependencies (5 params, no CryptoKeyStorageService)
    authService = new AuthService(
      router as unknown as Router,
      httpClient as unknown as HttpClient,
      logger as unknown as LoggerService,
      serverConnectionService as unknown as ServerConnectionService,
      mockPkceService,
    );
  });

  afterEach(() => {
    // Restore original globals to prevent test pollution
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
  });

  describe('AuthService', () => {
    it('should be created', () => {
      expect(authService).toBeTruthy();
    });

    it('should initialize with unauthenticated state', () => {
      expect(authService.isAuthenticated).toBe(false);
      expect(authService.userProfile).toBeNull();
      expect(authService.username).toBe('');
      expect(authService.userEmail).toBe('');
    });
  });

  describe('Guards', () => {
    it('should have authGuard function defined', () => {
      expect(authGuard).toBeDefined();
      expect(typeof authGuard).toBe('function');
    });
  });

  describe('JWT Interceptor', () => {
    it('should be created', () => {
      const interceptor = new JwtInterceptor(authService, logger as unknown as LoggerService);
      expect(interceptor).toBeTruthy();
    });
  });

  describe('Authentication State Management', () => {
    it('should handle manual login state setup correctly', () => {
      const testEmail = 'test@example.com';

      // Before login
      expect(authService.isAuthenticated).toBe(false);

      // Manually set up authenticated state
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      const token: JwtToken = {
        expiresIn: 3600,
        expiresAt,
      };

      const userProfile: UserProfile = {
        provider: 'tmi',
        provider_id: testEmail,
        display_name: 'test',
        email: testEmail,
        groups: null,
        jwt_groups: null,
      };

      authService.storeToken(token);
      authService['isAuthenticatedSubject'].next(true);
      authService['userProfileSubject'].next(userProfile);

      // After setup
      expect(authService.isAuthenticated).toBe(true);
      expect(authService.userEmail).toBe(testEmail);
      expect(authService.username).toBe('test');
    });

    it('should handle logout correctly', () => {
      // Set up authenticated state first
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      const token: JwtToken = {
        expiresIn: 3600,
        expiresAt,
      };

      const userProfile: UserProfile = {
        provider: 'tmi',
        provider_id: 'test@example.com',
        display_name: 'test',
        email: 'test@example.com',
        groups: null,
        jwt_groups: null,
      };

      authService.storeToken(token);
      authService['isAuthenticatedSubject'].next(true);
      authService['userProfileSubject'].next(userProfile);

      expect(authService.isAuthenticated).toBe(true);

      // Logout
      authService.logout();

      // Should be logged out
      expect(authService.isAuthenticated).toBe(false);
      expect(authService.userProfile).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('OAuth Flow Integration Tests', () => {
    describe('Complete OAuth Login Flow', () => {
      it('should handle complete Google OAuth login flow with token response', () => {
        // Mock TMI OAuth proxy response (access_token triggers handleTMITokenResponse path)
        const mockOAuthResponse = {
          access_token: 'server-set-cookie-token',
          expires_in: 3600,
          state: 'csrf-state-value',
        };

        // Set up localStorage mocks for OAuth state
        localStorageMock.getItem.mockImplementation((key: string) => {
          switch (key) {
            case 'oauth_state':
              return 'csrf-state-value';
            case 'oauth_provider':
              return 'google';
            default:
              return null;
          }
        });

        // Mock GET /me to return user profile (called by handleTMITokenResponse -> refreshUserProfile)
        vi.mocked(httpClient.get).mockReturnValue(
          of({
            provider: 'google',
            provider_id: 'user@example.com',
            name: 'Test User',
            email: 'user@example.com',
            is_admin: false,
            groups: null,
          }),
        );

        // Execute OAuth callback
        const result$ = authService.handleOAuthCallback(mockOAuthResponse);

        result$.subscribe(success => {
          expect(success).toBe(true);
          expect(authService.isAuthenticated).toBe(true);
          expect(authService.userProfile).toBeTruthy();
        });

        // Verify localStorage cleanup
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
      });

      it('should handle OAuth login with automatic session refresh', async () => {
        // Set up an in-memory session that is about to expire (triggers refresh)
        const expiresAt = new Date(Date.now() + 30000); // 30 seconds from now
        const expiringSession: JwtToken = {
          expiresIn: 60,
          expiresAt,
        };

        authService.storeToken(expiringSession);
        authService['isAuthenticatedSubject'].next(true);

        // Mock the cookie-based refresh response (POST with empty body)
        const refreshResponse = {
          expires_in: 3600,
        };

        vi.mocked(httpClient.post).mockReturnValueOnce(of(refreshResponse));

        // Test automatic session refresh via getValidToken (deprecated alias for ensureValidSession)
        const validToken$ = authService.getValidToken();

        return new Promise<void>((resolve, reject) => {
          validToken$.subscribe({
            next: session => {
              try {
                expect(session.expiresIn).toBe(3600);
                expect(session.expiresAt).toBeInstanceOf(Date);

                // Verify refresh was called with empty body (cookies sent automatically)
                expect(httpClient.post).toHaveBeenCalledWith(
                  `${environment.apiUrl}/oauth2/refresh`,
                  {},
                );

                resolve();
              } catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
              }
            },
            error: error => {
              reject(new Error(`Unexpected error in session refresh test: ${error.message}`));
            },
          });
        });
      });
    });

    describe('OAuth Error Handling Integration', () => {
      it('should handle complete OAuth flow failure and recovery', () => {
        // Test authorization code exchange failure and recovery
        const mockOAuthResponse = {
          code: 'authorization-code',
          state: 'valid-state',
        };

        localStorageMock.getItem.mockImplementation((key: string) => {
          switch (key) {
            case 'oauth_state':
              return 'valid-state';
            case 'oauth_provider':
              return 'google';
            default:
              return null;
          }
        });

        // Mock token exchange failure
        const exchangeError = new Error('Invalid time value');
        vi.mocked(httpClient.post).mockReturnValue(throwError(() => exchangeError));

        const result$ = authService.handleOAuthCallback(mockOAuthResponse);

        result$.subscribe({
          next: success => {
            expect(success).toBe(false);
            expect(authService.isAuthenticated).toBe(false);
          },
          error: () => {
            // Error handling should prevent this path
            expect(true).toBe(false);
          },
        });

        expect(logger.error).toHaveBeenCalledWith(
          'Authorization code exchange failed (PKCE)',
          exchangeError,
        );
      });

      it('should handle token refresh failure and force re-authentication', () => {
        // Set up an expired session in memory
        const expiredSession: JwtToken = {
          expiresIn: 3600,
          expiresAt: new Date(Date.now() - 1000), // Already expired
        };

        // Set the in-memory session so getSessionInfo() returns it
        authService['sessionSubject'].next(expiredSession);

        // Mock refresh failure
        const refreshError = new Error('Invalid refresh token');
        vi.mocked(httpClient.post).mockReturnValue(throwError(() => refreshError));

        const validToken$ = authService.getValidToken();

        validToken$.subscribe({
          next: () => {
            // Should not succeed — session is expired and not refreshable
            expect(true).toBe(false);
          },
          error: error => {
            expect(error.message).toBe('Token refresh failed - please login again');
            expect(authService.isAuthenticated).toBe(false);
            expect(authService.userProfile).toBeNull();
          },
        });
      });
    });

    describe('Session Management Integration', () => {
      it('should handle session restoration via GET /me', async () => {
        const storedProfile: UserProfile = {
          provider: 'google',
          provider_id: 'restored@example.com',
          display_name: 'Restored User',
          email: 'restored@example.com',
          groups: null,
          jwt_groups: null,
        };

        // Mock GET /me to return a valid user profile (session cookie is valid)
        vi.mocked(httpClient.get).mockReturnValue(
          of({
            provider: storedProfile.provider,
            provider_id: storedProfile.provider_id,
            name: storedProfile.display_name,
            email: storedProfile.email,
            is_admin: false,
            groups: null,
          }),
        );

        // Create a new service instance to test initialization (constructor calls checkAuthStatus)
        const restoredAuthService = new AuthService(
          router as unknown as Router,
          httpClient as unknown as HttpClient,
          logger as unknown as LoggerService,
          serverConnectionService as unknown as ServerConnectionService,
          mockPkceService,
        );

        // Wait for async checkAuthStatus to complete
        await restoredAuthService.checkAuthStatus();

        // Should restore authentication state from GET /me response
        expect(restoredAuthService.isAuthenticated).toBe(true);
        expect(restoredAuthService.userProfile?.email).toBe('restored@example.com');
        expect(restoredAuthService.userProfile?.display_name).toBe('Restored User');
        expect(restoredAuthService.username).toBe('Restored User');
      });

      it('should handle no valid session on initialization', async () => {
        // Mock GET /me to return 401 (no valid session cookie)
        vi.mocked(httpClient.get).mockReturnValue(
          throwError(() => ({ status: 401, statusText: 'Unauthorized' })),
        );

        // Create a new service instance to test initialization
        const unauthService = new AuthService(
          router as unknown as Router,
          httpClient as unknown as HttpClient,
          logger as unknown as LoggerService,
          serverConnectionService as unknown as ServerConnectionService,
          mockPkceService,
        );

        // Wait for async checkAuthStatus to complete
        await unauthService.checkAuthStatus();

        // Should not restore authentication state
        expect(unauthService.isAuthenticated).toBe(false);
        expect(unauthService.userProfile).toBeNull();
      });
    });

    describe('Multi-Provider OAuth Integration', () => {
      it('should handle GitHub OAuth flow', () => {
        // TMI OAuth proxy response with tokens
        const githubOAuthResponse = {
          access_token: 'github-cookie-token',
          expires_in: 3600,
          state: 'github-state',
        };

        localStorageMock.getItem.mockImplementation((key: string) => {
          switch (key) {
            case 'oauth_state':
              return 'github-state';
            case 'oauth_provider':
              return 'github';
            default:
              return null;
          }
        });

        // Mock GET /me for profile fetch after token response
        vi.mocked(httpClient.get).mockReturnValue(
          of({
            provider: 'github',
            provider_id: 'github-user@example.com',
            name: 'GitHub User',
            email: 'github-user@example.com',
            is_admin: false,
            groups: null,
          }),
        );

        const result$ = authService.handleOAuthCallback(githubOAuthResponse);

        result$.subscribe(success => {
          expect(success).toBe(true);
          expect(authService.isAuthenticated).toBe(true);
        });
      });

      it('should handle Microsoft OAuth flow', () => {
        // TMI OAuth proxy response with tokens
        const microsoftOAuthResponse = {
          access_token: 'microsoft-cookie-token',
          expires_in: 3600,
          state: 'microsoft-state',
        };

        localStorageMock.getItem.mockImplementation((key: string) => {
          switch (key) {
            case 'oauth_state':
              return 'microsoft-state';
            case 'oauth_provider':
              return 'microsoft';
            default:
              return null;
          }
        });

        // Mock GET /me for profile fetch after token response
        vi.mocked(httpClient.get).mockReturnValue(
          of({
            provider: 'microsoft',
            provider_id: 'microsoft-user@example.com',
            name: 'Microsoft User',
            email: 'microsoft-user@example.com',
            is_admin: false,
            groups: null,
          }),
        );

        const result$ = authService.handleOAuthCallback(microsoftOAuthResponse);

        result$.subscribe(success => {
          expect(success).toBe(true);
          expect(authService.isAuthenticated).toBe(true);
        });
      });
    });

    describe('JWT Interceptor Integration', () => {
      it('should integrate with JWT interceptor for API request handling', () => {
        const interceptor = new JwtInterceptor(authService, logger as unknown as LoggerService);

        // Mock HTTP request and handler for a successful API call
        const mockRequest = {
          url: `${environment.apiUrl}/test`,
          method: 'GET',
          clone: vi.fn().mockReturnThis(),
          context: new HttpContext(),
        } as any;

        const mockHandler = {
          handle: vi.fn().mockReturnValue(of({ data: 'test' })),
        } as any;

        // Test interceptor passes through successful requests
        const result$ = interceptor.intercept(mockRequest, mockHandler);

        result$.subscribe({
          next: response => {
            expect(response).toEqual({ data: 'test' });
            expect(mockHandler.handle).toHaveBeenCalled();
          },
          error: () => {
            // Should not error on successful request
            expect(true).toBe(false);
          },
        });
      });
    });
  });

  describe('End-to-End Authentication Scenarios', () => {
    it('should handle complete user session lifecycle', () => {
      // 1. Start unauthenticated
      expect(authService.isAuthenticated).toBe(false);

      // 2. Simulate TMI OAuth login with tokens
      const oauthResponse = {
        access_token: 'session-cookie-token',
        expires_in: 3600,
        state: 'complete-flow-state',
      };

      localStorageMock.getItem.mockImplementation((key: string) => {
        switch (key) {
          case 'oauth_state':
            return 'complete-flow-state';
          case 'oauth_provider':
            return 'google';
          default:
            return null;
        }
      });

      // Mock GET /me for profile fetch
      vi.mocked(httpClient.get).mockReturnValue(
        of({
          provider: 'google',
          provider_id: 'session-user@example.com',
          name: 'Session User',
          email: 'session-user@example.com',
          is_admin: false,
          groups: null,
        }),
      );

      // 3. Complete OAuth flow
      const loginResult$ = authService.handleOAuthCallback(oauthResponse);

      loginResult$.subscribe(success => {
        expect(success).toBe(true);
        expect(authService.isAuthenticated).toBe(true);

        // 4. Simulate session refresh (session about to expire)
        const expiringSession: JwtToken = {
          expiresIn: 60,
          expiresAt: new Date(Date.now() + 30000), // Soon to expire
        };
        authService.storeToken(expiringSession);

        // Mock refresh response (empty body POST, cookie-based)
        const refreshResponse = {
          expires_in: 3600,
        };

        vi.mocked(httpClient.post).mockReturnValueOnce(of(refreshResponse));

        // 5. Test automatic refresh
        const validToken$ = authService.getValidToken();

        validToken$.subscribe(session => {
          expect(session.expiresIn).toBe(3600);

          // 6. Test logout
          vi.mocked(httpClient.post).mockReturnValueOnce(of({}));
          authService.logout();

          expect(authService.isAuthenticated).toBe(false);
          expect(authService.userProfile).toBeNull();
          expect(router.navigate).toHaveBeenCalledWith(['/']);
        });
      });
    });
  });
});
