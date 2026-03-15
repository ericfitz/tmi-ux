import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { MarkdownModule } from 'ngx-markdown';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { LanguageService } from '@app/i18n/language.service';
import { SurveyResponseService } from '../../../surveys/services/survey-response.service';
import { SurveyService } from '../../../surveys/services/survey.service';
import { TriageNoteService } from '../../services/triage-note.service';
import {
  SurveyResponse,
  SurveyJsonSchema,
  SurveyQuestion,
  ResponseStatus,
} from '@app/types/survey.types';
import { TriageNoteListItem, TriageNote } from '@app/types/triage-note.types';
import {
  RevisionNotesDialogComponent,
  RevisionNotesDialogResult,
} from '../revision-notes-dialog/revision-notes-dialog.component';
import {
  TriageNoteEditorDialogComponent,
  TriageNoteEditorDialogData,
  TriageNoteEditorResult,
} from '../triage-note-editor-dialog/triage-note-editor-dialog.component';

/**
 * Flattened survey response row for table display.
 * Panels and dynamic panels are expanded into individual rows.
 */
interface SurveyResponseRow {
  /** Panel/dynamic panel title; empty for top-level questions */
  group: string;
  /** Question ID of the panel (for tooltip); empty for top-level */
  groupId: string;
  /** Question title from schema, or raw key without schema */
  question: string;
  /** Question ID (for tooltip) */
  questionId: string;
  /** Formatted answer value */
  answer: string;
}

/**
 * Status timeline entry
 */
interface StatusTimelineEntry {
  status: string;
  label: string;
  timestamp: string | null;
  isActive: boolean;
  isCompleted: boolean;
}

/**
 * Triage detail component for viewing a single response
 * Allows status changes and TM creation from survey data
 */
@Component({
  selector: 'app-triage-detail',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...ALL_MATERIAL_IMPORTS,
    TranslocoModule,
    UserDisplayComponent,
    MarkdownModule,
  ],
  templateUrl: './triage-detail.component.html',
  styleUrl: './triage-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TriageDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Response being viewed */
  response: SurveyResponse | null = null;

  /** Survey JSON definition */
  surveyJson: SurveyJsonSchema | null = null;

  /** Loading state */
  isLoading = false;

  /** Error message */
  error: string | null = null;

  /** Whether status update is in progress */
  isUpdatingStatus = false;

  /** Status timeline */
  statusTimeline: StatusTimelineEntry[] = [];

  /** Formatted survey responses for display */
  formattedResponses: SurveyResponseRow[] = [];

  /** Whether survey schema was available for formatting */
  hasSchema = false;

  /** Columns displayed in the survey responses table */
  get responsesDisplayedColumns(): string[] {
    return this.hasSchema ? ['group', 'question', 'answer'] : ['question', 'answer'];
  }

  /** Triage notes for this response */
  triageNotes: TriageNoteListItem[] = [];

  /** Whether triage notes are loading */
  isLoadingNotes = false;

  /** Expandable section states */
  surveyResponsesSectionExpanded = true;
  triageNotesSectionExpanded = true;

  /** Columns displayed in the triage notes table */
  notesDisplayedColumns: string[] = ['name', 'created_by', 'created_at'];

  /** Current locale for date formatting */
  currentLocale = 'en-US';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private transloco: TranslocoService,
    private responseService: SurveyResponseService,
    private surveyService: SurveyService,
    private triageNoteService: TriageNoteService,
    private logger: LoggerService,
    private languageService: LanguageService,
  ) {}

  ngOnInit(): void {
    this.languageService.currentLanguage$.pipe(takeUntil(this.destroy$)).subscribe(language => {
      this.currentLocale = language.code;
    });

    this.route.paramMap
      .pipe(
        switchMap(params => {
          const responseId = params.get('responseId');
          if (!responseId) {
            throw new Error('No response ID provided');
          }
          this.isLoading = true;
          this.error = null;
          return this.responseService.getByIdTriage(responseId);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: response => {
          this.response = response;
          this.buildStatusTimeline(response);
          this.loadTriageNotes(response.id);

          // Use the survey_json snapshot from the response if available
          if (response.survey_json) {
            this.surveyJson = response.survey_json;
            this.formatResponses(response.survey_json);
            this.isLoading = false;
          } else {
            // Fallback: fetch from template service
            this.loadSurveyDefinition(response.survey_id);
          }
        },
        error: err => {
          this.isLoading = false;
          this.error = 'Failed to load response';
          this.logger.error('Failed to load triage response', err);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Fallback: load the survey JSON definition from template service
   */
  private loadSurveyDefinition(surveyId: string): void {
    this.surveyService
      .getSurveyJson(surveyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: surveyJson => {
          this.surveyJson = surveyJson;
          this.formatResponses(surveyJson);
          this.isLoading = false;
        },
        error: err => {
          this.isLoading = false;
          this.logger.error('Failed to load survey definition', err);
          this.formatResponsesWithoutDefinition();
        },
      });
  }

  /**
   * Format survey responses for display using survey definition.
   * Flattens panels and dynamic panels into individual rows.
   * Only recurses one level deep (panel > child); nested panels
   * within panels are treated as leaf elements.
   */
  private formatResponses(surveyJson: SurveyJsonSchema): void {
    if (!this.response?.answers) {
      this.formattedResponses = [];
      return;
    }

    const rows: SurveyResponseRow[] = [];
    const answers = this.response.answers;

    for (const page of surveyJson.pages ?? []) {
      for (const element of page.elements ?? []) {
        if (element.type === 'panel' && element.elements) {
          this.flattenPanel(element, answers, rows);
        } else if (element.type === 'paneldynamic' && element.templateElements) {
          this.flattenDynamicPanel(element, answers, rows);
        } else if (answers[element.name] !== undefined) {
          rows.push({
            group: '',
            groupId: '',
            question: element.title ?? element.name,
            questionId: element.name,
            answer: this.formatAnswer(answers[element.name]),
          });
        }
      }
    }

    this.hasSchema = true;
    this.formattedResponses = rows;
  }

  /**
   * Flatten a static panel's child questions into rows.
   * SurveyJS static panels are visual grouping only — child answers
   * are stored as flat top-level keys, not nested under the panel name.
   */
  private flattenPanel(
    element: SurveyQuestion,
    answers: Record<string, unknown>,
    rows: SurveyResponseRow[],
  ): void {
    for (const child of element.elements ?? []) {
      if (answers[child.name] !== undefined) {
        rows.push({
          group: element.title ?? element.name,
          groupId: element.name,
          question: child.title ?? child.name,
          questionId: child.name,
          answer: this.formatAnswer(answers[child.name]),
        });
      }
    }
  }

  /**
   * Flatten a dynamic panel's entries into numbered rows.
   * Dynamic panel answers are arrays of objects under answers[panelName].
   */
  private flattenDynamicPanel(
    element: SurveyQuestion,
    answers: Record<string, unknown>,
    rows: SurveyResponseRow[],
  ): void {
    const entries = answers[element.name];
    if (!Array.isArray(entries)) return;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i] as Record<string, unknown>;
      for (const child of element.templateElements ?? []) {
        if (entry[child.name] !== undefined) {
          rows.push({
            group: `${element.title ?? element.name} #${i + 1}`,
            groupId: element.name,
            question: child.title ?? child.name,
            questionId: child.name,
            answer: this.formatAnswer(entry[child.name]),
          });
        }
      }
    }
  }

  /**
   * Format responses without a definition (raw key/value display).
   * Produces 2-column rows (no group) with raw keys as question names.
   */
  private formatResponsesWithoutDefinition(): void {
    if (!this.response?.answers) {
      this.formattedResponses = [];
      return;
    }

    this.hasSchema = false;
    this.formattedResponses = Object.entries(this.response.answers).map(([key, value]) => ({
      group: '',
      groupId: '',
      question: key,
      questionId: key,
      answer: this.formatAnswer(value),
    }));
  }

  /**
   * Format a single answer value for display
   */
  private formatAnswer(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value))
      return value
        .map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)))
        .join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  }

  /**
   * Build status timeline
   */
  private buildStatusTimeline(response: SurveyResponse): void {
    const statuses: { key: ResponseStatus; labelKey: string }[] = [
      { key: 'draft', labelKey: 'surveys.status.draft' },
      { key: 'submitted', labelKey: 'surveys.status.submitted' },
      { key: 'ready_for_review', labelKey: 'surveys.status.readyForReview' },
      { key: 'review_created', labelKey: 'surveys.status.reviewCreated' },
    ];

    const statusOrder: Record<ResponseStatus, number> = {
      draft: 0,
      submitted: 1,
      needs_revision: 1,
      ready_for_review: 2,
      review_created: 3,
    };

    const currentIndex = statusOrder[response.status];

    this.statusTimeline = statuses.map((s, index) => ({
      status: s.key,
      label: s.labelKey,
      timestamp: this.getTimestampForStatus(response, s.key),
      isActive: index === currentIndex,
      isCompleted: index < currentIndex,
    }));
  }

  /**
   * Get timestamp for a status from the response
   */
  private getTimestampForStatus(response: SurveyResponse, status: ResponseStatus): string | null {
    switch (status) {
      case 'draft':
        return response.created_at;
      case 'submitted':
        return response.submitted_at ?? null;
      case 'ready_for_review':
        return response.reviewed_at ?? null;
      default:
        return null;
    }
  }

  /**
   * Approve a response (submitted → ready_for_review)
   */
  approveResponse(): void {
    if (!this.response) return;

    this.isUpdatingStatus = true;

    this.responseService
      .updateStatus(this.response.id, 'ready_for_review')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedResponse: SurveyResponse) => {
          this.response = updatedResponse;
          this.buildStatusTimeline(updatedResponse);
          this.isUpdatingStatus = false;
          this.logger.info('Response approved', { id: updatedResponse.id });
          this.snackBar.open(
            this.transloco.translate('triage.messages.approveSuccess'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
        },
        error: (err: unknown) => {
          this.isUpdatingStatus = false;
          this.logger.error('Failed to approve response', err);
          this.snackBar.open(
            this.transloco.translate('triage.messages.approveError'),
            this.transloco.translate('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  /**
   * Open the revision notes dialog, then return for revision if confirmed
   */
  openRevisionDialog(): void {
    const dialogRef = this.dialog.open<
      RevisionNotesDialogComponent,
      void,
      RevisionNotesDialogResult
    >(RevisionNotesDialogComponent, {
      width: '500px',
      disableClose: true,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.returnForRevision(result.notes);
        }
      });
  }

  /**
   * Return a response for revision
   */
  private returnForRevision(notes: string): void {
    if (!this.response) return;

    this.isUpdatingStatus = true;

    this.responseService
      .returnForRevision(this.response.id, notes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updatedResponse => {
          this.response = updatedResponse;
          this.buildStatusTimeline(updatedResponse);
          this.isUpdatingStatus = false;
          this.logger.info('Response returned for revision', { id: updatedResponse.id });
          this.snackBar.open(
            this.transloco.translate('triage.messages.returnForRevisionSuccess'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
        },
        error: err => {
          this.isUpdatingStatus = false;
          this.logger.error('Failed to return response for revision', err);
          this.snackBar.open(
            this.transloco.translate('triage.messages.returnForRevisionError'),
            this.transloco.translate('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  /**
   * Create a threat model from this response
   */
  createThreatModel(): void {
    if (!this.response) return;

    this.isUpdatingStatus = true;

    this.responseService
      .createThreatModel(this.response.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          this.isUpdatingStatus = false;
          this.logger.info('Threat model created from response', {
            responseId: result.survey_response_id,
            threatModelId: result.threat_model_id,
          });
          this.snackBar.open(
            this.transloco.translate('triage.messages.createThreatModelSuccess'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
          void this.router.navigate(['/tm', result.threat_model_id]);
        },
        error: err => {
          this.isUpdatingStatus = false;
          this.logger.error('Failed to create threat model from response', err);
          this.snackBar.open(
            this.transloco.translate('triage.messages.createThreatModelError'),
            this.transloco.translate('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  /**
   * Load triage notes for the current response
   */
  private loadTriageNotes(responseId: string): void {
    this.isLoadingNotes = true;
    this.triageNoteService
      .list(responseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.triageNotes = response.triage_notes;
          this.isLoadingNotes = false;
        },
        error: (err: unknown) => {
          this.isLoadingNotes = false;
          this.logger.error('Failed to load triage notes', err);
        },
      });
  }

  /**
   * Toggle survey responses section
   */
  toggleSurveyResponsesSection(): void {
    this.surveyResponsesSectionExpanded = !this.surveyResponsesSectionExpanded;
  }

  /**
   * Toggle triage notes section
   */
  toggleTriageNotesSection(): void {
    this.triageNotesSectionExpanded = !this.triageNotesSectionExpanded;
  }

  /**
   * Open the note editor dialog to create a new triage note
   */
  openNoteEditor(): void {
    if (!this.response) return;

    const dialogData: TriageNoteEditorDialogData = { mode: 'create' };
    const dialogRef = this.dialog.open<
      TriageNoteEditorDialogComponent,
      TriageNoteEditorDialogData,
      TriageNoteEditorResult
    >(TriageNoteEditorDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      disableClose: true,
      data: dialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.createNote(result);
        }
      });
  }

  /**
   * View a triage note in the editor dialog (read-only)
   */
  viewNote(note: TriageNoteListItem): void {
    if (!this.response) return;

    // Fetch the full note content first
    this.triageNoteService
      .getById(this.response.id, note.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullNote: TriageNote) => {
          const dialogData: TriageNoteEditorDialogData = {
            mode: 'view',
            name: fullNote.name,
            content: fullNote.content,
          };
          this.dialog.open<TriageNoteEditorDialogComponent, TriageNoteEditorDialogData>(
            TriageNoteEditorDialogComponent,
            {
              width: '700px',
              maxWidth: '90vw',
              data: dialogData,
            },
          );
        },
        error: (err: unknown) => {
          this.logger.error('Failed to load triage note', err);
        },
      });
  }

  /**
   * Create a new triage note via the service
   */
  private createNote(result: TriageNoteEditorResult): void {
    if (!this.response) return;

    this.triageNoteService
      .create(this.response.id, { name: result.name, content: result.content })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadTriageNotes(this.response!.id);
        },
        error: (err: unknown) => {
          this.logger.error('Failed to create triage note', err);
        },
      });
  }

  /**
   * Copy text to clipboard with snackbar feedback
   */
  copyToClipboard(text: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.snackBar.open(
          this.transloco.translate('common.copiedToClipboard'),
          this.transloco.translate('common.close'),
          { duration: 2000 },
        );
      })
      .catch((err: unknown) => {
        this.logger.error('Could not copy text: ', err);
      });
  }

  /**
   * Copy the response ID to clipboard
   */
  copyResponseId(): void {
    if (this.response?.id) {
      this.copyToClipboard(this.response.id);
    }
  }

  /**
   * Navigate back to triage list
   */
  goBack(): void {
    void this.router.navigate(['/triage']);
  }

  /**
   * Convert snake_case status to camelCase i18n key
   */
  getStatusKey(status: ResponseStatus): string {
    const keyMap: Record<ResponseStatus, string> = {
      draft: 'draft',
      submitted: 'submitted',
      needs_revision: 'needsRevision',
      ready_for_review: 'readyForReview',
      review_created: 'reviewCreated',
    };
    return keyMap[status] ?? status;
  }

  /**
   * Get CSS class for a status
   */
  getStatusClass(status: ResponseStatus): string {
    const statusClasses: Record<ResponseStatus, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      needs_revision: 'status-needs-revision',
      ready_for_review: 'status-ready-for-review',
      review_created: 'status-review-created',
    };
    return statusClasses[status] ?? '';
  }
}
