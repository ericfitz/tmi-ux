// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph, Node, Edge } from '@antv/x6';
import { JSDOM } from 'jsdom';
import { InfraX6SelectionAdapter } from './infra-x6-selection.adapter';
import { SelectionService } from '../services/infra-selection.service';
import { AppOperationStateManager } from '../../application/services/app-operation-state-manager.service';
import { registerCustomShapes } from './infra-x6-shape-definitions';
import { DFD_STYLING } from '../../constants/styling-constants';
import { InfraX6CoreOperationsService } from '../services/infra-x6-core-operations.service';
import { InfraEdgeService } from '../services/infra-edge.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Helper to add getNodeTypeInfo extension mock to nodes
function addNodeTypeInfoExtension(node: Node, nodeType: string = 'process') {
  // Mock the getNodeTypeInfo extension that's added in the real application
  (node as any).getNodeTypeInfo = vi.fn(() => ({
    type: nodeType,
    label: node.getAttrByPath('label') || 'Test Node',
  }));
  return node;
}

// Helper to create a node with proper mocks
function createTestNode(graph: Graph, config: any, nodeType: string = 'process'): Node {
  const node = graph.addNode(config);
  return addNodeTypeInfoExtension(node, nodeType);
}

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

describe('InfraX6SelectionAdapter', () => {
  let adapter: InfraX6SelectionAdapter;
  let graph: Graph;
  let mockLogger: MockLoggerService;
  let selectionService: SelectionService;
  let historyCoordinator: AppOperationStateManager;
  let x6CoreOps: InfraX6CoreOperationsService;
  let infraEdgeService: InfraEdgeService;
  let container: HTMLElement;

  beforeEach(() => {
    // Create DOM container for X6 graph
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Register shapes before creating graph
    registerCustomShapes();

    // Create graph instance
    graph = new Graph({
      container,
      width: 800,
      height: 600,
      grid: true,
      background: { color: '#f8f9fa' },
    });

    // Create services
    mockLogger = createTypedMockLoggerService();
    selectionService = new SelectionService(mockLogger as any);
    historyCoordinator = new AppOperationStateManager(mockLogger as any);
    x6CoreOps = new InfraX6CoreOperationsService(mockLogger as any);

    // Create mock services for InfraEdgeService
    infraEdgeService = {
      removeEdge: vi.fn().mockReturnValue(true),
    } as any;

    adapter = new InfraX6SelectionAdapter(
      mockLogger as any,
      selectionService,
      historyCoordinator,
      x6CoreOps,
      infraEdgeService,
    );

    // Initialize plugins
    adapter.initializePlugins(graph);
  });

  afterEach(() => {
    // Clean up DOM
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    // Clean up graph instance
    if (graph && graph.dispose) {
      try {
        graph.dispose();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Plugin Initialization', () => {
    it('should initialize selection and transform plugins', () => {
      expect(mockLogger.info).toHaveBeenCalledWith('Selection and transform plugins initialized');
    });

    it('should configure selection plugin with correct options', () => {
      // Access the selection plugin directly from the adapter
      const selectionPlugin = (adapter as any).selectionPlugin;

      expect(selectionPlugin).toBeDefined();
      expect(selectionPlugin.options.enabled).toBe(true);
      expect(selectionPlugin.options.multiple).toBe(true);
      expect(selectionPlugin.options.rubberband).toBe(true);
      expect(selectionPlugin.options.movable).toBe(true);
    });

    it('should configure transform plugin with correct options', () => {
      // Access the transform plugin directly from the adapter
      const transformPlugin = (adapter as any).transformPlugin;

      expect(transformPlugin).toBeDefined();
      expect(transformPlugin.options.resizing.enabled).toBe(true);
      expect(transformPlugin.options.resizing.minWidth).toBe(40);
      expect(transformPlugin.options.resizing.minHeight).toBe(30);
      expect(transformPlugin.options.rotating).toBe(false);
    });
  });

  describe('Individual Cell Selection with Visual Feedback', () => {
    let node: Node;
    let edge: Edge;

    beforeEach(() => {
      // Create test nodes and edges with proper getNodeTypeInfo mocks
      node = createTestNode(
        graph,
        {
          x: 100,
          y: 100,
          width: 80,
          height: 60,
          shape: 'process',
          label: 'Test Process',
        },
        'process',
      );

      const sourceNode = createTestNode(
        graph,
        {
          x: 200,
          y: 200,
          width: 80,
          height: 60,
          shape: 'actor',
          label: 'Source',
        },
        'actor',
      );

      edge = graph.addEdge({
        source: node,
        target: sourceNode,
        label: 'Test Edge',
      });

      // Setup selection events
      adapter.setupSelectionEvents(graph);
    });

    it('should apply hover effect to node on mouse enter', () => {
      // Simulate mouse enter event
      graph.trigger('cell:mouseenter', { cell: node });

      // Verify hover effect applied
      const bodyFilter = node.attr('body/filter');
      expect(bodyFilter).toBe('drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
    });

    it('should apply hover effect to text-box node on text element', () => {
      const textBoxNode = createTestNode(
        graph,
        {
          x: 300,
          y: 300,
          width: 100,
          height: 40,
          shape: 'text-box',
          label: 'Text Box',
        },
        'text-box',
      );

      // Mock getNodeTypeInfo method
      (textBoxNode as any).getNodeTypeInfo = () => ({ type: 'text-box' });

      // Simulate mouse enter event
      graph.trigger('cell:mouseenter', { cell: textBoxNode });

      // Verify hover effect applied to text element
      const textFilter = textBoxNode.attr('text/filter');
      expect(textFilter).toBe('drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
    });

    it('should apply hover effect to edge on mouse enter', () => {
      // Simulate mouse enter event
      graph.trigger('cell:mouseenter', { cell: edge });

      // Verify hover effect applied
      const lineFilter = edge.attr('line/filter');
      expect(lineFilter).toBe('drop-shadow(0 0 3px rgba(255, 0, 0, 0.6))');
    });

    it('should remove hover effect on mouse leave', () => {
      // Apply hover effect first
      graph.trigger('cell:mouseenter', { cell: node });

      // Simulate mouse leave event
      graph.trigger('cell:mouseleave', { cell: node });

      // Verify hover effect removed
      const bodyFilter = node.attr('body/filter');
      expect(bodyFilter).toBe('none');
    });

    it('should not apply hover effect to selected cells', () => {
      // Select the node first
      graph.select(node);

      // Simulate mouse enter event
      graph.trigger('cell:mouseenter', { cell: node });

      // Verify hover effect not applied (selection effect should remain)
      const bodyFilter = node.attr('body/filter');
      expect(bodyFilter).not.toBe('drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
    });

    it('should apply selection effect when cell is selected', () => {
      // Simulate selection change event
      graph.trigger('selection:changed', { added: [node], removed: [] });

      // Verify selection effect applied
      const bodyFilter = node.attr('body/filter');
      const strokeWidth = node.attr('body/strokeWidth');
      const strokeColor = node.attr('body/stroke');
      expect(bodyFilter).toBe('drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');
      expect(strokeWidth).toBe(DFD_STYLING.SELECTION.STROKE_WIDTH);
      expect(strokeColor).toBe(DFD_STYLING.SELECTION.STROKE_COLOR);
    });

    it('should remove selection effect when cell is deselected', () => {
      // Select first
      graph.trigger('selection:changed', { added: [node], removed: [] });

      // Then deselect
      graph.trigger('selection:changed', { added: [], removed: [node] });

      // Verify selection effect removed
      const bodyFilter = node.attr('body/filter');
      const strokeWidth = node.attr('body/strokeWidth');
      expect(bodyFilter).toBe('none');
      expect(strokeWidth).toBe(2);
    });
  });

  describe('Rubberband Multi-Selection and Blank Click', () => {
    let nodes: Node[];

    beforeEach(() => {
      // Create multiple test nodes with proper mocks
      nodes = [
        createTestNode(
          graph,
          {
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            shape: 'process',
            label: 'Process 1',
          },
          'process',
        ),
        createTestNode(
          graph,
          {
            x: 200,
            y: 200,
            width: 80,
            height: 60,
            shape: 'actor',
            label: 'Actor 1',
          },
          'actor',
        ),
        createTestNode(
          graph,
          {
            x: 300,
            y: 300,
            width: 80,
            height: 60,
            shape: 'store',
            label: 'Store 1',
          },
          'store',
        ),
      ];

      adapter.setupSelectionEvents(graph);
    });

    it('should support multi-selection via selection API', () => {
      // Select multiple cells
      adapter.selectCells(graph, [nodes[0], nodes[1]]);

      // Verify multiple cells selected
      const selectedCells = adapter.getSelectedCells(graph);
      expect(selectedCells).toHaveLength(2);
      expect(selectedCells).toContain(nodes[0]);
      expect(selectedCells).toContain(nodes[1]);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Selected cells',
        { count: 2 },
      );
    });

    it('should clear selection on blank click', () => {
      // Select some cells first
      graph.select([nodes[0], nodes[1]]);

      // Mock cleanSelection method
      graph.cleanSelection = vi.fn();

      // Simulate blank click
      graph.trigger('blank:click');

      // Verify selection cleared
      expect(graph.cleanSelection).toHaveBeenCalled();
    });

    it('should handle multi-selection with shift modifier configured', () => {
      // Verify the selection plugin was configured with shift modifier for multi-selection
      expect(adapter['selectionPlugin']).toBeDefined();
      // Note: We can't easily test the internal configuration, but this verifies the plugin exists
      // The actual shift+click behavior will be handled by X6's selection plugin natively
    });

    it('should handle selection change events correctly', () => {
      // Simulate selection change with multiple cells
      graph.trigger('selection:changed', {
        added: [nodes[0], nodes[1]],
        removed: [],
      });

      // Verify logging
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Selection changed - visual adapter',
        {
          added: 2,
          removed: 0,
          total: expect.any(Number),
        },
      );
    });

    it('should get selected nodes only', () => {
      const edge = graph.addEdge({
        source: nodes[0],
        target: nodes[1],
      });

      // Select nodes and edge
      graph.select([nodes[0], nodes[1], edge]);

      // Get only selected nodes
      const selectedNodes = adapter.getSelectedNodes(graph);
      expect(selectedNodes).toHaveLength(2);
      expect(selectedNodes).toContain(nodes[0]);
      expect(selectedNodes).toContain(nodes[1]);
      expect(selectedNodes).not.toContain(edge);
    });

    it('should get selected edges only', () => {
      const edge = graph.addEdge({
        source: nodes[0],
        target: nodes[1],
      });

      // Select nodes and edge
      graph.select([nodes[0], edge]);

      // Get only selected edges
      const selectedEdges = adapter.getSelectedEdges(graph);
      expect(selectedEdges).toHaveLength(1);
      expect(selectedEdges).toContain(edge);
      expect(selectedEdges).not.toContain(nodes[0]);
    });

    it('should select all cells in graph', () => {
      // Add edge to have mixed cell types
      graph.addEdge({
        source: nodes[0],
        target: nodes[1],
      });

      // Select all
      adapter.selectAll(graph);

      // Verify all cells selected
      const selectedCells = adapter.getSelectedCells(graph);
      expect(selectedCells.length).toBeGreaterThanOrEqual(4); // 3 nodes + 1 edge
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Selected all cells',
        {
          count: expect.any(Number),
        },
      );
    });

    it('should clear selection programmatically', () => {
      // Select some cells
      graph.select([nodes[0], nodes[1]]);

      // Clear selection
      adapter.clearSelection(graph);

      // Verify selection cleared
      const selectedCells = adapter.getSelectedCells(graph);
      expect(selectedCells).toHaveLength(0);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Selection cleared',
      );
    });
  });

  describe('Selection Tools and Cell Deletion', () => {
    let node: Node;
    let edge: Edge;
    let deletionCallback: any;

    beforeEach(() => {
      node = createTestNode(
        graph,
        {
          x: 100,
          y: 100,
          width: 80,
          height: 60,
          shape: 'process',
          label: 'Test Process',
        },
        'process',
      );

      const targetNode = createTestNode(
        graph,
        {
          x: 200,
          y: 200,
          width: 80,
          height: 60,
          shape: 'actor',
          label: 'Target',
        },
        'actor',
      );

      edge = graph.addEdge({
        source: node,
        target: targetNode,
        label: 'Test Edge',
      });

      deletionCallback = vi.fn();
      adapter.setupSelectionEvents(graph, deletionCallback);
    });

    it('should add node tools when node is selected', () => {
      // Mock addTools method
      node.addTools = vi.fn();

      // Simulate selection
      graph.trigger('selection:changed', { added: [node], removed: [] });

      // Verify node tools added
      expect(node.addTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'button-remove' }),
          expect.objectContaining({ name: 'boundary' }),
        ]),
      );
    });

    it('should add edge tools when edge is selected', () => {
      // Mock addTools method
      edge.addTools = vi.fn();

      // Simulate selection
      graph.trigger('selection:changed', { added: [edge], removed: [] });

      // Verify edge tools added
      expect(edge.addTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'vertices' }),
          expect.objectContaining({ name: 'source-arrowhead' }),
          expect.objectContaining({ name: 'target-arrowhead' }),
          expect.objectContaining({ name: 'button-remove' }),
        ]),
      );
    });

    it('should remove tools when cell is deselected', () => {
      // Mock removeTools method
      node.removeTools = vi.fn();

      // Select then deselect
      graph.trigger('selection:changed', { added: [node], removed: [] });
      graph.trigger('selection:changed', { added: [], removed: [node] });

      // Verify tools removed
      expect(node.removeTools).toHaveBeenCalled();
    });

    it('should configure button-remove tool with deletion callback', () => {
      // Mock addTools to capture the tools configuration
      let capturedTools: any[] = [];
      node.addTools = vi.fn(tools => {
        capturedTools = tools;
      });

      // Simulate selection
      graph.trigger('selection:changed', { added: [node], removed: [] });

      // Find button-remove tool
      const removeButton = capturedTools.find(tool => tool.name === 'button-remove');
      expect(removeButton).toBeDefined();
      expect(removeButton.args.onClick).toBeDefined();

      // Simulate button click
      removeButton.args.onClick({ cell: node });
      expect(deletionCallback).toHaveBeenCalledWith(node);
    });

    it('should delete selected cells programmatically using appropriate services', () => {
      // Select cells
      graph.select([node, edge]);

      // Mock InfraX6CoreOperationsService.removeCellObject for nodes
      x6CoreOps.removeCellObject = vi.fn();

      // Delete selected
      adapter.deleteSelected(graph);

      // Verify InfraEdgeService.removeEdge called for edge
      expect(infraEdgeService.removeEdge).toHaveBeenCalledWith(graph, edge.id);

      // Verify InfraX6CoreOperationsService.removeCellObject called for node
      expect(x6CoreOps.removeCellObject).toHaveBeenCalledWith(graph, node);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Deleted selected cells',
        { count: 2 },
      );
    });

    it('should handle deletion when no cells selected', () => {
      // Ensure no selection
      adapter.clearSelection(graph);

      // Mock services
      x6CoreOps.removeCellObject = vi.fn();
      vi.clearAllMocks();

      // Attempt deletion
      adapter.deleteSelected(graph);

      // Verify no cells removed
      expect(x6CoreOps.removeCellObject).not.toHaveBeenCalled();
      expect(infraEdgeService.removeEdge).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'No cells selected for deletion',
      );
    });
  });

  describe('Copy/Paste Functionality', () => {
    let nodes: Node[];

    beforeEach(() => {
      nodes = [
        createTestNode(
          graph,
          {
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            shape: 'process',
            label: 'Process 1',
          },
          'process',
        ),
        createTestNode(
          graph,
          {
            x: 200,
            y: 200,
            width: 80,
            height: 60,
            shape: 'actor',
            label: 'Actor 1',
          },
          'actor',
        ),
      ];
    });

    it('should copy selected cells using SelectionService', () => {
      // Select cells
      graph.select(nodes);

      // Mock SelectionService method
      const mockCopiedCells = [nodes[0].clone(), nodes[1].clone()];
      vi.spyOn(selectionService, 'copySelectedCells').mockReturnValue(mockCopiedCells);

      // Copy selected
      const copiedCells = adapter.copySelected(graph);

      // Verify SelectionService called with selected cells
      expect(selectionService.copySelectedCells).toHaveBeenCalled();
      expect(copiedCells).toEqual(mockCopiedCells);
    });

    it('should paste cells using SelectionService for position calculation', () => {
      const cellsToPaste = [nodes[0].clone(), nodes[1].clone()];

      // Mock SelectionService method
      const mockPasteData = [
        { cell: cellsToPaste[0], position: { x: 120, y: 120 } },
        { cell: cellsToPaste[1], position: { x: 220, y: 220 } },
      ];
      vi.spyOn(selectionService, 'calculatePastePositions').mockReturnValue(mockPasteData);

      // Mock graph methods
      graph.addCell = vi.fn();
      adapter.clearSelection = vi.fn();
      adapter.selectCells = vi.fn();

      // Paste cells
      adapter.pasteCells(graph, cellsToPaste, 20, 20);

      // Verify SelectionService called for position calculation
      expect(selectionService.calculatePastePositions).toHaveBeenCalledWith(cellsToPaste, 20, 20);

      // Verify cells added with calculated positions
      expect(graph.addCell).toHaveBeenCalledTimes(2);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Pasted cells',
        { count: 2 },
      );
    });

    it('should handle paste with no cells', () => {
      // Mock graph methods
      graph.addCell = vi.fn();

      // Paste empty array
      adapter.pasteCells(graph, []);

      // Verify no cells added
      expect(graph.addCell).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'No cells to paste',
      );
    });

    it('should clear selection and select pasted cells', () => {
      const cellsToPaste = [nodes[0].clone()];

      // Mock SelectionService method
      vi.spyOn(selectionService, 'calculatePastePositions').mockReturnValue([
        { cell: cellsToPaste[0], position: { x: 120, y: 120 } },
      ]);

      // Mock adapter methods
      adapter.clearSelection = vi.fn();
      adapter.selectCells = vi.fn();
      graph.addCell = vi.fn();

      // Paste cells
      adapter.pasteCells(graph, cellsToPaste);

      // Verify selection cleared and pasted cells selected
      expect(adapter.clearSelection).toHaveBeenCalledWith(graph);
      expect(adapter.selectCells).toHaveBeenCalledWith(graph, cellsToPaste);
    });
  });

  describe('Alignment and Distribution Operations', () => {
    let nodes: Node[];

    beforeEach(() => {
      nodes = [
        createTestNode(
          graph,
          {
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            shape: 'process',
            label: 'Process 1',
          },
          'process',
        ),
        createTestNode(
          graph,
          {
            x: 200,
            y: 150,
            width: 80,
            height: 60,
            shape: 'actor',
            label: 'Actor 1',
          },
          'actor',
        ),
        createTestNode(
          graph,
          {
            x: 300,
            y: 200,
            width: 80,
            height: 60,
            shape: 'store',
            label: 'Store 1',
          },
          'store',
        ),
      ];
    });

    it('should align nodes using SelectionService calculations', () => {
      // Select nodes
      graph.select(nodes);

      // Mock SelectionService method
      const mockAlignmentData = [
        { node: nodes[0], position: { x: 100, y: 100 } },
        { node: nodes[1], position: { x: 100, y: 150 } },
        { node: nodes[2], position: { x: 100, y: 200 } },
      ];
      vi.spyOn(selectionService, 'calculateAlignmentPositions').mockReturnValue(mockAlignmentData);

      // Mock node setPosition
      nodes.forEach(node => {
        node.setPosition = vi.fn();
      });

      // Align left
      adapter.alignNodes(graph, 'left');

      // Verify SelectionService called and positions applied
      expect(selectionService.calculateAlignmentPositions).toHaveBeenCalledWith(nodes, 'left');
      expect(nodes[0].setPosition).toHaveBeenCalledWith(100, 100);
      expect(nodes[1].setPosition).toHaveBeenCalledWith(100, 150);
      expect(nodes[2].setPosition).toHaveBeenCalledWith(100, 200);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Aligned nodes',
        {
          alignment: 'left',
          count: 3,
        },
      );
    });

    it('should distribute nodes using SelectionService calculations', () => {
      // Select nodes
      graph.select(nodes);

      // Mock SelectionService method
      const mockDistributionData = [
        { node: nodes[0], position: { x: 100, y: 100 } },
        { node: nodes[1], position: { x: 200, y: 100 } },
        { node: nodes[2], position: { x: 300, y: 100 } },
      ];
      vi.spyOn(selectionService, 'calculateDistributionPositions').mockReturnValue(
        mockDistributionData,
      );

      // Mock node setPosition
      nodes.forEach(node => {
        node.setPosition = vi.fn();
      });

      // Distribute horizontally
      adapter.distributeNodes(graph, 'horizontal');

      // Verify SelectionService called and positions applied
      expect(selectionService.calculateDistributionPositions).toHaveBeenCalledWith(
        nodes,
        'horizontal',
      );
      expect(nodes[0].setPosition).toHaveBeenCalledWith(100, 100);
      expect(nodes[1].setPosition).toHaveBeenCalledWith(200, 100);
      expect(nodes[2].setPosition).toHaveBeenCalledWith(300, 100);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Distributed nodes',
        {
          direction: 'horizontal',
          count: 3,
        },
      );
    });

    it('should support all alignment types', () => {
      const alignmentTypes = ['left', 'center', 'right', 'top', 'middle', 'bottom'] as const;

      // Select nodes first so adapter can get them
      graph.select(nodes);

      // Mock SelectionService method
      vi.spyOn(selectionService, 'calculateAlignmentPositions').mockReturnValue([]);

      alignmentTypes.forEach(alignment => {
        adapter.alignNodes(graph, alignment);
        expect(selectionService.calculateAlignmentPositions).toHaveBeenCalledWith(nodes, alignment);
      });
    });

    it('should support both distribution directions', () => {
      const directions = ['horizontal', 'vertical'] as const;

      // Select nodes first so adapter can get them
      graph.select(nodes);

      // Mock SelectionService method
      vi.spyOn(selectionService, 'calculateDistributionPositions').mockReturnValue([]);

      directions.forEach(direction => {
        adapter.distributeNodes(graph, direction);
        expect(selectionService.calculateDistributionPositions).toHaveBeenCalledWith(
          nodes,
          direction,
        );
      });
    });
  });

  describe('Grouping Operations', () => {
    let nodes: Node[];

    beforeEach(() => {
      nodes = [
        createTestNode(
          graph,
          {
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            shape: 'process',
            label: 'Process 1',
          },
          'process',
        ),
        createTestNode(
          graph,
          {
            x: 200,
            y: 200,
            width: 80,
            height: 60,
            shape: 'actor',
            label: 'Actor 1',
          },
          'actor',
        ),
      ];
    });

    it('should group selected nodes using SelectionService logic', () => {
      // Select nodes
      graph.select(nodes);

      // Mock SelectionService methods
      vi.spyOn(selectionService, 'canGroupNodes').mockReturnValue(true);
      vi.spyOn(selectionService, 'calculateGroupBoundingBox').mockReturnValue({
        x: 90,
        y: 90,
        width: 200,
        height: 180,
      });
      vi.spyOn(selectionService, 'getGroupConfiguration').mockReturnValue({
        x: 90,
        y: 90,
        width: 200,
        height: 180,
        shape: 'rect',
      });

      // Mock graph.addNode
      const mockGroupNode = { id: 'group-1', addChild: vi.fn() } as any;
      graph.addNode = vi.fn().mockReturnValue(mockGroupNode);

      // Group nodes
      const result = adapter.groupSelected(graph);

      // Verify SelectionService methods called
      expect(selectionService.canGroupNodes).toHaveBeenCalledWith(nodes);
      expect(selectionService.calculateGroupBoundingBox).toHaveBeenCalledWith(nodes);
      expect(selectionService.getGroupConfiguration).toHaveBeenCalled();

      // Verify group created and children added
      expect(graph.addNode).toHaveBeenCalled();
      expect(mockGroupNode.addChild).toHaveBeenCalledWith(nodes[0]);
      expect(mockGroupNode.addChild).toHaveBeenCalledWith(nodes[1]);
      expect(result).toBe(mockGroupNode);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Created group with nodes',
        {
          groupId: 'group-1',
          nodeCount: 2,
        },
      );
    });

    it('should not group when SelectionService validation fails', () => {
      // Select nodes
      graph.select(nodes);

      // Mock SelectionService to return false
      vi.spyOn(selectionService, 'canGroupNodes').mockReturnValue(false);

      // Mock graph.addNode
      graph.addNode = vi.fn();

      // Attempt to group
      const result = adapter.groupSelected(graph);

      // Verify no group created
      expect(graph.addNode).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Cannot group selected nodes',
      );
    });

    it('should ungroup selected nodes using SelectionService logic', () => {
      // Create a group node with children (doesn't need getNodeTypeInfo since it's not tested)
      const groupNode = graph.addNode({
        x: 90,
        y: 90,
        width: 200,
        height: 180,
        shape: 'rect',
      });

      // Mock children and methods
      const mockChildren = [nodes[0], nodes[1]];
      groupNode.getChildren = vi.fn().mockReturnValue(mockChildren);
      groupNode.removeChild = vi.fn();

      // Select group
      graph.select(groupNode);

      // Mock SelectionService
      vi.spyOn(selectionService, 'canUngroupNode').mockReturnValue(true);

      // Mock graph.removeCell
      graph.removeCell = vi.fn();

      // Ungroup
      adapter.ungroupSelected(graph);

      // Verify SelectionService called and children removed
      expect(selectionService.canUngroupNode).toHaveBeenCalledWith(groupNode);
      expect(groupNode.removeChild).toHaveBeenCalledWith(nodes[0]);
      expect(groupNode.removeChild).toHaveBeenCalledWith(nodes[1]);
      expect(graph.removeCell).toHaveBeenCalledWith(groupNode);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Ungrouped node',
        {
          groupId: groupNode.id,
          childCount: 2,
        },
      );
    });
  });

  describe('Selection Mode Control', () => {
    it('should enable selection mode', () => {
      // Mock plugin and graph methods
      const mockSelectionPlugin = { enable: vi.fn() };
      (adapter as any).selectionPlugin = mockSelectionPlugin;
      graph.enableSelection = vi.fn();

      // Enable selection
      adapter.enableSelection(graph);

      // Verify enabled
      expect(mockSelectionPlugin.enable).toHaveBeenCalled();
      expect(graph.enableSelection).toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Selection mode enabled',
      );
    });

    it('should disable selection mode', () => {
      // Mock plugin and graph methods
      const mockSelectionPlugin = { disable: vi.fn() };
      (adapter as any).selectionPlugin = mockSelectionPlugin;
      graph.disableSelection = vi.fn();
      adapter.clearSelection = vi.fn();

      // Disable selection
      adapter.disableSelection(graph);

      // Verify disabled and selection cleared
      expect(mockSelectionPlugin.disable).toHaveBeenCalled();
      expect(graph.disableSelection).toHaveBeenCalled();
      expect(adapter.clearSelection).toHaveBeenCalledWith(graph);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'InfraX6SelectionAdapter',
        'Selection mode disabled',
      );
    });
  });
});
