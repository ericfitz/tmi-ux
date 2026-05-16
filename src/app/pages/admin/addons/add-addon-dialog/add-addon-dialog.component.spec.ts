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
import type { TranslocoService } from '@jsverse/transloco';

import { AddAddonDialogComponent } from './add-addon-dialog.component';

describe('AddAddonDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockAddonService: { create: ReturnType<typeof vi.fn> };
  let mockWebhookService: { list: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: TranslocoService;
  let envInjector: EnvironmentInjector;

  function build(): AddAddonDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new AddAddonDialogComponent(
          mockDialogRef as never,
          mockAddonService as never,
          mockWebhookService as never,
          new FormBuilder(),
          mockLogger as never,
          mockTransloco,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAddonService = { create: vi.fn(() => of({ id: 'addon-1' })) };
    mockWebhookService = {
      list: vi.fn(() =>
        of({
          subscriptions: [
            { id: 'wh-1', name: 'Active Hook', status: 'active' },
            { id: 'wh-2', name: 'Pending Hook', status: 'pending_verification' },
          ],
        }),
      ),
    };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  describe('initialization', () => {
    it('should create with the default extension icon', () => {
      const component = build();

      expect(component).toBeTruthy();
      expect(component.form.get('icon')?.value).toBe('material-symbols:extension');
    });

    it('loads only active webhooks into the dropdown', () => {
      const component = build();

      expect(component.availableWebhooks.map(w => w.id)).toEqual(['wh-1']);
    });

    it('records an error when webhook loading fails', () => {
      mockWebhookService.list.mockReturnValue(throwError(() => new Error('network')));
      const component = build();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.errorMessage).toBeTruthy();
    });
  });

  describe('form validation', () => {
    it('requires name and webhook_id', () => {
      const component = build();

      expect(component.form.get('name')?.hasError('required')).toBe(true);
      expect(component.form.get('webhook_id')?.hasError('required')).toBe(true);
    });

    it('rejects an icon that does not start with a known prefix', () => {
      const component = build();
      component.form.get('icon')?.setValue('bogus-icon');

      expect(component.form.get('icon')?.hasError('iconFormat')).toBe(true);
    });

    it('accepts a valid material-symbols icon', () => {
      const component = build();
      component.form.get('icon')?.setValue('material-symbols:security');

      expect(component.form.get('icon')?.hasError('iconFormat')).toBe(false);
    });

    it('treats an empty icon as valid (icon is optional)', () => {
      const component = build();
      component.form.get('icon')?.setValue('');

      expect(component.form.get('icon')?.hasError('iconFormat')).toBe(false);
    });
  });

  describe('onIconBlur', () => {
    it('restores the default icon when the field is emptied', () => {
      const component = build();
      component.form.get('icon')?.setValue('   ');

      component.onIconBlur();

      expect(component.form.get('icon')?.value).toBe('material-symbols:extension');
    });

    it('normalizes a colon-prefixed value to material-symbols form', () => {
      const component = build();
      component.form.get('icon')?.setValue('mdi:home-outline');

      component.onIconBlur();

      expect(component.form.get('icon')?.value).toBe('material-symbols:home_outline');
    });
  });

  describe('onSave', () => {
    it('creates the addon and closes the dialog on success', () => {
      const component = build();
      component.form.patchValue({ name: 'My Addon', webhook_id: 'wh-1' });

      component.onSave();

      expect(mockAddonService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Addon', webhook_id: 'wh-1' }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('includes selected object types when present', () => {
      const component = build();
      component.form.patchValue({
        name: 'My Addon',
        webhook_id: 'wh-1',
        objects: ['threat', 'asset'],
      });

      component.onSave();

      expect(mockAddonService.create).toHaveBeenCalledWith(
        expect.objectContaining({ objects: ['threat', 'asset'] }),
      );
    });

    it('does nothing when the form is invalid', () => {
      const component = build();
      // name/webhook_id empty
      component.onSave();

      expect(mockAddonService.create).not.toHaveBeenCalled();
    });

    it('surfaces the server error message on failure', () => {
      mockAddonService.create.mockReturnValue(
        throwError(() => ({ error: { message: 'addon name taken' } })),
      );
      const component = build();
      component.form.patchValue({ name: 'My Addon', webhook_id: 'wh-1' });

      component.onSave();

      expect(component.errorMessage).toBe('addon name taken');
      expect(component.saving).toBe(false);
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
