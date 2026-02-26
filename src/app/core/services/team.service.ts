/**
 * Team Service
 *
 * Manages team list and create operations via the non-admin API endpoints.
 * Used by the create-project dialog for selecting and creating teams.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import { Team, TeamInput, TeamFilter, ListTeamsResponse } from '@app/types/team.types';

/**
 * Service for team operations via non-admin API endpoints
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
}
