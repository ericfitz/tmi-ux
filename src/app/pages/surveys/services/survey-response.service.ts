import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  SurveyResponse,
  SurveyResponseListItem,
  SurveyResponseFilter,
  ListSurveyResponsesResponse,
  CreateSurveyResponseRequest,
  UpdateSurveyResponseRequest,
  CreateThreatModelFromResponseResult,
  SurveyUIState,
  ResponseStatus,
} from '@app/types/survey.types';

/**
 * Service for managing survey responses
 * Handles CRUD operations, status transitions, and triage workflows
 */
@Injectable({
  providedIn: 'root',
})
export class SurveyResponseService {
  private myResponsesSubject$ = new BehaviorSubject<SurveyResponseListItem[]>([]);
  public myResponses$: Observable<SurveyResponseListItem[]> =
    this.myResponsesSubject$.asObservable();

  private allResponsesSubject$ = new BehaviorSubject<SurveyResponseListItem[]>([]);
  public allResponses$: Observable<SurveyResponseListItem[]> =
    this.allResponsesSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List responses for the current user
   */
  public listMine(filter?: SurveyResponseFilter): Observable<ListSurveyResponsesResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListSurveyResponsesResponse>('intake/survey_responses', params).pipe(
      tap(response => {
        this.myResponsesSubject$.next(response.survey_responses);
        this.logger.debug('My responses loaded', {
          count: response.survey_responses.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list my responses', error);
        throw error;
      }),
    );
  }

  /**
   * List all responses (for triage - requires Security Reviewers permissions)
   */
  public listAll(filter?: SurveyResponseFilter): Observable<ListSurveyResponsesResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListSurveyResponsesResponse>('triage/survey_responses', params).pipe(
      tap(response => {
        this.allResponsesSubject$.next(response.survey_responses);
        this.logger.debug('All responses loaded', {
          count: response.survey_responses.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list all responses', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific response by ID
   */
  public getById(responseId: string): Observable<SurveyResponse> {
    return this.apiService.get<SurveyResponse>(`intake/survey_responses/${responseId}`).pipe(
      tap(response => {
        this.logger.debug('Response loaded', {
          id: response.id,
          status: response.status,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to get response', error);
        throw error;
      }),
    );
  }

  /**
   * Get a response by ID (triage access)
   */
  public getByIdTriage(responseId: string): Observable<SurveyResponse> {
    return this.apiService.get<SurveyResponse>(`triage/survey_responses/${responseId}`).pipe(
      tap(response => {
        this.logger.debug('Response loaded (triage)', {
          id: response.id,
          status: response.status,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to get response (triage)', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new draft response
   */
  public createDraft(request: CreateSurveyResponseRequest): Observable<SurveyResponse> {
    return this.apiService
      .post<SurveyResponse>(
        'intake/survey_responses',
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(response => {
          this.logger.info('Draft response created', {
            id: response.id,
            surveyId: request.survey_id,
          });
          this.listMine().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create draft response', error);
          throw error;
        }),
      );
  }

  /**
   * Update a draft response (save progress)
   */
  public updateDraft(
    responseId: string,
    answers: Record<string, unknown>,
    uiState?: SurveyUIState,
    surveyId?: string,
  ): Observable<SurveyResponse> {
    const request: UpdateSurveyResponseRequest = {
      answers,
      ui_state: uiState,
      survey_id: surveyId,
    };
    return this.apiService
      .put<SurveyResponse>(
        `intake/survey_responses/${responseId}`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(response => {
          this.logger.debug('Draft updated', { id: response.id });
        }),
        catchError(error => {
          this.logger.error('Failed to update draft', error);
          throw error;
        }),
      );
  }

  /**
   * Submit a response for review (transitions draft/needs_revision → submitted)
   */
  public submit(responseId: string): Observable<SurveyResponse> {
    return this.apiService
      .patch<SurveyResponse>(`intake/survey_responses/${responseId}`, [
        { op: 'replace', path: '/status', value: 'submitted' },
      ])
      .pipe(
        tap(response => {
          this.logger.info('Response submitted', { id: response.id });
          this.listMine().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to submit response', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a draft response (only drafts can be deleted)
   */
  public deleteDraft(responseId: string): Observable<void> {
    return this.apiService.delete<void>(`intake/survey_responses/${responseId}`).pipe(
      tap(() => {
        this.logger.info('Draft deleted', { id: responseId });
        this.listMine().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete draft', error);
        throw error;
      }),
    );
  }

  /**
   * Get drafts for a specific survey (current user)
   */
  public getDraftsForSurvey(surveyId: string): Observable<SurveyResponseListItem[]> {
    return this.listMine({ survey_id: surveyId, status: 'draft' }).pipe(
      map(response => response.survey_responses),
    );
  }

  /**
   * Update the status of a response (triage only)
   */
  public updateStatus(responseId: string, status: ResponseStatus): Observable<SurveyResponse> {
    return this.apiService
      .patch<SurveyResponse>(`triage/survey_responses/${responseId}`, [
        { op: 'replace', path: '/status', value: status },
      ])
      .pipe(
        tap(response => {
          this.logger.info('Response status updated', { id: response.id, status });
          this.listAll().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update response status', error);
          throw error;
        }),
      );
  }

  /**
   * Return a response for revision (triage only)
   */
  public returnForRevision(responseId: string, revisionNotes: string): Observable<SurveyResponse> {
    return this.apiService
      .patch<SurveyResponse>(`triage/survey_responses/${responseId}`, [
        { op: 'replace', path: '/status', value: 'needs_revision' },
        { op: 'replace', path: '/revision_notes', value: revisionNotes },
      ])
      .pipe(
        tap(response => {
          this.logger.info('Response returned for revision', {
            id: response.id,
          });
          this.listAll().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to return response for revision', error);
          throw error;
        }),
      );
  }

  /**
   * Create a threat model from a response (triage only)
   */
  public createThreatModel(responseId: string): Observable<CreateThreatModelFromResponseResult> {
    return this.apiService
      .post<CreateThreatModelFromResponseResult>(
        `triage/survey_responses/${responseId}/create_threat_model`,
        {},
      )
      .pipe(
        tap(result => {
          this.logger.info('Threat model created from response', {
            responseId: result.survey_response_id,
            threatModelId: result.threat_model_id,
          });
          this.listAll().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create threat model from response', error);
          throw error;
        }),
      );
  }

  /**
   * Update the project_id on a survey response
   */
  public patchProjectId(responseId: string, projectId: string | null): Observable<SurveyResponse> {
    return this.apiService
      .patch<SurveyResponse>(`intake/survey_responses/${responseId}`, [
        { op: 'replace', path: '/project_id', value: projectId },
      ])
      .pipe(
        tap(() => {
          this.logger.info('Response project_id updated', { responseId, projectId });
        }),
        catchError(error => {
          this.logger.error('Failed to update response project_id', error);
          throw error;
        }),
      );
  }

  /**
   * Link a response to an existing threat model
   */
  public linkToThreatModel(responseId: string, threatModelId: string): Observable<SurveyResponse> {
    return this.apiService
      .patch<SurveyResponse>(`intake/survey_responses/${responseId}`, [
        {
          op: 'replace',
          path: '/linked_threat_model_id',
          value: threatModelId,
        },
      ])
      .pipe(
        tap(() => {
          this.logger.info('Response linked to threat model', {
            responseId,
            threatModelId,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to link response to threat model', error);
          throw error;
        }),
      );
  }
}
