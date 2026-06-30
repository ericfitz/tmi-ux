// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import type { TranslocoService } from '@jsverse/transloco';

import {
  TriageNoteEditorDialogComponent,
  TriageNoteEditorDialogData,
} from './triage-note-editor-dialog.component';

describe('TriageNoteEditorDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockTransloco: TranslocoService;

  // SEM@e81349f7ea7bf60d484b2d87b1182fd5bd360a1f: build a TriageNoteEditorDialogComponent with mocked dependencies for testing (pure)
  function build(data: TriageNoteEditorDialogData): TriageNoteEditorDialogComponent {
    const component = new TriageNoteEditorDialogComponent(
      new FormBuilder(),
      mockDialogRef as never,
      mockSnackBar as never,
      mockTransloco,
      data,
      { markForCheck: vi.fn() } as never,
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
  });

  describe('initialization — create mode', () => {
    it('starts with an empty, edit-mode form', () => {
      const component = build({ mode: 'create' });

      expect(component.noteForm.get('name')?.value).toBe('');
      expect(component.noteForm.get('content')?.value).toBe('');
      expect(component.previewMode).toBe(false);
      expect(component.isReadOnly).toBe(false);
    });
  });

  describe('initialization — view mode', () => {
    it('populates the form, starts in preview, and disables the form', () => {
      const component = build({ mode: 'view', name: 'Triage Note', content: '# Heading' });

      expect(component.noteForm.get('name')?.value).toBe('Triage Note');
      expect(component.noteForm.get('content')?.value).toBe('# Heading');
      expect(component.previewMode).toBe(true);
      expect(component.isReadOnly).toBe(true);
      expect(component.noteForm.disabled).toBe(true);
    });
  });

  describe('form validation', () => {
    it('requires a name and content', () => {
      const component = build({ mode: 'create' });

      expect(component.noteForm.get('name')?.hasError('required')).toBe(true);
      expect(component.noteForm.get('content')?.hasError('required')).toBe(true);
    });
  });

  describe('dialogTitle', () => {
    it('uses the create title in create mode', () => {
      expect(build({ mode: 'create' }).dialogTitle).toBe('triage.noteEditor.title.create');
    });

    it('uses the view title in view mode', () => {
      expect(build({ mode: 'view' }).dialogTitle).toBe('triage.noteEditor.title.view');
    });
  });

  describe('currentContentLength / markdownContent', () => {
    it('reports the content length and raw markdown', () => {
      const component = build({ mode: 'create' });
      component.noteForm.get('content')?.setValue('hello');

      expect(component.currentContentLength).toBe(5);
      expect(component.markdownContent).toBe('hello');
    });
  });

  describe('togglePreview', () => {
    it('flips the preview flag', () => {
      const component = build({ mode: 'create' });

      component.togglePreview();

      expect(component.previewMode).toBe(true);
    });
  });

  describe('onSave', () => {
    it('closes the dialog with the trimmed name and content', () => {
      const component = build({ mode: 'create' });
      component.noteForm.patchValue({ name: '  My Note  ', content: '  body  ' });

      component.onSave();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ name: 'My Note', content: 'body' });
    });

    it('does nothing when the form is invalid', () => {
      const component = build({ mode: 'create' });
      // name/content empty
      component.onSave();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog without a result', () => {
      const component = build({ mode: 'create' });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
