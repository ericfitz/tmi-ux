/**
 * AutoSaveManager - Centralized auto-save logic and coordination
 * 
 * Manages all aspects of automatic saving including:
 * - Trigger analysis and decision making
 * - Policy-based save scheduling
 * - Change detection and throttling
 * - Event coordination and statistics
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { IAutoSaveManager } from '../interfaces/auto-save-manager.interface';
import { IPersistenceCoordinator } from '../interfaces/persistence-coordinator.interface';
import {
  AutoSaveTriggerEvent,
  AutoSavePolicy,
  AutoSaveMode,
  AutoSaveState,
  AutoSaveStats,
  AutoSaveEvent,
  AutoSaveConfig,
  AutoSaveContext,
  ChangeAnalyzer,
  SaveDecisionMaker,
  AutoSaveEventHandler,
  DEFAULT_AUTO_SAVE_CONFIG,
  DEFAULT_AUTO_SAVE_POLICY
} from '../types/auto-save.types';
import { SaveResult, SaveOperation } from '../types/persistence.types';

/**
 * Internal state tracking
 */
interface PendingSave {
  readonly id: string;
  readonly context: AutoSaveContext;
  readonly scheduledTime: Date;
  readonly timeout: any;
}

@Injectable({
  providedIn: 'root'
})
export class AutoSaveManager implements IAutoSaveManager {
  private _config: AutoSaveConfig = { ...DEFAULT_AUTO_SAVE_CONFIG };
  private _policy: AutoSavePolicy = { ...DEFAULT_AUTO_SAVE_POLICY };
  private _isEnabled = true;
  
  // Component arrays
  private _analyzers: ChangeAnalyzer[] = [];
  private _decisionMakers: SaveDecisionMaker[] = [];
  private _eventHandlers: AutoSaveEventHandler[] = [];
  
  // State tracking
  private _pendingSave: PendingSave | null = null;
  private _stats: AutoSaveStats = this._createEmptyStats();
  private _lastSaveTime: Date | null = null;
  private _changeCount = 0;
  
  // Event subjects
  private readonly _state$ = new BehaviorSubject<AutoSaveState>(this._createInitialState());
  private readonly _events$ = new Subject<AutoSaveEvent>();
  private readonly _saveCompleted$ = new Subject<SaveResult>();
  private readonly _saveFailed$ = new Subject<{ error: string; context: AutoSaveContext }>();
  
  // Public observables
  public readonly state$ = this._state$.asObservable();
  public readonly events$ = this._events$.asObservable();
  public readonly saveCompleted$ = this._saveCompleted$.asObservable();
  public readonly saveFailed$ = this._saveFailed$.asObservable();

  constructor(
    private logger: LoggerService,
    private persistenceCoordinator: IPersistenceCoordinator
  ) {
    this.logger.info('AutoSaveManager initialized');
    this._initializeBuiltInComponents();
  }

  /**
   * Trigger auto-save evaluation based on an event
   */
  trigger(event: AutoSaveTriggerEvent, context: AutoSaveContext): Observable<SaveResult | null> {
    if (!this._isEnabled) {
      this.logger.debug('AutoSave trigger ignored - disabled', { triggerType: event.type });
      return of(null);
    }

    this.logger.debug('AutoSave trigger received', {
      triggerType: event.type,
      diagramId: context.diagramId,
      changeCount: this._changeCount + 1
    });

    this._changeCount++;
    this._updateState();

    // Emit event for monitoring
    this._emitEvent({
      type: 'trigger-received',
      triggerEvent: event,
      context,
      timestamp: Date.now()
    });

    // Analyze change significance
    return this._analyzeChange(event, context).pipe(
      switchMap(analysis => {
        if (!analysis.isSignificant) {
          this.logger.debug('Change not significant enough for auto-save', {
            triggerType: event.type,
            significance: analysis.significance
          });
          return of(null);
        }

        // Make save decision
        return this._makeSaveDecision(event, context, analysis);
      }),
      switchMap(decision => {
        if (!decision || !decision.shouldSave) {
          this.logger.debug('Decision made not to auto-save', {
            triggerType: event.type,
            reason: decision?.reason || 'no decision'
          });
          return of(null);
        }

        // Execute save based on decision
        return this._executeSaveDecision(decision, context);
      }),
      catchError(error => {
        this._handleTriggerError(event, context, error);
        return of(null);
      })
    );
  }

  /**
   * Trigger manual save (always executes)
   */
  triggerManualSave(context: AutoSaveContext): Observable<SaveResult> {
    this.logger.debug('Manual save triggered', { diagramId: context.diagramId });

    // Cancel any pending auto-save
    this.cancelPendingSave();

    // Emit event
    this._emitEvent({
      type: 'manual-save-triggered',
      context,
      timestamp: Date.now()
    });

    return this._executeSave(context, 'manual').pipe(
      tap(result => {
        if (result.success) {
          this._stats.manualSaves++;
          this._lastSaveTime = new Date();
          this._changeCount = 0;
          this._updateState();
        }
      })
    );
  }

  /**
   * Set auto-save policy
   */
  setPolicy(policy: AutoSavePolicy): void {
    this._policy = { ...policy };
    this.logger.debug('AutoSave policy updated', policy);
    this._updateState();
  }

  /**
   * Set policy mode (convenience method)
   */
  setPolicyMode(mode: AutoSaveMode): void {
    this._policy.mode = mode;
    this.logger.debug('AutoSave mode changed', { mode });
    this._updateState();
  }

  /**
   * Get current policy
   */
  getPolicy(): AutoSavePolicy {
    return { ...this._policy };
  }

  /**
   * Enable auto-save
   */
  enable(): void {
    this._isEnabled = true;
    this.logger.debug('AutoSave enabled');
    this._updateState();
  }

  /**
   * Disable auto-save
   */
  disable(): void {
    this._isEnabled = false;
    this.cancelPendingSave();
    this.logger.debug('AutoSave disabled');
    this._updateState();
  }

  /**
   * Check if auto-save is enabled
   */
  isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Get current auto-save state
   */
  getState(): AutoSaveState {
    return this._state$.value;
  }

  /**
   * Configure the auto-save manager
   */
  configure(config: Partial<AutoSaveConfig>): void {
    this._config = { ...this._config, ...config };
    this.logger.debug('AutoSave configuration updated', config);
    this._updateState();
  }

  /**
   * Get current configuration
   */
  getConfiguration(): AutoSaveConfig {
    return { ...this._config };
  }

  /**
   * Add change analyzer
   */
  addAnalyzer(analyzer: ChangeAnalyzer): void {
    this._analyzers.push(analyzer);
    this._analyzers.sort((a, b) => b.priority - a.priority);
    this.logger.debug('Added change analyzer', { priority: analyzer.priority });
  }

  /**
   * Remove change analyzer
   */
  removeAnalyzer(analyzer: ChangeAnalyzer): void {
    const index = this._analyzers.indexOf(analyzer);
    if (index >= 0) {
      this._analyzers.splice(index, 1);
      this.logger.debug('Removed change analyzer');
    }
  }

  /**
   * Add save decision maker
   */
  addDecisionMaker(decisionMaker: SaveDecisionMaker): void {
    this._decisionMakers.push(decisionMaker);
    this._decisionMakers.sort((a, b) => b.priority - a.priority);
    this.logger.debug('Added save decision maker', { priority: decisionMaker.priority });
  }

  /**
   * Remove save decision maker
   */
  removeDecisionMaker(decisionMaker: SaveDecisionMaker): void {
    const index = this._decisionMakers.indexOf(decisionMaker);
    if (index >= 0) {
      this._decisionMakers.splice(index, 1);
      this.logger.debug('Removed save decision maker');
    }
  }

  /**
   * Add event listener
   */
  addEventListener(handler: AutoSaveEventHandler): void {
    this._eventHandlers.push(handler);
    this.logger.debug('Added auto-save event handler');
  }

  /**
   * Remove event listener
   */
  removeEventListener(handler: AutoSaveEventHandler): void {
    const index = this._eventHandlers.indexOf(handler);
    if (index >= 0) {
      this._eventHandlers.splice(index, 1);
      this.logger.debug('Removed auto-save event handler');
    }
  }

  /**
   * Get statistics
   */
  getStats(): AutoSaveStats {
    return { ...this._stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = this._createEmptyStats();
    this.logger.debug('AutoSave statistics reset');
  }

  /**
   * Force save (bypasses all policies and conditions)
   */
  forceSave(context: AutoSaveContext): Observable<SaveResult> {
    this.logger.debug('Force save triggered', { diagramId: context.diagramId });

    // Cancel any pending save
    this.cancelPendingSave();

    // Emit event
    this._emitEvent({
      type: 'force-save-triggered',
      context,
      timestamp: Date.now()
    });

    return this._executeSave(context, 'force').pipe(
      tap(result => {
        if (result.success) {
          this._stats.forcedSaves++;
          this._lastSaveTime = new Date();
          this._changeCount = 0;
          this._updateState();
        }
      })
    );
  }

  /**
   * Cancel pending save
   */
  cancelPendingSave(): boolean {
    if (this._pendingSave) {
      clearTimeout(this._pendingSave.timeout);
      this.logger.debug('Cancelled pending auto-save', { saveId: this._pendingSave.id });
      
      this._emitEvent({
        type: 'save-cancelled',
        context: this._pendingSave.context,
        timestamp: Date.now()
      });

      this._pendingSave = null;
      this._updateState();
      return true;
    }
    return false;
  }

  /**
   * Check if save is pending
   */
  isPendingSave(): boolean {
    return this._pendingSave !== null;
  }

  /**
   * Get next scheduled save time
   */
  getNextScheduledSave(): Date | null {
    return this._pendingSave?.scheduledTime || null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Cancel pending save
    this.cancelPendingSave();

    // Complete subjects
    this._state$.complete();
    this._events$.complete();
    this._saveCompleted$.complete();
    this._saveFailed$.complete();

    // Clear arrays
    this._analyzers = [];
    this._decisionMakers = [];
    this._eventHandlers = [];

    this.logger.debug('AutoSaveManager disposed');
  }

  // Private implementation methods

  private _analyzeChange(event: AutoSaveTriggerEvent, context: AutoSaveContext): Observable<any> {
    if (this._analyzers.length === 0) {
      // Default analysis - all changes are significant
      return of({
        isSignificant: true,
        significance: 0.5,
        changeType: event.type,
        metadata: {}
      });
    }

    // Run all analyzers and combine results
    const analyses = this._analyzers.map(analyzer => analyzer.analyze(event, context));
    
    // For now, return the first analysis (in a real implementation, we'd combine them)
    return of(analyses[0] || {
      isSignificant: true,
      significance: 0.5,
      changeType: event.type,
      metadata: {}
    });
  }

  private _makeSaveDecision(event: AutoSaveTriggerEvent, context: AutoSaveContext, analysis: any): Observable<any> {
    if (this._decisionMakers.length === 0) {
      // Default decision making based on policy
      return this._makeDefaultDecision(event, context, analysis);
    }

    // Run decision makers in priority order
    for (const decisionMaker of this._decisionMakers) {
      const decision = decisionMaker.decide(event, context, analysis, this._policy);
      if (decision) {
        return of(decision);
      }
    }

    // Fallback to default decision
    return this._makeDefaultDecision(event, context, analysis);
  }

  private _makeDefaultDecision(_event: AutoSaveTriggerEvent, _context: AutoSaveContext, _analysis: any): Observable<any> {
    const now = Date.now();
    const timeSinceLastSave = this._lastSaveTime ? now - this._lastSaveTime.getTime() : Infinity;

    // Check policy mode
    switch (this._policy.mode) {
      case 'disabled':
        return of({ shouldSave: false, reason: 'auto-save disabled' });

      case 'aggressive':
        // Save immediately on any significant change
        return of({
          shouldSave: true,
          timing: 'immediate',
          reason: 'aggressive mode - immediate save'
        });

      case 'normal': {
        // Save based on thresholds
        if (this._changeCount >= this._policy.changeThreshold || 
            timeSinceLastSave >= this._policy.timeThresholdMs) {
          return of({
            shouldSave: true,
            timing: 'immediate',
            reason: `normal mode - ${this._changeCount >= this._policy.changeThreshold ? 'change' : 'time'} threshold reached`
          });
        }
        
        // Schedule delayed save
        const delay = Math.min(
          this._policy.maxDelayMs,
          this._policy.timeThresholdMs - timeSinceLastSave
        );
        
        return of({
          shouldSave: true,
          timing: 'delayed',
          delay,
          reason: 'normal mode - scheduled save'
        });
      }

      case 'conservative': {
        // Only save after significant delay or many changes
        if (this._changeCount >= this._policy.changeThreshold * 2 || 
            timeSinceLastSave >= this._policy.timeThresholdMs * 2) {
          return of({
            shouldSave: true,
            timing: 'delayed',
            delay: this._policy.maxDelayMs,
            reason: 'conservative mode - threshold reached'
          });
        }
        return of({ shouldSave: false, reason: 'conservative mode - threshold not reached' });
      }

      default:
        return of({ shouldSave: false, reason: 'unknown policy mode' });
    }
  }

  private _executeSaveDecision(decision: any, context: AutoSaveContext): Observable<SaveResult | null> {
    if (decision.timing === 'immediate') {
      return this._executeSave(context, 'auto-immediate');
    } else if (decision.timing === 'delayed') {
      return this._scheduleDelayedSave(context, decision.delay || this._policy.maxDelayMs);
    }
    
    return of(null);
  }

  private _scheduleDelayedSave(context: AutoSaveContext, delayMs: number): Observable<SaveResult | null> {
    // Cancel any existing pending save
    this.cancelPendingSave();

    const saveId = uuid();
    const scheduledTime = new Date(Date.now() + delayMs);

    this.logger.debug('Scheduling delayed auto-save', {
      saveId,
      delayMs,
      scheduledTime: scheduledTime.toISOString()
    });

    // Create pending save
    this._pendingSave = {
      id: saveId,
      context,
      scheduledTime,
      timeout: setTimeout(() => {
        this._executePendingSave(saveId);
      }, delayMs)
    };

    this._updateState();

    // Emit event
    this._emitEvent({
      type: 'save-scheduled',
      context,
      scheduledTime,
      timestamp: Date.now()
    });

    return of(null); // Return null since save is scheduled, not executed
  }

  private _executePendingSave(saveId: string): void {
    if (!this._pendingSave || this._pendingSave.id !== saveId) {
      this.logger.debug('Pending save already cancelled or replaced', { saveId });
      return;
    }

    const context = this._pendingSave.context;
    this._pendingSave = null;
    this._updateState();

    this.logger.debug('Executing scheduled auto-save', { saveId });

    this._executeSave(context, 'auto-delayed').subscribe({
      next: result => {
        if (result.success) {
          this._stats.scheduledSaves++;
          this._lastSaveTime = new Date();
          this._changeCount = 0;
          this._updateState();
        }
      },
      error: error => {
        this.logger.error('Scheduled auto-save failed', { saveId, error });
      }
    });
  }

  private _executeSave(context: AutoSaveContext, saveType: string): Observable<SaveResult> {
    const saveOperation: SaveOperation = {
      diagramId: context.diagramId,
      data: context.diagramData,
      strategyType: context.preferredStrategy || 'websocket',
      metadata: {
        saveType,
        userId: context.userId,
        timestamp: Date.now(),
        changeCount: this._changeCount
      }
    };

    this._emitEvent({
      type: 'save-started',
      context,
      saveType,
      timestamp: Date.now()
    });

    return this.persistenceCoordinator.save(saveOperation).pipe(
      tap(result => {
        this._stats.totalSaves++;
        if (result.success) {
          this._stats.successfulSaves++;
          this._saveCompleted$.next(result);
          
          this._emitEvent({
            type: 'save-completed',
            context,
            result,
            timestamp: Date.now()
          });
        } else {
          this._stats.failedSaves++;
          this._saveFailed$.next({ error: result.error || 'Unknown error', context });
          
          this._emitEvent({
            type: 'save-failed',
            context,
            error: result.error || 'Unknown error',
            timestamp: Date.now()
          });
        }
      }),
      catchError(error => {
        this._stats.failedSaves++;
        const errorMessage = error?.message || String(error);
        this._saveFailed$.next({ error: errorMessage, context });
        
        this._emitEvent({
          type: 'save-failed',
          context,
          error: errorMessage,
          timestamp: Date.now()
        });
        
        return throwError(() => error);
      })
    );
  }

  private _handleTriggerError(event: AutoSaveTriggerEvent, context: AutoSaveContext, error: any): void {
    this.logger.error('AutoSave trigger processing failed', {
      triggerType: event.type,
      diagramId: context.diagramId,
      error: error?.message || String(error)
    });

    this._emitEvent({
      type: 'trigger-error',
      triggerEvent: event,
      context,
      error: error?.message || String(error),
      timestamp: Date.now()
    });
  }

  private _emitEvent(event: AutoSaveEvent): void {
    this._events$.next(event);
    
    // Notify all event handlers
    this._eventHandlers.forEach(handler => {
      try {
        handler.handleEvent(event);
      } catch (error) {
        this.logger.error('AutoSave event handler failed', { error });
      }
    });
  }

  private _updateState(): void {
    const state: AutoSaveState = {
      enabled: this._isEnabled,
      mode: this._policy.mode,
      pendingSave: this._pendingSave !== null,
      nextScheduledSave: this._pendingSave?.scheduledTime || null,
      lastSaveTime: this._lastSaveTime,
      changesSinceLastSave: this._changeCount,
      stats: { ...this._stats }
    };

    this._state$.next(state);
  }

  private _createInitialState(): AutoSaveState {
    return {
      enabled: this._isEnabled,
      mode: this._policy.mode,
      pendingSave: false,
      nextScheduledSave: null,
      lastSaveTime: null,
      changesSinceLastSave: 0,
      stats: this._createEmptyStats()
    };
  }

  private _createEmptyStats(): AutoSaveStats {
    return {
      totalSaves: 0,
      successfulSaves: 0,
      failedSaves: 0,
      manualSaves: 0,
      scheduledSaves: 0,
      forcedSaves: 0,
      triggersReceived: 0,
      averageResponseTime: 0,
      lastResetTime: new Date()
    };
  }

  private _initializeBuiltInComponents(): void {
    // TODO: Initialize built-in analyzers and decision makers
    // These would provide default behavior for change analysis and save decisions
    this.logger.debug('Built-in auto-save components initialized');
  }
}