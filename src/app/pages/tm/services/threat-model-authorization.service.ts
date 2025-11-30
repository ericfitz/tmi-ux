import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Authorization, User } from '../models/threat-model.model';
import { getCompositeKey } from '../../../shared/utils/principal-display.utils';

/**
 * Service for managing threat model authorization state reactively
 * Provides a centralized way to track and update authorization changes
 */
@Injectable({
  providedIn: 'root',
})
export class ThreatModelAuthorizationService implements OnDestroy {
  // Current threat model authorization state
  private _authorizationSubject = new BehaviorSubject<Authorization[] | null>(null);

  // Current threat model owner (Principal-based User object)
  private _currentOwner: User | null = null;

  // Current threat model ID being tracked
  private _currentThreatModelId: string | null = null;

  // Subscription management
  private _subscriptions = new Subscription();

  constructor(
    private logger: LoggerService,
    private authService: AuthService,
  ) {
    // this.logger.info('ThreatModelAuthorizationService initialized');
  }

  /**
   * Get observable of authorization data
   */
  get authorization$(): Observable<Authorization[] | null> {
    return this._authorizationSubject.asObservable();
  }

  /**
   * Get observable of current user's permission for the threat model
   * @returns Observable of 'reader' | 'writer' | 'owner' | null
   */
  get currentUserPermission$(): Observable<'reader' | 'writer' | 'owner' | null> {
    return this._authorizationSubject.pipe(
      map(authorizations => this.calculateUserPermission(authorizations)),
      distinctUntilChanged(),
    );
  }

  /**
   * Get observable of whether current user can edit (writer or owner)
   */
  get canEdit$(): Observable<boolean> {
    return this.currentUserPermission$.pipe(
      map(permission => permission === 'writer' || permission === 'owner'),
      distinctUntilChanged(),
    );
  }

  /**
   * Get observable of whether current user can manage permissions (owner only)
   */
  get canManagePermissions$(): Observable<boolean> {
    return this.currentUserPermission$.pipe(
      map(permission => permission === 'owner'),
      distinctUntilChanged(),
    );
  }

  /**
   * Get current threat model ID being tracked
   */
  get currentThreatModelId(): string | null {
    return this._currentThreatModelId;
  }

  /**
   * Set authorization data for a threat model
   * @param threatModelId The threat model ID
   * @param authorization The authorization data
   * @param owner The owner of the threat model (Principal-based User object)
   */
  setAuthorization(
    threatModelId: string,
    authorization: Authorization[] | null,
    owner: User,
  ): void {
    this.logger.debugComponent('ThreatModelAuthorizationService', 'setAuthorization called', {
      threatModelId,
      owner: owner ? getCompositeKey(owner) : null,
      authorizationCount: authorization?.length ?? 0,
      previousThreatModelId: this._currentThreatModelId,
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n'),
    });

    this._currentThreatModelId = threatModelId;
    this._currentOwner = owner;
    this._authorizationSubject.next(authorization);
  }

  /**
   * Update authorization data (partial update)
   * @param authorization The new authorization data
   */
  updateAuthorization(authorization: Authorization[]): void {
    if (!this._currentThreatModelId) {
      this.logger.warn('Cannot update authorization - no threat model ID set');
      return;
    }

    this._authorizationSubject.next(authorization);

    const userPermission = this.calculateUserPermission(authorization);
    this.logger.info('Authorization updated', {
      threatModelId: this._currentThreatModelId,
      authorizationCount: authorization.length,
      currentUserPermission: userPermission,
    });
  }

  /**
   * Clear authorization data
   */
  clearAuthorization(): void {
    this.logger.debugComponent('ThreatModelAuthorizationService', 'clearAuthorization called', {
      previousThreatModelId: this._currentThreatModelId,
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n'),
    });

    this._currentThreatModelId = null;
    this._currentOwner = null;
    this._authorizationSubject.next(null);
    this.logger.debugComponent('ThreatModelAuthorizationService', 'Authorization cleared');
  }

  /**
   * Calculate current user's permission based on authorization data
   * Implements the authorization logic described in docs-server/reference/architecture/AUTHORIZATION.md
   * Uses Principal-based identity with (provider, provider_id) composite keys
   * @param authorizations The authorization data
   * @returns The user's permission level or null
   */
  private calculateUserPermission(
    authorizations: Authorization[] | null,
  ): 'reader' | 'writer' | 'owner' | null {
    const currentUserProvider = this.authService.userIdp;
    const currentUserProviderId = this.authService.providerId;
    const currentUserEmail = this.authService.userEmail;
    const currentUserGroups = this.authService.userGroups;

    if (!currentUserProvider || !currentUserProviderId) {
      this.logger.warn('Cannot calculate user permission - no authenticated user');
      return null;
    }

    // Step 1: Check if user is the owner (owner field takes absolute precedence)
    if (this._currentOwner) {
      if (
        this._currentOwner.provider === currentUserProvider &&
        this._currentOwner.provider_id === currentUserProviderId
      ) {
        this.logger.debugComponent('ThreatModelAuthorizationService', 'User matches owner field', {
          owner: getCompositeKey(this._currentOwner),
          currentUser: `${currentUserProvider}:${currentUserProviderId}`,
        });
        return 'owner';
      }
    }

    // Step 2: If not owner, check authorization list
    // No authorizations means no access
    if (!authorizations || authorizations.length === 0) {
      this.logger.debugComponent(
        'ThreatModelAuthorizationService',
        'No authorization entries found',
        {
          currentUser: `${currentUserProvider}:${currentUserProviderId}`,
          userEmail: currentUserEmail,
        },
      );
      return null;
    }

    // Track the highest permission found (owner > writer > reader)
    let highestPermission: 'reader' | 'writer' | 'owner' | null = null;

    // Helper to update highest permission
    const updatePermission = (newRole: 'reader' | 'writer' | 'owner'): boolean => {
      const roleRank = { reader: 1, writer: 2, owner: 3 };
      const currentRank = highestPermission ? roleRank[highestPermission] : 0;
      const newRank = roleRank[newRole];

      if (newRank > currentRank) {
        highestPermission = newRole;
        this.logger.debugComponent(
          'ThreatModelAuthorizationService',
          'Updated highest permission',
          {
            from: highestPermission || 'none',
            to: newRole,
          },
        );
      }

      // Return true if we've reached owner (can short-circuit)
      return newRole === 'owner';
    };

    // Step 3: Loop through authorization entries
    for (const auth of authorizations) {
      // Step 3A: Check user-type authorizations
      if (auth.principal_type === 'user') {
        // Match by (provider, provider_id) composite key
        if (auth.provider === currentUserProvider && auth.provider_id === currentUserProviderId) {
          this.logger.debugComponent(
            'ThreatModelAuthorizationService',
            'User matches authorization entry',
            {
              authEntry: `${auth.provider}:${auth.provider_id}`,
              role: auth.role,
              currentUser: `${currentUserProvider}:${currentUserProviderId}`,
            },
          );
          // Update permission and short-circuit if owner
          if (updatePermission(auth.role)) {
            return 'owner';
          }
        }
      }
      // Step 3B & 3C: Check group-type authorizations
      else if (auth.principal_type === 'group') {
        // Step 3B: Check for "everyone" pseudo-group (case-insensitive)
        if (auth.provider_id.toLowerCase() === 'everyone') {
          this.logger.debugComponent(
            'ThreatModelAuthorizationService',
            'User matches "everyone" group',
            {
              role: auth.role,
            },
          );
          updatePermission(auth.role);
          // Note: "everyone" typically won't have owner role, but handle it anyway
          if (auth.role === 'owner') {
            return 'owner';
          }
        }
        // Step 3C: Check actual group memberships
        // Groups in currentUserGroups are just group names/identifiers
        // We need to match against the auth entry's composite key
        else {
          // Build composite key for this group auth entry
          const groupCompositeKey = `${auth.provider}:${auth.provider_id}`;

          // Check if user is a member of this group
          // currentUserGroups contains group identifiers that should match provider_id
          if (currentUserGroups.includes(auth.provider_id)) {
            this.logger.debugComponent(
              'ThreatModelAuthorizationService',
              'User is member of group',
              {
                group: groupCompositeKey,
                role: auth.role,
                userGroups: currentUserGroups,
              },
            );
            // Update permission and short-circuit if owner
            if (updatePermission(auth.role)) {
              return 'owner';
            }
          }
        }
      }
    }

    // Return the highest permission found
    this.logger.debugComponent('ThreatModelAuthorizationService', 'User permission determined', {
      threatModelId: this._currentThreatModelId,
      permission: highestPermission,
      currentUser: `${currentUserProvider}:${currentUserProviderId}`,
      userEmail: currentUserEmail,
      userGroups: currentUserGroups,
      owner: this._currentOwner ? getCompositeKey(this._currentOwner) : null,
    });

    return highestPermission;
  }

  /**
   * Get current user's permission synchronously
   * @returns The user's permission level or null
   */
  getCurrentUserPermission(): 'reader' | 'writer' | 'owner' | null {
    const authorizations = this._authorizationSubject.value;
    return this.calculateUserPermission(authorizations);
  }

  /**
   * Check if current user can edit synchronously
   */
  canEdit(): boolean {
    const permission = this.getCurrentUserPermission();
    return permission === 'writer' || permission === 'owner';
  }

  /**
   * Check if current user can manage permissions synchronously
   */
  canManagePermissions(): boolean {
    const permission = this.getCurrentUserPermission();
    return permission === 'owner';
  }

  /**
   * Clean up subscriptions
   */
  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.logger.debugComponent(
      'ThreatModelAuthorizationService',
      'ThreatModelAuthorizationService destroyed',
    );
  }
}
