// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import {
  CreateThreatModelDialogComponent,
  CreateThreatModelDialogResult,
} from './create-threat-model-dialog.component';

describe('CreateThreatModelDialogComponent', () => {
  let component: CreateThreatModelDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    component = new CreateThreatModelDialogComponent(mockDialogRef as any, new FormBuilder());
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

    it('should default framework to STRIDE', () => {
      expect(component.form.get('framework')?.value).toBe('STRIDE');
    });

    it('should default isConfidential to false', () => {
      expect(component.form.get('isConfidential')?.value).toBe(false);
    });

    it('should have all expected framework options', () => {
      expect(component.frameworkOptions).toEqual(['STRIDE', 'CIA', 'LINDDUN', 'DIE', 'PLOT4ai']);
    });
  });

  describe('form validation', () => {
    it('should be invalid when name is empty', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('should be valid when name is provided', () => {
      component.form.patchValue({ name: 'Test Model' });
      expect(component.form.valid).toBe(true);
    });

    it('should be invalid when name exceeds 256 characters', () => {
      component.form.patchValue({ name: 'a'.repeat(257) });
      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });

    it('should be invalid when description exceeds 2048 characters', () => {
      component.form.patchValue({
        name: 'Valid Name',
        description: 'a'.repeat(2049),
      });
      expect(component.form.get('description')?.hasError('maxlength')).toBe(true);
    });

    it('should accept description at max length', () => {
      component.form.patchValue({
        name: 'Valid Name',
        description: 'a'.repeat(2048),
      });
      expect(component.form.valid).toBe(true);
    });
  });

  describe('onCreate', () => {
    it('should close dialog with trimmed form values', () => {
      component.form.patchValue({
        name: '  My Threat Model  ',
        description: '  A description  ',
        framework: 'CIA',
        isConfidential: false,
      });

      component.onCreate();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'My Threat Model',
        description: 'A description',
        framework: 'CIA',
        isConfidential: false,
      } as CreateThreatModelDialogResult);
    });

    it('should not close dialog when form is invalid', () => {
      // Name is required but empty
      component.onCreate();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should handle empty description', () => {
      component.form.patchValue({
        name: 'Model Name',
        description: '',
        framework: 'STRIDE',
      });

      component.onCreate();

      const result = mockDialogRef.close.mock.calls[0][0] as CreateThreatModelDialogResult;
      expect(result.description).toBe('');
    });

    it('should handle null description gracefully', () => {
      component.form.patchValue({
        name: 'Model Name',
        description: null,
        framework: 'STRIDE',
      });

      component.onCreate();

      const result = mockDialogRef.close.mock.calls[0][0] as CreateThreatModelDialogResult;
      expect(result.description).toBe('');
    });
  });

  describe('onCancel', () => {
    it('should close dialog without result', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
