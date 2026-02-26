// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NgZone } from '@angular/core';
import { Router } from '@angular/router';

import { TokenValidityGuardService } from './token-validity-guard.service';
import { AuthService } from './auth.service';
import { LoggerService } from '../../core/services/logger.service';

describe('TokenValidityGuardService', () => {
  let service: TokenValidityGuardService;
  let mockAuthService: {
    validateAndUpdateAuthState: ReturnType<typeof vi.fn>;
    isAuthenticated: boolean;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockNgZone: {
    run: ReturnType<typeof vi.fn>;
    runOutsideAngular: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockAuthService = {
      validateAndUpdateAuthState: vi.fn(),
      isAuthenticated: true,
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    // NgZone mock that immediately executes callbacks
    mockNgZone = {
      run: vi.fn((fn: () => void) => fn()),
      runOutsideAngular: vi.fn((fn: () => void) => fn()),
    };

    service = new TokenValidityGuardService(
      mockAuthService as unknown as AuthService,
      mockLogger as unknown as LoggerService,
      mockRouter as unknown as Router,
      mockNgZone as unknown as NgZone,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });

  describe('startMonitoring', () => {
    it('should set up all three monitoring layers', () => {
      const addEventSpy = vi.spyOn(document, 'addEventListener');
      const windowAddEventSpy = vi.spyOn(window, 'addEventListener');

      service.startMonitoring();

      expect(addEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(windowAddEventSpy).toHaveBeenCalledWith('storage', expect.any(Function));
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'TokenValidityGuard',
        'Starting token validity monitoring',
      );

      addEventSpy.mockRestore();
      windowAddEventSpy.mockRestore();
    });
  });

  describe('stopMonitoring', () => {
    it('should clean up all event listeners and intervals', () => {
      const removeEventSpy = vi.spyOn(document, 'removeEventListener');
      const windowRemoveEventSpy = vi.spyOn(window, 'removeEventListener');

      service.startMonitoring();
      service.stopMonitoring();

      expect(removeEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(windowRemoveEventSpy).toHaveBeenCalledWith('storage', expect.any(Function));

      removeEventSpy.mockRestore();
      windowRemoveEventSpy.mockRestore();
    });

    it('should handle being called without startMonitoring', () => {
      // Should not throw
      expect(() => service.stopMonitoring()).not.toThrow();
    });
  });

  describe('Layer 1: Visibility Change', () => {
    it('should validate token when tab becomes visible', () => {
      service.startMonitoring();

      // Simulate tab becoming visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockAuthService.validateAndUpdateAuthState).toHaveBeenCalled();
    });

    it('should not validate when tab becomes hidden', () => {
      service.startMonitoring();

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // validateAndUpdateAuthState should NOT be called for 'hidden' state
      expect(mockAuthService.validateAndUpdateAuthState).not.toHaveBeenCalled();
    });

    it('should redirect to home when token is expired on tab visible', () => {
      mockAuthService.isAuthenticated = false; // Token expired

      service.startMonitoring();

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
      expect(mockLogger.warn).toHaveBeenCalledWith('Token expired, redirecting to home page');
    });

    it('should not redirect when token is still valid on tab visible', () => {
      mockAuthService.isAuthenticated = true; // Token valid

      service.startMonitoring();

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Layer 2: Heartbeat Drift Detection', () => {
    it('should detect timer drift when browser was backgrounded', () => {
      service.startMonitoring();

      // Simulate what happens when the browser backgrounds the tab:
      // The interval callback is delayed, but when it finally fires,
      // Date.now() shows much more time has passed than expected.
      // We simulate this by setting lastHeartbeat far in the past before
      // the next interval callback fires.
      (service as any).lastHeartbeat = Date.now() - 130000;

      // Now advance to trigger the next heartbeat callback
      vi.advanceTimersByTime(60000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Timer drift detected - browser was likely backgrounded',
        expect.objectContaining({
          elapsed: expect.any(String),
          expected: expect.any(String),
        }),
      );
      expect(mockAuthService.validateAndUpdateAuthState).toHaveBeenCalled();
    });

    it('should not trigger drift detection during normal operation', () => {
      service.startMonitoring();

      // Advance by exactly one heartbeat interval (no drift)
      vi.advanceTimersByTime(60000);

      // The warn for drift should NOT be called
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Timer drift'),
        expect.anything(),
      );
    });

    it('should redirect when drift detected and token expired', () => {
      mockAuthService.isAuthenticated = false;

      service.startMonitoring();

      // Simulate drift
      (service as any).lastHeartbeat = Date.now() - 130000;
      vi.advanceTimersByTime(60000);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('Layer 3: Cross-Tab Storage Events', () => {
    it('should handle logout broadcast from another tab', () => {
      mockAuthService.isAuthenticated = false;

      service.startMonitoring();

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'auth_logout_broadcast',
      });
      window.dispatchEvent(storageEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Received logout broadcast from another tab');
      expect(mockAuthService.validateAndUpdateAuthState).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle token removal from another tab', () => {
      service.startMonitoring();

      const storageEvent = new StorageEvent('storage', {
        key: 'auth_token',
        newValue: null,
      });
      window.dispatchEvent(storageEvent);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token removed in another tab, validating auth state',
      );
      expect(mockAuthService.validateAndUpdateAuthState).toHaveBeenCalled();
    });

    it('should not redirect if still authenticated after cross-tab logout broadcast', () => {
      mockAuthService.isAuthenticated = true; // Still authenticated (maybe re-logged in)

      service.startMonitoring();

      const storageEvent = new StorageEvent('storage', {
        key: 'auth_logout_broadcast',
      });
      window.dispatchEvent(storageEvent);

      // Should validate but NOT redirect since still authenticated
      expect(mockAuthService.validateAndUpdateAuthState).toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should ignore unrelated storage events', () => {
      service.startMonitoring();

      const storageEvent = new StorageEvent('storage', {
        key: 'some_other_key',
        newValue: 'some_value',
      });
      window.dispatchEvent(storageEvent);

      expect(mockAuthService.validateAndUpdateAuthState).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should call stopMonitoring on destroy', () => {
      const stopSpy = vi.spyOn(service, 'stopMonitoring');

      service.ngOnDestroy();

      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
