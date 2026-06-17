// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ElementRef } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { NoteEditorBase } from './note-editor-base';

/**
 * Minimal concrete subclass exercising the shared clipboard logic. It supplies
 * the abstract members the base consumes and records snackbar messages.
 */
class TestNoteEditor extends NoteEditorBase {
  contentTextarea?: ElementRef<HTMLTextAreaElement>;
  markdownPreview?: ElementRef<HTMLDivElement>;
  noteForm: FormGroup;
  previewMode = false;
  hasSelection = false;
  protected mermaidViewerService = undefined;

  messages: { key: string; isError: boolean }[] = [];

  constructor(initialContent = '') {
    super();
    this.noteForm = new FormBuilder().group({ content: [initialContent] });
  }

  get markdownContent(): string {
    return (this.noteForm.get('content')?.value as string | undefined) || '';
  }

  showMessage(key: string, isError = false): void {
    this.messages.push({ key, isError });
  }
}

/** Build a fake textarea element with a controllable selection range. */
function fakeTextarea(value: string, start: number, end: number): HTMLTextAreaElement {
  const el = {
    value,
    selectionStart: start,
    selectionEnd: end,
    focus: vi.fn(),
    setSelectionRange: vi.fn((s: number, e: number) => {
      el.selectionStart = s;
      el.selectionEnd = e;
    }),
  };
  return el as unknown as HTMLTextAreaElement;
}

describe('NoteEditorBase', () => {
  let writeText: ReturnType<typeof vi.fn>;
  let readText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    readText = vi.fn(() => Promise.resolve(''));
    vi.stubGlobal('navigator', { clipboard: { writeText, readText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('onCopy', () => {
    it('copies the full markdown content in preview mode', async () => {
      const editor = new TestNoteEditor('# Heading\nbody');
      editor.previewMode = true;

      await editor.onCopy();

      expect(writeText).toHaveBeenCalledWith('# Heading\nbody');
      expect(editor.messages).toEqual([{ key: 'noteEditor.copiedToClipboard', isError: false }]);
    });

    it('copies only the selected text in edit mode', async () => {
      const editor = new TestNoteEditor('hello world');
      editor.previewMode = false;
      editor.hasSelection = true;
      // Select "world".
      editor.contentTextarea = new ElementRef(fakeTextarea('hello world', 6, 11));

      await editor.onCopy();

      expect(writeText).toHaveBeenCalledWith('world');
      expect(editor.messages).toEqual([{ key: 'noteEditor.copiedToClipboard', isError: false }]);
    });

    it('is a no-op in edit mode with no selection', async () => {
      const editor = new TestNoteEditor('hello world');
      editor.previewMode = false;
      editor.hasSelection = false;
      editor.contentTextarea = new ElementRef(fakeTextarea('hello world', 0, 0));

      await editor.onCopy();

      expect(writeText).not.toHaveBeenCalled();
      expect(editor.messages).toEqual([]);
    });

    it('reports an error when the clipboard write is denied', async () => {
      writeText.mockRejectedValueOnce(new Error('denied'));
      const editor = new TestNoteEditor('content');
      editor.previewMode = true;

      await editor.onCopy();

      expect(editor.messages).toEqual([
        { key: 'noteEditor.errors.clipboardAccessDenied', isError: true },
      ]);
    });
  });

  describe('onCut', () => {
    it('removes the selection from the form content and writes it to the clipboard', async () => {
      const editor = new TestNoteEditor('hello world');
      editor.previewMode = false;
      editor.hasSelection = true;
      const textarea = fakeTextarea('hello world', 5, 11); // " world"
      editor.contentTextarea = new ElementRef(textarea);

      await editor.onCut();

      expect(writeText).toHaveBeenCalledWith(' world');
      expect(editor.noteForm.get('content')?.value).toBe('hello');
      expect(textarea.setSelectionRange).toHaveBeenCalledWith(5, 5);
      expect(editor.hasSelection).toBe(false);
    });

    it('is a no-op in preview mode', async () => {
      const editor = new TestNoteEditor('hello world');
      editor.previewMode = true;
      editor.hasSelection = true;
      editor.contentTextarea = new ElementRef(fakeTextarea('hello world', 0, 5));

      await editor.onCut();

      expect(writeText).not.toHaveBeenCalled();
      expect(editor.noteForm.get('content')?.value).toBe('hello world');
    });

    it('reports an error when the clipboard write is denied', async () => {
      writeText.mockRejectedValueOnce(new Error('denied'));
      const editor = new TestNoteEditor('hello world');
      editor.previewMode = false;
      editor.hasSelection = true;
      editor.contentTextarea = new ElementRef(fakeTextarea('hello world', 0, 5));

      await editor.onCut();

      expect(editor.messages).toEqual([
        { key: 'noteEditor.errors.clipboardAccessDenied', isError: true },
      ]);
      // Content is left untouched on failure.
      expect(editor.noteForm.get('content')?.value).toBe('hello world');
    });
  });

  describe('onPaste', () => {
    it('inserts clipboard text at the caret position', async () => {
      readText.mockResolvedValueOnce('INSERTED');
      const editor = new TestNoteEditor('ab');
      editor.previewMode = false;
      const textarea = fakeTextarea('ab', 1, 1); // caret between a and b
      editor.contentTextarea = new ElementRef(textarea);

      await editor.onPaste();

      expect(editor.noteForm.get('content')?.value).toBe('aINSERTEDb');
      expect(textarea.setSelectionRange).toHaveBeenCalledWith(9, 9);
    });

    it('replaces the active selection with clipboard text', async () => {
      readText.mockResolvedValueOnce('X');
      const editor = new TestNoteEditor('hello world');
      editor.previewMode = false;
      editor.contentTextarea = new ElementRef(fakeTextarea('hello world', 0, 5)); // "hello"

      await editor.onPaste();

      expect(editor.noteForm.get('content')?.value).toBe('X world');
    });

    it('is a no-op in preview mode', async () => {
      const editor = new TestNoteEditor('content');
      editor.previewMode = true;
      editor.contentTextarea = new ElementRef(fakeTextarea('content', 0, 0));

      await editor.onPaste();

      expect(readText).not.toHaveBeenCalled();
      expect(editor.noteForm.get('content')?.value).toBe('content');
    });

    it('reports an error when the clipboard read is denied', async () => {
      readText.mockRejectedValueOnce(new Error('denied'));
      const editor = new TestNoteEditor('content');
      editor.previewMode = false;
      editor.contentTextarea = new ElementRef(fakeTextarea('content', 0, 0));

      await editor.onPaste();

      expect(editor.messages).toEqual([
        { key: 'noteEditor.errors.clipboardAccessDenied', isError: true },
      ]);
    });
  });
});
