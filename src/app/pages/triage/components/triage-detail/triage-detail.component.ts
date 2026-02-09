import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { TranslocoModule } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyResponseService } from '../../../surveys/services/survey-response.service';
import { SurveyService } from '../../../surveys/services/survey.service';
import { SurveyResponse, SurveyJsonSchema, ResponseStatus } from '@app/types/survey.types';
import {
  RevisionNotesDialogComponent,
  RevisionNotesDialogResult,
} from '../revision-notes-dialog/revision-notes-dialog.component';

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
  imports: [...COMMON_IMPORTS, ...ALL_MATERIAL_IMPORTS, TranslocoModule, UserDisplayComponent],
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
  formattedResponses: { question: string; answer: string; name: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private responseService: SurveyResponseService,
    private surveyService: SurveyService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
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
   * Format survey responses for display using survey definition
   */
  private formatResponses(surveyJson: SurveyJsonSchema): void {
    if (!this.response?.answers) {
      this.formattedResponses = [];
      return;
    }

    const responses: { question: string; answer: string; name: string }[] = [];
    const answers = this.response.answers;

    // Walk through all pages and elements to maintain order
    for (const page of surveyJson.pages ?? []) {
      for (const element of page.elements ?? []) {
        if (element.name && answers[element.name] !== undefined) {
          responses.push({
            name: element.name,
            question: element.title ?? element.name,
            answer: this.formatAnswer(answers[element.name]),
          });
        }
      }
    }

    this.formattedResponses = responses;
  }

  /**
   * Format responses without a definition (raw key/value display)
   */
  private formatResponsesWithoutDefinition(): void {
    if (!this.response?.answers) {
      this.formattedResponses = [];
      return;
    }

    this.formattedResponses = Object.entries(this.response.answers).map(([key, value]) => ({
      name: key,
      question: key,
      answer: this.formatAnswer(value),
    }));
  }

  /**
   * Format a single answer value for display
   */
  private formatAnswer(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return (value as unknown[]).map(v => String(v)).join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  }

  /**
   * Build status timeline
   */
  private buildStatusTimeline(response: SurveyResponse): void {
    const statuses: { key: ResponseStatus; label: string }[] = [
      { key: 'draft', label: 'Draft' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'ready_for_review', label: 'Ready for Review' },
      { key: 'review_created', label: 'Review Created' },
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
      label: s.label,
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
      .approve(this.response.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updatedResponse => {
          this.response = updatedResponse;
          this.buildStatusTimeline(updatedResponse);
          this.isUpdatingStatus = false;
          this.logger.info('Response approved', { id: updatedResponse.id });
        },
        error: err => {
          this.isUpdatingStatus = false;
          this.logger.error('Failed to approve response', err);
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
        },
        error: err => {
          this.isUpdatingStatus = false;
          this.logger.error('Failed to return response for revision', err);
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
          void this.router.navigate(['/tm', result.threat_model_id]);
        },
        error: err => {
          this.isUpdatingStatus = false;
          this.logger.error('Failed to create threat model from response', err);
        },
      });
  }

  /**
   * Navigate back to triage list
   */
  goBack(): void {
    void this.router.navigate(['/triage']);
  }

  /**
   * Get display label for a status
   */
  getStatusLabel(status: ResponseStatus): string {
    const labels: Record<ResponseStatus, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      needs_revision: 'Needs Revision',
      ready_for_review: 'Ready for Review',
      review_created: 'Review Created',
    };
    return labels[status] ?? status;
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
