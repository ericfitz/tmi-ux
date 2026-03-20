import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  AdminUser,
  AdminUserFilter,
  CreateAutomationAccountRequest,
  CreateAutomationAccountResponse,
  ListAdminUsersResponse,
} from '@app/types/user.types';
import { TransferOwnershipResult } from '@app/types/transfer.types';
import {
  ClientCredentialResponse,
  CreateClientCredentialRequest,
  ListClientCredentialsResponse,
} from '@app/types/client-credential.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

/**
 * Service for managing users in the admin interface
 * Handles listing and deleting users
 */
@Injectable({
  providedIn: 'root',
})
export class UserAdminService {
  private usersSubject$ = new BehaviorSubject<AdminUser[]>([]);
  public users$: Observable<AdminUser[]> = this.usersSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all users with optional filtering
   */
  public list(filter?: AdminUserFilter): Observable<ListAdminUsersResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListAdminUsersResponse>('admin/users', params).pipe(
      tap(response => {
        this.usersSubject$.next(response.users);
        this.logger.debug('Users loaded', {
          count: response.users.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list users', error);
        throw error;
      }),
    );
  }

  /**
   * Delete a user by internal UUID
   * Deletes a user and all associated data.
   * Transfers sole-owned threat models or deletes them if no other owners exist.
   */
  public delete(internal_uuid: string): Observable<void> {
    return this.apiService.delete<void>(`admin/users/${internal_uuid}`).pipe(
      tap(() => {
        this.logger.info('User deleted', { internal_uuid });
        // Refresh the users list
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete user', error);
        throw error;
      }),
    );
  }

  /**
   * Create an automation (machine) user account with an initial client credential
   */
  public createAutomationUser(
    request: CreateAutomationAccountRequest,
  ): Observable<CreateAutomationAccountResponse> {
    return this.apiService
      .post<CreateAutomationAccountResponse>(
        'admin/users/automation',
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(response => {
          this.logger.info('Automation user created', { name: response.user.name });
        }),
        catchError(error => {
          this.logger.error('Failed to create automation user', error);
          throw error;
        }),
      );
  }

  /**
   * List all client credentials for a given user
   */
  public listUserCredentials(internalUuid: string): Observable<ListClientCredentialsResponse> {
    return this.apiService
      .get<ListClientCredentialsResponse>(`admin/users/${internalUuid}/client_credentials`)
      .pipe(
        tap(response => {
          this.logger.debug('User credentials loaded', {
            internalUuid,
            count: response.credentials.length,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list user credentials', error);
          throw error;
        }),
      );
  }

  /**
   * Create a new client credential for a given user
   */
  public createUserCredential(
    internalUuid: string,
    input: CreateClientCredentialRequest,
  ): Observable<ClientCredentialResponse> {
    return this.apiService
      .post<ClientCredentialResponse>(
        `admin/users/${internalUuid}/client_credentials`,
        input as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(response => {
          this.logger.info('User credential created', {
            internalUuid,
            credentialId: response.id,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to create user credential', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a client credential for a given user
   */
  public deleteUserCredential(internalUuid: string, credentialId: string): Observable<void> {
    return this.apiService
      .delete<void>(`admin/users/${internalUuid}/client_credentials/${credentialId}`)
      .pipe(
        tap(() => {
          this.logger.info('User credential deleted', { internalUuid, credentialId });
        }),
        catchError(error => {
          this.logger.error('Failed to delete user credential', error);
          throw error;
        }),
      );
  }

  /**
   * Transfer all threat models and survey responses from one user to another
   */
  public transferOwnership(
    sourceUserId: string,
    targetUserId: string,
  ): Observable<TransferOwnershipResult> {
    return this.apiService
      .post<TransferOwnershipResult>(`admin/users/${sourceUserId}/transfer`, {
        target_user_id: targetUserId,
      })
      .pipe(
        tap(result => {
          this.logger.info('Ownership transferred (admin)', {
            sourceUserId,
            targetUserId,
            tmCount: result.threat_models_transferred.count,
            responseCount: result.survey_responses_transferred.count,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to transfer ownership (admin)', error);
          throw error;
        }),
      );
  }
}
