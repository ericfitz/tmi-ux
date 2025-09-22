/**
 * AutoSaveManager - Intelligent auto-save management for DFD diagrams
 *
 * This service provides smart auto-save functionality with:
 * - Policy-based saving decisions (aggressive, normal, conservative)
 * - Event-triggered saves based on operations
 * - Manual save capability
 * - Statistics tracking and monitoring
 * - Integration with PersistenceCoordinator
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of, throwError, timer } from 'rxjs';
import { map, catchError, timeout, tap, finalize, switchMap, debounceTime } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import {
  PersistenceCoordinator,
  SaveOperation,
  SaveResult,
} from './persistence-coordinator.service';

// Simple interfaces that match what the tests expect
export interface AutoSaveContext {
  readonly diagramId: string;
  readonly userId: string;
  readonly diagramData: any;
  readonly preferredStrategy?: string;
}

export interface AutoSaveTriggerEvent {
  readonly type: 'operation-completed' | 'time-elapsed' | 'user-action';
  readonly operationType?: string;
  readonly affectedCellIds?: string[];
  readonly timestamp: number;
  readonly metadata?: Record<string, any>;
}

export interface AutoSavePolicy {
  readonly mode: 'aggressive' | 'normal' | 'conservative' | 'manual';
  readonly changeThreshold: number;
  readonly timeThresholdMs: number;
  readonly debounceMs: number;
  readonly maxRetryAttempts: number;
}

export interface AutoSaveState {
  readonly enabled: boolean;
  readonly pendingSave: boolean;
  readonly lastSaveTime: Date | null;
  readonly changesSinceLastSave: number;
  readonly mode: string;
}

export interface AutoSaveStats {
  readonly autoSaves: number;
  readonly manualSaves: number;
  readonly failedSaves: number;
  readonly totalSaves: number;
  readonly averageSaveTimeMs: number;
  readonly lastResetTime: Date;
}

const DEFAULT_POLICIES: Record<string, AutoSavePolicy> = {
  aggressive: {
    mode: 'aggressive',
    changeThreshold: 1,
    timeThresholdMs: 5000,
    debounceMs: 100,
    maxRetryAttempts: 3,
  },
  normal: {
    mode: 'normal',
    changeThreshold: 3,
    timeThresholdMs: 15000,
    debounceMs: 1000,
    maxRetryAttempts: 3,
  },
  conservative: {
    mode: 'conservative',
    changeThreshold: 10,
    timeThresholdMs: 30000,
    debounceMs: 3000,
    maxRetryAttempts: 2,
  },
  manual: {
    mode: 'manual',
    changeThreshold: Number.MAX_SAFE_INTEGER,
    timeThresholdMs: Number.MAX_SAFE_INTEGER,
    debounceMs: 0,
    maxRetryAttempts: 1,
  },
};

@Injectable({
  providedIn: 'root',
})
export class AutoSaveManager {
  private readonly _saveCompleted$ = new Subject<SaveResult>();
  private readonly _triggerEvent$ = new Subject<AutoSaveTriggerEvent>();
  private readonly _stateChanged$: BehaviorSubject<AutoSaveState>;

  private _enabled = true;
  private _currentPolicy: AutoSavePolicy = DEFAULT_POLICIES['normal'];
  private _lastSaveTime: Date | null = null;
  private _changesSinceLastSave = 0;
  private _pendingSaveTimeout: any = null;
  private _isPendingSave = false;

  // Statistics tracking
  private _stats: AutoSaveStats = {
    autoSaves: 0,
    manualSaves: 0,
    failedSaves: 0,
    totalSaves: 0,
    averageSaveTimeMs: 0,
    lastResetTime: new Date(),
  };

  private _totalSaveTimeMs = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly persistenceCoordinator: PersistenceCoordinator,
  ) {
    // Initialize the state subject after all properties are set
    this._stateChanged$ = new BehaviorSubject<AutoSaveState>(this._createInitialState());
    
    this.logger.debug('AutoSaveManager initialized');
    this._setupTriggerProcessing();
  }

  /**
   * Enable/Disable Management
   */
  enable(): void {
    if (!this._enabled) {
      this._enabled = true;
      this.logger.debug('AutoSaveManager enabled');
      this._emitStateChange();
    }
  }

  disable(): void {
    if (this._enabled) {
      this._enabled = false;
      this._cancelPendingSave();
      this.logger.debug('AutoSaveManager disabled');
      this._emitStateChange();
    }
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Policy Management
   */
  setPolicyMode(mode: 'aggressive' | 'normal' | 'conservative' | 'manual'): void {
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
      pendingSave: this._isPendingSave,
      lastSaveTime: this._lastSaveTime,
      changesSinceLastSave: this._changesSinceLastSave,
      mode: this._currentPolicy.mode,
    };
  }

  isPendingSave(): boolean {
    return this._isPendingSave;
  }

  /**
   * Manual Save
   */
  triggerManualSave(context: AutoSaveContext): Observable<SaveResult> {
    this.logger.debug('Manual save triggered', { diagramId: context.diagramId });

    // Cancel any pending auto-save
    this._cancelPendingSave();

    const startTime = performance.now();
    this._stats.manualSaves++;
    this._stats.totalSaves++;

    const saveOperation: SaveOperation = {
      diagramId: context.diagramId,
      data: context.diagramData,
      strategyType: context.preferredStrategy,
      metadata: {
        userId: context.userId,
        saveType: 'manual',
        timestamp: Date.now(),
      },
    };

    return this.persistenceCoordinator.save(saveOperation).pipe(
      tap(result => {
        const saveTime = performance.now() - startTime;
        this._updateSaveStats(result, saveTime);

        if (result.success) {
          this._lastSaveTime = new Date();
          this._changesSinceLastSave = 0;
          this._emitStateChange();
        }

        this._saveCompleted$.next(result);
      }),
      catchError(error => {
        this._stats.failedSaves++;
        this.logger.error('Manual save failed', { error, context });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Auto-Save Triggering
   */
  trigger(event: AutoSaveTriggerEvent, context: AutoSaveContext): Observable<boolean> {
    if (!this._enabled) {
      return of(false);
    }

    this.logger.debug('AutoSave trigger received', {
      type: event.type,
      operationType: event.operationType,
      diagramId: context.diagramId,
    });

    // Increment change counter
    this._changesSinceLastSave++;
    this._emitStateChange();

    // Send to trigger processing pipeline
    this._triggerEvent$.next(event);

    // Return whether save will be triggered
    const decision = this._shouldTriggerSave(event, context);
    return of(decision);
  }

  /**
   * Observables
   */
  get saveCompleted$(): Observable<SaveResult> {
    return this._saveCompleted$.asObservable();
  }

  get stateChanged$(): Observable<AutoSaveState> {
    return this._stateChanged$.asObservable();
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
      totalSaves: 0,
      averageSaveTimeMs: 0,
      lastResetTime: new Date(),
    };
    this._totalSaveTimeMs = 0;
    this.logger.debug('AutoSave statistics reset');
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this._cancelPendingSave();
    this._saveCompleted$.complete();
    this._triggerEvent$.complete();
    this._stateChanged$.complete();
    this.logger.debug('AutoSaveManager disposed');
  }

  /**
   * Private Implementation
   */
  private _setupTriggerProcessing(): void {
    // Process triggers with debouncing based on policy
    this._triggerEvent$.pipe(debounceTime(this._currentPolicy.debounceMs)).subscribe(event => {
      this._processTrigger(event);
    });
  }

  private _processTrigger(event: AutoSaveTriggerEvent): void {
    // In a real implementation, this would contain the context
    // For now, we'll just log that the trigger was processed
    this.logger.debug('Processing debounced trigger', {
      type: event.type,
      operationType: event.operationType,
    });
  }

  private _shouldTriggerSave(event: AutoSaveTriggerEvent, context: AutoSaveContext): boolean {
    // Check policy mode
    if (this._currentPolicy.mode === 'manual') {
      return false;
    }

    // Check change threshold
    if (this._changesSinceLastSave < this._currentPolicy.changeThreshold) {
      return false;
    }

    // Check time threshold
    if (this._lastSaveTime) {
      const timeSinceLastSave = Date.now() - this._lastSaveTime.getTime();
      if (timeSinceLastSave < this._currentPolicy.timeThresholdMs) {
        return false;
      }
    }

    // Schedule auto-save
    this._scheduleAutoSave(context);
    return true;
  }

  private _scheduleAutoSave(context: AutoSaveContext): void {
    if (this._isPendingSave) {
      return; // Already have a save pending
    }

    this._isPendingSave = true;
    this._emitStateChange();

    // Schedule save after debounce period
    this._pendingSaveTimeout = setTimeout(() => {
      this._executeAutoSave(context);
    }, this._currentPolicy.debounceMs);
  }

  private _executeAutoSave(context: AutoSaveContext): void {
    if (!this._enabled || !this._isPendingSave) {
      return;
    }

    this.logger.debug('Executing auto-save', { diagramId: context.diagramId });

    const startTime = performance.now();
    this._stats.autoSaves++;
    this._stats.totalSaves++;

    const saveOperation: SaveOperation = {
      diagramId: context.diagramId,
      data: context.diagramData,
      strategyType: context.preferredStrategy,
      metadata: {
        userId: context.userId,
        saveType: 'auto',
        timestamp: Date.now(),
      },
    };

    this.persistenceCoordinator.save(saveOperation).subscribe({
      next: result => {
        const saveTime = performance.now() - startTime;
        this._updateSaveStats(result, saveTime);

        if (result.success) {
          this._lastSaveTime = new Date();
          this._changesSinceLastSave = 0;
        }

        this._isPendingSave = false;
        this._emitStateChange();
        this._saveCompleted$.next(result);
      },
      error: error => {
        this._stats.failedSaves++;
        this._isPendingSave = false;
        this._emitStateChange();
        this.logger.error('Auto-save failed', { error, context });
      },
    });
  }

  private _cancelPendingSave(): void {
    if (this._pendingSaveTimeout) {
      clearTimeout(this._pendingSaveTimeout);
      this._pendingSaveTimeout = null;
    }

    if (this._isPendingSave) {
      this._isPendingSave = false;
      this._emitStateChange();
    }
  }

  private _updateSaveStats(result: SaveResult, saveTimeMs: number): void {
    this._totalSaveTimeMs += saveTimeMs;
    this._stats.averageSaveTimeMs = this._totalSaveTimeMs / this._stats.totalSaves;
  }

  private _createInitialState(): AutoSaveState {
    return {
      enabled: this._enabled,
      pendingSave: this._isPendingSave,
      lastSaveTime: this._lastSaveTime,
      changesSinceLastSave: this._changesSinceLastSave,
      mode: this._currentPolicy.mode,
    };
  }

  private _emitStateChange(): void {
    this._stateChanged$.next(this.getState());
  }
}
