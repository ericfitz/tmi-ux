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

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, timer, Subscription, EMPTY } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

export enum ServerConnectionStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  OFFLINE = 'OFFLINE', // Server unreachable (HTTP error)
  DEGRADED = 'DEGRADED', // Server returns DEGRADED status
  ERROR = 'ERROR', // Server returns ERROR status
  CONNECTED = 'CONNECTED', // Server returns OK status
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
    code: 'OK' | 'DEGRADED' | 'ERROR';
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
// SEM@8e8067ac0f613206ff3fd978a3a11a6565ecff68: monitor and expose server reachability status with periodic health checks
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
  private readonly HEALTH_CHECK_INTERVAL = 120000; // 2 minutes
  private readonly MIN_BACKOFF_DELAY = 1000; // 1 second
  private readonly MAX_BACKOFF_DELAY = 300000; // 5 minutes
  private _currentBackoffDelay = this.MIN_BACKOFF_DELAY;
  private _isMonitoring = false;
  private _serverVersion: string | null = null;

  /**
   * Flag indicating whether a reactive health check should be triggered on API failure.
   * Set to true on startup and after any successful health check.
   * Set to false when a reactive health check is triggered, preventing pile-up
   * from multiple concurrent API failures while the server is down.
   */
  private _healthCheckNeeded = true;

  // SEM@daa946e21bdd85c21feca54e25a06848591aaf11: initialize connection monitoring and browser online/offline event listeners (mutates shared state)
  constructor(
    private http: HttpClient,
    private logger: LoggerService,
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
   * Get raw server version from last successful health check
   * @returns Server version string or null if not yet retrieved
   */
  // SEM@939a337d0af80505f5ac0e75993867e7cbe6d815: fetch the raw server version string from the last successful health check (pure)
  getServerVersion(): string | null {
    return this._serverVersion;
  }

  /**
   * Get server version formatted for display.
   * Transforms "semver-commitId" (e.g., "1.3.0-5011053f") into "semver (commitId)"
   * (e.g., "1.3.0 (5011053f)"). Returns the raw string if it doesn't match the expected pattern.
   * @returns Formatted server version string, or empty string if not yet retrieved
   */
  // SEM@8e8067ac0f613206ff3fd978a3a11a6565ecff68: format server version from semver-commitId to display-friendly semver (commitId) (pure)
  getFormattedServerVersion(): string {
    if (!this._serverVersion) {
      return '';
    }
    const match = this._serverVersion.match(/^(.+)-([0-9a-f]{7,12})$/);
    if (match) {
      return `${match[1]} (${match[2]})`;
    }
    return this._serverVersion;
  }

  // SEM@daa946e21bdd85c21feca54e25a06848591aaf11: cancel health check subscription and stop monitoring on service destroy (mutates shared state)
  ngOnDestroy(): void {
    if (this._healthCheckSubscription) {
      this._healthCheckSubscription.unsubscribe();
    }
    this.stopMonitoring();
  }

  /**
   * Start monitoring connection status (for save operations)
   */
  // SEM@93bad2aec249e272774fbe2addcb34ee0615c847: activate connection monitoring for save operations if not already running (mutates shared state)
  startMonitoring(): void {
    if (this._isMonitoring) return;

    this._isMonitoring = true;
    // this.logger.debugComponent(
    //   'ServerConnection',
    //   'Starting connection monitoring for save operations',
    // );

    if (!this.shouldConnectToServer()) {
      // this.logger.info('Server monitoring disabled - not configured');
      return;
    }
  }

  /**
   * Stop monitoring connection status
   */
  // SEM@93bad2aec249e272774fbe2addcb34ee0615c847: deactivate connection monitoring flag (mutates shared state)
  stopMonitoring(): void {
    this._isMonitoring = false;
    // this.logger.debugComponent('ServerConnection', 'Stopping connection monitoring');
  }

  /**
   * Force an immediate server connectivity check
   * @returns Observable that emits the updated connection status
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: fetch current server reachability and schedule the next health check
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
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: determine if a connection error notification should be displayed to the user (pure)
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
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: determine if the server connection was restored after a prior failure (pure)
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
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: register browser online/offline event listeners to react to network changes (mutates shared state)
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
  // SEM@93bad2aec249e272774fbe2addcb34ee0615c847: update connection status and trigger a health check when browser network state changes (mutates shared state)
  private handleBrowserOnlineChange(isOnline: boolean): void {
    const currentStatus = this._detailedConnectionStatus$.value;

    // this.logger.debugComponent(
    //   'ServerConnection',
    //   `Browser connection changed: ${isOnline ? 'online' : 'offline'}`,
    // );

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
  // SEM@93bad2aec249e272774fbe2addcb34ee0615c847: start periodic health checks if the server is configured (mutates shared state)
  private initializeConnectionMonitoring(): void {
    // Check if server is configured
    if (!this.isServerConfigured()) {
      // this.logger.info('Server not configured - connection monitoring disabled');
      this._connectionStatus$.next(ServerConnectionStatus.NOT_CONFIGURED);
      return;
    }

    // this.logger.info(`Server configured at ${environment.apiUrl} - starting connection monitoring`);

    // Start periodic health checks if we should connect
    if (this.shouldConnectToServer()) {
      this.startHealthChecks();
    }
  }

  /**
   * Stop health check monitoring
   */
  // SEM@081dc985eee8ff7d9105cf1c4b26b11dec05c4bc: cancel the active health check subscription (mutates shared state)
  private stopHealthChecks(): void {
    if (this._healthCheckSubscription) {
      this._healthCheckSubscription.unsubscribe();
      this._healthCheckSubscription = null;
    }
  }

  /**
   * Check if server is configured based on environment
   */
  // SEM@081dc985eee8ff7d9105cf1c4b26b11dec05c4bc: determine whether the API URL is configured in the environment (pure)
  private isServerConfigured(): boolean {
    // Consider server not configured only if apiUrl is empty or whitespace
    // Any explicitly configured URL (including localhost) is considered a configured server
    const apiUrl = environment.apiUrl;
    return !!(apiUrl && apiUrl.trim());
  }

  /**
   * Check if we should connect to the server
   * Returns false if:
   * - Server is not configured (empty apiUrl)
   */
  // SEM@5cf5885c74a030f8c823e9e6b34c6ff2405967e6: determine whether the service should attempt server connectivity (pure)
  private shouldConnectToServer(): boolean {
    return this.isServerConfigured();
  }

  /**
   * Start periodic health check monitoring with exponential backoff
   */
  // SEM@931d5291247003011aeec3bf214c492c29a852bb: schedule an immediate health check to begin periodic monitoring (mutates shared state)
  private startHealthChecks(): void {
    // Perform initial health check
    this.scheduleNextHealthCheck(0); // Start immediately
  }

  /**
   * Schedule the next health check with appropriate delay
   */
  // SEM@d88a0ec8335a516ab7e753dfa3ca39d9a6ad08af: schedule a delayed health check and re-schedule on completion (mutates shared state)
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
  // SEM@2a492b6a05aad641d4ce31ae471f8294d7d26157: fetch server health endpoint and update connection status with backoff on failure
  private performHealthCheck(): Observable<void> {
    // Check if we should connect to server
    if (!this.shouldConnectToServer()) {
      // this.logger.debugComponent(
      //   'ServerConnection',
      //   'Skipping health check - server not configured',
      // );
      return EMPTY;
    }

    // this.logger.debugComponent('ServerConnection', 'Performing HTTP health check');

    // Use the root API endpoint as defined in tmi-openapi.json
    // Remove trailing /api if present (e.g., 'http://localhost:8080/api' -> 'http://localhost:8080')
    const statusEndpoint = environment.apiUrl.replace(/\/api$/, '');

    return this.http.get<ServerHealthResponse>(statusEndpoint).pipe(
      map(response => {
        const statusCode = response.status?.code?.toUpperCase();

        // Store server version from health response regardless of status
        if (response.service?.build) {
          this._serverVersion = response.service.build;
        }

        if (statusCode === 'OK') {
          // this.logger.debugComponent('ServerConnection', 'Server status check successful');
          this._connectionStatus$.next(ServerConnectionStatus.CONNECTED);

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
          this._healthCheckNeeded = true;
        } else if (statusCode === 'DEGRADED') {
          this.logger.warn('Server status check returned DEGRADED status');
          this._connectionStatus$.next(ServerConnectionStatus.DEGRADED);

          // Update detailed status - server is reachable but degraded
          const currentDetailed = this._detailedConnectionStatus$.value;
          this.updateDetailedConnectionStatus({
            ...currentDetailed,
            isServerReachable: true,
            lastServerPing: new Date(),
            consecutiveFailures: 0,
            retryAttempt: 0,
            status: ServerConnectionStatus.DEGRADED,
          });

          this._healthCheckNeeded = true;
        } else {
          // ERROR status or unknown status code
          this.logger.warn(`Server status check returned ERROR status: ${statusCode}`);
          this._connectionStatus$.next(ServerConnectionStatus.ERROR);

          // Update detailed status - server is reachable but returning error
          const currentDetailed = this._detailedConnectionStatus$.value;
          this.updateDetailedConnectionStatus({
            ...currentDetailed,
            isServerReachable: true,
            lastServerPing: new Date(),
            consecutiveFailures: 0,
            retryAttempt: 0,
            status: ServerConnectionStatus.ERROR,
          });

          this._healthCheckNeeded = true;
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Server is unreachable (HTTP error)
        this.logger.warn(`Server unreachable: ${error.status} ${error.statusText}`);
        this._connectionStatus$.next(ServerConnectionStatus.OFFLINE);

        // Update detailed status
        const currentDetailed = this._detailedConnectionStatus$.value;
        this.updateDetailedConnectionStatus({
          ...currentDetailed,
          isServerReachable: false,
          lastServerError: new Date(),
          consecutiveFailures: currentDetailed.consecutiveFailures + 1,
          retryAttempt: currentDetailed.retryAttempt + 1,
          status: ServerConnectionStatus.OFFLINE,
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
  // SEM@660ec8791a5c29b400be8ffc40e019c7a1c1d240: ping the server and update detailed connection status with result (mutates shared state)
  private performDetailedHealthCheck(): Observable<DetailedConnectionStatus> {
    // Check if we should connect to server
    if (!this.shouldConnectToServer()) {
      // this.logger.debugComponent(
      //   'ServerConnection',
      //   'Skipping detailed health check - server not configured',
      // );
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

    // this.logger.debugComponent('ServerConnection', 'Pinging server for connectivity check', {
    //   url: pingUrl,
    // });

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
          this._healthCheckNeeded = true;

          // this.logger.debugComponent('ServerConnection', 'Server ping successful');
        }),
        catchError((_error: HttpErrorResponse) => {
          // Server is not reachable (offline)
          const currentStatus = this._detailedConnectionStatus$.value;
          const consecutiveFailures = currentStatus.consecutiveFailures + 1;

          this.updateDetailedConnectionStatus({
            ...currentStatus,
            isServerReachable: false,
            lastServerError: new Date(),
            consecutiveFailures,
            retryAttempt: currentStatus.retryAttempt + 1,
            status: ServerConnectionStatus.OFFLINE,
          });

          // Also update simple status
          this._connectionStatus$.next(ServerConnectionStatus.OFFLINE);
          this._currentBackoffDelay = this.getNextBackoffDelay();

          // this.logger.debugComponent('ServerConnection', 'Server ping failed', {
          //   error: (error as Error).message,
          //   consecutiveFailures,
          //   retryAttempt: currentStatus.retryAttempt + 1,
          // });

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
  // SEM@5cf5885c74a030f8c823e9e6b34c6ff2405967e6: trigger a manual server health check if server is configured (mutates shared state)
  public checkConnection(): void {
    if (this.shouldConnectToServer()) {
      this.performHealthCheck().subscribe({
        next: () => {
          // this.logger.debugComponent(
          //   'ServerConnection',
          //   'HTTP health check completed successfully',
          // );
        },
        error: error => {
          this.logger.error('HTTP health check failed', error);
        },
      });
    } else {
      // this.logger.debugComponent(
      //   'ServerConnection',
      //   'Connection check skipped - server not configured',
      // );
    }
  }

  /**
   * Trigger a reactive health check in response to an API call failure.
   * Guarded by _healthCheckNeeded flag to prevent pile-up from multiple
   * concurrent API failures. The flag is set to true only after a successful
   * health check, so at most one reactive check runs per outage.
   */
  // SEM@660ec8791a5c29b400be8ffc40e019c7a1c1d240: dispatch a health check on API failure, guarded to one check per outage (mutates shared state)
  triggerReactiveHealthCheck(): void {
    if (!this._healthCheckNeeded || !this.shouldConnectToServer()) {
      return;
    }

    this._healthCheckNeeded = false;

    this.performHealthCheck().subscribe({
      complete: () => {
        // Reset the scheduled timer so we don't double-check soon after
        const nextDelay = this.getHealthCheckDelay();
        this.scheduleNextHealthCheck(nextDelay);
      },
    });
  }

  /**
   * Calculate the next backoff delay using exponential backoff
   */
  // SEM@931d5291247003011aeec3bf214c492c29a852bb: compute the next exponential backoff delay, capped at maximum (pure)
  private getNextBackoffDelay(): number {
    return Math.min(this._currentBackoffDelay * 2, this.MAX_BACKOFF_DELAY);
  }

  /**
   * Reset backoff delay to minimum when connection is successful
   */
  // SEM@931d5291247003011aeec3bf214c492c29a852bb: reset the backoff delay to the minimum on successful connection (mutates shared state)
  private resetBackoffDelay(): void {
    this._currentBackoffDelay = this.MIN_BACKOFF_DELAY;
  }

  /**
   * Get the appropriate delay for the next health check based on current status
   */
  // SEM@2a492b6a05aad641d4ce31ae471f8294d7d26157: return the appropriate health check interval based on current connection status (pure)
  private getHealthCheckDelay(): number {
    const currentStatus = this._connectionStatus$.value;
    if (currentStatus === ServerConnectionStatus.OFFLINE) {
      // Use backoff delay only when server is unreachable
      return this._currentBackoffDelay;
    } else {
      // Use normal interval when server is reachable (CONNECTED, DEGRADED, ERROR)
      return this.HEALTH_CHECK_INTERVAL;
    }
  }

  /**
   * Update detailed connection status and notify subscribers
   * @param newStatus New detailed connection status
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: store new detailed connection status and log reachability state transitions (mutates shared state)
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
