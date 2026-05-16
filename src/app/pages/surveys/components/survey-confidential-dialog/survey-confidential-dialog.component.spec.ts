// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { SurveyConfidentialDialogComponent } from './survey-confidential-dialog.component';

describe('SurveyConfidentialDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let component: SurveyConfidentialDialogComponent;

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    component = new SurveyConfidentialDialogComponent(mockDialogRef as never);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onYes', () => {
    it('closes the dialog with true (mark confidential)', () => {
      component.onYes();

      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });
  });

  describe('onNo', () => {
    it('closes the dialog with false', () => {
      component.onNo();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
