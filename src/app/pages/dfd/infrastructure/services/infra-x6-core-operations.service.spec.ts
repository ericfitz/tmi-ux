// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { Graph, Node, Edge } from '@antv/x6';
import {
  InfraX6CoreOperationsService,
  NodeCreationConfig,
  EdgeCreationConfig,
} from './infra-x6-core-operations.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';

// Mock interface for LoggerService

describe('InfraX6CoreOperationsService', () => {
  let service: InfraX6CoreOperationsService;
  let graph: Graph;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    // Create mock for LoggerService
    mockLogger = createTypedMockLoggerService();

    // Create service instance
    service = new InfraX6CoreOperationsService(mockLogger as unknown as LoggerService);

    // Create real X6 graph instance
    const container = document.createElement('div');
    graph = new Graph({ container });
  });

  afterEach(() => {
    if (graph) {
      graph.dispose();
    }
  });

  describe('Node Operations', () => {
    describe('addNode', () => {
      it('should successfully add a node to the graph', () => {
        const nodeConfig: NodeCreationConfig = {
          id: 'test-node-1',
          shape: 'rect',
          x: 100,
          y: 100,
          width: 120,
          height: 80,
          label: 'Test Node',
        };

        const result = service.addNode(graph, nodeConfig);

        expect(result).toBeTruthy();
        expect(result?.id).toBe('test-node-1');
        expect(result?.isNode()).toBe(true);
        expect(graph.getCellById('test-node-1')).toBeTruthy();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Adding node',
          expect.objectContaining({
            nodeId: 'test-node-1',
            shape: 'rect',
            position: { x: 100, y: 100 },
          }),
        );
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Node added successfully',
          expect.objectContaining({
            nodeId: 'test-node-1',
            cellId: 'test-node-1',
          }),
        );
      });

      it('should add node with all optional properties', () => {
        const nodeConfig: NodeCreationConfig = {
          id: 'test-node-2',
          shape: 'ellipse',
          x: 200,
          y: 150,
          width: 100,
          height: 100,
          label: 'Test Ellipse',
          zIndex: 5,
          ports: [{ id: 'port1', position: { name: 'top' } }],
          attrs: { fill: 'red' },
          data: { metadata: 'test' },
        };

        const result = service.addNode(graph, nodeConfig);

        expect(result).toBeTruthy();
        expect(result?.id).toBe('test-node-2');
        expect(result?.getZIndex()).toBe(5);
        expect(result?.getPorts()).toHaveLength(1);
      });

      it('should suppress logging when logOperation is false', () => {
        const nodeConfig: NodeCreationConfig = {
          id: 'test-node-3',
          shape: 'rect',
          x: 100,
          y: 100,
          width: 120,
          height: 80,
        };

        const result = service.addNode(graph, nodeConfig, { logOperation: false });

        expect(result).toBeTruthy();
        expect(mockLogger.debugComponent).not.toHaveBeenCalled();
      });

      it('should handle errors and throw by default', () => {
        // Create a config with invalid shape to cause an error
        const nodeConfig: NodeCreationConfig = {
          id: 'test-node-error',
          shape: 'invalid-shape' as any,
          x: 100,
          y: 100,
          width: 120,
          height: 80,
        };

        // Mock graph.addNode to throw an error
        const originalAddNode = graph.addNode;
        graph.addNode = vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        });

        expect(() => service.addNode(graph, nodeConfig)).toThrow('Test error');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error adding node',
          expect.objectContaining({
            nodeId: 'test-node-error',
          }),
        );

        // Restore original method
        graph.addNode = originalAddNode;
      });

      it('should suppress errors and return null when suppressErrors is true', () => {
        const nodeConfig: NodeCreationConfig = {
          id: 'test-node-suppress',
          shape: 'rect',
          x: 100,
          y: 100,
          width: 120,
          height: 80,
        };

        // Mock graph.addNode to throw an error
        const originalAddNode = graph.addNode;
        graph.addNode = vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        });

        const result = service.addNode(graph, nodeConfig, { suppressErrors: true });

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();

        // Restore original method
        graph.addNode = originalAddNode;
      });
    });

    describe('removeNode', () => {
      let testNode: Node;

      beforeEach(() => {
        testNode = graph.addNode({
          id: 'remove-test-node',
          shape: 'rect',
          x: 100,
          y: 100,
          width: 120,
          height: 80,
        });
      });

      it('should successfully remove an existing node', () => {
        const result = service.removeNode(graph, 'remove-test-node');

        expect(result).toBe(true);
        expect(graph.getCellById('remove-test-node')).toBeNull();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Removing node',
          { nodeId: 'remove-test-node' },
        );
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Node removed successfully',
          { nodeId: 'remove-test-node' },
        );
      });

      it('should return false for non-existent node', () => {
        const result = service.removeNode(graph, 'non-existent-node');

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('Node not found for removal', {
          nodeId: 'non-existent-node',
        });
      });

      it('should return false when trying to remove an edge ID', () => {
        // Add an edge first
        const targetNode = graph.addNode({
          id: 'target-node',
          shape: 'rect',
          x: 200,
          y: 200,
          width: 120,
          height: 80,
        });
        graph.addEdge({
          id: 'test-edge',
          source: testNode,
          target: targetNode,
        });

        const result = service.removeNode(graph, 'test-edge');

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('Node not found for removal', {
          nodeId: 'test-edge',
        });
      });

      it('should suppress logging when logOperation is false', () => {
        const result = service.removeNode(graph, 'remove-test-node', { logOperation: false });

        expect(result).toBe(true);
        expect(mockLogger.debugComponent).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Operations', () => {
    let sourceNode: Node;
    let targetNode: Node;

    beforeEach(() => {
      sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      });
      targetNode = graph.addNode({
        id: 'target-node',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 120,
        height: 80,
      });
    });

    describe('addEdge', () => {
      it('should successfully add an edge to the graph', () => {
        const edgeConfig: EdgeCreationConfig = {
          id: 'test-edge-1',
          source: { cell: 'source-node' },
          target: { cell: 'target-node' },
        };

        const result = service.addEdge(graph, edgeConfig);

        expect(result).toBeTruthy();
        expect(result?.id).toBe('test-edge-1');
        expect(result?.isEdge()).toBe(true);
        expect(graph.getCellById('test-edge-1')).toBeTruthy();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Adding edge',
          expect.objectContaining({
            edgeId: 'test-edge-1',
            source: { cell: 'source-node' },
            target: { cell: 'target-node' },
          }),
        );
      });

      it('should add edge with all optional properties', () => {
        const edgeConfig: EdgeCreationConfig = {
          id: 'test-edge-2',
          shape: 'edge',
          source: { cell: 'source-node', port: 'right' },
          target: { cell: 'target-node', port: 'left' },
          labels: [{ attrs: { text: { text: 'Edge Label' } } }],
          vertices: [{ x: 200, y: 150 }],
          zIndex: 3,
          attrs: { line: { stroke: 'red' } },
          data: { metadata: 'edge-data' },
        };

        const result = service.addEdge(graph, edgeConfig);

        expect(result).toBeTruthy();
        expect(result?.id).toBe('test-edge-2');
        expect(result?.getZIndex()).toBe(3);
        expect(result?.getVertices()).toHaveLength(1);
      });

      it('should handle errors and throw by default', () => {
        const edgeConfig: EdgeCreationConfig = {
          id: 'test-edge-error',
          source: { cell: 'source-node' },
          target: { cell: 'target-node' },
        };

        // Mock graph.addEdge to throw an error
        const originalAddEdge = graph.addEdge;
        graph.addEdge = vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        });

        expect(() => service.addEdge(graph, edgeConfig)).toThrow('Test error');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error adding edge',
          expect.objectContaining({
            edgeId: 'test-edge-error',
          }),
        );

        // Restore original method
        graph.addEdge = originalAddEdge;
      });

      it('should suppress errors and return null when suppressErrors is true', () => {
        const edgeConfig: EdgeCreationConfig = {
          id: 'test-edge-suppress',
          source: { cell: 'source-node' },
          target: { cell: 'target-node' },
        };

        // Mock graph.addEdge to throw an error
        const originalAddEdge = graph.addEdge;
        graph.addEdge = vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        });

        const result = service.addEdge(graph, edgeConfig, { suppressErrors: true });

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();

        // Restore original method
        graph.addEdge = originalAddEdge;
      });
    });

    describe('removeEdge', () => {
      beforeEach(() => {
        graph.addEdge({
          id: 'remove-test-edge',
          source: sourceNode,
          target: targetNode,
        });
      });

      it('should successfully remove an existing edge', () => {
        const result = service.removeEdge(graph, 'remove-test-edge');

        expect(result).toBe(true);
        expect(graph.getCellById('remove-test-edge')).toBeNull();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Removing edge',
          { edgeId: 'remove-test-edge' },
        );
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Edge removed successfully',
          { edgeId: 'remove-test-edge' },
        );
      });

      it('should return false for non-existent edge', () => {
        const result = service.removeEdge(graph, 'non-existent-edge');

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('Edge not found for removal', {
          edgeId: 'non-existent-edge',
        });
      });

      it('should return false when trying to remove a node ID', () => {
        const result = service.removeEdge(graph, 'source-node');

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('Edge not found for removal', {
          edgeId: 'source-node',
        });
      });
    });
  });

  describe('Generic Cell Operations', () => {
    let testNode: Node;
    let testEdge: Edge;

    beforeEach(() => {
      testNode = graph.addNode({
        id: 'cell-test-node',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      });
      const targetNode = graph.addNode({
        id: 'cell-target-node',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 120,
        height: 80,
      });
      testEdge = graph.addEdge({
        id: 'cell-test-edge',
        source: testNode,
        target: targetNode,
      });
    });

    describe('removeCell', () => {
      it('should successfully remove a node by ID', () => {
        const result = service.removeCell(graph, 'cell-test-node');

        expect(result).toBe(true);
        expect(graph.getCellById('cell-test-node')).toBeNull();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Removing cell',
          { cellId: 'cell-test-node', cellType: 'node' },
        );
      });

      it('should successfully remove an edge by ID', () => {
        const result = service.removeCell(graph, 'cell-test-edge');

        expect(result).toBe(true);
        expect(graph.getCellById('cell-test-edge')).toBeNull();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Removing cell',
          { cellId: 'cell-test-edge', cellType: 'edge' },
        );
      });

      it('should return false for non-existent cell', () => {
        const result = service.removeCell(graph, 'non-existent-cell');

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('Cell not found for removal', {
          cellId: 'non-existent-cell',
        });
      });
    });

    describe('removeCellObject', () => {
      it('should successfully remove a node object', () => {
        const result = service.removeCellObject(graph, testNode);

        expect(result).toBe(true);
        expect(graph.getCellById('cell-test-node')).toBeNull();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Removing cell object',
          { cellId: 'cell-test-node', cellType: 'node' },
        );
      });

      it('should successfully remove an edge object', () => {
        const result = service.removeCellObject(graph, testEdge);

        expect(result).toBe(true);
        expect(graph.getCellById('cell-test-edge')).toBeNull();
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Removing cell object',
          { cellId: 'cell-test-edge', cellType: 'edge' },
        );
      });

      it('should handle errors gracefully', () => {
        // Mock graph.removeCell to throw an error
        const originalRemoveCell = graph.removeCell;
        graph.removeCell = vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        });

        const result = service.removeCellObject(graph, testNode, { suppressErrors: true });

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error removing cell object',
          expect.objectContaining({
            cellId: 'cell-test-node',
          }),
        );

        // Restore original method
        graph.removeCell = originalRemoveCell;
      });
    });
  });

  describe('Utility Operations', () => {
    let testNode: Node;

    beforeEach(() => {
      testNode = graph.addNode({
        id: 'utility-test-node',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      });
      const targetNode = graph.addNode({
        id: 'utility-target-node',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 120,
        height: 80,
      });
      graph.addEdge({
        id: 'utility-test-edge',
        source: testNode,
        target: targetNode,
      });
    });

    describe('cellExists', () => {
      it('should return true for existing cell', () => {
        expect(service.cellExists(graph, 'utility-test-node')).toBe(true);
        expect(service.cellExists(graph, 'utility-test-edge')).toBe(true);
      });

      it('should return false for non-existent cell', () => {
        expect(service.cellExists(graph, 'non-existent-cell')).toBe(false);
      });
    });

    describe('getCell', () => {
      it('should return cell for existing ID', () => {
        const node = service.getCell(graph, 'utility-test-node');
        const edge = service.getCell(graph, 'utility-test-edge');

        expect(node).toBeTruthy();
        expect(node?.id).toBe('utility-test-node');
        expect(edge).toBeTruthy();
        expect(edge?.id).toBe('utility-test-edge');
      });

      it('should return null for non-existent cell', () => {
        const result = service.getCell(graph, 'non-existent-cell');
        expect(result).toBeNull();
      });
    });

    describe('getNode', () => {
      it('should return node for existing node ID', () => {
        const result = service.getNode(graph, 'utility-test-node');

        expect(result).toBeTruthy();
        expect(result?.id).toBe('utility-test-node');
        expect(result?.isNode()).toBe(true);
      });

      it('should return null for edge ID', () => {
        const result = service.getNode(graph, 'utility-test-edge');
        expect(result).toBeNull();
      });

      it('should return null for non-existent ID', () => {
        const result = service.getNode(graph, 'non-existent-node');
        expect(result).toBeNull();
      });
    });

    describe('getEdge', () => {
      it('should return edge for existing edge ID', () => {
        const result = service.getEdge(graph, 'utility-test-edge');

        expect(result).toBeTruthy();
        expect(result?.id).toBe('utility-test-edge');
        expect(result?.isEdge()).toBe(true);
      });

      it('should return null for node ID', () => {
        const result = service.getEdge(graph, 'utility-test-node');
        expect(result).toBeNull();
      });

      it('should return null for non-existent ID', () => {
        const result = service.getEdge(graph, 'non-existent-edge');
        expect(result).toBeNull();
      });
    });

    describe('clearGraph', () => {
      it('should clear all cells from the graph', () => {
        expect(graph.getCells()).toHaveLength(3); // 2 nodes + 1 edge

        service.clearGraph(graph);

        expect(graph.getCells()).toHaveLength(0);
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Clearing graph',
        );
        expect(mockLogger.debugComponent).toHaveBeenCalledWith(
          'X6CoreOperations',
          'Graph cleared successfully',
        );
      });

      it('should suppress logging when logOperation is false', () => {
        service.clearGraph(graph, { logOperation: false });

        expect(graph.getCells()).toHaveLength(0);
        expect(mockLogger.debugComponent).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling and Options', () => {
    it('should respect suppressErrors option across all methods', () => {
      // Add actual nodes and edges to the graph first
      const testNode = graph.addNode({
        id: 'remove-error-node',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      });
      const targetNode = graph.addNode({
        id: 'remove-error-target',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 120,
        height: 80,
      });
      graph.addEdge({
        id: 'remove-error-edge',
        source: testNode,
        target: targetNode,
      });

      const nodeConfig: NodeCreationConfig = {
        id: 'error-node',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      };

      const edgeConfig: EdgeCreationConfig = {
        id: 'error-edge',
        source: { cell: 'source' },
        target: { cell: 'target' },
      };

      // Mock all graph methods to throw errors
      const originalAddNode = graph.addNode;
      const originalAddEdge = graph.addEdge;
      const originalRemoveNode = graph.removeNode;
      const originalRemoveEdge = graph.removeEdge;
      const originalRemoveCell = graph.removeCell;

      graph.addNode = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      graph.addEdge = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      graph.removeNode = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      graph.removeEdge = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      graph.removeCell = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // All operations should return false/null instead of throwing
      expect(service.addNode(graph, nodeConfig, { suppressErrors: true })).toBeNull();
      expect(service.addEdge(graph, edgeConfig, { suppressErrors: true })).toBeNull();
      expect(service.removeNode(graph, 'remove-error-node', { suppressErrors: true })).toBe(false);
      expect(service.removeEdge(graph, 'remove-error-edge', { suppressErrors: true })).toBe(false);
      expect(service.removeCell(graph, 'remove-error-target', { suppressErrors: true })).toBe(
        false,
      );

      // Only addNode and addEdge will error (3 operations that actually find cells to remove won't error due to early returns)
      expect(mockLogger.error).toHaveBeenCalledTimes(5);

      // Restore original methods
      graph.addNode = originalAddNode;
      graph.addEdge = originalAddEdge;
      graph.removeNode = originalRemoveNode;
      graph.removeEdge = originalRemoveEdge;
      graph.removeCell = originalRemoveCell;
    });

    it('should respect logOperation option across all methods', () => {
      const container = document.createElement('div');
      const workingGraph = new Graph({ container });

      const testNode = workingGraph.addNode({
        id: 'log-test-node',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      });
      const targetNode = workingGraph.addNode({
        id: 'log-target-node',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 120,
        height: 80,
      });
      workingGraph.addEdge({
        id: 'log-test-edge',
        source: testNode,
        target: targetNode,
      });

      const nodeConfig: NodeCreationConfig = {
        id: 'new-log-node',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      };

      const edgeConfig: EdgeCreationConfig = {
        id: 'new-log-edge',
        source: { cell: 'log-test-node' },
        target: { cell: 'log-target-node' },
      };

      // Reset mock call counts
      vi.clearAllMocks();

      // All operations with logOperation: false should not log
      service.addNode(workingGraph, nodeConfig, { logOperation: false });
      service.removeNode(workingGraph, 'new-log-node', { logOperation: false });
      service.addEdge(workingGraph, edgeConfig, { logOperation: false });
      service.removeEdge(workingGraph, 'new-log-edge', { logOperation: false });
      service.removeCell(workingGraph, 'log-test-node', { logOperation: false });
      service.clearGraph(workingGraph, { logOperation: false });

      // No debug, info, or warn calls should have been made
      expect(mockLogger.debugComponent).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();

      workingGraph.dispose();
    });
  });
});
