import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  TriageNote,
  CreateTriageNoteRequest,
  ListTriageNotesResponse,
} from '@app/types/triage-note.types';

/**
 * Service for managing triage notes on survey responses
 * Triage notes are internal notes from security reviewers
 */
@Injectable({
  providedIn: 'root',
})
export class TriageNoteService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List triage notes for a survey response
   */
  public list(responseId: string): Observable<ListTriageNotesResponse> {
    return this.apiService
      .get<ListTriageNotesResponse>(`triage/survey_responses/${responseId}/triage_notes`)
      .pipe(
        tap(response => {
          this.logger.debug('Triage notes loaded', {
            responseId,
            count: response.triage_notes.length,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list triage notes', error);
          throw error;
        }),
      );
  }

  /**
   * Get a specific triage note
   */
  public getById(responseId: string, noteId: number): Observable<TriageNote> {
    return this.apiService
      .get<TriageNote>(`triage/survey_responses/${responseId}/triage_notes/${noteId}`)
      .pipe(
        tap(note => {
          this.logger.debug('Triage note loaded', {
            responseId,
            noteId: note.id,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to get triage note', error);
          throw error;
        }),
      );
  }

  /**
   * Create a new triage note
   */
  public create(responseId: string, request: CreateTriageNoteRequest): Observable<TriageNote> {
    return this.apiService
      .post<TriageNote>(
        `triage/survey_responses/${responseId}/triage_notes`,
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(note => {
          this.logger.info('Triage note created', {
            responseId,
            noteId: note.id,
            name: note.name,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to create triage note', error);
          throw error;
        }),
      );
  }
}
