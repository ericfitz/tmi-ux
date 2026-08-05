import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { SAMLUsersResponse } from '@app/types/user.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

/**
 * Filter parameters for the SAML user lookup endpoint
 */
export interface SAMLUserFilter {
  /** Filter by email (case-insensitive substring match) */
  email?: string;
  /** Maximum number of results to return (server max 500) */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

/**
 * Service for looking up users from a SAML identity provider.
 *
 * Wraps GET /saml/providers/{idp}/users, intended for UI autocomplete.
 * The server only allows querying the caller's own provider — requests
 * for any other idp return 403.
 */
@Injectable({
  providedIn: 'root',
})
export class SamlUserService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List users from a SAML provider, most recently logged in first.
   *
   * @param idp - Identity provider ID (must be the caller's own provider)
   * @param filter - Optional email substring filter and pagination
   */
  public list(idp: string, filter?: SAMLUserFilter): Observable<SAMLUsersResponse> {
    const params = buildHttpParams(filter);
    return this.apiService
      .get<SAMLUsersResponse>(`saml/providers/${encodeURIComponent(idp)}/users`, params)
      .pipe(
        tap(response => {
          this.logger.debug('SAML users loaded', {
            idp,
            count: response.users.length,
            total: response.total,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list SAML users', error);
          throw error;
        }),
      );
  }
}
