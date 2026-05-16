// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { RevisionNotesDialogComponent } from './revision-notes-dialog.component';

describe('RevisionNotesDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let component: RevisionNotesDialogComponent;

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    component = new RevisionNotesDialogComponent(mockDialogRef as never);
  });

  it('should create with empty revision notes', () => {
    expect(component).toBeTruthy();
    expect(component.revisionNotes).toBe('');
  });

  describe('canSubmit', () => {
    it('is false when the notes are empty or whitespace', () => {
      component.revisionNotes = '   ';
      expect(component.canSubmit).toBe(false);
    });

    it('is true when the notes have content', () => {
      component.revisionNotes = 'please revise section 2';
      expect(component.canSubmit).toBe(true);
    });
  });

  describe('onConfirm', () => {
    it('closes the dialog with trimmed notes when valid', () => {
      component.revisionNotes = '  needs work  ';

      component.onConfirm();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ notes: 'needs work' });
    });

    it('does nothing when the notes are empty', () => {
      component.revisionNotes = '  ';

      component.onConfirm();

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
