/**
 * PersistenceCoordinator - Unified storage management for DFD diagrams
 *
 * This service coordinates data persistence across multiple strategies:
 * - WebSocket for real-time collaboration
 * - REST API for reliable storage
 * - Local cache for offline support
 * - Conflict resolution and synchronization
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of, throwError, forkJoin } from 'rxjs';
import { catchError, timeout, tap } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { ServerConnectionService } from '../../../../core/services/server-connection.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';

// Simple interfaces that match what the tests expect
export interface SaveOperation {
  readonly diagramId: string;
  readonly data: any;
  readonly strategyType?: string;
  readonly metadata?: Record<string, any>;
}

export interface SaveResult {
  readonly success: boolean;
  readonly operationId: string;
  readonly diagramId: string;
  readonly timestamp: number;
  readonly error?: string;
  readonly metadata?: Record<string, any>;
}

export interface LoadOperation {
  readonly diagramId: string;
  readonly forceRefresh?: boolean;
}

export interface LoadResult {
  readonly success: boolean;
  readonly diagramId: string;
  readonly data?: any;
  readonly source: 'cache' | 'api' | 'websocket';
  readonly timestamp: number;
  readonly error?: string;
}

export interface SyncOperation {
  readonly diagramId: string;
  readonly strategy?: string;
}

export interface SyncResult {
  readonly success: boolean;
  readonly diagramId: string;
  readonly conflicts: number;
  readonly timestamp: number;
  readonly error?: string;
}

export interface StrategySelectionContext {
  readonly collaborationIntent: boolean;  // from joinCollaboration=true query param
  readonly allowOfflineMode: boolean;     // user preference  
  readonly fastTimeout?: boolean;         // for quick failure detection
}

export interface PersistenceStrategy {
  readonly type: string;
  readonly priority: number;
  save(operation: SaveOperation): Observable<SaveResult>;
  load(operation: LoadOperation): Observable<LoadResult>;
  sync?(operation: SyncOperation): Observable<SyncResult>;
}

export interface CacheStatus {
  readonly diagramId: string;
  readonly status: 'synced' | 'pending' | 'conflict' | 'error';
  readonly lastSync: number;
}

export interface PersistenceConfig {
  readonly enableCaching: boolean;
  readonly operationTimeoutMs: number;
  readonly maxCacheEntries: number;
  readonly retryAttempts: number;
  readonly fallbackStrategy: string;
}

export interface SaveStatusEvent {
  readonly diagramId: string;
  readonly status: 'saving' | 'saved' | 'error';
  readonly timestamp: number;
  readonly error?: string;
}

const DEFAULT_CONFIG: PersistenceConfig = {
  enableCaching: true,
  operationTimeoutMs: 30000,
  maxCacheEntries: 100,
  retryAttempts: 3,
  fallbackStrategy: 'rest',
};

@Injectable({
  providedIn: 'root',
})
export class PersistenceCoordinator {
  private readonly _config$ = new BehaviorSubject<PersistenceConfig>(DEFAULT_CONFIG);
  private readonly _saveStatus$ = new Subject<SaveStatusEvent>();
  private readonly _loadStatus$ = new Subject<SaveStatusEvent>();
  private readonly _strategies = new Map<string, PersistenceStrategy>();
  private readonly _cache = new Map<string, any>();
  private _isOnline = true;
  private _fallbackStrategy: string | null = null;

  // Statistics tracking
  private _stats = {
    totalSaves: 0,
    successfulSaves: 0,
    failedSaves: 0,
    totalLoads: 0,
    successfulLoads: 0,
    failedLoads: 0,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(
    private readonly logger: LoggerService,
    private readonly serverConnection: ServerConnectionService,
    private readonly webSocketAdapter: WebSocketAdapter,
  ) {
    this.logger.debug('PersistenceCoordinator initialized');
  }

  /**
   * Configuration Management
   */
  getConfiguration(): PersistenceConfig {
    return { ...this._config$.value };
  }

  configure(config: Partial<PersistenceConfig>): void {
    const currentConfig = this._config$.value;
    const newConfig = { ...currentConfig, ...config };
    this._config$.next(newConfig);
    this.logger.debug('PersistenceCoordinator configuration updated', { config: newConfig });
  }

  /**
   * Strategy Management
   */
  addStrategy(strategy: PersistenceStrategy): void {
    this._strategies.set(strategy.type, strategy);
    this.logger.debug('Persistence strategy added', {
      type: strategy.type,
      priority: strategy.priority,
    });
  }

  removeStrategy(strategyType: string): void {
    const removed = this._strategies.delete(strategyType);
    if (removed) {
      this.logger.debug('Persistence strategy removed', { type: strategyType });
    }
  }

  getStrategies(): PersistenceStrategy[] {
    return Array.from(this._strategies.values()).sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  setFallbackStrategy(strategyType: string): void {
    if (this._strategies.has(strategyType)) {
      this._fallbackStrategy = strategyType;
      this.logger.debug('Fallback strategy set', { strategy: strategyType });
    } else {
      this.logger.warn('Cannot set fallback strategy - strategy not found', {
        strategy: strategyType,
      });
    }
  }

  /**
   * Save Operations
   */
  save(operation: SaveOperation, context?: StrategySelectionContext): Observable<SaveResult> {
    this.logger.debug('Starting save operation', {
      diagramId: operation.diagramId,
      strategyType: operation.strategyType,
    });

    this._stats.totalSaves++;
    this._stats.totalOperations++;

    // Emit saving status
    this._saveStatus$.next({
      diagramId: operation.diagramId,
      status: 'saving',
      timestamp: Date.now(),
    });

    // Find appropriate strategy
    const strategy = this._findSaveStrategy(operation, context);
    if (!strategy) {
      const error = `Persistence strategy '${operation.strategyType || 'default'}' not found`;
      this.logger.error(error, { operation });

      this._stats.failedSaves++;
      this._stats.failedOperations++;
      this._saveStatus$.next({
        diagramId: operation.diagramId,
        status: 'error',
        timestamp: Date.now(),
        error,
      });

      return throwError(() => new Error(error));
    }

    const config = this._config$.value;
    return strategy.save(operation).pipe(
      timeout(config.operationTimeoutMs),
      tap(result => {
        if (result.success) {
          this._stats.successfulSaves++;
          this._stats.successfulOperations++;

          // Update cache if enabled
          if (config.enableCaching) {
            this._cache.set(this._getCacheKey(operation.diagramId), {
              data: operation.data,
              timestamp: Date.now(),
              source: strategy.type,
            });
          }

          this._saveStatus$.next({
            diagramId: operation.diagramId,
            status: 'saved',
            timestamp: Date.now(),
          });
        } else {
          this._stats.failedSaves++;
          this._stats.failedOperations++;
          this._stats.failedOperations++;
          this._saveStatus$.next({
            diagramId: operation.diagramId,
            status: 'error',
            timestamp: Date.now(),
            error: result.error,
          });
        }
      }),
      catchError(error => {
        // Try fallback strategy if configured and this wasn't already a fallback attempt
        if (
          this._fallbackStrategy &&
          this._strategies.has(this._fallbackStrategy) &&
          operation.strategyType !== this._fallbackStrategy
        ) {
          this.logger.warn('Primary strategy failed, trying fallback', {
            primaryStrategy: operation.strategyType,
            fallbackStrategy: this._fallbackStrategy,
            error: error.message,
          });

          const fallbackStrategy = this._strategies.get(this._fallbackStrategy)!;
          const fallbackOperation = {
            ...operation,
            strategyType: this._fallbackStrategy,
          };

          return fallbackStrategy.save(fallbackOperation).pipe(
            tap(result => {
              if (result.success) {
                this._stats.successfulSaves++;
                this._stats.successfulOperations++;

                // Update cache if enabled
                const config = this._config$.value;
                if (config.enableCaching) {
                  this._cache.set(this._getCacheKey(operation.diagramId), {
                    data: operation.data,
                    timestamp: Date.now(),
                    source: this._fallbackStrategy!,
                  });
                }

                this._saveStatus$.next({
                  diagramId: operation.diagramId,
                  status: 'saved',
                  timestamp: Date.now(),
                });
              }
            }),
            catchError(fallbackError => {
              this._stats.failedSaves++;
              this._stats.failedOperations++;

              const errorMessage = `Both primary and fallback strategies failed: ${error.message}, ${fallbackError.message}`;
              this._saveStatus$.next({
                diagramId: operation.diagramId,
                status: 'error',
                timestamp: Date.now(),
                error: errorMessage,
              });

              this.logger.error('Both primary and fallback save strategies failed', {
                primaryError: error,
                fallbackError,
                operation,
              });

              return throwError(() => new Error(errorMessage));
            }),
          );
        }

        // No fallback available or this was already a fallback attempt
        this._stats.failedSaves++;
        this._stats.failedOperations++;
        const errorMessage = error.message || 'Save operation failed';

        this._saveStatus$.next({
          diagramId: operation.diagramId,
          status: 'error',
          timestamp: Date.now(),
          error: errorMessage,
        });

        this.logger.error('Save operation failed', { error, operation });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Load Operations
   */
  load(operation: LoadOperation, context?: StrategySelectionContext): Observable<LoadResult> {
    this.logger.debug('Starting load operation', {
      diagramId: operation.diagramId,
      forceRefresh: operation.forceRefresh,
    });

    this._stats.totalLoads++;
    this._stats.totalOperations++;

    // Check cache first if not forcing refresh
    const config = this._config$.value;
    if (
      config.enableCaching &&
      !operation.forceRefresh &&
      this._cache.has(this._getCacheKey(operation.diagramId))
    ) {
      const cachedData = this._cache.get(this._getCacheKey(operation.diagramId));
      this._stats.successfulLoads++;
      this._stats.successfulOperations++;
      this._stats.cacheHits++;

      return of({
        success: true,
        diagramId: operation.diagramId,
        data: cachedData.data,
        source: 'cache' as const,
        fromCache: true,
        timestamp: Date.now(),
      });
    }

    // Find appropriate strategy for loading
    const strategy = this._findLoadStrategy(context);
    if (!strategy) {
      const error = 'No suitable persistence strategy found for loading';
      this.logger.error(error, { operation });
      this._stats.failedLoads++;
      this._stats.failedOperations++;
      return throwError(() => new Error(error));
    }

    return strategy.load(operation).pipe(
      timeout(config.operationTimeoutMs),
      tap(result => {
        if (result.success) {
          this._stats.successfulLoads++;
          this._stats.successfulOperations++;
          this._stats.cacheHits++;

          // Update cache
          if (config.enableCaching && result.data) {
            this._cache.set(this._getCacheKey(operation.diagramId), {
              data: result.data,
              timestamp: Date.now(),
              source: strategy.type,
            });
          }
        } else {
          this._stats.failedLoads++;
          this._stats.failedOperations++;
          this._stats.failedOperations++;
        }
      }),
      catchError(error => {
        this._stats.failedLoads++;
        this._stats.failedOperations++;
        this.logger.error('Load operation failed', { error, operation });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Sync Operations
   */
  sync(operation: SyncOperation): Observable<SyncResult> {
    this.logger.debug('Starting sync operation', { diagramId: operation.diagramId });

    const strategy = this._findSyncStrategy(operation);
    if (!strategy) {
      const error = 'No suitable sync strategy found';
      this.logger.error(error, { operation });
      return throwError(() => new Error(error));
    }
    if (!strategy.sync) {
      const error = `Strategy '${strategy.type}' does not support sync operations`;
      this.logger.error(error, { operation });
      return throwError(() => new Error(error));
    }

    return strategy.sync(operation).pipe(
      catchError(error => {
        this.logger.error('Sync operation failed', { error, operation });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Batch Operations
   */
  saveBatch(operations: SaveOperation[]): Observable<SaveResult[]> {
    if (operations.length === 0) {
      return of([]);
    }

    this.logger.debug('Starting batch save operation', { count: operations.length });

    // Execute all saves in parallel
    const saves = operations.map(operation => this.save(operation));

    // Note: Using a simple approach here. In a real implementation,
    // you might want to use forkJoin or handle partial failures differently
    return new Observable(subscriber => {
      const results: SaveResult[] = [];
      let completed = 0;

      saves.forEach((save, index) => {
        save.subscribe({
          next: result => {
            results[index] = result;
            completed++;

            if (completed === saves.length) {
              subscriber.next(results);
              subscriber.complete();
            }
          },
          error: error => {
            // Create a failure result for this operation
            results[index] = {
              success: false,
              operationId: `batch-${index}`,
              diagramId: operations[index].diagramId,
              timestamp: Date.now(),
              error: error.message || 'Batch save failed',
            };
            completed++;

            if (completed === saves.length) {
              subscriber.next(results);
              subscriber.complete();
            }
          },
        });
      });
    });
  }

  /**
   * Cache Management
   */

  /**
   * Status and Monitoring
   */
  isOnline(): boolean {
    return this._isOnline;
  }

  setOnlineStatus(online: boolean): void {
    if (this._isOnline !== online) {
      this._isOnline = online;
      this.logger.debug('Online status changed', { online });
    }
  }

  get saveStatus$(): Observable<SaveStatusEvent> {
    return this._saveStatus$.asObservable();
  }

  get loadStatus$(): Observable<SaveStatusEvent> {
    return this._loadStatus$.asObservable();
  }

  getStats(): any {
    return { ...this._stats };
  }

  resetStats(): void {
    this._stats = {
      totalSaves: 0,
      successfulSaves: 0,
      failedSaves: 0,
      totalLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.logger.debug('Persistence statistics reset');
  }

  /**
   * Batch Operations
   */
  loadBatch(operations: LoadOperation[]): Observable<LoadResult[]> {
    if (operations.length === 0) {
      return of([]);
    }

    this.logger.debug('Executing batch load operations', { count: operations.length });

    // Execute all load operations in parallel
    const executions = operations.map(operation => this.load(operation));

    return forkJoin(executions).pipe(
      catchError(error => {
        this.logger.error('Batch load failed', { error, operationCount: operations.length });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Cache Management
   */
  getCacheStatus(diagramId: string): Observable<CacheStatus> {
    const cacheKey = this._getCacheKey(diagramId);
    const entry = this._cache.get(cacheKey);

    const status: CacheStatus = {
      diagramId,
      status: entry ? 'synced' : 'error',
      lastSync: entry?.timestamp || 0,
    };

    return of(status);
  }

  clearCache(diagramId?: string): Observable<void> {
    if (diagramId) {
      const cacheKey = this._getCacheKey(diagramId);
      this._cache.delete(cacheKey);
      this.logger.debug('Cache cleared for diagram', { diagramId });
    } else {
      this._cache.clear();
      this.logger.debug('All cache cleared');
    }

    return of(undefined);
  }

  invalidateCache(diagramId: string): Observable<void> {
    const cacheKey = this._getCacheKey(diagramId);
    this._cache.delete(cacheKey);
    this.logger.debug('Cache invalidated for diagram', { diagramId });
    return of(undefined);
  }

  getCacheEntry(diagramId: string): Observable<any> {
    const cacheKey = this._getCacheKey(diagramId);
    const entry = this._cache.get(cacheKey);
    return of(entry ? entry.data : null);
  }

  /**
   * Health Status
   */
  getHealthStatus(): Observable<any> {
    return of({
      overall: this._isOnline ? 'healthy' : 'offline',
      strategies: {
        count: this._strategies.size,
        available: Array.from(this._strategies.keys()),
      },
      cacheHealth: {
        size: this._cache.size,
        enabled: this._config$.value.enableCaching,
      },
      pendingOperations: 0, // Track this if needed
      stats: this.getStats(),
      lastActivity: new Date(),
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this._saveStatus$.complete();
    this._loadStatus$.complete();
    this._config$.complete();
    this._strategies.clear();
    this._cache.clear();
    this.logger.debug('PersistenceCoordinator disposed');
  }

  /**
   * Private helper methods
   */
  private _findSaveStrategy(operation: SaveOperation, context: StrategySelectionContext = { collaborationIntent: false, allowOfflineMode: true }): PersistenceStrategy | null {
    // If specific strategy requested, try to use it
    if (operation.strategyType) {
      if (this._strategies.has(operation.strategyType)) {
        const strategy = this._strategies.get(operation.strategyType)!;
        // Check if the requested strategy is available
        if (this._isStrategyAvailable(strategy, context)) {
          return strategy;
        }
        // Requested strategy is not available, fall back to automatic selection
        this.logger.warn('Requested strategy not available, falling back', {
          requestedStrategy: operation.strategyType,
          context
        });
      } else {
        // Specific strategy was requested but not found
        this.logger.error('Requested strategy not found', { 
          requestedStrategy: operation.strategyType 
        });
        return null;
      }
    }

    // Special handling for collaboration intent
    if (context.collaborationIntent) {
      const strategies = this.getStrategies();
      const wsStrategy = strategies.find(s => s.type === 'websocket');
      if (wsStrategy && this._isStrategyAvailable(wsStrategy, context)) {
        this.logger.debug('Using WebSocket strategy for collaboration save', { context });
        return wsStrategy;
      }
      // For collaboration intent, don't fall back to local strategies
      this.logger.warn('Collaboration save requires WebSocket connection', { 
        webSocketAvailable: wsStrategy ? this._isStrategyAvailable(wsStrategy, context) : false,
        context 
      });
      return null;
    }

    // Find the first available strategy by priority
    const strategies = this.getStrategies();
    for (const strategy of strategies) {
      if (this._isStrategyAvailable(strategy, context)) {
        this.logger.debug('Selected available strategy for save', { 
          strategyType: strategy.type, 
          priority: strategy.priority,
          context 
        });
        return strategy;
      }
    }

    // Final fallback to cache-only if allowed
    if (context.allowOfflineMode) {
      const cacheStrategy = strategies.find(s => s.type === 'cache-only');
      if (cacheStrategy) {
        this.logger.info('Falling back to cache-only strategy for save', { context });
        return cacheStrategy;
      }
    }

    this.logger.error('No suitable persistence strategy found for save', { 
      availableStrategies: strategies.map(s => s.type),
      context 
    });
    return null;
  }

  private _findLoadStrategy(context: StrategySelectionContext = { collaborationIntent: false, allowOfflineMode: true }): PersistenceStrategy | null {
    const strategies = this.getStrategies();
    
    // Special handling for collaboration intent
    if (context.collaborationIntent) {
      const wsStrategy = strategies.find(s => s.type === 'websocket');
      if (wsStrategy && this._isStrategyAvailable(wsStrategy, context)) {
        this.logger.debug('Using WebSocket strategy for collaboration', { context });
        return wsStrategy;
      }
      // For collaboration intent, don't fall back to local strategies
      this.logger.warn('Collaboration requires WebSocket connection', { 
        webSocketAvailable: wsStrategy ? this._isStrategyAvailable(wsStrategy, context) : false,
        context 
      });
      return null;
    }
    
    // Normal priority-based selection with availability check
    for (const strategy of strategies) {
      if (this._isStrategyAvailable(strategy, context)) {
        this.logger.debug('Selected available strategy', { 
          strategyType: strategy.type, 
          priority: strategy.priority,
          context 
        });
        return strategy;
      }
    }
    
    // Final fallback to cache-only if allowed
    if (context.allowOfflineMode) {
      const cacheStrategy = strategies.find(s => s.type === 'cache-only');
      if (cacheStrategy) {
        this.logger.info('Falling back to cache-only strategy', { context });
        return cacheStrategy;
      }
    }
    
    this.logger.error('No suitable persistence strategy found', { 
      availableStrategies: strategies.map(s => s.type),
      context 
    });
    return null;
  }

  private _findSyncStrategy(_operation: SyncOperation): PersistenceStrategy | null {
    // Use fallback strategy if set
    if (this._fallbackStrategy && this._strategies.has(this._fallbackStrategy)) {
      return this._strategies.get(this._fallbackStrategy)!;
    }

    // Otherwise use first available strategy (sync support will be checked later)
    const strategies = this.getStrategies();
    return strategies[0] || null;
  }

  /**
   * Check if a strategy is available for use
   */
  private _isStrategyAvailable(strategy: PersistenceStrategy, context: StrategySelectionContext): boolean {
    try {
      switch (strategy.type) {
        case 'websocket':
          // Use existing WebSocketAdapter status
          return this.webSocketAdapter.isConnected;
        
        case 'rest':
          // Use existing cached server status from ServerConnectionService
          return this.serverConnection.currentDetailedStatus.isServerReachable;
        
        case 'cache-only':
          // Always available for offline mode
          return true;
        
        default:
          this.logger.warn('Unknown strategy type', { strategyType: strategy.type });
          return false;
      }
    } catch (error) {
      this.logger.warn('Error checking strategy availability', {
        strategyType: strategy.type,
        error,
      });
      return false;
    }
  }

  /**
   * Generate cache key for diagram
   */
  private _getCacheKey(diagramId: string): string {
    return `diagram-${diagramId}`;
  }
}
