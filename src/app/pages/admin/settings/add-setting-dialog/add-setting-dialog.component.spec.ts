// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';

import { AddSettingDialogComponent } from './add-setting-dialog.component';

describe('AddSettingDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSettingsService: { updateSetting: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  // SEM@dbadf722798f788abc017ecdcf6998ca55d12ed5: build and initialize an AddSettingDialogComponent instance for testing (pure)
  function build(): AddSettingDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new AddSettingDialogComponent(
          mockDialogRef as never,
          mockSettingsService as never,
          new FormBuilder(),
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockSettingsService = { updateSetting: vi.fn(() => of({})) };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create defaulting to the string type', () => {
    const component = build();

    expect(component).toBeTruthy();
    expect(component.form.get('type')?.value).toBe('string');
    expect(component.settingTypes).toEqual(['string', 'int', 'bool', 'json']);
  });

  describe('key validation', () => {
    it('requires a key', () => {
      const component = build();

      expect(component.form.get('key')?.hasError('required')).toBe(true);
    });

    it('rejects a key that does not start with a lowercase letter', () => {
      const component = build();
      component.form.get('key')?.setValue('Bad.Key');

      expect(component.form.get('key')?.hasError('pattern')).toBe(true);
    });

    it('accepts a lowercase dotted key', () => {
      const component = build();
      component.form.get('key')?.setValue('feature.flag_one');

      expect(component.form.get('key')?.hasError('pattern')).toBe(false);
    });
  });

  describe('isFormValid', () => {
    it('does not require a value for the bool type', () => {
      const component = build();
      component.form.patchValue({ key: 'flag.on', type: 'bool', value: '' });

      expect(component.isFormValid()).toBe(true);
    });

    it('requires a value for non-bool types', () => {
      const component = build();
      component.form.patchValue({ key: 'flag.on', type: 'string', value: '' });

      expect(component.isFormValid()).toBe(false);
    });
  });

  describe('onSave', () => {
    it('saves a string setting with its value', () => {
      const component = build();
      component.form.patchValue({ key: 'app.title', type: 'string', value: 'TMI' });

      component.onSave();

      expect(mockSettingsService.updateSetting).toHaveBeenCalledWith('app.title', {
        value: 'TMI',
        type: 'string',
      });
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('serializes the bool toggle to a "true"/"false" string', () => {
      const component = build();
      component.form.patchValue({ key: 'flag.on', type: 'bool', boolValue: true });

      component.onSave();

      expect(mockSettingsService.updateSetting).toHaveBeenCalledWith('flag.on', {
        value: 'true',
        type: 'bool',
      });
    });

    it('includes the description when provided', () => {
      const component = build();
      component.form.patchValue({
        key: 'app.title',
        type: 'string',
        value: 'TMI',
        description: 'the app title',
      });

      component.onSave();

      expect(mockSettingsService.updateSetting).toHaveBeenCalledWith('app.title', {
        value: 'TMI',
        type: 'string',
        description: 'the app title',
      });
    });

    it('does nothing when the form is invalid', () => {
      const component = build();
      // key empty
      component.onSave();

      expect(mockSettingsService.updateSetting).not.toHaveBeenCalled();
    });

    it('surfaces the server error message on failure', () => {
      mockSettingsService.updateSetting.mockReturnValue(
        throwError(() => ({ error: { message: 'key exists' } })),
      );
      const component = build();
      component.form.patchValue({ key: 'app.title', type: 'string', value: 'TMI' });

      component.onSave();

      expect(component.errorMessage).toBe('key exists');
      expect(component.saving).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with false', () => {
      const component = build();

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
