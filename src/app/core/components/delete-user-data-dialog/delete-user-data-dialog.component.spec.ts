// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';

import {
  DeleteUserDataDialogComponent,
  DeleteUserDataDialogData,
} from './delete-user-data-dialog.component';
import { UserService, DeleteChallengeResponse } from '../../services/user.service';
import { LoggerService } from '../../services/logger.service';
import { IAuthService } from '../../interfaces';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../testing/mocks';

// Mock interfaces
interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockAuthService {
  logout: ReturnType<typeof vi.fn>;
}

interface MockUserService {
  requestDeleteChallenge: ReturnType<typeof vi.fn>;
  confirmDeleteAccount: ReturnType<typeof vi.fn>;
}

describe('DeleteUserDataDialogComponent', () => {
  let component: DeleteUserDataDialogComponent;
  let dialogRef: MockDialogRef;
  let authService: MockAuthService;
  let userService: MockUserService;
  let loggerService: MockLoggerService;

  const mockDialogData: DeleteUserDataDialogData = {
    userEmail: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    dialogRef = {
      close: vi.fn(),
    };

    authService = {
      logout: vi.fn(),
    };

    userService = {
      requestDeleteChallenge: vi.fn(),
      confirmDeleteAccount: vi.fn(),
    };

    loggerService = createTypedMockLoggerService();

    component = new DeleteUserDataDialogComponent(
      dialogRef as any,
      mockDialogData,
      authService as unknown as IAuthService,
      userService as unknown as UserService,
      loggerService as unknown as LoggerService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with EXPLANATION stage', () => {
    expect(component.currentStage).toBe(component.DeleteStage.EXPLANATION);
  });

  it('should close dialog with false when cancel is clicked', () => {
    component.onCancel();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  describe('Email Validation', () => {
    it('should return false for invalid email', () => {
      component.emailInput = 'wrong@example.com';
      expect(component.isEmailValid).toBe(false);
    });

    it('should return true for valid email', () => {
      component.emailInput = 'test@example.com';
      expect(component.isEmailValid).toBe(true);
    });

    it('should be case-sensitive', () => {
      component.emailInput = 'TEST@EXAMPLE.COM';
      expect(component.isEmailValid).toBe(false);
    });
  });

  describe('Continue to Email Verification', () => {
    it('should request challenge and move to EMAIL_VERIFICATION stage', () => {
      const mockChallenge: DeleteChallengeResponse = {
        challenge_text: 'test-challenge',
        expires_at: '2025-10-24T12:00:00Z',
      };

      vi.mocked(userService.requestDeleteChallenge).mockReturnValue(of(mockChallenge));

      component.onContinue();

      expect(component.currentStage).toBe(component.DeleteStage.EMAIL_VERIFICATION);
      expect(component.challengeText).toBe('test-challenge');
      expect(userService.requestDeleteChallenge).toHaveBeenCalled();
    });

    it('should handle error when requesting challenge', () => {
      const error = new Error('Network error');
      vi.mocked(userService.requestDeleteChallenge).mockReturnValue(throwError(() => error));

      component.onContinue();

      expect(component.currentStage).toBe(component.DeleteStage.EXPLANATION);
      expect(component.errorMessage).toContain('Failed to initiate deletion process');
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('Confirm Delete', () => {
    beforeEach(() => {
      component.challengeText = 'test-challenge';
      component.emailInput = 'test@example.com';
      component.currentStage = component.DeleteStage.EMAIL_VERIFICATION;
    });

    it('should not proceed if email is invalid', () => {
      component.emailInput = 'wrong@example.com';
      component.onConfirmDelete();
      expect(userService.confirmDeleteAccount).not.toHaveBeenCalled();
    });

    it('should confirm deletion and logout on success', () => {
      vi.mocked(userService.confirmDeleteAccount).mockReturnValue(of(undefined));

      component.onConfirmDelete();

      expect(component.currentStage).toBe(component.DeleteStage.PROCESSING);
      expect(userService.confirmDeleteAccount).toHaveBeenCalledWith('test-challenge');
      expect(dialogRef.close).toHaveBeenCalledWith(true);
      expect(authService.logout).toHaveBeenCalled();
    });

    it('should handle 400 error (expired challenge)', () => {
      const error = { status: 400, message: 'Challenge expired' };
      vi.mocked(userService.confirmDeleteAccount).mockReturnValue(throwError(() => error));

      component.onConfirmDelete();

      expect(component.errorMessage).toContain('deletion request has expired');
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle other errors', () => {
      const error = { status: 500, message: 'Server error' };
      vi.mocked(userService.confirmDeleteAccount).mockReturnValue(throwError(() => error));

      component.onConfirmDelete();

      expect(component.errorMessage).toContain('Failed to delete account');
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on destroy', () => {
      const mockChallenge: DeleteChallengeResponse = {
        challenge_text: 'test-challenge',
        expires_at: '2025-10-24T12:00:00Z',
      };

      vi.mocked(userService.requestDeleteChallenge).mockReturnValue(of(mockChallenge));
      component.onContinue();

      const subscription = (component as any).subscription;
      vi.spyOn(subscription, 'unsubscribe');

      component.ngOnDestroy();

      expect(subscription.unsubscribe).toHaveBeenCalled();
    });
  });
});
