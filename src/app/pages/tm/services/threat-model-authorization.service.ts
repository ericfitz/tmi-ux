import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Authorization } from '../models/threat-model.model';

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

  // Current threat model ID being tracked
  private _currentThreatModelId: string | null = null;

  // Subscription management
  private _subscriptions = new Subscription();

  constructor(
    private logger: LoggerService,
    private authService: AuthService,
  ) {
    this.logger.info('ThreatModelAuthorizationService initialized');
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
   */
  setAuthorization(threatModelId: string, authorization: Authorization[]): void {
    this._currentThreatModelId = threatModelId;
    this._authorizationSubject.next(authorization);

    const userPermission = this.calculateUserPermission(authorization);
    this.logger.info('Authorization updated', {
      threatModelId,
      authorizationCount: authorization.length,
      currentUserPermission: userPermission,
    });
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
    this._currentThreatModelId = null;
    this._authorizationSubject.next(null);
    this.logger.debug('Authorization cleared');
  }

  /**
   * Calculate current user's permission based on authorization data
   * @param authorizations The authorization data
   * @returns The user's permission level or null
   */
  private calculateUserPermission(
    authorizations: Authorization[] | null,
  ): 'reader' | 'writer' | 'owner' | null {
    if (!authorizations || authorizations.length === 0) {
      return null;
    }

    const currentUserEmail = this.authService.userEmail;
    if (!currentUserEmail) {
      this.logger.warn('Cannot calculate user permission - no authenticated user');
      return null;
    }

    const userAuth = authorizations.find(auth => auth.subject === currentUserEmail);
    return userAuth?.role || null;
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
    this.logger.debug('ThreatModelAuthorizationService destroyed');
  }
}
