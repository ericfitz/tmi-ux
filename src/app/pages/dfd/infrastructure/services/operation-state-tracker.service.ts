import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  IOperationStateTracker,
  OperationType,
  OperationState,
  OperationData,
  HistoryConfig,
} from '../../domain/history/history.types';

/**
 * Service for tracking operation lifecycle and determining when operations reach final state.
 * This is crucial for the history service to know when to record commands.
 */
@Injectable({
  providedIn: 'root',
})
export class OperationStateTracker implements IOperationStateTracker {
  private readonly _operations = new Map<string, OperationState>();
  private readonly _config: HistoryConfig = {
    maxHistorySize: 100,
    cleanupThreshold: 80,
    enableCollaboration: false,
    operationTimeout: 5000, // 5 seconds
  };

  constructor(private readonly _logger: LoggerService) {
    // Start cleanup timer
    this._startCleanupTimer();
  }

  /**
   * Starts a new operation tracking
   */
  startOperation(operationId: string, type: OperationType, data?: OperationData): void {
    try {
      const operation: OperationState = {
        id: operationId,
        type,
        startTime: Date.now(),
        isActive: true,
        isFinal: false,
        data: data || {},
      };

      this._operations.set(operationId, operation);
      this._logger.debug('Operation started', { operationId, type });
    } catch (error) {
      this._logger.error('Failed to start operation', { operationId, type, error });
    }
  }

  /**
   * Updates an existing operation with new data
   */
  updateOperation(operationId: string, data: Partial<OperationData>): void {
    try {
      const operation = this._operations.get(operationId);
      if (!operation) {
        this._logger.warn('Attempted to update non-existent operation', { operationId });
        return;
      }

      if (!operation.isActive) {
        this._logger.warn('Attempted to update inactive operation', { operationId });
        return;
      }

      const updatedOperation: OperationState = {
        ...operation,
        data: { ...operation.data, ...data },
      };

      this._operations.set(operationId, updatedOperation);
      this._logger.debug('Operation updated', { operationId, data });
    } catch (error) {
      this._logger.error('Failed to update operation', { operationId, data, error });
    }
  }

  /**
   * Marks an operation as completed and determines if it's in final state
   */
  completeOperation(operationId: string): void {
    try {
      const operation = this._operations.get(operationId);
      if (!operation) {
        this._logger.warn('Attempted to complete non-existent operation', { operationId });
        return;
      }

      const isFinal = this._determineFinalState(operation);
      const completedOperation: OperationState = {
        ...operation,
        isActive: false,
        isFinal,
      };

      this._operations.set(operationId, completedOperation);
      this._logger.debug('Operation completed', { operationId, isFinal });

      // Schedule cleanup for completed operation
      setTimeout(() => {
        this._operations.delete(operationId);
        this._logger.debug('Operation cleaned up', { operationId });
      }, this._config.operationTimeout);
    } catch (error) {
      this._logger.error('Failed to complete operation', { operationId, error });
    }
  }

  /**
   * Cancels an operation
   */
  cancelOperation(operationId: string): void {
    try {
      const operation = this._operations.get(operationId);
      if (!operation) {
        this._logger.warn('Attempted to cancel non-existent operation', { operationId });
        return;
      }

      const cancelledOperation: OperationState = {
        ...operation,
        isActive: false,
        isFinal: false, // Cancelled operations are never final
      };

      this._operations.set(operationId, cancelledOperation);
      this._logger.debug('Operation cancelled', { operationId });

      // Schedule cleanup for cancelled operation
      setTimeout(() => {
        this._operations.delete(operationId);
        this._logger.debug('Cancelled operation cleaned up', { operationId });
      }, 1000); // Shorter cleanup time for cancelled operations
    } catch (error) {
      this._logger.error('Failed to cancel operation', { operationId, error });
    }
  }

  /**
   * Checks if an operation is currently active
   */
  isOperationActive(operationId: string): boolean {
    const operation = this._operations.get(operationId);
    return operation?.isActive ?? false;
  }

  /**
   * Gets the current state of an operation
   */
  getOperationState(operationId: string): OperationState | null {
    return this._operations.get(operationId) ?? null;
  }

  /**
   * Determines if an operation is in final state and should be recorded in history
   */
  isFinalState(operationId: string): boolean {
    const operation = this._operations.get(operationId);
    return operation?.isFinal ?? false;
  }

  /**
   * Cleans up expired operations
   */
  cleanupExpiredOperations(): void {
    try {
      const now = Date.now();
      const expiredOperations: string[] = [];

      for (const [operationId, operation] of this._operations.entries()) {
        const age = now - operation.startTime;
        if (age > this._config.operationTimeout) {
          expiredOperations.push(operationId);
        }
      }

      for (const operationId of expiredOperations) {
        this._operations.delete(operationId);
        this._logger.debug('Expired operation cleaned up', { operationId });
      }

      if (expiredOperations.length > 0) {
        this._logger.info('Cleaned up expired operations', { count: expiredOperations.length });
      }
    } catch (error) {
      this._logger.error('Failed to cleanup expired operations', { error });
    }
  }

  /**
   * Determines if an operation has reached its final state based on operation type and data
   */
  private _determineFinalState(operation: OperationState): boolean {
    try {
      switch (operation.type) {
        case OperationType.DRAG:
          // Drag operations are final when the drag ends (no intermediate positions)
          return true;

        case OperationType.RESIZE:
          // Resize operations are final when resizing ends
          return true;

        case OperationType.EDIT_LABEL:
          // Label editing is final when editing completes
          return true;

        case OperationType.EDIT_VERTICES:
          // Vertex editing is final when editing completes
          return true;

        case OperationType.ADD_NODE:
        case OperationType.ADD_EDGE:
        case OperationType.DELETE:
          // Creation and deletion operations are always final
          return true;

        case OperationType.UPDATE_DATA:
        case OperationType.UPDATE_POSITION:
          // Update operations are final when they complete
          return true;

        case OperationType.BATCH:
          // Batch operations are final when all sub-operations complete
          return true;

        default:
          this._logger.warn('Unknown operation type for final state determination', {
            operationId: operation.id,
            type: operation.type,
          });
          return true; // Default to final to avoid losing operations
      }
    } catch (error) {
      this._logger.error('Failed to determine final state', {
        operationId: operation.id,
        error,
      });
      return true; // Default to final to avoid losing operations
    }
  }

  /**
   * Starts the periodic cleanup timer
   */
  private _startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredOperations();
    }, this._config.operationTimeout);
  }
}
