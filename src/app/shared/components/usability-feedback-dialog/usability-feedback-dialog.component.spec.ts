// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import type { TranslocoService } from '@jsverse/transloco';

import {
  UsabilityFeedbackDialogComponent,
  UsabilityFeedbackDialogData,
} from './usability-feedback-dialog.component';

describe('UsabilityFeedbackDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockFeedback: { submit: ReturnType<typeof vi.fn> };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTransloco: TranslocoService;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  function build(data: UsabilityFeedbackDialogData): UsabilityFeedbackDialogComponent {
    return new UsabilityFeedbackDialogComponent(
      mockDialogRef as never,
      data,
      new FormBuilder(),
      mockFeedback as never,
      mockSnack as never,
      mockTransloco,
      mockLogger as never,
      mockCdr as never,
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockFeedback = { submit: vi.fn(() => of({})) };
    mockSnack = { open: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    mockCdr = { markForCheck: vi.fn() };
  });

  describe('initialization', () => {
    it('should create with a required sentiment control', () => {
      const component = build({ surface: 'dashboard' });

      expect(component).toBeTruthy();
      expect(component.form.get('sentiment')?.value).toBeNull();
      expect(component.form.invalid).toBe(true);
    });

    it('pre-selects the sentiment from dialog data', () => {
      const component = build({ surface: 'dashboard', initialSentiment: 'up' });

      expect(component.sentiment).toBe('up');
      expect(component.form.valid).toBe(true);
    });

    it('carries a pre-captured screenshot from dialog data', () => {
      const component = build({ surface: 'dashboard', screenshot: 'data:image/png;base64,xx' });

      expect(component.screenshot).toBe('data:image/png;base64,xx');
    });
  });

  describe('setSentiment', () => {
    it('updates the sentiment control', () => {
      const component = build({ surface: 'dashboard' });

      component.setSentiment('down');

      expect(component.sentiment).toBe('down');
    });
  });

  describe('removeScreenshot', () => {
    it('clears the screenshot and marks for check', () => {
      const component = build({ surface: 'dashboard', screenshot: 'data:image/png;base64,xx' });

      component.removeScreenshot();

      expect(component.screenshot).toBeNull();
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });
  });

  describe('onSubmit', () => {
    it('does nothing when the form is invalid', () => {
      const component = build({ surface: 'dashboard' });
      // sentiment not set
      component.onSubmit();

      expect(mockFeedback.submit).not.toHaveBeenCalled();
    });

    it('submits the feedback and closes the dialog on success', () => {
      const component = build({ surface: 'dashboard', initialSentiment: 'up' });
      component.form.patchValue({ verbatim: 'nice tool' });

      component.onSubmit();

      expect(mockFeedback.submit).toHaveBeenCalledWith(
        expect.objectContaining({ sentiment: 'up', surface: 'dashboard', verbatim: 'nice tool' }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith({ submitted: true });
    });

    it('shows a failure snackbar and stays open on error', () => {
      mockFeedback.submit.mockReturnValue(throwError(() => new Error('boom')));
      const component = build({ surface: 'dashboard', initialSentiment: 'up' });

      component.onSubmit();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.submitting).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(mockSnack.open).toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with submitted: false', () => {
      const component = build({ surface: 'dashboard' });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ submitted: false });
    });
  });
});
