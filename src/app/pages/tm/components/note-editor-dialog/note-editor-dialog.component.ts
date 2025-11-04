import {
  Component,
  Inject,
  OnInit,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewChecked,
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
import { Note } from '../../models/threat-model.model';

export interface NoteEditorDialogData {
  mode: 'create' | 'edit';
  note?: Note;
  isReadOnly?: boolean;
}

export interface NoteEditorResult {
  formValue: NoteFormResult;
  noteId?: string;
  wasCreated?: boolean;
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
export class NoteEditorDialogComponent implements OnInit, AfterViewChecked {
  @Output() saveEvent = new EventEmitter<NoteFormResult>();
  @ViewChild('contentTextarea') contentTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('markdownPreview') markdownPreview?: ElementRef<HTMLDivElement>;

  noteForm!: FormGroup;
  mode: 'create' | 'edit';
  isReadOnly: boolean = false;
  previewMode = false;
  private originalContent = '';
  private originalName = '';
  private originalDescription = '';
  private createdNoteId?: string;
  private taskListCheckboxesInitialized = false;
  private anchorClickHandler?: (event: Event) => void;

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
    this.isReadOnly = data.isReadOnly || false;
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

    this.originalName = (this.noteForm.get('name')?.value as string | undefined) || '';
    this.originalContent = (this.noteForm.get('content')?.value as string | undefined) || '';
    this.originalDescription =
      (this.noteForm.get('description')?.value as string | undefined) || '';

    // Start in preview mode if there is existing content, otherwise start in edit mode
    // Always use preview mode when read-only
    const hasExistingContent = this.originalContent.trim().length > 0;
    this.previewMode = this.isReadOnly || hasExistingContent;

    if (this.isReadOnly) {
      this.noteForm.disable();
    }

    // Check clipboard permissions on init
    void this.checkClipboardPermissions();
  }

  ngAfterViewChecked(): void {
    // Initialize task list checkboxes and anchor links after markdown is rendered
    if (this.previewMode && !this.taskListCheckboxesInitialized) {
      this.initializeTaskListCheckboxes();
      this.initializeAnchorLinks();
      this.taskListCheckboxesInitialized = true;
    } else if (!this.previewMode) {
      this.taskListCheckboxesInitialized = false;
    }
  }

  get dialogTitle(): string {
    const key = this.isReadOnly ? 'view' : this.mode;
    return this.translocoService.translate(`noteEditor.title.${key}`);
  }

  get currentContentLength(): number {
    const value = this.noteForm.get('content')?.value as string | undefined;
    return value?.length ?? 0;
  }

  get markdownContent(): string {
    // Return the raw markdown content - ngx-markdown and DOMPurify will handle rendering and sanitization
    const content = (this.noteForm.get('content')?.value as string | undefined) || '';
    return content;
  }

  hasUnsavedChanges(): boolean {
    if (!this.noteForm.valid) {
      return false;
    }

    const currentName = (this.noteForm.get('name')?.value as string | undefined) || '';
    const currentContent = (this.noteForm.get('content')?.value as string | undefined) || '';
    const currentDescription =
      (this.noteForm.get('description')?.value as string | undefined) || '';

    return (
      currentName !== this.originalName ||
      currentContent !== this.originalContent ||
      currentDescription !== this.originalDescription
    );
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
      // Copy the entire markdown content in preview mode
      const content = this.markdownContent;
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

    const formValue = this.getFormValue(this.noteForm.value as NoteFormResult);
    this.originalName = formValue.name;
    this.originalContent = formValue.content;
    this.originalDescription = formValue.description || '';
    this.saveEvent.emit(formValue);
    this.showMessage('noteEditor.savedSuccessfully');
  }

  onSaveAndClose(): void {
    if (!this.noteForm.valid) {
      return;
    }

    // If there are no unsaved changes, just close without triggering another save
    if (!this.hasUnsavedChanges()) {
      this.dialogRef.close();
      return;
    }

    const formValue = this.getFormValue(this.noteForm.value as NoteFormResult);
    const result: NoteEditorResult = {
      formValue,
      noteId: this.createdNoteId || this.data.note?.id,
      wasCreated: !!this.createdNoteId,
    };
    this.dialogRef.close(result);
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

  /**
   * Called by parent component when a note is created via the save button.
   * Updates internal state to track that we're now editing an existing note.
   */
  setCreatedNoteId(noteId: string): void {
    this.createdNoteId = noteId;
    this.mode = 'edit';
  }

  private getFormValue(value: NoteFormResult): NoteFormResult {
    return {
      name: value.name.trim(),
      content: value.content.trim(),
      description: value.description?.trim(),
    };
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

  /**
   * Initialize event listeners for task list checkboxes to make them interactive
   */
  private initializeTaskListCheckboxes(): void {
    if (!this.markdownPreview) {
      return;
    }

    const checkboxes =
      this.markdownPreview.nativeElement.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach((checkbox, index) => {
      const htmlCheckbox = checkbox as HTMLInputElement;
      // Remove any existing listeners
      htmlCheckbox.onclick = null;

      // Add click listener to update markdown content
      htmlCheckbox.onclick = (event): void => {
        event.preventDefault();
        this.toggleTaskListItem(index, !htmlCheckbox.checked);
      };
    });
  }

  /**
   * Toggle a task list item in the markdown content
   */
  private toggleTaskListItem(index: number, checked: boolean): void {
    const content = this.markdownContent;
    const lines = content.split('\n');
    let taskListIndex = -1;

    // Find the task list item by index
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match task list items: - [ ] or - [x] or - [X]
      if (/^(\s*)-\s\[([ xX])\]/.test(line)) {
        taskListIndex++;
        if (taskListIndex === index) {
          // Toggle the checkbox
          lines[i] = line.replace(/^(\s*)-\s\[([ xX])\]/, `$1- [${checked ? 'x' : ' '}]`);
          break;
        }
      }
    }

    // Update the form content
    const newContent = lines.join('\n');
    this.noteForm.get('content')?.setValue(newContent);

    // Reset initialization flag to re-initialize checkboxes after re-render
    this.taskListCheckboxesInitialized = false;
  }

  /**
   * Initialize event listeners for anchor links to handle internal navigation
   */
  private initializeAnchorLinks(): void {
    if (!this.markdownPreview) {
      return;
    }

    // Remove existing handler if present
    if (this.anchorClickHandler) {
      this.markdownPreview.nativeElement.removeEventListener(
        'click',
        this.anchorClickHandler,
        true,
      );
    }

    // Create delegated event handler for all anchor clicks
    this.anchorClickHandler = (event: Event): void => {
      const target = event.target as HTMLElement;

      // Find the closest anchor element (in case user clicked on child element)
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');

        if (href && href.startsWith('#')) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const targetId = href.substring(1);

          if (!targetId) {
            return;
          }

          // Find the target element within the preview
          const targetElement = this.markdownPreview?.nativeElement.querySelector(
            `#${CSS.escape(targetId)}`,
          );

          if (targetElement) {
            // Scroll to the target element with smooth behavior
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    // Add click listener to the preview container (event delegation)
    this.markdownPreview.nativeElement.addEventListener('click', this.anchorClickHandler, true);
  }
}
