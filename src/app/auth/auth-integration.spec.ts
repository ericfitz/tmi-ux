/*
 * unit test for auth integration with tmi server
 *
 * additional context:
 *     run this test only: pnpm run test "src/app/auth/auth-integration.spec.ts"
 *     unit tests only use vitest syntax; no jasmine or jest
 *     do not disable or skip failing tests, ask the user what to do
 */

import '@angular/compiler';

import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of } from 'rxjs';

import { AuthService } from './services/auth.service';
import { JwtInterceptor } from './interceptors/jwt.interceptor';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { LoggerService } from '../core/services/logger.service';
import { environment } from '../../environments/environment';

// Mock interfaces for type safety
interface MockLoggerService {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  logInit: ReturnType<typeof vi.fn>;
}

interface MockRouter {
  navigate: ReturnType<typeof vi.fn<[string[]], Promise<boolean>>>;
  url: string;
}

interface MockStorage {
  getItem: ReturnType<typeof vi.fn<[string], string | null>>;
  setItem: ReturnType<typeof vi.fn<[string, string], void>>;
  removeItem: ReturnType<typeof vi.fn<[string], void>>;
  clear: ReturnType<typeof vi.fn<[], void>>;
}

/**
 * Integration tests for authentication components
 * Tests that all authentication pieces work together correctly
 */
describe('Authentication Integration', () => {
  let authService: AuthService;
  let router: MockRouter;
  let logger: MockLoggerService;
  let httpClient: HttpClient;
  let localStorageMock: MockStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks for dependencies
    logger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      logInit: vi.fn(),
    };

    router = {
      navigate: vi.fn<[string[]], Promise<boolean>>().mockResolvedValue(true),
      url: '/test',
    };

    httpClient = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as HttpClient;

    localStorageMock = {
      getItem: vi.fn<[string], string | null>().mockReturnValue(null),
      setItem: vi.fn<[string, string], void>(),
      removeItem: vi.fn<[string], void>(),
      clear: vi.fn<[], void>(),
    };

    // Mock global localStorage
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });

    // Create the service with mocked dependencies
    authService = new AuthService(
      router as unknown as Router,
      httpClient,
      logger as unknown as LoggerService,
    );
  });

  describe('AuthService', () => {
    it('should be created', () => {
      expect(authService).toBeTruthy();
      expect(logger.info).toHaveBeenCalledWith('Auth Service initialized');
    });

    it('should initialize with unauthenticated state', () => {
      expect(authService.isAuthenticated).toBe(false);
      expect(authService.userProfile).toBeNull();
      expect(authService.username).toBe('');
      expect(authService.userEmail).toBe('');
    });

    it('should have OAuth configuration from environment', () => {
      expect(environment.oauth?.google?.clientId).toBeDefined();
      expect(environment.oauth?.google?.redirectUri).toBeDefined();
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

  describe('Environment Configuration', () => {
    it('should have proper development configuration', () => {
      expect(environment.production).toBe(false);
      expect(environment.logLevel).toBe('DEBUG');
      expect(environment.apiUrl).toBe('http://localhost:8080');
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
      expect(router.navigate).toHaveBeenCalledWith(['/tm']);
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
});
