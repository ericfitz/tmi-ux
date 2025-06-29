import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { debounceTime, filter, map, shareReplay } from 'rxjs/operators';

import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { AnyCollaborationEvent } from '../../domain/collaboration/collaboration-events';

/**
 * Configuration for change batching behavior
 */
export interface ChangeBatchingConfig {
  /** Maximum time to wait before flushing a batch (milliseconds) */
  maxBatchDelay: number;
  /** Maximum number of changes in a single batch */
  maxBatchSize: number;
  /** Minimum time between batch flushes (milliseconds) */
  minFlushInterval: number;
  /** Whether to enable adaptive batching based on system load */
  enableAdaptiveBatching: boolean;
}

/**
 * Default configuration for change batching
 */
export const DEFAULT_BATCHING_CONFIG: ChangeBatchingConfig = {
  maxBatchDelay: 100, // 100ms max delay
  maxBatchSize: 50, // Max 50 changes per batch
  minFlushInterval: 16, // ~60fps minimum
  enableAdaptiveBatching: true,
};

/**
 * Represents a batch of changes to be processed together
 */
export interface ChangeBatch {
  id: string;
  commands: AnyDiagramCommand[];
  events: AnyCollaborationEvent[];
  timestamp: Date;
  priority: BatchPriority;
  metadata: {
    userIds: Set<string>;
    diagramIds: Set<string>;
    changeTypes: Set<string>;
  };
}

/**
 * Priority levels for change batches
 */
export enum BatchPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Performance metrics for batching operations
 */
export interface BatchingMetrics {
  totalBatches: number;
  totalChanges: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  droppedChanges: number;
  lastFlushTime: Date;
}

/**
 * Service for batching changes to improve performance and reduce overhead
 */
@Injectable({
  providedIn: 'root',
})
export class ChangeBatchingService {
  private readonly _config$ = new BehaviorSubject<ChangeBatchingConfig>(DEFAULT_BATCHING_CONFIG);
  private readonly _commandQueue$ = new Subject<AnyDiagramCommand>();
  private readonly _eventQueue$ = new Subject<AnyCollaborationEvent>();
  private readonly _batchReady$ = new Subject<ChangeBatch>();
  private readonly _metrics$ = new BehaviorSubject<BatchingMetrics>({
    totalBatches: 0,
    totalChanges: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    droppedChanges: 0,
    lastFlushTime: new Date(),
  });

  private _batchCounter = 0;
  private _pendingCommands: AnyDiagramCommand[] = [];
  private _pendingEvents: AnyCollaborationEvent[] = [];
  private _lastFlushTime = Date.now();
  private _processingTimes: number[] = [];

  /**
   * Observable for configuration changes
   */
  public readonly config$: Observable<ChangeBatchingConfig> = this._config$.asObservable();

  /**
   * Observable for ready batches
   */
  public readonly batchReady$: Observable<ChangeBatch> = this._batchReady$.asObservable();

  /**
   * Observable for performance metrics
   */
  public readonly metrics$: Observable<BatchingMetrics> = this._metrics$.pipe(shareReplay(1));

  constructor() {
    this._setupBatching();
  }

  /**
   * Add a command to the batching queue
   */
  addCommand(command: AnyDiagramCommand): void {
    this._commandQueue$.next(command);
  }

  /**
   * Add an event to the batching queue
   */
  addEvent(event: AnyCollaborationEvent): void {
    this._eventQueue$.next(event);
  }

  /**
   * Update batching configuration
   */
  updateConfig(config: Partial<ChangeBatchingConfig>): void {
    const currentConfig = this._config$.value;
    const newConfig = { ...currentConfig, ...config };
    this._config$.next(newConfig);
  }

  /**
   * Force flush all pending changes immediately
   */
  flushPending(): void {
    if (this._pendingCommands.length > 0 || this._pendingEvents.length > 0) {
      this._createAndEmitBatch(BatchPriority.HIGH);
    }
  }

  /**
   * Get current batching metrics
   */
  getMetrics(): BatchingMetrics {
    return this._metrics$.value;
  }

  /**
   * Clear all pending changes (useful for cleanup)
   */
  clearPending(): void {
    const droppedCount = this._pendingCommands.length + this._pendingEvents.length;
    this._pendingCommands = [];
    this._pendingEvents = [];

    if (droppedCount > 0) {
      this._updateMetrics({ droppedChanges: this._metrics$.value.droppedChanges + droppedCount });
    }
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.clearPending();
    this._config$.complete();
    this._commandQueue$.complete();
    this._eventQueue$.complete();
    this._batchReady$.complete();
    this._metrics$.complete();
  }

  /**
   * Setup the batching pipeline
   */
  private _setupBatching(): void {
    // Subscribe to commands
    this._commandQueue$.subscribe(command => {
      this._pendingCommands.push(command);
      this._checkBatchConditions();
    });

    // Subscribe to events
    this._eventQueue$.subscribe(event => {
      this._pendingEvents.push(event);
      this._checkBatchConditions();
    });

    // Setup time-based batching
    this._setupTimeBatching();
  }

  /**
   * Setup time-based batching using debounceTime
   */
  private _setupTimeBatching(): void {
    this._config$
      .pipe(
        map(config => config.maxBatchDelay),
        debounceTime(50), // Debounce config changes
      )
      .subscribe(maxDelay => {
        // Create a timer that triggers batch creation
        const timer$ = new Subject<void>();

        timer$
          .pipe(
            debounceTime(maxDelay),
            filter(() => this._pendingCommands.length > 0 || this._pendingEvents.length > 0),
          )
          .subscribe(() => {
            this._createAndEmitBatch(BatchPriority.NORMAL);
          });

        // Trigger timer when changes are added
        this._commandQueue$.subscribe(() => timer$.next());
        this._eventQueue$.subscribe(() => timer$.next());
      });
  }

  /**
   * Check if batch should be created based on current conditions
   */
  private _checkBatchConditions(): void {
    const config = this._config$.value;
    const totalPending = this._pendingCommands.length + this._pendingEvents.length;
    const timeSinceLastFlush = Date.now() - this._lastFlushTime;

    // Check size-based batching
    if (totalPending >= config.maxBatchSize) {
      this._createAndEmitBatch(BatchPriority.NORMAL);
      return;
    }

    // Check adaptive batching
    if (config.enableAdaptiveBatching) {
      const priority = this._calculateAdaptivePriority();
      if (priority >= BatchPriority.HIGH) {
        this._createAndEmitBatch(priority);
        return;
      }
    }

    // Check minimum flush interval
    if (timeSinceLastFlush >= config.minFlushInterval && totalPending > 0) {
      this._createAndEmitBatch(BatchPriority.LOW);
    }
  }

  /**
   * Calculate adaptive priority based on system conditions
   */
  private _calculateAdaptivePriority(): BatchPriority {
    const totalPending = this._pendingCommands.length + this._pendingEvents.length;
    const avgProcessingTime = this._getAverageProcessingTime();
    const timeSinceLastFlush = Date.now() - this._lastFlushTime;

    // High priority if processing is slow
    if (avgProcessingTime > 100) {
      return BatchPriority.HIGH;
    }

    // High priority if too many pending changes
    if (totalPending > 30) {
      return BatchPriority.HIGH;
    }

    // High priority if too much time has passed
    if (timeSinceLastFlush > 200) {
      return BatchPriority.HIGH;
    }

    // Normal priority for moderate conditions
    if (totalPending > 10 || timeSinceLastFlush > 50) {
      return BatchPriority.NORMAL;
    }

    return BatchPriority.LOW;
  }

  /**
   * Create and emit a batch from pending changes
   */
  private _createAndEmitBatch(priority: BatchPriority): void {
    if (this._pendingCommands.length === 0 && this._pendingEvents.length === 0) {
      return;
    }

    const startTime = performance.now();
    const batchId = this._generateBatchId();

    // Create metadata
    const userIds = new Set<string>();
    const diagramIds = new Set<string>();
    const changeTypes = new Set<string>();

    this._pendingCommands.forEach(cmd => {
      userIds.add(cmd.userId);
      diagramIds.add(cmd.diagramId);
      changeTypes.add(cmd.type);
    });

    this._pendingEvents.forEach(event => {
      changeTypes.add(event.type);
      // Extract additional metadata from events if available
    });

    const batch: ChangeBatch = {
      id: batchId,
      commands: [...this._pendingCommands],
      events: [...this._pendingEvents],
      timestamp: new Date(),
      priority,
      metadata: {
        userIds,
        diagramIds,
        changeTypes,
      },
    };

    // Clear pending changes
    const totalChanges = this._pendingCommands.length + this._pendingEvents.length;
    this._pendingCommands = [];
    this._pendingEvents = [];
    this._lastFlushTime = Date.now();

    // Record processing time
    const processingTime = performance.now() - startTime;
    this._processingTimes.push(processingTime);
    if (this._processingTimes.length > 100) {
      this._processingTimes.shift(); // Keep only last 100 measurements
    }

    // Update metrics
    this._updateMetrics({
      totalBatches: this._metrics$.value.totalBatches + 1,
      totalChanges: this._metrics$.value.totalChanges + totalChanges,
      averageBatchSize: this._calculateAverageBatchSize(totalChanges),
      averageProcessingTime: this._getAverageProcessingTime(),
      lastFlushTime: new Date(),
    });

    // Emit the batch
    this._batchReady$.next(batch);
  }

  /**
   * Generate a unique batch ID
   */
  private _generateBatchId(): string {
    return `batch_${Date.now()}_${++this._batchCounter}`;
  }

  /**
   * Calculate average batch size
   */
  private _calculateAverageBatchSize(currentBatchSize: number): number {
    const metrics = this._metrics$.value;
    const totalBatches = metrics.totalBatches + 1;
    const totalChanges = metrics.totalChanges + currentBatchSize;
    return totalChanges / totalBatches;
  }

  /**
   * Get average processing time
   */
  private _getAverageProcessingTime(): number {
    if (this._processingTimes.length === 0) {
      return 0;
    }
    const sum = this._processingTimes.reduce((acc, time) => acc + time, 0);
    return sum / this._processingTimes.length;
  }

  /**
   * Update metrics
   */
  private _updateMetrics(updates: Partial<BatchingMetrics>): void {
    const currentMetrics = this._metrics$.value;
    const newMetrics = { ...currentMetrics, ...updates };
    this._metrics$.next(newMetrics);
  }
}
