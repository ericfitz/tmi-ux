import { Injectable, NgZone } from '@angular/core';
import { Subscription, timer } from '../../core/rxjs-imports';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { LoggerService } from '../../core/services/logger.service';
import { AuthService } from './auth.service';
import {
  SessionExpiryDialogComponent,
  SessionExpiryDialogData,
} from '../../core/components/session-expiry-dialog/session-expiry-dialog.component';

/**
 * Service for managing user sessions
 * Handles token expiration with timer-based warnings and automatic logout
 */
@Injectable({
  providedIn: 'root',
})
export class SessionManagerService {
  // Timer for showing warning dialog (fires 5 minutes before expiry)
  private warningTimer: Subscription | null = null;

  // Timer for automatic logout (fires at token expiry)
  private logoutTimer: Subscription | null = null;

  // Reference to the warning dialog
  private warningDialog: MatDialogRef<SessionExpiryDialogComponent, string> | null = null;

  // Time before expiration to show warning (in milliseconds)
  private readonly warningTime = 5 * 60 * 1000; // 5 minutes

  constructor(
    private authService: AuthService,
    private logger: LoggerService,
    private ngZone: NgZone,
    private dialog: MatDialog,
  ) {
    this.logger.info('Session Manager Service initialized');
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
   * Sets up warning timer (exp - 5min) and logout timer (exp)
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

    // If we're already past the warning time, show warning immediately
    if (timeToWarning <= 0) {
      this.logger.warn('Token expires very soon, showing warning immediately');
      this.showExpiryWarning(token.expiresAt);
    } else {
      // Set warning timer
      this.ngZone.runOutsideAngular(() => {
        this.warningTimer = timer(timeToWarning).subscribe(() => {
          this.ngZone.run(() => {
            this.showExpiryWarning(token.expiresAt);
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
   * Stop all expiry timers and close warning dialog
   * Made public so AuthService can call it during logout
   */
  stopExpiryTimers(): void {
    if (this.warningTimer) {
      this.logger.debugComponent('SessionManager', 'Stopping warning timer');
      this.warningTimer.unsubscribe();
      this.warningTimer = null;
    }

    if (this.logoutTimer) {
      this.logger.debugComponent('SessionManager', 'Stopping logout timer');
      this.logoutTimer.unsubscribe();
      this.logoutTimer = null;
    }

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
   * Attempts to refresh the token and restart timers
   */
  private handleExtendSession(): void {
    this.logger.info('User requested session extension');

    // Check if this is a local provider - if so, silently extend the session
    if (this.authService.isUsingLocalProvider) {
      this.silentlyExtendLocalUserSession();
      return;
    }

    // For all OAuth users (including test users with real OAuth), attempt to refresh the token
    this.authService.getValidToken().subscribe({
      next: newToken => {
        this.logger.info('Session extension successful', {
          newExpiry: newToken.expiresAt.toISOString(),
        });
        // Close the warning dialog since session was extended
        if (this.warningDialog) {
          this.warningDialog.close('extend');
        }
      },
      error: error => {
        this.logger.error('Session extension failed', error);
        // If refresh fails, handle session timeout
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

  /**
   * Silently extend the session for local provider users
   * Creates a new token with extended expiration time
   */
  private silentlyExtendLocalUserSession(): void {
    this.logger.debugComponent('SessionManager', 'Silently extending local provider session');

    const currentProfile = this.authService.userProfile;
    if (!currentProfile) {
      this.logger.error('No user profile found for session extension');
      this.handleSessionTimeout();
      return;
    }

    // Create a new token with extended expiration using the local token creation method
    const success = this.authService.createLocalTokenWithExpiry(currentProfile, 60); // 60 minutes

    if (success) {
      this.logger.info('Local provider session extended successfully');
      // Close the warning dialog since session was extended
      if (this.warningDialog) {
        this.warningDialog.close('extend');
      }
    } else {
      this.logger.error('Failed to extend local provider session - logging out');
      // Fall back to logout if extension fails
      this.handleSessionTimeout();
    }
  }
}
