import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '@app/auth/services/auth.service';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { SamlUserService } from '@app/core/services/saml-user.service';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Autocomplete suggestion for the permissions dialog subject field
 */
export interface AutocompleteSuggestion {
  /** Display text shown in the dropdown: "Name (email)" for users, group_name for groups */
  displayLabel: string;
  /** Value written to the subject field on selection: provider_user_id or email for users, group_name for groups */
  value: string;
}

/**
 * Service that provides autocomplete suggestions for permission
 * principals in the permissions dialog.
 *
 * Dispatches on the row's provider:
 * - `tmi` users/groups: admin-only search via the admin API (non-admins
 *   get empty results silently).
 * - The signed-in user's own SAML provider: same-provider directory
 *   lookup via GET /saml/providers/{idp}/users — no admin required.
 * - Any other provider: empty results (manual entry).
 *
 * Catches 401/403 errors silently, returning empty results.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: fetch autocomplete suggestions for permission principal subjects; dispatches on row provider (tmi admin vs same-provider SAML)
export class PermissionsAutocompleteService {
  private static readonly MIN_SEARCH_LENGTH = 2;
  private static readonly RESULT_LIMIT = 10;

  // SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: inject auth, user-admin, group-admin, saml-user, and logger dependencies (pure)
  constructor(
    private authService: AuthService,
    private userAdminService: UserAdminService,
    private groupAdminService: GroupAdminService,
    private samlUserService: SamlUserService,
    private logger: LoggerService,
  ) {}

  /**
   * Search for users or groups matching the given term.
   *
   * @param term - Search string (minimum 2 characters)
   * @param principalType - Whether to search users or groups
   * @param rowProvider - The provider selected on the permission row being edited
   * @returns Observable of matching suggestions, or empty array when the
   *          row's provider is not searchable by the current user
   */
  // SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: search users or groups by term, dispatching on row provider; returns empty for unsearchable providers or short input (pure)
  search(
    term: string,
    principalType: 'user' | 'group',
    rowProvider: string,
  ): Observable<AutocompleteSuggestion[]> {
    if (term.length < PermissionsAutocompleteService.MIN_SEARCH_LENGTH) {
      return of([]);
    }

    if (principalType === 'group') {
      // Groups are TMI built-ins; the group list endpoint is admin-only
      if (rowProvider !== 'tmi' || !this.authService.isAdmin) {
        return of([]);
      }
      return this.searchGroups(term);
    }

    if (rowProvider === 'tmi') {
      if (!this.authService.isAdmin) {
        return of([]);
      }
      return this.searchUsers(term);
    }

    // The SAML lookup endpoint only serves the caller's own provider,
    // and only SAML providers have a directory — verify both before calling
    if (rowProvider === this.authService.userIdp) {
      return this.authService.getAvailableSAMLProviders().pipe(
        switchMap(providers =>
          providers.some(p => p.id === rowProvider)
            ? this.searchSAMLUsers(rowProvider, term)
            : of([] as AutocompleteSuggestion[]),
        ),
        catchError(error => {
          this.logger.debug('SAML provider list unavailable for autocomplete', error);
          return of([] as AutocompleteSuggestion[]);
        }),
      );
    }

    return of([]);
  }

  // SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: fetch user suggestions matching search term from admin API
  private searchUsers(term: string): Observable<AutocompleteSuggestion[]> {
    return this.userAdminService
      .list({
        provider: 'tmi',
        name: term,
        limit: PermissionsAutocompleteService.RESULT_LIMIT,
      })
      .pipe(
        map(response =>
          response.users.map(user => ({
            displayLabel: `${user.name} (${user.email})`,
            value: user.provider_user_id,
          })),
        ),
        catchError(error => {
          this.logger.debug('Autocomplete user search failed (expected for non-admin)', error);
          return of([]);
        }),
      );
  }

  // SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: fetch same-provider SAML user suggestions matching search term
  private searchSAMLUsers(idp: string, term: string): Observable<AutocompleteSuggestion[]> {
    return this.samlUserService
      .list(idp, {
        email: term,
        limit: PermissionsAutocompleteService.RESULT_LIMIT,
      })
      .pipe(
        map(response =>
          response.users.map(user => ({
            displayLabel: `${user.name} (${user.email})`,
            value: user.email,
          })),
        ),
        catchError(error => {
          this.logger.debug('Autocomplete SAML user search failed', error);
          return of([]);
        }),
      );
  }

  // SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: fetch group suggestions matching search term from admin API
  private searchGroups(term: string): Observable<AutocompleteSuggestion[]> {
    return this.groupAdminService
      .list({
        provider: 'tmi',
        group_name: term,
        limit: PermissionsAutocompleteService.RESULT_LIMIT,
      })
      .pipe(
        map(response =>
          response.groups.map(group => ({
            displayLabel: group.group_name,
            value: group.group_name,
          })),
        ),
        catchError(error => {
          this.logger.debug('Autocomplete group search failed (expected for non-admin)', error);
          return of([]);
        }),
      );
  }
}
