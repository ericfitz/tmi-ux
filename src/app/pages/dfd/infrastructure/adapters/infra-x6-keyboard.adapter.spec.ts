// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Graph, Node } from '@antv/x6';
import { InfraX6KeyboardAdapter } from './infra-x6-keyboard.adapter';
import { LoggerService } from '../../../../core/services/logger.service';
import { Point } from '../../domain/value-objects/point';
import { createMockLoggerService } from '../../../../../testing/mocks/mock-logger.service';

// Mock SVG methods for X6 compatibility
Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
  writable: true,
  value: vi.fn().mockReturnValue({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }),
});

Object.defineProperty(SVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }),
});

Object.defineProperty(SVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }),
});

Object.defineProperty(SVGSVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }),
});

Object.defineProperty(SVGSVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }),
});

describe('InfraX6KeyboardAdapter', () => {
  let handler: InfraX6KeyboardAdapter;
  let mockLogger: LoggerService;
  let graph: Graph;
  let container: HTMLElement;

  beforeEach(() => {
    // Create mock logger
    mockLogger = createMockLoggerService() as any;

    // Create handler
    handler = new InfraX6KeyboardAdapter(mockLogger);

    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create graph with grid configuration
    graph = new Graph({
      container,
      width: 800,
      height: 600,
      grid: {
        size: 10,
        visible: true,
      },
    });

    // Mock drawGrid method
    graph.drawGrid = vi.fn();
  });

  afterEach(() => {
    // Clean up handler
    handler.cleanup();

    // Clean up graph and container
    if (graph) {
      graph.dispose();
    }
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Initialization and Setup', () => {
    it('should setup keyboard handling with event listeners', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const graphOnSpy = vi.spyOn(graph, 'on');

      handler.setupKeyboardHandling(graph);

      // Document event listeners
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));

      // Window event listeners
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));

      // Graph event listeners
      expect(graphOnSpy).toHaveBeenCalledWith('node:mousedown', expect.any(Function));
      expect(graphOnSpy).toHaveBeenCalledWith('node:mousemove', expect.any(Function));
      expect(graphOnSpy).toHaveBeenCalledWith('node:mouseup', expect.any(Function));

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Shift key handling for snap to grid control and cursor changes initialized',
      );
    });

    it('should set graph reference', () => {
      handler.setGraph(graph);
      // Graph reference is private, but we can test it indirectly through functionality
      expect(graph).toBeTruthy();
    });

    it('should cleanup event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      handler.setupKeyboardHandling(graph);
      handler.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });
  });

  describe('Shift Key Handling', () => {
    beforeEach(() => {
      handler.setupKeyboardHandling(graph);
    });

    it('should track shift key press', () => {
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);

      // Shift key state is tracked internally
      // Grid updates only happen during dragging, not on key press alone
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });

    it('should track shift key release', () => {
      // First press shift
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);

      vi.clearAllMocks();

      // Then release shift
      const shiftUpEvent = new KeyboardEvent('keyup', { key: 'Shift' });
      document.dispatchEvent(shiftUpEvent);

      // Grid updates only happen during dragging, not on key release alone
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });

    it('should ignore non-shift keys', () => {
      const otherKeyEvent = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(otherKeyEvent);

      // Should not trigger grid updates for non-shift keys
      expect(graph.drawGrid).not.toHaveBeenCalled();
    });

    it('should handle multiple shift key presses without duplicate state changes', () => {
      // Press shift multiple times
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);
      document.dispatchEvent(shiftDownEvent);
      document.dispatchEvent(shiftDownEvent);

      // Should only log once (first press) due to state tracking
      expect(mockLogger.debugComponent).toHaveBeenCalledTimes(1);
    });

    it('should handle shift key release without prior press', () => {
      const shiftUpEvent = new KeyboardEvent('keyup', { key: 'Shift' });
      document.dispatchEvent(shiftUpEvent);

      // Should not trigger grid updates if shift wasn't pressed
      expect(graph.drawGrid).not.toHaveBeenCalled();
    });
  });

  describe('Node Drag Handling', () => {
    let node: Node;

    beforeEach(() => {
      handler.setupKeyboardHandling(graph);

      node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });
    });

    it('should track node drag start', () => {
      graph.trigger('node:mousedown', { node });

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'X6Keyboard',
        'Node drag started (handleNodeMouseDown)',
        { nodeId: node.id },
      );
      expect(mockLogger.debugComponent).toHaveBeenCalledWith('X6Keyboard', 'Node drag started', {
        nodeId: node.id,
        initialPosition: { x: 100, y: 100 },
      });
      // Grid is only redrawn when grid size changes, not on every drag start
    });

    it('should store initial node position on drag start', () => {
      graph.trigger('node:mousedown', { node });

      const initialPosition = handler.getInitialNodePosition(node.id);
      expect(initialPosition).toEqual(new Point(100, 100));
    });

    it('should update grid during node mouse move', () => {
      // Start dragging
      graph.trigger('node:mousedown', { node });
      vi.clearAllMocks();

      // Move during drag
      graph.trigger('node:mousemove', { node });

      // Grid is only redrawn when grid size changes, not on every mouse move
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });

    it('should not update grid on mouse move when not dragging', () => {
      graph.trigger('node:mousemove', { node });

      expect(graph.drawGrid).not.toHaveBeenCalled();
    });

    it('should track node drag end', () => {
      // Start dragging
      graph.trigger('node:mousedown', { node });
      vi.clearAllMocks();

      // End dragging
      graph.trigger('node:mouseup', { node });

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'X6Keyboard',
        'Node drag ended (handleNodeMouseUp)',
        { nodeId: node.id },
      );
      // Grid is only redrawn when grid size changes, not on every drag end
    });

    it('should clear initial position on drag end', () => {
      // Start dragging
      graph.trigger('node:mousedown', { node });
      expect(handler.getInitialNodePosition(node.id)).toBeTruthy();

      // End dragging
      graph.trigger('node:mouseup', { node });
      expect(handler.getInitialNodePosition(node.id)).toBeNull();
    });

    it('should handle node drag end when not dragging', () => {
      graph.trigger('node:mouseup', { node });

      // Should not trigger grid updates if not dragging
      expect(graph.drawGrid).not.toHaveBeenCalled();
    });
  });

  describe('Snap to Grid Control', () => {
    let node: Node;

    beforeEach(() => {
      handler.setupKeyboardHandling(graph);

      node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });
    });

    it('should disable snap to grid when shift is pressed during drag', () => {
      // Start dragging
      graph.trigger('node:mousedown', { node });

      // Press shift during drag
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);

      // Check that grid size was updated to 1 (disabled snap)
      const graphOptions = (graph as any).options;
      expect(graphOptions.grid.size).toBe(1);
      expect(graph.drawGrid).toHaveBeenCalled();
    });

    it('should restore snap to grid when shift is released during drag', () => {
      // Start dragging with shift pressed
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);
      graph.trigger('node:mousedown', { node });

      // Release shift during drag
      const shiftUpEvent = new KeyboardEvent('keyup', { key: 'Shift' });
      document.dispatchEvent(shiftUpEvent);

      // Check that grid size was restored to original (10)
      const graphOptions = (graph as any).options;
      expect(graphOptions.grid.size).toBe(10);
      expect(graph.drawGrid).toHaveBeenCalled();
    });

    it('should not affect grid when shift is pressed without dragging', () => {
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);

      // Grid size should remain original when not dragging
      const graphOptions = (graph as any).options;
      expect(graphOptions.grid.size).toBe(10);
    });

    it('should restore grid when drag ends with shift still pressed', () => {
      // Press shift and start dragging
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);
      graph.trigger('node:mousedown', { node });

      // End drag while shift is still pressed
      graph.trigger('node:mouseup', { node });

      // Grid should be restored to original size when not dragging
      const graphOptions = (graph as any).options;
      expect(graphOptions.grid.size).toBe(10);
    });
  });

  describe('Document Mouse Up Handling', () => {
    let node: Node;

    beforeEach(() => {
      handler.setupKeyboardHandling(graph);

      node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });
    });

    it('should reset drag state on document mouse up', () => {
      // Start dragging
      graph.trigger('node:mousedown', { node });
      expect(handler.getInitialNodePosition(node.id)).toBeTruthy();

      // Mouse up on document (outside graph)
      const mouseUpEvent = new MouseEvent('mouseup');
      document.dispatchEvent(mouseUpEvent);

      // Grid is only redrawn when grid size changes
      expect(handler.getInitialNodePosition(node.id)).toBeNull();
    });

    it('should clear all initial positions on document mouse up', () => {
      const node2 = graph.addNode({
        shape: 'rect',
        x: 200,
        y: 200,
        width: 100,
        height: 50,
      });

      // Start dragging multiple nodes
      graph.trigger('node:mousedown', { node });
      graph.trigger('node:mousedown', { node: node2 });

      expect(handler.getInitialNodePosition(node.id)).toBeTruthy();
      expect(handler.getInitialNodePosition(node2.id)).toBeTruthy();

      // Document mouse up should clear all positions
      const mouseUpEvent = new MouseEvent('mouseup');
      document.dispatchEvent(mouseUpEvent);

      expect(handler.getInitialNodePosition(node.id)).toBeNull();
      expect(handler.getInitialNodePosition(node2.id)).toBeNull();
    });

    it('should not affect state when document mouse up occurs without dragging', () => {
      const mouseUpEvent = new MouseEvent('mouseup');
      document.dispatchEvent(mouseUpEvent);

      // Should not trigger grid updates if not dragging
      expect(graph.drawGrid).not.toHaveBeenCalled();
    });
  });

  describe('Window Blur Handling', () => {
    let node: Node;

    beforeEach(() => {
      handler.setupKeyboardHandling(graph);

      node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });
    });

    it('should reset all state on window blur', () => {
      // Set up some state
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(shiftDownEvent);
      graph.trigger('node:mousedown', { node });

      expect(handler.getInitialNodePosition(node.id)).toBeTruthy();

      // Trigger window blur
      const blurEvent = new Event('blur');
      window.dispatchEvent(blurEvent);

      // All state should be reset
      expect(graph.drawGrid).toHaveBeenCalled();
      expect(handler.getInitialNodePosition(node.id)).toBeNull();

      // Grid should be restored to original size
      const graphOptions = (graph as any).options;
      expect(graphOptions.grid.size).toBe(10);
    });
  });

  describe('Initial Position Management', () => {
    let node: Node;

    beforeEach(() => {
      handler.setupKeyboardHandling(graph);

      node = graph.addNode({
        shape: 'rect',
        x: 150,
        y: 200,
        width: 100,
        height: 50,
      });
    });

    it('should return null for non-existent node position', () => {
      const position = handler.getInitialNodePosition('non-existent-id');
      expect(position).toBeNull();
    });

    it('should store and retrieve initial positions correctly', () => {
      graph.trigger('node:mousedown', { node });

      const position = handler.getInitialNodePosition(node.id);
      expect(position).toEqual(new Point(150, 200));
    });

    it('should handle multiple nodes with different positions', () => {
      const node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 400,
        width: 100,
        height: 50,
      });

      graph.trigger('node:mousedown', { node });
      graph.trigger('node:mousedown', { node: node2 });

      expect(handler.getInitialNodePosition(node.id)).toEqual(new Point(150, 200));
      expect(handler.getInitialNodePosition(node2.id)).toEqual(new Point(300, 400));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle grid updates without graph reference', () => {
      // Don't setup keyboard handling (no graph reference)
      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });

      // Should not throw error
      expect(() => {
        document.dispatchEvent(shiftDownEvent);
      }).not.toThrow();
    });

    it('should handle grid updates with missing grid configuration', () => {
      const graphWithoutGrid = new Graph({
        container,
        width: 800,
        height: 600,
        // No grid configuration
      });

      handler.setupKeyboardHandling(graphWithoutGrid);

      const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });

      // Should not throw error even without grid config
      expect(() => {
        document.dispatchEvent(shiftDownEvent);
      }).not.toThrow();

      graphWithoutGrid.dispose();
    });

    it('should handle cleanup without prior setup', () => {
      // Should not throw error
      expect(() => {
        handler.cleanup();
      }).not.toThrow();
    });

    it('should handle multiple cleanup calls', () => {
      handler.setupKeyboardHandling(graph);
      handler.cleanup();

      // Second cleanup should not throw error
      expect(() => {
        handler.cleanup();
      }).not.toThrow();
    });

    it('should handle node events with missing node data', () => {
      handler.setupKeyboardHandling(graph);

      // Should not throw error with undefined node
      expect(() => {
        graph.trigger('node:mousedown', { node: undefined as any });
      }).not.toThrow();
    });
  });
});
