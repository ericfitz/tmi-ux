import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { OperationStateTracker } from './operation-state-tracker.service';
import { OperationType } from '../../domain/history/history.types';
import { Point } from '../../domain/value-objects/point';

/**
 * Represents a completed operation that should trigger command creation
 */
export interface OperationCompletedEvent {
  operationId: string;
  operationType: OperationType;
  entityId: string;
  entityType: 'node' | 'edge';
  data: OperationData;
  metadata?: Record<string, string>;
}

/**
 * Union type for different operation data types
 */
export type OperationData =
  | NodePositionOperationData
  | NodeResizeOperationData
  | NodeDataOperationData
  | EdgeVertexOperationData;

export interface NodePositionOperationData {
  type: 'position';
  initialPosition: Point;
  finalPosition: Point;
  dragId?: string;
  dragDuration?: number;
}

export interface NodeResizeOperationData {
  type: 'resize';
  oldWidth: number;
  oldHeight: number;
  newWidth: number;
  newHeight: number;
}

export interface NodeDataOperationData {
  type: 'data';
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
}

export interface EdgeVertexOperationData {
  type: 'vertices';
  oldVertices: Array<{ x: number; y: number }>;
  newVertices: Array<{ x: number; y: number }>;
}

/**
 * Service that coordinates operations based on their lifecycle rather than timers.
 * Manages operation dependencies and prevents overlapping operations on the same entities.
 */
@Injectable({
  providedIn: 'root',
})
export class OperationCoordinatorService {
  private readonly _operationCompleted$ = new Subject<OperationCompletedEvent>();
  private readonly _activeOperations = new Map<
    string,
    {
      operationId: string;
      entityId: string;
      entityType: 'node' | 'edge';
      operationType: OperationType;
      startTime: number;
      data?: Partial<OperationData>;
    }
  >();

  // Track entity locks to prevent conflicting operations
  private readonly _entityLocks = new Map<string, string>(); // entityId -> operationId

  constructor(
    private readonly _logger: LoggerService,
    private readonly _operationTracker: OperationStateTracker,
  ) {}

  /**
   * Observable for operation completion events
   */
  get operationCompleted$(): Observable<OperationCompletedEvent> {
    return this._operationCompleted$.asObservable();
  }

  /**
   * Starts a new operation and returns the operation ID
   * Prevents conflicting operations on the same entity
   */
  startOperation(
    entityId: string,
    entityType: 'node' | 'edge',
    operationType: OperationType,
    initialData?: Partial<OperationData>,
  ): string | null {
    // Check if entity is already locked by another operation
    const existingLock = this._entityLocks.get(entityId);
    if (existingLock) {
      const existingOperation = this._activeOperations.get(existingLock);
      if (existingOperation) {
        this._logger.debug('Entity locked by existing operation', {
          entityId,
          entityType,
          requestedOperationType: operationType,
          existingOperationId: existingLock,
          existingOperationType: existingOperation.operationType,
        });
        return null; // Operation cannot start due to conflict
      } else {
        // Clean up stale lock
        this._entityLocks.delete(entityId);
      }
    }

    // Generate operation ID
    const operationId = this._generateOperationId(operationType, entityId);

    // Start operation tracking
    this._operationTracker.startOperation(operationId, operationType, {
      entityId,
      entityType,
      metadata: { coordinatedOperation: 'true' },
    });

    // Track active operation
    this._activeOperations.set(operationId, {
      operationId,
      entityId,
      entityType,
      operationType,
      startTime: Date.now(),
      data: initialData,
    });

    // Lock entity
    this._entityLocks.set(entityId, operationId);

    this._logger.debug('Started coordinated operation', {
      operationId,
      entityId,
      entityType,
      operationType,
      hasInitialData: !!initialData,
    });

    return operationId;
  }

  /**
   * Updates operation data (used to accumulate data during operation lifecycle)
   */
  updateOperationData(operationId: string, data: Partial<OperationData>): void {
    const operation = this._activeOperations.get(operationId);
    if (!operation) {
      this._logger.warn('Attempted to update non-existent operation', { operationId });
      return;
    }

    // Merge new data with existing data
    operation.data = { ...operation.data, ...data };

    this._logger.debug('Updated operation data', {
      operationId,
      entityId: operation.entityId,
      updatedData: data,
    });
  }

  /**
   * Completes an operation and emits the completion event
   */
  completeOperation(operationId: string, finalData: OperationData): void {
    const operation = this._activeOperations.get(operationId);
    if (!operation) {
      this._logger.warn('Attempted to complete non-existent operation', { operationId });
      return;
    }

    // Complete operation tracking
    this._operationTracker.completeOperation(operationId);

    // Merge final data with accumulated data
    const completeData = { ...operation.data, ...finalData } as OperationData;

    // Create completion event
    const completionEvent: OperationCompletedEvent = {
      operationId,
      operationType: operation.operationType,
      entityId: operation.entityId,
      entityType: operation.entityType,
      data: completeData,
      metadata: {
        duration: (Date.now() - operation.startTime).toString(),
      },
    };

    // Clean up
    this._activeOperations.delete(operationId);
    this._entityLocks.delete(operation.entityId);

    this._logger.info('Completed coordinated operation', {
      operationId,
      entityId: operation.entityId,
      operationType: operation.operationType,
      duration: Date.now() - operation.startTime,
    });

    // Emit completion event
    this._operationCompleted$.next(completionEvent);
  }

  /**
   * Cancels an operation without emitting completion event
   */
  cancelOperation(operationId: string, reason?: string): void {
    const operation = this._activeOperations.get(operationId);
    if (!operation) {
      this._logger.warn('Attempted to cancel non-existent operation', { operationId, reason });
      return;
    }

    // Cancel operation tracking
    this._operationTracker.cancelOperation(operationId);

    // Clean up
    this._activeOperations.delete(operationId);
    this._entityLocks.delete(operation.entityId);

    this._logger.info('Cancelled coordinated operation', {
      operationId,
      entityId: operation.entityId,
      operationType: operation.operationType,
      reason: reason || 'unspecified',
    });
  }

  /**
   * Checks if an entity is currently locked by an operation
   */
  isEntityLocked(entityId: string): boolean {
    return this._entityLocks.has(entityId);
  }

  /**
   * Gets the operation ID that has locked an entity (if any)
   */
  getEntityLockingOperation(entityId: string): string | null {
    return this._entityLocks.get(entityId) || null;
  }

  /**
   * Gets information about an active operation
   */
  getOperationInfo(operationId: string): {
    operationId: string;
    entityId: string;
    entityType: 'node' | 'edge';
    operationType: OperationType;
    startTime: number;
    duration: number;
  } | null {
    const operation = this._activeOperations.get(operationId);
    if (!operation) {
      return null;
    }

    return {
      operationId: operation.operationId,
      entityId: operation.entityId,
      entityType: operation.entityType,
      operationType: operation.operationType,
      startTime: operation.startTime,
      duration: Date.now() - operation.startTime,
    };
  }

  /**
   * Gets all active operations (for debugging)
   */
  getActiveOperations(): Array<{
    operationId: string;
    entityId: string;
    entityType: 'node' | 'edge';
    operationType: OperationType;
    duration: number;
  }> {
    const now = Date.now();
    return Array.from(this._activeOperations.values()).map(op => ({
      operationId: op.operationId,
      entityId: op.entityId,
      entityType: op.entityType,
      operationType: op.operationType,
      duration: now - op.startTime,
    }));
  }

  /**
   * Cleans up stale operations (operations that have been active too long)
   */
  cleanupStaleOperations(maxAgeMs: number = 30000): void {
    const now = Date.now();
    const staleOperations: string[] = [];

    for (const [operationId, operation] of this._activeOperations.entries()) {
      if (now - operation.startTime > maxAgeMs) {
        staleOperations.push(operationId);
      }
    }

    for (const operationId of staleOperations) {
      this._logger.warn('Cleaning up stale operation', {
        operationId,
        age: now - this._activeOperations.get(operationId)!.startTime,
        maxAge: maxAgeMs,
      });
      this.cancelOperation(operationId, 'stale_operation_cleanup');
    }

    if (staleOperations.length > 0) {
      this._logger.info('Cleaned up stale operations', {
        count: staleOperations.length,
        maxAge: maxAgeMs,
      });
    }
  }

  /**
   * Clears all active operations (used during cleanup/reset)
   */
  clearAllOperations(): void {
    const operationIds = Array.from(this._activeOperations.keys());

    for (const operationId of operationIds) {
      this.cancelOperation(operationId, 'clear_all_operations');
    }

    this._logger.info('Cleared all active operations', {
      count: operationIds.length,
    });
  }

  /**
   * Generates a unique operation ID
   */
  private _generateOperationId(type: OperationType, entityId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `coord_${type}_${entityId}_${timestamp}_${random}`;
  }
}
