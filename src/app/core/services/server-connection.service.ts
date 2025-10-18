/**
 * Server Connection Service
 *
 * This service monitors the connection status to the configured API server.
 * It provides reactive streams for connection status and handles periodic health checks.
 *
 * Key functionality:
 * - Monitors server connectivity through periodic HTTP health checks
 * - Provides reactive connection status (NOT_CONFIGURED, ERROR, CONNECTED)
 * - Handles connection error recovery and retry logic with exponential backoff
 * - Integrates with environment configuration to detect server settings
 */

import { Injectable, OnDestroy, Injector } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, timer, Subscription, EMPTY } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

export enum ServerConnectionStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  ERROR = 'ERROR',
  CONNECTED = 'CONNECTED',
}

/**
 * Detailed connection state information for save operations
 */
export interface DetailedConnectionStatus {
  isOnline: boolean;
  isServerReachable: boolean;
  lastServerPing?: Date;
  lastServerError?: Date;
  consecutiveFailures: number;
  retryAttempt: number;
  status: ServerConnectionStatus;
}

/**
 * Interface for server health response based on tmi-openapi.json ApiInfo schema
 */
interface ServerHealthResponse {
  status: {
    code: 'OK' | 'ERROR';
    time: string;
  };
  service: {
    name: string;
    build: string;
  };
  api: {
    version: string;
    specification: string;
  };
  operator: {
    name: string;
    contact: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ServerConnectionService implements OnDestroy {
  private readonly _connectionStatus$ = new BehaviorSubject<ServerConnectionStatus>(
    ServerConnectionStatus.NOT_CONFIGURED,
  );
  private readonly _detailedConnectionStatus$ = new BehaviorSubject<DetailedConnectionStatus>({
    isOnline: navigator.onLine,
    isServerReachable: false,
    consecutiveFailures: 0,
    retryAttempt: 0,
    status: ServerConnectionStatus.NOT_CONFIGURED,
  });
  private _healthCheckSubscription: Subscription | null = null;
  private _authStateSubscription: Subscription | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MIN_BACKOFF_DELAY = 1000; // 1 second
  private readonly MAX_BACKOFF_DELAY = 30000; // 30 seconds
  private _currentBackoffDelay = this.MIN_BACKOFF_DELAY;
  private _isMonitoring = false;
  private _baseRetryDelay = 1000;
  private _maxRetryInterval = 300000; // 5 minutes
  private _serverVersion: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _authService: any = null; // Lazy-loaded to avoid circular dependency

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private injector: Injector,
  ) {
    this.initializeConnectionMonitoring();
    this.initializeBrowserEventListeners();
  }

  /**
   * Observable stream of current connection status
   */
  get connectionStatus$(): Observable<ServerConnectionStatus> {
    return this._connectionStatus$.asObservable();
  }

  /**
   * Observable stream of detailed connection status for save operations
   */
  get detailedConnectionStatus$(): Observable<DetailedConnectionStatus> {
    return this._detailedConnectionStatus$.asObservable();
  }

  /**
   * Get current connection status synchronously
   */
  get currentStatus(): ServerConnectionStatus {
    return this._connectionStatus$.value;
  }

  /**
   * Get current detailed connection status synchronously
   */
  get currentDetailedStatus(): DetailedConnectionStatus {
    return this._detailedConnectionStatus$.value;
  }

  /**
   * Get server version from last successful health check
   * @returns Server version string or null if not yet retrieved
   */
  getServerVersion(): string | null {
    return this._serverVersion;
  }

  ngOnDestroy(): void {
    if (this._healthCheckSubscription) {
      this._healthCheckSubscription.unsubscribe();
    }
    if (this._authStateSubscription) {
      this._authStateSubscription.unsubscribe();
    }
    this.stopMonitoring();
  }

  /**
   * Start monitoring connection status (for save operations)
   */
  startMonitoring(): void {
    if (this._isMonitoring) return;

    this._isMonitoring = true;
    this.logger.debugComponent(
      'ServerConnection',
      'Starting connection monitoring for save operations',
    );

    if (!this.shouldConnectToServer()) {
      this.logger.info('Server monitoring disabled - not configured or using local provider');
      return;
    }
  }

  /**
   * Stop monitoring connection status
   */
  stopMonitoring(): void {
    this._isMonitoring = false;
    this.logger.debugComponent('ServerConnection', 'Stopping connection monitoring');
  }

  /**
   * Force an immediate server connectivity check
   * @returns Observable that emits the updated connection status
   */
  checkServerConnectivity(): Observable<DetailedConnectionStatus> {
    return this.performDetailedHealthCheck().pipe(
      tap(() => {
        // Schedule next ping after successful manual check
        this.scheduleNextHealthCheck(this.HEALTH_CHECK_INTERVAL);
      }),
    );
  }

  /**
   * Check if we should show a connection error notification
   * Based on connection state and whether we've already shown one recently
   * @returns true if notification should be shown
   */
  shouldShowConnectionError(): boolean {
    const status = this._detailedConnectionStatus$.value;

    // Only show on first failure or after connection was restored and failed again
    return (
      !status.isServerReachable && (status.consecutiveFailures === 1 || status.retryAttempt === 1)
    );
  }

  /**
   * Check if connection was recently restored (useful for auto-retry logic)
   * @returns true if connection was recently restored
   */
  wasConnectionRecentlyRestored(): boolean {
    const status = this._detailedConnectionStatus$.value;

    return (
      status.isServerReachable &&
      status.lastServerPing !== undefined &&
      status.lastServerError !== undefined &&
      status.lastServerPing > status.lastServerError
    );
  }

  /**
   * Initialize browser online/offline event listeners
   */
  private initializeBrowserEventListeners(): void {
    // Listen for browser online/offline events
    window.addEventListener('online', () => {
      this.handleBrowserOnlineChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleBrowserOnlineChange(false);
    });
  }

  /**
   * Handle browser online/offline events
   * @param isOnline Whether browser is online
   */
  private handleBrowserOnlineChange(isOnline: boolean): void {
    const currentStatus = this._detailedConnectionStatus$.value;

    this.logger.debugComponent(
      'ServerConnection',
      `Browser connection changed: ${isOnline ? 'online' : 'offline'}`,
    );

    if (isOnline) {
      // Browser came back online - immediately check server
      this.updateDetailedConnectionStatus({
        ...currentStatus,
        isOnline: true,
        retryAttempt: 0, // Reset retry attempts
      });

      // Start monitoring and ping server immediately if monitoring is active
      if (this._isMonitoring) {
        this.performDetailedHealthCheck().subscribe();
      }
    } else {
      // Browser went offline
      this.updateDetailedConnectionStatus({
        ...currentStatus,
        isOnline: false,
        isServerReachable: false,
        lastServerError: new Date(),
      });
    }
  }

  /**
   * Initialize connection monitoring based on environment configuration
   */
  private initializeConnectionMonitoring(): void {
    // Check if server is configured
    if (!this.isServerConfigured()) {
      this.logger.info('Server not configured - connection monitoring disabled');
      this._connectionStatus$.next(ServerConnectionStatus.NOT_CONFIGURED);
      return;
    }

    this.logger.info(`Server configured at ${environment.apiUrl} - starting connection monitoring`);

    // Subscribe to auth state changes to stop monitoring when using local provider
    this.subscribeToAuthStateChanges();

    // Start periodic health checks if we should connect
    if (this.shouldConnectToServer()) {
      this.startHealthChecks();
    } else {
      this.logger.info('Skipping server monitoring - using local provider');
    }
  }

  /**
   * Subscribe to authentication state changes
   * Stop monitoring when user logs in with local provider
   * Resume monitoring when user logs out
   */
  private subscribeToAuthStateChanges(): void {
    // Load AuthService asynchronously and subscribe to state changes
    void this.getAuthService().then(authService => {
      if (!authService) {
        this.logger.debugComponent(
          'ServerConnection',
          'AuthService not available - skipping state subscription',
        );
        return;
      }

      // Subscribe to user profile changes to detect provider switches
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      this._authStateSubscription = authService.userProfile$.subscribe((profile: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const isUsingLocal = authService.isUsingLocalProvider;

        this.logger.debugComponent('ServerConnection', 'Auth state changed', {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          isAuthenticated: authService.isAuthenticated,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          isUsingLocalProvider: isUsingLocal,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          userEmail: profile?.email,
        });

        // If using local provider, stop health checks
        if (isUsingLocal) {
          this.logger.info(
            'User logged in with local provider - stopping server connection monitoring',
          );
          this.stopHealthChecks();
        }
        // If not using local provider and server is configured, start health checks
        else if (this.isServerConfigured() && !this._healthCheckSubscription) {
          this.logger.info('User logged out or using server provider - resuming server monitoring');
          this.startHealthChecks();
        }
      });
    });
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthChecks(): void {
    if (this._healthCheckSubscription) {
      this._healthCheckSubscription.unsubscribe();
      this._healthCheckSubscription = null;
    }
  }

  /**
   * Check if server is configured based on environment
   */
  private isServerConfigured(): boolean {
    // Consider server not configured only if apiUrl is empty or whitespace
    // Any explicitly configured URL (including localhost) is considered a configured server
    const apiUrl = environment.apiUrl;
    return !!(apiUrl && apiUrl.trim());
  }

  /**
   * Get AuthService lazily to avoid circular dependency
   * Uses dynamic import to break circular reference at module level
   * @returns AuthService instance or null if loading fails
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getAuthService(): Promise<any> {
    if (!this._authService) {
      try {
        // Dynamically import AuthService to avoid circular dependency at module level
        const { AuthService } = await import('../../auth/services/auth.service');
        this._authService = this.injector.get(AuthService);
      } catch (error) {
        this.logger.warn('Could not load AuthService', error);
        return null;
      }
    }
    return this._authService;
  }

  /**
   * Check if we should connect to the server
   * Returns false if:
   * - Server is not configured (empty apiUrl)
   * - User is authenticated with local provider
   */
  private shouldConnectToServer(): boolean {
    // First check if server is configured
    if (!this.isServerConfigured()) {
      return false;
    }

    // Check if user is using local provider (synchronous check using cached authService)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (this._authService && this._authService.isUsingLocalProvider) {
      this.logger.debugComponent(
        'ServerConnection',
        'Skipping server connection - user is using local provider',
      );
      return false;
    }

    return true;
  }

  /**
   * Start periodic health check monitoring with exponential backoff
   */
  private startHealthChecks(): void {
    // Perform initial health check
    this.scheduleNextHealthCheck(0); // Start immediately
  }

  /**
   * Schedule the next health check with appropriate delay
   */
  private scheduleNextHealthCheck(delay: number): void {
    // Clean up any existing subscription
    if (this._healthCheckSubscription) {
      this._healthCheckSubscription.unsubscribe();
    }

    // Schedule the next health check
    this._healthCheckSubscription = timer(delay)
      .pipe(
        switchMap(() => this.performHealthCheck()),
        // After health check completes, schedule the next one
      )
      .subscribe({
        complete: () => {
          // Schedule next health check based on current status
          const nextDelay = this.getHealthCheckDelay();
          // this.logger.debugComponent('ServerConnection',
          //   `Scheduling next health check in ${nextDelay}ms (backoff: ${this._currentBackoffDelay}ms)`,
          // );
          this.scheduleNextHealthCheck(nextDelay);
        },
      });
  }

  /**
   * Perform a single health check against the server
   */
  private performHealthCheck(): Observable<void> {
    // Check if we should connect to server
    if (!this.shouldConnectToServer()) {
      this.logger.debugComponent(
        'ServerConnection',
        'Skipping health check - server not configured or using local provider',
      );
      return EMPTY;
    }

    this.logger.debugComponent('ServerConnection', 'Performing HTTP health check');

    // Use the root API endpoint as defined in tmi-openapi.json
    // Remove trailing /api if present (e.g., 'http://localhost:8080/api' -> 'http://localhost:8080')
    const statusEndpoint = environment.apiUrl.replace(/\/api$/, '');

    return this.http.get<ServerHealthResponse>(statusEndpoint).pipe(
      map(response => {
        if (response.status?.code === 'OK') {
          this.logger.debugComponent('ServerConnection', 'Server status check successful');
          this._connectionStatus$.next(ServerConnectionStatus.CONNECTED);

          // Store server version from health response
          if (response.service?.build) {
            this._serverVersion = response.service.build;
          }

          // Update detailed status as well
          const currentDetailed = this._detailedConnectionStatus$.value;
          this.updateDetailedConnectionStatus({
            ...currentDetailed,
            isServerReachable: true,
            lastServerPing: new Date(),
            consecutiveFailures: 0,
            retryAttempt: 0,
            status: ServerConnectionStatus.CONNECTED,
          });

          // Reset backoff delay on successful connection
          this.resetBackoffDelay();
        } else {
          this.logger.warn(`Server status check returned non-OK status: ${response.status?.code}`);
          this._connectionStatus$.next(ServerConnectionStatus.ERROR);

          // Update detailed status
          const currentDetailed = this._detailedConnectionStatus$.value;
          this.updateDetailedConnectionStatus({
            ...currentDetailed,
            isServerReachable: false,
            lastServerError: new Date(),
            consecutiveFailures: currentDetailed.consecutiveFailures + 1,
            retryAttempt: currentDetailed.retryAttempt + 1,
            status: ServerConnectionStatus.ERROR,
          });

          // Increase backoff delay for next retry
          this._currentBackoffDelay = this.getNextBackoffDelay();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.warn(`Server status check failed: ${error.status} ${error.statusText}`);
        this._connectionStatus$.next(ServerConnectionStatus.ERROR);

        // Update detailed status
        const currentDetailed = this._detailedConnectionStatus$.value;
        this.updateDetailedConnectionStatus({
          ...currentDetailed,
          isServerReachable: false,
          lastServerError: new Date(),
          consecutiveFailures: currentDetailed.consecutiveFailures + 1,
          retryAttempt: currentDetailed.retryAttempt + 1,
          status: ServerConnectionStatus.ERROR,
        });

        // Increase backoff delay for next retry
        this._currentBackoffDelay = this.getNextBackoffDelay();
        // Return empty observable that completes immediately to continue the stream
        return EMPTY;
      }),
    );
  }

  /**
   * Perform a detailed health check for save operations (with skip-auth option)
   */
  private performDetailedHealthCheck(): Observable<DetailedConnectionStatus> {
    // Check if we should connect to server
    if (!this.shouldConnectToServer()) {
      this.logger.debugComponent(
        'ServerConnection',
        'Skipping detailed health check - server not configured or using local provider',
      );
      return new Observable(subscriber => {
        subscriber.next(this._detailedConnectionStatus$.value);
        subscriber.complete();
      });
    }

    if (!navigator.onLine) {
      // Don't ping if browser is offline
      return new Observable(subscriber => {
        subscriber.next(this._detailedConnectionStatus$.value);
        subscriber.complete();
      });
    }

    const pingUrl = `${environment.apiUrl}/`;

    this.logger.debugComponent('ServerConnection', 'Pinging server for connectivity check', {
      url: pingUrl,
    });

    return this.http
      .get(pingUrl, {
        // Don't use auth interceptor for health checks
        headers: { 'skip-auth': 'true' },
      })
      .pipe(
        tap(() => {
          // Server is reachable
          const currentStatus = this._detailedConnectionStatus$.value;
          this.updateDetailedConnectionStatus({
            ...currentStatus,
            isServerReachable: true,
            lastServerPing: new Date(),
            consecutiveFailures: 0,
            retryAttempt: 0,
            status: ServerConnectionStatus.CONNECTED,
          });

          // Also update simple status
          this._connectionStatus$.next(ServerConnectionStatus.CONNECTED);
          this.resetBackoffDelay();

          this.logger.debugComponent('ServerConnection', 'Server ping successful');
        }),
        catchError((error: HttpErrorResponse) => {
          // Server is not reachable
          const currentStatus = this._detailedConnectionStatus$.value;
          const consecutiveFailures = currentStatus.consecutiveFailures + 1;

          this.updateDetailedConnectionStatus({
            ...currentStatus,
            isServerReachable: false,
            lastServerError: new Date(),
            consecutiveFailures,
            retryAttempt: currentStatus.retryAttempt + 1,
            status: ServerConnectionStatus.ERROR,
          });

          // Also update simple status
          this._connectionStatus$.next(ServerConnectionStatus.ERROR);
          this._currentBackoffDelay = this.getNextBackoffDelay();

          this.logger.debugComponent('ServerConnection', 'Server ping failed', {
            error: (error as Error).message,
            consecutiveFailures,
            retryAttempt: currentStatus.retryAttempt + 1,
          });

          // Return current status instead of throwing error
          return new Observable(subscriber => {
            subscriber.next(this._detailedConnectionStatus$.value);
            subscriber.complete();
          });
        }),
        switchMap(() => {
          return new Observable<DetailedConnectionStatus>(subscriber => {
            subscriber.next(this._detailedConnectionStatus$.value);
            subscriber.complete();
          });
        }),
      );
  }

  /**
   * Manually trigger a connection check
   */
  public checkConnection(): void {
    if (this.shouldConnectToServer()) {
      this.performHealthCheck().subscribe({
        next: () => {
          this.logger.debugComponent(
            'ServerConnection',
            'HTTP health check completed successfully',
          );
        },
        error: error => {
          this.logger.error('HTTP health check failed', error);
        },
      });
    } else {
      this.logger.debugComponent(
        'ServerConnection',
        'Connection check skipped - server not configured or using local provider',
      );
    }
  }

  /**
   * Calculate the next backoff delay using exponential backoff
   */
  private getNextBackoffDelay(): number {
    return Math.min(this._currentBackoffDelay * 2, this.MAX_BACKOFF_DELAY);
  }

  /**
   * Reset backoff delay to minimum when connection is successful
   */
  private resetBackoffDelay(): void {
    this._currentBackoffDelay = this.MIN_BACKOFF_DELAY;
  }

  /**
   * Get the appropriate delay for the next health check based on current status
   */
  private getHealthCheckDelay(): number {
    const currentStatus = this._connectionStatus$.value;
    if (currentStatus === ServerConnectionStatus.CONNECTED) {
      // Use normal interval when connected
      return this.HEALTH_CHECK_INTERVAL;
    } else {
      // Use current backoff delay when not connected
      return this._currentBackoffDelay;
    }
  }

  /**
   * Update detailed connection status and notify subscribers
   * @param newStatus New detailed connection status
   */
  private updateDetailedConnectionStatus(newStatus: DetailedConnectionStatus): void {
    const previousStatus = this._detailedConnectionStatus$.value;
    this._detailedConnectionStatus$.next(newStatus);

    // Log significant state changes
    if (previousStatus.isServerReachable !== newStatus.isServerReachable) {
      const message = newStatus.isServerReachable
        ? 'Server connection restored'
        : 'Server connection lost';

      this.logger.info(message, {
        previousStatus: {
          isOnline: previousStatus.isOnline,
          isServerReachable: previousStatus.isServerReachable,
        },
        newStatus: {
          isOnline: newStatus.isOnline,
          isServerReachable: newStatus.isServerReachable,
        },
        consecutiveFailures: newStatus.consecutiveFailures,
      });
    }
  }
}
