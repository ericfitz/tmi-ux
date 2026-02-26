/**
 * Project Service
 *
 * Manages project list and create operations via the non-admin API endpoints.
 * Used by the project picker component for selecting and creating projects.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  Project,
  ProjectInput,
  ProjectFilter,
  ListProjectsResponse,
} from '@app/types/project.types';

/**
 * Service for project operations via non-admin API endpoints
 */
@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List projects accessible to the current user
   * @param filter Optional filter parameters
   */
  list(filter?: ProjectFilter): Observable<ListProjectsResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListProjectsResponse>('projects', params).pipe(
      tap(response => {
        this.logger.debug('Projects loaded', {
          count: response.projects.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list projects', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new project
   * @param input Project creation input
   */
  create(input: ProjectInput): Observable<Project> {
    return this.apiService
      .post<Project>('projects', input as unknown as Record<string, unknown>)
      .pipe(
        tap(project => {
          this.logger.info('Project created', { id: project.id, name: project.name });
        }),
        catchError(error => {
          this.logger.error('Failed to create project', error);
          throw error;
        }),
      );
  }
}
