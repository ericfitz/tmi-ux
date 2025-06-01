import { describe, it, expect } from 'vitest';
import { EdgeData } from './edge-data';
import { Point } from './point';

describe('EdgeData', () => {
  describe('Construction', () => {
    it('should create valid EdgeData with all parameters', () => {
      // Arrange
      const id = 'edge-1';
      const sourceNodeId = 'source';
      const targetNodeId = 'target';
      const sourcePortId = 'out-port';
      const targetPortId = 'in-port';
      const label = 'Data Flow';
      const vertices = [new Point(150, 150), new Point(200, 200)];
      const metadata = { style: 'dashed', color: '#red' };

      // Act
      const edgeData = new EdgeData(
        id,
        sourceNodeId,
        targetNodeId,
        sourcePortId,
        targetPortId,
        label,
        vertices,
        metadata,
      );

      // Assert
      expect(edgeData.id).toBe(id);
      expect(edgeData.sourceNodeId).toBe(sourceNodeId);
      expect(edgeData.targetNodeId).toBe(targetNodeId);
      expect(edgeData.sourcePortId).toBe(sourcePortId);
      expect(edgeData.targetPortId).toBe(targetPortId);
      expect(edgeData.label).toBe(label);
      expect(edgeData.vertices).toBe(vertices);
      expect(edgeData.metadata).toEqual(metadata);
    });

    it('should create EdgeData with minimal parameters', () => {
      // Act
      const edgeData = new EdgeData('edge-1', 'source', 'target');

      // Assert
      expect(edgeData.id).toBe('edge-1');
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.sourcePortId).toBeUndefined();
      expect(edgeData.targetPortId).toBeUndefined();
      expect(edgeData.label).toBeUndefined();
      expect(edgeData.vertices).toEqual([]);
      expect(edgeData.metadata).toEqual({});
    });

    it('should throw error for empty ID', () => {
      // Act & Assert
      expect(() => new EdgeData('', 'source', 'target')).toThrow('Edge ID cannot be empty');
    });

    it('should throw error for empty source node ID', () => {
      // Act & Assert
      expect(() => new EdgeData('edge-1', '', 'target')).toThrow('Source node ID cannot be empty');
    });

    it('should throw error for empty target node ID', () => {
      // Act & Assert
      expect(() => new EdgeData('edge-1', 'source', '')).toThrow('Target node ID cannot be empty');
    });

    it('should throw error for self-loop', () => {
      // Act & Assert
      expect(() => new EdgeData('edge-1', 'node-1', 'node-1')).toThrow(
        'Self-loops are not allowed',
      );
    });

    it('should throw error for invalid vertex', () => {
      // Act & Assert
      expect(
        () =>
          new EdgeData('edge-1', 'source', 'target', undefined, undefined, undefined, [
            { x: 100, y: 200 } as unknown as Point,
          ]),
      ).toThrow('Vertex at index 0 must be a Point instance');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create EdgeData from JSON', () => {
      // Arrange
      const json = {
        id: 'edge-1',
        sourceNodeId: 'source',
        targetNodeId: 'target',
        sourcePortId: 'out-port',
        targetPortId: 'in-port',
        label: 'Data Flow',
        vertices: [
          { x: 150, y: 150 },
          { x: 200, y: 200 },
        ],
        metadata: { style: 'solid' },
      };

      // Act
      const edgeData = EdgeData.fromJSON(json);

      // Assert
      expect(edgeData.id).toBe('edge-1');
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.sourcePortId).toBe('out-port');
      expect(edgeData.targetPortId).toBe('in-port');
      expect(edgeData.label).toBe('Data Flow');
      expect(edgeData.vertices).toHaveLength(2);
      expect(edgeData.vertices[0].x).toBe(150);
      expect(edgeData.vertices[0].y).toBe(150);
      expect(edgeData.metadata).toEqual({ style: 'solid' });
    });

    it('should create simple EdgeData', () => {
      // Act
      const edgeData = EdgeData.createSimple('edge-1', 'source', 'target', 'Data Flow');

      // Assert
      expect(edgeData.id).toBe('edge-1');
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.label).toBe('Data Flow');
      expect(edgeData.sourcePortId).toBeUndefined();
      expect(edgeData.targetPortId).toBeUndefined();
    });

    it('should create EdgeData with ports', () => {
      // Act
      const edgeData = EdgeData.createWithPorts(
        'edge-1',
        'source',
        'target',
        'out-port',
        'in-port',
        'Data Flow',
      );

      // Assert
      expect(edgeData.id).toBe('edge-1');
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.sourcePortId).toBe('out-port');
      expect(edgeData.targetPortId).toBe('in-port');
      expect(edgeData.label).toBe('Data Flow');
    });
  });

  describe('Immutable Updates', () => {
    let originalEdgeData: EdgeData;

    beforeEach(() => {
      originalEdgeData = new EdgeData(
        'edge-1',
        'source',
        'target',
        'out-port',
        'in-port',
        'Original Label',
        [new Point(150, 150)],
        { style: 'solid' },
      );
    });

    it('should create new EdgeData with updated label', () => {
      // Arrange
      const newLabel = 'Updated Label';

      // Act
      const updated = originalEdgeData.withLabel(newLabel);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.label).toBe(newLabel);
      expect(updated.id).toBe(originalEdgeData.id);
      expect(originalEdgeData.label).toBe('Original Label'); // Original unchanged
    });

    it('should create new EdgeData with updated vertices', () => {
      // Arrange
      const newVertices = [new Point(100, 100), new Point(200, 200)];

      // Act
      const updated = originalEdgeData.withVertices(newVertices);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.vertices).toBe(newVertices);
      expect(updated.id).toBe(originalEdgeData.id);
      expect(originalEdgeData.vertices).toHaveLength(1); // Original unchanged
    });

    it('should create new EdgeData with added vertex', () => {
      // Arrange
      const newVertex = new Point(175, 175);

      // Act
      const updated = originalEdgeData.withAddedVertex(newVertex);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.vertices).toHaveLength(2);
      expect(updated.vertices[1]).toBe(newVertex);
      expect(originalEdgeData.vertices).toHaveLength(1); // Original unchanged
    });

    it('should create new EdgeData with added vertex at specific index', () => {
      // Arrange
      const newVertex = new Point(125, 125);

      // Act
      const updated = originalEdgeData.withAddedVertex(newVertex, 0);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.vertices).toHaveLength(2);
      expect(updated.vertices[0]).toBe(newVertex);
      expect(updated.vertices[1].x).toBe(150); // Original vertex moved to index 1
    });

    it('should create new EdgeData with removed vertex', () => {
      // Arrange
      const edgeWithMultipleVertices = originalEdgeData.withAddedVertex(new Point(200, 200));

      // Act
      const updated = edgeWithMultipleVertices.withRemovedVertex(0);

      // Assert
      expect(updated.vertices).toHaveLength(1);
      expect(updated.vertices[0].x).toBe(200); // Second vertex remains
    });

    it('should throw error when removing vertex with invalid index', () => {
      // Act & Assert
      expect(() => originalEdgeData.withRemovedVertex(-1)).toThrow('Vertex index out of bounds');
      expect(() => originalEdgeData.withRemovedVertex(5)).toThrow('Vertex index out of bounds');
    });

    it('should create new EdgeData with updated metadata', () => {
      // Arrange
      const newMetadata = { color: '#blue', thickness: '2px' };

      // Act
      const updated = originalEdgeData.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.metadata).toEqual({ style: 'solid', color: '#blue', thickness: '2px' });
      expect(originalEdgeData.metadata).toEqual({ style: 'solid' }); // Original unchanged
    });

    it('should create new EdgeData with updated source', () => {
      // Arrange
      const newSourceId = 'new-source';
      const newSourcePortId = 'new-out-port';

      // Act
      const updated = originalEdgeData.withSource(newSourceId, newSourcePortId);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.sourceNodeId).toBe(newSourceId);
      expect(updated.sourcePortId).toBe(newSourcePortId);
      expect(updated.targetNodeId).toBe(originalEdgeData.targetNodeId);
      expect(originalEdgeData.sourceNodeId).toBe('source'); // Original unchanged
    });

    it('should create new EdgeData with updated target', () => {
      // Arrange
      const newTargetId = 'new-target';
      const newTargetPortId = 'new-in-port';

      // Act
      const updated = originalEdgeData.withTarget(newTargetId, newTargetPortId);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.targetNodeId).toBe(newTargetId);
      expect(updated.targetPortId).toBe(newTargetPortId);
      expect(updated.sourceNodeId).toBe(originalEdgeData.sourceNodeId);
      expect(originalEdgeData.targetNodeId).toBe('target'); // Original unchanged
    });
  });

  describe('Utility Methods', () => {
    let edgeData: EdgeData;

    beforeEach(() => {
      edgeData = new EdgeData(
        'edge-1',
        'source',
        'target',
        'out-port',
        'in-port',
        'Data Flow',
        [new Point(100, 100), new Point(200, 200)],
        { style: 'solid' },
      );
    });

    it('should check if edge connects to node', () => {
      // Act & Assert
      expect(edgeData.connectsToNode('source')).toBe(true);
      expect(edgeData.connectsToNode('target')).toBe(true);
      expect(edgeData.connectsToNode('other')).toBe(false);
    });

    it('should check if edge uses port', () => {
      // Act & Assert
      expect(edgeData.usesPort('source', 'out-port')).toBe(true);
      expect(edgeData.usesPort('target', 'in-port')).toBe(true);
      expect(edgeData.usesPort('source', 'wrong-port')).toBe(false);
      expect(edgeData.usesPort('other', 'out-port')).toBe(false);
    });

    it('should calculate path length', () => {
      // Act
      const pathLength = edgeData.getPathLength();

      // Assert
      // Distance from (100,100) to (200,200) = sqrt((200-100)^2 + (200-100)^2) = sqrt(20000) ≈ 141.42
      expect(pathLength).toBeCloseTo(141.42, 2);
    });

    it('should return 0 path length for edge with no vertices', () => {
      // Arrange
      const edgeWithoutVertices = new EdgeData('edge-2', 'source', 'target');

      // Act
      const pathLength = edgeWithoutVertices.getPathLength();

      // Assert
      expect(pathLength).toBe(0);
    });

    it('should check equality correctly', () => {
      // Arrange
      const identical = new EdgeData(
        'edge-1',
        'source',
        'target',
        'out-port',
        'in-port',
        'Data Flow',
        [new Point(100, 100), new Point(200, 200)],
        { style: 'solid' },
      );
      const different = new EdgeData(
        'edge-2',
        'source',
        'target',
        'out-port',
        'in-port',
        'Data Flow',
        [new Point(100, 100), new Point(200, 200)],
        { style: 'solid' },
      );

      // Act & Assert
      expect(edgeData.equals(identical)).toBe(true);
      expect(edgeData.equals(different)).toBe(false);
    });

    it('should convert to string representation', () => {
      // Act
      const str = edgeData.toString();

      // Assert
      expect(str).toBe('EdgeData(edge-1, source -> target)');
    });

    it('should serialize to JSON correctly', () => {
      // Act
      const json = edgeData.toJSON();

      // Assert
      expect(json).toEqual({
        id: 'edge-1',
        sourceNodeId: 'source',
        targetNodeId: 'target',
        sourcePortId: 'out-port',
        targetPortId: 'in-port',
        label: 'Data Flow',
        vertices: [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ],
        metadata: { style: 'solid' },
      });
    });
  });
});
