import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import { Point } from '../../domain/value-objects/point';

/**
 * Service that filters X6 events at the source to prevent unnecessary processing
 * of intermediate events that don't represent meaningful state changes.
 */
@Injectable({
  providedIn: 'root',
})
export class EventFilterService {
  // Track last significant events to filter out noise
  private readonly _lastSignificantResize = new Map<
    string,
    { width: number; height: number; timestamp: number }
  >();
  private readonly _lastSignificantDataChange = new Map<
    string,
    { data: Record<string, unknown>; timestamp: number }
  >();
  private readonly _lastSignificantVertexChange = new Map<
    string,
    { vertices: Array<{ x: number; y: number }>; timestamp: number }
  >();

  // Minimum thresholds for considering changes significant (increased to reduce noise)
  private readonly _resizeThreshold = 10; // pixels (increased from 5)
  private readonly _dataChangeDebounceMs = 500; // milliseconds (increased from 100)
  private readonly _vertexChangeThreshold = 5; // pixels (increased from 2)

  constructor(private readonly _logger: LoggerService) {}

  /**
   * Determines if a drag position event should be processed
   * Only allows start and end positions, filters intermediate positions
   */
  shouldProcessDragPosition(
    nodeId: string,
    position: Point,
    isDragStart: boolean,
    isDragEnd: boolean,
  ): boolean {
    // Always process drag start and end events
    if (isDragStart || isDragEnd) {
      this._logger.debug('Processing drag position - start/end event', {
        nodeId,
        position: { x: position.x, y: position.y },
        isDragStart,
        isDragEnd,
      });
      return true;
    }

    // Filter out intermediate drag positions
    this._logger.debug('Filtering intermediate drag position', {
      nodeId,
      position: { x: position.x, y: position.y },
      reason: 'intermediate_position',
    });
    return false;
  }

  /**
   * Determines if a node resize event should be processed
   * Filters out minor size changes that don't represent significant user actions
   */
  shouldProcessNodeResize(
    nodeId: string,
    newWidth: number,
    newHeight: number,
    oldWidth: number,
    oldHeight: number,
  ): boolean {
    const widthDelta = Math.abs(newWidth - oldWidth);
    const heightDelta = Math.abs(newHeight - oldHeight);

    // Check if the change is significant enough
    if (widthDelta < this._resizeThreshold && heightDelta < this._resizeThreshold) {
      this._logger.debug('Filtering insignificant resize event', {
        nodeId,
        widthDelta,
        heightDelta,
        threshold: this._resizeThreshold,
      });
      return false;
    }

    // Check against last significant resize to prevent duplicate processing
    const lastResize = this._lastSignificantResize.get(nodeId);
    if (lastResize) {
      const timeSinceLastResize = Date.now() - lastResize.timestamp;
      if (
        timeSinceLastResize < 1000 && // Within 1000ms (increased from 200ms)
        Math.abs(newWidth - lastResize.width) < this._resizeThreshold &&
        Math.abs(newHeight - lastResize.height) < this._resizeThreshold
      ) {
        this._logger.debug('Filtering duplicate resize event', {
          nodeId,
          timeSinceLastResize,
          reason: 'duplicate_within_threshold',
        });
        return false;
      }
    }

    // Update last significant resize
    this._lastSignificantResize.set(nodeId, {
      width: newWidth,
      height: newHeight,
      timestamp: Date.now(),
    });

    this._logger.debug('Processing significant resize event', {
      nodeId,
      newSize: { width: newWidth, height: newHeight },
      oldSize: { width: oldWidth, height: oldHeight },
      widthDelta,
      heightDelta,
    });

    return true;
  }

  /**
   * Determines if a node data change event should be processed
   * Filters out rapid successive changes and meaningless updates
   */
  shouldProcessNodeDataChange(
    nodeId: string,
    newData: Record<string, unknown>,
    oldData: Record<string, unknown>,
  ): boolean {
    // Check if data actually changed
    if (this._isDataEqual(newData, oldData)) {
      this._logger.debug('Filtering unchanged data event', {
        nodeId,
        reason: 'no_actual_change',
      });
      return false;
    }

    // Check against last significant data change to prevent rapid successive updates
    const lastDataChange = this._lastSignificantDataChange.get(nodeId);
    if (lastDataChange) {
      const timeSinceLastChange = Date.now() - lastDataChange.timestamp;
      if (timeSinceLastChange < this._dataChangeDebounceMs) {
        this._logger.debug('Filtering rapid successive data change', {
          nodeId,
          timeSinceLastChange,
          debounceMs: this._dataChangeDebounceMs,
        });
        return false;
      }
    }

    // Update last significant data change
    this._lastSignificantDataChange.set(nodeId, {
      data: { ...newData },
      timestamp: Date.now(),
    });

    this._logger.debug('Processing significant data change event', {
      nodeId,
      newData,
      oldData,
    });

    return true;
  }

  /**
   * Determines if an edge vertex change event should be processed
   * Filters out minor vertex movements that don't represent significant changes
   */
  shouldProcessEdgeVertexChange(
    edgeId: string,
    newVertices: Array<{ x: number; y: number }>,
  ): boolean {
    // Check against last significant vertex change
    const lastVertexChange = this._lastSignificantVertexChange.get(edgeId);
    if (lastVertexChange) {
      // Check if vertices changed significantly
      if (this._areVerticesSimilar(newVertices, lastVertexChange.vertices)) {
        this._logger.debug('Filtering insignificant vertex change', {
          edgeId,
          reason: 'vertices_too_similar',
          threshold: this._vertexChangeThreshold,
        });
        return false;
      }

      const timeSinceLastChange = Date.now() - lastVertexChange.timestamp;
      if (timeSinceLastChange < 500) {
        // 500ms debounce for vertex changes (increased from 100ms)
        this._logger.debug('Filtering rapid successive vertex change', {
          edgeId,
          timeSinceLastChange,
        });
        return false;
      }
    }

    // Update last significant vertex change
    this._lastSignificantVertexChange.set(edgeId, {
      vertices: newVertices.map(v => ({ x: v.x, y: v.y })),
      timestamp: Date.now(),
    });

    this._logger.debug('Processing significant vertex change event', {
      edgeId,
      vertexCount: newVertices.length,
    });

    return true;
  }

  /**
   * Clears cached filter state for a specific node (used when node is removed)
   */
  clearNodeFilterState(nodeId: string): void {
    this._lastSignificantResize.delete(nodeId);
    this._lastSignificantDataChange.delete(nodeId);
    this._logger.debug('Cleared filter state for node', { nodeId });
  }

  /**
   * Clears cached filter state for a specific edge (used when edge is removed)
   */
  clearEdgeFilterState(edgeId: string): void {
    this._lastSignificantVertexChange.delete(edgeId);
    this._logger.debug('Cleared filter state for edge', { edgeId });
  }

  /**
   * Clears all cached filter state
   */
  clearAllFilterState(): void {
    this._lastSignificantResize.clear();
    this._lastSignificantDataChange.clear();
    this._lastSignificantVertexChange.clear();
    this._logger.debug('Cleared all filter state');
  }

  /**
   * Compares two data objects for equality (shallow comparison)
   */
  private _isDataEqual(data1: Record<string, unknown>, data2: Record<string, unknown>): boolean {
    const keys1 = Object.keys(data1);
    const keys2 = Object.keys(data2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (data1[key] !== data2[key]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compares two vertex arrays to determine if they're similar enough to filter
   */
  private _areVerticesSimilar(
    vertices1: Array<{ x: number; y: number }>,
    vertices2: Array<{ x: number; y: number }>,
  ): boolean {
    if (vertices1.length !== vertices2.length) {
      return false;
    }

    for (let i = 0; i < vertices1.length; i++) {
      const v1 = vertices1[i];
      const v2 = vertices2[i];
      const distance = Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));

      if (distance > this._vertexChangeThreshold) {
        return false;
      }
    }

    return true;
  }
}
