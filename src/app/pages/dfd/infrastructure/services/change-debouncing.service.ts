import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, filter, shareReplay } from 'rxjs/operators';

import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { Point } from '../../domain/value-objects/point';

/**
 * Configuration for debouncing behavior
 */
export interface DebouncingConfig {
  /** Default debounce time for most operations (milliseconds) */
  defaultDebounceTime: number;
  /** Debounce time for cursor movements (milliseconds) */
  cursorDebounceTime: number;
  /** Debounce time for node position updates (milliseconds) */
  positionDebounceTime: number;
  /** Debounce time for text input (milliseconds) */
  textInputDebounceTime: number;
  /** Debounce time for presence updates (milliseconds) */
  presenceDebounceTime: number;
  /** Whether to enable adaptive debouncing based on activity */
  enableAdaptiveDebouncing: boolean;
  /** Minimum debounce time (milliseconds) */
  minDebounceTime: number;
  /** Maximum debounce time (milliseconds) */
  maxDebounceTime: number;
}

/**
 * Default configuration for debouncing
 */
export const DEFAULT_DEBOUNCING_CONFIG: DebouncingConfig = {
  defaultDebounceTime: 100,
  cursorDebounceTime: 50,
  positionDebounceTime: 150,
  textInputDebounceTime: 300,
  presenceDebounceTime: 200,
  enableAdaptiveDebouncing: true,
  minDebounceTime: 16, // ~60fps
  maxDebounceTime: 1000,
};

/**
 * Types of operations that can be debounced
 */
export enum DebounceType {
  CURSOR_MOVEMENT = 'cursor_movement',
  NODE_POSITION = 'node_position',
  TEXT_INPUT = 'text_input',
  PRESENCE_UPDATE = 'presence_update',
  COMMAND_EXECUTION = 'command_execution',
  GENERIC = 'generic',
}

/**
 * Represents a debounced operation
 */
export interface DebouncedOperation<T = any> {
  id: string;
  type: DebounceType;
  data: T;
  timestamp: Date;
  key: string; // Used for grouping similar operations
}

/**
 * Cursor movement data
 */
export interface CursorMovementData {
  userId: string;
  position: Point;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isVisible: boolean;
}

/**
 * Node position update data
 */
export interface NodePositionData {
  diagramId: string;
  nodeId: string;
  position: Point;
  userId: string;
}

/**
 * Text input data
 */
export interface TextInputData {
  elementId: string;
  text: string;
  userId: string;
  cursorPosition?: number;
}

/**
 * Presence update data
 */
export interface PresenceUpdateData {
  userId: string;
  status: string;
  activity: string;
  lastSeen: Date;
}

/**
 * Performance metrics for debouncing operations
 */
export interface DebouncingMetrics {
  totalOperations: number;
  debouncedOperations: number;
  averageDebounceTime: number;
  operationsByType: Record<DebounceType, number>;
  lastOperationTime: Date;
}

/**
 * Service for debouncing rapid changes to improve performance
 */
@Injectable({
  providedIn: 'root',
})
export class ChangeDebouncingService {
  private readonly _config$ = new BehaviorSubject<DebouncingConfig>(DEFAULT_DEBOUNCING_CONFIG);
  private readonly _operations$ = new Subject<DebouncedOperation>();
  private readonly _metrics$ = new BehaviorSubject<DebouncingMetrics>({
    totalOperations: 0,
    debouncedOperations: 0,
    averageDebounceTime: 0,
    operationsByType: {
      [DebounceType.CURSOR_MOVEMENT]: 0,
      [DebounceType.NODE_POSITION]: 0,
      [DebounceType.TEXT_INPUT]: 0,
      [DebounceType.PRESENCE_UPDATE]: 0,
      [DebounceType.COMMAND_EXECUTION]: 0,
      [DebounceType.GENERIC]: 0,
    },
    lastOperationTime: new Date(),
  });

  private readonly _debouncedStreams = new Map<string, Observable<DebouncedOperation>>();
  private _operationCounter = 0;

  /**
   * Observable for configuration changes
   */
  public readonly config$: Observable<DebouncingConfig> = this._config$.asObservable();

  /**
   * Observable for performance metrics
   */
  public readonly metrics$: Observable<DebouncingMetrics> = this._metrics$.pipe(shareReplay(1));

  constructor() {
    this._setupDebouncedStreams();
  }

  /**
   * Debounce cursor movements
   */
  debounceCursorMovement(data: CursorMovementData): Observable<CursorMovementData> {
    const key = `cursor_${data.userId}`;
    return this._debounceOperation(DebounceType.CURSOR_MOVEMENT, data, key).pipe(
      map(op => op.data),
    );
  }

  /**
   * Debounce node position updates
   */
  debounceNodePosition(data: NodePositionData): Observable<NodePositionData> {
    const key = `position_${data.diagramId}_${data.nodeId}`;
    return this._debounceOperation(DebounceType.NODE_POSITION, data, key).pipe(map(op => op.data));
  }

  /**
   * Debounce text input
   */
  debounceTextInput(data: TextInputData): Observable<TextInputData> {
    const key = `text_${data.elementId}`;
    return this._debounceOperation(DebounceType.TEXT_INPUT, data, key).pipe(map(op => op.data));
  }

  /**
   * Debounce presence updates
   */
  debouncePresenceUpdate(data: PresenceUpdateData): Observable<PresenceUpdateData> {
    const key = `presence_${data.userId}`;
    return this._debounceOperation(DebounceType.PRESENCE_UPDATE, data, key).pipe(
      map(op => op.data),
    );
  }

  /**
   * Debounce command execution
   */
  debounceCommand(command: AnyDiagramCommand): Observable<AnyDiagramCommand> {
    const key = `command_${command.type}_${command.diagramId}`;
    return this._debounceOperation(DebounceType.COMMAND_EXECUTION, command, key).pipe(
      map(op => op.data),
    );
  }

  /**
   * Generic debounce operation
   */
  debounceGeneric<T>(data: T, key: string, customDebounceTime?: number): Observable<T> {
    return this._debounceOperation(DebounceType.GENERIC, data, key, customDebounceTime).pipe(
      map(op => op.data),
    );
  }

  /**
   * Update debouncing configuration
   */
  updateConfig(config: Partial<DebouncingConfig>): void {
    const currentConfig = this._config$.value;
    const newConfig = { ...currentConfig, ...config };
    this._config$.next(newConfig);
  }

  /**
   * Get current debouncing metrics
   */
  getMetrics(): DebouncingMetrics {
    return this._metrics$.value;
  }

  /**
   * Clear all debounced operations
   */
  clearAll(): void {
    this._debouncedStreams.clear();
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.clearAll();
    this._config$.complete();
    this._operations$.complete();
    this._metrics$.complete();
  }

  /**
   * Setup debounced streams for different operation types
   */
  private _setupDebouncedStreams(): void {
    // Setup streams for each debounce type
    Object.values(DebounceType).forEach(type => {
      this._createDebouncedStream(type);
    });
  }

  /**
   * Create a debounced stream for a specific operation type
   */
  private _createDebouncedStream(type: DebounceType): void {
    const config = this._config$.value;
    const debounceTimeMs = this._getDebounceTimeForType(type, config);

    const stream$ = this._operations$.pipe(
      filter(op => op.type === type),
      debounceTime(debounceTimeMs),
      distinctUntilChanged((prev, curr) => this._areOperationsEqual(prev, curr)),
      shareReplay(1),
    );

    this._debouncedStreams.set(type, stream$);
  }

  /**
   * Debounce a specific operation
   */
  private _debounceOperation<T>(
    type: DebounceType,
    data: T,
    key: string,
    customDebounceTime?: number,
  ): Observable<DebouncedOperation<T>> {
    const operation: DebouncedOperation<T> = {
      id: this._generateOperationId(),
      type,
      data,
      timestamp: new Date(),
      key,
    };

    // Update metrics
    this._updateMetrics(type);

    // Create or get debounced stream for this specific key
    const streamKey = `${type}_${key}`;
    let stream$ = this._debouncedStreams.get(streamKey);

    if (!stream$) {
      const config = this._config$.value;
      const debounceTimeMs = customDebounceTime || this._getDebounceTimeForType(type, config);
      const adaptiveDebounceTimeMs = config.enableAdaptiveDebouncing
        ? this._calculateAdaptiveDebounceTime(type, debounceTimeMs)
        : debounceTimeMs;

      stream$ = this._operations$.pipe(
        filter(op => op.type === type && op.key === key),
        debounceTime(adaptiveDebounceTimeMs),
        distinctUntilChanged((prev, curr) => this._areOperationsEqual(prev, curr)),
        shareReplay(1),
      );

      this._debouncedStreams.set(streamKey, stream$);
    }

    // Emit the operation
    this._operations$.next(operation);

    return stream$ as Observable<DebouncedOperation<T>>;
  }

  /**
   * Get debounce time for a specific operation type
   */
  private _getDebounceTimeForType(type: DebounceType, config: DebouncingConfig): number {
    switch (type) {
      case DebounceType.CURSOR_MOVEMENT:
        return config.cursorDebounceTime;
      case DebounceType.NODE_POSITION:
        return config.positionDebounceTime;
      case DebounceType.TEXT_INPUT:
        return config.textInputDebounceTime;
      case DebounceType.PRESENCE_UPDATE:
        return config.presenceDebounceTime;
      case DebounceType.COMMAND_EXECUTION:
      case DebounceType.GENERIC:
      default:
        return config.defaultDebounceTime;
    }
  }

  /**
   * Calculate adaptive debounce time based on system conditions
   */
  private _calculateAdaptiveDebounceTime(type: DebounceType, baseTime: number): number {
    const config = this._config$.value;
    const metrics = this._metrics$.value;

    // Increase debounce time if system is under heavy load
    const operationCount = metrics.operationsByType[type];
    const loadFactor = Math.min(operationCount / 100, 2); // Max 2x multiplier

    // Decrease debounce time for low activity
    const timeSinceLastOperation = Date.now() - metrics.lastOperationTime.getTime();
    const idleFactor = timeSinceLastOperation > 1000 ? 0.5 : 1; // 50% reduction if idle

    const adaptiveTime = baseTime * loadFactor * idleFactor;

    // Clamp to min/max bounds
    return Math.max(config.minDebounceTime, Math.min(config.maxDebounceTime, adaptiveTime));
  }

  /**
   * Check if two operations are equal (for distinctUntilChanged)
   */
  private _areOperationsEqual(prev: DebouncedOperation, curr: DebouncedOperation): boolean {
    if (prev.type !== curr.type || prev.key !== curr.key) {
      return false;
    }

    // Type-specific equality checks
    switch (prev.type) {
      case DebounceType.CURSOR_MOVEMENT:
        return this._areCursorMovementsEqual(
          prev.data as CursorMovementData,
          curr.data as CursorMovementData,
        );
      case DebounceType.NODE_POSITION:
        return this._areNodePositionsEqual(
          prev.data as NodePositionData,
          curr.data as NodePositionData,
        );
      case DebounceType.TEXT_INPUT:
        return this._areTextInputsEqual(prev.data as TextInputData, curr.data as TextInputData);
      case DebounceType.PRESENCE_UPDATE:
        return this._arePresenceUpdatesEqual(
          prev.data as PresenceUpdateData,
          curr.data as PresenceUpdateData,
        );
      default:
        return JSON.stringify(prev.data) === JSON.stringify(curr.data);
    }
  }

  /**
   * Check if cursor movements are equal
   */
  private _areCursorMovementsEqual(prev: CursorMovementData, curr: CursorMovementData): boolean {
    return (
      prev.userId === curr.userId &&
      prev.position.equals(curr.position) &&
      prev.isVisible === curr.isVisible &&
      JSON.stringify(prev.selectedNodeIds) === JSON.stringify(curr.selectedNodeIds) &&
      JSON.stringify(prev.selectedEdgeIds) === JSON.stringify(curr.selectedEdgeIds)
    );
  }

  /**
   * Check if node positions are equal
   */
  private _areNodePositionsEqual(prev: NodePositionData, curr: NodePositionData): boolean {
    return (
      prev.diagramId === curr.diagramId &&
      prev.nodeId === curr.nodeId &&
      prev.position.equals(curr.position) &&
      prev.userId === curr.userId
    );
  }

  /**
   * Check if text inputs are equal
   */
  private _areTextInputsEqual(prev: TextInputData, curr: TextInputData): boolean {
    return (
      prev.elementId === curr.elementId &&
      prev.text === curr.text &&
      prev.userId === curr.userId &&
      prev.cursorPosition === curr.cursorPosition
    );
  }

  /**
   * Check if presence updates are equal
   */
  private _arePresenceUpdatesEqual(prev: PresenceUpdateData, curr: PresenceUpdateData): boolean {
    return (
      prev.userId === curr.userId && prev.status === curr.status && prev.activity === curr.activity
    );
  }

  /**
   * Generate a unique operation ID
   */
  private _generateOperationId(): string {
    return `op_${Date.now()}_${++this._operationCounter}`;
  }

  /**
   * Update metrics
   */
  private _updateMetrics(type: DebounceType): void {
    const currentMetrics = this._metrics$.value;
    const newMetrics: DebouncingMetrics = {
      ...currentMetrics,
      totalOperations: currentMetrics.totalOperations + 1,
      operationsByType: {
        ...currentMetrics.operationsByType,
        [type]: currentMetrics.operationsByType[type] + 1,
      },
      lastOperationTime: new Date(),
    };

    this._metrics$.next(newMetrics);
  }
}
