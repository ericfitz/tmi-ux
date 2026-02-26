// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { CreateTeamDialogComponent, CreateTeamDialogResult } from './create-team-dialog.component';

describe('CreateTeamDialogComponent', () => {
  let component: CreateTeamDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    component = new CreateTeamDialogComponent(mockDialogRef as any, new FormBuilder());
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('should have empty name by default', () => {
      expect(component.form.get('name')?.value).toBe('');
    });

    it('should have empty description by default', () => {
      expect(component.form.get('description')?.value).toBe('');
    });

    it('should have empty email_address by default', () => {
      expect(component.form.get('email_address')?.value).toBe('');
    });

    it('should have empty uri by default', () => {
      expect(component.form.get('uri')?.value).toBe('');
    });

    it('should have empty status by default', () => {
      expect(component.form.get('status')?.value).toBe('');
    });
  });

  describe('form validation', () => {
    it('should be invalid when name is empty', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('should be valid when name is provided', () => {
      component.form.patchValue({ name: 'Test Team' });
      expect(component.form.valid).toBe(true);
    });

    it('should be invalid when name exceeds 256 characters', () => {
      component.form.patchValue({ name: 'a'.repeat(257) });
      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });

    it('should be invalid when description exceeds 1024 characters', () => {
      component.form.patchValue({
        name: 'Valid Name',
        description: 'a'.repeat(1025),
      });
      expect(component.form.get('description')?.hasError('maxlength')).toBe(true);
    });

    it('should be invalid with invalid email', () => {
      component.form.patchValue({
        name: 'Valid Name',
        email_address: 'not-an-email',
      });
      expect(component.form.get('email_address')?.hasError('email')).toBe(true);
    });

    it('should be valid with valid email', () => {
      component.form.patchValue({
        name: 'Valid Name',
        email_address: 'team@example.com',
      });
      expect(component.form.valid).toBe(true);
    });
  });

  describe('onCreate', () => {
    it('should close dialog with trimmed name only when other fields empty', () => {
      component.form.patchValue({ name: '  My Team  ' });

      component.onCreate();

      const result = mockDialogRef.close.mock.calls[0][0] as CreateTeamDialogResult;
      expect(result.name).toBe('My Team');
      expect(result.description).toBeUndefined();
      expect(result.email_address).toBeUndefined();
      expect(result.uri).toBeUndefined();
      expect(result.status).toBeUndefined();
    });

    it('should include all non-empty fields in result', () => {
      component.form.patchValue({
        name: '  My Team  ',
        description: '  A description  ',
        email_address: 'team@example.com',
        uri: 'https://example.com',
        status: 'active',
      });

      component.onCreate();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'My Team',
        description: 'A description',
        email_address: 'team@example.com',
        uri: 'https://example.com',
        status: 'active',
      } as CreateTeamDialogResult);
    });

    it('should not close dialog when form is invalid', () => {
      component.onCreate();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('should close dialog without result', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
