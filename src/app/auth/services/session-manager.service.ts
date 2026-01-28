import { Injectable, NgZone } from '@angular/core';
import { Subscription, timer } from '../../core/rxjs-imports';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { LoggerService } from '../../core/services/logger.service';
import { ActivityTrackerService } from '../../core/services/activity-tracker.service';
import { NotificationService } from '../../shared/services/notification.service';
import { AuthService } from './auth.service';
import { SESSION_CONFIG } from '../config/session.config';
import {
  SessionExpiryDialogComponent,
  SessionExpiryDialogData,
} from '../../core/components/session-expiry-dialog/session-expiry-dialog.component';

/**
 * Service for managing user sessions.
 * Handles token expiration with activity-based proactive refresh and warnings.
 *
 * KNOWN LIMITATION: Multi-tab coordination is not implemented.
 * Each browser tab runs its own SessionManagerService instance, which means:
 * - Multiple tabs may show their own warning dialogs independently
 * - User may extend session in one tab while another still shows expiring countdown
 * - No cross-tab synchronization of timer state
 *
 * Future enhancement: Use BroadcastChannel API or localStorage events to
 * coordinate session state across tabs.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionManagerService {
  // Timer for showing warning dialog (fires 5 minutes before expiry for inactive users)
  private warningTimer: Subscription | null = null;

  // Timer for automatic logout (fires at token expiry)
  private logoutTimer: Subscription | null = null;

  // Timer for checking activity and proactively refreshing token
  private activityCheckTimer: Subscription | null = null;

  // Reference to the warning dialog
  private warningDialog: MatDialogRef<SessionExpiryDialogComponent, string> | null = null;

  // Time before expiration to show warning for inactive users (in milliseconds)
  private readonly warningTime = SESSION_CONFIG.WARNING_TIME_MS;

  // Time before expiration to proactively refresh for active users (in milliseconds)
  private readonly proactiveRefreshTime = SESSION_CONFIG.PROACTIVE_REFRESH_MS;

  // Interval for checking user activity (in milliseconds)
  private readonly activityCheckInterval = SESSION_CONFIG.ACTIVITY_CHECK_INTERVAL_MS;

  constructor(
    private authService: AuthService,
    private logger: LoggerService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private activityTracker: ActivityTrackerService,
    private notificationService: NotificationService,
  ) {
    // this.logger.info('Session Manager Service initialized');
    // Register with AuthService to avoid circular dependency
    this.authService.setSessionManager(this);
    this.initSessionMonitoring();
  }

  /**
   * Initialize session monitoring
   * Sets up timers based on token expiry times
   */
  private initSessionMonitoring(): void {
    // Subscribe to authentication state changes
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.startExpiryTimers();
      } else {
        this.stopExpiryTimers();
      }
    });
  }

  /**
   * Start the token expiry timers based on current token expiration
   * Sets up activity check timer, warning timer (for inactive users), and logout timer
   */
  private startExpiryTimers(): void {
    const token = this.authService.getStoredToken();
    if (!token) {
      this.logger.debugComponent('SessionManager', 'No token found, cannot start expiry timers');
      return;
    }

    this.logger.debugComponent('SessionManager', 'Starting token expiry timers', {
      tokenExpiry: token.expiresAt.toISOString(),
      currentTime: new Date().toISOString(),
    });

    // Stop any existing timers
    this.stopExpiryTimers();

    const now = new Date();
    const timeToExpiry = token.expiresAt.getTime() - now.getTime();
    const timeToWarning = timeToExpiry - this.warningTime;

    // If token is already expired, logout immediately
    if (timeToExpiry <= 0) {
      this.logger.warn('Token already expired, logging out immediately');
      this.handleSessionTimeout();
      return;
    }

    // Start activity-based proactive refresh timer
    this.startActivityCheckTimer();

    // If we're already past the warning time, check activity and show warning if inactive
    if (timeToWarning <= 0) {
      this.logger.warn('Token expires very soon, checking activity');
      if (!this.activityTracker.isUserActive()) {
        this.showExpiryWarning(token.expiresAt);
      } else {
        this.logger.info(
          'User is active but token expiring soon - proactive refresh will handle this',
        );
      }
    } else {
      // Set warning timer (only shown if user is inactive)
      this.ngZone.runOutsideAngular(() => {
        this.warningTimer = timer(timeToWarning).subscribe(() => {
          this.ngZone.run(() => {
            // Only show warning if user is inactive
            if (!this.activityTracker.isUserActive()) {
              this.showExpiryWarning(token.expiresAt);
            } else {
              this.logger.debugComponent(
                'SessionManager',
                'Warning time reached but user is active - skipping warning',
              );
            }
          });
        });
      });

      this.logger.debugComponent('SessionManager', 'Warning timer set', {
        warningTime: new Date(now.getTime() + timeToWarning).toISOString(),
      });
    }

    // Set logout timer
    this.ngZone.runOutsideAngular(() => {
      this.logoutTimer = timer(timeToExpiry).subscribe(() => {
        this.ngZone.run(() => {
          this.logger.warn('Token expired, forcing logout');
          this.handleSessionTimeout();
        });
      });
    });

    this.logger.debugComponent('SessionManager', 'Logout timer set', {
      logoutTime: token.expiresAt.toISOString(),
    });
  }

  /**
   * Start periodic activity check timer for proactive token refresh
   * Checks every minute if user is active and token needs refresh
   */
  private startActivityCheckTimer(): void {
    // Stop existing timer if any
    if (this.activityCheckTimer) {
      this.activityCheckTimer.unsubscribe();
      this.activityCheckTimer = null;
    }

    this.logger.debugComponent('SessionManager', 'Starting activity check timer');

    // Check immediately and then every minute
    this.ngZone.runOutsideAngular(() => {
      this.activityCheckTimer = timer(0, this.activityCheckInterval).subscribe(() => {
        this.ngZone.run(() => {
          this.checkActivityAndRefreshIfNeeded();
        });
      });
    });
  }

  /**
   * Check if user is active and proactively refresh token if needed
   */
  private checkActivityAndRefreshIfNeeded(): void {
    const token = this.authService.getStoredToken();
    if (!token) {
      return;
    }

    const now = new Date();
    const timeToExpiry = token.expiresAt.getTime() - now.getTime();

    // If token expires within proactiveRefreshTime AND user is active, refresh proactively
    if (timeToExpiry <= this.proactiveRefreshTime && this.activityTracker.isUserActive()) {
      this.logger.info('User is active and token expiring soon - refreshing proactively', {
        timeToExpiry: `${Math.floor(timeToExpiry / 1000)}s`,
      });

      this.authService.refreshToken().subscribe({
        next: newToken => {
          this.logger.info('Proactive token refresh successful', {
            newExpiry: newToken.expiresAt.toISOString(),
          });
          // Store the new token - this will trigger onTokenRefreshed() and restart timers
          this.authService.storeToken(newToken);
        },
        error: error => {
          this.logger.error('Proactive token refresh failed', error);
          // Don't force logout on proactive refresh failure - let normal expiry flow handle it
          // But notify the user so they can save their work
          this.notificationService.showWarning(
            'Session refresh failed. Please save your work to avoid data loss.',
            8000,
          );
        },
      });
    }
  }

  /**
   * Cancel all timers without closing the warning dialog
   * Used when starting a refresh operation to prevent race conditions
   */
  private cancelTimersOnly(): void {
    if (this.warningTimer) {
      this.logger.debugComponent('SessionManager', 'Cancelling warning timer');
      this.warningTimer.unsubscribe();
      this.warningTimer = null;
    }

    if (this.logoutTimer) {
      this.logger.debugComponent('SessionManager', 'Cancelling logout timer');
      this.logoutTimer.unsubscribe();
      this.logoutTimer = null;
    }

    if (this.activityCheckTimer) {
      this.logger.debugComponent('SessionManager', 'Cancelling activity check timer');
      this.activityCheckTimer.unsubscribe();
      this.activityCheckTimer = null;
    }
  }

  /**
   * Stop all expiry timers and close warning dialog
   * Made public so AuthService can call it during logout
   */
  stopExpiryTimers(): void {
    this.cancelTimersOnly();

    // Close warning dialog if open
    if (this.warningDialog) {
      this.warningDialog.close();
      this.warningDialog = null;
    }
  }

  /**
   * Show session expiry warning dialog
   * @param expiresAt When the token expires
   */
  private showExpiryWarning(expiresAt: Date): void {
    // Don't show warning if dialog is already open
    if (this.warningDialog) {
      return;
    }

    this.logger.info('Showing session expiry warning dialog');

    const dialogData: SessionExpiryDialogData = {
      expiresAt,
      onExtendSession: () => this.handleExtendSession(),
      onLogout: () => this.handleSessionTimeout(),
    };

    this.warningDialog = this.dialog.open(SessionExpiryDialogComponent, {
      width: '500px',
      data: dialogData,
      disableClose: true,
    });

    this.warningDialog.afterClosed().subscribe((result: string | undefined) => {
      this.warningDialog = null;
      this.logger.debugComponent('SessionManager', 'Warning dialog closed', { result });

      // If dialog was closed due to expiry and no action was taken, logout
      if (result === 'expired') {
        this.handleSessionTimeout();
      }
    });
  }

  /**
   * Handle user requesting session extension
   * Forces a token refresh to extend the session and restart timers
   *
   * IMPORTANT: Cancels all timers BEFORE starting the HTTP refresh to prevent
   * race conditions where the old logout timer fires while the refresh is in-flight.
   * New timers will be set when storeToken() triggers onTokenRefreshed().
   */
  private handleExtendSession(): void {
    this.logger.info('User requested session extension');

    // CRITICAL: Cancel all timers immediately to prevent race condition
    // The old logout timer could fire while the refresh HTTP request is in-flight.
    // New timers will be set when storeToken() triggers onTokenRefreshed().
    // Keep dialog open to show "Extending..." state until we know the result.
    this.cancelTimersOnly();

    // Force a token refresh to get a new token with extended expiry
    // Note: We call refreshToken() directly instead of getValidToken() because getValidToken()
    // will return the existing token if it's still valid (doesn't expire within 1 minute).
    // Since the warning appears 5 minutes before expiry, the token would still be considered
    // "valid" and wouldn't be refreshed, leaving the user with an expiring token.
    this.authService.refreshToken().subscribe({
      next: newToken => {
        this.logger.info('Session extension successful', {
          newExpiry: newToken.expiresAt.toISOString(),
        });
        // Store the new token - this triggers onTokenRefreshed() which sets new timers
        this.authService.storeToken(newToken);
        // Close the warning dialog since session was extended
        if (this.warningDialog) {
          this.warningDialog.close('extend');
        }
      },
      error: error => {
        this.logger.error('Session extension failed', error);
        // Refresh failed - token is likely invalid, proceed to logout
        this.handleSessionTimeout();
      },
    });
  }

  /**
   * Public method to reset timers when token is refreshed
   * Called by AuthService when new tokens are received
   */
  onTokenRefreshed(): void {
    if (this.authService.isAuthenticated) {
      this.logger.debugComponent('SessionManager', 'Token refreshed, restarting timers');
      this.startExpiryTimers();
    }
  }

  /**
   * Handle session timeout
   * Logs out the user and redirects to home page
   */
  private handleSessionTimeout(): void {
    this.logger.warn('Session timeout - logging out user and redirecting to home');

    // Stop timers and close dialog
    this.stopExpiryTimers();

    // Log out the user (this will clear auth data and redirect to home)
    this.authService.logout();
  }
}
