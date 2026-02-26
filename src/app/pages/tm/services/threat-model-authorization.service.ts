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

    // Subscribe to user profile changes and recalculate permissions
    // This handles the case where authorization is set before user profile is loaded
    this._subscriptions.add(
      this.authService.userProfile$.subscribe(() => {
        // Recalculate if we have a threat model loaded (even with null authorization)
        // This is critical for newly created threat models where authorization is null
        // but the owner field grants permissions
        if (this._currentThreatModelId !== null) {
          const currentAuthorizations = this._authorizationSubject.value;
          // Trigger recalculation by emitting the same authorization data
          // This will cause calculateUserPermission to run again with updated user info
          this._authorizationSubject.next(currentAuthorizations);
          this.logger.debugComponent(
            'ThreatModelAuthorizationService',
            'User profile changed - recalculating permissions',
            {
              threatModelId: this._currentThreatModelId,
              owner: this._currentOwner ? getCompositeKey(this._currentOwner) : null,
              permission: this.getCurrentUserPermission(),
            },
          );
        }
      }),
    );
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
    if (this._checkOwnerMatch(currentUserProvider, currentUserProviderId, currentUserEmail)) {
      return 'owner';
    }

    // Step 2: If not owner, check authorization list
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

    // Step 3: Find highest permission from authorization entries
    const highestPermission = this._findHighestPermission(
      authorizations,
      currentUserProvider,
      currentUserProviderId,
      currentUserGroups,
    );

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
   * Check if the current user matches the threat model owner.
   * Uses primary (provider, provider_id) match with email fallback.
   */
  private _checkOwnerMatch(
    currentUserProvider: string,
    currentUserProviderId: string,
    currentUserEmail: string | null,
  ): boolean {
    if (!this._currentOwner) {
      this.logger.debugComponent(
        'ThreatModelAuthorizationService',
        'No owner set for threat model',
        { threatModelId: this._currentThreatModelId },
      );
      return false;
    }

    this.logger.debugComponent(
      'ThreatModelAuthorizationService',
      'Comparing user against owner field',
      {
        currentOwner: this._currentOwner,
        currentUser: { provider: currentUserProvider, provider_id: currentUserProviderId },
        providerMatch: this._currentOwner.provider === currentUserProvider,
        providerIdMatch: this._currentOwner.provider_id === currentUserProviderId,
      },
    );

    const providerMatches = this._currentOwner.provider === currentUserProvider;
    const providerIdMatches = this._currentOwner.provider_id === currentUserProviderId;

    // Fallback: backend bug where owner.provider_id contains email instead of OAuth provider ID
    const emailFallbackMatches =
      !providerIdMatches &&
      !!this._currentOwner.email &&
      !!currentUserEmail &&
      this._currentOwner.provider_id === currentUserEmail;

    if (!providerMatches || (!providerIdMatches && !emailFallbackMatches)) {
      this.logger.debugComponent(
        'ThreatModelAuthorizationService',
        'User does NOT match owner field',
        {
          owner: getCompositeKey(this._currentOwner),
          currentUser: `${currentUserProvider}:${currentUserProviderId}`,
          providerMatches,
          providerIdMatches,
          emailFallbackMatches,
        },
      );
      return false;
    }

    if (emailFallbackMatches) {
      this.logger.warn(
        'Owner matched via email fallback - backend is storing email in provider_id field',
        {
          owner: getCompositeKey(this._currentOwner),
          currentUser: `${currentUserProvider}:${currentUserProviderId}`,
          matchedVia: 'email',
        },
      );
    }

    this.logger.debugComponent('ThreatModelAuthorizationService', 'User matches owner field', {
      owner: getCompositeKey(this._currentOwner),
      currentUser: `${currentUserProvider}:${currentUserProviderId}`,
      matchMethod: emailFallbackMatches ? 'email' : 'provider_id',
    });

    return true;
  }

  /**
   * Find the highest permission from authorization entries.
   * Short-circuits when 'owner' is found (maximum possible).
   */
  private _findHighestPermission(
    authorizations: Authorization[],
    currentUserProvider: string,
    currentUserProviderId: string,
    currentUserGroups: string[],
  ): 'reader' | 'writer' | 'owner' | null {
    const ROLE_RANK: Record<string, number> = { reader: 1, writer: 2, owner: 3 };
    let highestPermission: 'reader' | 'writer' | 'owner' | null = null;

    for (const auth of authorizations) {
      const matchedRole = this._matchAuthorizationEntry(
        auth,
        currentUserProvider,
        currentUserProviderId,
        currentUserGroups,
      );

      if (!matchedRole) continue;

      const currentRank = highestPermission ? ROLE_RANK[highestPermission] : 0;
      if (ROLE_RANK[matchedRole] > currentRank) {
        highestPermission = matchedRole;
      }

      if (highestPermission === 'owner') return 'owner';
    }

    return highestPermission;
  }

  /**
   * Check if a single authorization entry matches the current user.
   * Returns the entry's role if matched, null otherwise.
   */
  private _matchAuthorizationEntry(
    auth: Authorization,
    currentUserProvider: string,
    currentUserProviderId: string,
    currentUserGroups: string[],
  ): 'reader' | 'writer' | 'owner' | null {
    if (auth.principal_type === 'user') {
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
        return auth.role;
      }
    } else if (auth.principal_type === 'group') {
      if (auth.provider_id.toLowerCase() === 'everyone') {
        this.logger.debugComponent(
          'ThreatModelAuthorizationService',
          'User matches "everyone" group',
          { role: auth.role },
        );
        return auth.role;
      }

      if (currentUserGroups.includes(auth.provider_id)) {
        this.logger.debugComponent('ThreatModelAuthorizationService', 'User is member of group', {
          group: `${auth.provider}:${auth.provider_id}`,
          role: auth.role,
          userGroups: currentUserGroups,
        });
        return auth.role;
      }
    }

    return null;
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
