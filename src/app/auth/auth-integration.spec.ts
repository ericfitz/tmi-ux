// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';

import { AuthService } from './services/auth.service';
import { JwtInterceptor } from './interceptors/jwt.interceptor';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { LoggerService } from '../core/services/logger.service';
import { ServerConnectionService } from '../core/services/server-connection.service';
import { environment } from '../../environments/environment';
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

interface MockCrypto {
  getRandomValues: ReturnType<typeof vi.fn>;
  subtle: {
    digest: ReturnType<typeof vi.fn>;
    importKey: ReturnType<typeof vi.fn>;
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
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
  let cryptoMock: MockCrypto;
  let serverConnectionService: { currentStatus: string };

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

    // Create functional crypto mock using XOR encryption
    const mockArray = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const XOR_KEY = 0x5a; // Simple XOR key for test encryption

    cryptoMock = {
      getRandomValues: vi.fn().mockReturnValue(mockArray),
      subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        importKey: vi.fn().mockResolvedValue({}),
        encrypt: vi.fn().mockImplementation((algorithm, key, plaintext) => {
          // XOR-based encryption - encrypt the input data
          const plaintextArray = new Uint8Array(plaintext);
          const encrypted = new Uint8Array(plaintextArray.length);
          for (let i = 0; i < plaintextArray.length; i++) {
            encrypted[i] = plaintextArray[i] ^ XOR_KEY;
          }
          return Promise.resolve(encrypted.buffer);
        }),
        decrypt: vi.fn().mockImplementation((algorithm, key, ciphertext) => {
          // XOR-based decryption - decrypt the input data (XOR with same key)
          const ciphertextArray = new Uint8Array(ciphertext);
          const decrypted = new Uint8Array(ciphertextArray.length);
          for (let i = 0; i < ciphertextArray.length; i++) {
            decrypted[i] = ciphertextArray[i] ^ XOR_KEY;
          }
          return Promise.resolve(decrypted.buffer);
        }),
      },
    };

    // Mock global localStorage, sessionStorage, and crypto
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

    // Mock navigator for browser fingerprinting
    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Test)',
        language: 'en-US',
      },
      configurable: true,
      writable: true,
    });

    // Mock screen for browser fingerprinting
    Object.defineProperty(global, 'screen', {
      value: {
        width: 1920,
        height: 1080,
      },
      configurable: true,
      writable: true,
    });

    // Create mock server connection service
    serverConnectionService = {
      currentStatus: 'connected',
    };

    // Create the service with mocked dependencies
    authService = new AuthService(
      router as unknown as Router,
      httpClient as unknown as HttpClient,
      logger as unknown as LoggerService,
      serverConnectionService as unknown as ServerConnectionService,
    );
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

    it('should have roleGuard function defined', () => {
      expect(roleGuard).toBeDefined();
      expect(typeof roleGuard).toBe('function');
    });
  });

  describe('JWT Interceptor', () => {
    it('should be created', () => {
      const interceptor = new JwtInterceptor(
        authService,
        router as unknown as Router,
        logger as unknown as LoggerService,
      );
      expect(interceptor).toBeTruthy();
    });
  });

  describe('Demo Login Flow', () => {
    it('should handle demo login correctly', () => {
      const testEmail = 'test@example.com';

      // Before login
      expect(authService.isAuthenticated).toBe(false);

      // Perform demo login
      authService.demoLogin(testEmail);

      // After login
      expect(authService.isAuthenticated).toBe(true);
      expect(authService.userEmail).toBe(testEmail);
      expect(authService.username).toBe('test');
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should handle logout correctly', () => {
      // Login first
      authService.demoLogin('test@example.com');
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
      it('should handle complete Google OAuth login flow with token refresh', () => {
        // Create a properly formatted JWT token with base64-encoded payload
        const mockPayload = {
          sub: '12345678-1234-1234-1234-123456789abc',
          email: 'user@example.com',
          name: 'Test User',
          providers: [{ provider: 'google', is_primary: true }],
        };
        const mockJwtToken = 'header.' + btoa(JSON.stringify(mockPayload)) + '.signature';

        // Mock TMI OAuth proxy response with tokens (new pattern)
        const mockOAuthResponse = {
          access_token: mockJwtToken,
          refresh_token: 'initial-refresh-token',
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

        // Execute OAuth callback (no HTTP call needed - TMI provides tokens directly)
        const result$ = authService.handleOAuthCallback(mockOAuthResponse);

        result$.subscribe(success => {
          expect(success).toBe(true);
          expect(authService.isAuthenticated).toBe(true);
          expect(authService.userProfile).toBeTruthy();
          expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
        });

        // Verify localStorage cleanup
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
      });

      it('should handle OAuth login with automatic token refresh', async () => {
        // Create JWT token for initial login
        const initialPayload = {
          sub: '12345678-1234-1234-1234-123456789abc',
          email: 'refresh-user@example.com',
          name: 'Refresh User',
          providers: [{ provider: 'google', is_primary: true }],
        };
        const initialJwtToken = 'header.' + btoa(JSON.stringify(initialPayload)) + '.signature';

        // Set up localStorage to return a token that needs refresh
        const expiringSoonToken = {
          token: initialJwtToken,
          refreshToken: 'valid-refresh-token',
          expiresIn: 60,
          expiresAt: new Date(Date.now() + 30000), // 30 seconds from now - will trigger refresh
        };

        localStorageMock.getItem.mockImplementation((key: string) => {
          switch (key) {
            case 'oauth_state':
              return 'test-state';
            case 'oauth_provider':
              return 'google';
            case 'auth_token':
              return JSON.stringify(expiringSoonToken);
            default:
              return null;
          }
        });

        // Create JWT token for refresh response
        const refreshPayload = {
          sub: '12345678-1234-1234-1234-123456789abc',
          email: 'refresh-user@example.com',
          name: 'Refresh User',
          providers: [{ provider: 'google', is_primary: true }],
        };
        const refreshJwtToken = 'header.' + btoa(JSON.stringify(refreshPayload)) + '.signature';

        // Mock the refresh response
        const refreshResponse = {
          access_token: refreshJwtToken,
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        };

        vi.mocked(httpClient.post).mockReturnValueOnce(of(refreshResponse));

        // First, simulate successful OAuth login
        const oauthResult$ = authService.handleOAuthCallback({
          access_token: initialJwtToken,
          refresh_token: 'valid-refresh-token',
          expires_in: 60,
          state: 'test-state',
        });

        return new Promise<void>((resolve, reject) => {
          oauthResult$.subscribe({
            next: success => {
              expect(success).toBe(true);

              // Now test automatic token refresh
              const validToken$ = authService.getValidToken();

              validToken$.subscribe({
                next: token => {
                  try {
                    expect(token.token).toBe(refreshJwtToken);
                    expect(token.refreshToken).toBe('new-refresh-token');

                    // Verify refresh was called
                    expect(httpClient.post).toHaveBeenCalledWith(
                      `${environment.apiUrl}/oauth2/refresh`,
                      { refresh_token: 'valid-refresh-token' },
                    );

                    resolve();
                  } catch (error) {
                    reject(error instanceof Error ? error : new Error(String(error)));
                  }
                },
                error: error => {
                  reject(new Error(`Unexpected error in token refresh test: ${error.message}`));
                },
              });
            },
            error: error => {
              reject(new Error(`OAuth callback failed: ${error.message}`));
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
          'Authorization code exchange failed',
          exchangeError,
        );
      });

      it('should handle token refresh failure and force re-authentication', () => {
        // Set up an expired token with refresh token
        const expiredToken = {
          token: 'expired-access-token',
          refreshToken: 'invalid-refresh-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() - 1000), // Already expired
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredToken));
        // Also set the in-memory cache so getStoredToken() returns this token
        authService['jwtTokenSubject'].next(expiredToken);

        // Mock refresh failure
        const refreshError = new Error('Invalid refresh token');
        vi.mocked(httpClient.post).mockReturnValue(throwError(() => refreshError));

        const validToken$ = authService.getValidToken();

        validToken$.subscribe({
          next: () => {
            // Should not succeed
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
      it('should handle session restoration with refresh tokens', async () => {
        const storedToken = {
          token: 'valid-stored-token',
          refreshToken: 'valid-stored-refresh-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 1800000), // 30 minutes from now
        };

        const storedProfile = {
          id: '12345678-1234-1234-1234-123456789abc',
          email: 'restored@example.com',
          name: 'Restored User',
          providers: [{ provider: 'google', is_primary: true }],
          picture: 'https://example.com/pic.jpg',
        };

        // Helper function to XOR encrypt data like the real service would
        const xorEncrypt = (data: string): string => {
          const XOR_KEY = 0x5a;
          const plaintext = new TextEncoder().encode(data);
          const encrypted = new Uint8Array(plaintext.length);
          for (let i = 0; i < plaintext.length; i++) {
            encrypted[i] = plaintext[i] ^ XOR_KEY;
          }

          // Convert to base64 like the real service does (iv:encrypted format)
          const iv = 'AQEBAQEBAQEBAQEBAQEB'; // Mock IV base64
          const encryptedB64 = btoa(String.fromCharCode(...encrypted));
          return `${iv}:${encryptedB64}`;
        };

        localStorageMock.getItem.mockImplementation((key: string) => {
          switch (key) {
            case 'auth_token':
              // Return encrypted format that our XOR mock can decrypt
              return xorEncrypt(JSON.stringify(storedToken));
            case 'user_profile':
              // Return encrypted format for user profile
              return xorEncrypt(JSON.stringify(storedProfile));
            default:
              return null;
          }
        });

        // Provide session salt for encryption key derivation
        sessionStorageMock.getItem.mockImplementation((key: string) => {
          if (key === '_ts') {
            return 'test-session-salt-base64';
          }
          return null;
        });

        // Create a new service instance to test initialization
        const restoredAuthService = new AuthService(
          router as unknown as Router,
          httpClient as unknown as HttpClient,
          logger as unknown as LoggerService,
          serverConnectionService as unknown as ServerConnectionService,
        );

        // Trigger async authentication restoration
        await restoredAuthService.checkAuthStatus();

        // Should restore authentication state
        expect(restoredAuthService.isAuthenticated).toBe(true);
        expect(restoredAuthService.userProfile).toEqual(storedProfile);
        expect(restoredAuthService.userEmail).toBe('restored@example.com');
        expect(restoredAuthService.username).toBe('Restored User');
      });

      it('should handle expired session cleanup on initialization', () => {
        const expiredToken = {
          token: 'expired-token',
          refreshToken: 'expired-refresh-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        };

        localStorageMock.getItem.mockImplementation((key: string) => {
          switch (key) {
            case 'auth_token':
              return JSON.stringify(expiredToken);
            case 'user_profile':
              return JSON.stringify({ email: 'test@example.com' });
            default:
              return null;
          }
        });

        // Create a new service instance to test initialization
        const expiredAuthService = new AuthService(
          router as unknown as Router,
          httpClient as unknown as HttpClient,
          logger as unknown as LoggerService,
          serverConnectionService as unknown as ServerConnectionService,
        );

        // Should not restore authentication state with expired token
        expect(expiredAuthService.isAuthenticated).toBe(false);
        expect(expiredAuthService.userProfile).toBeNull();
      });
    });

    describe('Multi-Provider OAuth Integration', () => {
      it('should handle GitHub OAuth flow', () => {
        // Create JWT token for GitHub
        const githubPayload = {
          sub: '12345678-1234-1234-1234-123456789abc',
          email: 'github-user@example.com',
          name: 'GitHub User',
          providers: [{ provider: 'github', is_primary: true }],
        };
        const githubJwtToken = 'header.' + btoa(JSON.stringify(githubPayload)) + '.signature';

        // TMI OAuth proxy response with tokens (new pattern)
        const githubOAuthResponse = {
          access_token: githubJwtToken,
          refresh_token: 'github-refresh-token',
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

        const result$ = authService.handleOAuthCallback(githubOAuthResponse);

        result$.subscribe(success => {
          expect(success).toBe(true);
          expect(authService.isAuthenticated).toBe(true);
        });
      });

      it('should handle Microsoft OAuth flow', () => {
        // Create JWT token for Microsoft
        const microsoftPayload = {
          sub: '12345678-1234-1234-1234-123456789abc',
          email: 'microsoft-user@example.com',
          name: 'Microsoft User',
          providers: [{ provider: 'microsoft', is_primary: true }],
        };
        const microsoftJwtToken = 'header.' + btoa(JSON.stringify(microsoftPayload)) + '.signature';

        // TMI OAuth proxy response with tokens (new pattern)
        const microsoftOAuthResponse = {
          access_token: microsoftJwtToken,
          refresh_token: 'microsoft-refresh-token',
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

        const result$ = authService.handleOAuthCallback(microsoftOAuthResponse);

        result$.subscribe(success => {
          expect(success).toBe(true);
          expect(authService.isAuthenticated).toBe(true);
        });
      });
    });

    describe('JWT Interceptor Integration', () => {
      it('should integrate with JWT interceptor for automatic token refresh', () => {
        const interceptor = new JwtInterceptor(
          authService,
          router as unknown as Router,
          logger as unknown as LoggerService,
        );

        // Mock a token that needs refresh
        const soonToExpireToken = {
          token: 'soon-to-expire-token',
          refreshToken: 'valid-refresh-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 30000), // 30 seconds from now
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(soonToExpireToken));

        // Create JWT token for refresh response
        const interceptorRefreshPayload = {
          sub: '12345678-1234-1234-1234-123456789abc',
          email: 'interceptor-user@example.com',
          name: 'Interceptor User',
          providers: [{ provider: 'google', is_primary: true }],
        };
        const interceptorRefreshJwtToken =
          'header.' + btoa(JSON.stringify(interceptorRefreshPayload)) + '.signature';

        // Mock refresh response
        const refreshResponse = {
          access_token: interceptorRefreshJwtToken,
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        };

        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));

        // Mock HTTP request and handler
        const mockRequest = {
          url: `${environment.apiUrl}/test`,
          method: 'GET',
          clone: vi.fn().mockReturnThis(),
          setHeaders: vi.fn(),
        } as any;

        const mockHandler = {
          handle: vi.fn().mockReturnValue(of({ data: 'test' })),
        } as any;

        // Test interceptor
        const result$ = interceptor.intercept(mockRequest, mockHandler);

        result$.subscribe({
          next: () => {
            // Verify that getValidToken was called (which triggers refresh)
            expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/oauth2/refresh`, {
              refresh_token: 'valid-refresh-token',
            });
          },
          error: error => {
            // Handle any errors that occur during interceptor processing
            console.warn('Interceptor error (expected in test):', error.message);
          },
        });
      });
    });
  });

  describe('End-to-End Authentication Scenarios', () => {
    it('should handle complete user session lifecycle', () => {
      // 1. Start unauthenticated
      expect(authService.isAuthenticated).toBe(false);

      // Create JWT token for session
      const sessionPayload = {
        sub: '12345678-1234-1234-1234-123456789abc',
        email: 'session-user@example.com',
        name: 'Session User',
        providers: [{ provider: 'google', is_primary: true }],
      };
      const sessionJwtToken = 'header.' + btoa(JSON.stringify(sessionPayload)) + '.signature';

      // 2. Simulate TMI OAuth login with tokens (new pattern)
      const oauthResponse = {
        access_token: sessionJwtToken,
        refresh_token: 'session-refresh-token',
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

      // 3. Complete OAuth flow (no HTTP call needed with TMI proxy)
      const loginResult$ = authService.handleOAuthCallback(oauthResponse);

      loginResult$.subscribe(success => {
        expect(success).toBe(true);
        expect(authService.isAuthenticated).toBe(true);

        // 4. Simulate API usage with automatic token refresh
        const expiringSoonToken = {
          token: sessionJwtToken,
          refreshToken: 'session-refresh-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 30000), // Soon to expire
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiringSoonToken));

        // Create JWT token for final refresh
        const finalRefreshPayload = {
          sub: '12345678-1234-1234-1234-123456789abc',
          email: 'session-user@example.com',
          name: 'Session User',
          providers: [{ provider: 'google', is_primary: true }],
        };
        const finalRefreshJwtToken =
          'header.' + btoa(JSON.stringify(finalRefreshPayload)) + '.signature';

        const refreshResponse = {
          access_token: finalRefreshJwtToken,
          refresh_token: 'session-new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        };

        vi.mocked(httpClient.post).mockReturnValueOnce(of(refreshResponse));

        // 5. Test automatic refresh
        const validToken$ = authService.getValidToken();

        validToken$.subscribe(token => {
          expect(token.token).toBe(finalRefreshJwtToken);

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
