import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, timer, EMPTY } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { LoggerService } from '../../core/services/logger.service';
import { environment } from '../../../environments/environment';

/**
 * Detailed connection state information
 */
export interface ConnectionStatus {
  isOnline: boolean;
  isServerReachable: boolean;
  lastServerPing?: Date;
  lastServerError?: Date;
  consecutiveFailures: number;
  retryAttempt: number;
}

/**
 * Service for monitoring connection state to both the internet and the TMI server
 * Provides intelligent retry logic and prevents notification spam
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectionMonitorService {
  private _connectionStatus = new BehaviorSubject<ConnectionStatus>({
    isOnline: navigator.onLine,
    isServerReachable: false,
    consecutiveFailures: 0,
    retryAttempt: 0
  });

  private _isMonitoring = false;
  private _monitoringInterval = 30000; // 30 seconds base interval
  private _maxRetryInterval = 300000; // 5 minutes max interval
  private _baseRetryDelay = 1000; // 1 second base delay

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) {
    this.initializeConnectionMonitoring();
  }

  /**
   * Get connection status observable
   * @returns Observable of connection status
   */
  getConnectionStatus(): Observable<ConnectionStatus> {
    return this._connectionStatus.asObservable();
  }

  /**
   * Get current connection status snapshot
   * @returns Current connection status
   */
  getCurrentConnectionStatus(): ConnectionStatus {
    return this._connectionStatus.value;
  }

  /**
   * Start monitoring connection status
   */
  startMonitoring(): void {
    if (this._isMonitoring) return;
    
    this._isMonitoring = true;
    this.logger.debugComponent('ConnectionMonitor', 'Starting connection monitoring');
    this.scheduleNextPing();
  }

  /**
   * Stop monitoring connection status
   */
  stopMonitoring(): void {
    this._isMonitoring = false;
    this.logger.debugComponent('ConnectionMonitor', 'Stopping connection monitoring');
  }

  /**
   * Force an immediate server connectivity check
   * @returns Observable that emits the updated connection status
   */
  checkServerConnectivity(): Observable<ConnectionStatus> {
    return this.pingServer().pipe(
      tap(() => {
        // Reset monitoring interval on successful manual check
        this.scheduleNextPing();
      })
    );
  }

  /**
   * Initialize connection monitoring
   */
  private initializeConnectionMonitoring(): void {
    // Listen for browser online/offline events
    window.addEventListener('online', () => {
      this.handleBrowserOnlineChange(true);
    });
    
    window.addEventListener('offline', () => {
      this.handleBrowserOnlineChange(false);
    });

    // Start with an initial server ping if browser is online
    if (navigator.onLine) {
      this.startMonitoring();
    }
  }

  /**
   * Handle browser online/offline events
   * @param isOnline Whether browser is online
   */
  private handleBrowserOnlineChange(isOnline: boolean): void {
    const currentStatus = this._connectionStatus.value;
    
    this.logger.debugComponent('ConnectionMonitor', `Browser connection changed: ${isOnline ? 'online' : 'offline'}`);
    
    if (isOnline) {
      // Browser came back online - immediately check server
      this.updateConnectionStatus({
        ...currentStatus,
        isOnline: true,
        retryAttempt: 0 // Reset retry attempts
      });
      
      // Start monitoring and ping server immediately
      this.startMonitoring();
      this.pingServer().subscribe();
    } else {
      // Browser went offline
      this.updateConnectionStatus({
        ...currentStatus,
        isOnline: false,
        isServerReachable: false,
        lastServerError: new Date()
      });
      
      this.stopMonitoring();
    }
  }

  /**
   * Schedule the next server ping based on current status
   */
  private scheduleNextPing(): void {
    if (!this._isMonitoring) return;
    
    const currentStatus = this._connectionStatus.value;
    const interval = this.calculateRetryInterval(currentStatus.consecutiveFailures);
    
    timer(interval).pipe(
      switchMap(() => this._isMonitoring ? this.pingServer() : EMPTY)
    ).subscribe({
      next: () => {
        this.scheduleNextPing(); // Schedule next ping after successful one
      },
      error: () => {
        this.scheduleNextPing(); // Schedule next ping after failed one
      }
    });
  }

  /**
   * Ping the server to check connectivity
   * @returns Observable that completes when ping is done
   */
  private pingServer(): Observable<ConnectionStatus> {
    if (!navigator.onLine) {
      // Don't ping if browser is offline
      return new Observable(subscriber => {
        subscriber.next(this._connectionStatus.value);
        subscriber.complete();
      });
    }

    const pingUrl = `${environment.apiUrl}/`;
    
    this.logger.debugComponent('ConnectionMonitor', 'Pinging server for connectivity check', { url: pingUrl });
    
    return this.http.get(pingUrl, { 
      // Don't use auth interceptor for health checks
      headers: { 'Skip-Auth': 'true' }
    }).pipe(
      tap(() => {
        // Server is reachable
        const currentStatus = this._connectionStatus.value;
        this.updateConnectionStatus({
          ...currentStatus,
          isServerReachable: true,
          lastServerPing: new Date(),
          consecutiveFailures: 0,
          retryAttempt: 0
        });
        
        this.logger.debugComponent('ConnectionMonitor', 'Server ping successful');
      }),
      catchError((error) => {
        // Server is not reachable
        const currentStatus = this._connectionStatus.value;
        const consecutiveFailures = currentStatus.consecutiveFailures + 1;
        
        this.updateConnectionStatus({
          ...currentStatus,
          isServerReachable: false,
          lastServerError: new Date(),
          consecutiveFailures,
          retryAttempt: currentStatus.retryAttempt + 1
        });
        
        this.logger.debugComponent('ConnectionMonitor', 'Server ping failed', {
          error: (error as Error).message,
          consecutiveFailures,
          retryAttempt: currentStatus.retryAttempt + 1
        });
        
        // Return current status instead of throwing error
        return new Observable(subscriber => {
          subscriber.next(this._connectionStatus.value);
          subscriber.complete();
        });
      }),
      switchMap(() => {
        return new Observable<ConnectionStatus>(subscriber => {
          subscriber.next(this._connectionStatus.value);
          subscriber.complete();
        });
      })
    );
  }

  /**
   * Calculate retry interval with exponential backoff
   * @param consecutiveFailures Number of consecutive failures
   * @returns Retry interval in milliseconds
   */
  private calculateRetryInterval(consecutiveFailures: number): number {
    if (consecutiveFailures === 0) {
      return this._monitoringInterval; // Normal monitoring interval
    }
    
    // Exponential backoff: base * 2^failures, capped at max
    const exponentialDelay = this._baseRetryDelay * Math.pow(2, consecutiveFailures - 1);
    return Math.min(exponentialDelay, this._maxRetryInterval);
  }

  /**
   * Update connection status and notify subscribers
   * @param newStatus New connection status
   */
  private updateConnectionStatus(newStatus: ConnectionStatus): void {
    const previousStatus = this._connectionStatus.value;
    this._connectionStatus.next(newStatus);
    
    // Log significant state changes
    if (previousStatus.isServerReachable !== newStatus.isServerReachable) {
      const message = newStatus.isServerReachable 
        ? 'Server connection restored'
        : 'Server connection lost';
        
      this.logger.info(message, {
        previousStatus: {
          isOnline: previousStatus.isOnline,
          isServerReachable: previousStatus.isServerReachable
        },
        newStatus: {
          isOnline: newStatus.isOnline,
          isServerReachable: newStatus.isServerReachable
        },
        consecutiveFailures: newStatus.consecutiveFailures
      });
    }
  }

  /**
   * Check if we should show a connection error notification
   * Based on connection state and whether we've already shown one recently
   * @returns true if notification should be shown
   */
  shouldShowConnectionError(): boolean {
    const status = this._connectionStatus.value;
    
    // Only show on first failure or after connection was restored and failed again
    return !status.isServerReachable && 
           (status.consecutiveFailures === 1 || status.retryAttempt === 1);
  }

  /**
   * Check if connection was recently restored (useful for auto-retry logic)
   * @returns true if connection was recently restored
   */
  wasConnectionRecentlyRestored(): boolean {
    const status = this._connectionStatus.value;
    
    return status.isServerReachable && 
           status.lastServerPing !== undefined &&
           status.lastServerError !== undefined &&
           status.lastServerPing > status.lastServerError;
  }
}