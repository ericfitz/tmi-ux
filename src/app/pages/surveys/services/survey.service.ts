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
export class SurveyService {
  private surveysSubject$ = new BehaviorSubject<SurveyListItem[]>([]);
  public surveys$: Observable<SurveyListItem[]> = this.surveysSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all surveys with optional filtering (admin)
   */
  public listAdmin(filter?: SurveyFilter): Observable<ListSurveysResponse> {
    const params = buildHttpParams(filter);
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
   * List active surveys (for respondents)
   */
  public listActive(): Observable<ListSurveysResponse> {
    return this.apiService.get<ListSurveysResponse>('intake/surveys').pipe(
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
  public getSurveyJson(surveyId: string): Observable<SurveyJsonSchema> {
    return this.getById(surveyId).pipe(
      map(survey => ({ ...survey.survey_json, survey_id: survey.id })),
    );
  }

  /**
   * Create a new survey (admin only)
   */
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
   * Archive a survey (admin only)
   */
  public archive(surveyId: string): Observable<Survey> {
    return this.setStatus(surveyId, 'archived');
  }

  /**
   * Unarchive a survey, returning it to inactive status (admin only)
   */
  public unarchive(surveyId: string): Observable<Survey> {
    return this.setStatus(surveyId, 'inactive');
  }

  /**
   * Delete a survey (admin only)
   */
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
