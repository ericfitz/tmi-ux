/**
 * Unit tests for NotificationService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/shared/services/notification.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockSnackBarRef: {
    onAction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock snackbar reference
    mockSnackBarRef = {
      onAction: vi.fn(() => ({
        subscribe: vi.fn((callback: () => void) => {
          // Store the callback so we can trigger it in tests
          mockSnackBarRef.onAction.mockReturnValue(callback);
          return { unsubscribe: vi.fn() };
        }),
      })),
    };

    // Create mock snackbar
    mockSnackBar = {
      open: vi.fn(() => mockSnackBarRef),
      dismiss: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      debugComponent: vi.fn(),
      error: vi.fn(),
    };

    // Create service with mocks
    service = new NotificationService(mockSnackBar as any, mockLogger as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('showSaveError()', () => {
    it('should show error notification with HttpErrorResponse', () => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });

      service.showSaveError(error, 'test data');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Server Error'),
        'Dismiss',
        expect.objectContaining({
          duration: 8000,
          panelClass: ['error-snackbar'],
        }),
      );
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'Notification',
        'Showing save error notification',
        expect.any(Object),
      );
    });

    it('should show retry action when retry function is provided', () => {
      const error = new HttpErrorResponse({ status: 500 });
      const retryFn = vi.fn();

      service.showSaveError(error, 'test data', retryFn);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.any(String),
        'Retry',
        expect.any(Object),
      );
    });

    it('should handle 400 validation errors', () => {
      const error = new HttpErrorResponse({
        status: 400,
        error: { message: 'Invalid input' },
      });

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Validation Error'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle 401 authentication errors', () => {
      const error = new HttpErrorResponse({ status: 401 });

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Authentication Required'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle 403 permission errors', () => {
      const error = new HttpErrorResponse({ status: 403 });

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Permission Denied'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle 404 not found errors', () => {
      const error = new HttpErrorResponse({ status: 404 });

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Not Found'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle 409 conflict errors', () => {
      const error = new HttpErrorResponse({ status: 409 });

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Conflict'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle 422 validation errors', () => {
      const error = new HttpErrorResponse({ status: 422 });

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Validation Error'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle 502/503/504 service unavailable errors', () => {
      const error503 = new HttpErrorResponse({ status: 503 });

      service.showSaveError(error503);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Service Unavailable'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Something went wrong'),
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should handle network errors', () => {
      const error = new Error('NetworkError: Failed to fetch');

      service.showSaveError(error);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Network Error'),
        'Dismiss',
        expect.any(Object),
      );
    });
  });

  describe('showConnectionError()', () => {
    it('should show server connection error', () => {
      service.showConnectionError(true);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Unable to connect to server. Your changes may not be saved.',
        'Dismiss',
        expect.objectContaining({
          duration: 10000,
          panelClass: ['warning-snackbar'],
        }),
      );
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });

    it('should show network connection error', () => {
      service.showConnectionError(false);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Network connection lost. Please check your internet connection.',
        'Dismiss',
        expect.any(Object),
      );
    });

    it('should show retry button when retry function provided', () => {
      const retryFn = vi.fn();

      service.showConnectionError(true, retryFn);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.any(String),
        'Retry',
        expect.any(Object),
      );
    });

    it('should prevent spam - not show error within cooldown period', () => {
      // Show first error
      service.showConnectionError(true);
      expect(mockSnackBar.open).toHaveBeenCalledTimes(1);

      // Try to show another error immediately - should be prevented
      service.showConnectionError(true);
      expect(mockSnackBar.open).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should allow error after cooldown period', async () => {
      // Show first error
      service.showConnectionError(true);
      expect(mockSnackBar.open).toHaveBeenCalledTimes(1);

      // Advance time past cooldown (30 seconds)
      await vi.advanceTimersByTimeAsync(30001);

      // Should now allow another error
      service.showConnectionError(true);
      expect(mockSnackBar.open).toHaveBeenCalledTimes(2);
    });
  });

  describe('showConnectionRestored()', () => {
    it('should show connection restored notification', () => {
      service.showConnectionRestored();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Connection restored. Saving pending changes...',
        'Dismiss',
        expect.objectContaining({
          duration: 4000,
          panelClass: ['success-snackbar'],
        }),
      );
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });

    it('should reset connection error cooldown', () => {
      // Show connection error
      service.showConnectionError(true);
      expect(mockSnackBar.open).toHaveBeenCalledTimes(1);

      // Show connection restored
      service.showConnectionRestored();
      expect(mockSnackBar.open).toHaveBeenCalledTimes(2);

      // Should immediately allow another connection error
      service.showConnectionError(true);
      expect(mockSnackBar.open).toHaveBeenCalledTimes(3);
    });
  });

  describe('showSuccess()', () => {
    it('should show success notification with default duration', () => {
      service.showSuccess('Operation successful');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Operation successful',
        'Dismiss',
        expect.objectContaining({
          duration: 3000,
          panelClass: ['success-snackbar'],
        }),
      );
    });

    it('should show success notification with custom duration', () => {
      service.showSuccess('Operation successful', 5000);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Operation successful',
        'Dismiss',
        expect.objectContaining({
          duration: 5000,
        }),
      );
    });
  });

  describe('showWarning()', () => {
    it('should show warning notification with default duration', () => {
      service.showWarning('Warning message');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Warning message',
        'Dismiss',
        expect.objectContaining({
          duration: 5000,
          panelClass: ['warning-snackbar'],
        }),
      );
    });

    it('should show warning notification with custom duration', () => {
      service.showWarning('Warning message', 8000);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Warning message',
        'Dismiss',
        expect.objectContaining({
          duration: 8000,
        }),
      );
    });
  });

  describe('showValidationError()', () => {
    it('should show validation error notification', () => {
      service.showValidationError('Email', 'Invalid email format');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Email: Invalid email format',
        'Dismiss',
        expect.objectContaining({
          duration: 5000,
          panelClass: ['error-snackbar'],
        }),
      );
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });
  });

  describe('dismissAll()', () => {
    it('should dismiss all notifications', () => {
      service.dismissAll();

      expect(mockSnackBar.dismiss).toHaveBeenCalled();
    });
  });
});
