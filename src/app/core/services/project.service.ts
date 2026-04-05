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
  ProjectPatch,
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

  /**
   * Get a project by ID
   * @param id Project ID
   */
  get(id: string): Observable<Project> {
    return this.apiService.get<Project>(`projects/${id}`).pipe(
      tap(project => this.logger.debug('Project loaded', { id: project.id })),
      catchError(error => {
        this.logger.error('Failed to load project', error);
        throw error;
      }),
    );
  }

  /**
   * Update a project (full replacement)
   * @param id Project ID
   * @param input Project input data
   */
  update(id: string, input: ProjectInput): Observable<Project> {
    return this.apiService
      .put<Project>(`projects/${id}`, input as unknown as Record<string, unknown>)
      .pipe(
        tap(result => this.logger.info('Project updated', { id: result.id })),
        catchError(error => {
          this.logger.error('Failed to update project', error);
          throw error;
        }),
      );
  }

  /**
   * Patch a project (partial update using JSON Patch operations)
   * @param id Project ID
   * @param changes Partial project changes to apply as JSON Patch replace operations
   */
  patch(id: string, changes: ProjectPatch): Observable<Project> {
    const operations = (
      Object.entries(changes) as [string, ProjectPatch[keyof ProjectPatch]][]
    ).map(([key, value]) => ({
      op: 'replace' as const,
      path: `/${key}`,
      value,
    }));
    return this.apiService.patch<Project>(`projects/${id}`, operations).pipe(
      tap(result => this.logger.info('Project patched', { id: result.id })),
      catchError(error => {
        this.logger.error('Failed to patch project', error);
        throw error;
      }),
    );
  }

  /**
   * Delete a project
   * @param id Project ID
   */
  delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`projects/${id}`).pipe(
      tap(() => this.logger.info('Project deleted', { id })),
      catchError(error => {
        this.logger.error('Failed to delete project', error);
        throw error;
      }),
    );
  }
}
