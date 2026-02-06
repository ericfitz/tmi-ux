import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  SurveyTemplate,
  SurveyTemplateListItem,
  SurveyVersion,
  SurveyTemplateFilter,
  SurveyJsonSchema,
  ListSurveyTemplatesResponse,
  CreateSurveyTemplateRequest,
  UpdateSurveyTemplateRequest,
  SurveyStatus,
} from '@app/types/survey.types';

/**
 * Service for managing survey templates
 * Handles CRUD operations for survey templates and versions
 */
@Injectable({
  providedIn: 'root',
})
export class SurveyTemplateService {
  private templatesSubject$ = new BehaviorSubject<SurveyTemplateListItem[]>([]);
  public templates$: Observable<SurveyTemplateListItem[]> = this.templatesSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all survey templates with optional filtering (admin)
   */
  public listAdmin(filter?: SurveyTemplateFilter): Observable<ListSurveyTemplatesResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListSurveyTemplatesResponse>('admin/survey_templates', params).pipe(
      tap(response => {
        this.templatesSubject$.next(response.survey_templates);
        this.logger.debug('Survey templates loaded', {
          count: response.survey_templates.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list survey templates', error);
        throw error;
      }),
    );
  }

  /**
   * List active templates (for respondents)
   */
  public listActive(): Observable<ListSurveyTemplatesResponse> {
    return this.apiService.get<ListSurveyTemplatesResponse>('intake/templates').pipe(
      tap(response => {
        this.logger.debug('Active survey templates loaded', {
          count: response.survey_templates.length,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list active survey templates', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific template by ID (respondent access)
   */
  public getById(templateId: string): Observable<SurveyTemplate> {
    return this.apiService.get<SurveyTemplate>(`intake/templates/${templateId}`).pipe(
      tap(template => {
        this.logger.debug('Survey template loaded', { id: template.id });
      }),
      catchError(error => {
        this.logger.error('Failed to get survey template', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific template by ID (admin access)
   */
  public getByIdAdmin(templateId: string): Observable<SurveyTemplate> {
    return this.apiService.get<SurveyTemplate>(`admin/survey_templates/${templateId}`).pipe(
      tap(template => {
        this.logger.debug('Survey template loaded (admin)', { id: template.id });
      }),
      catchError(error => {
        this.logger.error('Failed to get survey template (admin)', error);
        throw error;
      }),
    );
  }

  /**
   * Get the survey JSON from a template
   */
  public getSurveyJson(templateId: string): Observable<SurveyJsonSchema> {
    return this.getById(templateId).pipe(map(template => template.survey_json));
  }

  /**
   * Get the survey JSON for a specific version
   */
  public getVersionJson(templateId: string, version: string): Observable<SurveyJsonSchema> {
    return this.apiService
      .get<SurveyVersion>(`intake/templates/${templateId}/versions/${version}`)
      .pipe(
        map(v => v.survey_json),
        tap(() => {
          this.logger.debug('Survey version JSON loaded', { templateId, version });
        }),
        catchError(error => {
          this.logger.error('Failed to get survey version', error);
          throw error;
        }),
      );
  }

  /**
   * Get a specific version record
   */
  public getVersion(templateId: string, version: string): Observable<SurveyVersion> {
    return this.apiService
      .get<SurveyVersion>(`admin/survey_templates/${templateId}/versions/${version}`)
      .pipe(
        tap(v => {
          this.logger.debug('Survey version loaded', {
            templateId,
            version: v.version,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to get survey version', error);
          throw error;
        }),
      );
  }

  /**
   * List all versions of a template (admin)
   */
  public listVersions(templateId: string): Observable<SurveyVersion[]> {
    return this.apiService
      .get<SurveyVersion[]>(`admin/survey_templates/${templateId}/versions`)
      .pipe(
        tap(versions => {
          this.logger.debug('Survey versions loaded', {
            templateId,
            count: versions.length,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list survey versions', error);
          throw error;
        }),
      );
  }

  /**
   * Create a new survey template (admin only)
   */
  public create(request: CreateSurveyTemplateRequest): Observable<SurveyTemplate> {
    return this.apiService
      .post<SurveyTemplate>('admin/survey_templates', request as unknown as Record<string, unknown>)
      .pipe(
        tap(template => {
          this.logger.info('Survey template created', { id: template.id });
          this.listAdmin().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create survey template', error);
          throw error;
        }),
      );
  }

  /**
   * Update a survey template (admin only, full PUT)
   * If survey_json or version changes, the server creates a new version record
   */
  public update(
    templateId: string,
    request: UpdateSurveyTemplateRequest,
  ): Observable<SurveyTemplate> {
    return this.apiService
      .put<SurveyTemplate>(
        `admin/survey_templates/${templateId}`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(template => {
          this.logger.info('Survey template updated', { id: template.id });
          this.listAdmin().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update survey template', error);
          throw error;
        }),
      );
  }

  /**
   * Set template status via PATCH (admin only)
   */
  public setStatus(templateId: string, status: SurveyStatus): Observable<SurveyTemplate> {
    return this.apiService
      .patch<SurveyTemplate>(`admin/survey_templates/${templateId}`, [
        { op: 'replace', path: '/status', value: status },
      ])
      .pipe(
        tap(template => {
          this.logger.info('Survey template status updated', {
            id: template.id,
            status,
          });
          this.listAdmin().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update survey template status', error);
          throw error;
        }),
      );
  }

  /**
   * Archive a survey template (admin only)
   */
  public archive(templateId: string): Observable<SurveyTemplate> {
    return this.setStatus(templateId, 'archived');
  }

  /**
   * Delete a survey template (admin only)
   */
  public deleteTemplate(templateId: string): Observable<void> {
    return this.apiService.delete<void>(`admin/survey_templates/${templateId}`).pipe(
      tap(() => {
        this.logger.info('Survey template deleted', { id: templateId });
        this.listAdmin().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete survey template', error);
        throw error;
      }),
    );
  }

  /**
   * Clone a survey template (client-side: fetch original, create new)
   */
  public clone(templateId: string, newName: string): Observable<SurveyTemplate> {
    return this.getByIdAdmin(templateId).pipe(
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
      tap(template => {
        this.logger.info('Survey template cloned', {
          originalId: templateId,
          newId: template.id,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to clone survey template', error);
        throw error;
      }),
    );
  }
}
