import { Injectable, NgZone } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Observable, Subject, Subscription, interval, of, take } from '../../core/rxjs-imports';
import { ReauthDialogComponent } from '../components/reauth-dialog/reauth-dialog.component';

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
  // Session timeout warning subject
  private sessionTimeoutWarning$ = new Subject<number>();

  // Session timeout warning observable
  sessionTimeoutWarning = this.sessionTimeoutWarning$.asObservable();

  // Timer for token expiration check
  private tokenExpiryTimer: Subscription | null = null;

  // Timer for session warning
  private sessionWarningTimer: Subscription | null = null;

  // Flag to track if a warning is currently displayed
  private isWarningDisplayed = false;

  // Time before expiration to show warning (in milliseconds)
  private readonly warningTime = 5 * 60 * 1000; // 5 minutes

  // Time to check token expiration (in milliseconds)
  private readonly checkInterval = 60 * 1000; // 1 minute

  constructor(
    private authService: AuthService,
    private dialog: MatDialog,
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
    this.logger.debug('Starting token expiry timer');

    // Stop any existing timers
    this.stopExpiryTimer();

    // Run timer outside Angular zone to avoid triggering change detection
    this.ngZone.runOutsideAngular(() => {
      this.tokenExpiryTimer = interval(this.checkInterval).subscribe(() => {
        this.ngZone.run(() => {
          this.checkTokenExpiration();
        });
      });
    });
  }

  /**
   * Stop the token expiry timer
   */
  private stopExpiryTimer(): void {
    if (this.tokenExpiryTimer) {
      this.logger.debug('Stopping token expiry timer');
      this.tokenExpiryTimer.unsubscribe();
      this.tokenExpiryTimer = null;
    }

    if (this.sessionWarningTimer) {
      this.logger.debug('Stopping session warning timer');
      this.sessionWarningTimer.unsubscribe();
      this.sessionWarningTimer = null;
    }

    this.isWarningDisplayed = false;
  }

  /**
   * Check if the token is about to expire
   * Shows a warning if the token is about to expire
   */
  private checkTokenExpiration(): void {
    const token = this.authService.getStoredToken();

    if (!token) {
      this.logger.debug('No token found during expiration check');
      return;
    }

    const timeToExpiry = this.getTimeToExpiry(token);

    if (timeToExpiry <= 0) {
      // Token has expired
      this.logger.warn('Token has expired');
      this.handleSessionTimeout();
    } else if (timeToExpiry <= this.warningTime && !this.isWarningDisplayed) {
      // Token is about to expire, show warning
      this.logger.debug(`Token will expire in ${Math.round(timeToExpiry / 1000 / 60)} minutes`);
      this.showExpiryWarning(Math.round(timeToExpiry / 1000 / 60));
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
   * Show session expiry warning
   * @param minutesLeft Minutes left before session expires
   */
  private showExpiryWarning(minutesLeft: number): void {
    this.logger.debug(`Showing session expiry warning: ${minutesLeft} minutes left`);

    // Set warning flag
    this.isWarningDisplayed = true;

    // Emit warning event
    this.sessionTimeoutWarning$.next(minutesLeft);

    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true; // Prevent closing by clicking outside or pressing ESC
    dialogConfig.autoFocus = true; // Focus the first focusable element
    dialogConfig.data = { reason: 'timeout_warning', minutesLeft };

    const dialogRef = this.dialog.open(ReauthDialogComponent, dialogConfig);

    dialogRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (result === true) {
          this.extendSession();
        } else {
          this.authService.logout();
        }
      });
  }

  /**
   * Handle session timeout
   * Logs out the user and redirects to login page
   */
  private handleSessionTimeout(): void {
    this.logger.warn('Session timeout - logging out');

    // Stop timers
    this.stopExpiryTimer();

    // Log out the user
    this.authService.logout();

    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = { reason: 'session_expired' };

    const dialogRef = this.dialog.open(ReauthDialogComponent, dialogConfig);

    dialogRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (result !== true) {
          this.authService.logout();
        }
      });
  }

  /**
   * Extend the current session
   * @returns Observable that resolves to true if session was extended
   */
  extendSession(): Observable<boolean> {
    this.logger.debug('Extending session');

    // TODO: In a real implementation, we would call a refresh token endpoint
    // For now, we'll just reset the warning flag
    this.isWarningDisplayed = false;

    // Return success
    return of(true);
  }
}
