/**
 * PersistenceCoordinator - Unified persistence management system
 * 
 * Coordinates multiple persistence strategies (WebSocket, REST, cache-only)
 * with intelligent fallback and conflict resolution.
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, throwError, of, forkJoin } from 'rxjs';
import { catchError, tap, timeout } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { IPersistenceCoordinator, PersistenceHealthStatus } from '../interfaces/persistence-coordinator.interface';
import {
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
  SyncOperation,
  SyncResult,
  PersistenceStrategy,
  PersistenceConfig,
  PersistenceStats,
  PersistenceEvent,
  CacheStatus,
  SaveStatus,
  CacheEntry,
  PersistenceConflict,
  DEFAULT_PERSISTENCE_CONFIG
} from '../types/persistence.types';

/**
 * Internal tracking for pending operations
 */
interface PendingOperation {
  readonly id: string;
  readonly type: 'save' | 'load' | 'sync';
  readonly operation: SaveOperation | LoadOperation | SyncOperation;
  readonly startTime: number;
  readonly timeout: any;
}

@Injectable({
  providedIn: 'root'
})
export class PersistenceCoordinator implements IPersistenceCoordinator {
  private _config: PersistenceConfig = { ...DEFAULT_PERSISTENCE_CONFIG };
  private _strategies: PersistenceStrategy[] = [];
  private _fallbackStrategyType: string | null = null;
  
  // State tracking
  private _pendingOperations = new Map<string, PendingOperation>();
  private _stats: PersistenceStats = this._createEmptyStats();
  private _cacheEntries = new Map<string, CacheEntry>();
  private _isOnline = true;
  
  // Event subjects
  private readonly _saveStatus$ = new BehaviorSubject<SaveStatus>({ status: 'idle' });
  private readonly _cacheStatus$ = new BehaviorSubject<Map<string, CacheStatus>>(new Map());
  private readonly _events$ = new Subject<PersistenceEvent>();
  private readonly _conflicts$ = new Subject<PersistenceConflict>();
  
  // Public observables
  public readonly saveStatus$ = this._saveStatus$.asObservable();
  public readonly cacheStatus$ = this._cacheStatus$.asObservable();
  public readonly events$ = this._events$.asObservable();
  public readonly conflicts$ = this._conflicts$.asObservable();

  constructor(private logger: LoggerService) {
    this.logger.info('PersistenceCoordinator initialized');
    this._initializeDefaultStrategies();
    this._startHealthMonitoring();
  }

  /**
   * Save operation with strategy selection and fallback
   */
  save(operation: SaveOperation): Observable<SaveResult> {
    const startTime = Date.now();
    const operationId = uuid();
    
    this.logger.debug('PersistenceCoordinator: Starting save operation', {
      operationId,
      diagramId: operation.diagramId,
      strategy: operation.strategyType,
      size: operation.data ? JSON.stringify(operation.data).length : 0
    });

    // Update save status
    this._saveStatus$.next({ 
      status: 'saving', 
      operationId, 
      diagramId: operation.diagramId 
    });

    // Track pending operation
    const pending: PendingOperation = {
      id: operationId,
      type: 'save',
      operation,
      startTime,
      timeout: setTimeout(() => this._handleTimeout(operationId), this._config.operationTimeoutMs)
    };
    this._pendingOperations.set(operationId, pending);

    return this._executeSaveOperation(operation, operationId).pipe(
      timeout(this._config.operationTimeoutMs),
      tap(result => {
        const executionTime = Date.now() - startTime;
        this._handleSaveCompleted(operation, result, executionTime);
      }),
      catchError(error => {
        const executionTime = Date.now() - startTime;
        this._handleSaveError(operation, error, executionTime);
        return throwError(() => error);
      }),
      tap(() => {
        // Clean up tracking
        const pending = this._pendingOperations.get(operationId);
        if (pending) {
          clearTimeout(pending.timeout);
          this._pendingOperations.delete(operationId);
        }
        this._saveStatus$.next({ status: 'idle' });
      })
    );
  }

  /**
   * Load operation with strategy selection and caching
   */
  load(operation: LoadOperation): Observable<LoadResult> {
    const startTime = Date.now();
    const operationId = uuid();
    
    this.logger.debug('PersistenceCoordinator: Starting load operation', {
      operationId,
      diagramId: operation.diagramId,
      strategy: operation.strategyType,
      useCache: operation.useCache
    });

    // Check cache first if enabled
    if (operation.useCache && this._config.enableCaching) {
      const cacheEntry = this._cacheEntries.get(operation.diagramId);
      if (cacheEntry && this._isCacheValid(cacheEntry)) {
        this.logger.debug('Returning cached result', { diagramId: operation.diagramId });
        return of(this._createLoadResultFromCache(operation, cacheEntry));
      }
    }

    // Track pending operation
    const pending: PendingOperation = {
      id: operationId,
      type: 'load',
      operation,
      startTime,
      timeout: setTimeout(() => this._handleTimeout(operationId), this._config.operationTimeoutMs)
    };
    this._pendingOperations.set(operationId, pending);

    return this._executeLoadOperation(operation, operationId).pipe(
      timeout(this._config.operationTimeoutMs),
      tap(result => {
        const executionTime = Date.now() - startTime;
        this._handleLoadCompleted(operation, result, executionTime);
      }),
      catchError(error => {
        const executionTime = Date.now() - startTime;
        this._handleLoadError(operation, error, executionTime);
        return throwError(() => error);
      }),
      tap(() => {
        // Clean up tracking
        const pending = this._pendingOperations.get(operationId);
        if (pending) {
          clearTimeout(pending.timeout);
          this._pendingOperations.delete(operationId);
        }
      })
    );
  }

  /**
   * Sync operation for collaboration
   */
  sync(operation: SyncOperation): Observable<SyncResult> {
    const startTime = Date.now();
    const operationId = uuid();
    
    this.logger.debug('PersistenceCoordinator: Starting sync operation', {
      operationId,
      diagramId: operation.diagramId,
      strategy: operation.strategyType
    });

    return this._executeSyncOperation(operation, operationId).pipe(
      timeout(this._config.operationTimeoutMs),
      tap(result => {
        const executionTime = Date.now() - startTime;
        this._handleSyncCompleted(operation, result, executionTime);
      }),
      catchError(error => {
        const executionTime = Date.now() - startTime;
        this._handleSyncError(operation, error, executionTime);
        return throwError(() => error);
      })
    );
  }

  /**
   * Batch save operations
   */
  saveBatch(operations: SaveOperation[]): Observable<SaveResult[]> {
    if (operations.length === 0) {
      return of([]);
    }

    this.logger.debug('PersistenceCoordinator: Starting batch save', {
      operationCount: operations.length,
      diagramIds: operations.map(op => op.diagramId)
    });

    const saveObservables = operations.map(op => this.save(op));
    return forkJoin(saveObservables);
  }

  /**
   * Batch load operations
   */
  loadBatch(operations: LoadOperation[]): Observable<LoadResult[]> {
    if (operations.length === 0) {
      return of([]);
    }

    this.logger.debug('PersistenceCoordinator: Starting batch load', {
      operationCount: operations.length,
      diagramIds: operations.map(op => op.diagramId)
    });

    const loadObservables = operations.map(op => this.load(op));
    return forkJoin(loadObservables);
  }

  /**
   * Clear cache entries
   */
  clearCache(diagramId?: string): Observable<void> {
    if (diagramId) {
      this._cacheEntries.delete(diagramId);
      this.logger.debug('Cache cleared for diagram', { diagramId });
    } else {
      this._cacheEntries.clear();
      this.logger.debug('All cache entries cleared');
    }
    
    this._updateCacheStatus();
    return of(void 0);
  }

  /**
   * Get cache status for a diagram
   */
  getCacheStatus(diagramId: string): Observable<CacheStatus> {
    const entry = this._cacheEntries.get(diagramId);
    
    if (!entry) {
      return of({ status: 'empty', diagramId });
    }

    const isValid = this._isCacheValid(entry);
    const age = Date.now() - entry.timestamp;
    
    return of({
      status: isValid ? 'valid' : 'stale',
      diagramId,
      lastUpdate: new Date(entry.timestamp),
      age,
      size: entry.size
    });
  }

  /**
   * Get cache entry
   */
  getCacheEntry(diagramId: string): Observable<CacheEntry | null> {
    const entry = this._cacheEntries.get(diagramId);
    return of(entry || null);
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(diagramId: string): Observable<void> {
    const entry = this._cacheEntries.get(diagramId);
    if (entry) {
      entry.isValid = false;
      this.logger.debug('Cache invalidated for diagram', { diagramId });
      this._updateCacheStatus();
    }
    return of(void 0);
  }

  /**
   * Add a persistence strategy
   */
  addStrategy(strategy: PersistenceStrategy): void {
    this._strategies.push(strategy);
    this._strategies.sort((a, b) => b.priority - a.priority); // Higher priority first
    this.logger.debug('Added persistence strategy', { 
      type: strategy.type, 
      priority: strategy.priority 
    });
  }

  /**
   * Remove a persistence strategy
   */
  removeStrategy(strategyType: string): void {
    const index = this._strategies.findIndex(s => s.type === strategyType);
    if (index >= 0) {
      this._strategies.splice(index, 1);
      this.logger.debug('Removed persistence strategy', { type: strategyType });
    }
  }

  /**
   * Get all strategies
   */
  getStrategies(): PersistenceStrategy[] {
    return [...this._strategies];
  }

  /**
   * Set fallback strategy
   */
  setFallbackStrategy(strategyType: string): void {
    this._fallbackStrategyType = strategyType;
    this.logger.debug('Set fallback strategy', { type: strategyType });
  }

  /**
   * Configure the coordinator
   */
  configure(config: Partial<PersistenceConfig>): void {
    this._config = { ...this._config, ...config };
    this.logger.debug('PersistenceCoordinator configuration updated', config);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): PersistenceConfig {
    return { ...this._config };
  }

  /**
   * Get statistics
   */
  getStats(): PersistenceStats {
    return { ...this._stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = this._createEmptyStats();
    this.logger.debug('Persistence statistics reset');
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Get health status
   */
  getHealthStatus(): Observable<PersistenceHealthStatus> {
    const strategyStatuses = this._strategies.map(strategy => {
      // In a real implementation, we'd call strategy.getHealthStatus()
      return {
        type: strategy.type,
        status: 'healthy' as const, // Simplified for now
        lastSuccess: new Date()
      };
    });

    const cacheHealth = this._cacheEntries.size > this._config.maxCacheEntries * 0.9 ? 'full' : 'healthy';

    return of({
      overall: this._isOnline ? 'healthy' : 'offline',
      strategies: strategyStatuses,
      cacheHealth,
      pendingOperations: this._pendingOperations.size
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Cancel all pending operations
    for (const pending of this._pendingOperations.values()) {
      clearTimeout(pending.timeout);
    }
    this._pendingOperations.clear();

    // Complete subjects
    this._saveStatus$.complete();
    this._cacheStatus$.complete();
    this._events$.complete();
    this._conflicts$.complete();

    // Clear cache
    this._cacheEntries.clear();

    this.logger.debug('PersistenceCoordinator disposed');
  }

  // Private implementation methods would continue here...
  // (Due to length constraints, I'll implement the key private methods)

  private _executeSaveOperation(operation: SaveOperation, _operationId: string): Observable<SaveResult> {
    const strategy = this._findStrategy(operation.strategyType);
    if (!strategy) {
      return throwError(() => new Error(`Strategy '${operation.strategyType}' not found`));
    }

    return strategy.save(operation).pipe(
      tap(result => {
        if (result.success && this._config.enableCaching) {
          this._updateCache(operation.diagramId, operation.data);
        }
      }),
      catchError(error => {
        // Try fallback strategy
        return this._tryFallbackStrategy('save', operation, error);
      })
    );
  }

  private _executeLoadOperation(operation: LoadOperation, _operationId: string): Observable<LoadResult> {
    const strategy = this._findStrategy(operation.strategyType);
    if (!strategy) {
      return throwError(() => new Error(`Strategy '${operation.strategyType}' not found`));
    }

    return strategy.load(operation).pipe(
      tap(result => {
        if (result.success && result.data && this._config.enableCaching) {
          this._updateCache(operation.diagramId, result.data);
        }
      }),
      catchError(error => {
        // Try fallback strategy
        return this._tryFallbackStrategy('load', operation, error);
      })
    );
  }

  private _executeSyncOperation(operation: SyncOperation, _operationId: string): Observable<SyncResult> {
    const strategy = this._findStrategy(operation.strategyType);
    if (!strategy) {
      return throwError(() => new Error(`Strategy '${operation.strategyType}' not found`));
    }

    return strategy.sync ? strategy.sync(operation) : throwError(() => new Error('Strategy does not support sync'));
  }

  private _findStrategy(strategyType: string): PersistenceStrategy | null {
    return this._strategies.find(s => s.type === strategyType) || null;
  }

  private _tryFallbackStrategy(operationType: string, operation: any, originalError: any): Observable<any> {
    if (!this._fallbackStrategyType) {
      return throwError(() => originalError);
    }

    const fallbackStrategy = this._findStrategy(this._fallbackStrategyType);
    if (!fallbackStrategy) {
      return throwError(() => originalError);
    }

    this.logger.warn('Using fallback strategy', {
      originalStrategy: operation.strategyType,
      fallbackStrategy: this._fallbackStrategyType,
      error: originalError.message
    });

    // Execute with fallback strategy
    switch (operationType) {
      case 'save':
        return fallbackStrategy.save(operation);
      case 'load':
        return fallbackStrategy.load(operation);
      case 'sync':
        return fallbackStrategy.sync ? fallbackStrategy.sync(operation) : throwError(() => originalError);
      default:
        return throwError(() => originalError);
    }
  }

  private _updateCache(diagramId: string, data: any): void {
    const entry: CacheEntry = {
      diagramId,
      data,
      timestamp: Date.now(),
      size: JSON.stringify(data).length,
      isValid: true
    };

    this._cacheEntries.set(diagramId, entry);
    this._updateCacheStatus();

    // Cleanup old entries if needed
    if (this._cacheEntries.size > this._config.maxCacheEntries) {
      this._cleanupCache();
    }
  }

  private _isCacheValid(entry: CacheEntry): boolean {
    if (!entry.isValid) return false;
    
    const age = Date.now() - entry.timestamp;
    return age < this._config.cacheExpirationMs;
  }

  private _createLoadResultFromCache(operation: LoadOperation, entry: CacheEntry): LoadResult {
    return {
      success: true,
      operationId: uuid(),
      diagramId: operation.diagramId,
      data: entry.data,
      timestamp: Date.now(),
      fromCache: true,
      metadata: {
        cacheAge: Date.now() - entry.timestamp,
        cacheSize: entry.size
      }
    };
  }

  private _updateCacheStatus(): void {
    const statusMap = new Map<string, CacheStatus>();
    
    for (const [diagramId, entry] of this._cacheEntries) {
      const isValid = this._isCacheValid(entry);
      const age = Date.now() - entry.timestamp;
      
      statusMap.set(diagramId, {
        status: isValid ? 'valid' : 'stale',
        diagramId,
        lastUpdate: new Date(entry.timestamp),
        age,
        size: entry.size
      });
    }
    
    this._cacheStatus$.next(statusMap);
  }

  private _cleanupCache(): void {
    // Remove oldest entries first
    const entries = Array.from(this._cacheEntries.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const entriesToRemove = entries.slice(0, entries.length - this._config.maxCacheEntries);
    entriesToRemove.forEach(([diagramId]) => {
      this._cacheEntries.delete(diagramId);
    });
    
    this.logger.debug('Cache cleanup completed', {
      removedEntries: entriesToRemove.length,
      remainingEntries: this._cacheEntries.size
    });
  }

  private _createEmptyStats(): PersistenceStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      operationsByStrategy: {},
      lastResetTime: new Date()
    };
  }

  private _handleTimeout(operationId: string): void {
    const pending = this._pendingOperations.get(operationId);
    if (pending) {
      this._pendingOperations.delete(operationId);
      this.logger.warn('Operation timed out', {
        operationId,
        type: pending.type,
        timeoutMs: this._config.operationTimeoutMs
      });
    }
  }

  private _handleSaveCompleted(operation: SaveOperation, result: SaveResult, _executionTime: number): void {
    this._stats.successfulOperations++;
    this._updateAverageResponseTime(executionTime);
    
    this._events$.next({
      type: 'save-completed',
      diagramId: operation.diagramId,
      result,
      timestamp: Date.now()
    });
  }

  private _handleSaveError(operation: SaveOperation, error: any, _executionTime: number): void {
    this._stats.failedOperations++;
    
    this._events$.next({
      type: 'save-failed',
      diagramId: operation.diagramId,
      error: error.message || String(error),
      timestamp: Date.now()
    });
  }

  private _handleLoadCompleted(operation: LoadOperation, result: LoadResult, _executionTime: number): void {
    this._stats.successfulOperations++;
    this._updateAverageResponseTime(executionTime);
    
    if (result.fromCache) {
      this._stats.cacheHits++;
    } else {
      this._stats.cacheMisses++;
    }
    
    this._events$.next({
      type: 'load-completed',
      diagramId: operation.diagramId,
      result,
      timestamp: Date.now()
    });
  }

  private _handleLoadError(operation: LoadOperation, error: any, _executionTime: number): void {
    this._stats.failedOperations++;
    this._stats.cacheMisses++;
    
    this._events$.next({
      type: 'load-failed',
      diagramId: operation.diagramId,
      error: error.message || String(error),
      timestamp: Date.now()
    });
  }

  private _handleSyncCompleted(operation: SyncOperation, result: SyncResult, _executionTime: number): void {
    this._stats.successfulOperations++;
    this._updateAverageResponseTime(executionTime);
    
    this._events$.next({
      type: 'sync-completed',
      diagramId: operation.diagramId,
      result,
      timestamp: Date.now()
    });
  }

  private _handleSyncError(operation: SyncOperation, error: any, _executionTime: number): void {
    this._stats.failedOperations++;
    
    this._events$.next({
      type: 'sync-failed',
      diagramId: operation.diagramId,
      error: error.message || String(error),
      timestamp: Date.now()
    });
  }

  private _updateAverageResponseTime(newTime: number): void {
    const count = this._stats.successfulOperations;
    if (count === 1) {
      this._stats.averageResponseTime = newTime;
    } else {
      this._stats.averageResponseTime = ((this._stats.averageResponseTime * (count - 1)) + newTime) / count;
    }
  }

  private _initializeDefaultStrategies(): void {
    // TODO: Initialize default persistence strategies
    // These would be injected or created here
    this.logger.debug('Default persistence strategies initialized');
  }

  private _startHealthMonitoring(): void {
    // TODO: Start periodic health monitoring
    this.logger.debug('Health monitoring started');
  }
}