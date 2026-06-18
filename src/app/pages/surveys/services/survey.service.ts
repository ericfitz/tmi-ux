import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  Survey,
  SurveyListItem,
  SurveyFilter,
  SurveyJsonSchema,
  ListSurveysResponse,
  CreateSurveyRequest,
  UpdateSurveyRequest,
  SurveyStatus,
} from '@app/types/survey.types';

/**
 * Service for managing surveys
 * Handles CRUD operations for surveys
 */
@Injectable({
  providedIn: 'root',
})
// SEM@88e6a889c33276e0b9d96b4698fbf7d39d4a382b: manage survey templates: CRUD, status transitions, and cloning for admin and intake (reads DB)
export class SurveyService {
  private surveysSubject$ = new BehaviorSubject<SurveyListItem[]>([]);
  public surveys$: Observable<SurveyListItem[]> = this.surveysSubject$.asObservable();

  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: inject API and logger dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all surveys with optional filtering (admin).
   * Default limit=100 (the server cap) so the admin table shows every
   * template in small deployments without pagination; callers that need
   * explicit paging can override via the filter.
   */
  // SEM@88e6a889c33276e0b9d96b4698fbf7d39d4a382b: fetch all surveys via the admin endpoint and update shared state (mutates shared state)
  public listAdmin(filter?: SurveyFilter): Observable<ListSurveysResponse> {
    const params = buildHttpParams({ limit: 100, ...filter });
    return this.apiService.get<ListSurveysResponse>('admin/surveys', params).pipe(
      tap(response => {
        this.surveysSubject$.next(response.surveys);
        this.logger.debug('Surveys loaded', {
          count: response.surveys.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list surveys', error);
        throw error;
      }),
    );
  }

  /**
   * List active surveys (for respondents).
   * The server caps `limit` at 100; request that so small deployments with
   * dozens of templates (including seeded ones) fit on a single page
   * without needing client-side pagination UI.
   */
  // SEM@7d15676e6515d2204812ab979ef311a92f77019c: fetch active (published) surveys available to respondents (reads DB)
  public listActive(): Observable<ListSurveysResponse> {
    return this.apiService.get<ListSurveysResponse>('intake/surveys?limit=100').pipe(
      tap(response => {
        this.logger.debug('Active surveys loaded', {
          count: response.surveys.length,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list active surveys', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific survey by ID (respondent access)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch a survey by ID via the respondent intake endpoint (reads DB)
  public getById(surveyId: string): Observable<Survey> {
    return this.apiService.get<Survey>(`intake/surveys/${surveyId}`).pipe(
      tap(survey => {
        this.logger.debug('Survey loaded', { id: survey.id });
      }),
      catchError(error => {
        this.logger.error('Failed to get survey', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific survey by ID (admin access)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch a survey by ID via the admin endpoint (reads DB)
  public getByIdAdmin(surveyId: string): Observable<Survey> {
    return this.apiService.get<Survey>(`admin/surveys/${surveyId}`).pipe(
      tap(survey => {
        this.logger.debug('Survey loaded (admin)', { id: survey.id });
      }),
      catchError(error => {
        this.logger.error('Failed to get survey (admin)', error);
        throw error;
      }),
    );
  }

  /**
   * Get the survey JSON from a survey, with survey_id embedded
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch a survey's JSON schema with its ID embedded (reads DB)
  public getSurveyJson(surveyId: string): Observable<SurveyJsonSchema> {
    return this.getById(surveyId).pipe(
      map(survey => ({ ...survey.survey_json, survey_id: survey.id })),
    );
  }

  /**
   * Create a new survey (admin only)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: store a new survey via admin API and refresh the list (mutates shared state)
  public create(request: CreateSurveyRequest): Observable<Survey> {
    return this.apiService
      .post<Survey>('admin/surveys', request as unknown as Record<string, unknown>)
      .pipe(
        tap(survey => {
          this.logger.info('Survey created', { id: survey.id });
          this.listAdmin().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create survey', error);
          throw error;
        }),
      );
  }

  /**
   * Update a survey (admin only, full PUT)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: update an existing survey via admin API full PUT and refresh the list (mutates shared state)
  public update(surveyId: string, request: UpdateSurveyRequest): Observable<Survey> {
    return this.apiService
      .put<Survey>(`admin/surveys/${surveyId}`, request as unknown as Record<string, unknown>)
      .pipe(
        tap(survey => {
          this.logger.info('Survey updated', { id: survey.id });
          this.listAdmin().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update survey', error);
          throw error;
        }),
      );
  }

  /**
   * Set survey status via PATCH (admin only)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: update a survey's status field via admin PATCH and refresh the list (mutates shared state)
  public setStatus(surveyId: string, status: SurveyStatus): Observable<Survey> {
    return this.apiService
      .patch<Survey>(`admin/surveys/${surveyId}`, [
        { op: 'replace', path: '/status', value: status },
      ])
      .pipe(
        tap(survey => {
          this.logger.info('Survey status updated', {
            id: survey.id,
            status,
          });
          this.listAdmin().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update survey status', error);
          throw error;
        }),
      );
  }

  /**
   * Update a single field on a survey via JSON Patch (admin only)
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: update a single named field on a survey via admin JSON Patch (mutates shared state)
  public patchField(surveyId: string, field: string, value: string): Observable<Survey> {
    return this.apiService
      .patch<Survey>(`admin/surveys/${surveyId}`, [{ op: 'replace', path: `/${field}`, value }])
      .pipe(
        tap(survey => {
          this.logger.info('Survey field updated', { id: survey.id, field });
          this.listAdmin().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update survey field', error);
          throw error;
        }),
      );
  }

  /**
   * Archive a survey (admin only)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: set a survey's status to archived (mutates shared state)
  public archive(surveyId: string): Observable<Survey> {
    return this.setStatus(surveyId, 'archived');
  }

  /**
   * Unarchive a survey, returning it to inactive status (admin only)
   */
  // SEM@caa1041df66e2fa2f3c3e3ef2691199ec0930e66: restore an archived survey to inactive status (mutates shared state)
  public unarchive(surveyId: string): Observable<Survey> {
    return this.setStatus(surveyId, 'inactive');
  }

  /**
   * Delete a survey (admin only)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: delete a survey via admin API and refresh the list (mutates shared state)
  public deleteSurvey(surveyId: string): Observable<void> {
    return this.apiService.delete<void>(`admin/surveys/${surveyId}`).pipe(
      tap(() => {
        this.logger.info('Survey deleted', { id: surveyId });
        this.listAdmin().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete survey', error);
        throw error;
      }),
    );
  }

  /**
   * Clone a survey (client-side: fetch original, create new)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch a survey and store a new copy with an inactive status (mutates shared state)
  public clone(surveyId: string, newName: string): Observable<Survey> {
    return this.getByIdAdmin(surveyId).pipe(
      switchMap(original =>
        this.create({
          name: newName,
          version: original.version,
          survey_json: original.survey_json,
          description: original.description,
          status: 'inactive',
          settings: original.settings,
        }),
      ),
      tap(survey => {
        this.logger.info('Survey cloned', {
          originalId: surveyId,
          newId: survey.id,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to clone survey', error);
        throw error;
      }),
    );
  }
}
