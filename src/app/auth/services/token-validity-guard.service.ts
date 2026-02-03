/**
 * Token Validity Guard Service
 *
 * This service provides defense against "zombie sessions" - situations where the user
 * appears to be authenticated (based on stale BehaviorSubject state) but their token
 * has actually expired. This commonly occurs when:
 *
 * 1. User backgrounds the browser tab for an extended period
 * 2. Browser throttles JavaScript timers (Chrome throttles to 1min+ in background)
 * 3. The SessionManagerService logout timer never fires
 * 4. User returns to find themselves on a protected page with expired credentials
 *
 * This service uses three layers of defense:
 * - Layer 1: visibilitychange event - immediate validation when tab becomes visible
 * - Layer 2: Heartbeat drift detection - catches token expiry if timers were throttled
 * - Layer 3: storage event listener - cross-tab synchronization of logout events
 */

import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { LoggerService } from '../../core/services/logger.service';
import { AuthService } from './auth.service';
import { SESSION_CONFIG } from '../config/session.config';

@Injectable({
  providedIn: 'root',
})
export class TokenValidityGuardService implements OnDestroy {
  // Heartbeat tracking for drift detection
  private lastHeartbeat = Date.now();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  // Event listener references for cleanup
  private visibilityChangeHandler: (() => void) | null = null;
  private storageEventHandler: ((event: StorageEvent) => void) | null = null;

  // Configuration
  private readonly heartbeatIntervalMs = SESSION_CONFIG.HEARTBEAT_INTERVAL_MS;
  private readonly driftMultiplier = SESSION_CONFIG.DRIFT_DETECTION_MULTIPLIER;

  constructor(
    private authService: AuthService,
    private logger: LoggerService,
    private router: Router,
    private ngZone: NgZone,
  ) {}

  ngOnDestroy(): void {
    this.stopMonitoring();
  }

  /**
   * Start all monitoring mechanisms.
   * Called during app initialization via APP_INITIALIZER.
   */
  startMonitoring(): void {
    this.logger.debugComponent('TokenValidityGuard', 'Starting token validity monitoring');

    this.setupVisibilityChangeHandler();
    this.setupHeartbeatDriftDetection();
    this.setupStorageEventListener();
  }

  /**
   * Stop all monitoring mechanisms.
   * Called during service destruction.
   */
  stopMonitoring(): void {
    this.logger.debugComponent('TokenValidityGuard', 'Stopping token validity monitoring');

    // Clean up visibility change handler
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    // Clean up heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clean up storage event listener
    if (this.storageEventHandler) {
      window.removeEventListener('storage', this.storageEventHandler);
      this.storageEventHandler = null;
    }
  }

  /**
   * Layer 1: Visibility Change Handler
   *
   * When the browser tab becomes visible again after being backgrounded,
   * immediately validate the token. This catches the most common case of
   * users returning to a tab after a long absence.
   */
  private setupVisibilityChangeHandler(): void {
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        this.logger.debugComponent('TokenValidityGuard', 'Tab became visible, validating token');
        this.ngZone.run(() => {
          this.validateTokenAndRedirectIfExpired();
        });
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * Layer 2: Heartbeat Drift Detection
   *
   * Maintains a heartbeat that tracks wall-clock time vs expected timer intervals.
   * If the elapsed time since the last heartbeat significantly exceeds the expected
   * interval, we know timers were throttled (browser backgrounded, CPU throttled, etc.)
   * and should immediately validate the token.
   */
  private setupHeartbeatDriftDetection(): void {
    this.lastHeartbeat = Date.now();

    // Run outside Angular zone to avoid unnecessary change detection
    this.ngZone.runOutsideAngular(() => {
      this.heartbeatInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - this.lastHeartbeat;
        const expectedMax = this.heartbeatIntervalMs * this.driftMultiplier;

        // If significantly more time elapsed than expected, timers were throttled
        if (elapsed > expectedMax) {
          this.logger.warn('Timer drift detected - browser was likely backgrounded', {
            elapsed: `${Math.floor(elapsed / 1000)}s`,
            expected: `${Math.floor(this.heartbeatIntervalMs / 1000)}s`,
          });

          this.ngZone.run(() => {
            this.validateTokenAndRedirectIfExpired();
          });
        }

        this.lastHeartbeat = now;
      }, this.heartbeatIntervalMs);
    });
  }

  /**
   * Layer 3: Storage Event Listener
   *
   * Listens for localStorage changes from other tabs. When another tab logs out,
   * it broadcasts via localStorage, and this handler ensures all tabs clear their
   * auth state and redirect to home.
   *
   * Note: The 'storage' event only fires in OTHER tabs, not the one that made
   * the change. This is by design - the originating tab handles its own state.
   */
  private setupStorageEventListener(): void {
    this.storageEventHandler = (event: StorageEvent) => {
      // Handle logout broadcast from another tab
      if (event.key === 'auth_logout_broadcast') {
        this.logger.info('Received logout broadcast from another tab');
        this.ngZone.run(() => {
          this.handleCrossTabLogout();
        });
        return;
      }

      // Handle token removal from another tab
      if (event.key === 'auth_token' && event.newValue === null) {
        this.logger.info('Token removed in another tab, validating auth state');
        this.ngZone.run(() => {
          this.authService.validateAndUpdateAuthState();
        });
      }
    };

    window.addEventListener('storage', this.storageEventHandler);
  }

  /**
   * Validate token and redirect to home if expired.
   * This is the core method called by all three layers.
   */
  private validateTokenAndRedirectIfExpired(): void {
    // First, update the auth state based on actual token validity
    this.authService.validateAndUpdateAuthState();

    // If no longer authenticated, redirect to home
    // The BehaviorSubject has been updated by validateAndUpdateAuthState
    if (!this.authService.isAuthenticated) {
      this.logger.warn('Token expired, redirecting to home page');
      void this.router.navigate(['/']);
    }
  }

  /**
   * Handle logout broadcast from another tab.
   * Clears local auth state and redirects to home.
   */
  private handleCrossTabLogout(): void {
    // Validate state (this will clear if token is gone)
    this.authService.validateAndUpdateAuthState();

    // If the logout broadcast was real, we should no longer be authenticated
    if (!this.authService.isAuthenticated) {
      this.logger.info('Cross-tab logout confirmed, redirecting to home');
      void this.router.navigate(['/']);
    }
  }
}
