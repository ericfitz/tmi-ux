// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach } from 'vitest';
import { EdgeData, MetadataEntry } from './edge-data';

describe('EdgeData', () => {
  describe('Construction', () => {
    it('should create valid EdgeData with all parameters', () => {
      // Arrange
      const id = 'edge-1';
      const shape = 'edge';
      const source = { cell: 'source', port: 'out-port' };
      const target = { cell: 'target', port: 'in-port' };
      const attrs = { text: { text: 'Data Flow' } };
      const labels: any[] = [];
      const vertices = [
        { x: 150, y: 150 },
        { x: 200, y: 200 },
      ];
      const zIndex = 1;
      const visible = true;
      const metadata: MetadataEntry[] = [
        { key: 'style', value: 'dashed' },
        { key: 'color', value: '#red' },
      ];

      // Act
      const edgeData = new EdgeData(
        id,
        shape,
        source,
        target,
        attrs,
        labels,
        vertices,
        zIndex,
        visible,
        metadata,
      );

      // Assert
      expect(edgeData.id).toBe(id);
      expect(edgeData.shape).toBe(shape);
      expect(edgeData.source).toEqual(source);
      expect(edgeData.target).toEqual(target);
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.sourcePortId).toBe('out-port');
      expect(edgeData.targetPortId).toBe('in-port');
      expect(edgeData.label).toBe('Data Flow');
      expect(edgeData.vertices).toBe(vertices);
      expect(edgeData.zIndex).toBe(zIndex);
      expect(edgeData.visible).toBe(visible);
      expect(edgeData.data).toBe(metadata);
    });

    it('should create EdgeData with minimal parameters', () => {
      // Act
      const edgeData = new EdgeData('edge-1', 'edge', 'source', 'target');

      // Assert
      expect(edgeData.id).toBe('edge-1');
      expect(edgeData.shape).toBe('edge');
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.sourcePortId).toBeUndefined();
      expect(edgeData.targetPortId).toBeUndefined();
      expect(edgeData.label).toBeUndefined();
      expect(edgeData.vertices).toEqual([]);
      expect(edgeData.zIndex).toBe(1);
      expect(edgeData.visible).toBe(true);
      expect(edgeData.data).toEqual([]);
    });

    it('should throw error for empty ID', () => {
      // Act & Assert
      expect(() => new EdgeData('', 'edge', 'source', 'target')).toThrow('Edge ID cannot be empty');
    });

    it('should throw error for empty shape', () => {
      // Act & Assert
      expect(() => new EdgeData('edge-1', '', 'source', 'target')).toThrow(
        'Edge shape cannot be empty',
      );
    });

    it('should throw error for empty source node ID', () => {
      // Act & Assert
      expect(() => new EdgeData('edge-1', 'edge', '', 'target')).toThrow(
        'Source node ID cannot be empty',
      );
    });

    it('should throw error for empty target node ID', () => {
      // Act & Assert
      expect(() => new EdgeData('edge-1', 'edge', 'source', '')).toThrow(
        'Target node ID cannot be empty',
      );
    });

    it('should throw error for invalid vertex coordinates', () => {
      // Act & Assert
      expect(
        () =>
          new EdgeData(
            'edge-1',
            'edge',
            'source',
            'target',
            {},
            [],
            [{ x: 'invalid' as any, y: 200 }],
          ),
      ).toThrow('Vertex at index 0 must have numeric x and y coordinates');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create EdgeData from JSON with legacy format', () => {
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
      expect(edgeData.getMetadataAsRecord()).toEqual({ style: 'solid' });
    });

    it('should create EdgeData from JSON with X6 format', () => {
      // Arrange
      const json = {
        id: 'edge-1',
        shape: 'edge',
        source: { cell: 'source', port: 'out-port' },
        target: { cell: 'target', port: 'in-port' },
        attrs: { text: { text: 'Data Flow' } },
        labels: [],
        vertices: [
          { x: 150, y: 150 },
          { x: 200, y: 200 },
        ],
        zIndex: 2,
        visible: true,
        metadata: [{ key: 'style', value: 'solid' }],
      };

      // Act
      const edgeData = EdgeData.fromJSON(json);

      // Assert
      expect(edgeData.id).toBe('edge-1');
      expect(edgeData.shape).toBe('edge');
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.sourcePortId).toBe('out-port');
      expect(edgeData.targetPortId).toBe('in-port');
      expect(edgeData.label).toBe('Data Flow');
      expect(edgeData.zIndex).toBe(2);
      expect(edgeData.visible).toBe(true);
      expect(edgeData.data).toEqual([{ key: 'style', value: 'solid' }]);
    });

    it('should create simple EdgeData', () => {
      // Act
      const edgeData = EdgeData.createSimple('edge-1', 'source', 'target', 'Data Flow');

      // Assert
      expect(edgeData.id).toBe('edge-1');
      expect(edgeData.sourceNodeId).toBe('source');
      expect(edgeData.targetNodeId).toBe('target');
      expect(edgeData.label).toBe('Data Flow');
      expect(edgeData.sourcePortId).toBe('right');
      expect(edgeData.targetPortId).toBe('left');
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
      const source = { cell: 'source', port: 'out-port' };
      const target = { cell: 'target', port: 'in-port' };
      const attrs = { text: { text: 'Original Label' } };
      const vertices = [{ x: 150, y: 150 }];
      const metadata: MetadataEntry[] = [{ key: 'style', value: 'solid' }];

      originalEdgeData = new EdgeData(
        'edge-1',
        'edge',
        source,
        target,
        attrs,
        [],
        vertices,
        1,
        true,
        metadata,
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
      const newVertices = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];

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
      const newVertex = { x: 175, y: 175 };

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
      const newVertex = { x: 125, y: 125 };

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
      const edgeWithMultipleVertices = originalEdgeData.withAddedVertex({ x: 200, y: 200 });

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

    it('should create new EdgeData with updated metadata (Record format)', () => {
      // Arrange
      const newMetadata = { color: '#blue', thickness: '2px' };

      // Act
      const updated = originalEdgeData.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.getMetadataAsRecord()).toEqual({
        style: 'solid',
        color: '#blue',
        thickness: '2px',
      });
      expect(originalEdgeData.getMetadataAsRecord()).toEqual({ style: 'solid' }); // Original unchanged
    });

    it('should create new EdgeData with updated metadata (MetadataEntry format)', () => {
      // Arrange
      const newMetadata: MetadataEntry[] = [
        { key: 'color', value: '#blue' },
        { key: 'thickness', value: '2px' },
      ];

      // Act
      const updated = originalEdgeData.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalEdgeData);
      expect(updated.data).toHaveLength(3); // Original + 2 new entries
      expect(updated.getMetadataAsRecord()).toEqual({
        style: 'solid',
        color: '#blue',
        thickness: '2px',
      });
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
      const source = { cell: 'source', port: 'out-port' };
      const target = { cell: 'target', port: 'in-port' };
      const attrs = { text: { text: 'Data Flow' } };
      const vertices = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];
      const metadata: MetadataEntry[] = [{ key: 'style', value: 'solid' }];

      edgeData = new EdgeData(
        'edge-1',
        'edge',
        source,
        target,
        attrs,
        [],
        vertices,
        1,
        true,
        metadata,
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
      const edgeWithoutVertices = new EdgeData('edge-2', 'edge', 'source', 'target');

      // Act
      const pathLength = edgeWithoutVertices.getPathLength();

      // Assert
      expect(pathLength).toBe(0);
    });

    it('should check equality correctly', () => {
      // Arrange
      const source = { cell: 'source', port: 'out-port' };
      const target = { cell: 'target', port: 'in-port' };
      const attrs = { text: { text: 'Data Flow' } };
      const vertices = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];
      const metadata: MetadataEntry[] = [{ key: 'style', value: 'solid' }];

      const identical = new EdgeData(
        'edge-1',
        'edge',
        source,
        target,
        attrs,
        [],
        vertices,
        1,
        true,
        metadata,
      );
      const different = new EdgeData(
        'edge-2',
        'edge',
        source,
        target,
        attrs,
        [],
        vertices,
        1,
        true,
        metadata,
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

    it('should convert to X6 snapshot format', () => {
      // Act
      const snapshot = edgeData.toX6Snapshot();

      // Assert
      expect(snapshot).toEqual({
        id: 'edge-1',
        shape: 'edge',
        source: { cell: 'source', port: 'out-port' },
        target: { cell: 'target', port: 'in-port' },
        attrs: { text: { text: 'Data Flow' } },
        labels: [],
        vertices: [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ],
        zIndex: 1,
        visible: true,
        data: [{ key: 'style', value: 'solid' }],
      });
    });

    it('should convert metadata to Record format', () => {
      // Act
      const metadataRecord = edgeData.getMetadataAsRecord();

      // Assert
      expect(metadataRecord).toEqual({ style: 'solid' });
    });
  });

  describe('Label Extraction', () => {
    it('should extract label from attrs.text.text', () => {
      // Arrange
      const edgeData = new EdgeData('edge-1', 'edge', 'source', 'target', {
        text: { text: 'Label from attrs' },
      });

      // Act & Assert
      expect(edgeData.label).toBe('Label from attrs');
    });

    it('should return undefined when no label is present', () => {
      // Arrange
      const edgeData = new EdgeData('edge-1', 'edge', 'source', 'target');

      // Act & Assert
      expect(edgeData.label).toBeUndefined();
    });

    it('should handle complex attrs structure', () => {
      // Arrange
      const edgeData = new EdgeData('edge-1', 'edge', 'source', 'target', {
        line: { stroke: '#000' },
        text: { text: 'Complex Label', fontSize: 12 },
      });

      // Act & Assert
      expect(edgeData.label).toBe('Complex Label');
    });
  });
});
