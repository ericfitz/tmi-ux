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

import {
  CreateAutomationUserDialogComponent,
  CreateAutomationUserDialogData,
} from './create-automation-user-dialog.component';

describe('CreateAutomationUserDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockUserAdminService: { createAutomationUser: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  function build(data: CreateAutomationUserDialogData | null): CreateAutomationUserDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new CreateAutomationUserDialogComponent(
          mockDialogRef as never,
          data,
          mockUserAdminService as never,
          new FormBuilder(),
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockUserAdminService = {
      createAutomationUser: vi.fn(() => of({ user: { name: 'bot' } })),
    };
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

  describe('initialization', () => {
    it('should create with an empty form when no suggested name is given', () => {
      const component = build(null);

      expect(component).toBeTruthy();
      expect(component.form.get('name')?.value).toBe('');
      expect(component.form.get('email')?.value).toBe('');
    });

    it('pre-fills the name and generates an email from the suggested name', () => {
      const component = build({ suggestedName: 'My Bot Account' });

      expect(component.form.get('name')?.value).toBe('My Bot Account');
      // slug: lowercase, non-alphanumeric -> hyphen, + @tmi.local
      expect(component.form.get('email')?.value).toBe('my-bot-account@tmi.local');
    });
  });

  describe('form validation', () => {
    it('requires a name', () => {
      const component = build(null);

      expect(component.form.get('name')?.hasError('required')).toBe(true);
    });

    it('rejects a name shorter than 2 characters', () => {
      const component = build(null);
      component.form.get('name')?.setValue('a');

      expect(component.form.get('name')?.hasError('minlength')).toBe(true);
    });

    it('rejects a name that does not start with a letter', () => {
      const component = build(null);
      component.form.get('name')?.setValue('1bot');

      expect(component.form.get('name')?.hasError('pattern')).toBe(true);
    });

    it('accepts a valid name', () => {
      const component = build(null);
      component.form.get('name')?.setValue('valid-bot1');

      expect(component.form.get('name')?.valid).toBe(true);
    });
  });

  describe('onSave', () => {
    it('creates the automation user and closes the dialog with the response', () => {
      const component = build(null);
      component.form.patchValue({ name: 'My Bot', email: 'bot@tmi.local' });

      component.onSave();

      expect(mockUserAdminService.createAutomationUser).toHaveBeenCalledWith({
        name: 'My Bot',
        email: 'bot@tmi.local',
      });
      expect(mockDialogRef.close).toHaveBeenCalledWith({ user: { name: 'bot' } });
    });

    it('omits the email when it is empty', () => {
      const component = build(null);
      component.form.patchValue({ name: 'My Bot', email: '' });

      component.onSave();

      expect(mockUserAdminService.createAutomationUser).toHaveBeenCalledWith({ name: 'My Bot' });
    });

    it('does nothing when the form is invalid', () => {
      const component = build(null);
      // name empty
      component.onSave();

      expect(mockUserAdminService.createAutomationUser).not.toHaveBeenCalled();
    });

    it('surfaces the error message on failure', () => {
      // The component routes failures through getErrorMessage(), which
      // extracts the message from an Error instance.
      mockUserAdminService.createAutomationUser.mockReturnValue(
        throwError(() => new Error('name taken')),
      );
      const component = build(null);
      component.form.patchValue({ name: 'My Bot' });

      component.onSave();

      expect(component.errorMessage).toContain('name taken');
      expect(component.saving).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with null', () => {
      const component = build(null);

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(null);
    });
  });
});
