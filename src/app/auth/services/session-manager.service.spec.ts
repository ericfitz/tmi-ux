// This project uses vitest for all unit tests, with native vitest syntax
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.

import '@angular/compiler';

import { SessionManagerService } from './session-manager.service';
import { of, throwError, Subject } from 'rxjs';
import { JwtToken } from '../models/auth.models';
import { vi, expect, beforeEach, describe, it } from 'vitest';

describe('SessionManagerService', () => {
  let service: SessionManagerService;
  let mockAuthService: any;
  let mockLogger: any;
  let mockDialog: any;
  let mockNgZone: any;
  let mockActivityTracker: any;
  let mockNotificationService: any;
  let mockIsAuthenticated$: Subject<boolean>;

  beforeEach(() => {
    mockAuthService = {
      getStoredToken: vi.fn(),
      getValidToken: vi.fn(),
      refreshToken: vi
        .fn()
        .mockReturnValue(of({ token: 'mock', expiresAt: new Date(), expiresIn: 0 })),
      storeToken: vi.fn(),
      createLocalTokenWithExpiry: vi.fn(),
      logout: vi.fn(),
      setSessionManager: vi.fn(),
      isAuthenticated: false,
      userProfile: null,
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockNgZone = {
      run: vi.fn((callback: () => any) => callback()),
      runOutsideAngular: vi.fn((callback: () => any) => callback()),
    };

    mockActivityTracker = {
      isUserActive: vi.fn().mockReturnValue(false), // Default to inactive for existing tests
      getTimeSinceLastActivity: vi.fn().mockReturnValue(0),
      markActive: vi.fn(),
      lastActivity$: of(new Date()),
    };

    mockNotificationService = {
      showWarning: vi.fn(),
      showSuccess: vi.fn(),
      showSaveError: vi.fn(),
      showConnectionError: vi.fn(),
      dismissAll: vi.fn(),
    };

    mockIsAuthenticated$ = new Subject<boolean>();
    mockAuthService.isAuthenticated$ = mockIsAuthenticated$.asObservable();

    // Create service directly without TestBed
    service = new SessionManagerService(
      mockAuthService,
      mockLogger,
      mockNgZone,
      mockDialog,
      mockActivityTracker,
      mockNotificationService,
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should register with AuthService on initialization', () => {
    expect(mockAuthService.setSessionManager).toHaveBeenCalledWith(service);
  });

  it('should start timers when user becomes authenticated', () => {
    const mockToken: JwtToken = {
      token: 'mock.jwt.token',
      expiresAt: new Date(Date.now() + 600000), // 10 minutes from now
      expiresIn: 600,
    };
    mockAuthService.getStoredToken.mockReturnValue(mockToken);

    mockIsAuthenticated$.next(true);

    expect(mockAuthService.getStoredToken).toHaveBeenCalled();
  });

  it('should logout immediately if token is already expired', () => {
    const mockToken: JwtToken = {
      token: 'mock.jwt.token',
      expiresAt: new Date(Date.now() - 1000), // 1 second ago (expired)
      expiresIn: 0,
    };
    mockAuthService.getStoredToken.mockReturnValue(mockToken);

    mockIsAuthenticated$.next(true);

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should handle extend session for OAuth users', () => {
    const mockToken: JwtToken = {
      token: 'mock.jwt.token',
      expiresAt: new Date(Date.now() + 600000),
      expiresIn: 600,
    };
    mockAuthService.refreshToken.mockReturnValue(of(mockToken));
    mockAuthService.isTestUser = false;

    const mockDialogRef = {
      afterClosed: vi.fn().mockReturnValue(of('extend')),
      close: vi.fn(),
    };
    (service as any).warningDialog = mockDialogRef;

    // Call the private method using type assertion
    (service as any).handleExtendSession();

    expect(mockAuthService.refreshToken).toHaveBeenCalled();
    expect(mockAuthService.storeToken).toHaveBeenCalledWith(mockToken);
    expect(mockDialogRef.close).toHaveBeenCalledWith('extend');
  });

  it('should logout if extend session fails', () => {
    mockAuthService.refreshToken.mockReturnValue(
      throwError(() => new Error('Token refresh failed')),
    );

    // Call the private method
    (service as any).handleExtendSession();

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should reset timers when onTokenRefreshed is called', () => {
    const mockToken: JwtToken = {
      token: 'mock.jwt.token',
      expiresAt: new Date(Date.now() + 600000),
      expiresIn: 600,
    };
    mockAuthService.getStoredToken.mockReturnValue(mockToken);
    mockAuthService.isAuthenticated = true;

    service.onTokenRefreshed();

    expect(mockAuthService.getStoredToken).toHaveBeenCalled();
  });

  it('should handle session timeout', () => {
    // Call the private method
    (service as any).handleSessionTimeout();

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should close warning dialog when timers are stopped', () => {
    const mockDialogRef = {
      afterClosed: vi.fn().mockReturnValue(of('extend')),
      close: vi.fn(),
    };
    (service as any).warningDialog = mockDialogRef;

    service.stopExpiryTimers();

    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should not start timers if no token is available', () => {
    mockAuthService.getStoredToken.mockReturnValue(null);

    mockIsAuthenticated$.next(true);

    expect(mockLogger.debugComponent).toHaveBeenCalledWith(
      'SessionManager',
      'No token found, cannot start expiry timers',
    );
  });

  it('should show warning dialog when token expires soon', () => {
    const mockToken: JwtToken = {
      token: 'mock.jwt.token',
      expiresAt: new Date(Date.now() + 250000), // 4 minutes from now (past warning threshold)
      expiresIn: 250,
    };
    mockAuthService.getStoredToken.mockReturnValue(mockToken);

    const mockDialogRef = {
      afterClosed: vi.fn().mockReturnValue(of('extend')),
      close: vi.fn(),
    };
    mockDialog.open.mockReturnValue(mockDialogRef);

    mockIsAuthenticated$.next(true);

    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('should handle dialog close with expired result', () => {
    const mockToken: JwtToken = {
      token: 'mock.jwt.token',
      expiresAt: new Date(Date.now() + 250000),
      expiresIn: 250,
    };
    mockAuthService.getStoredToken.mockReturnValue(mockToken);

    const mockDialogRef = {
      afterClosed: vi.fn().mockReturnValue(of('expired')),
      close: vi.fn(),
    };
    mockDialog.open.mockReturnValue(mockDialogRef);

    mockIsAuthenticated$.next(true);

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  describe('Activity-based token refresh', () => {
    it('should not show warning dialog if user is active when warning time is reached', () => {
      mockActivityTracker.isUserActive.mockReturnValue(true);

      const mockToken: JwtToken = {
        token: 'mock.jwt.token',
        expiresAt: new Date(Date.now() + 250000), // 4 minutes from now
        expiresIn: 250,
      };
      mockAuthService.getStoredToken.mockReturnValue(mockToken);

      mockIsAuthenticated$.next(true);

      // Warning dialog should not be opened since user is active
      expect(mockDialog.open).not.toHaveBeenCalled();
    });

    it('should show warning dialog if user is inactive when warning time is reached', () => {
      mockActivityTracker.isUserActive.mockReturnValue(false);

      const mockToken: JwtToken = {
        token: 'mock.jwt.token',
        expiresAt: new Date(Date.now() + 250000), // 4 minutes from now
        expiresIn: 250,
      };
      mockAuthService.getStoredToken.mockReturnValue(mockToken);

      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of('extend')),
        close: vi.fn(),
      };
      mockDialog.open.mockReturnValue(mockDialogRef);

      mockIsAuthenticated$.next(true);

      // Warning dialog should be opened since user is inactive
      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should proactively refresh token when user is active and token expiring soon', () => {
      mockActivityTracker.isUserActive.mockReturnValue(true);

      const currentToken: JwtToken = {
        token: 'mock.jwt.token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        expiresIn: 600,
      };
      const newToken: JwtToken = {
        token: 'new.jwt.token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes from now
        expiresIn: 3600,
      };

      mockAuthService.getStoredToken.mockReturnValue(currentToken);

      // Ensure refreshToken returns an observable before the test calls checkActivityAndRefreshIfNeeded
      const refreshSpy = vi.spyOn(mockAuthService, 'refreshToken').mockReturnValue(of(newToken));

      // Trigger activity check
      (service as any).checkActivityAndRefreshIfNeeded();

      expect(refreshSpy).toHaveBeenCalled();
      expect(mockAuthService.storeToken).toHaveBeenCalledWith(newToken);
    });

    it('should not proactively refresh token when user is inactive', () => {
      mockActivityTracker.isUserActive.mockReturnValue(false);

      const mockToken: JwtToken = {
        token: 'mock.jwt.token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        expiresIn: 600,
      };
      mockAuthService.getStoredToken.mockReturnValue(mockToken);

      // Trigger activity check
      (service as any).checkActivityAndRefreshIfNeeded();

      // Should not refresh since user is inactive
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
    });

    it('should not proactively refresh token when token has plenty of time left', () => {
      mockActivityTracker.isUserActive.mockReturnValue(true);

      const mockToken: JwtToken = {
        token: 'mock.jwt.token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        expiresIn: 1800,
      };
      mockAuthService.getStoredToken.mockReturnValue(mockToken);

      // Trigger activity check
      (service as any).checkActivityAndRefreshIfNeeded();

      // Should not refresh since token still has 30 minutes (> 15 minute threshold)
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
    });

    it('should not force logout if proactive refresh fails', () => {
      mockActivityTracker.isUserActive.mockReturnValue(true);

      const mockToken: JwtToken = {
        token: 'mock.jwt.token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        expiresIn: 600,
      };
      mockAuthService.getStoredToken.mockReturnValue(mockToken);
      mockAuthService.refreshToken.mockReturnValue(throwError(() => new Error('Refresh failed')));

      // Trigger activity check
      (service as any).checkActivityAndRefreshIfNeeded();

      // Should not logout on proactive refresh failure
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should show warning notification if proactive refresh fails', () => {
      mockActivityTracker.isUserActive.mockReturnValue(true);

      const mockToken: JwtToken = {
        token: 'mock.jwt.token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        expiresIn: 600,
      };
      mockAuthService.getStoredToken.mockReturnValue(mockToken);
      mockAuthService.refreshToken.mockReturnValue(throwError(() => new Error('Refresh failed')));

      // Trigger activity check
      (service as any).checkActivityAndRefreshIfNeeded();

      // Should show warning notification on proactive refresh failure
      expect(mockNotificationService.showWarning).toHaveBeenCalledWith(
        'Session refresh failed. Please save your work to avoid data loss.',
        8000,
      );
    });
  });
});
