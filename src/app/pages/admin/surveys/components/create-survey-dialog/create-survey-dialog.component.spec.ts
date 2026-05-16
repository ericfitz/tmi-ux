// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';

import { CreateSurveyDialogComponent } from './create-survey-dialog.component';

describe('CreateSurveyDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let component: CreateSurveyDialogComponent;

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    component = new CreateSurveyDialogComponent(mockDialogRef as never, new FormBuilder());
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('starts with an empty name and a default version of "1"', () => {
      expect(component.form.get('name')?.value).toBe('');
      expect(component.form.get('version')?.value).toBe('1');
    });
  });

  describe('form validation', () => {
    it('is invalid until a name is provided', () => {
      expect(component.form.invalid).toBe(true);

      component.form.patchValue({ name: 'My Survey' });
      expect(component.form.valid).toBe(true);
    });

    it('rejects a name longer than 256 characters', () => {
      component.form.patchValue({ name: 'a'.repeat(257) });
      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });

    it('rejects an empty version', () => {
      component.form.patchValue({ name: 'My Survey', version: '' });
      expect(component.form.get('version')?.hasError('required')).toBe(true);
    });
  });

  describe('onCreate', () => {
    it('closes the dialog with the trimmed name and version', () => {
      component.form.patchValue({ name: '  My Survey  ', version: '  2  ' });

      component.onCreate();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ name: 'My Survey', version: '2' });
    });

    it('does nothing when the form is invalid', () => {
      // name left empty
      component.onCreate();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog without a result', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
