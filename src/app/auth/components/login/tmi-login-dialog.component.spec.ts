// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TmiLoginDialogComponent } from './tmi-login-dialog.component';

describe('TmiLoginDialogComponent', () => {
  let component: TmiLoginDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockData: { providerName: string };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockData = { providerName: 'TMI Provider' };
    component = new TmiLoginDialogComponent(mockDialogRef as any, mockData);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty username', () => {
    expect(component.usernameControl.value).toBe('');
  });

  it('should accept valid alphanumeric username (3-20 chars)', () => {
    component.usernameControl.setValue('testuser1');
    expect(component.usernameControl.valid).toBe(true);
  });

  it('should accept empty username (field is optional)', () => {
    component.usernameControl.setValue('');
    expect(component.usernameControl.valid).toBe(true);
  });

  it('should reject username shorter than 3 chars', () => {
    component.usernameControl.setValue('ab');
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should reject username longer than 20 chars', () => {
    component.usernameControl.setValue('a'.repeat(21));
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should reject username with special characters', () => {
    component.usernameControl.setValue('user@name');
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should reject username with spaces', () => {
    component.usernameControl.setValue('user name');
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should accept username with exactly 3 chars', () => {
    component.usernameControl.setValue('abc');
    expect(component.usernameControl.valid).toBe(true);
  });

  it('should accept username with exactly 20 chars', () => {
    component.usernameControl.setValue('a'.repeat(20));
    expect(component.usernameControl.valid).toBe(true);
  });

  describe('onSignIn', () => {
    it('should close dialog with loginHint when username is valid', () => {
      component.usernameControl.setValue('testuser');
      component.onSignIn();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ loginHint: 'testuser' });
    });

    it('should close dialog with empty loginHint when username is empty', () => {
      component.usernameControl.setValue('');
      component.onSignIn();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ loginHint: '' });
    });

    it('should not close dialog when username is invalid', () => {
      component.usernameControl.setValue('ab');
      component.onSignIn();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should mark control as touched when invalid', () => {
      component.usernameControl.setValue('ab');
      component.onSignIn();
      expect(component.usernameControl.touched).toBe(true);
    });
  });

  describe('onCancel', () => {
    it('should close dialog with undefined', () => {
      component.onCancel();
      expect(mockDialogRef.close).toHaveBeenCalledWith(undefined);
    });
  });
});
