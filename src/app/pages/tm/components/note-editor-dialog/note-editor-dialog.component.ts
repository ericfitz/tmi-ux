import {
  Component,
  Inject,
  OnInit,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { MarkdownModule } from 'ngx-markdown';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import DOMPurify from 'dompurify';
import { Note } from '../../models/threat-model.model';

export interface NoteEditorDialogData {
  mode: 'create' | 'edit';
  note?: Note;
}

export interface NoteFormResult {
  name: string;
  content: string;
  description?: string;
}

@Component({
  selector: 'app-note-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    TranslocoModule,
    MarkdownModule,
  ],
  templateUrl: './note-editor-dialog.component.html',
  styleUrls: ['./note-editor-dialog.component.scss'],
})
export class NoteEditorDialogComponent implements OnInit {
  @Output() saveEvent = new EventEmitter<NoteFormResult>();
  @ViewChild('contentTextarea') contentTextarea!: ElementRef<HTMLTextAreaElement>;

  noteForm!: FormGroup;
  mode: 'create' | 'edit';
  previewMode = false;
  private originalContent = '';

  readonly maxContentLength = 65536;
  readonly maxNameLength = 256;
  readonly maxDescriptionLength = 1024;

  // Clipboard state
  hasSelection = false;
  clipboardHasContent = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<NoteEditorDialogComponent>,
    private snackBar: MatSnackBar,
    private translocoService: TranslocoService,
    @Inject(MAT_DIALOG_DATA) public data: NoteEditorDialogData,
  ) {
    this.mode = data.mode;
  }

  ngOnInit(): void {
    this.noteForm = this.fb.group({
      name: [
        this.data.note?.name || '',
        [Validators.required, Validators.maxLength(this.maxNameLength)],
      ],
      content: [
        this.data.note?.content || '',
        [Validators.required, Validators.maxLength(this.maxContentLength)],
      ],
      description: [
        this.data.note?.description || '',
        [Validators.maxLength(this.maxDescriptionLength)],
      ],
    });

    this.originalContent = this.noteForm.get('content')?.value || '';

    // Check clipboard permissions on init
    void this.checkClipboardPermissions();
  }

  get dialogTitle(): string {
    return this.translocoService.translate(`noteEditor.title.${this.mode}`);
  }

  get currentContentLength(): number {
    const value = this.noteForm.get('content')?.value as string | undefined;
    return value?.length ?? 0;
  }

  get sanitizedContent(): string {
    // For preview, return the raw markdown - ngx-markdown will handle rendering and sanitization
    const content = (this.noteForm.get('content')?.value as string | undefined) || '';
    return content;
  }

  hasUnsavedChanges(): boolean {
    const currentContent = (this.noteForm.get('content')?.value as string | undefined) || '';
    return currentContent !== this.originalContent && this.noteForm.valid;
  }

  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  onTextareaSelect(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.hasSelection = textarea.selectionStart !== textarea.selectionEnd;
  }

  async onCut(): Promise<void> {
    if (this.previewMode || !this.hasSelection) {
      return;
    }

    const textarea = this.contentTextarea?.nativeElement;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    if (!selectedText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedText);
      const newValue = textarea.value.substring(0, start) + textarea.value.substring(end);
      this.noteForm.get('content')?.setValue(newValue);
      textarea.focus();
      textarea.setSelectionRange(start, start);
      this.hasSelection = false;
    } catch {
      this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
    }
  }

  async onCopy(): Promise<void> {
    if (this.previewMode) {
      // Copy the entire sanitized content in preview mode
      const content = this.sanitizedContent;
      try {
        await navigator.clipboard.writeText(content);
        this.showMessage('noteEditor.copiedToClipboard');
      } catch {
        this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
      }
    } else {
      // Copy selected text in edit mode
      const textarea = this.contentTextarea?.nativeElement;
      if (!textarea || !this.hasSelection) {
        return;
      }

      const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);

      if (!selectedText) {
        return;
      }

      try {
        await navigator.clipboard.writeText(selectedText);
        this.showMessage('noteEditor.copiedToClipboard');
      } catch {
        this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
      }
    }
  }

  async onPaste(): Promise<void> {
    if (this.previewMode) {
      return;
    }

    const textarea = this.contentTextarea?.nativeElement;
    if (!textarea) {
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      const newValue =
        currentValue.substring(0, start) + clipboardText + currentValue.substring(end);

      this.noteForm.get('content')?.setValue(newValue);
      textarea.focus();
      const newPosition = start + clipboardText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    } catch {
      this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
    }
  }

  onSave(): void {
    if (!this.noteForm.valid || !this.hasUnsavedChanges()) {
      return;
    }

    const formValue = this.sanitizeFormValue(this.noteForm.value as NoteFormResult);
    this.originalContent = formValue.content;
    this.saveEvent.emit(formValue);
    this.showMessage('noteEditor.savedSuccessfully');
  }

  onSaveAndClose(): void {
    if (!this.noteForm.valid) {
      return;
    }

    const formValue = this.sanitizeFormValue(this.noteForm.value as NoteFormResult);
    this.dialogRef.close(formValue);
  }

  onCancel(): void {
    if (this.hasUnsavedChanges()) {
      const confirmed = confirm(this.translocoService.translate('common.unsavedChangesWarning'));
      if (!confirmed) {
        return;
      }
    }
    this.dialogRef.close();
  }

  private sanitizeFormValue(value: NoteFormResult): NoteFormResult {
    return {
      name: value.name.trim(),
      content: this.sanitizeContent(value.content),
      description: value.description?.trim(),
    };
  }

  private sanitizeContent(content: string): string {
    // First, validate for dangerous patterns
    const validation = this.validateContent(content);
    if (!validation.valid) {
      this.showMessage(validation.error || 'Invalid content', true);
      throw new Error(validation.error);
    }

    // Strip any HTML tags while preserving markdown syntax
    // We use DOMPurify to remove HTML but keep the text content (which includes markdown syntax)
    const sanitized = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true, // Keep text content, strip tags
    });

    return sanitized;
  }

  private validateContent(content: string): { valid: boolean; error?: string } {
    if (content.length > this.maxContentLength) {
      return { valid: false, error: 'noteEditor.errors.contentTooLong' };
    }

    // Check for script tags
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(content)) {
      return { valid: false, error: 'noteEditor.errors.scriptTagsNotAllowed' };
    }

    // Check for event handlers
    if (/on\w+\s*=/gi.test(content)) {
      return { valid: false, error: 'noteEditor.errors.eventHandlersNotAllowed' };
    }

    // Check for javascript: protocol
    if (/javascript:/gi.test(content)) {
      return { valid: false, error: 'noteEditor.errors.javascriptProtocolNotAllowed' };
    }

    // Check for data: URLs
    if (/data:text\/html/gi.test(content)) {
      return { valid: false, error: 'noteEditor.errors.dataUrlsNotAllowed' };
    }

    return { valid: true };
  }

  private showMessage(key: string, isError = false): void {
    const message = this.translocoService.translate(key);
    this.snackBar.open(message, '', {
      duration: isError ? 4000 : 2000,
      panelClass: isError ? ['error-snackbar'] : [],
    });
  }

  private async checkClipboardPermissions(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      this.clipboardHasContent = !!text;
    } catch {
      // Clipboard access might be denied, that's okay
      this.clipboardHasContent = false;
    }
  }
}
