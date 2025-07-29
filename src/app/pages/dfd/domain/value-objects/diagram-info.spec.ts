// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach } from 'vitest';
import { DiagramInfo, DiagramType } from './diagram-info';
import { NodeInfo } from './node-info';
import { EdgeInfo } from './edge-info';
import { Metadata } from './metadata';
import { Point } from './point';

describe('DiagramInfo', () => {
  describe('Construction', () => {
    it('should create valid DiagramInfo with all parameters', () => {
      // Arrange
      const id = 'diagram-1';
      const name = 'Test Diagram';
      const type: DiagramType = 'DFD-1.0.0';
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const modifiedAt = new Date('2024-01-01T11:00:00Z');
      const description = 'A test diagram';
      const metadata: Metadata[] = [
        { key: 'category', value: 'test' },
        { key: 'priority', value: 'high' },
      ];

      const node1 = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));
      const node2 = NodeInfo.createDefault('node-2', 'actor', new Point(200, 100));
      const edge = EdgeInfo.createSimple('edge-1', 'node-1', 'node-2', 'Data Flow');
      const cells = [node1, node2, edge];

      // Act
      const diagramInfo = new DiagramInfo(
        id,
        name,
        type,
        createdAt,
        modifiedAt,
        description,
        metadata,
        cells,
      );

      // Assert
      expect(diagramInfo.id).toBe(id);
      expect(diagramInfo.name).toBe(name);
      expect(diagramInfo.type).toBe(type);
      expect(diagramInfo.createdAt).toBe(createdAt);
      expect(diagramInfo.modifiedAt).toBe(modifiedAt);
      expect(diagramInfo.description).toBe(description);
      expect(diagramInfo.metadata).toBe(metadata);
      expect(diagramInfo.cells).toBe(cells);
      expect(diagramInfo.nodes).toHaveLength(2);
      expect(diagramInfo.edges).toHaveLength(1);
    });

    it('should create DiagramInfo with minimal parameters', () => {
      // Arrange
      const createdAt = new Date();
      const modifiedAt = new Date();

      // Act
      const diagramInfo = new DiagramInfo(
        'diagram-1',
        'Test Diagram',
        'DFD-1.0.0',
        createdAt,
        modifiedAt,
      );

      // Assert
      expect(diagramInfo.id).toBe('diagram-1');
      expect(diagramInfo.name).toBe('Test Diagram');
      expect(diagramInfo.type).toBe('DFD-1.0.0');
      expect(diagramInfo.description).toBeUndefined();
      expect(diagramInfo.metadata).toEqual([]);
      expect(diagramInfo.cells).toEqual([]);
      expect(diagramInfo.nodes).toEqual([]);
      expect(diagramInfo.edges).toEqual([]);
    });

    it('should throw error for empty ID', () => {
      // Act & Assert
      expect(
        () => new DiagramInfo('', 'Test Diagram', 'DFD-1.0.0', new Date(), new Date()),
      ).toThrow('Diagram ID cannot be empty');
    });

    it('should throw error for empty name', () => {
      // Act & Assert
      expect(() => new DiagramInfo('diagram-1', '', 'DFD-1.0.0', new Date(), new Date())).toThrow(
        'Diagram name cannot be empty',
      );
    });

    it('should throw error for invalid type', () => {
      // Act & Assert
      expect(
        () =>
          new DiagramInfo(
            'diagram-1',
            'Test Diagram',
            'INVALID' as DiagramType,
            new Date(),
            new Date(),
          ),
      ).toThrow('Invalid diagram type: INVALID');
    });

    it('should throw error for invalid dates', () => {
      // Act & Assert
      expect(
        () =>
          new DiagramInfo('diagram-1', 'Test Diagram', 'DFD-1.0.0', 'invalid' as any, new Date()),
      ).toThrow('Created date must be a valid Date object');

      expect(
        () =>
          new DiagramInfo('diagram-1', 'Test Diagram', 'DFD-1.0.0', new Date(), 'invalid' as any),
      ).toThrow('Modified date must be a valid Date object');
    });

    it('should throw error when modified date is before created date', () => {
      // Act & Assert
      const created = new Date('2024-01-01T12:00:00Z');
      const modified = new Date('2024-01-01T10:00:00Z');

      expect(
        () => new DiagramInfo('diagram-1', 'Test Diagram', 'DFD-1.0.0', created, modified),
      ).toThrow('Modified date cannot be before created date');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create DiagramInfo from OpenAPI JSON format', () => {
      // Arrange
      const json = {
        id: 'diagram-1',
        name: 'Test Diagram',
        type: 'DFD-1.0.0' as DiagramType,
        created_at: '2024-01-01T10:00:00Z',
        modified_at: '2024-01-01T11:00:00Z',
        description: 'A test diagram',
        metadata: [{ key: 'category', value: 'test' }],
        cells: [
          {
            id: 'node-1',
            shape: 'process',
            x: 100,
            y: 100,
            width: 120,
            height: 60,
            zIndex: 1,
            visible: true,
            attrs: { body: { fill: '#fff' }, text: { text: 'Process' } },
            ports: { groups: {}, items: [] },
            data: [],
            angle: 0,
          },
        ],
      };

      // Act
      const diagramInfo = DiagramInfo.fromJSON(json);

      // Assert
      expect(diagramInfo.id).toBe('diagram-1');
      expect(diagramInfo.name).toBe('Test Diagram');
      expect(diagramInfo.type).toBe('DFD-1.0.0');
      expect(diagramInfo.description).toBe('A test diagram');
      expect(diagramInfo.nodes).toHaveLength(1);
      expect(diagramInfo.edges).toHaveLength(0);
      expect(diagramInfo.getMetadataAsRecord()).toEqual({ category: 'test' });
    });

    it('should create default DiagramInfo', () => {
      // Act
      const diagramInfo = DiagramInfo.createDefault(
        'diagram-1',
        'Test Diagram',
        'A default diagram',
      );

      // Assert
      expect(diagramInfo.id).toBe('diagram-1');
      expect(diagramInfo.name).toBe('Test Diagram');
      expect(diagramInfo.type).toBe('DFD-1.0.0');
      expect(diagramInfo.description).toBe('A default diagram');
      expect(diagramInfo.cells).toEqual([]);
      expect(diagramInfo.metadata).toEqual([]);
    });
  });

  describe('Immutable Updates', () => {
    let originalDiagram: DiagramInfo;

    beforeEach(() => {
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const modifiedAt = new Date('2024-01-01T10:30:00Z');
      const metadata: Metadata[] = [{ key: 'category', value: 'test' }];
      const node = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));

      originalDiagram = new DiagramInfo(
        'diagram-1',
        'Original Diagram',
        'DFD-1.0.0',
        createdAt,
        modifiedAt,
        'Original description',
        metadata,
        [node],
      );
    });

    it('should create new DiagramInfo with updated name', () => {
      // Arrange
      const newName = 'Updated Diagram';

      // Act
      const updated = originalDiagram.withName(newName);

      // Assert
      expect(updated).not.toBe(originalDiagram);
      expect(updated.name).toBe(newName);
      expect(updated.id).toBe(originalDiagram.id);
      expect(updated.modifiedAt.getTime()).toBeGreaterThan(originalDiagram.modifiedAt.getTime());
      expect(originalDiagram.name).toBe('Original Diagram'); // Original unchanged
    });

    it('should create new DiagramInfo with updated description', () => {
      // Arrange
      const newDescription = 'Updated description';

      // Act
      const updated = originalDiagram.withDescription(newDescription);

      // Assert
      expect(updated).not.toBe(originalDiagram);
      expect(updated.description).toBe(newDescription);
      expect(updated.id).toBe(originalDiagram.id);
      expect(originalDiagram.description).toBe('Original description'); // Original unchanged
    });

    it('should create new DiagramInfo with updated metadata', () => {
      // Arrange
      const newMetadata: Metadata[] = [
        { key: 'priority', value: 'high' },
        { key: 'owner', value: 'team-alpha' },
      ];

      // Act
      const updated = originalDiagram.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalDiagram);
      expect(updated.getMetadataAsRecord()).toEqual({
        priority: 'high',
        owner: 'team-alpha',
      });
      expect(originalDiagram.getMetadataAsRecord()).toEqual({ category: 'test' }); // Original unchanged
    });

    it('should create new DiagramInfo with added node', () => {
      // Arrange
      const newNode = NodeInfo.createDefault('node-2', 'actor', new Point(200, 100));

      // Act
      const updated = originalDiagram.withAddedNode(newNode);

      // Assert
      expect(updated).not.toBe(originalDiagram);
      expect(updated.nodes).toHaveLength(2);
      expect(updated.getNode('node-2')).toBe(newNode);
      expect(originalDiagram.nodes).toHaveLength(1); // Original unchanged
    });

    it('should create new DiagramInfo with added edge', () => {
      // Arrange - first add the target node, then the edge
      const targetNode = NodeInfo.createDefault('node-2', 'actor', new Point(200, 100));
      const diagramWithTargetNode = originalDiagram.withAddedNode(targetNode);
      const newEdge = EdgeInfo.createSimple('edge-1', 'node-1', 'node-2', 'Data Flow');

      // Act
      const updated = diagramWithTargetNode.withAddedEdge(newEdge);

      // Assert
      expect(updated).not.toBe(originalDiagram);
      expect(updated.edges).toHaveLength(1);
      expect(updated.getEdge('edge-1')).toBe(newEdge);
      expect(originalDiagram.edges).toHaveLength(0); // Original unchanged
    });

    it('should create new DiagramInfo with removed cell', () => {
      // Act
      const updated = originalDiagram.withRemovedCell('node-1');

      // Assert
      expect(updated).not.toBe(originalDiagram);
      expect(updated.nodes).toHaveLength(0);
      expect(originalDiagram.nodes).toHaveLength(1); // Original unchanged
    });

    it('should create new DiagramInfo with updated cell', () => {
      // Arrange
      const updatedNode = originalDiagram.nodes[0].withLabel('Updated Process');

      // Act
      const updated = originalDiagram.withUpdatedCell(updatedNode);

      // Assert
      expect(updated).not.toBe(originalDiagram);
      expect(updated.nodes[0].label).toBe('Updated Process');
      expect(originalDiagram.nodes[0].label).not.toBe('Updated Process'); // Original unchanged
    });
  });

  describe('Query Methods', () => {
    let diagramInfo: DiagramInfo;

    beforeEach(() => {
      const node1 = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));
      const node2 = NodeInfo.createDefault('node-2', 'actor', new Point(200, 100));
      const edge1 = EdgeInfo.createSimple('edge-1', 'node-1', 'node-2', 'Data Flow');
      const edge2 = EdgeInfo.createSimple('edge-2', 'node-2', 'node-1', 'Response');

      diagramInfo = new DiagramInfo(
        'diagram-1',
        'Test Diagram',
        'DFD-1.0.0',
        new Date(),
        new Date(),
        'A test diagram',
        [],
        [node1, node2, edge1, edge2],
      );
    });

    it('should get node by ID', () => {
      // Act
      const node = diagramInfo.getNode('node-1');

      // Assert
      expect(node).toBeDefined();
      expect(node?.id).toBe('node-1');
      expect(node?.shape).toBe('process');
    });

    it('should get edge by ID', () => {
      // Act
      const edge = diagramInfo.getEdge('edge-1');

      // Assert
      expect(edge).toBeDefined();
      expect(edge?.id).toBe('edge-1');
      expect(edge?.source.cell).toBe('node-1');
      expect(edge?.target.cell).toBe('node-2');
    });

    it('should get cell by ID', () => {
      // Act
      const nodeCell = diagramInfo.getCell('node-1');
      const edgeCell = diagramInfo.getCell('edge-1');

      // Assert
      expect(nodeCell).toBeInstanceOf(NodeInfo);
      expect(edgeCell).toBeInstanceOf(EdgeInfo);
      expect(nodeCell?.id).toBe('node-1');
      expect(edgeCell?.id).toBe('edge-1');
    });

    it('should get edges connected to node', () => {
      // Act
      const connectedEdges = diagramInfo.getEdgesConnectedToNode('node-1');

      // Assert
      expect(connectedEdges).toHaveLength(2);
      expect(connectedEdges.map(e => e.id)).toContain('edge-1');
      expect(connectedEdges.map(e => e.id)).toContain('edge-2');
    });

    it('should get diagram statistics', () => {
      // Act
      const stats = diagramInfo.getStatistics();

      // Assert
      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(2);
      expect(stats.totalCells).toBe(4);
      expect(stats.nodeTypes).toEqual({
        process: 1,
        actor: 1,
      });
    });
  });

  describe('Utility Methods', () => {
    let diagramInfo: DiagramInfo;

    beforeEach(() => {
      const node = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));
      const metadata: Metadata[] = [{ key: 'category', value: 'test' }];

      diagramInfo = new DiagramInfo(
        'diagram-1',
        'Test Diagram',
        'DFD-1.0.0',
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T11:00:00Z'),
        'A test diagram',
        metadata,
        [node],
      );
    });

    it('should convert metadata to Record format', () => {
      // Act
      const metadataRecord = diagramInfo.getMetadataAsRecord();

      // Assert
      expect(metadataRecord).toEqual({ category: 'test' });
    });

    it('should check equality correctly', () => {
      // Arrange
      const node = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));
      const metadata: Metadata[] = [{ key: 'category', value: 'test' }];

      const identical = new DiagramInfo(
        'diagram-1',
        'Test Diagram',
        'DFD-1.0.0',
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T11:00:00Z'),
        'A test diagram',
        metadata,
        [node],
      );

      const different = new DiagramInfo(
        'diagram-2',
        'Test Diagram',
        'DFD-1.0.0',
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T11:00:00Z'),
        'A test diagram',
        metadata,
        [node],
      );

      // Act & Assert
      expect(diagramInfo.equals(identical)).toBe(true);
      expect(diagramInfo.equals(different)).toBe(false);
    });

    it('should convert to string representation', () => {
      // Act
      const str = diagramInfo.toString();

      // Assert
      expect(str).toBe('DiagramInfo(diagram-1, "Test Diagram", 1 nodes, 0 edges)');
    });

    it('should serialize to OpenAPI JSON correctly', () => {
      // Act
      const json = diagramInfo.toJSON();

      // Assert
      expect(json.id).toBe('diagram-1');
      expect(json.name).toBe('Test Diagram');
      expect(json.type).toBe('DFD-1.0.0');
      expect(json.description).toBe('A test diagram');
      expect(json.created_at).toBe('2024-01-01T10:00:00.000Z');
      expect(json.modified_at).toBe('2024-01-01T11:00:00.000Z');
      expect(json.metadata).toEqual([{ key: 'category', value: 'test' }]);
      expect(json.cells).toHaveLength(1);
    });
  });

  describe('Validation', () => {
    it('should throw error for duplicate cell IDs', () => {
      // Arrange
      const node1 = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));
      const node2 = NodeInfo.createDefault('node-1', 'actor', new Point(200, 100)); // Duplicate ID

      // Act & Assert
      expect(
        () =>
          new DiagramInfo(
            'diagram-1',
            'Test Diagram',
            'DFD-1.0.0',
            new Date(),
            new Date(),
            undefined,
            [],
            [node1, node2],
          ),
      ).toThrow('Duplicate cell ID found: node-1');
    });

    it('should throw error for edge with non-existent source node', () => {
      // Arrange
      const node = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));
      const edge = EdgeInfo.createSimple('edge-1', 'non-existent', 'node-1', 'Data Flow');

      // Act & Assert
      expect(
        () =>
          new DiagramInfo(
            'diagram-1',
            'Test Diagram',
            'DFD-1.0.0',
            new Date(),
            new Date(),
            undefined,
            [],
            [node, edge],
          ),
      ).toThrow('Edge edge-1 references non-existent source node: non-existent');
    });

    it('should throw error for edge with non-existent target node', () => {
      // Arrange
      const node = NodeInfo.createDefault('node-1', 'process', new Point(100, 100));
      const edge = EdgeInfo.createSimple('edge-1', 'node-1', 'non-existent', 'Data Flow');

      // Act & Assert
      expect(
        () =>
          new DiagramInfo(
            'diagram-1',
            'Test Diagram',
            'DFD-1.0.0',
            new Date(),
            new Date(),
            undefined,
            [],
            [node, edge],
          ),
      ).toThrow('Edge edge-1 references non-existent target node: non-existent');
    });
  });
});
