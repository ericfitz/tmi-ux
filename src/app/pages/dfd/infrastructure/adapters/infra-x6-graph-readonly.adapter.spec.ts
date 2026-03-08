// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@antv/x6';
import { JSDOM } from 'jsdom';
import { InfraX6GraphAdapter } from './infra-x6-graph.adapter';
import { registerCustomShapes } from './infra-x6-shape-definitions';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Mock SVG methods that X6 expects
const mockSVGElement = {
  getCTM: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  })),
  getScreenCTM: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  })),
  createSVGMatrix: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    rotate: function (_angle: number) {
      return this;
    },
    translate: function (_x: number, _y: number) {
      return this;
    },
    scale: function (_factor: number) {
      return this;
    },
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  })),
};

// Setup JSDOM environment for X6
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  resources: 'usable',
});

// Mock SVG elements
Object.defineProperty(dom.window.SVGElement.prototype, 'getCTM', {
  value: mockSVGElement.getCTM,
});
Object.defineProperty(dom.window.SVGElement.prototype, 'getScreenCTM', {
  value: mockSVGElement.getScreenCTM,
});
Object.defineProperty(dom.window.SVGSVGElement.prototype, 'createSVGMatrix', {
  value: mockSVGElement.createSVGMatrix,
});

// Set global window and document
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

describe('InfraX6GraphAdapter - Read-Only Mode', () => {
  let adapter: InfraX6GraphAdapter;
  let graph: Graph;
  let mockLogger: MockLoggerService;
  let container: HTMLElement;
  let mockSelectionAdapter: any;
  let mockKeyboardHandler: any;

  beforeEach(() => {
    // Create DOM container for X6 graph
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Register shapes before creating graph
    registerCustomShapes();

    // Create graph instance with interacting enabled (default edit mode)
    graph = new Graph({
      container,
      width: 800,
      height: 600,
      interacting: {
        nodeMovable: true,
        edgeMovable: true,
        edgeLabelMovable: true,
        arrowheadMovable: true,
        vertexMovable: true,
        vertexAddable: true,
        vertexDeletable: true,
        magnetConnectable: true,
      },
    });

    // Create mock services
    mockLogger = createTypedMockLoggerService();
    mockSelectionAdapter = {
      disableSelection: vi.fn(),
      enableSelection: vi.fn(),
      initializePlugins: vi.fn(),
      setNodeService: vi.fn(),
      setPortStateManager: vi.fn(),
    };
    mockKeyboardHandler = {
      cleanup: vi.fn(),
      setupKeyboardHandling: vi.fn(),
    };

    // Create adapter with minimal mocks — we only need the dependencies
    // that setReadOnlyMode() actually uses
    adapter = new InfraX6GraphAdapter(
      mockLogger as any, // logger
      {} as any, // _edgeQueryService
      {} as any, // _nodeConfigurationService
      {} as any, // _embeddingService
      { setHistoryCoordinator: vi.fn() } as any, // _portStateManager
      {} as any, // _visualEffectsService
      mockKeyboardHandler, // _keyboardHandler
      {} as any, // _zOrderAdapter
      {} as any, // _embeddingAdapter
      mockSelectionAdapter, // _selectionAdapter
      {} as any, // _x6EventLogger
      {} as any, // _tooltipAdapter
      {} as any, // _dfdValidation
      {} as any, // _historyCoordinator
      {} as any, // _x6CoreOps
      {} as any, // _injector
    );

    // Inject the graph directly into the adapter's private field
    (adapter as any)._graph = graph;
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (graph && graph.dispose) {
      try {
        graph.dispose();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('setReadOnlyMode()', () => {
    it('should disable all interactions when set to read-only', () => {
      adapter.setReadOnlyMode(true);

      const interacting = graph.options.interacting as Record<string, boolean>;
      expect(interacting.nodeMovable).toBe(false);
      expect(interacting.edgeMovable).toBe(false);
      expect(interacting.edgeLabelMovable).toBe(false);
      expect(interacting.arrowheadMovable).toBe(false);
      expect(interacting.vertexMovable).toBe(false);
      expect(interacting.vertexAddable).toBe(false);
      expect(interacting.vertexDeletable).toBe(false);
      expect(interacting.magnetConnectable).toBe(false);
    });

    it('should re-enable all interactions when set to edit mode', () => {
      // First go read-only
      adapter.setReadOnlyMode(true);
      // Then restore edit mode
      adapter.setReadOnlyMode(false);

      const interacting = graph.options.interacting as Record<string, boolean>;
      expect(interacting.nodeMovable).toBe(true);
      expect(interacting.edgeMovable).toBe(true);
      expect(interacting.edgeLabelMovable).toBe(true);
      expect(interacting.arrowheadMovable).toBe(true);
      expect(interacting.vertexMovable).toBe(true);
      expect(interacting.vertexAddable).toBe(true);
      expect(interacting.vertexDeletable).toBe(true);
      expect(interacting.magnetConnectable).toBe(true);
    });

    it('should disable selection when entering read-only mode', () => {
      adapter.setReadOnlyMode(true);
      expect(mockSelectionAdapter.disableSelection).toHaveBeenCalledWith(graph);
    });

    it('should re-enable selection when exiting read-only mode', () => {
      adapter.setReadOnlyMode(true);
      adapter.setReadOnlyMode(false);
      expect(mockSelectionAdapter.enableSelection).toHaveBeenCalledWith(graph);
    });

    it('should disable keyboard handling when entering read-only mode', () => {
      adapter.setReadOnlyMode(true);
      expect(mockKeyboardHandler.cleanup).toHaveBeenCalled();
    });

    it('should re-enable keyboard handling when exiting read-only mode', () => {
      adapter.setReadOnlyMode(true);
      adapter.setReadOnlyMode(false);
      expect(mockKeyboardHandler.setupKeyboardHandling).toHaveBeenCalledWith(graph);
    });

    it('should clear transform widgets when entering read-only mode', () => {
      const clearSpy = vi.fn();
      (graph as any).clearTransformWidgets = clearSpy;

      adapter.setReadOnlyMode(true);
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should remove tools from all cells when entering read-only mode', () => {
      // Add a node to the graph
      const node = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 40,
      });
      const removeToolSpy = vi.spyOn(node, 'removeTool');

      adapter.setReadOnlyMode(true);
      expect(removeToolSpy).toHaveBeenCalledWith('*');
    });

    it('should set internal _readOnly flag', () => {
      adapter.setReadOnlyMode(true);
      expect((adapter as any)._readOnly).toBe(true);

      adapter.setReadOnlyMode(false);
      expect((adapter as any)._readOnly).toBe(false);
    });

    it('should throw if graph is not initialized', () => {
      (adapter as any)._graph = null;
      expect(() => adapter.setReadOnlyMode(true)).toThrow(
        'Graph not initialized. Call initialize() first.',
      );
    });
  });

  describe('double-click label editing guard', () => {
    it('should not trigger label editor when in read-only mode', () => {
      // Set read-only mode
      adapter.setReadOnlyMode(true);

      // Spy on _addLabelEditor to verify it's not called
      const addLabelEditorSpy = vi.spyOn(adapter as any, '_addLabelEditor');

      // Add a node and trigger dblclick
      const node = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 40,
      });

      graph.trigger('cell:dblclick', {
        cell: node,
        e: new MouseEvent('dblclick'),
      });

      expect(addLabelEditorSpy).not.toHaveBeenCalled();
    });
  });
});
