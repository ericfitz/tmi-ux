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
  CreateCredentialDialogComponent,
  CreateCredentialDialogData,
} from './create-credential-dialog.component';

describe('CreateCredentialDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockCredentialService: { create: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  // SEM@e81349f7ea7bf60d484b2d87b1182fd5bd360a1f: build a CreateCredentialDialogComponent with mock deps and initialized form (pure)
  function build(data: CreateCredentialDialogData | null): CreateCredentialDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new CreateCredentialDialogComponent(
          mockDialogRef as never,
          data,
          mockCredentialService as never,
          new FormBuilder(),
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockCredentialService = {
      create: vi.fn(() => of({ client_id: 'c', client_secret: 's' })),
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

  it('should create with an empty form', () => {
    const component = build(null);

    expect(component).toBeTruthy();
    expect(component.form.get('name')?.value).toBe('');
    expect(component.form.get('expiresAt')?.value).toBeNull();
  });

  describe('form validation', () => {
    it('requires a name', () => {
      const component = build(null);

      expect(component.form.get('name')?.hasError('required')).toBe(true);
    });

    it('rejects a name longer than 100 characters', () => {
      const component = build(null);
      component.form.get('name')?.setValue('a'.repeat(101));

      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });
  });

  describe('onSave', () => {
    it('creates the credential and closes the dialog with the response', () => {
      const component = build(null);
      component.form.patchValue({ name: '  CI Key  ', description: '  for ci  ' });

      component.onSave();

      expect(mockCredentialService.create).toHaveBeenCalledWith({
        name: 'CI Key',
        description: 'for ci',
      });
      expect(mockDialogRef.close).toHaveBeenCalledWith({ client_id: 'c', client_secret: 's' });
    });

    it('includes the expiration date as an ISO string when set', () => {
      const component = build(null);
      const expiry = new Date('2030-01-01T00:00:00Z');
      component.form.patchValue({ name: 'Key', expiresAt: expiry });

      component.onSave();

      expect(mockCredentialService.create).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: expiry.toISOString() }),
      );
    });

    it('returns the request without calling the service when returnFormOnly is set', () => {
      const component = build({ returnFormOnly: true });
      component.form.patchValue({ name: 'Key' });

      component.onSave();

      expect(mockCredentialService.create).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ name: 'Key' });
    });

    it('does nothing when the form is invalid', () => {
      const component = build(null);
      // name empty
      component.onSave();

      expect(mockCredentialService.create).not.toHaveBeenCalled();
    });

    it('surfaces the server error message on failure', () => {
      mockCredentialService.create.mockReturnValue(
        throwError(() => ({ error: { message: 'name taken' } })),
      );
      const component = build(null);
      component.form.patchValue({ name: 'Key' });

      component.onSave();

      expect(component.errorMessage).toBe('name taken');
      expect(component.saving).toBe(false);
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
