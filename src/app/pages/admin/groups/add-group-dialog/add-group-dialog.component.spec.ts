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

import { AddGroupDialogComponent } from './add-group-dialog.component';

describe('AddGroupDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockGroupAdminService: { create: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  // SEM@dbadf722798f788abc017ecdcf6998ca55d12ed5: build and initialize an AddGroupDialogComponent instance for testing (pure)
  function build(): AddGroupDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new AddGroupDialogComponent(
          mockDialogRef as never,
          mockGroupAdminService as never,
          new FormBuilder(),
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockGroupAdminService = { create: vi.fn(() => of({ id: 'g1' })) };
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

  it('should create with an empty form', () => {
    const component = build();

    expect(component).toBeTruthy();
    expect(component.form.get('name')?.value).toBe('');
    expect(component.form.get('group_name')?.value).toBe('');
  });

  describe('form validation', () => {
    it('requires name and group_name', () => {
      const component = build();

      expect(component.form.get('name')?.hasError('required')).toBe(true);
      expect(component.form.get('group_name')?.hasError('required')).toBe(true);
    });

    it('rejects a group_name with invalid characters', () => {
      const component = build();
      component.form.get('group_name')?.setValue('bad name!');

      expect(component.form.get('group_name')?.hasError('pattern')).toBe(true);
    });

    it('accepts an alphanumeric group_name with hyphens and underscores', () => {
      const component = build();
      component.form.get('group_name')?.setValue('valid-group_1');

      expect(component.form.get('group_name')?.hasError('pattern')).toBe(false);
    });
  });

  describe('group_name auto-population', () => {
    it('derives a slugified group_name from the display name', () => {
      const component = build();

      component.form.get('name')?.setValue('My Cool Group!');

      // lowercase, punctuation stripped, spaces -> hyphens
      expect(component.form.get('group_name')?.value).toBe('my-cool-group');
    });

    it('stops auto-populating once the group_name field is focused', () => {
      const component = build();
      component.form.get('name')?.setValue('First Name');

      component.onGroupNameFocus();
      component.form.get('name')?.setValue('Second Name');

      // group_name keeps the value from before the focus event
      expect(component.form.get('group_name')?.value).toBe('first-name');
    });
  });

  describe('onSave', () => {
    it('creates the group and closes the dialog on success', () => {
      const component = build();
      component.form.patchValue({ name: 'Group A', group_name: 'group-a' });

      component.onSave();

      expect(mockGroupAdminService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Group A', group_name: 'group-a' }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('includes the description only when provided', () => {
      const component = build();
      component.form.patchValue({ name: 'Group A', group_name: 'group-a', description: 'desc' });

      component.onSave();

      expect(mockGroupAdminService.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'desc' }),
      );
    });

    it('does nothing when the form is invalid', () => {
      const component = build();
      // name/group_name empty
      component.onSave();

      expect(mockGroupAdminService.create).not.toHaveBeenCalled();
    });

    it('surfaces the server error message on failure', () => {
      mockGroupAdminService.create.mockReturnValue(
        throwError(() => ({ error: { message: 'duplicate group' } })),
      );
      const component = build();
      component.form.patchValue({ name: 'Group A', group_name: 'group-a' });

      component.onSave();

      expect(component.errorMessage).toBe('duplicate group');
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
