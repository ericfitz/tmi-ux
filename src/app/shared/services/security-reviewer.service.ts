/**
 * Security Reviewer Service
 *
 * Shared service for loading security reviewer options using a tiered fallback:
 * 1. Current user is a security reviewer → use /me/groups endpoint
 * 2. Current user is an admin → use admin groups API
 * 3. Neither → fall back to user picker dialog mode
 *
 * Extracted from tm-edit.component.ts to allow reuse across components
 * (threat model editing, triage reviewer assignment, etc.)
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';

import { AuthService } from '@app/auth/services/auth.service';
import { UserGroupService } from '@app/core/services/user-group.service';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { User } from '@app/pages/tm/models/threat-model.model';
import { GroupMember } from '@app/types/group.types';

/** Name of the security reviewers group in the system */
const SECURITY_REVIEWERS_GROUP = 'security-reviewers';

/**
 * Result from loading security reviewer options.
 * Components use the `mode` discriminator to decide how to render the UI.
 */
// SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: discriminated union indicating dropdown reviewer list or user-picker fallback mode (pure)
export type SecurityReviewerResult = { mode: 'dropdown'; reviewers: User[] } | { mode: 'picker' };

@Injectable({
  providedIn: 'root',
})
// SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: fetch security reviewer options using tiered group-membership fallback strategy
export class SecurityReviewerService {
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: inject auth, group, and logger dependencies (mutates shared state)
  constructor(
    private authService: AuthService,
    private userGroupService: UserGroupService,
    private groupAdminService: GroupAdminService,
    private logger: LoggerService,
  ) {}

  /**
   * Load security reviewer options using tiered fallback.
   *
   * @param currentReviewer Optional current reviewer to ensure is included in the list
   * @returns Observable emitting either dropdown options or picker mode indicator
   */
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: fetch available security reviewers using tiered group membership fallback (reads DB)
  loadReviewerOptions(currentReviewer?: User | null): Observable<SecurityReviewerResult> {
    const profile = this.authService.userProfile;

    // Tier 1: User is a security reviewer — find group UUID from their profile
    const securityReviewersGroup = profile?.groups?.find(
      g => g.group_name === SECURITY_REVIEWERS_GROUP,
    );

    if (securityReviewersGroup) {
      return this.userGroupService.listMembers(securityReviewersGroup.internal_uuid).pipe(
        map(response => this.buildDropdownResult(response.members, currentReviewer)),
        catchError(error => {
          this.logger.warn(
            'Failed to load security reviewers via /me/groups, trying admin API',
            error,
          );
          return this.loadViaAdmin(currentReviewer);
        }),
      );
    }

    // Tier 2: User is an admin
    if (profile?.is_admin) {
      return this.loadViaAdmin(currentReviewer);
    }

    // Tier 3: Neither — fall back to user picker dialog
    return of({ mode: 'picker' as const });
  }

  /**
   * Build a User object from the current authenticated user's profile.
   * Used for "Assign to Me" functionality.
   *
   * @returns User object or null if no profile is available
   */
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: build a reviewer User from the authenticated user's profile (pure)
  getCurrentUserAsReviewer(): User | null {
    const profile = this.authService.userProfile;
    if (!profile) return null;

    return {
      principal_type: 'user',
      provider: profile.provider,
      provider_id: profile.provider_id,
      email: profile.email,
      display_name: profile.display_name,
    };
  }

  /**
   * Map a GroupMember to the User interface used by threat models.
   */
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: convert a group member to the threat-model User type (pure)
  mapGroupMemberToUser(member: GroupMember): User {
    return {
      principal_type: 'user',
      provider: member.user_provider ?? '',
      provider_id: member.user_provider_user_id ?? '',
      email: member.user_email ?? '',
      display_name: member.user_name ?? member.user_email ?? '',
    };
  }

  /**
   * Compare function for mat-select to match User objects by provider identity.
   */
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: compare two reviewer Users by provider identity for mat-select binding (pure)
  compareReviewers(a: User | null, b: User | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.provider === b.provider && a.provider_id === b.provider_id;
  }

  /**
   * Load security reviewers via admin groups API (tier 2 fallback).
   */
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: fetch security reviewers via the admin groups API as a fallback (reads DB)
  private loadViaAdmin(currentReviewer?: User | null): Observable<SecurityReviewerResult> {
    return this.groupAdminService.list({ group_name: SECURITY_REVIEWERS_GROUP }).pipe(
      switchMap(response => {
        const group = response.groups.find(g => g.group_name === SECURITY_REVIEWERS_GROUP);
        if (!group) {
          this.logger.warn('Security reviewers group not found via admin API');
          return of({ mode: 'picker' as const });
        }
        return this.groupAdminService
          .listMembers(group.internal_uuid)
          .pipe(
            map(membersResponse =>
              this.buildDropdownResult(membersResponse.members, currentReviewer),
            ),
          );
      }),
      catchError(error => {
        this.logger.warn('Failed to load security reviewers via admin API', error);
        return of({ mode: 'picker' as const });
      }),
    );
  }

  /**
   * Build a dropdown result from group members, ensuring the current reviewer is included.
   */
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: build a dropdown reviewer list from group members, ensuring the current reviewer is included (pure)
  private buildDropdownResult(
    members: GroupMember[],
    currentReviewer?: User | null,
  ): SecurityReviewerResult {
    const reviewers = members
      .filter(m => m.subject_type === 'user')
      .map(m => this.mapGroupMemberToUser(m));

    // Ensure current reviewer is in the list (may have been removed from group)
    if (currentReviewer) {
      const alreadyInList = reviewers.some(
        r =>
          r.provider === currentReviewer.provider && r.provider_id === currentReviewer.provider_id,
      );
      if (!alreadyInList) {
        reviewers.unshift(currentReviewer);
      }
    }

    return { mode: 'dropdown', reviewers };
  }
}
