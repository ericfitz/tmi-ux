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
// SEM@13502058353c72b0188b31b4cbdcbfa926dcd69c: manage CRUD operations for the current user's API client credentials (reads DB)
export class ClientCredentialService {
  // SEM@e78c11b8340cb7b602f0e3b20931ef81c1f65216: inject API and logger dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all client credentials for the current user
   */
  // SEM@13502058353c72b0188b31b4cbdcbfa926dcd69c: list all client credentials for the current user (reads DB)
  public list(): Observable<ClientCredentialInfo[]> {
    return this.apiService.get<ListClientCredentialsResponse>('me/client_credentials').pipe(
      map(response => response.credentials || []),
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
  // SEM@c314c6c3f8d310ada3e2f6601d3a185d6a612f6d: create a new client credential and return it with the one-time secret (reads DB)
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
  // SEM@c314c6c3f8d310ada3e2f6601d3a185d6a612f6d: delete a client credential by ID (reads DB)
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
