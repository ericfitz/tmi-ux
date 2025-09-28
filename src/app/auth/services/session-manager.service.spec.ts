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
  let mockIsAuthenticated$: Subject<boolean>;

  beforeEach(() => {
    mockAuthService = {
      getStoredToken: vi.fn(),
      getValidToken: vi.fn(),
      extendTestUserSession: vi.fn(),
      logout: vi.fn(),
      setSessionManager: vi.fn(),
      isTestUser: false,
      isAuthenticated: false,
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

    mockIsAuthenticated$ = new Subject<boolean>();
    mockAuthService.isAuthenticated$ = mockIsAuthenticated$.asObservable();

    // Create service directly without TestBed
    service = new SessionManagerService(mockAuthService, mockLogger, mockNgZone, mockDialog);
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
    mockAuthService.getValidToken.mockReturnValue(of(mockToken));
    mockAuthService.isTestUser = false;

    // Call the private method using type assertion
    (service as any).handleExtendSession();

    expect(mockAuthService.getValidToken).toHaveBeenCalled();
  });

  it('should handle extend session for test users', () => {
    mockAuthService.isTestUser = true;
    mockAuthService.extendTestUserSession.mockReturnValue(of(true));

    // Call the private method
    (service as any).handleExtendSession();

    expect(mockAuthService.extendTestUserSession).toHaveBeenCalled();
  });

  it('should logout if extend session fails', () => {
    mockAuthService.isTestUser = false;
    mockAuthService.getValidToken.mockReturnValue(throwError(() => new Error('Token refresh failed')));

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
      'No token found, cannot start expiry timers'
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
});