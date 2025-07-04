// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DragStateManagerService } from './drag-state-manager.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { Point } from '../../domain/value-objects/point';

describe('DragStateManagerService', () => {
  let service: DragStateManagerService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create the service directly without TestBed
    service = new DragStateManagerService(mockLogger as unknown as LoggerService);
  });

  describe('Drag State Management', () => {
    it('should initialize with no active drags', () => {
      expect(service.isDragging('node-1')).toBe(false);
      expect(service.getActiveDragStates()).toHaveLength(0);
    });

    it('should start a drag and track state correctly', () => {
      const nodeId = 'node-1';
      const initialPosition = new Point(100, 200);

      const dragId = service.startDrag(nodeId, initialPosition);

      expect(service.isDragging(nodeId)).toBe(true);
      expect(service.shouldSuppressHistory(nodeId)).toBe(true);
      expect(service.getActiveDragStates()).toHaveLength(1);
      expect(dragId).toMatch(/^drag_node-1_\d+_[a-z0-9]+$/);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DRAG_START',
        expect.objectContaining({
          nodeId,
          dragId,
          initialPosition: { x: 100, y: 200 },
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should update drag position during drag', () => {
      const nodeId = 'node-1';
      const initialPosition = new Point(100, 200);
      const newPosition = new Point(150, 250);

      service.startDrag(nodeId, initialPosition);
      service.updateDragPosition(nodeId, newPosition);

      const dragState = service.getDragState(nodeId);
      expect(dragState).toBeDefined();
      expect(dragState?.currentPosition.x).toBe(150);
      expect(dragState?.currentPosition.y).toBe(250);
      expect(dragState?.initialPosition.x).toBe(100);
      expect(dragState?.initialPosition.y).toBe(200);
    });

    it('should complete a drag and return final state', () => {
      const nodeId = 'node-1';
      const initialPosition = new Point(100, 200);
      const finalPosition = new Point(150, 250);

      const dragId = service.startDrag(nodeId, initialPosition);
      const finalState = service.completeDrag(nodeId, finalPosition);

      expect(service.isDragging(nodeId)).toBe(false);
      expect(service.getActiveDragStates()).toHaveLength(0);
      expect(finalState).toBeDefined();
      expect(finalState?.nodeId).toBe(nodeId);
      expect(finalState?.dragId).toBe(dragId);
      expect(finalState?.isDragging).toBe(false);
      expect(finalState?.suppressHistory).toBe(false);
      expect(finalState?.currentPosition.equals(finalPosition)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DRAG_COMPLETE',
        expect.objectContaining({
          nodeId,
          dragId,
          initialPosition: { x: 100, y: 200 },
          finalPosition: { x: 150, y: 250 },
          positionDelta: { dx: 50, dy: 50 },
          dragDuration: expect.any(Number),
          positionChanged: true,
          historyWillBeRecorded: true,
        }),
      );
    });

    it('should handle completing non-existent drag gracefully', () => {
      const nodeId = 'non-existent';
      const finalPosition = new Point(150, 250);

      const result = service.completeDrag(nodeId, finalPosition);

      expect(result).toBeNull();
      expect(service.isDragging(nodeId)).toBe(false);
      expect(service.getActiveDragStates()).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to complete drag for node not in drag state',
        { nodeId },
      );
    });

    it('should handle multiple concurrent drags', () => {
      const node1 = 'node-1';
      const node2 = 'node-2';
      const position1 = new Point(100, 200);
      const position2 = new Point(300, 400);

      // Start multiple drags
      service.startDrag(node1, position1);
      service.startDrag(node2, position2);

      expect(service.isDragging(node1)).toBe(true);
      expect(service.isDragging(node2)).toBe(true);
      expect(service.getActiveDragStates()).toHaveLength(2);

      // Complete one drag
      service.completeDrag(node1, new Point(150, 250));

      expect(service.isDragging(node1)).toBe(false);
      expect(service.isDragging(node2)).toBe(true);
      expect(service.getActiveDragStates()).toHaveLength(1);

      // Complete second drag
      service.completeDrag(node2, new Point(350, 450));

      expect(service.isDragging(node1)).toBe(false);
      expect(service.isDragging(node2)).toBe(false);
      expect(service.getActiveDragStates()).toHaveLength(0);
    });

    it('should cancel a drag operation', () => {
      const nodeId = 'node-1';
      const position = new Point(100, 200);

      const dragId = service.startDrag(nodeId, position);
      expect(service.isDragging(nodeId)).toBe(true);

      service.cancelDrag(nodeId);

      expect(service.isDragging(nodeId)).toBe(false);
      expect(service.getActiveDragStates()).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DRAG_CANCELLED',
        expect.objectContaining({
          nodeId,
          dragId,
          dragDuration: expect.any(Number),
        }),
      );
    });

    it('should generate unique drag IDs', () => {
      const node1 = 'node-1';
      const node2 = 'node-2';
      const position = new Point(100, 200);

      const dragId1 = service.startDrag(node1, position);
      const dragId2 = service.startDrag(node2, position);

      expect(dragId1).toBeDefined();
      expect(dragId2).toBeDefined();
      expect(dragId1).not.toBe(dragId2);
    });

    it('should clear all drag states', () => {
      const node1 = 'node-1';
      const node2 = 'node-2';
      const position = new Point(100, 200);

      service.startDrag(node1, position);
      service.startDrag(node2, position);
      expect(service.getActiveDragStates()).toHaveLength(2);

      service.clearAllDragStates();

      expect(service.getActiveDragStates()).toHaveLength(0);
      expect(service.isDragging(node1)).toBe(false);
      expect(service.isDragging(node2)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Clearing all drag states', {
        activeDragCount: 2,
      });
    });

    it('should handle position changes that result in no movement', () => {
      const nodeId = 'node-1';
      const position = new Point(100, 200);

      service.startDrag(nodeId, position);
      const finalState = service.completeDrag(nodeId, position); // Same position

      expect(finalState).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DRAG_COMPLETE',
        expect.objectContaining({
          positionChanged: false,
          historyWillBeRecorded: false,
          positionDelta: { dx: 0, dy: 0 },
        }),
      );
    });

    it('should ignore position updates for non-dragging nodes', () => {
      const nodeId = 'node-1';
      const position = new Point(100, 200);

      // Try to update position without starting drag
      service.updateDragPosition(nodeId, position);

      expect(service.getDragState(nodeId)).toBeNull();
      expect(service.isDragging(nodeId)).toBe(false);
    });

    it('should return null for drag state of non-dragging node', () => {
      const nodeId = 'node-1';

      expect(service.getDragState(nodeId)).toBeNull();
      expect(service.shouldSuppressHistory(nodeId)).toBe(false);
    });
  });
});
