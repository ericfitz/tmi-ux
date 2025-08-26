import { Injectable, NgZone } from '@angular/core';
import { Observable, Subscription, interval, of } from '../../core/rxjs-imports';

import { LoggerService } from '../../core/services/logger.service';
import { AuthService } from './auth.service';
import { JwtToken } from '../models/auth.models';

/**
 * Service for managing user sessions
 * Handles token expiration, session timeouts, and re-authentication
 */
@Injectable({
  providedIn: 'root',
})
export class SessionManagerService {
  // Timer for token expiration check
  private tokenExpiryTimer: Subscription | null = null;

  // Timer for session warning (legacy - kept for test user functionality)
  private sessionWarningTimer: Subscription | null = null;

  // Time before expiration to show warning (in milliseconds)
  private readonly warningTime = 5 * 60 * 1000; // 5 minutes

  // Time to check token expiration (in milliseconds)
  private readonly checkInterval = 60 * 1000; // 1 minute

  constructor(
    private authService: AuthService,
    private logger: LoggerService,
    private ngZone: NgZone,
  ) {
    this.logger.info('Session Manager Service initialized');
    this.initSessionMonitoring();
  }

  /**
   * Initialize session monitoring
   * Sets up timers to check token expiration and show warnings
   */
  private initSessionMonitoring(): void {
    // Subscribe to authentication state changes
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.startExpiryTimer();
      } else {
        this.stopExpiryTimer();
      }
    });
  }

  /**
   * Start the token expiry timer
   * Checks token expiration periodically
   */
  private startExpiryTimer(): void {
    this.logger.debugComponent('SessionManager', 'Starting token expiry timer');

    // Stop any existing timers
    this.stopExpiryTimer();

    // Run timer outside Angular zone to avoid triggering change detection
    this.ngZone.runOutsideAngular(() => {
      this.tokenExpiryTimer = interval(this.checkInterval).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.checkTokenExpiration();
          });
        },
        error: error => {
          this.logger.error('Token expiry timer error', error);
          // Attempt to restart timer after error
          this.ngZone.run(() => {
            this.startExpiryTimer();
          });
        },
      });
    });
  }

  /**
   * Stop the token expiry timer
   */
  private stopExpiryTimer(): void {
    if (this.tokenExpiryTimer) {
      this.logger.debugComponent('SessionManager', 'Stopping token expiry timer');
      this.tokenExpiryTimer.unsubscribe();
      this.tokenExpiryTimer = null;
    }

    if (this.sessionWarningTimer) {
      this.logger.debugComponent('SessionManager', 'Stopping session warning timer');
      this.sessionWarningTimer.unsubscribe();
      this.sessionWarningTimer = null;
    }
  }

  /**
   * Check if the token is about to expire
   * Shows a warning if the token is about to expire
   */
  private checkTokenExpiration(): void {
    const token = this.authService.getStoredToken();

    if (!token) {
      this.logger.debugComponent('SessionManager', 'No token found during expiration check');
      return;
    }

    const timeToExpiry = this.getTimeToExpiry(token);

    if (timeToExpiry <= 0) {
      // Token has expired
      this.logger.warn('Token has expired - attempting refresh');

      // Check if this is a test user - if so, silently extend the session
      if (this.authService.isTestUser) {
        this.logger.info('Test user token expired - silently extending session');
        this.silentlyExtendTestUserSession();
      } else {
        // For OAuth users, attempt to refresh the token
        this.attemptTokenRefresh();
      }
    } else if (timeToExpiry <= this.warningTime) {
      // Token is about to expire - proactively refresh
      this.logger.debugComponent(
        'SessionManager',
        `Token will expire in ${Math.round(timeToExpiry / 1000 / 60)} minutes - proactively refreshing`,
      );

      // Check if this is a test user - if so, silently extend the session
      if (this.authService.isTestUser) {
        this.logger.info('Test user detected - silently extending session');
        this.silentlyExtendTestUserSession();
      } else {
        // For OAuth users, proactively refresh the token
        this.attemptTokenRefresh();
      }
    }
  }

  /**
   * Get time to token expiry in milliseconds
   * @param token JWT token
   * @returns Time to expiry in milliseconds
   */
  private getTimeToExpiry(token: JwtToken): number {
    const now = new Date();
    return token.expiresAt.getTime() - now.getTime();
  }

  /**
   * Show session expiry warning (deprecated - now handled by immediate logout)
   * @param minutesLeft Minutes left before session expires
   */
  private showExpiryWarning(minutesLeft: number): void {
    this.logger.debugComponent(
      'SessionManager',
      `Session expiry warning: ${minutesLeft} minutes left - initiating logout`,
    );

    // For transparent session management, we no longer show dialogs
    // Instead, we log out immediately when session is about to expire
    this.handleSessionTimeout();
  }

  /**
   * Attempt to refresh the JWT token proactively
   * If refresh fails, handle session timeout
   */
  private attemptTokenRefresh(): void {
    this.logger.debugComponent('SessionManager', 'Attempting proactive token refresh');

    this.authService.getValidToken().subscribe({
      next: newToken => {
        this.logger.info('Proactive token refresh successful', {
          newExpiry: newToken.expiresAt.toISOString(),
        });
      },
      error: error => {
        this.logger.error('Proactive token refresh failed', error);
        // If refresh fails, handle session timeout
        this.handleSessionTimeout();
      },
    });
  }

  /**
   * Handle session timeout
   * Logs out the user and redirects to login page
   */
  private handleSessionTimeout(): void {
    this.logger.warn('Session timeout - logging out user and redirecting to home');

    // Stop timers
    this.stopExpiryTimer();

    // Log out the user (this will clear auth data and redirect to home)
    this.authService.logout();
  }

  /**
   * Extend the current session
   * @returns Observable that resolves to true if session was extended
   */
  extendSession(): Observable<boolean> {
    this.logger.debugComponent('SessionManager', 'Extending session');

    // TODO: In a real implementation, we would call a refresh token endpoint
    // For now, just return success
    return of(true);
  }

  /**
   * Silently extend the session for test users
   * Calls the AuthService to extend the test user session without showing any UI
   */
  private silentlyExtendTestUserSession(): void {
    this.logger.debugComponent('SessionManager', 'Silently extending test user session');

    this.authService.extendTestUserSession().subscribe({
      next: success => {
        if (success) {
          this.logger.info('Test user session extended successfully');
        } else {
          this.logger.error('Failed to extend test user session - logging out');
          // Fall back to logout if extension fails
          this.handleSessionTimeout();
        }
      },
      error: error => {
        this.logger.error('Error extending test user session', error);
        // Fall back to logout if extension fails
        this.handleSessionTimeout();
      },
    });
  }
}
