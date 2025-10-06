/**
 * AppAutoSaveManager - History-based auto-save with immediate saves
 *
 * This service provides immediate auto-save functionality with:
 * - Zero debouncing - saves execute immediately when not in progress
 * - History index tracking - ensures nothing is missed
 * - Server update_vector tracking - idempotency and conflict detection
 * - Queue management - handles rapid changes without overlapping saves
 * - Dual-mode persistence - REST (offline) vs WebSocket (collaboration)
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import {
  AppPersistenceCoordinator,
  SaveOperation,
  SaveResult,
} from './app-persistence-coordinator.service';

/**
 * Context for auto-save operations
 */
export interface AutoSaveContext {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userName?: string;
  readonly diagramData?: any; // Optional for backward compatibility
  readonly getDiagramData?: () => any; // Callback to get fresh data when save executes
  readonly preferredStrategy?: string;
}

/**
 * Simplified auto-save policy - no debouncing, just queue management
 */
export interface AutoSavePolicy {
  readonly mode: 'auto' | 'manual';
  readonly maxQueueDepth: number;
  readonly maxRetryAttempts: number;
}

/**
 * Auto-save state for external monitoring
 */
export interface AutoSaveState {
  readonly enabled: boolean;
  readonly saveInProgress: boolean;
  readonly lastSaveTime: Date | null;
  readonly mode: string;
  readonly queueDepth: number;
}

/**
 * Statistics for monitoring save performance
 */
export interface AutoSaveStats {
  readonly autoSaves: number;
  readonly manualSaves: number;
  readonly failedSaves: number;
  readonly successfulSaves: number;
  readonly totalSaves: number;
  readonly averageSaveTimeMs: number;
  readonly lastResetTime: Date;
}

/**
 * Tracking state for history index and update_vector
 */
export interface SaveTracking {
  localHistoryIndex: number; // Current X6 history index
  lastSavedHistoryIndex: number; // Last index we saved
  serverUpdateVector: number; // Latest known server version
  lastSavedUpdateVector: number; // Last saved server version
  saveInProgress: boolean; // Is a save running?
  pendingHistoryChanges: number; // Count of queued changes
}

const DEFAULT_POLICIES: Record<string, AutoSavePolicy> = {
  auto: {
    mode: 'auto',
    maxQueueDepth: 100,
    maxRetryAttempts: 3,
  },
  manual: {
    mode: 'manual',
    maxQueueDepth: 0,
    maxRetryAttempts: 1,
  },
};

@Injectable()
export class AppAutoSaveManager {
  private readonly _saveCompleted$ = new Subject<SaveResult>();
  private readonly _stateChanged$: BehaviorSubject<AutoSaveState>;
  private readonly _events$ = new Subject<any>();
  private readonly _saveFailed$ = new Subject<any>();

  private _enabled = true;
  private _currentPolicy: AutoSavePolicy = DEFAULT_POLICIES['auto'];
  private _lastSaveTime: Date | null = null;

  // History and version tracking
  private _saveTracking: SaveTracking = {
    localHistoryIndex: 0,
    lastSavedHistoryIndex: -1, // Start at -1 so first save at index 0 triggers
    serverUpdateVector: 0,
    lastSavedUpdateVector: 0,
    saveInProgress: false,
    pendingHistoryChanges: 0,
  };

  // Extension points (for future use)
  private _analyzers: any[] = [];
  private _decisionMakers: any[] = [];
  private _eventHandlers: any[] = [];

  // Statistics tracking
  private _stats: AutoSaveStats = {
    autoSaves: 0,
    manualSaves: 0,
    failedSaves: 0,
    successfulSaves: 0,
    totalSaves: 0,
    averageSaveTimeMs: 0,
    lastResetTime: new Date(),
  };

  private _totalSaveTimeMs = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly appPersistenceCoordinator: AppPersistenceCoordinator,
  ) {
    // Initialize the state subject after all properties are set
    this._stateChanged$ = new BehaviorSubject<AutoSaveState>(this._createInitialState());
    this.logger.debug('AppAutoSaveManager initialized (history-based, zero debouncing)');
  }

  /**
   * Enable/Disable Management
   */
  enable(): void {
    if (!this._enabled) {
      this._enabled = true;
      this.logger.debug('AppAutoSaveManager enabled');
      this._emitStateChange();
    }
  }

  disable(): void {
    if (this._enabled) {
      this._enabled = false;
      this.logger.debug('AppAutoSaveManager disabled');
      this._emitStateChange();
    }
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Policy Management
   */
  setPolicyMode(mode: 'auto' | 'manual'): void {
    if (DEFAULT_POLICIES[mode]) {
      this._currentPolicy = DEFAULT_POLICIES[mode];
      this.logger.debug('AutoSave policy mode changed', { mode });
      this._emitStateChange();
    } else {
      this.logger.warn('Invalid auto-save policy mode', { mode });
    }
  }

  getPolicy(): AutoSavePolicy {
    return { ...this._currentPolicy };
  }

  setPolicy(policy: Partial<AutoSavePolicy>): void {
    this._currentPolicy = { ...this._currentPolicy, ...policy };
    this.logger.debug('AutoSave policy updated', { policy });
    this._emitStateChange();
  }

  /**
   * State Management
   */
  getState(): AutoSaveState {
    return {
      enabled: this._enabled,
      saveInProgress: this._saveTracking.saveInProgress,
      lastSaveTime: this._lastSaveTime,
      mode: this._currentPolicy.mode,
      queueDepth: this._saveTracking.localHistoryIndex - this._saveTracking.lastSavedHistoryIndex,
    };
  }

  get stateChanged$(): Observable<AutoSaveState> {
    return this._stateChanged$.asObservable();
  }

  isPendingSave(): boolean {
    return this._saveTracking.saveInProgress;
  }

  /**
   * Manual Save
   */
  triggerManualSave(context: AutoSaveContext): Observable<SaveResult> {
    this.logger.debug('Manual save triggered', { diagramId: context.diagramId });

    const startTime = performance.now();
    this._stats = {
      ...this._stats,
      manualSaves: this._stats.manualSaves + 1,
      totalSaves: this._stats.totalSaves + 1,
    };

    // For manual saves, use captured data immediately
    const diagramData = context.getDiagramData ? context.getDiagramData() : context.diagramData;

    const saveOperation: SaveOperation = {
      diagramId: context.diagramId,
      data: diagramData,
      strategyType: context.preferredStrategy,
      metadata: {
        threatModelId: context.threatModelId,
        userId: context.userId,
        userEmail: context.userEmail,
        userName: context.userName,
        saveType: 'manual',
        timestamp: Date.now(),
      },
    };

    return this.appPersistenceCoordinator.save(saveOperation).pipe(
      tap(result => {
        const saveTime = performance.now() - startTime;
        this._updateSaveStats(result, saveTime);

        if (result.success) {
          this._lastSaveTime = new Date();
          this._emitStateChange();
        }

        this._saveCompleted$.next(result);
      }),
      catchError(error => {
        this._stats = {
          ...this._stats,
          failedSaves: this._stats.failedSaves + 1,
        };
        this.logger.error('Manual save failed', { error, context });

        // Emit save failed event
        this._saveFailed$.next({
          error: error.message || 'Save failed',
          context: context,
          timestamp: Date.now(),
        });

        return of({
          success: false,
          operationId: `manual-save-error-${Date.now()}`,
          diagramId: context.diagramId,
          timestamp: Date.now(),
          error: error.message || 'Unknown error',
        });
      }),
    );
  }

  /**
   * Auto-Save Triggering - NEW SIGNATURE with history index
   */
  trigger(
    historyIndex: number,
    context: AutoSaveContext,
    isUndo = false,
    isRedo = false,
  ): Observable<boolean> {
    if (!this._enabled || this._currentPolicy.mode === 'manual') {
      return of(false);
    }

    this.logger.debug('Auto-save trigger received', {
      historyIndex,
      isUndo,
      isRedo,
      currentIndex: this._saveTracking.localHistoryIndex,
      lastSaved: this._saveTracking.lastSavedHistoryIndex,
      saveInProgress: this._saveTracking.saveInProgress,
    });

    // Update local history index
    this._saveTracking.localHistoryIndex = historyIndex;

    // Check if already saved
    if (historyIndex <= this._saveTracking.lastSavedHistoryIndex) {
      this.logger.debug('History already saved, skipping', {
        historyIndex,
        lastSaved: this._saveTracking.lastSavedHistoryIndex,
      });
      return of(false);
    }

    // Check queue depth
    const queueDepth = historyIndex - this._saveTracking.lastSavedHistoryIndex;
    if (queueDepth > this._currentPolicy.maxQueueDepth) {
      this.logger.error('Auto-save queue overflow', {
        queueDepth,
        maxDepth: this._currentPolicy.maxQueueDepth,
        historyIndex,
        lastSaved: this._saveTracking.lastSavedHistoryIndex,
      });
      // Could block UI or force manual save here
      return of(false);
    }

    // If save in progress, mark pending
    if (this._saveTracking.saveInProgress) {
      this._saveTracking.pendingHistoryChanges = queueDepth;
      this.logger.debug('Save in progress, queueing', {
        queueDepth,
        currentIndex: historyIndex,
      });
      this._emitStateChange();
      return of(false);
    }

    // Execute immediate save
    return this._executeAutoSave(context, historyIndex, isUndo, isRedo);
  }

  /**
   * Force Save - bypasses all checks
   */
  forceSave(context: AutoSaveContext): Observable<SaveResult> {
    this.logger.debug('Force save triggered', { diagramId: context.diagramId });
    return this.triggerManualSave(context);
  }

  /**
   * Update server update_vector from external sources (WebSocket state corrections)
   */
  updateServerUpdateVector(updateVector: number): void {
    if (updateVector > this._saveTracking.serverUpdateVector) {
      this.logger.debug('Updating server update_vector from external source', {
        old: this._saveTracking.serverUpdateVector,
        new: updateVector,
      });
      this._saveTracking.serverUpdateVector = updateVector;
    }
  }

  /**
   * Get save tracking state for debugging/monitoring
   */
  getSaveTracking(): Readonly<SaveTracking> {
    return { ...this._saveTracking };
  }

  /**
   * Pending Save Management
   */
  getNextScheduledSave(): Date | null {
    // No scheduled saves in immediate mode, only pending queue
    return null;
  }

  cancelPendingSave(): boolean {
    // Can't cancel in-progress saves, only clear pending queue
    if (this._saveTracking.pendingHistoryChanges > 0) {
      this.logger.debug('Clearing pending save queue', {
        queueDepth: this._saveTracking.pendingHistoryChanges,
      });
      this._saveTracking.pendingHistoryChanges = 0;
      this._emitStateChange();
      return true;
    }
    return false;
  }

  /**
   * Observables
   */
  get saveCompleted$(): Observable<SaveResult> {
    return this._saveCompleted$.asObservable();
  }

  get events$(): Observable<any> {
    return this._events$.asObservable();
  }

  get saveFailed$(): Observable<any> {
    return this._saveFailed$.asObservable();
  }

  /**
   * Statistics
   */
  getStats(): AutoSaveStats {
    return { ...this._stats };
  }

  resetStats(): void {
    this._stats = {
      autoSaves: 0,
      manualSaves: 0,
      failedSaves: 0,
      successfulSaves: 0,
      totalSaves: 0,
      averageSaveTimeMs: 0,
      lastResetTime: new Date(),
    };
    this._totalSaveTimeMs = 0;
    this.logger.debug('AutoSave statistics reset');
    this._events$.next({ type: 'stats-reset', timestamp: Date.now() });
  }

  /**
   * Extension Points
   */
  registerAnalyzer(analyzer: any): void {
    this._analyzers.push(analyzer);
  }

  registerDecisionMaker(decisionMaker: any): void {
    this._decisionMakers.push(decisionMaker);
  }

  registerEventHandler(handler: any): void {
    this._eventHandlers.push(handler);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this._saveCompleted$.complete();
    this._stateChanged$.complete();
    this._events$.complete();
    this._saveFailed$.complete();
    this.logger.debug('AppAutoSaveManager destroyed');
  }

  /**
   * Private Implementation
   */

  private _executeAutoSave(
    context: AutoSaveContext,
    historyIndex: number,
    isUndo: boolean,
    isRedo: boolean,
  ): Observable<boolean> {
    this._saveTracking.saveInProgress = true;
    this._emitStateChange();

    const startTime = performance.now();
    this._stats = {
      ...this._stats,
      autoSaves: this._stats.autoSaves + 1,
      totalSaves: this._stats.totalSaves + 1,
    };

    // Get fresh data when save executes (CRITICAL for avoiding race conditions)
    const diagramData = context.getDiagramData ? context.getDiagramData() : context.diagramData;

    const saveOperation: SaveOperation = {
      diagramId: context.diagramId,
      data: diagramData,
      strategyType: context.preferredStrategy,
      metadata: {
        threatModelId: context.threatModelId,
        userId: context.userId,
        userEmail: context.userEmail,
        userName: context.userName,
        saveType: 'auto',
        timestamp: Date.now(),
        // Track both client and server versions
        clientHistoryIndex: historyIndex,
        serverUpdateVector: this._saveTracking.serverUpdateVector,
        isUndo,
        isRedo,
      },
    };

    return this.appPersistenceCoordinator.save(saveOperation).pipe(
      tap(result => {
        const saveTime = performance.now() - startTime;
        this._updateSaveStats(result, saveTime);

        if (result.success) {
          // Update tracking from server response
          const newUpdateVector = result.metadata?.['update_vector'];
          if (newUpdateVector !== undefined) {
            this._saveTracking.serverUpdateVector = newUpdateVector;
            this._saveTracking.lastSavedUpdateVector = newUpdateVector;
            this.logger.debug('Server update_vector updated', {
              newUpdateVector,
              historyIndex,
            });
          }

          this._saveTracking.lastSavedHistoryIndex = historyIndex;
          this._lastSaveTime = new Date();
        }

        this._saveTracking.saveInProgress = false;

        // Check for pending changes
        if (this._saveTracking.pendingHistoryChanges > 0) {
          const currentIndex = this._saveTracking.localHistoryIndex;
          if (currentIndex > historyIndex) {
            this.logger.info('Processing pending auto-save', {
              savedIndex: historyIndex,
              currentIndex,
              queueDepth: currentIndex - historyIndex,
            });

            this._saveTracking.pendingHistoryChanges = 0;
            // Recursively trigger with latest index
            // Use setTimeout to avoid deep recursion
            setTimeout(() => {
              this.trigger(currentIndex, context, false, false).subscribe();
            }, 0);
          }
        }

        this._emitStateChange();
        this._saveCompleted$.next(result);
      }),
      catchError(error => {
        this._stats = {
          ...this._stats,
          failedSaves: this._stats.failedSaves + 1,
        };
        this._saveTracking.saveInProgress = false;
        this._saveTracking.pendingHistoryChanges = 0; // Reset on error
        this._emitStateChange();

        this.logger.error('Auto-save failed', { error, historyIndex });
        this._saveFailed$.next({
          error: error.message || 'Save failed',
          context: context,
          timestamp: Date.now(),
        });

        return of(false);
      }),
      map(result => (typeof result === 'boolean' ? result : result.success)),
    );
  }

  private _createInitialState(): AutoSaveState {
    return {
      enabled: this._enabled,
      saveInProgress: false,
      lastSaveTime: null,
      mode: this._currentPolicy.mode,
      queueDepth: 0,
    };
  }

  private _emitStateChange(): void {
    this._stateChanged$.next(this.getState());
  }

  private _updateSaveStats(result: SaveResult, saveTime: number): void {
    if (result.success) {
      this._stats = {
        ...this._stats,
        successfulSaves: this._stats.successfulSaves + 1,
      };
    }

    this._totalSaveTimeMs += saveTime;
    const averageSaveTimeMs =
      this._stats.totalSaves > 0 ? this._totalSaveTimeMs / this._stats.totalSaves : 0;

    this._stats = {
      ...this._stats,
      averageSaveTimeMs,
    };

    this.logger.debug('Save stats updated', {
      saveTime,
      averageSaveTimeMs,
      totalSaves: this._stats.totalSaves,
    });
  }
}
