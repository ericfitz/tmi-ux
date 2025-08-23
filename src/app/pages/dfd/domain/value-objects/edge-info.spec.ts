// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach } from 'vitest';
import { EdgeInfo } from './edge-info';
import { Metadata } from './metadata';
import { EdgeTerminal } from './edge-terminal';
import { EdgeAttrs } from './edge-attrs';
import { DFD_STYLING } from '../../constants/styling-constants';
import { EdgeLabel } from './edge-label';
import { Point } from './point';

describe('EdgeInfo', () => {
  describe('Construction', () => {
    it('should create valid EdgeInfo with all parameters', () => {
      // Arrange
      const id = 'edge-1';
      const shape = 'edge';
      const source: EdgeTerminal = { cell: 'source', port: 'out-port' };
      const target: EdgeTerminal = { cell: 'target', port: 'in-port' };
      const zIndex = 2;
      const visible = true;
      const attrs: EdgeAttrs = { text: { text: 'Data Flow' } };
      const labels: EdgeLabel[] = [];
      const vertices = [new Point(150, 150), new Point(200, 200)];
      const metadata: Metadata[] = [
        { key: 'style', value: 'dashed' },
        { key: 'color', value: '#red' },
      ];

      // Act
      const edgeInfo = new EdgeInfo(
        id,
        shape,
        source,
        target,
        zIndex,
        visible,
        attrs,
        labels,
        vertices,
        { _metadata: metadata },
      );

      // Assert
      expect(edgeInfo.id).toBe(id);
      expect(edgeInfo.shape).toBe(shape);
      expect(edgeInfo.source).toEqual(source);
      expect(edgeInfo.target).toEqual(target);
      expect(edgeInfo.source.cell).toBe('source');
      expect(edgeInfo.target.cell).toBe('target');
      expect(edgeInfo.source.port).toBe('out-port');
      expect(edgeInfo.target.port).toBe('in-port');
      expect(edgeInfo.attrs?.text?.text).toBe('Data Flow');
      expect(edgeInfo.vertices).toEqual(vertices);
      expect(edgeInfo.zIndex).toBe(zIndex);
      expect(edgeInfo.visible).toBe(visible);
      expect(edgeInfo.data).toEqual({ _metadata: metadata });
    });

    it('should create EdgeInfo with minimal parameters', () => {
      // Act
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      const edgeInfo = new EdgeInfo('edge-1', 'edge', source, target);

      // Assert
      expect(edgeInfo.id).toBe('edge-1');
      expect(edgeInfo.shape).toBe('edge');
      expect(edgeInfo.source.cell).toBe('source');
      expect(edgeInfo.target.cell).toBe('target');
      expect(edgeInfo.source.port).toBeUndefined();
      expect(edgeInfo.target.port).toBeUndefined();
      expect(edgeInfo.attrs?.text?.text).toBeUndefined();
      expect(edgeInfo.vertices).toEqual([]);
      expect(edgeInfo.zIndex).toBe(1);
      expect(edgeInfo.visible).toBe(true);
      expect(edgeInfo.data).toEqual({ _metadata: [] });
    });

    it('should throw error for empty ID', () => {
      // Act & Assert
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      expect(() => new EdgeInfo('', 'edge', source, target)).toThrow('Edge ID cannot be empty');
    });

    it('should throw error for empty shape', () => {
      // Act & Assert
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      expect(() => new EdgeInfo('edge-1', '', source, target)).toThrow(
        'Edge shape cannot be empty',
      );
    });

    it('should throw error for empty source cell ID', () => {
      // Act & Assert
      const source: EdgeTerminal = { cell: '' };
      const target: EdgeTerminal = { cell: 'target' };
      expect(() => new EdgeInfo('edge-1', 'edge', source, target)).toThrow(
        'Source node ID cannot be empty',
      );
    });

    it('should throw error for empty target cell ID', () => {
      // Act & Assert
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: '' };
      expect(() => new EdgeInfo('edge-1', 'edge', source, target)).toThrow(
        'Target node ID cannot be empty',
      );
    });

    it('should throw error for invalid vertex objects', () => {
      // Act & Assert
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      const invalidVertex = { x: 'invalid', y: 200 } as any;
      expect(
        () => new EdgeInfo('edge-1', 'edge', source, target, 1, true, {}, [], [invalidVertex]),
      ).toThrow('Vertex at index 0 must be a Point object');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create EdgeInfo from JSON with legacy format', () => {
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
      const edgeInfo = EdgeInfo.fromJSON(json);

      // Assert
      expect(edgeInfo.id).toBe('edge-1');
      expect(edgeInfo.source.cell).toBe('source');
      expect(edgeInfo.target.cell).toBe('target');
      expect(edgeInfo.source.port).toBe('out-port');
      expect(edgeInfo.target.port).toBe('in-port');
      expect(edgeInfo.attrs?.text?.text).toBe('Data Flow');
      expect(edgeInfo.vertices).toHaveLength(2);
      expect(edgeInfo.vertices[0].x).toBe(150);
      expect(edgeInfo.vertices[0].y).toBe(150);
      expect(edgeInfo.getMetadataAsRecord()).toEqual({ style: 'solid' });
    });

    it('should create EdgeInfo from JSON with OpenAPI format', () => {
      // Arrange
      const json = {
        id: 'edge-1',
        shape: 'edge',
        source: { cell: 'source', port: 'out-port' },
        target: { cell: 'target', port: 'in-port' },
        zIndex: 2,
        visible: true,
        attrs: { text: { text: 'Data Flow' } },
        labels: [],
        vertices: [
          { x: 150, y: 150 },
          { x: 200, y: 200 },
        ],
        data: { _metadata: [{ key: 'style', value: 'solid' }] },
      };

      // Act
      const edgeInfo = EdgeInfo.fromJSON(json);

      // Assert
      expect(edgeInfo.id).toBe('edge-1');
      expect(edgeInfo.shape).toBe('edge');
      expect(edgeInfo.source.cell).toBe('source');
      expect(edgeInfo.target.cell).toBe('target');
      expect(edgeInfo.source.port).toBe('out-port');
      expect(edgeInfo.target.port).toBe('in-port');
      expect(edgeInfo.attrs?.text?.text).toBe('Data Flow');
      expect(edgeInfo.zIndex).toBe(2);
      expect(edgeInfo.visible).toBe(true);
      expect(edgeInfo.vertices).toHaveLength(2);
      expect(edgeInfo.vertices[0]).toBeInstanceOf(Point);
      expect(edgeInfo.data).toEqual({ _metadata: [{ key: 'style', value: 'solid' }] });
    });

    it('should create simple EdgeInfo', () => {
      // Act
      const edgeInfo = EdgeInfo.createSimple('edge-1', 'source', 'target', 'Data Flow');

      // Assert
      expect(edgeInfo.id).toBe('edge-1');
      expect(edgeInfo.source.cell).toBe('source');
      expect(edgeInfo.target.cell).toBe('target');
      expect(edgeInfo.attrs?.text?.text).toBe('Data Flow');
      expect(edgeInfo.source.port).toBe('right');
      expect(edgeInfo.target.port).toBe('left');
    });

    it('should create EdgeInfo with ports', () => {
      // Act
      const edgeInfo = EdgeInfo.createWithPorts(
        'edge-1',
        'source',
        'target',
        'out-port',
        'in-port',
        'Data Flow',
      );

      // Assert
      expect(edgeInfo.id).toBe('edge-1');
      expect(edgeInfo.source.cell).toBe('source');
      expect(edgeInfo.target.cell).toBe('target');
      expect(edgeInfo.source.port).toBe('out-port');
      expect(edgeInfo.target.port).toBe('in-port');
      expect(edgeInfo.attrs?.text?.text).toBe('Data Flow');
    });
  });

  describe('Immutable Updates', () => {
    let originalEdgeInfo: EdgeInfo;

    beforeEach(() => {
      const source: EdgeTerminal = { cell: 'source', port: 'out-port' };
      const target: EdgeTerminal = { cell: 'target', port: 'in-port' };
      const attrs: EdgeAttrs = { text: { text: 'Original Label' } };
      const vertices = [new Point(150, 150)];
      const metadata: Metadata[] = [{ key: 'style', value: 'solid' }];

      originalEdgeInfo = new EdgeInfo(
        'edge-1',
        'edge',
        source,
        target,
        1,
        true,
        attrs,
        [],
        vertices,
        { _metadata: metadata },
      );
    });

    it('should create new EdgeInfo with updated label', () => {
      // Arrange
      const newLabel = 'Updated Label';

      // Act
      const updated = originalEdgeInfo.withLabel(newLabel);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.attrs?.text?.text).toBe(newLabel);
      expect(updated.id).toBe(originalEdgeInfo.id);
      expect(originalEdgeInfo.attrs?.text?.text).toBe('Original Label'); // Original unchanged
    });

    it('should create new EdgeInfo with updated vertices', () => {
      // Arrange
      const newVertices = [new Point(100, 100), new Point(200, 200)];

      // Act
      const updated = originalEdgeInfo.withVertices(newVertices);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.vertices).toHaveLength(2);
      expect(updated.vertices[0]).toEqual(new Point(100, 100));
      expect(updated.vertices[1]).toEqual(new Point(200, 200));
      expect(updated.id).toBe(originalEdgeInfo.id);
      expect(originalEdgeInfo.vertices).toHaveLength(1); // Original unchanged
    });

    it('should create new EdgeInfo with added vertex', () => {
      // Arrange
      const newVertex = new Point(175, 175);

      // Act
      const updated = originalEdgeInfo.withAddedVertex(newVertex);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.vertices).toHaveLength(2);
      expect(updated.vertices[1]).toEqual(newVertex);
      expect(originalEdgeInfo.vertices).toHaveLength(1); // Original unchanged
    });

    it('should create new EdgeInfo with added vertex at specific index', () => {
      // Arrange
      const newVertex = new Point(125, 125);

      // Act
      const updated = originalEdgeInfo.withAddedVertex(newVertex, 0);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.vertices).toHaveLength(2);
      expect(updated.vertices[0]).toEqual(newVertex);
      expect(updated.vertices[1].x).toBe(150); // Original vertex moved to index 1
    });

    it('should create new EdgeInfo with removed vertex', () => {
      // Arrange
      const edgeWithMultipleVertices = originalEdgeInfo.withAddedVertex(new Point(200, 200));

      // Act
      const updated = edgeWithMultipleVertices.withRemovedVertex(0);

      // Assert
      expect(updated.vertices).toHaveLength(1);
      expect(updated.vertices[0].x).toBe(200); // Second vertex remains
    });

    it('should throw error when removing vertex with invalid index', () => {
      // Act & Assert
      expect(() => originalEdgeInfo.withRemovedVertex(-1)).toThrow('Vertex index out of bounds');
      expect(() => originalEdgeInfo.withRemovedVertex(5)).toThrow('Vertex index out of bounds');
    });

    it('should create new EdgeInfo with updated metadata (Record format)', () => {
      // Arrange
      const newMetadata = { color: '#blue', thickness: '2px' };

      // Act
      const updated = originalEdgeInfo.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.getMetadataAsRecord()).toEqual({
        color: '#blue',
        thickness: '2px',
      });
      expect(originalEdgeInfo.getMetadataAsRecord()).toEqual({ style: 'solid' }); // Original unchanged
    });

    it('should create new EdgeInfo with updated metadata (Metadata format)', () => {
      // Arrange
      const newMetadata: Metadata[] = [
        { key: 'color', value: '#blue' },
        { key: 'thickness', value: '2px' },
      ];

      // Act
      const updated = originalEdgeInfo.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.metadata).toHaveLength(2); // New metadata entries
      expect(updated.getMetadataAsRecord()).toEqual({
        color: '#blue',
        thickness: '2px',
      });
    });

    it('should create new EdgeInfo with updated source', () => {
      // Arrange
      const newSourceId = 'new-source';
      const newSourcePortId = 'new-out-port';

      // Act
      const updated = originalEdgeInfo.withSource(newSourceId, newSourcePortId);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.source.cell).toBe(newSourceId);
      expect(updated.source.port).toBe(newSourcePortId);
      expect(updated.target.cell).toBe(originalEdgeInfo.target.cell);
      expect(originalEdgeInfo.source.cell).toBe('source'); // Original unchanged
    });

    it('should create new EdgeInfo with updated target', () => {
      // Arrange
      const newTargetId = 'new-target';
      const newTargetPortId = 'new-in-port';

      // Act
      const updated = originalEdgeInfo.withTarget(newTargetId, newTargetPortId);

      // Assert
      expect(updated).not.toBe(originalEdgeInfo);
      expect(updated.target.cell).toBe(newTargetId);
      expect(updated.target.port).toBe(newTargetPortId);
      expect(updated.source.cell).toBe(originalEdgeInfo.source.cell);
      expect(originalEdgeInfo.target.cell).toBe('target'); // Original unchanged
    });
  });

  describe('Utility Methods', () => {
    let edgeInfo: EdgeInfo;

    beforeEach(() => {
      const source: EdgeTerminal = { cell: 'source', port: 'out-port' };
      const target: EdgeTerminal = { cell: 'target', port: 'in-port' };
      const attrs: EdgeAttrs = { text: { text: 'Data Flow' } };
      const vertices = [new Point(100, 100), new Point(200, 200)];
      const metadata: Metadata[] = [{ key: 'style', value: 'solid' }];

      edgeInfo = new EdgeInfo('edge-1', 'edge', source, target, 1, true, attrs, [], vertices, {
        _metadata: metadata,
      });
    });

    it('should check if edge connects to node', () => {
      // Act & Assert
      expect(edgeInfo.connectsToNode('source')).toBe(true);
      expect(edgeInfo.connectsToNode('target')).toBe(true);
      expect(edgeInfo.connectsToNode('other')).toBe(false);
    });

    it('should check if edge uses port', () => {
      // Act & Assert
      expect(edgeInfo.usesPort('source', 'out-port')).toBe(true);
      expect(edgeInfo.usesPort('target', 'in-port')).toBe(true);
      expect(edgeInfo.usesPort('source', 'wrong-port')).toBe(false);
      expect(edgeInfo.usesPort('other', 'out-port')).toBe(false);
    });

    it('should calculate path length', () => {
      // Act
      const pathLength = edgeInfo.getPathLength();

      // Assert
      // Distance from (100,100) to (200,200) = sqrt((200-100)^2 + (200-100)^2) = sqrt(20000) ≈ 141.42
      expect(pathLength).toBeCloseTo(141.42, 2);
    });

    it('should return 0 path length for edge with no vertices', () => {
      // Arrange
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      const edgeWithoutVertices = new EdgeInfo('edge-2', 'edge', source, target);

      // Act
      const pathLength = edgeWithoutVertices.getPathLength();

      // Assert
      expect(pathLength).toBe(0);
    });

    it('should check equality correctly', () => {
      // Arrange
      const source: EdgeTerminal = { cell: 'source', port: 'out-port' };
      const target: EdgeTerminal = { cell: 'target', port: 'in-port' };
      const attrs: EdgeAttrs = { text: { text: 'Data Flow' } };
      const vertices = [new Point(100, 100), new Point(200, 200)];
      const metadata: Metadata[] = [{ key: 'style', value: 'solid' }];

      const identical = new EdgeInfo(
        'edge-1',
        'edge',
        source,
        target,
        1,
        true,
        attrs,
        [],
        vertices,
        { _metadata: metadata },
      );
      const different = new EdgeInfo(
        'edge-2',
        'edge',
        source,
        target,
        1,
        true,
        attrs,
        [],
        vertices,
        { _metadata: metadata },
      );

      // Act & Assert
      expect(edgeInfo.equals(identical)).toBe(true);
      expect(edgeInfo.equals(different)).toBe(false);
    });

    it('should convert to string representation', () => {
      // Act
      const str = edgeInfo.toString();

      // Assert
      expect(str).toBe('EdgeInfo(edge-1, source -> target)');
    });

    it('should serialize to OpenAPI JSON correctly', () => {
      // Act
      const json = edgeInfo.toJSON();

      // Assert
      expect(json.id).toBe('edge-1');
      expect(json.shape).toBe('edge');
      expect(json.source).toEqual({ cell: 'source', port: 'out-port' });
      expect(json.target).toEqual({ cell: 'target', port: 'in-port' });
      expect(json.zIndex).toBe(1);
      expect(json.visible).toBe(true);
      expect(json.attrs).toBeDefined();
      expect(json.labels).toEqual([]);
      expect(json.vertices).toHaveLength(2);
      expect(json.vertices[0]).toBeInstanceOf(Point);
      expect(json.data).toEqual({ _metadata: [{ key: 'style', value: 'solid' }] });
    });

    it('should convert metadata to Record format', () => {
      // Act
      const metadataRecord = edgeInfo.getMetadataAsRecord();

      // Assert
      expect(metadataRecord).toEqual({ style: 'solid' });
    });
  });

  describe('Label Extraction', () => {
    it('should extract label from attrs.text.text', () => {
      // Arrange
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      const attrs: EdgeAttrs = {
        text: { text: 'Label from attrs' },
      };
      const edgeInfo = new EdgeInfo('edge-1', 'edge', source, target, 1, true, attrs);

      // Act & Assert
      expect(edgeInfo.attrs?.text?.text).toBe('Label from attrs');
    });

    it('should return undefined when no label is present', () => {
      // Arrange
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      const edgeInfo = new EdgeInfo('edge-1', 'edge', source, target);

      // Act & Assert
      expect(edgeInfo.attrs?.text?.text).toBeUndefined();
    });

    it('should handle complex attrs structure', () => {
      // Arrange
      const source: EdgeTerminal = { cell: 'source' };
      const target: EdgeTerminal = { cell: 'target' };
      const attrs: EdgeAttrs = {
        line: { stroke: '#000' },
        text: { text: 'Complex Label', fontSize: DFD_STYLING.DEFAULT_FONT_SIZE },
      };
      const edgeInfo = new EdgeInfo('edge-1', 'edge', source, target, 1, true, attrs);

      // Act & Assert
      expect(edgeInfo.attrs?.text?.text).toBe('Complex Label');
    });
  });

  describe('X6 Properties', () => {
    it('should create EdgeInfo with markup property', () => {
      // Arrange
      const markup = [
        {
          tagName: 'path',
          selector: 'line',
          attrs: { stroke: '#000000', strokeWidth: 2 },
        },
        {
          tagName: 'text',
          selector: 'label',
          attrs: { fontSize: 12, fill: '#333333' },
        },
      ];

      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        markup,
      });

      // Assert
      expect(edgeInfo.markup).toEqual(markup);
      expect(edgeInfo.toJSON().markup).toEqual(markup);
    });

    it('should create EdgeInfo with tools property', () => {
      // Arrange
      const tools = [
        { name: 'vertices', args: { distance: 20 } },
        { name: 'segments', args: { precision: 2 } },
      ];

      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        tools,
      });

      // Assert
      expect(edgeInfo.tools).toEqual(tools);
      expect(edgeInfo.toJSON().tools).toEqual(tools);
    });

    it('should create EdgeInfo with router property', () => {
      // Arrange
      const router = {
        name: 'manhattan' as const,
        args: { padding: 10, step: 20 },
      };

      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        router,
      });

      // Assert
      expect(edgeInfo.router).toEqual(router);
      expect(edgeInfo.toJSON().router).toEqual(router);
    });

    it('should create EdgeInfo with string router', () => {
      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        router: 'orth',
      });

      // Assert
      expect(edgeInfo.router).toBe('orth');
      expect(edgeInfo.toJSON().router).toBe('orth');
    });

    it('should create EdgeInfo with connector property', () => {
      // Arrange
      const connector = {
        name: 'rounded' as const,
        args: { radius: 10 },
      };

      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        connector,
      });

      // Assert
      expect(edgeInfo.connector).toEqual(connector);
      expect(edgeInfo.toJSON().connector).toEqual(connector);
    });

    it('should create EdgeInfo with defaultLabel property', () => {
      // Arrange
      const defaultLabel = {
        position: 0.5,
        attrs: {
          text: { fontSize: 14, fill: '#000000' },
          rect: { fill: '#ffffff', stroke: '#cccccc' },
        },
      };

      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        defaultLabel,
      });

      // Assert
      expect(edgeInfo.defaultLabel).toEqual(defaultLabel);
      expect(edgeInfo.toJSON().defaultLabel).toEqual(defaultLabel);
    });

    it('should handle undefined X6 properties gracefully', () => {
      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
      });

      // Assert
      expect(edgeInfo.markup).toBeUndefined();
      expect(edgeInfo.tools).toBeUndefined();
      expect(edgeInfo.router).toBeUndefined();
      expect(edgeInfo.connector).toBeUndefined();
      expect(edgeInfo.defaultLabel).toBeUndefined();
    });

    it('should preserve X6 properties in with* methods', () => {
      // Arrange
      const markup = [{ tagName: 'path', selector: 'line' }];
      const tools = [{ name: 'vertices' }];
      const router = 'manhattan' as const;
      const connector = 'rounded' as const;
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        markup,
        tools,
        router,
        connector,
      });

      // Act
      const updatedEdgeInfo = edgeInfo.withLabel('Updated Label');

      // Assert
      expect(updatedEdgeInfo.markup).toEqual(markup);
      expect(updatedEdgeInfo.tools).toEqual(tools);
      expect(updatedEdgeInfo.router).toEqual(router);
      expect(updatedEdgeInfo.connector).toEqual(connector);
      expect(updatedEdgeInfo.attrs?.text?.text).toBe('Updated Label');
    });

    it('should handle style convenience property', () => {
      // Arrange
      const style = {
        stroke: '#ff0000',
        strokeWidth: 3,
        strokeDasharray: '10 5',
        fontSize: 14,
        fontColor: '#333333',
      };

      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        label: 'Test Edge',
        style,
      });

      // Assert
      expect(edgeInfo.attrs?.line?.stroke).toBe('#ff0000');
      expect(edgeInfo.attrs?.line?.strokeWidth).toBe(3);
      expect(edgeInfo.attrs?.line?.strokeDasharray).toBe('10 5');
      expect(edgeInfo.attrs?.text?.fontSize).toBe(14);
      expect(edgeInfo.attrs?.text?.fill).toBe('#333333');
    });

    it('should handle label convenience property', () => {
      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        label: 'Simple Label',
      });

      // Assert
      expect(edgeInfo.attrs?.text?.text).toBe('Simple Label');
    });
  });

  describe('X6 Validation', () => {
    it('should validate router types', () => {
      // Act & Assert
      expect(() => {
        EdgeInfo.fromJSON({
          id: 'test-edge',
          source: { cell: 'source-node' },
          target: { cell: 'target-node' },
          router: 'invalid-router' as any, // Invalid router type
        });
      }).toThrow('Invalid router type: invalid-router');
    });

    it('should validate connector types', () => {
      // Act & Assert
      expect(() => {
        EdgeInfo.fromJSON({
          id: 'test-edge',
          source: { cell: 'source-node' },
          target: { cell: 'target-node' },
          connector: 'invalid-connector' as any, // Invalid connector type
        });
      }).toThrow('Invalid connector type: invalid-connector');
    });

    it('should validate defaultLabel position', () => {
      // Act & Assert
      expect(() => {
        EdgeInfo.fromJSON({
          id: 'test-edge',
          source: { cell: 'source-node' },
          target: { cell: 'target-node' },
          defaultLabel: { position: 2.0 }, // Invalid: position > 1
        });
      }).toThrow('Default label position must be a number between 0 and 1');
    });

    it('should accept valid X6 configurations', () => {
      // Act
      const edgeInfo = EdgeInfo.fromJSON({
        id: 'test-edge',
        source: { cell: 'source-node' },
        target: { cell: 'target-node' },
        router: 'manhattan',
        connector: 'rounded',
        defaultLabel: { position: 0.5, attrs: { text: { fontSize: 12 } } },
        markup: [{ tagName: 'path', selector: 'line' }],
        tools: [{ name: 'vertices', args: { distance: 20 } }],
      });

      // Assert
      expect(edgeInfo.router).toBe('manhattan');
      expect(edgeInfo.connector).toBe('rounded');
      expect(edgeInfo.defaultLabel?.position).toBe(0.5);
      expect(edgeInfo.markup).toHaveLength(1);
      expect(edgeInfo.tools).toHaveLength(1);
    });
  });
});
