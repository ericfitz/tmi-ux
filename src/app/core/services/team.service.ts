/**
 * Team Service
 *
 * Manages team CRUD operations via the non-admin API endpoints.
 * Used by the create-project dialog and admin teams page.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import { Team, TeamInput, TeamPatch, TeamFilter, ListTeamsResponse } from '@app/types/team.types';

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
    const operations = Object.entries(changes).map(([key, value]) => ({
      op: 'replace' as const,
      path: `/${key}`,
      value,
    }));
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
}
