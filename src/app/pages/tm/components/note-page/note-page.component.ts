import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MarkdownModule } from 'ngx-markdown';
import { identity, MonoTypeOperatorFunction } from 'rxjs';
import { skip } from 'rxjs/operators';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { ThreatModelService } from '../../services/threat-model.service';
import { ThreatModelAuthorizationService } from '../../services/threat-model-authorization.service';
import { Note, ThreatModel } from '../../models/threat-model.model';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../metadata-dialog/metadata-dialog.component';
import {
  InvokeAddonDialogComponent,
  InvokeAddonDialogData,
  InvokeAddonDialogResult,
} from '../invoke-addon-dialog/invoke-addon-dialog.component';
import { AddonService } from '../../../../core/services/addon.service';
import { Addon } from '../../../../types/addon.types';
import {
  DeleteConfirmationDialogComponent,
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';

/**
 * Interface for note form values
 */
interface NoteFormValues {
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;
}

/**
 * Full-page component for viewing and editing individual notes.
 * Replaces the dialog for editing existing notes from the tm-edit page.
 */
@Component({
  selector: 'app-note-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    MarkdownModule,
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
  ],
  templateUrl: './note-page.component.html',
  styleUrls: ['./note-page.component.scss'],
})
export class NotePageComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('contentTextarea') contentTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('markdownPreview') markdownPreview?: ElementRef<HTMLDivElement>;

  private destroyRef: DestroyRef | null = null;

  // Route data
  threatModelId = '';
  noteId = '';
  threatModel: ThreatModel | null = null;
  note: Note | null = null;

  // Form
  noteForm: FormGroup;

  // Authorization
  canEdit = false;

  // Localization
  currentLocale = 'en-US';
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  // Markdown state
  previewMode = false;
  hasSelection = false;
  clipboardHasContent = false;
  private taskListCheckboxesInitialized = false;
  private anchorClickHandler?: (event: Event) => void;

  // Track if save is in progress
  isSaving = false;

  // Addons for note
  addonsForNote: Addon[] = [];

  // Max lengths
  readonly maxContentLength = 65536;
  readonly maxNameLength = 256;
  readonly maxDescriptionLength = 1024;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private logger: LoggerService,
    private languageService: LanguageService,
    private translocoService: TranslocoService,
    private threatModelService: ThreatModelService,
    private authorizationService: ThreatModelAuthorizationService,
    private addonService: AddonService,
    @Optional() destroyRef?: DestroyRef,
  ) {
    this.destroyRef = destroyRef ?? null;
    this.noteForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(this.maxNameLength)]],
      content: ['', [Validators.required, Validators.maxLength(this.maxContentLength)]],
      description: ['', Validators.maxLength(this.maxDescriptionLength)],
      include_in_report: [true],
    });
  }

  /**
   * Helper to conditionally apply takeUntilDestroyed
   * Returns identity operator when destroyRef is not available (tests)
   */
  private untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }

  ngOnInit(): void {
    // Get route parameters
    this.threatModelId = this.route.snapshot.paramMap.get('id') || '';
    this.noteId = this.route.snapshot.paramMap.get('noteId') || '';

    // Get resolved threat model
    this.threatModel = this.route.snapshot.data['threatModel'] as ThreatModel | null;

    if (!this.threatModel) {
      this.logger.error('Threat model not found');
      void this.router.navigate(['/dashboard']);
      return;
    }

    // Try to find note in threat model's cached notes
    const cachedNote = this.threatModel.notes?.find(n => n.id === this.noteId);

    // The list endpoint returns NoteListItem which excludes content for performance.
    // We must fetch the full note from the API to get the content.
    this.threatModelService
      .getNoteById(this.threatModelId, this.noteId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: note => {
          if (!note) {
            this.logger.warn('Note not found from API', {
              threatModelId: this.threatModelId,
              noteId: this.noteId,
            });
            // Fall back to cached note if available (though content may be missing)
            if (cachedNote) {
              this.note = cachedNote;
              this.initializeAfterNoteLoaded();
            } else {
              void this.router.navigate(['/tm', this.threatModelId], {
                queryParams: { error: 'note_not_found' },
              });
            }
            return;
          }

          this.note = note;
          this.initializeAfterNoteLoaded();
        },
        error: () => {
          // On API error, try using cached note if available
          if (cachedNote) {
            this.logger.warn('Failed to fetch note from API, using cached data', {
              threatModelId: this.threatModelId,
              noteId: this.noteId,
            });
            this.note = cachedNote;
            this.initializeAfterNoteLoaded();
          } else {
            void this.router.navigate(['/tm', this.threatModelId], {
              queryParams: { error: 'note_not_found' },
            });
          }
        },
      });

    // Set up subscriptions that don't depend on note data
    this.authorizationService.canEdit$.pipe(this.untilDestroyed()).subscribe(canEdit => {
      this.canEdit = canEdit;
      this.updateFormEditability();
    });

    this.languageService.currentLanguage$
      .pipe(skip(1), this.untilDestroyed())
      .subscribe(language => {
        this.currentLocale = language.code;
        this.currentDirection = language.rtl ? 'rtl' : 'ltr';
      });

    this.languageService.direction$.pipe(this.untilDestroyed()).subscribe(direction => {
      this.currentDirection = direction;
    });

    // Load addons
    this.loadAddons();

    // Check clipboard permissions
    void this.checkClipboardPermissions();
  }

  /**
   * Initialize component after note data is loaded
   */
  private initializeAfterNoteLoaded(): void {
    this.logger.info('Note page loaded', {
      threatModelId: this.threatModelId,
      noteId: this.noteId,
      noteName: this.note?.name,
      hasContent: !!this.note?.content,
    });

    // Populate form with note data
    this.populateForm();

    // Update form editability
    this.updateFormEditability();
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

  ngOnDestroy(): void {
    // Remove anchor click handler if present
    if (this.anchorClickHandler && this.markdownPreview) {
      this.markdownPreview.nativeElement.removeEventListener(
        'click',
        this.anchorClickHandler,
        true,
      );
    }
  }

  /**
   * Populate form with note data
   */
  private populateForm(): void {
    if (!this.note) return;

    this.noteForm.patchValue({
      name: this.note.name,
      content: this.note.content || '',
      description: this.note.description || '',
      include_in_report: this.note.include_in_report,
    });

    // Mark form as pristine after initial population
    this.noteForm.markAsPristine();

    // Start in preview mode if there is existing content, otherwise start in edit mode
    // Always use preview mode when read-only
    const hasExistingContent = (this.note.content || '').trim().length > 0;
    this.previewMode = !this.canEdit || hasExistingContent;
  }

  /**
   * Update form editability based on permissions
   */
  private updateFormEditability(): void {
    if (this.canEdit) {
      this.noteForm.enable();
    } else {
      this.noteForm.disable();
    }
  }

  /**
   * Navigate back to threat model page
   */
  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  /**
   * Cancel and navigate back
   */
  cancel(): void {
    if (this.noteForm.dirty) {
      const confirmed = window.confirm(
        this.translocoService.translate('common.unsavedChangesWarning') ||
          'You have unsaved changes. Are you sure you want to close?',
      );
      if (confirmed) {
        this.navigateBack();
      }
    } else {
      this.navigateBack();
    }
  }

  /**
   * Save the note
   */
  save(): void {
    if (this.noteForm.invalid || !this.canEdit || this.isSaving) return;

    this.isSaving = true;

    const formValues = this.noteForm.getRawValue() as NoteFormValues;

    const noteData: Partial<Note> = {
      name: formValues.name.trim(),
      content: formValues.content.trim(),
      description: formValues.description?.trim() || undefined,
      include_in_report: formValues.include_in_report,
    };

    this.threatModelService
      .updateNote(this.threatModelId, this.noteId, noteData)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.snackBar.open(
            this.translocoService.translate('common.savedSuccessfully'),
            this.translocoService.translate('common.close'),
            { duration: 3000 },
          );
          this.navigateBack();
        },
        error: err => {
          this.isSaving = false;
          this.logger.error('Failed to save note', err);
          this.snackBar.open(
            this.translocoService.translate('common.saveFailed'),
            this.translocoService.translate('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  /**
   * Delete the note
   */
  deleteNote(): void {
    if (!this.canEdit || !this.note) return;

    // Show confirmation dialog
    const dialogData: DeleteConfirmationDialogData = {
      id: this.note.id,
      name: this.note.name,
      objectType: 'note',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this.threatModelService
          .deleteNote(this.threatModelId, this.noteId)
          .pipe(this.untilDestroyed())
          .subscribe({
            next: () => {
              this.snackBar.open(
                this.translocoService.translate('common.deletedSuccessfully') ||
                  'Deleted successfully',
                this.translocoService.translate('common.close') || 'Close',
                { duration: 3000 },
              );
              this.navigateBack();
            },
            error: err => {
              this.logger.error('Failed to delete note', err);
              this.snackBar.open(
                this.translocoService.translate('common.deleteFailed') || 'Delete failed',
                this.translocoService.translate('common.close') || 'Close',
                { duration: 5000 },
              );
            },
          });
      }
    });
  }

  /**
   * Open metadata dialog
   */
  openMetadataDialog(): void {
    if (!this.note) return;

    const dialogRef = this.dialog.open(MetadataDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      data: {
        metadata: this.note.metadata || [],
        isReadOnly: !this.canEdit,
        entityType: 'note',
        entityId: this.noteId,
        threatModelId: this.threatModelId,
      } as MetadataDialogData,
    });

    dialogRef
      .afterClosed()
      .subscribe((result: { metadata: { key: string; value: string }[] } | undefined) => {
        if (result && this.note) {
          this.note.metadata = result.metadata.map(m => ({ key: m.key, value: m.value }));
        }
      });
  }

  /**
   * Load addons from server and filter for note type
   */
  private loadAddons(): void {
    this.addonService
      .list()
      .pipe(this.untilDestroyed())
      .subscribe({
        next: response => {
          this.addonsForNote = (response.addons ?? []).filter(addon =>
            addon.objects?.includes('note'),
          );
        },
        error: error => {
          this.logger.error('Failed to load addons', error);
          this.addonsForNote = [];
        },
      });
  }

  /**
   * Gets the icon name for display, handling material-symbols: prefix
   */
  getAddonIcon(addon: Addon): string {
    if (!addon.icon) {
      return 'extension';
    }
    return addon.icon.replace('material-symbols:', '');
  }

  /**
   * Invoke addon for this note
   */
  invokeAddon(addon: Addon): void {
    if (!this.threatModel || !this.note) {
      this.logger.error('Cannot invoke addon: no threat model or note loaded');
      return;
    }

    const dialogData: InvokeAddonDialogData = {
      addon,
      threatModelId: this.threatModelId,
      threatModelName: this.threatModel.name,
      objectType: 'note',
      isBulk: false,
      objectId: this.noteId,
      objectName: this.note.name,
    };

    const dialogRef = this.dialog.open(InvokeAddonDialogComponent, {
      width: '550px',
      maxHeight: '90vh',
      data: dialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: InvokeAddonDialogResult | undefined) => {
        if (result?.submitted && result.response) {
          this.logger.info('Addon invoked successfully', {
            addonId: addon.id,
            noteId: this.noteId,
          });
        }
      });
  }

  // Markdown toolbar methods

  /**
   * Get current content length for character count display
   */
  get currentContentLength(): number {
    const value = this.noteForm.get('content')?.value as string | undefined;
    return value?.length ?? 0;
  }

  /**
   * Get markdown content for preview
   */
  get markdownContent(): string {
    const content = (this.noteForm.get('content')?.value as string | undefined) || '';
    return content;
  }

  /**
   * Toggle preview mode
   */
  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  /**
   * Handle textarea selection changes
   */
  onTextareaSelect(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.hasSelection = textarea.selectionStart !== textarea.selectionEnd;
  }

  /**
   * Cut selected text to clipboard
   */
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

  /**
   * Copy selected text or all content to clipboard
   */
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

  /**
   * Paste text from clipboard
   */
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

  /**
   * Show a snackbar message
   */
  private showMessage(key: string, isError = false): void {
    const message = this.translocoService.translate(key);
    this.snackBar.open(message, '', {
      duration: isError ? 4000 : 2000,
      panelClass: isError ? ['error-snackbar'] : [],
    });
  }

  /**
   * Check clipboard permissions on init
   */
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
