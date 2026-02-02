import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  ClientCredentialInfo,
  ClientCredentialResponse,
  CreateClientCredentialRequest,
  ListClientCredentialsResponse,
} from '@app/types/client-credential.types';

/**
 * Service for managing client credentials
 * Handles CRUD operations for user client credentials
 */
@Injectable({
  providedIn: 'root',
})
export class ClientCredentialService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all client credentials for the current user
   */
  public list(): Observable<ClientCredentialInfo[]> {
    return this.apiService.get<ListClientCredentialsResponse>('me/client_credentials').pipe(
      map(response => response.client_credentials || []),
      tap(credentials => {
        this.logger.debug('Client credentials loaded', { count: credentials.length });
      }),
      catchError(error => {
        this.logger.error('Failed to list client credentials', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new client credential
   * Note: The client_secret is only returned once in the response
   */
  public create(input: CreateClientCredentialRequest): Observable<ClientCredentialResponse> {
    return this.apiService
      .post<ClientCredentialResponse>(
        'me/client_credentials',
        input as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(credential => {
          this.logger.info('Client credential created', { id: credential.id });
        }),
        catchError(error => {
          this.logger.error('Failed to create client credential', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a client credential
   */
  public delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`me/client_credentials/${id}`).pipe(
      tap(() => {
        this.logger.info('Client credential deleted', { id });
      }),
      catchError(error => {
        this.logger.error('Failed to delete client credential', error);
        throw error;
      }),
    );
  }
}
