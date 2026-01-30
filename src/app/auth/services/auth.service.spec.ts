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
  JwtToken,
  UserProfile,
  OAuthResponse,
  AuthError,
  UserRole,
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

  // Test data
  const mockJwtPayload = {
    sub: '12345678-1234-1234-1234-123456789abc',
    email: 'test@example.com',
    name: 'Test User',
    providers: [{ provider: 'tmi', is_primary: true }],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const mockJwtToken: JwtToken = {
    token: 'header.' + btoa(JSON.stringify(mockJwtPayload)) + '.signature',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };

  const mockExpiredToken: JwtToken = {
    token: 'expired.jwt.token',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
  };

  const mockUserProfile: UserProfile = {
    provider: 'tmi',
    provider_id: 'test@example.com',
    display_name: 'Test User',
    email: 'test@example.com',
    groups: null,
  };

  const _mockOAuthResponse: OAuthResponse = {
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

    // Mock global objects for Node.js environment
    // Use Object.defineProperty for localStorage and crypto since they're read-only in browser environments
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

    // Create the service directly with mocked dependencies
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
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with unauthenticated state', () => {
      localStorageMock.getItem.mockReturnValue(null);

      service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
      expect(service.username).toBe('');
      expect(service.userEmail).toBe('');
    });

    it('should restore authentication state from localStorage', async () => {
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
        if (key === 'auth_token') {
          return xorEncrypt(JSON.stringify(mockJwtToken));
        }
        if (key === 'user_profile') {
          return xorEncrypt(JSON.stringify(mockUserProfile));
        }
        return null;
      });

      sessionStorageMock.getItem.mockImplementation((key: string) => {
        if (key === '_ts') {
          return 'test-session-salt-base64';
        }
        return null;
      });

      await service.checkAuthStatus();

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

    it('should handle localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      await service.checkAuthStatus();

      expect(service.isAuthenticated).toBe(false);
      // localStorage throwing errors is logged at ERROR level by checkAuthStatus
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error checking auth status',
        expect.any(Error),
      );
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
      vi.mocked(httpClient.get).mockReturnValue(of(mockUserProfile));

      const result$ = service.handleOAuthCallback(mockTMITokenResponse);

      const result = await result$.toPromise();

      // Wait for async token storage to complete
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
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'auth_token',
        expect.stringContaining(':'),
      );
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
        access_token:
          'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE2NDA5OTg4MDB9.abc123',
        expires_in: 3600,
        token_type: 'Bearer',
        refresh_token: 'refresh-token',
      };
      httpClient.post.mockReturnValue(of(tokenResponse));

      // Mock GET /users/me call that happens after successful token exchange
      const johnUserProfile: UserProfile = {
        provider: 'tmi',
        provider_id: '1234567890',
        display_name: 'John Doe',
        email: 'john@example.com',
        groups: null,
      };
      vi.mocked(httpClient.get).mockReturnValue(of(johnUserProfile));

      const result$ = service.handleOAuthCallback(codeResponse);

      result$.subscribe(result => {
        expect(result).toBe(true);
        expect(service.isAuthenticated).toBe(true);
        expect(service.userProfile?.email).toBe('john@example.com');
        expect(router.navigateByUrl).not.toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
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
      const originalState = 'test-state-12345';
      const base64State = btoa(originalState); // Base64 encode the state

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_state') return originalState;
        if (key === 'oauth_provider') return 'google';
        return null;
      });

      const responseWithBase64State: OAuthResponse = {
        access_token: mockJwtToken.token, // Use valid mock JWT token
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        state: base64State, // TMI server returns Base64 encoded state
      };

      router.navigate = vi.fn().mockResolvedValue(true);

      // Mock GET /me call that happens after successful token response
      vi.mocked(httpClient.get).mockReturnValue(of(mockUserProfile));

      const result$ = service.handleOAuthCallback(responseWithBase64State);

      const result = await result$.toPromise();

      // Wait for async token storage to complete
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
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'auth_token',
        expect.stringContaining(':'),
      );
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
    it('should store and retrieve tokens correctly', async () => {
      // Manually set up authenticated state
      const testEmail = 'demo.user@example.com';
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      const token: JwtToken = {
        token: 'mock.jwt.token',
        expiresIn: 3600,
        expiresAt,
      };

      const userProfile: UserProfile = {
        provider: 'tmi',
        provider_id: testEmail,
        display_name: 'Demo User',
        email: testEmail,
        groups: null,
      };

      service.storeToken(token);
      await service.storeUserProfile(userProfile);
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(userProfile);

      // Wait for the next tick to allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(service.isAuthenticated).toBe(true);
      expect(service.userEmail).toBe(testEmail);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'auth_token',
        expect.stringContaining(':'),
      );
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
      // Set the expired token in the service cache
      service['jwtTokenSubject'].next(mockExpiredToken);

      const isValid = service['isTokenValid']();

      expect(isValid).toBe(false);
    });

    it('should not detect token expiration for a valid token', () => {
      // Set the token in the service cache (isTokenValid checks the cached token)
      service['jwtTokenSubject'].next(mockJwtToken);

      const isValid = service['isTokenValid']();

      expect(isValid).toBe(true);
    });

    it('should logout and clear local storage', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Set the token in the service cache (logout uses cached token for Authorization header)
      service['jwtTokenSubject'].next(mockJwtToken);

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${environment.apiUrl}/me/logout`,
        null,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockJwtToken.token}`,
          },
        },
      );
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

      // Set the token in the service cache (logout uses cached token for Authorization header)
      service['jwtTokenSubject'].next(mockJwtToken);

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${environment.apiUrl}/me/logout`,
        null,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockJwtToken.token}`,
          },
        },
      );
    });

    it('should exclude Authorization header when no token is available', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock no stored token
      localStorageMock.getItem.mockReturnValue(null);

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${environment.apiUrl}/me/logout`,
        null,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('should handle malformed token gracefully', () => {
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Mock malformed token
      localStorageMock.getItem.mockReturnValue('invalid-json');

      // Mock the HTTP post method for logout
      vi.mocked(httpClient.post).mockReturnValue(of({}));

      service.logout();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${environment.apiUrl}/me/logout`,
        null,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('should skip server logout for test users', () => {
      const testUserProfile = { ...mockUserProfile, email: 'user1@example.com' };
      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(testUserProfile);

      service.logout();

      expect(httpClient.post).not.toHaveBeenCalled();
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

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

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

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return JSON.stringify(mockJwtToken);
        return null;
      });

      vi.mocked(httpClient.post).mockReturnValue(of({ success: true }));

      service.logout();

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
        'demo.user@example.com',
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
      expect(loggerService.debugComponent).not.toHaveBeenCalledWith(
        'Auth',
        'Skipping server logout for test user',
      );
    });

    it('should clear provider cache on logout', () => {
      // Set up initial state with cached providers
      service['cachedProviders'] = mockProvidersResponse.providers;
      service['providersCacheTime'] = Date.now();

      service['isAuthenticatedSubject'].next(true);
      service['userProfileSubject'].next(mockUserProfile);

      // Call logout
      service.logout();

      // Verify provider cache is cleared
      expect(service['cachedOAuthProviders']).toBeNull();
      expect(service['cachedSAMLProviders']).toBeNull();
      expect(service['providersCacheTime']).toBe(0);

      // Verify auth data is also cleared
      expect(service.isAuthenticated).toBe(false);
      expect(service.userProfile).toBeNull();
    });
  }); /* End of Enhanced Logout Functionality describe block */

  describe('Token Refresh Functionality', () => {
    describe('refreshToken()', () => {
      it('should successfully refresh token with valid refresh token', () => {
        const currentToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'valid-refresh-token',
        };

        // Set token in service cache (refreshToken() uses cached token)
        service['jwtTokenSubject'].next(currentToken);

        const refreshResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
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

        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/oauth2/refresh`, {
          refresh_token: 'valid-refresh-token',
        });
      });

      it('should handle refresh token failure and clear auth data', () => {
        const currentToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'expired-refresh-token',
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(currentToken));
        // Also set the in-memory cache so getStoredToken() returns this token
        service['jwtTokenSubject'].next(currentToken);

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
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_profile');
          },
        });
      });

      it('should return error when no refresh token is available', () => {
        const tokenWithoutRefresh: JwtToken = {
          ...mockJwtToken,
          refreshToken: undefined,
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(tokenWithoutRefresh));

        const result$ = service.refreshToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('No refresh token available');
            expect(httpClient.post).not.toHaveBeenCalled();
          },
        });
      });

      it('should return error when no token is stored', () => {
        localStorageMock.getItem.mockReturnValue(null);

        const result$ = service.refreshToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('No refresh token available');
            expect(httpClient.post).not.toHaveBeenCalled();
          },
        });
      });

      it('should handle network errors during refresh', () => {
        const currentToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'valid-refresh-token',
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(currentToken));
        // Also set the in-memory cache so getStoredToken() returns this token
        service['jwtTokenSubject'].next(currentToken);

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

    describe('shouldRefreshToken()', () => {
      it('should return true when token expires within 1 minute', () => {
        const soonToExpireToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 30000), // 30 seconds from now
        };

        // Set token in service cache
        service['jwtTokenSubject'].next(soonToExpireToken);

        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(true);
      });

      it('should return false when token has plenty of time left', () => {
        const validToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 1800000), // 30 minutes from now
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(validToken));

        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(false);
      });

      it('should return false when no refresh token is available', () => {
        const tokenWithoutRefresh: JwtToken = {
          ...mockJwtToken,
          refreshToken: undefined,
          expiresAt: new Date(Date.now() + 30000),
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
          expiresAt: new Date(Date.now() + 60000), // exactly 1 minute
        };

        // Set token in service cache
        service['jwtTokenSubject'].next(exactBoundaryToken);

        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(true);
      });

      it('should handle already expired tokens', () => {
        const expiredToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        };

        // Set token in service cache
        service['jwtTokenSubject'].next(expiredToken);

        const shouldRefresh = service['shouldRefreshToken']();
        expect(shouldRefresh).toBe(true);
      });
    });

    describe('getValidToken()', () => {
      it('should return existing token when valid and no refresh needed', () => {
        const validToken: JwtToken = {
          ...mockJwtToken,
          expiresAt: new Date(Date.now() + 1800000), // 30 minutes from now
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(validToken));
        // Also set the in-memory cache so getStoredToken() returns this token
        service['jwtTokenSubject'].next(validToken);

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
          expiresAt: new Date(Date.now() + 30000), // 30 seconds from now
        };

        const refreshResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        };

        // Set token in service cache
        service['jwtTokenSubject'].next(soonToExpireToken);
        vi.mocked(httpClient.post).mockReturnValue(of(refreshResponse));

        const storeTokenSpy = vi.spyOn(service as any, 'storeToken');

        const result$ = service.getValidToken();

        result$.subscribe(token => {
          expect(token.token).toBe('new-access-token');
          expect(token.refreshToken).toBe('new-refresh-token');
          expect(storeTokenSpy).toHaveBeenCalledWith(token);
        });

        expect(httpClient.post).toHaveBeenCalledWith(`${environment.apiUrl}/oauth2/refresh`, {
          refresh_token: 'refresh-token',
        });
      });

      it('should return error when no token is available', () => {
        localStorageMock.getItem.mockReturnValue(null);

        const result$ = service.getValidToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('No token available');
          },
        });
      });

      it('should return error when token is expired and no refresh token available', () => {
        const expiredTokenWithoutRefresh: JwtToken = {
          ...mockJwtToken,
          refreshToken: undefined,
          expiresAt: new Date(Date.now() - 1000),
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredTokenWithoutRefresh));
        // Also set the in-memory cache so getStoredToken() returns this token
        service['jwtTokenSubject'].next(expiredTokenWithoutRefresh);

        const result$ = service.getValidToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('Token expired and no refresh token available');
            expect(service.isAuthenticated).toBe(false);
            expect(service.userProfile).toBeNull();
          },
        });
      });

      it('should handle refresh failure and clear auth data', () => {
        const soonToExpireToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'invalid-refresh-token',
          expiresAt: new Date(Date.now() + 30000),
        };

        localStorageMock.getItem.mockReturnValue(JSON.stringify(soonToExpireToken));
        // Also set the in-memory cache so getStoredToken() returns this token
        service['jwtTokenSubject'].next(soonToExpireToken);

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

      it('should handle malformed stored token', () => {
        localStorageMock.getItem.mockReturnValue('invalid-json');

        const result$ = service.getValidToken();

        result$.subscribe({
          next: () => {},
          error: err => {
            expect(err.message).toBe('No token available');
          },
        });
      });
    });

    describe('Token Lifecycle Integration', () => {
      it('should handle complete token refresh cycle', () => {
        // Start with a token that needs refresh
        const expiringSoonToken: JwtToken = {
          ...mockJwtToken,
          refreshToken: 'refresh-token-123',
          expiresAt: new Date(Date.now() + 30000),
        };

        const refreshResponse = {
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        };

        // Set token in service cache
        service['jwtTokenSubject'].next(expiringSoonToken);
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
          expiresAt: new Date(Date.now() + 3600000),
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
