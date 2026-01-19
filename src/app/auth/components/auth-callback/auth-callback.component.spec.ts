// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.

import '@angular/compiler';

import { AuthCallbackComponent } from './auth-callback.component';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError, BehaviorSubject } from 'rxjs';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../testing/mocks';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Params } from '@angular/router';

describe('AuthCallbackComponent', () => {
  let component: AuthCallbackComponent;
  let mockAuthService: Partial<AuthService>;
  let mockRouter: MockRouter;
  let mockLoggerService: MockLoggerService;
  let mockActivatedRoute: Partial<ActivatedRoute>;
  let queryParamsSubject: BehaviorSubject<Params>;
  let fragmentSubject: BehaviorSubject<string | null>;
  let mockSessionStorage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks
    mockRouter = createTypedMockRouter();
    mockLoggerService = createTypedMockLoggerService();

    // Create query params and fragment subjects
    queryParamsSubject = new BehaviorSubject<Params>({});
    fragmentSubject = new BehaviorSubject<string | null>(null);

    mockActivatedRoute = {
      queryParams: queryParamsSubject.asObservable(),
      fragment: fragmentSubject.asObservable(),
    };

    // Create mock AuthService
    mockAuthService = {
      initiateLogin: vi.fn(),
      initiateSAMLLogin: vi.fn(),
      handleOAuthCallback: vi.fn().mockReturnValue(of(true)),
    };

    // Mock sessionStorage
    mockSessionStorage = {};
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
        clear: vi.fn(() => {
          mockSessionStorage = {};
        }),
      },
      configurable: true,
      writable: true,
    });

    // Mock window.history.replaceState
    Object.defineProperty(global.window, 'history', {
      value: {
        replaceState: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(global, 'document', {
      value: {
        title: 'Test',
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(global.window, 'location', {
      value: {
        pathname: '/oauth2/callback',
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createComponent(): AuthCallbackComponent {
    return new AuthCallbackComponent(
      mockAuthService as AuthService,
      mockActivatedRoute as ActivatedRoute,
      mockRouter as any,
      mockLoggerService as any,
    );
  }

  describe('Component Creation', () => {
    it('should create', () => {
      component = createComponent();
      expect(component).toBeTruthy();
    });

    it('should initialize with null providerName', () => {
      component = createComponent();
      expect(component.providerName).toBeNull();
    });
  });

  describe('Mode 1: Initiating OAuth Login', () => {
    it('should initiate OAuth login when action=login with oauth provider', () => {
      queryParamsSubject.next({
        action: 'login',
        providerId: 'google',
        providerName: 'Google',
        providerType: 'oauth',
        returnUrl: '/dashboard',
      });

      component = createComponent();
      component.ngOnInit();

      expect(component.providerName).toBe('Google');
      expect(mockAuthService.initiateLogin).toHaveBeenCalledWith('google', '/dashboard');
      expect(mockAuthService.initiateSAMLLogin).not.toHaveBeenCalled();
    });

    it('should initiate SAML login when action=login with saml provider', () => {
      queryParamsSubject.next({
        action: 'login',
        providerId: 'okta',
        providerName: 'Okta SSO',
        providerType: 'saml',
        returnUrl: '/tm/list',
      });

      component = createComponent();
      component.ngOnInit();

      expect(component.providerName).toBe('Okta SSO');
      expect(mockAuthService.initiateSAMLLogin).toHaveBeenCalledWith('okta', '/tm/list');
      expect(mockAuthService.initiateLogin).not.toHaveBeenCalled();
    });

    it('should handle missing returnUrl by passing undefined', () => {
      queryParamsSubject.next({
        action: 'login',
        providerId: 'google',
        providerName: 'Google',
        providerType: 'oauth',
      });

      component = createComponent();
      component.ngOnInit();

      expect(mockAuthService.initiateLogin).toHaveBeenCalledWith('google', undefined);
    });
  });

  describe('Mode 2: Processing OAuth Callback with Code', () => {
    it('should handle OAuth callback with code and state', () => {
      queryParamsSubject.next({
        code: 'auth-code-123',
        state: 'state-value',
      });

      component = createComponent();
      component.ngOnInit();

      expect(mockAuthService.handleOAuthCallback).toHaveBeenCalledWith({
        code: 'auth-code-123',
        state: 'state-value',
      });
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        document.title,
        window.location.pathname,
      );
    });

    it('should handle OAuth error in query params', () => {
      queryParamsSubject.next({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'auth_error',
        JSON.stringify({
          code: 'access_denied',
          message: 'User denied access',
          retryable: true,
        }),
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should use default error message when error_description is missing', () => {
      queryParamsSubject.next({
        error: 'server_error',
      });

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'auth_error',
        JSON.stringify({
          code: 'server_error',
          message: 'Authentication failed',
          retryable: true,
        }),
      );
    });

    it('should handle failed OAuth callback', () => {
      mockAuthService.handleOAuthCallback = vi.fn().mockReturnValue(of(false));

      queryParamsSubject.next({
        code: 'auth-code-123',
        state: 'state-value',
      });

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'auth_error',
        JSON.stringify({
          code: 'oauth_failed',
          message: 'login.oauthFailed',
          retryable: true,
        }),
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should handle OAuth callback error', () => {
      const error = new Error('Token exchange failed');
      mockAuthService.handleOAuthCallback = vi.fn().mockReturnValue(throwError(() => error));

      queryParamsSubject.next({
        code: 'auth-code-123',
        state: 'state-value',
      });

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'auth_error',
        JSON.stringify({
          code: 'oauth_error',
          message: 'Token exchange failed',
          retryable: true,
        }),
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should use default error message for non-Error exceptions', () => {
      mockAuthService.handleOAuthCallback = vi
        .fn()
        .mockReturnValue(throwError(() => 'string error'));

      queryParamsSubject.next({
        code: 'auth-code-123',
        state: 'state-value',
      });

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'auth_error',
        JSON.stringify({
          code: 'oauth_error',
          message: 'login.unexpectedError',
          retryable: true,
        }),
      );
    });
  });

  describe('Mode 3: Processing URL Fragment (Legacy Token Flow)', () => {
    it('should handle access_token in URL fragment', () => {
      queryParamsSubject.next({});
      fragmentSubject.next(
        'access_token=jwt-token-123&refresh_token=refresh-123&expires_in=3600&state=state-value',
      );

      component = createComponent();
      component.ngOnInit();

      expect(mockAuthService.handleOAuthCallback).toHaveBeenCalledWith({
        access_token: 'jwt-token-123',
        refresh_token: 'refresh-123',
        expires_in: 3600,
        state: 'state-value',
      });
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    it('should handle code and state in URL fragment', () => {
      queryParamsSubject.next({});
      fragmentSubject.next('code=auth-code-456&state=state-value');

      component = createComponent();
      component.ngOnInit();

      expect(mockAuthService.handleOAuthCallback).toHaveBeenCalledWith({
        code: 'auth-code-456',
        state: 'state-value',
      });
    });

    it('should handle error in URL fragment', () => {
      queryParamsSubject.next({});
      fragmentSubject.next(
        'error=invalid_request&error_description=Missing%20required%20parameter',
      );

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'auth_error',
        JSON.stringify({
          code: 'invalid_request',
          message: 'Missing required parameter',
          retryable: true,
        }),
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should redirect to login when no valid params found', () => {
      queryParamsSubject.next({});
      fragmentSubject.next(null);

      component = createComponent();
      component.ngOnInit();

      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'AuthCallbackComponent: No valid callback parameters found, redirecting to login',
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should redirect to login when fragment has no recognized params', () => {
      queryParamsSubject.next({});
      fragmentSubject.next('unknown_param=value');

      component = createComponent();
      component.ngOnInit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Error Handling', () => {
    it('should log OAuth callback errors', () => {
      queryParamsSubject.next({
        error: 'server_error',
        error_description: 'Internal server error',
      });

      component = createComponent();
      component.ngOnInit();

      expect(mockLoggerService.error).toHaveBeenCalledWith('OAuth callback error:', {
        code: 'server_error',
        message: 'Internal server error',
        retryable: true,
      });
    });

    it('should store error in sessionStorage and redirect to login', () => {
      queryParamsSubject.next({
        error: 'test_error',
        error_description: 'Test error message',
      });

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith('auth_error', expect.any(String));
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Fragment Parsing', () => {
    it('should parse fragment with multiple parameters', () => {
      queryParamsSubject.next({});
      fragmentSubject.next('access_token=token123&expires_in=3600&token_type=Bearer');

      component = createComponent();
      component.ngOnInit();

      expect(mockAuthService.handleOAuthCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: 'token123',
          expires_in: 3600,
        }),
      );
    });

    it('should handle URL-encoded values in fragment', () => {
      queryParamsSubject.next({});
      fragmentSubject.next('error=invalid_scope&error_description=Invalid%20scope%20requested');

      component = createComponent();
      component.ngOnInit();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'auth_error',
        expect.stringContaining('Invalid scope requested'),
      );
    });

    it('should handle empty fragment', () => {
      queryParamsSubject.next({});
      fragmentSubject.next('');

      component = createComponent();
      component.ngOnInit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
