// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Graph, Node, Edge } from '@antv/x6';
import { InfraPortStateService } from './infra-port-state.service';
import { InfraEdgeQueryService } from './infra-edge-query.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Mock SVG methods for X6 compatibility
const mockMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
  inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  multiply: vi.fn().mockReturnThis(),
  translate: vi.fn().mockReturnThis(),
  scale: vi.fn().mockReturnThis(),
  rotate: vi.fn().mockReturnThis(),
};

Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

describe('InfraPortStateService', () => {
  let service: InfraPortStateService;
  let mockEdgeQueryService: InfraEdgeQueryService;
  let mockLogger: MockLoggerService;
  let graph: Graph;
  let container: HTMLElement;

  beforeEach(() => {
    // Create mock logger
    mockLogger = createTypedMockLoggerService();

    // Create mock InfraEdgeQueryService
    mockEdgeQueryService = {
      isPortConnected: vi.fn(),
      findEdgesConnectedToPort: vi.fn(),
      findEdgesConnectedToNode: vi.fn(),
      getConnectedPorts: vi.fn(),
    } as any;

    // Create service instance
    service = new InfraPortStateService(mockEdgeQueryService, mockLogger);

    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create graph
    graph = new Graph({
      container,
      width: 800,
      height: 600,
    });
  });

  afterEach(() => {
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

  describe('Port Visibility Updates', () => {
    let node: Node;

    beforeEach(() => {
      node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port1', group: 'top' },
          { id: 'port2', group: 'bottom' },
          { id: 'port3', group: 'left' },
        ],
      });
    });

    it('should update node port visibility based on connection status', () => {
      // Mock port connection status
      vi.mocked(mockEdgeQueryService.isPortConnected)
        .mockReturnValueOnce(true) // port1 connected
        .mockReturnValueOnce(false) // port2 not connected
        .mockReturnValueOnce(true); // port3 connected

      const setPortPropSpy = vi.spyOn(node, 'setPortProp');

      service.updateNodePortVisibility(graph, node);

      // Verify port visibility updates
      expect(setPortPropSpy).toHaveBeenCalledWith(
        'port1',
        'attrs/circle/style/visibility',
        'visible',
      );
      expect(setPortPropSpy).toHaveBeenCalledWith(
        'port2',
        'attrs/circle/style/visibility',
        'hidden',
      );
      expect(setPortPropSpy).toHaveBeenCalledWith(
        'port3',
        'attrs/circle/style/visibility',
        'visible',
      );

      // Verify InfraEdgeQueryService calls
      expect(mockEdgeQueryService.isPortConnected).toHaveBeenCalledWith(graph, node.id, 'port1');
      expect(mockEdgeQueryService.isPortConnected).toHaveBeenCalledWith(graph, node.id, 'port2');
      expect(mockEdgeQueryService.isPortConnected).toHaveBeenCalledWith(graph, node.id, 'port3');

      // Verify logging is commented out in service, so no logging expectations
    });

    it('should handle nodes without ports gracefully', () => {
      const nodeWithoutPorts = graph.addNode({
        shape: 'rect',
        x: 200,
        y: 200,
        width: 100,
        height: 50,
      });

      service.updateNodePortVisibility(graph, nodeWithoutPorts);

      // Should not call InfraEdgeQueryService for nodes without ports
      expect(mockEdgeQueryService.isPortConnected).not.toHaveBeenCalled();
    });

    it('should handle null or undefined graph gracefully', () => {
      service.updateNodePortVisibility(null as any, node);
      service.updateNodePortVisibility(undefined as any, node);

      expect(mockEdgeQueryService.isPortConnected).not.toHaveBeenCalled();
    });

    it('should handle null or undefined node gracefully', () => {
      service.updateNodePortVisibility(graph, null as any);
      service.updateNodePortVisibility(graph, undefined as any);

      expect(mockEdgeQueryService.isPortConnected).not.toHaveBeenCalled();
    });

    it('should show all ports on all nodes', () => {
      const node2 = graph.addNode({
        shape: 'ellipse',
        x: 300,
        y: 300,
        width: 80,
        height: 80,
        ports: [
          { id: 'port4', group: 'top' },
          { id: 'port5', group: 'bottom' },
        ],
      });

      const setPortProp1Spy = vi.spyOn(node, 'setPortProp');
      const setPortProp2Spy = vi.spyOn(node2, 'setPortProp');

      service.showAllPorts(graph);

      // Verify all ports are made visible
      expect(setPortProp1Spy).toHaveBeenCalledWith(
        'port1',
        'attrs/circle/style/visibility',
        'visible',
      );
      expect(setPortProp1Spy).toHaveBeenCalledWith(
        'port2',
        'attrs/circle/style/visibility',
        'visible',
      );
      expect(setPortProp1Spy).toHaveBeenCalledWith(
        'port3',
        'attrs/circle/style/visibility',
        'visible',
      );
      expect(setPortProp2Spy).toHaveBeenCalledWith(
        'port4',
        'attrs/circle/style/visibility',
        'visible',
      );
      expect(setPortProp2Spy).toHaveBeenCalledWith(
        'port5',
        'attrs/circle/style/visibility',
        'visible',
      );

      // Verify logging is commented out in service, so no logging expectations
    });

    it('should hide unconnected ports on all nodes', () => {
      const node2 = graph.addNode({
        shape: 'ellipse',
        x: 300,
        y: 300,
        width: 80,
        height: 80,
        ports: [
          { id: 'port4', group: 'top' },
          { id: 'port5', group: 'bottom' },
        ],
      });

      // Spy on setPortProp for both nodes
      const setPortProp1Spy = vi.spyOn(node, 'setPortProp');
      const setPortProp2Spy = vi.spyOn(node2, 'setPortProp');

      // Mock connection status for all ports
      vi.mocked(mockEdgeQueryService.isPortConnected)
        .mockReturnValueOnce(true) // node1 port1 connected
        .mockReturnValueOnce(false) // node1 port2 not connected
        .mockReturnValueOnce(false) // node1 port3 not connected
        .mockReturnValueOnce(false) // node2 port4 not connected
        .mockReturnValueOnce(true); // node2 port5 connected

      service.hideUnconnectedPorts(graph);

      // Verify connected ports remain visible
      expect(setPortProp1Spy).toHaveBeenCalledWith(
        'port1',
        'attrs/circle/style/visibility',
        'visible',
      );
      expect(setPortProp2Spy).toHaveBeenCalledWith(
        'port5',
        'attrs/circle/style/visibility',
        'visible',
      );

      // Verify unconnected ports are hidden
      expect(setPortProp1Spy).toHaveBeenCalledWith(
        'port2',
        'attrs/circle/style/visibility',
        'hidden',
      );
      expect(setPortProp1Spy).toHaveBeenCalledWith(
        'port3',
        'attrs/circle/style/visibility',
        'hidden',
      );
      expect(setPortProp2Spy).toHaveBeenCalledWith(
        'port4',
        'attrs/circle/style/visibility',
        'hidden',
      );

      // Verify isPortConnected was called for all ports
      expect(mockEdgeQueryService.isPortConnected).toHaveBeenCalledTimes(5);
    });

    it('should handle empty graph gracefully', () => {
      const emptyGraph = new Graph({
        container: document.createElement('div'),
        width: 400,
        height: 400,
      });

      // Spy on graph.getNodes to verify it's called
      const getNodesSpy = vi.spyOn(emptyGraph, 'getNodes');

      // Should not throw errors
      expect(() => {
        service.showAllPorts(emptyGraph);
        service.hideUnconnectedPorts(emptyGraph);
      }).not.toThrow();

      // Verify getNodes was called for both operations
      expect(getNodesSpy).toHaveBeenCalledTimes(2);

      // Verify no port operations were attempted (since there are no nodes)
      expect(mockEdgeQueryService.isPortConnected).not.toHaveBeenCalled();

      emptyGraph.dispose();
    });
  });

  describe('Connected Port Visibility', () => {
    let sourceNode: Node;
    let targetNode: Node;
    let edge: Edge;

    beforeEach(() => {
      sourceNode = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'source-port', group: 'right' }],
      });

      targetNode = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'target-port', group: 'left' }],
      });

      edge = graph.addEdge({
        source: { cell: sourceNode.id, port: 'source-port' },
        target: { cell: targetNode.id, port: 'target-port' },
      });
    });

    it('should ensure connected ports are visible for an edge', () => {
      const sourceSetPortPropSpy = vi.spyOn(sourceNode, 'setPortProp');
      const targetSetPortPropSpy = vi.spyOn(targetNode, 'setPortProp');

      service.ensureConnectedPortsVisible(graph, edge);

      // Verify both connected ports are made visible
      expect(sourceSetPortPropSpy).toHaveBeenCalledWith(
        'source-port',
        'attrs/circle/style/visibility',
        'visible',
      );
      expect(targetSetPortPropSpy).toHaveBeenCalledWith(
        'target-port',
        'attrs/circle/style/visibility',
        'visible',
      );

      // Verify that the service logs the edge being processed (this log is active)
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdPortStateManager',
        'Ensuring connected ports are visible for edge',
        {
          edgeId: edge.id,
          sourceCellId: sourceNode.id,
          targetCellId: targetNode.id,
          sourcePortId: 'source-port',
          targetPortId: 'target-port',
        },
      );

      // The "Made source/target port visible" logs are commented out in service
    });

    it('should handle edge with non-existent source port', () => {
      // Create edge with non-existent source port
      const badEdge = graph.addEdge({
        source: { cell: sourceNode.id, port: 'non-existent-port' },
        target: { cell: targetNode.id, port: 'target-port' },
      });

      service.ensureConnectedPortsVisible(graph, badEdge);

      // Should log warning for non-existent source port
      expect(mockLogger.warn).toHaveBeenCalledWith('Source port does not exist on node', {
        edgeId: badEdge.id,
        sourceNodeId: sourceNode.id,
        sourcePortId: 'non-existent-port',
        availablePorts: ['source-port'],
      });
    });

    it('should handle edge with non-existent target port', () => {
      // Create edge with non-existent target port
      const badEdge = graph.addEdge({
        source: { cell: sourceNode.id, port: 'source-port' },
        target: { cell: targetNode.id, port: 'non-existent-port' },
      });

      service.ensureConnectedPortsVisible(graph, badEdge);

      // Should log warning for non-existent target port
      expect(mockLogger.warn).toHaveBeenCalledWith('Target port does not exist on node', {
        edgeId: badEdge.id,
        targetNodeId: targetNode.id,
        targetPortId: 'non-existent-port',
        availablePorts: ['target-port'],
      });
    });

    it('should handle edge with missing source or target cells', () => {
      // Create edge with missing target
      const incompleteEdge = graph.addEdge({
        source: { cell: sourceNode.id, port: 'source-port' },
        target: { x: 400, y: 200 }, // Point target instead of cell
      });

      service.ensureConnectedPortsVisible(graph, incompleteEdge);

      // Should handle gracefully without errors
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdPortStateManager',
        'Ensuring connected ports are visible for edge',
        expect.any(Object),
      );
    });

    it('should handle null or undefined parameters gracefully', () => {
      service.ensureConnectedPortsVisible(null as any, edge);
      service.ensureConnectedPortsVisible(graph, null as any);
      service.ensureConnectedPortsVisible(null as any, null as any);

      // Should not throw errors or make any port changes
      expect(mockLogger.debugComponent).not.toHaveBeenCalled();
    });
  });

  describe('Port Connection State Management', () => {
    let node: Node;

    beforeEach(() => {
      node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port1', group: 'top' },
          { id: 'port2', group: 'bottom' },
        ],
      });
    });

    it('should check if a port is connected', () => {
      vi.mocked(mockEdgeQueryService.isPortConnected).mockReturnValue(true);

      const result = service.isPortConnected(graph, node.id, 'port1');

      expect(result).toBe(true);
      expect(mockEdgeQueryService.isPortConnected).toHaveBeenCalledWith(graph, node.id, 'port1');
    });

    it('should return false for port connection check with null graph', () => {
      const result = service.isPortConnected(null as any, node.id, 'port1');

      expect(result).toBe(false);
      expect(mockEdgeQueryService.isPortConnected).not.toHaveBeenCalled();
    });

    it('should get port connection state for a node', () => {
      // First update port visibility to create state
      vi.mocked(mockEdgeQueryService.isPortConnected)
        .mockReturnValueOnce(true) // port1 connected
        .mockReturnValueOnce(false); // port2 not connected

      service.updateNodePortVisibility(graph, node);

      const state = service.getPortConnectionState(node.id);

      expect(state).toBeTruthy();
      expect(state!.nodeId).toBe(node.id);
      expect(state!.connectedPorts).toContain('port1');
      expect(state!.connectedPorts).not.toContain('port2');
      expect(state!.visiblePorts).toContain('port1');
      expect(state!.visiblePorts).not.toContain('port2');
      expect(state!.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return null for non-existent node state', () => {
      const state = service.getPortConnectionState('non-existent-node');

      expect(state).toBeNull();
    });

    it('should handle connection changes by updating all nodes', () => {
      graph.addNode({
        shape: 'ellipse',
        x: 300,
        y: 300,
        width: 80,
        height: 80,
        ports: [{ id: 'port3', group: 'top' }],
      });

      // Mock connection status
      vi.mocked(mockEdgeQueryService.isPortConnected).mockReturnValue(false); // All ports disconnected

      service.onConnectionChange(graph);

      // Verify all nodes were processed
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdPortStateManager',
        'Updated port visibility after connection change',
        {
          nodeCount: 2,
        },
      );
    });

    it('should handle connection change with null graph gracefully', () => {
      service.onConnectionChange(null as any);

      // Should not throw errors
      expect(mockLogger.debugComponent).not.toHaveBeenCalled();
    });
  });

  describe('Port State Cache Management', () => {
    let node: Node;

    beforeEach(() => {
      node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port1', group: 'top' },
          { id: 'port2', group: 'bottom' },
        ],
      });
    });

    it('should clear all port states', () => {
      // First create some state
      vi.mocked(mockEdgeQueryService.isPortConnected).mockReturnValue(true);
      service.updateNodePortVisibility(graph, node);

      // Verify state exists
      expect(service.getPortConnectionState(node.id)).toBeTruthy();

      // Clear states
      service.clearPortStates();

      // Verify state is cleared
      expect(service.getPortConnectionState(node.id)).toBeNull();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdPortStateManager',
        'Cleared all port state cache',
      );
    });

    it('should get all port states for debugging', () => {
      // Create state for multiple nodes
      const node2 = graph.addNode({
        shape: 'ellipse',
        x: 300,
        y: 300,
        width: 80,
        height: 80,
        ports: [{ id: 'port3', group: 'top' }],
      });

      vi.mocked(mockEdgeQueryService.isPortConnected).mockReturnValue(true);
      service.updateNodePortVisibility(graph, node);
      service.updateNodePortVisibility(graph, node2);

      const allStates = service.getAllPortStates();

      expect(allStates.size).toBe(2);
      expect(allStates.has(node.id)).toBe(true);
      expect(allStates.has(node2.id)).toBe(true);

      // Verify it returns a copy, not the original map
      allStates.clear();
      expect(service.getAllPortStates().size).toBe(2);
    });

    it('should preserve existing connected ports when showing all ports', () => {
      // First create initial state with some connected ports
      vi.mocked(mockEdgeQueryService.isPortConnected)
        .mockReturnValueOnce(true) // port1 connected
        .mockReturnValueOnce(false); // port2 not connected

      service.updateNodePortVisibility(graph, node);

      // Verify initial state
      let state = service.getPortConnectionState(node.id);
      expect(state!.connectedPorts).toContain('port1');
      expect(state!.connectedPorts).not.toContain('port2');

      // Show all ports
      service.showAllPorts(graph);

      // Verify connected ports are preserved but all ports are now visible
      state = service.getPortConnectionState(node.id);
      expect(state!.connectedPorts).toContain('port1');
      expect(state!.connectedPorts).not.toContain('port2');
      expect(state!.visiblePorts).toContain('port1');
      expect(state!.visiblePorts).toContain('port2');
    });

    it('should update cache when ensuring connected ports are visible', () => {
      const targetNode = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'target-port', group: 'left' }],
      });

      const edge = graph.addEdge({
        source: { cell: node.id, port: 'port1' },
        target: { cell: targetNode.id, port: 'target-port' },
      });

      service.ensureConnectedPortsVisible(graph, edge);

      // Verify cache was updated for both nodes
      const sourceState = service.getPortConnectionState(node.id);
      const targetState = service.getPortConnectionState(targetNode.id);

      expect(sourceState!.connectedPorts).toContain('port1');
      expect(sourceState!.visiblePorts).toContain('port1');
      expect(targetState!.connectedPorts).toContain('target-port');
      expect(targetState!.visiblePorts).toContain('target-port');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle nodes with empty ports array', () => {
      const nodeWithEmptyPorts = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [],
      });

      service.updateNodePortVisibility(graph, nodeWithEmptyPorts);

      // Should not call InfraEdgeQueryService
      expect(mockEdgeQueryService.isPortConnected).not.toHaveBeenCalled();
    });

    it('should handle port IDs that are undefined', () => {
      const nodeWithUndefinedPortId = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { group: 'top' }, // No id property
        ],
      });

      // Should handle gracefully without throwing
      expect(() => {
        service.updateNodePortVisibility(graph, nodeWithUndefinedPortId);
      }).not.toThrow();
    });

    it('should handle concurrent port state updates', () => {
      const node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port1', group: 'top' }],
      });

      vi.mocked(mockEdgeQueryService.isPortConnected).mockReturnValue(true);

      // Simulate concurrent updates
      service.updateNodePortVisibility(graph, node);
      service.updateNodePortVisibility(graph, node);

      const state = service.getPortConnectionState(node.id);
      expect(state).toBeTruthy();
      expect(state!.connectedPorts).toContain('port1');
    });

    it('should handle large numbers of ports efficiently', () => {
      const portsArray = Array.from({ length: 100 }, (_, i) => ({
        id: `port${i}`,
        group: 'top',
      }));

      const nodeWithManyPorts = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: portsArray,
      });

      vi.mocked(mockEdgeQueryService.isPortConnected).mockReturnValue(false);

      const startTime = Date.now();
      service.updateNodePortVisibility(graph, nodeWithManyPorts);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify setPortProp was called for all ports
      const setPortPropSpy = vi.spyOn(nodeWithManyPorts, 'setPortProp');

      // Call service again to capture the spy
      service.updateNodePortVisibility(graph, nodeWithManyPorts);

      // Should have called setPortProp for each of the 100 ports
      expect(setPortPropSpy).toHaveBeenCalledTimes(100);

      // All ports should be hidden since none are connected
      for (let i = 0; i < 100; i++) {
        expect(setPortPropSpy).toHaveBeenCalledWith(
          `port${i}`,
          'attrs/circle/style/visibility',
          'hidden',
        );
      }
    });
  });
});
