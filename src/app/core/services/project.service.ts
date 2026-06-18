/**
 * Project Service
 *
 * Manages project list and create operations via the non-admin API endpoints.
 * Used by the project picker component for selecting and creating projects.
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  Project,
  ProjectInput,
  ProjectPatch,
  ProjectFilter,
  ListProjectsResponse,
  ProjectNote,
  ListProjectNotesResponse,
} from '@app/types/project.types';
import { TeamProjectNoteInput } from '@app/types/team.types';

/**
 * Service for project operations via non-admin API endpoints
 */
@Injectable({
  providedIn: 'root',
})
// SEM@5216b44fc808e75496350b72e985f1b11cae0549: manage project and project note CRUD operations via non-admin API endpoints
export class ProjectService {
  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: inject ApiService and LoggerService dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List projects accessible to the current user
   * @param filter Optional filter parameters
   */
  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: fetch a filtered list of projects accessible to the current user (reads API)
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
  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: store a new project via the API and return the created project (reads API)
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
  // SEM@17c98929b13899b5e116c85768d940e1494dec5b: fetch a single project by ID from the API (reads API)
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
  // SEM@17c98929b13899b5e116c85768d940e1494dec5b: update a project by full replacement via the API (reads API)
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
  // SEM@a2718c6639d2663815853956081172a283078b34: update a project by partial JSON Patch operations via the API (reads API)
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
  // SEM@17c98929b13899b5e116c85768d940e1494dec5b: delete a project by ID via the API (reads API)
  delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`projects/${id}`).pipe(
      tap(() => this.logger.info('Project deleted', { id })),
      catchError(error => {
        this.logger.error('Failed to delete project', error);
        throw error;
      }),
    );
  }

  /**
   * List notes for a project
   * @param projectId Project ID
   * @param limit Maximum number of results
   * @param offset Number of results to skip
   */
  // SEM@5216b44fc808e75496350b72e985f1b11cae0549: fetch a paginated list of notes for a project from the API (reads API)
  listNotes(
    projectId: string,
    limit?: number,
    offset?: number,
  ): Observable<ListProjectNotesResponse> {
    const params = buildHttpParams({ limit, offset });
    return this.apiService
      .get<ListProjectNotesResponse>(`projects/${projectId}/notes`, params)
      .pipe(
        tap(response => {
          this.logger.debug('Project notes loaded', {
            projectId,
            count: response.notes.length,
            total: response.total,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list project notes', error);
          throw error;
        }),
      );
  }

  /**
   * Get a project note by ID
   * @param projectId Project ID
   * @param noteId Note ID
   */
  // SEM@5216b44fc808e75496350b72e985f1b11cae0549: fetch a single project note by ID, returning undefined on error (reads API)
  getNoteById(projectId: string, noteId: string): Observable<ProjectNote | undefined> {
    return this.apiService.get<ProjectNote>(`projects/${projectId}/notes/${noteId}`).pipe(
      tap(note => this.logger.debug('Project note loaded', { projectId, id: note.id })),
      catchError(error => {
        this.logger.error('Failed to load project note', error);
        return of(undefined);
      }),
    );
  }

  /**
   * Create a new note for a project
   * @param projectId Project ID
   * @param note Note input data
   */
  // SEM@5216b44fc808e75496350b72e985f1b11cae0549: store a new note on a project via the API and return the created note (reads API)
  createNote(projectId: string, note: Partial<TeamProjectNoteInput>): Observable<ProjectNote> {
    return this.apiService
      .post<ProjectNote>(`projects/${projectId}/notes`, note as unknown as Record<string, unknown>)
      .pipe(
        tap(created => {
          this.logger.info('Project note created', {
            projectId,
            id: created.id,
            name: created.name,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to create project note', error);
          throw error;
        }),
      );
  }

  /**
   * Update a project note (full replacement)
   * @param projectId Project ID
   * @param noteId Note ID
   * @param note Note input data
   */
  // SEM@5216b44fc808e75496350b72e985f1b11cae0549: update a project note by full replacement via the API (reads API)
  updateNote(
    projectId: string,
    noteId: string,
    note: Partial<TeamProjectNoteInput>,
  ): Observable<ProjectNote> {
    return this.apiService
      .put<ProjectNote>(
        `projects/${projectId}/notes/${noteId}`,
        note as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(result => this.logger.info('Project note updated', { projectId, id: result.id })),
        catchError(error => {
          this.logger.error('Failed to update project note', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a project note
   * @param projectId Project ID
   * @param noteId Note ID
   */
  // SEM@5216b44fc808e75496350b72e985f1b11cae0549: delete a project note by ID from the API (reads DB)
  deleteNote(projectId: string, noteId: string): Observable<boolean> {
    return this.apiService.delete<void>(`projects/${projectId}/notes/${noteId}`).pipe(
      tap(() => this.logger.info('Project note deleted', { projectId, noteId })),
      map(() => true),
      catchError(error => {
        this.logger.error('Failed to delete project note', error);
        throw error;
      }),
    );
  }
}
