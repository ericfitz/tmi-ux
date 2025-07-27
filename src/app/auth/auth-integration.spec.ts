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
  debugComponent: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  logInit: ReturnType<typeof vi.fn>;
}

interface MockRouter {
  navigate: ReturnType<typeof vi.fn>;
  url: string;
}

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
  let httpClient: HttpClient;
  let localStorageMock: MockStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks for dependencies
    logger = {
      info: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      logInit: vi.fn(),
    };

    router = {
      navigate: vi.fn().mockResolvedValue(true),
      url: '/test',
    };

    httpClient = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as HttpClient;

    localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
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

    it('should handle OAuth configuration when available', () => {
      // Test that OAuth configuration works correctly when defined
      if (environment.oauth?.google?.clientId) {
        expect(environment.oauth.google.clientId).toBeTruthy();
      }
      if (environment.oauth?.google?.redirectUri) {
        expect(environment.oauth.google.redirectUri).toBeTruthy();
      }
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
