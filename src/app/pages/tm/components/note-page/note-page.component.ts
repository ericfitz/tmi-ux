import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  ChangeDetectionStrategy,
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
import { MermaidViewerService } from '../../../../shared/services/mermaid-viewer.service';
import { NoteEditorBase } from '@app/shared/components/note-editor/note-editor-base';

/**
 * Interface for note form values
 */
interface NoteFormValues {
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./note-page.component.scss'],
})
// SEM@7cd21c172e244e77769f5fd8fef3256dc42149dc: page component for viewing and editing a threat model note with markdown support
export class NotePageComponent
  extends NoteEditorBase
  implements OnInit, OnDestroy, AfterViewChecked
{
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

  // Track if save is in progress
  isSaving = false;

  // Addons for note
  addonsForNote: Addon[] = [];

  // Max lengths
  readonly maxContentLength = 262144;
  readonly maxNameLength = 256;
  readonly maxDescriptionLength = 2048;

  // SEM@7cd21c172e244e77769f5fd8fef3256dc42149dc: initialize the note form group with validation constraints (mutates shared state)
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
    protected mermaidViewerService?: MermaidViewerService,
  ) {
    super();
    this.destroyRef = destroyRef ?? null;
    this.noteForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(this.maxNameLength)]],
      content: ['', [Validators.required, Validators.maxLength(this.maxContentLength)]],
      description: ['', Validators.maxLength(this.maxDescriptionLength)],
      include_in_report: [true],
      timmy_enabled: [true],
    });
  }

  /**
   * Helper to conditionally apply takeUntilDestroyed
   * Returns identity operator when destroyRef is not available (tests)
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: return a takeUntilDestroyed operator, or identity when destroyRef is absent (pure)
  private untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }

  // SEM@c1e06937ecde01209831669d215f9ed6b624ee37: fetch note from API, set up auth and language subscriptions, load addons (reads DB)
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

          // Merge with cached note to ensure server-managed fields (created_at,
          // modified_at) are present even if the individual note endpoint omits them.
          this.note = {
            ...note,
            created_at: note.created_at || cachedNote?.created_at || '',
            modified_at: note.modified_at || cachedNote?.modified_at || '',
          };
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
  // SEM@3f2ef70d50160b7e609c1ffc5884f66ac1ce3264: populate form and apply edit permissions once note data is available (mutates shared state)
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

  // SEM@955e86c38b8b27985a838cc5a692ed3a5fbc0eb9: remove anchor click handler and clean up mermaid viewers on teardown (mutates shared state)
  ngOnDestroy(): void {
    // Remove anchor click handler if present
    if (this.anchorClickHandler && this.markdownPreview) {
      this.markdownPreview.nativeElement.removeEventListener(
        'click',
        this.anchorClickHandler,
        true,
      );
    }
    // Clean up mermaid viewers
    this.mermaidCleanup?.();
  }

  /**
   * Populate form with note data
   */
  // SEM@ca308fb03ad87332d0865bc40ee7c392e48f78a1: patch form fields from loaded note data and set initial preview mode (mutates shared state)
  private populateForm(): void {
    if (!this.note) return;

    this.noteForm.patchValue({
      name: this.note.name,
      content: this.note.content || '',
      description: this.note.description || '',
      include_in_report: this.note.include_in_report,
      timmy_enabled: this.note.timmy_enabled ?? true,
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: enable or disable the note form based on edit permission (mutates shared state)
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: route back to the parent threat model page
  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  /**
   * Cancel and navigate back
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: discard note edits and navigate back, prompting if there are unsaved changes
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
  // SEM@ca308fb03ad87332d0865bc40ee7c392e48f78a1: update the note via API and navigate back on success (reads DB)
  save(): void {
    if (this.noteForm.invalid || !this.canEdit || this.isSaving) return;

    this.isSaving = true;

    const formValues = this.noteForm.getRawValue() as NoteFormValues;

    const noteData: Partial<Note> = {
      name: formValues.name.trim(),
      content: formValues.content.trim(),
      description: formValues.description?.trim() || undefined,
      include_in_report: formValues.include_in_report,
      timmy_enabled: formValues.timmy_enabled,
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
  // SEM@6f6a3c38fe60c48b7e5f30344fd306519e169b05: confirm and delete the current note via API, then navigate back (reads DB)
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: open the metadata dialog for the note and apply returned changes (mutates shared state)
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
  // SEM@d790b8bd7f1bf990d1aec2d3118089a501ee6f98: fetch addon list and filter to addons applicable to note objects (reads DB)
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: resolve an addon's icon name, stripping the material-symbols prefix (pure)
  getAddonIcon(addon: Addon): string {
    if (!addon.icon) {
      return 'extension';
    }
    return addon.icon.replace('material-symbols:', '');
  }

  /**
   * Invoke addon for this note
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: dispatch an addon dialog for the current note and handle the result
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: toggle markdown preview mode on and off (mutates shared state)
  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  /**
   * Handle textarea selection changes
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: track whether the user has an active text selection in the editor (mutates shared state)
  onTextareaSelect(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.hasSelection = textarea.selectionStart !== textarea.selectionEnd;
  }

  /**
   * Show a snackbar message
   */
  // SEM@7cd21c172e244e77769f5fd8fef3256dc42149dc: display a localized snackbar notification, styled as error if requested
  showMessage(key: string, isError = false): void {
    const message = this.translocoService.translate(key);
    this.snackBar.open(message, '', {
      duration: isError ? 4000 : 2000,
      panelClass: isError ? ['error-snackbar'] : [],
    });
  }
}
