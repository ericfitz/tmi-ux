import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, delay, map, tap } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  SurveyTemplate,
  SurveyVersion,
  SurveyTemplateFilter,
  SurveyJsonSchema,
  ListSurveyTemplatesResponse,
  CreateSurveyTemplateRequest,
  UpdateSurveyTemplateRequest,
  SurveyStatus,
} from '@app/types/survey.types';
import { MOCK_SURVEY_TEMPLATES, MOCK_SURVEY_VERSIONS } from './survey-mock-data';

/**
 * Service for managing survey templates
 * Handles CRUD operations for survey templates and versions
 */
@Injectable({
  providedIn: 'root',
})
export class SurveyTemplateService {
  private templatesSubject$ = new BehaviorSubject<SurveyTemplate[]>([]);
  public templates$: Observable<SurveyTemplate[]> = this.templatesSubject$.asObservable();

  // Mock data storage (will be replaced by API calls)
  private mockTemplates: SurveyTemplate[] = [...MOCK_SURVEY_TEMPLATES];
  private mockVersions: SurveyVersion[] = [...MOCK_SURVEY_VERSIONS];
  private useMockData = true; // Toggle for development

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List survey templates with optional filtering
   * Respondents only see active templates; admins see all
   */
  public list(filter?: SurveyTemplateFilter): Observable<ListSurveyTemplatesResponse> {
    if (this.useMockData) {
      return this.mockList(filter);
    }

    const params = buildHttpParams(filter);
    return this.apiService.get<ListSurveyTemplatesResponse>('surveys/templates', params).pipe(
      tap(response => {
        this.templatesSubject$.next(response.templates);
        this.logger.debug('Survey templates loaded', {
          count: response.templates.length,
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
   * List only active templates (for respondents)
   */
  public listActive(): Observable<ListSurveyTemplatesResponse> {
    return this.list({ status: 'active' });
  }

  /**
   * Get a specific template by ID
   */
  public getById(templateId: string): Observable<SurveyTemplate> {
    if (this.useMockData) {
      return this.mockGetById(templateId);
    }

    return this.apiService.get<SurveyTemplate>(`surveys/templates/${templateId}`).pipe(
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
   * Get the survey JSON for a specific version (or latest if not specified)
   */
  public getVersionJson(templateId: string, version?: number): Observable<SurveyJsonSchema> {
    if (this.useMockData) {
      return this.mockGetVersionJson(templateId, version);
    }

    const endpoint = version
      ? `surveys/templates/${templateId}/versions/${version}`
      : `surveys/templates/${templateId}/versions/latest`;

    return this.apiService.get<SurveyVersion>(endpoint).pipe(
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
   * Get a specific version
   */
  public getVersion(templateId: string, version: number): Observable<SurveyVersion> {
    if (this.useMockData) {
      return this.mockGetVersion(templateId, version);
    }

    return this.apiService
      .get<SurveyVersion>(`surveys/templates/${templateId}/versions/${version}`)
      .pipe(
        tap(v => {
          this.logger.debug('Survey version loaded', { templateId, version: v.version });
        }),
        catchError(error => {
          this.logger.error('Failed to get survey version', error);
          throw error;
        }),
      );
  }

  /**
   * List all versions of a template
   */
  public listVersions(templateId: string): Observable<SurveyVersion[]> {
    if (this.useMockData) {
      return this.mockListVersions(templateId);
    }

    return this.apiService.get<SurveyVersion[]>(`surveys/templates/${templateId}/versions`).pipe(
      tap(versions => {
        this.logger.debug('Survey versions loaded', { templateId, count: versions.length });
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
    if (this.useMockData) {
      return this.mockCreate(request);
    }

    return this.apiService
      .post<SurveyTemplate>(
        'admin/surveys/templates',
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(template => {
          this.logger.info('Survey template created', { id: template.id });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create survey template', error);
          throw error;
        }),
      );
  }

  /**
   * Update a survey template (admin only)
   * If survey_json is changed, creates a new version
   */
  public update(
    templateId: string,
    request: UpdateSurveyTemplateRequest,
  ): Observable<SurveyTemplate> {
    if (this.useMockData) {
      return this.mockUpdate(templateId, request);
    }

    return this.apiService
      .put<SurveyTemplate>(
        `admin/surveys/templates/${templateId}`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(template => {
          this.logger.info('Survey template updated', { id: template.id });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update survey template', error);
          throw error;
        }),
      );
  }

  /**
   * Archive a survey template (soft delete, admin only)
   */
  public archive(templateId: string): Observable<void> {
    if (this.useMockData) {
      return this.mockArchive(templateId);
    }

    return this.apiService.delete<void>(`admin/surveys/templates/${templateId}`).pipe(
      tap(() => {
        this.logger.info('Survey template archived', { id: templateId });
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to archive survey template', error);
        throw error;
      }),
    );
  }

  /**
   * Clone a survey template (admin only)
   */
  public clone(templateId: string, newName: string): Observable<SurveyTemplate> {
    if (this.useMockData) {
      return this.mockClone(templateId, newName);
    }

    return this.apiService
      .post<SurveyTemplate>(`admin/surveys/templates/${templateId}/clone`, { name: newName })
      .pipe(
        tap(template => {
          this.logger.info('Survey template cloned', {
            originalId: templateId,
            newId: template.id,
          });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to clone survey template', error);
          throw error;
        }),
      );
  }

  /**
   * Set template status (admin only)
   */
  public setStatus(templateId: string, status: SurveyStatus): Observable<SurveyTemplate> {
    return this.update(templateId, { status });
  }

  // ============================================
  // Mock Data Methods (for development)
  // ============================================

  private mockList(filter?: SurveyTemplateFilter): Observable<ListSurveyTemplatesResponse> {
    let templates = [...this.mockTemplates];

    // Apply filters
    if (filter?.status) {
      templates = templates.filter(t => t.status === filter.status);
    }
    if (filter?.search) {
      const search = filter.search.toLowerCase();
      templates = templates.filter(
        t => t.name.toLowerCase().includes(search) || t.description?.toLowerCase().includes(search),
      );
    }

    const total = templates.length;
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 25;
    templates = templates.slice(offset, offset + limit);

    this.templatesSubject$.next(templates);

    return of({
      templates,
      total,
      limit,
      offset,
    }).pipe(delay(200)); // Simulate network delay
  }

  private mockGetById(templateId: string): Observable<SurveyTemplate> {
    const template = this.mockTemplates.find(t => t.id === templateId);
    if (!template) {
      return of(null as unknown as SurveyTemplate).pipe(
        tap(() => {
          throw new Error(`Template not found: ${templateId}`);
        }),
      );
    }
    return of(template).pipe(delay(100));
  }

  private mockGetVersionJson(templateId: string, version?: number): Observable<SurveyJsonSchema> {
    const template = this.mockTemplates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const targetVersion = version ?? template.current_version;
    const surveyVersion = this.mockVersions.find(
      v => v.template_id === templateId && v.version === targetVersion,
    );

    if (!surveyVersion) {
      throw new Error(`Version not found: ${templateId} v${targetVersion}`);
    }

    return of(surveyVersion.survey_json).pipe(delay(100));
  }

  private mockGetVersion(templateId: string, version: number): Observable<SurveyVersion> {
    const surveyVersion = this.mockVersions.find(
      v => v.template_id === templateId && v.version === version,
    );

    if (!surveyVersion) {
      throw new Error(`Version not found: ${templateId} v${version}`);
    }

    return of(surveyVersion).pipe(delay(100));
  }

  private mockListVersions(templateId: string): Observable<SurveyVersion[]> {
    const versions = this.mockVersions
      .filter(v => v.template_id === templateId)
      .sort((a, b) => b.version - a.version);
    return of(versions).pipe(delay(100));
  }

  private mockCreate(request: CreateSurveyTemplateRequest): Observable<SurveyTemplate> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const template: SurveyTemplate = {
      id,
      name: request.name,
      description: request.description,
      status: request.status ?? 'inactive',
      current_version: 1,
      created_at: now,
      modified_at: now,
      created_by: 'current-user',
      modified_by: 'current-user',
    };

    const version: SurveyVersion = {
      id: crypto.randomUUID(),
      template_id: id,
      version: 1,
      survey_json: request.survey_json,
      created_at: now,
      created_by: 'current-user',
    };

    this.mockTemplates.push(template);
    this.mockVersions.push(version);

    return of(template).pipe(
      delay(200),
      tap(() => this.list().subscribe()),
    );
  }

  private mockUpdate(
    templateId: string,
    request: UpdateSurveyTemplateRequest,
  ): Observable<SurveyTemplate> {
    const index = this.mockTemplates.findIndex(t => t.id === templateId);
    if (index === -1) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const now = new Date().toISOString();
    const template = this.mockTemplates[index];

    // Update template metadata
    if (request.name !== undefined) template.name = request.name;
    if (request.description !== undefined) template.description = request.description;
    if (request.status !== undefined) template.status = request.status;
    template.modified_at = now;
    template.modified_by = 'current-user';

    // Create new version if survey_json changed
    if (request.survey_json) {
      const newVersion = template.current_version + 1;
      template.current_version = newVersion;

      const version: SurveyVersion = {
        id: crypto.randomUUID(),
        template_id: templateId,
        version: newVersion,
        survey_json: request.survey_json,
        created_at: now,
        created_by: 'current-user',
        change_summary: request.change_summary,
      };

      this.mockVersions.push(version);
    }

    this.mockTemplates[index] = template;

    return of(template).pipe(
      delay(200),
      tap(() => this.list().subscribe()),
    );
  }

  private mockArchive(templateId: string): Observable<void> {
    const index = this.mockTemplates.findIndex(t => t.id === templateId);
    if (index === -1) {
      throw new Error(`Template not found: ${templateId}`);
    }

    this.mockTemplates[index].status = 'archived';
    this.mockTemplates[index].modified_at = new Date().toISOString();

    return of(undefined).pipe(
      delay(200),
      tap(() => this.list().subscribe()),
    );
  }

  private mockClone(templateId: string, newName: string): Observable<SurveyTemplate> {
    const original = this.mockTemplates.find(t => t.id === templateId);
    if (!original) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const latestVersion = this.mockVersions.find(
      v => v.template_id === templateId && v.version === original.current_version,
    );

    if (!latestVersion) {
      throw new Error(`Version not found for template: ${templateId}`);
    }

    return this.mockCreate({
      name: newName,
      description: original.description,
      status: 'inactive',
      survey_json: latestVersion.survey_json,
    });
  }
}
