// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import type { TranslocoService } from '@jsverse/transloco';

import { AiFeedbackDialogComponent, AiFeedbackDialogData } from './ai-feedback-dialog.component';

describe('AiFeedbackDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockFeedback: { submit: ReturnType<typeof vi.fn> };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTransloco: TranslocoService;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;

  function build(data: AiFeedbackDialogData, init = true): AiFeedbackDialogComponent {
    const component = new AiFeedbackDialogComponent(
      mockDialogRef as never,
      data,
      new FormBuilder(),
      mockFeedback as never,
      mockSnack as never,
      mockTransloco,
      mockLogger as never,
    );
    if (init) component.ngOnInit();
    return component;
  }

  const threatData: AiFeedbackDialogData = {
    threatModelId: 'tm-1',
    targetType: 'threat',
    targetId: 'threat-1',
  };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockFeedback = { submit: vi.fn(() => of({})) };
    mockSnack = { open: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  describe('initialization', () => {
    it('should create with a required sentiment control', () => {
      const component = build(threatData);

      expect(component).toBeTruthy();
      expect(component.form.get('sentiment')?.value).toBeNull();
      expect(component.form.invalid).toBe(true);
    });

    it('pre-selects the sentiment from dialog data', () => {
      const component = build({ ...threatData, initialSentiment: 'up' });

      expect(component.form.get('sentiment')?.value).toBe('up');
    });
  });

  describe('false-positive taxonomy', () => {
    it('is shown for a thumbs-down on a threat', () => {
      const component = build(threatData);
      component.setSentiment('down');

      expect(component.showFalsePositiveTaxonomy).toBe(true);
    });

    it('is hidden for a thumbs-up', () => {
      const component = build(threatData);
      component.setSentiment('up');

      expect(component.showFalsePositiveTaxonomy).toBe(false);
    });

    it('is hidden for non-threat target types', () => {
      const component = build({ ...threatData, targetType: 'note' });
      component.setSentiment('down');

      expect(component.showFalsePositiveTaxonomy).toBe(false);
    });

    it('requires a false-positive reason for a thumbs-down threat', () => {
      const component = build(threatData);
      component.setSentiment('down');

      expect(component.form.get('falsePositiveReason')?.hasError('required')).toBe(true);
    });

    it('clears the false-positive selection when switching to thumbs-up', () => {
      const component = build(threatData);
      component.setSentiment('down');
      component.form.get('falsePositiveReason')?.setValue(component.reasons[0]);

      component.setSentiment('up');

      expect(component.form.get('falsePositiveReason')?.value).toBeNull();
    });
  });

  describe('onSubmit', () => {
    it('does nothing when the form is invalid', () => {
      const component = build(threatData);
      // sentiment not set
      component.onSubmit();

      expect(mockFeedback.submit).not.toHaveBeenCalled();
    });

    it('submits feedback and closes the dialog on success', () => {
      const component = build({ ...threatData, initialSentiment: 'up' });
      component.form.patchValue({ verbatim: 'looks right' });

      component.onSubmit();

      expect(mockFeedback.submit).toHaveBeenCalledWith(
        'tm-1',
        expect.objectContaining({ sentiment: 'up', targetType: 'threat', targetId: 'threat-1' }),
      );
      // Cleared false-positive fields are sent as undefined, not null.
      const payload = mockFeedback.submit.mock.calls[0][1];
      expect(payload.falsePositiveReason).toBeUndefined();
      expect(payload.falsePositiveSubreason).toBeUndefined();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ submitted: true });
    });

    it('shows a failure snackbar and stays open on error', () => {
      mockFeedback.submit.mockReturnValue(throwError(() => new Error('boom')));
      const component = build({ ...threatData, initialSentiment: 'up' });

      component.onSubmit();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.submitting).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with submitted: false', () => {
      const component = build(threatData);

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ submitted: false });
    });
  });
});
