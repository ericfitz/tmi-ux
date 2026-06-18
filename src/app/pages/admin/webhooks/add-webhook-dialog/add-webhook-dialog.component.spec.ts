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

import { AddWebhookDialogComponent } from './add-webhook-dialog.component';

describe('AddWebhookDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockWebhookService: { create: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  // SEM@dbadf722798f788abc017ecdcf6998ca55d12ed5: build an AddWebhookDialogComponent with mocked dependencies for testing (pure)
  function build(): AddWebhookDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new AddWebhookDialogComponent(
          mockDialogRef as never,
          mockDialog as never,
          mockWebhookService as never,
          new FormBuilder(),
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockWebhookService = { create: vi.fn(() => of({ id: 'wh-1' })) };
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
    expect(component.form.get('events')?.value).toEqual([]);
    expect(component.availableEventTypes.length).toBeGreaterThan(0);
  });

  describe('form validation', () => {
    it('requires name, url, and events', () => {
      const component = build();

      expect(component.form.get('name')?.hasError('required')).toBe(true);
      expect(component.form.get('url')?.hasError('required')).toBe(true);
      expect(component.form.get('events')?.hasError('required')).toBe(true);
    });

    it('rejects a url that is not http(s)', () => {
      const component = build();
      component.form.get('url')?.setValue('ftp://example.com');

      expect(component.form.get('url')?.hasError('pattern')).toBe(true);
    });

    it('accepts an https url', () => {
      const component = build();
      component.form.get('url')?.setValue('https://example.com/hook');

      expect(component.form.get('url')?.hasError('pattern')).toBe(false);
    });
  });

  describe('http warning', () => {
    it('shows the http warning when the url uses plain http', () => {
      const component = build();

      component.form.get('url')?.setValue('http://example.com/hook');

      expect(component.showHttpWarning).toBe(true);
    });

    it('hides the http warning for an https url', () => {
      const component = build();

      component.form.get('url')?.setValue('https://example.com/hook');

      expect(component.showHttpWarning).toBe(false);
    });
  });

  describe('onSave', () => {
    // SEM@dbadf722798f788abc017ecdcf6998ca55d12ed5: populate the webhook form with valid name, url, and event values for testing (pure)
    function fillValidForm(component: AddWebhookDialogComponent, url: string): void {
      component.form.patchValue({
        name: 'My Hook',
        url,
        events: ['threat_model.created'],
      });
    }

    it('does nothing when the form is invalid', () => {
      const component = build();
      // form empty
      component.onSave();

      expect(mockWebhookService.create).not.toHaveBeenCalled();
    });

    it('creates the webhook directly for an https url', () => {
      const component = build();
      fillValidForm(component, 'https://example.com/hook');

      component.onSave();

      expect(mockWebhookService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Hook', url: 'https://example.com/hook' }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ webhook: { id: 'wh-1' } }),
      );
    });

    it('opens a confirmation dialog before creating an http webhook', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ confirmed: true }) });
      const component = build();
      fillValidForm(component, 'http://example.com/hook');

      component.onSave();

      expect(mockDialog.open).toHaveBeenCalled();
      // confirmed -> webhook is created
      expect(mockWebhookService.create).toHaveBeenCalled();
    });

    it('does not create the webhook when the http confirmation is declined', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ confirmed: false }) });
      const component = build();
      fillValidForm(component, 'http://example.com/hook');

      component.onSave();

      expect(mockWebhookService.create).not.toHaveBeenCalled();
    });

    it('surfaces the server error message on failure', () => {
      mockWebhookService.create.mockReturnValue(
        throwError(() => ({ error: { message: 'url unreachable' } })),
      );
      const component = build();
      fillValidForm(component, 'https://example.com/hook');

      component.onSave();

      expect(component.errorMessage).toBe('url unreachable');
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
