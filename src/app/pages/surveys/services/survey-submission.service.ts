import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, delay, map, tap } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  SurveySubmission,
  SurveySubmissionFilter,
  ListSurveySubmissionsResponse,
  CreateSubmissionRequest,
  UpdateSubmissionRequest,
  SubmissionStatus,
  SurveyUIState,
} from '@app/types/survey.types';
import { MOCK_SURVEY_SUBMISSIONS } from './survey-mock-data';

/**
 * Service for managing survey submissions
 * Handles CRUD operations for survey submissions/drafts
 */
@Injectable({
  providedIn: 'root',
})
export class SurveySubmissionService {
  private mySubmissionsSubject$ = new BehaviorSubject<SurveySubmission[]>([]);
  public mySubmissions$: Observable<SurveySubmission[]> = this.mySubmissionsSubject$.asObservable();

  private allSubmissionsSubject$ = new BehaviorSubject<SurveySubmission[]>([]);
  public allSubmissions$: Observable<SurveySubmission[]> =
    this.allSubmissionsSubject$.asObservable();

  // Mock data storage (will be replaced by API calls)
  private mockSubmissions: SurveySubmission[] = [...MOCK_SURVEY_SUBMISSIONS];
  private useMockData = true;
  private currentUserId = 'user-alice'; // Mock current user

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  /**
   * List submissions for the current user
   */
  public listMine(filter?: SurveySubmissionFilter): Observable<ListSurveySubmissionsResponse> {
    if (this.useMockData) {
      return this.mockListMine(filter);
    }

    const params = buildHttpParams(filter);
    return this.apiService
      .get<ListSurveySubmissionsResponse>('surveys/submissions/mine', params)
      .pipe(
        tap(response => {
          this.mySubmissionsSubject$.next(response.submissions);
          this.logger.debug('My submissions loaded', {
            count: response.submissions.length,
            total: response.total,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list my submissions', error);
          throw error;
        }),
      );
  }

  /**
   * List all submissions (for triage - requires appropriate permissions)
   */
  public listAll(filter?: SurveySubmissionFilter): Observable<ListSurveySubmissionsResponse> {
    if (this.useMockData) {
      return this.mockListAll(filter);
    }

    const params = buildHttpParams(filter);
    return this.apiService.get<ListSurveySubmissionsResponse>('surveys/submissions', params).pipe(
      tap(response => {
        this.allSubmissionsSubject$.next(response.submissions);
        this.logger.debug('All submissions loaded', {
          count: response.submissions.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list all submissions', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific submission by ID
   */
  public getById(submissionId: string): Observable<SurveySubmission> {
    if (this.useMockData) {
      return this.mockGetById(submissionId);
    }

    return this.apiService.get<SurveySubmission>(`surveys/submissions/${submissionId}`).pipe(
      tap(submission => {
        this.logger.debug('Submission loaded', { id: submission.id, status: submission.status });
      }),
      catchError(error => {
        this.logger.error('Failed to get submission', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new draft submission
   */
  public createDraft(templateId: string): Observable<SurveySubmission> {
    if (this.useMockData) {
      return this.mockCreateDraft(templateId);
    }

    const request: CreateSubmissionRequest = { template_id: templateId };
    return this.apiService
      .post<SurveySubmission>('surveys/submissions', request as unknown as Record<string, unknown>)
      .pipe(
        tap(submission => {
          this.logger.info('Draft submission created', { id: submission.id, templateId });
          this.listMine().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create draft submission', error);
          throw error;
        }),
      );
  }

  /**
   * Update a draft submission (save progress)
   */
  public updateDraft(
    submissionId: string,
    data: Record<string, unknown>,
    uiState?: SurveyUIState,
  ): Observable<SurveySubmission> {
    if (this.useMockData) {
      return this.mockUpdateDraft(submissionId, data, uiState);
    }

    const request: UpdateSubmissionRequest = { data, ui_state: uiState };
    return this.apiService
      .put<SurveySubmission>(
        `surveys/submissions/${submissionId}`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(submission => {
          this.logger.debug('Draft updated', { id: submission.id });
        }),
        catchError(error => {
          this.logger.error('Failed to update draft', error);
          throw error;
        }),
      );
  }

  /**
   * Submit a draft (locks it from editing)
   */
  public submit(submissionId: string): Observable<SurveySubmission> {
    if (this.useMockData) {
      return this.mockSubmit(submissionId);
    }

    return this.apiService
      .post<SurveySubmission>(`surveys/submissions/${submissionId}/submit`, {})
      .pipe(
        tap(submission => {
          this.logger.info('Submission submitted', { id: submission.id });
          this.listMine().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to submit submission', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a draft (only drafts can be deleted)
   */
  public deleteDraft(submissionId: string): Observable<void> {
    if (this.useMockData) {
      return this.mockDeleteDraft(submissionId);
    }

    return this.apiService.delete<void>(`surveys/submissions/${submissionId}`).pipe(
      tap(() => {
        this.logger.info('Draft deleted', { id: submissionId });
        this.listMine().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete draft', error);
        throw error;
      }),
    );
  }

  /**
   * Get drafts for a specific template (current user)
   */
  public getDraftsForTemplate(templateId: string): Observable<SurveySubmission[]> {
    return this.listMine({ template_id: templateId, status: 'draft' }).pipe(
      map(response => response.submissions),
    );
  }

  /**
   * Update submission status (triage/admin only)
   */
  public updateStatus(
    submissionId: string,
    status: SubmissionStatus,
  ): Observable<SurveySubmission> {
    if (this.useMockData) {
      return this.mockUpdateStatus(submissionId, status);
    }

    const request: UpdateSubmissionRequest = { status };
    return this.apiService
      .put<SurveySubmission>(
        `surveys/submissions/${submissionId}`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(submission => {
          this.logger.info('Submission status updated', { id: submission.id, status });
          this.listAll().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update submission status', error);
          throw error;
        }),
      );
  }

  /**
   * Link submission to a threat model
   */
  public linkToThreatModel(
    submissionId: string,
    threatModelId: string,
  ): Observable<SurveySubmission> {
    if (this.useMockData) {
      return this.mockLinkToThreatModel(submissionId, threatModelId);
    }

    return this.apiService
      .put<SurveySubmission>(`surveys/submissions/${submissionId}`, {
        threat_model_id: threatModelId,
      })
      .pipe(
        tap(() => {
          this.logger.info('Submission linked to threat model', {
            submissionId,
            threatModelId,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to link submission to threat model', error);
          throw error;
        }),
      );
  }

  // ============================================
  // Mock Data Methods (for development)
  // ============================================

  private mockListMine(filter?: SurveySubmissionFilter): Observable<ListSurveySubmissionsResponse> {
    let submissions = this.mockSubmissions.filter(s => s.user_id === this.currentUserId);
    submissions = this.applyFilters(submissions, filter);

    const total = submissions.length;
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 25;
    submissions = submissions.slice(offset, offset + limit);

    this.mySubmissionsSubject$.next(submissions);

    return of({
      submissions,
      total,
      limit,
      offset,
    }).pipe(delay(200));
  }

  private mockListAll(filter?: SurveySubmissionFilter): Observable<ListSurveySubmissionsResponse> {
    let submissions = [...this.mockSubmissions];
    submissions = this.applyFilters(submissions, filter);

    // Sort by created_at descending
    submissions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = submissions.length;
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 25;
    submissions = submissions.slice(offset, offset + limit);

    this.allSubmissionsSubject$.next(submissions);

    return of({
      submissions,
      total,
      limit,
      offset,
    }).pipe(delay(200));
  }

  private applyFilters(
    submissions: SurveySubmission[],
    filter?: SurveySubmissionFilter,
  ): SurveySubmission[] {
    if (!filter) return submissions;

    if (filter.template_id) {
      submissions = submissions.filter(s => s.template_id === filter.template_id);
    }
    if (filter.user_id) {
      submissions = submissions.filter(s => s.user_id === filter.user_id);
    }
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      submissions = submissions.filter(s => statuses.includes(s.status));
    }
    if (filter.submitted_after) {
      const after = new Date(filter.submitted_after);
      submissions = submissions.filter(s => s.submitted_at && new Date(s.submitted_at) >= after);
    }
    if (filter.submitted_before) {
      const before = new Date(filter.submitted_before);
      submissions = submissions.filter(s => s.submitted_at && new Date(s.submitted_at) <= before);
    }

    return submissions;
  }

  private mockGetById(submissionId: string): Observable<SurveySubmission> {
    const submission = this.mockSubmissions.find(s => s.id === submissionId);
    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }
    return of(submission).pipe(delay(100));
  }

  private mockCreateDraft(templateId: string): Observable<SurveySubmission> {
    const now = new Date().toISOString();
    const template = this.mockSubmissions.find(s => s.template_id === templateId);

    const submission: SurveySubmission = {
      id: `sub-${crypto.randomUUID().slice(0, 8)}`,
      template_id: templateId,
      template_name: template?.template_name ?? 'Unknown Template',
      template_version: template?.template_version ?? 1,
      user_id: this.currentUserId,
      user_email: 'alice@example.com',
      user_display_name: 'Alice Johnson',
      status: 'draft',
      data: {},
      ui_state: { currentPageNo: 0, isCompleted: false },
      created_at: now,
      modified_at: now,
    };

    this.mockSubmissions.push(submission);

    return of(submission).pipe(
      delay(200),
      tap(() => this.listMine().subscribe()),
    );
  }

  private mockUpdateDraft(
    submissionId: string,
    data: Record<string, unknown>,
    uiState?: SurveyUIState,
  ): Observable<SurveySubmission> {
    const index = this.mockSubmissions.findIndex(s => s.id === submissionId);
    if (index === -1) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const submission = this.mockSubmissions[index];
    if (submission.status !== 'draft') {
      throw new Error('Can only update draft submissions');
    }

    submission.data = data;
    if (uiState) {
      submission.ui_state = uiState;
    }
    submission.modified_at = new Date().toISOString();

    this.mockSubmissions[index] = submission;

    return of(submission).pipe(delay(100));
  }

  private mockSubmit(submissionId: string): Observable<SurveySubmission> {
    const index = this.mockSubmissions.findIndex(s => s.id === submissionId);
    if (index === -1) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const submission = this.mockSubmissions[index];
    if (submission.status !== 'draft') {
      throw new Error('Can only submit draft submissions');
    }

    const now = new Date().toISOString();
    submission.status = 'submitted';
    submission.submitted_at = now;
    submission.modified_at = now;
    submission.ui_state = undefined;

    this.mockSubmissions[index] = submission;

    return of(submission).pipe(
      delay(200),
      tap(() => this.listMine().subscribe()),
    );
  }

  private mockDeleteDraft(submissionId: string): Observable<void> {
    const index = this.mockSubmissions.findIndex(s => s.id === submissionId);
    if (index === -1) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const submission = this.mockSubmissions[index];
    if (submission.status !== 'draft') {
      throw new Error('Can only delete draft submissions');
    }

    this.mockSubmissions.splice(index, 1);

    return of(undefined).pipe(
      delay(200),
      tap(() => this.listMine().subscribe()),
    );
  }

  private mockUpdateStatus(
    submissionId: string,
    status: SubmissionStatus,
  ): Observable<SurveySubmission> {
    const index = this.mockSubmissions.findIndex(s => s.id === submissionId);
    if (index === -1) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const submission = this.mockSubmissions[index];
    const now = new Date().toISOString();

    submission.status = status;
    submission.modified_at = now;

    if (status === 'in_review' && !submission.reviewed_at) {
      submission.reviewed_at = now;
    }

    this.mockSubmissions[index] = submission;

    return of(submission).pipe(
      delay(200),
      tap(() => this.listAll().subscribe()),
    );
  }

  private mockLinkToThreatModel(
    submissionId: string,
    threatModelId: string,
  ): Observable<SurveySubmission> {
    const index = this.mockSubmissions.findIndex(s => s.id === submissionId);
    if (index === -1) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const submission = this.mockSubmissions[index];
    submission.threat_model_id = threatModelId;
    submission.modified_at = new Date().toISOString();

    this.mockSubmissions[index] = submission;

    return of(submission).pipe(delay(200));
  }
}
