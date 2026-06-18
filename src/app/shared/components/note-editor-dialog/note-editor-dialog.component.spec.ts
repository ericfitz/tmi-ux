// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import type { TranslocoService } from '@jsverse/transloco';

import { NoteEditorDialogComponent, NoteEditorDialogData } from './note-editor-dialog.component';

describe('NoteEditorDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockTransloco: TranslocoService;

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: build and initialize a NoteEditorDialogComponent for unit testing (pure)
  function build(data: NoteEditorDialogData): NoteEditorDialogComponent {
    const component = new NoteEditorDialogComponent(
      new FormBuilder(),
      mockDialogRef as never,
      mockSnackBar as never,
      mockTransloco,
      data,
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    // ngOnInit checks clipboard permissions; stub navigator.clipboard.
    vi.stubGlobal('navigator', {
      clipboard: { readText: vi.fn(() => Promise.resolve('')) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initialization — create mode', () => {
    it('starts with an empty, edit-mode form for a new threat-model note', () => {
      const component = build({ mode: 'create', entityType: 'threat_model' });

      expect(component.noteForm.get('name')?.value).toBe('');
      expect(component.noteForm.get('content')?.value).toBe('');
      expect(component.previewMode).toBe(false);
      // threat-model notes default include_in_report to true on create
      expect(component.noteForm.get('include_in_report')?.value).toBe(true);
    });

    it('uses the sharable flag instead of include_in_report for non-threat-model notes', () => {
      const component = build({ mode: 'create', entityType: 'team' });

      expect(component.noteForm.get('sharable')?.value).toBe(true);
      // include_in_report is unused for non-threat-model notes; the reactive
      // form coerces its undefined initial value to null.
      expect(component.noteForm.get('include_in_report')?.value).toBeNull();
    });
  });

  describe('initialization — edit mode', () => {
    it('populates the form and starts in preview mode when content exists', () => {
      const component = build({
        mode: 'edit',
        entityType: 'threat_model',
        note: { name: 'My Note', content: '# Heading', description: 'a note' },
      });

      expect(component.noteForm.get('name')?.value).toBe('My Note');
      expect(component.noteForm.get('content')?.value).toBe('# Heading');
      expect(component.previewMode).toBe(true);
    });

    it('disables the form in read-only mode', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
        isReadOnly: true,
      });

      expect(component.isReadOnly).toBe(true);
      expect(component.noteForm.disabled).toBe(true);
      expect(component.previewMode).toBe(true);
    });
  });

  describe('form validation', () => {
    it('requires a name and content', () => {
      const component = build({ mode: 'create', entityType: 'team' });

      expect(component.noteForm.get('name')?.hasError('required')).toBe(true);
      expect(component.noteForm.get('content')?.hasError('required')).toBe(true);
    });
  });

  describe('currentContentLength / markdownContent', () => {
    it('reports the content length and raw markdown', () => {
      const component = build({ mode: 'create', entityType: 'team' });
      component.noteForm.get('content')?.setValue('hello');

      expect(component.currentContentLength).toBe(5);
      expect(component.markdownContent).toBe('hello');
    });
  });

  describe('dialogTitle', () => {
    it('uses the create title in create mode', () => {
      const component = build({ mode: 'create', entityType: 'team' });

      expect(component.dialogTitle).toBe('noteEditor.title.create');
    });

    it('uses the view title in read-only mode', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
        isReadOnly: true,
      });

      expect(component.dialogTitle).toBe('noteEditor.title.view');
    });
  });

  describe('togglePreview', () => {
    it('flips the preview flag', () => {
      const component = build({ mode: 'create', entityType: 'team' });
      const initial = component.previewMode;

      component.togglePreview();

      expect(component.previewMode).toBe(!initial);
    });
  });

  describe('hasUnsavedChanges', () => {
    it('is false for an unchanged form', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
      });

      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('is true once a field changes', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
      });
      component.noteForm.get('name')?.setValue('Changed');

      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('is false when the form is invalid even with changes', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
      });
      component.noteForm.get('name')?.setValue('');

      expect(component.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('onSave', () => {
    it('emits a trimmed form value via saveEvent', () => {
      const component = build({ mode: 'create', entityType: 'threat_model' });
      const emitted: unknown[] = [];
      component.saveEvent.subscribe(v => emitted.push(v));
      component.noteForm.patchValue({ name: '  My Note  ', content: '  body  ' });

      component.onSave();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual(expect.objectContaining({ name: 'My Note', content: 'body' }));
    });

    it('does nothing when there are no unsaved changes', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
      });
      const emitted: unknown[] = [];
      component.saveEvent.subscribe(v => emitted.push(v));

      component.onSave();

      expect(emitted).toHaveLength(0);
    });

    it('clears the unsaved-changes state after saving a team note', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
      });
      component.noteForm.patchValue({ name: 'Renamed' });
      expect(component.hasUnsavedChanges()).toBe(true);

      component.onSave();

      // The saved snapshot must be normalized so an untouched form after a
      // save no longer reports changes (regression: include_in_report/sharable
      // are undefined for the unused entity type but the control reads null).
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('clears the unsaved-changes state after saving a threat-model note', () => {
      const component = build({
        mode: 'edit',
        entityType: 'threat_model',
        note: { name: 'N', content: 'c' },
      });
      component.noteForm.patchValue({ name: 'Renamed' });

      component.onSave();

      expect(component.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('onSaveAndClose', () => {
    it('closes without a result when there are no unsaved changes', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
      });

      component.onSaveAndClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('closes with the form result when there are unsaved changes', () => {
      const component = build({ mode: 'create', entityType: 'threat_model' });
      component.noteForm.patchValue({ name: 'My Note', content: 'body' });

      component.onSaveAndClose();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.formValue.name).toBe('My Note');
      expect(result.wasCreated).toBe(false);
    });
  });

  describe('setCreatedNoteId', () => {
    it('records the created note id and switches to edit mode', () => {
      const component = build({ mode: 'create', entityType: 'team' });

      component.setCreatedNoteId('note-99');

      expect(component.mode).toBe('edit');
    });
  });

  describe('onCancel', () => {
    it('closes directly when there are no unsaved changes', () => {
      const component = build({
        mode: 'edit',
        entityType: 'team',
        note: { name: 'N', content: 'c' },
      });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('closes when the user confirms discarding unsaved changes', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      const component = build({ mode: 'create', entityType: 'team' });
      component.noteForm.patchValue({ name: 'Dirty', content: 'body' });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('stays open when the user cancels the discard prompt', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
      const component = build({ mode: 'create', entityType: 'team' });
      component.noteForm.patchValue({ name: 'Dirty', content: 'body' });

      component.onCancel();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });
});
