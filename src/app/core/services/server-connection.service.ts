/**
 * Server Connection Service
 *
 * This service monitors the connection status to the configured API server.
 * It provides reactive streams for connection status and handles periodic health checks.
 *
 * Key functionality:
 * - Monitors server connectivity through periodic health checks
 * - Provides reactive connection status (NOT_CONFIGURED, ERROR, CONNECTED)
 * - Handles connection error recovery and retry logic
 * - Integrates with environment configuration to detect server settings
 */

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, timer, Subscription } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

export enum ServerConnectionStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  ERROR = 'ERROR',
  CONNECTED = 'CONNECTED',
}

@Injectable({
  providedIn: 'root',
})
export class ServerConnectionService implements OnDestroy {
  private readonly _connectionStatus$ = new BehaviorSubject<ServerConnectionStatus>(
    ServerConnectionStatus.NOT_CONFIGURED,
  );
  private _healthCheckSubscription: Subscription | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MIN_BACKOFF_DELAY = 1000; // 1 second
  private readonly MAX_BACKOFF_DELAY = 30000; // 30 seconds
  private _currentBackoffDelay = this.MIN_BACKOFF_DELAY;

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
  ) {
    this.initializeConnectionMonitoring();
  }

  /**
   * Observable stream of current connection status
   */
  get connectionStatus$(): Observable<ServerConnectionStatus> {
    return this._connectionStatus$.asObservable();
  }

  /**
   * Get current connection status synchronously
   */
  get currentStatus(): ServerConnectionStatus {
    return this._connectionStatus$.value;
  }

  ngOnDestroy(): void {
    if (this._healthCheckSubscription) {
      this._healthCheckSubscription.unsubscribe();
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

    // Start periodic health checks
    this.startHealthChecks();
  }

  /**
   * Check if server is configured based on environment
   */
  private isServerConfigured(): boolean {
    // Consider server not configured if apiUrl is empty, localhost with default port, or example URL
    const apiUrl = environment.apiUrl;
    if (!apiUrl || apiUrl.includes('api.example.com') || apiUrl === 'http://localhost:8080/api') {
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
          this.logger.debug(
            `Scheduling next health check in ${nextDelay}ms (backoff: ${this._currentBackoffDelay}ms)`,
          );
          this.scheduleNextHealthCheck(nextDelay);
        },
      });
  }

  /**
   * Perform a single health check against the server
   */
  private performHealthCheck(): Observable<void> {
    // Use the root API endpoint as defined in tmi-openapi.json
    const statusEndpoint = environment.apiUrl.replace('/api', '');

    return this.http.get<{ status: { code: string; time: string } }>(statusEndpoint).pipe(
      map(response => {
        if (response.status?.code === 'OK') {
          this.logger.debug('Server status check successful');
          this._connectionStatus$.next(ServerConnectionStatus.CONNECTED);
          // Reset backoff delay on successful connection
          this.resetBackoffDelay();
        } else {
          this.logger.warn(`Server status check returned non-OK status: ${response.status?.code}`);
          this._connectionStatus$.next(ServerConnectionStatus.ERROR);
          // Increase backoff delay for next retry
          this._currentBackoffDelay = this.getNextBackoffDelay();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.warn(`Server status check failed: ${error.status} ${error.statusText}`);
        this._connectionStatus$.next(ServerConnectionStatus.ERROR);
        // Increase backoff delay for next retry
        this._currentBackoffDelay = this.getNextBackoffDelay();
        // Return empty observable to continue the stream
        return new Observable<void>();
      }),
    );
  }

  /**
   * Manually trigger a connection check
   */
  public checkConnection(): void {
    if (this.isServerConfigured()) {
      this.performHealthCheck().subscribe();
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
}
