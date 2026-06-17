import {
  Component,
  Inject,
  OnInit,
  OnDestroy,
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import { MermaidViewerService } from '@app/shared/services/mermaid-viewer.service';

import { NoteEditorBase } from '../note-editor/note-editor-base';

export type NoteEntityType = 'threat_model' | 'team' | 'project';

/** Minimal note shape the dialog needs for initialization */
export interface NoteEditorNote {
  id?: string;
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  sharable?: boolean;
}

export interface NoteEditorDialogData {
  mode: 'create' | 'edit';
  entityType: NoteEntityType;
  note?: NoteEditorNote;
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
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  sharable?: boolean;
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
    MatCheckboxModule,
    MatTooltipModule,
    TooltipAriaLabelDirective,
    MatSnackBarModule,
    TranslocoModule,
    MarkdownModule,
  ],
  templateUrl: './note-editor-dialog.component.html',
  styleUrls: ['./note-editor-dialog.component.scss'],
})
export class NoteEditorDialogComponent
  extends NoteEditorBase
  implements OnInit, OnDestroy, AfterViewChecked
{
  @Output() saveEvent = new EventEmitter<NoteFormResult>();
  @ViewChild('contentTextarea') contentTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('markdownPreview') markdownPreview?: ElementRef<HTMLDivElement>;

  noteForm!: FormGroup;
  mode: 'create' | 'edit';
  entityType: NoteEntityType;
  isReadOnly: boolean = false;
  previewMode = false;
  private originalContent = '';
  private originalName = '';
  private originalDescription = '';
  private originalIncludeInReport: boolean | null | undefined = true;
  private originalTimmyEnabled: boolean | undefined = true;
  private originalSharable: boolean | null | undefined = true;
  private createdNoteId?: string;

  readonly maxContentLength = 262144;
  readonly maxNameLength = 256;
  readonly maxDescriptionLength = 2048;

  // Clipboard state
  hasSelection = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<NoteEditorDialogComponent>,
    private snackBar: MatSnackBar,
    private translocoService: TranslocoService,
    @Inject(MAT_DIALOG_DATA) public data: NoteEditorDialogData,
    protected mermaidViewerService?: MermaidViewerService,
  ) {
    super();
    this.mode = data.mode;
    this.isReadOnly = data.isReadOnly || false;
    this.entityType = data.entityType;
  }

  ngOnInit(): void {
    const note = this.data.note;
    const isCreate = this.data.mode === 'create';

    const initialName = note?.name || '';
    const initialContent = note?.content || '';
    const initialDescription = note?.description || '';
    const initialIncludeInReport =
      this.entityType === 'threat_model' ? (isCreate ? true : note?.include_in_report) : undefined;
    const initialTimmyEnabled = note?.timmy_enabled ?? true;
    const initialSharable =
      this.entityType !== 'threat_model' ? (note?.sharable ?? true) : undefined;

    this.noteForm = this.fb.group({
      name: [initialName, [Validators.required, Validators.maxLength(this.maxNameLength)]],
      content: [initialContent, [Validators.required, Validators.maxLength(this.maxContentLength)]],
      description: [initialDescription, [Validators.maxLength(this.maxDescriptionLength)]],
      include_in_report: [initialIncludeInReport],
      timmy_enabled: [initialTimmyEnabled],
      sharable: [initialSharable],
    });

    this.originalName = initialName;
    this.originalContent = initialContent;
    this.originalDescription = initialDescription;
    // The reactive form coerces an `undefined` initial value to `null`, so the
    // stored originals must be normalized the same way — otherwise
    // hasUnsavedChanges() compares the control's `null` against a raw
    // `undefined` and reports a spurious change for an untouched note.
    this.originalIncludeInReport = initialIncludeInReport ?? null;
    this.originalTimmyEnabled = initialTimmyEnabled;
    this.originalSharable = initialSharable ?? null;

    // Start in preview mode if there is existing content, otherwise start in edit mode
    // Always use preview mode when read-only
    const hasExistingContent = initialContent.trim().length > 0;
    this.previewMode = this.isReadOnly || hasExistingContent;

    if (this.isReadOnly) {
      this.noteForm.disable();
    }

    // Check clipboard permissions on init
    void this.checkClipboardPermissions();
  }

  ngOnDestroy(): void {
    this.mermaidCleanup?.();
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

    const currentIncludeInReport = this.noteForm.get('include_in_report')?.value as
      | boolean
      | undefined;
    const currentTimmyEnabled = this.noteForm.get('timmy_enabled')?.value as boolean | undefined;
    const currentSharable = this.noteForm.get('sharable')?.value as boolean | undefined;

    return (
      currentName !== this.originalName ||
      currentContent !== this.originalContent ||
      currentDescription !== this.originalDescription ||
      currentIncludeInReport !== this.originalIncludeInReport ||
      currentTimmyEnabled !== this.originalTimmyEnabled ||
      currentSharable !== this.originalSharable
    );
  }

  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  onTextareaSelect(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.hasSelection = textarea.selectionStart !== textarea.selectionEnd;
  }

  onSave(): void {
    if (!this.noteForm.valid || !this.hasUnsavedChanges()) {
      return;
    }

    const formValue = this.getFormValue(this.noteForm.value as NoteFormResult);
    this.originalName = formValue.name;
    this.originalContent = formValue.content;
    this.originalDescription = formValue.description || '';
    // getFormValue only carries the field relevant to the entity type, so the
    // other is undefined here. Normalize to null to match the form control —
    // see the same `?? null` handling in ngOnInit.
    this.originalIncludeInReport = formValue.include_in_report ?? null;
    this.originalTimmyEnabled = formValue.timmy_enabled;
    this.originalSharable = formValue.sharable ?? null;
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
    const result: NoteFormResult = {
      name: value.name.trim(),
      content: value.content.trim(),
      description: value.description?.trim(),
      timmy_enabled: value.timmy_enabled,
    };
    if (this.entityType === 'threat_model') {
      result.include_in_report = value.include_in_report;
    } else {
      result.sharable = value.sharable;
    }
    return result;
  }

  showMessage(key: string, isError = false): void {
    const message = this.translocoService.translate(key);
    this.snackBar.open(message, '', {
      duration: isError ? 4000 : 2000,
      panelClass: isError ? ['error-snackbar'] : [],
    });
  }
}
