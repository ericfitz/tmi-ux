import { Injectable } from '@angular/core';
import { Point } from '../../domain/value-objects/point';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Represents the state of a node during a drag operation
 */
export interface NodeDragState {
  readonly nodeId: string;
  readonly isDragging: boolean;
  readonly initialPosition: Point;
  readonly currentPosition: Point;
  readonly dragStartTime: number;
  readonly dragId: string;
  readonly suppressHistory: boolean;
}

/**
 * Service that manages drag state for nodes to enable clean undo/redo functionality.
 * Tracks when nodes are being dragged to suppress intermediate history entries
 * and only record clean before/after states.
 */
@Injectable({
  providedIn: 'root',
})
export class DragStateManagerService {
  private readonly _dragStates = new Map<string, NodeDragState>();

  constructor(private readonly _logger: LoggerService) {}

  /**
   * Start tracking a drag operation for a node
   */
  startDrag(nodeId: string, initialPosition: Point): string {
    const dragId = this._generateDragId(nodeId);
    const dragState: NodeDragState = {
      nodeId,
      isDragging: true,
      initialPosition,
      currentPosition: initialPosition,
      dragStartTime: Date.now(),
      dragId,
      suppressHistory: true,
    };

    this._dragStates.set(nodeId, dragState);

    this._logger.info('DRAG_START', {
      nodeId,
      dragId,
      initialPosition: { x: initialPosition.x, y: initialPosition.y },
      timestamp: dragState.dragStartTime,
    });

    return dragId;
  }

  /**
   * Update the current position during a drag operation
   */
  updateDragPosition(nodeId: string, currentPosition: Point): void {
    const dragState = this._dragStates.get(nodeId);
    if (!dragState || !dragState.isDragging) {
      return;
    }

    // Update the drag state with new position
    const updatedState: NodeDragState = {
      ...dragState,
      currentPosition,
    };

    this._dragStates.set(nodeId, updatedState);
  }

  /**
   * Complete a drag operation and return the final drag state
   */
  completeDrag(nodeId: string, finalPosition: Point): NodeDragState | null {
    const dragState = this._dragStates.get(nodeId);
    if (!dragState || !dragState.isDragging) {
      this._logger.warn('Attempted to complete drag for node not in drag state', { nodeId });
      return null;
    }

    const dragDuration = Date.now() - dragState.dragStartTime;
    const positionChanged = !dragState.initialPosition.equals(finalPosition);

    this._logger.info('DRAG_COMPLETE', {
      nodeId,
      dragId: dragState.dragId,
      initialPosition: { x: dragState.initialPosition.x, y: dragState.initialPosition.y },
      finalPosition: { x: finalPosition.x, y: finalPosition.y },
      positionDelta: {
        dx: finalPosition.x - dragState.initialPosition.x,
        dy: finalPosition.y - dragState.initialPosition.y,
      },
      dragDuration,
      positionChanged,
      historyWillBeRecorded: positionChanged,
    });

    // Create final state for return
    const finalState: NodeDragState = {
      ...dragState,
      isDragging: false,
      currentPosition: finalPosition,
      suppressHistory: false, // Allow history recording for completion
    };

    // Remove from active drag states
    this._dragStates.delete(nodeId);

    return finalState;
  }

  /**
   * Cancel a drag operation without recording history
   */
  cancelDrag(nodeId: string): void {
    const dragState = this._dragStates.get(nodeId);
    if (dragState) {
      this._logger.info('DRAG_CANCELLED', {
        nodeId,
        dragId: dragState.dragId,
        dragDuration: Date.now() - dragState.dragStartTime,
      });
      this._dragStates.delete(nodeId);
    }
  }

  /**
   * Check if a node is currently being dragged
   */
  isDragging(nodeId: string): boolean {
    const dragState = this._dragStates.get(nodeId);
    return dragState?.isDragging ?? false;
  }

  /**
   * Check if history should be suppressed for a node
   */
  shouldSuppressHistory(nodeId: string): boolean {
    const dragState = this._dragStates.get(nodeId);
    return dragState?.suppressHistory ?? false;
  }

  /**
   * Get the current drag state for a node
   */
  getDragState(nodeId: string): NodeDragState | null {
    return this._dragStates.get(nodeId) ?? null;
  }

  /**
   * Get all active drag states (for debugging)
   */
  getActiveDragStates(): ReadonlyArray<NodeDragState> {
    return Array.from(this._dragStates.values());
  }

  /**
   * Clear all drag states (for cleanup)
   */
  clearAllDragStates(): void {
    const activeDrags = this._dragStates.size;
    if (activeDrags > 0) {
      this._logger.warn('Clearing all drag states', { activeDragCount: activeDrags });
      this._dragStates.clear();
    }
  }

  /**
   * Generate a unique drag ID for tracking
   */
  private _generateDragId(nodeId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `drag_${nodeId}_${timestamp}_${random}`;
  }
}
