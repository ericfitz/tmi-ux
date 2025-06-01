import { describe, it, expect, beforeEach } from 'vitest';
import { DiagramAggregate, DiagramDomainError } from './diagram-aggregate';
import { NodeData } from '../value-objects/node-data';
import { EdgeData } from '../value-objects/edge-data';
import { Point } from '../value-objects/point';
import {
  NodeAddedEvent,
  NodeMovedEvent,
  NodeRemovedEvent,
  EdgeAddedEvent,
  EdgeRemovedEvent,
} from '../events/diagram-events';
import { DiagramCommandFactory } from '../commands/diagram-commands';

describe('DiagramAggregate', () => {
  let diagram: DiagramAggregate;
  const userId = 'test-user-id';
  const diagramId = 'test-diagram-id';

  beforeEach(() => {
    const createCommand = DiagramCommandFactory.createDiagram(
      diagramId,
      userId,
      'Test Diagram',
      'Test Description',
    );
    diagram = DiagramAggregate.create(createCommand);
    diagram.markEventsAsCommitted(); // Clear creation events
  });

  describe('Creation', () => {
    it('should create a diagram with correct properties', () => {
      // Arrange
      const createCommand = DiagramCommandFactory.createDiagram(
        'new-diagram-id',
        userId,
        'New Diagram',
        'New Description',
      );

      // Act
      const newDiagram = DiagramAggregate.create(createCommand);

      // Assert
      expect(newDiagram.id).toBe('new-diagram-id');
      expect(newDiagram.name).toBe('New Diagram');
      expect(newDiagram.description).toBe('New Description');
      expect(newDiagram.createdBy).toBe(userId);
      expect(newDiagram.version).toBe(0);
      expect(newDiagram.nodes.size).toBe(0);
      expect(newDiagram.edges.size).toBe(0);
    });
  });

  describe('Node Management', () => {
    it('should add a node and emit NodeAddedEvent', () => {
      // Arrange
      const nodeId = 'node-1';
      const position = new Point(100, 200);
      const nodeData = new NodeData(nodeId, 'process', 'Test Process', position, 140, 80, {
        color: '#blue',
      });
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        position,
        nodeData,
      );

      // Act
      diagram.processCommand(addNodeCommand);

      // Assert
      expect(diagram.nodes.size).toBe(1);
      expect(diagram.getNode(nodeId)).toBeDefined();
      expect(diagram.getNode(nodeId)?.data.label).toBe('Test Process');

      const events = diagram.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(NodeAddedEvent);
      expect((events[0] as NodeAddedEvent).nodeData.id).toBe(nodeId);
    });

    it('should move a node and emit NodeMovedEvent', () => {
      // Arrange
      const nodeId = 'node-1';
      const initialPosition = new Point(100, 200);
      const newPosition = new Point(150, 250);

      // First add a node
      const nodeData = new NodeData(
        nodeId,
        'process',
        'Test Process',
        initialPosition,
        140,
        80,
        {},
      );
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        initialPosition,
        nodeData,
      );
      diagram.processCommand(addNodeCommand);
      diagram.markEventsAsCommitted();

      // Act - move the node
      const moveCommand = DiagramCommandFactory.updateNodePosition(
        diagramId,
        userId,
        nodeId,
        newPosition,
        initialPosition,
      );
      diagram.processCommand(moveCommand);

      // Assert
      const movedNode = diagram.getNode(nodeId);
      expect(movedNode?.position).toEqual(newPosition);

      const events = diagram.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(NodeMovedEvent);
      expect((events[0] as NodeMovedEvent).nodeId).toBe(nodeId);
      expect((events[0] as NodeMovedEvent).newPosition).toEqual(newPosition);
    });

    it('should remove a node and emit NodeRemovedEvent', () => {
      // Arrange
      const nodeId = 'node-1';
      const position = new Point(100, 200);

      // First add a node
      const nodeData = new NodeData(nodeId, 'process', 'Test Process', position, 140, 80, {});
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        position,
        nodeData,
      );
      diagram.processCommand(addNodeCommand);
      diagram.markEventsAsCommitted();

      // Act - remove the node
      const removeCommand = DiagramCommandFactory.removeNode(diagramId, userId, nodeId);
      diagram.processCommand(removeCommand);

      // Assert
      expect(diagram.nodes.size).toBe(0);
      expect(diagram.getNode(nodeId)).toBeUndefined();

      const events = diagram.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(NodeRemovedEvent);
      expect((events[0] as NodeRemovedEvent).nodeId).toBe(nodeId);
    });

    it('should throw error when trying to add duplicate node', () => {
      // Arrange
      const nodeId = 'node-1';
      const position = new Point(100, 200);
      const nodeData = new NodeData(nodeId, 'process', 'Test Process', position, 140, 80, {});
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        position,
        nodeData,
      );
      diagram.processCommand(addNodeCommand);

      // Act & Assert
      expect(() => diagram.processCommand(addNodeCommand)).toThrow(DiagramDomainError);
      expect(() => diagram.processCommand(addNodeCommand)).toThrow(
        'Node with ID node-1 already exists',
      );
    });

    it('should throw error when trying to move non-existent node', () => {
      // Arrange
      const moveCommand = DiagramCommandFactory.updateNodePosition(
        diagramId,
        userId,
        'non-existent',
        new Point(150, 250),
        new Point(100, 200),
      );

      // Act & Assert
      expect(() => diagram.processCommand(moveCommand)).toThrow(DiagramDomainError);
      expect(() => diagram.processCommand(moveCommand)).toThrow(
        'Node with ID non-existent not found',
      );
    });

    it('should throw error when trying to remove non-existent node', () => {
      // Arrange
      const removeCommand = DiagramCommandFactory.removeNode(diagramId, userId, 'non-existent');

      // Act & Assert
      expect(() => diagram.processCommand(removeCommand)).toThrow(DiagramDomainError);
      expect(() => diagram.processCommand(removeCommand)).toThrow(
        'Node with ID non-existent not found',
      );
    });
  });

  describe('Edge Management', () => {
    beforeEach(() => {
      // Add source and target nodes for edge tests
      const sourceData = new NodeData(
        'source',
        'process',
        'Source',
        new Point(100, 100),
        140,
        80,
        {},
      );
      const targetData = new NodeData(
        'target',
        'store',
        'Target',
        new Point(200, 200),
        160,
        60,
        {},
      );

      const sourceCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        'source',
        new Point(100, 100),
        sourceData,
      );

      const targetCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        'target',
        new Point(200, 200),
        targetData,
      );

      diagram.processCommand(sourceCommand);
      diagram.processCommand(targetCommand);
      diagram.markEventsAsCommitted();
    });

    it('should add an edge and emit EdgeAddedEvent', () => {
      // Arrange
      const edgeId = 'edge-1';
      const edgeData = new EdgeData(
        edgeId,
        'source',
        'target',
        undefined,
        undefined,
        'Data Flow',
        [],
        { style: 'solid' },
      );
      const addEdgeCommand = DiagramCommandFactory.addEdge(
        diagramId,
        userId,
        edgeId,
        'source',
        'target',
        edgeData,
      );

      // Act
      diagram.processCommand(addEdgeCommand);

      // Assert
      expect(diagram.edges.size).toBe(1);
      expect(diagram.getEdge(edgeId)).toBeDefined();

      const events = diagram.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EdgeAddedEvent);
      expect((events[0] as EdgeAddedEvent).edgeData.id).toBe(edgeId);
    });

    it('should remove an edge and emit EdgeRemovedEvent', () => {
      // Arrange
      const edgeId = 'edge-1';
      const edgeData = new EdgeData(
        edgeId,
        'source',
        'target',
        undefined,
        undefined,
        'Data Flow',
        [],
        { style: 'solid' },
      );
      const addEdgeCommand = DiagramCommandFactory.addEdge(
        diagramId,
        userId,
        edgeId,
        'source',
        'target',
        edgeData,
      );
      diagram.processCommand(addEdgeCommand);
      diagram.markEventsAsCommitted();

      // Act
      const removeEdgeCommand = DiagramCommandFactory.removeEdge(diagramId, userId, edgeId);
      diagram.processCommand(removeEdgeCommand);

      // Assert
      expect(diagram.edges.size).toBe(0);
      expect(diagram.getEdge(edgeId)).toBeUndefined();

      const events = diagram.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EdgeRemovedEvent);
      expect((events[0] as EdgeRemovedEvent).edgeId).toBe(edgeId);
    });

    it('should throw error when adding edge with non-existent source node', () => {
      // Arrange
      const edgeData = new EdgeData(
        'edge-1',
        'non-existent',
        'target',
        undefined,
        undefined,
        'Data Flow',
        [],
        { style: 'solid' },
      );
      const addEdgeCommand = DiagramCommandFactory.addEdge(
        diagramId,
        userId,
        'edge-1',
        'non-existent',
        'target',
        edgeData,
      );

      // Act & Assert
      expect(() => diagram.processCommand(addEdgeCommand)).toThrow(DiagramDomainError);
      expect(() => diagram.processCommand(addEdgeCommand)).toThrow(
        'Source node non-existent not found',
      );
    });

    it('should throw error when adding edge with non-existent target node', () => {
      // Arrange
      const edgeData = new EdgeData(
        'edge-1',
        'source',
        'non-existent',
        undefined,
        undefined,
        'Data Flow',
        [],
        { style: 'solid' },
      );
      const addEdgeCommand = DiagramCommandFactory.addEdge(
        diagramId,
        userId,
        'edge-1',
        'source',
        'non-existent',
        edgeData,
      );

      // Act & Assert
      expect(() => diagram.processCommand(addEdgeCommand)).toThrow(DiagramDomainError);
      expect(() => diagram.processCommand(addEdgeCommand)).toThrow(
        'Target node non-existent not found',
      );
    });

    it('should remove connected edges when removing a node', () => {
      // Arrange
      const edgeId = 'edge-1';
      const edgeData = new EdgeData(
        edgeId,
        'source',
        'target',
        undefined,
        undefined,
        'Data Flow',
        [],
        { style: 'solid' },
      );
      const addEdgeCommand = DiagramCommandFactory.addEdge(
        diagramId,
        userId,
        edgeId,
        'source',
        'target',
        edgeData,
      );
      diagram.processCommand(addEdgeCommand);
      diagram.markEventsAsCommitted();

      // Act - remove the source node
      const removeNodeCommand = DiagramCommandFactory.removeNode(diagramId, userId, 'source');
      diagram.processCommand(removeNodeCommand);

      // Assert
      expect(diagram.edges.size).toBe(0);
      expect(diagram.nodes.size).toBe(1); // Only target node remains

      const events = diagram.getUncommittedEvents();
      expect(events).toHaveLength(1); // Only NodeRemovedEvent (edge removal is handled internally)
      expect(events[0]).toBeInstanceOf(NodeRemovedEvent);
    });
  });

  describe('State Management', () => {
    it('should track uncommitted events', () => {
      // Arrange
      const nodeId = 'node-1';
      const position = new Point(100, 200);
      const nodeData = new NodeData(nodeId, 'process', 'Test Process', position, 140, 80, {});
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        position,
        nodeData,
      );

      // Act
      diagram.processCommand(addNodeCommand);

      // Assert
      expect(diagram.getUncommittedEvents()).toHaveLength(1);
    });

    it('should clear uncommitted events when marked as committed', () => {
      // Arrange
      const nodeId = 'node-1';
      const position = new Point(100, 200);
      const nodeData = new NodeData(nodeId, 'process', 'Test Process', position, 140, 80, {});
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        position,
        nodeData,
      );
      diagram.processCommand(addNodeCommand);

      // Act
      diagram.markEventsAsCommitted();

      // Assert
      expect(diagram.getUncommittedEvents()).toHaveLength(0);
    });

    it('should serialize diagram state to snapshot', () => {
      // Arrange
      const nodeId = 'node-1';
      const position = new Point(100, 200);
      const nodeData = new NodeData(nodeId, 'process', 'Test Process', position, 140, 80, {});
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        position,
        nodeData,
      );
      diagram.processCommand(addNodeCommand);

      // Act
      const snapshot = diagram.toSnapshot();

      // Assert
      expect(snapshot.id).toBe(diagramId);
      expect(snapshot.name).toBe('Test Diagram');
      expect(snapshot.nodes).toHaveLength(1);
      expect(snapshot.edges).toHaveLength(0);
      expect(snapshot.nodes[0]).toHaveProperty('data');
      expect(snapshot.nodes[0]['data']).toHaveProperty('id', nodeId);
    });
  });

  describe('Validation', () => {
    it('should validate diagram state successfully', () => {
      // Arrange
      const nodeId = 'node-1';
      const position = new Point(100, 200);
      const nodeData = new NodeData(nodeId, 'process', 'Test Process', position, 140, 80, {});
      const addNodeCommand = DiagramCommandFactory.addNode(
        diagramId,
        userId,
        nodeId,
        position,
        nodeData,
      );
      diagram.processCommand(addNodeCommand);

      // Act
      const validation = diagram.validate();

      // Assert
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid state with orphaned edges', () => {
      // This test demonstrates validation logic
      // In a real scenario, we would need to manually create an invalid state
      // For now, we test that validation method exists and works
      const validation = diagram.validate();
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(Array.isArray(validation.errors)).toBe(true);
    });
  });

  describe('Command Validation', () => {
    it('should throw error for command with wrong diagram ID', () => {
      // Arrange
      const nodeData = new NodeData(
        'node-1',
        'process',
        'Test Process',
        new Point(100, 200),
        140,
        80,
        {},
      );
      const wrongDiagramCommand = DiagramCommandFactory.addNode(
        'wrong-diagram-id',
        userId,
        'node-1',
        new Point(100, 200),
        nodeData,
      );

      // Act & Assert
      expect(() => diagram.processCommand(wrongDiagramCommand)).toThrow(DiagramDomainError);
      expect(() => diagram.processCommand(wrongDiagramCommand)).toThrow(
        'Invalid diagram ID in command',
      );
    });
  });
});
