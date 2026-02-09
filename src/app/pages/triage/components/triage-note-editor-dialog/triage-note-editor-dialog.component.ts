import { Component, Inject, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
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
import { ScrollIndicatorDirective } from '@app/shared/directives/scroll-indicator.directive';

export interface TriageNoteEditorDialogData {
  mode: 'create' | 'view';
  name?: string;
  content?: string;
}

export interface TriageNoteEditorResult {
  name: string;
  content: string;
}

@Component({
  selector: 'app-triage-note-editor-dialog',
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
    ScrollIndicatorDirective,
  ],
  templateUrl: './triage-note-editor-dialog.component.html',
  styleUrls: ['./triage-note-editor-dialog.component.scss'],
})
export class TriageNoteEditorDialogComponent implements OnInit, AfterViewChecked {
  @ViewChild('contentTextarea') contentTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('markdownPreview') markdownPreview?: ElementRef<HTMLDivElement>;

  noteForm!: FormGroup;
  mode: 'create' | 'view';
  previewMode = false;

  readonly maxContentLength = 32768;
  readonly maxNameLength = 256;

  hasSelection = false;
  private taskListCheckboxesInitialized = false;
  private anchorClickHandler?: (event: Event) => void;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TriageNoteEditorDialogComponent>,
    private snackBar: MatSnackBar,
    private translocoService: TranslocoService,
    @Inject(MAT_DIALOG_DATA) public data: TriageNoteEditorDialogData,
  ) {
    this.mode = data.mode;
  }

  ngOnInit(): void {
    this.noteForm = this.fb.group({
      name: [this.data.name || '', [Validators.required, Validators.maxLength(this.maxNameLength)]],
      content: [
        this.data.content || '',
        [Validators.required, Validators.maxLength(this.maxContentLength)],
      ],
    });

    const isViewMode = this.mode === 'view';
    const hasExistingContent = (this.data.content || '').trim().length > 0;
    this.previewMode = isViewMode || hasExistingContent;

    if (isViewMode) {
      this.noteForm.disable();
    }
  }

  ngAfterViewChecked(): void {
    if (this.previewMode && !this.taskListCheckboxesInitialized) {
      this.initializeTaskListCheckboxes();
      this.initializeAnchorLinks();
      this.taskListCheckboxesInitialized = true;
    } else if (!this.previewMode) {
      this.taskListCheckboxesInitialized = false;
    }
  }

  get dialogTitle(): string {
    const key =
      this.mode === 'view' ? 'triage.noteEditor.title.view' : 'triage.noteEditor.title.create';
    return this.translocoService.translate(key);
  }

  get isReadOnly(): boolean {
    return this.mode === 'view';
  }

  get currentContentLength(): number {
    const value = this.noteForm.get('content')?.value as string | undefined;
    return value?.length ?? 0;
  }

  get markdownContent(): string {
    const content = (this.noteForm.get('content')?.value as string | undefined) || '';
    return content;
  }

  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  onTextareaSelect(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.hasSelection = textarea.selectionStart !== textarea.selectionEnd;
  }

  async onCut(): Promise<void> {
    if (this.previewMode || !this.hasSelection) return;
    const textarea = this.contentTextarea?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    if (!selectedText) return;

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
      try {
        await navigator.clipboard.writeText(this.markdownContent);
        this.showMessage('noteEditor.copiedToClipboard');
      } catch {
        this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
      }
    } else {
      const textarea = this.contentTextarea?.nativeElement;
      if (!textarea || !this.hasSelection) return;
      const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      if (!selectedText) return;
      try {
        await navigator.clipboard.writeText(selectedText);
        this.showMessage('noteEditor.copiedToClipboard');
      } catch {
        this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
      }
    }
  }

  async onPaste(): Promise<void> {
    if (this.previewMode) return;
    const textarea = this.contentTextarea?.nativeElement;
    if (!textarea) return;

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
    if (!this.noteForm.valid) return;

    const result: TriageNoteEditorResult = {
      name: (this.noteForm.get('name')?.value as string).trim(),
      content: (this.noteForm.get('content')?.value as string).trim(),
    };
    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private showMessage(key: string, isError = false): void {
    const message = this.translocoService.translate(key);
    this.snackBar.open(message, '', {
      duration: isError ? 4000 : 2000,
      panelClass: isError ? ['error-snackbar'] : [],
    });
  }

  private initializeTaskListCheckboxes(): void {
    if (!this.markdownPreview) return;

    const checkboxes =
      this.markdownPreview.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const htmlCheckbox = checkbox as HTMLInputElement;
      // In view mode, disable checkboxes
      if (this.isReadOnly) {
        htmlCheckbox.disabled = true;
      }
    });
  }

  private initializeAnchorLinks(): void {
    if (!this.markdownPreview) return;

    if (this.anchorClickHandler) {
      this.markdownPreview.nativeElement.removeEventListener(
        'click',
        this.anchorClickHandler,
        true,
      );
    }

    this.anchorClickHandler = (event: Event): void => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          event.preventDefault();
          event.stopPropagation();
          const targetId = href.substring(1);
          if (!targetId) return;
          const targetElement = this.markdownPreview?.nativeElement.querySelector(
            `#${CSS.escape(targetId)}`,
          );
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    this.markdownPreview.nativeElement.addEventListener('click', this.anchorClickHandler, true);
  }
}
