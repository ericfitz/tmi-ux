import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '@app/auth/services/auth.service';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Autocomplete suggestion for the permissions dialog subject field
 */
export interface AutocompleteSuggestion {
  /** Display text shown in the dropdown: "Name (email)" for users, group_name for groups */
  displayLabel: string;
  /** Value written to the subject field on selection: provider_user_id for users, group_name for groups */
  value: string;
}

/**
 * Service that provides autocomplete suggestions for TMI provider
 * principals in the permissions dialog.
 *
 * Gates on admin status — non-admin users get empty results silently.
 * Catches 401/403 errors silently, returning empty results.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: fetch autocomplete suggestions for permission principal subjects; gates on admin role
export class PermissionsAutocompleteService {
  private static readonly MIN_SEARCH_LENGTH = 2;
  private static readonly RESULT_LIMIT = 10;

  // SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: inject auth, user-admin, group-admin, and logger dependencies (pure)
  constructor(
    private authService: AuthService,
    private userAdminService: UserAdminService,
    private groupAdminService: GroupAdminService,
    private logger: LoggerService,
  ) {}

  /**
   * Search for TMI provider users or groups matching the given term.
   *
   * @param term - Search string (minimum 2 characters)
   * @param principalType - Whether to search users or groups
   * @returns Observable of matching suggestions, or empty array on error/non-admin
   */
  // SEM@b967c1adebe82f5390a22ee41b40d2b3c87e9870: search users or groups by term; returns empty for non-admin or short input (pure)
  search(term: string, principalType: 'user' | 'group'): Observable<AutocompleteSuggestion[]> {
    if (!this.authService.isAdmin) {
      return of([]);
    }

    if (term.length < PermissionsAutocompleteService.MIN_SEARCH_LENGTH) {
      return of([]);
    }

    if (principalType === 'user') {
      return this.searchUsers(term);
    }
    return this.searchGroups(term);
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
