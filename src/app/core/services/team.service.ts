/**
 * Team Service
 *
 * Manages team CRUD operations via the non-admin API endpoints.
 * Used by the create-project dialog and admin teams page.
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  Team,
  TeamInput,
  TeamPatch,
  TeamFilter,
  ListTeamsResponse,
  TeamNote,
  TeamProjectNoteInput,
  ListTeamNotesResponse,
} from '@app/types/team.types';

/**
 * Service for full team CRUD operations via non-admin API endpoints
 */
@Injectable({
  providedIn: 'root',
})
export class TeamService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List teams accessible to the current user
   * @param filter Optional filter parameters
   */
  list(filter?: TeamFilter): Observable<ListTeamsResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListTeamsResponse>('teams', params).pipe(
      tap(response => {
        this.logger.debug('Teams loaded', {
          count: response.teams.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list teams', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new team
   * @param input Team creation input
   */
  create(input: TeamInput): Observable<Team> {
    return this.apiService.post<Team>('teams', input as unknown as Record<string, unknown>).pipe(
      tap(team => {
        this.logger.info('Team created', { id: team.id, name: team.name });
      }),
      catchError(error => {
        this.logger.error('Failed to create team', error);
        throw error;
      }),
    );
  }

  /**
   * Get a team by ID
   * @param id Team ID
   */
  get(id: string): Observable<Team> {
    return this.apiService.get<Team>(`teams/${id}`).pipe(
      tap(team => this.logger.debug('Team loaded', { id: team.id })),
      catchError(error => {
        this.logger.error('Failed to load team', error);
        throw error;
      }),
    );
  }

  /**
   * Update a team (full replacement)
   * @param id Team ID
   * @param team Team input data
   */
  update(id: string, team: TeamInput): Observable<Team> {
    return this.apiService
      .put<Team>(`teams/${id}`, team as unknown as Record<string, unknown>)
      .pipe(
        tap(result => this.logger.info('Team updated', { id: result.id })),
        catchError(error => {
          this.logger.error('Failed to update team', error);
          throw error;
        }),
      );
  }

  /**
   * Patch a team (partial update using JSON Patch operations)
   * @param id Team ID
   * @param changes Partial team changes to apply as JSON Patch replace operations
   */
  patch(id: string, changes: TeamPatch): Observable<Team> {
    const operations = (Object.entries(changes) as [string, TeamPatch[keyof TeamPatch]][]).map(
      ([key, value]) => ({
        op: 'replace' as const,
        path: `/${key}`,
        value,
      }),
    );
    return this.apiService.patch<Team>(`teams/${id}`, operations).pipe(
      tap(result => this.logger.info('Team patched', { id: result.id })),
      catchError(error => {
        this.logger.error('Failed to patch team', error);
        throw error;
      }),
    );
  }

  /**
   * Delete a team
   * @param id Team ID
   */
  delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`teams/${id}`).pipe(
      tap(() => this.logger.info('Team deleted', { id })),
      catchError(error => {
        this.logger.error('Failed to delete team', error);
        throw error;
      }),
    );
  }

  /**
   * List notes for a team
   * @param teamId Team ID
   * @param limit Maximum number of results
   * @param offset Number of results to skip
   */
  listNotes(teamId: string, limit?: number, offset?: number): Observable<ListTeamNotesResponse> {
    const params = buildHttpParams({ limit, offset });
    return this.apiService.get<ListTeamNotesResponse>(`teams/${teamId}/notes`, params).pipe(
      tap(response => {
        this.logger.debug('Team notes loaded', {
          teamId,
          count: response.notes.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list team notes', error);
        throw error;
      }),
    );
  }

  /**
   * Get a team note by ID
   * @param teamId Team ID
   * @param noteId Note ID
   */
  getNoteById(teamId: string, noteId: string): Observable<TeamNote | undefined> {
    return this.apiService.get<TeamNote>(`teams/${teamId}/notes/${noteId}`).pipe(
      tap(() => this.logger.debug('Team note loaded', { teamId, noteId })),
      catchError(error => {
        this.logger.error('Failed to load team note', error);
        return of(undefined);
      }),
    );
  }

  /**
   * Create a new note for a team
   * @param teamId Team ID
   * @param note Note creation input
   */
  createNote(teamId: string, note: Partial<TeamProjectNoteInput>): Observable<TeamNote> {
    return this.apiService
      .post<TeamNote>(`teams/${teamId}/notes`, note as unknown as Record<string, unknown>)
      .pipe(
        tap(result => this.logger.info('Team note created', { teamId, noteId: result.id })),
        catchError(error => {
          this.logger.error('Failed to create team note', error);
          throw error;
        }),
      );
  }

  /**
   * Update a team note (full replacement)
   * @param teamId Team ID
   * @param noteId Note ID
   * @param note Note input data
   */
  updateNote(
    teamId: string,
    noteId: string,
    note: Partial<TeamProjectNoteInput>,
  ): Observable<TeamNote> {
    return this.apiService
      .put<TeamNote>(`teams/${teamId}/notes/${noteId}`, note as unknown as Record<string, unknown>)
      .pipe(
        tap(result => this.logger.info('Team note updated', { teamId, noteId: result.id })),
        catchError(error => {
          this.logger.error('Failed to update team note', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a team note
   * @param teamId Team ID
   * @param noteId Note ID
   */
  deleteNote(teamId: string, noteId: string): Observable<boolean> {
    return this.apiService.delete<void>(`teams/${teamId}/notes/${noteId}`).pipe(
      tap(() => this.logger.info('Team note deleted', { teamId, noteId })),
      map(() => true),
      catchError(error => {
        this.logger.error('Failed to delete team note', error);
        throw error;
      }),
    );
  }
}
