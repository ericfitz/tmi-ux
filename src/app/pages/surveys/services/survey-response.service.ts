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
// SEM@07e0ae4dd61bd80b68323b816ae231d8f4861934: manage survey response lifecycle: CRUD, status transitions, and triage workflows (reads DB)
export class SurveyResponseService {
  private myResponsesSubject$ = new BehaviorSubject<SurveyResponseListItem[]>([]);
  public myResponses$: Observable<SurveyResponseListItem[]> =
    this.myResponsesSubject$.asObservable();

  private allResponsesSubject$ = new BehaviorSubject<SurveyResponseListItem[]>([]);
  public allResponses$: Observable<SurveyResponseListItem[]> =
    this.allResponsesSubject$.asObservable();

  // SEM@feaf765d0e4f372d17e38da0bcda6854583b55f8: inject API and logger dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List responses for the current user
   */
  // SEM@07e0ae4dd61bd80b68323b816ae231d8f4861934: fetch the current user's survey responses and update shared state (mutates shared state)
  public listMine(filter?: SurveyResponseFilter): Observable<ListSurveyResponsesResponse> {
    // Default to the server cap so small deployments (e.g., E2E runs that
    // accumulate many drafts/responses) show every response without paging.
    const params = buildHttpParams({ limit: 100, ...filter });
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
  // SEM@07e0ae4dd61bd80b68323b816ae231d8f4861934: fetch all survey responses for triage and update shared state (mutates shared state)
  public listAll(filter?: SurveyResponseFilter): Observable<ListSurveyResponsesResponse> {
    const params = buildHttpParams({ limit: 100, ...filter });
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch a single survey response by ID via the intake endpoint (reads DB)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch a single survey response by ID via the triage endpoint (reads DB)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: store a new draft survey response and refresh the user's response list (mutates shared state)
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
  // SEM@460788d1a27cc01214df67533d368460b11f3568: update answers and UI state on an existing draft survey response (reads DB)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: transition a survey response status to submitted and refresh the user's list (mutates shared state)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: delete a draft survey response and refresh the user's response list (mutates shared state)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch the current user's draft responses for a specific survey (reads DB)
  public getDraftsForSurvey(surveyId: string): Observable<SurveyResponseListItem[]> {
    return this.listMine({ survey_id: surveyId, status: 'draft' }).pipe(
      map(response => response.survey_responses),
    );
  }

  /**
   * Update the status of a response (triage only)
   */
  // SEM@ec5a0aedcbe292915581a5e7ff60738da214dc32: update a survey response status via the triage endpoint and refresh the list (mutates shared state)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: transition a survey response to needs_revision with reviewer notes (mutates shared state)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: build a threat model from a survey response via the triage endpoint (mutates shared state)
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
  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: update the project association on a survey response (reads DB)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: associate a survey response with an existing threat model by ID (reads DB)
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
