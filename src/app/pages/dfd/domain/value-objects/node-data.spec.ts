// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach } from 'vitest';
import { NodeData, NodeType, MetadataEntry } from './node-data';
import { Point } from './point';

describe('NodeData', () => {
  describe('Construction', () => {
    it('should create valid NodeData with all parameters', () => {
      // Arrange
      const id = 'node-1';
      const shape = 'rect';
      const type: NodeType = 'process';
      const position = { x: 100, y: 200 };
      const size = { width: 140, height: 80 };
      const attrs = { text: { text: 'Test Process' } };
      const metadata: MetadataEntry[] = [
        { key: 'color', value: '#blue' },
        { key: 'category', value: 'business' },
      ];

      // Act
      const nodeData = new NodeData(id, shape, type, position, size, attrs, {}, 1, true, metadata);

      // Assert
      expect(nodeData.id).toBe(id);
      expect(nodeData.shape).toBe(shape);
      expect(nodeData.type).toBe(type);
      expect(nodeData.position).toEqual(position);
      expect(nodeData.size).toEqual(size);
      expect(nodeData.attrs).toEqual(attrs);
      expect(nodeData.metadata).toEqual(metadata);
    });

    it('should create NodeData with default metadata', () => {
      // Arrange
      const position = { x: 100, y: 200 };
      const size = { width: 140, height: 80 };
      const attrs = { text: { text: 'Test' } };

      // Act
      const nodeData = new NodeData('node-1', 'rect', 'process', position, size, attrs);

      // Assert
      expect(nodeData.metadata).toEqual([]);
    });

    it('should throw error for empty ID', () => {
      // Arrange
      const position = { x: 100, y: 200 };
      const size = { width: 140, height: 80 };

      // Act & Assert
      expect(() => new NodeData('', 'rect', 'process', position, size)).toThrow(
        'Node ID cannot be empty',
      );
    });

    it('should throw error for invalid node type', () => {
      // Arrange
      const position = { x: 100, y: 200 };
      const size = { width: 140, height: 80 };

      // Act & Assert
      expect(
        () => new NodeData('node-1', 'rect', 'invalid' as unknown as NodeType, position, size),
      ).toThrow('Invalid node type: invalid');
    });

    it('should throw error for empty label', () => {
      // Arrange
      const position = { x: 100, y: 200 };
      const size = { width: 140, height: 80 };
      const attrs = { text: { text: '' } };

      // Act & Assert
      expect(() => new NodeData('node-1', 'rect', 'process', position, size, attrs)).toThrow(
        'Node label cannot be empty',
      );
    });

    it('should throw error for negative dimensions', () => {
      // Arrange
      const position = { x: 100, y: 200 };
      const attrs = { text: { text: 'Test' } };

      // Act & Assert
      expect(
        () =>
          new NodeData('node-1', 'rect', 'process', position, { width: -10, height: 80 }, attrs),
      ).toThrow('Node dimensions must be positive');
      expect(
        () =>
          new NodeData('node-1', 'rect', 'process', position, { width: 140, height: -10 }, attrs),
      ).toThrow('Node dimensions must be positive');
    });

    it('should throw error for infinite dimensions', () => {
      // Arrange
      const position = { x: 100, y: 200 };
      const attrs = { text: { text: 'Test' } };

      // Act & Assert
      expect(
        () =>
          new NodeData(
            'node-1',
            'rect',
            'process',
            position,
            { width: Infinity, height: 80 },
            attrs,
          ),
      ).toThrow('Node dimensions must be finite numbers');
      expect(
        () =>
          new NodeData('node-1', 'rect', 'process', position, { width: 140, height: NaN }, attrs),
      ).toThrow('Node dimensions must be finite numbers');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create NodeData from JSON', () => {
      // Arrange
      const json = {
        id: 'node-1',
        type: 'process' as const,
        label: 'Test Process',
        position: { x: 100, y: 200 },
        width: 140,
        height: 80,
        metadata: { color: '#blue' },
      };

      // Act
      const nodeData = NodeData.fromJSON(json);

      // Assert
      expect(nodeData.id).toBe('node-1');
      expect(nodeData.type).toBe('process');
      expect(nodeData.label).toBe('Test Process');
      expect(nodeData.position.x).toBe(100);
      expect(nodeData.position.y).toBe(200);
      expect(nodeData.size.width).toBe(140);
      expect(nodeData.size.height).toBe(80);
      expect(nodeData.metadata).toEqual([{ key: 'color', value: '#blue' }]);
    });

    it('should create default NodeData for each type', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act & Assert
      const actor = NodeData.createDefault('actor-1', 'actor', position);
      expect(actor.type).toBe('actor');
      expect(actor.label).toBe('Actor');
      expect(actor.size.width).toBe(120);
      expect(actor.size.height).toBe(60);

      const process = NodeData.createDefault('process-1', 'process', position);
      expect(process.type).toBe('process');
      expect(process.label).toBe('Process');
      expect(process.size.width).toBe(140);
      expect(process.size.height).toBe(80);

      const store = NodeData.createDefault('store-1', 'store', position);
      expect(store.type).toBe('store');
      expect(store.label).toBe('Data Store');
      expect(store.size.width).toBe(160);
      expect(store.size.height).toBe(60);

      const boundary = NodeData.createDefault('boundary-1', 'security-boundary', position);
      expect(boundary.type).toBe('security-boundary');
      expect(boundary.label).toBe('Security Boundary');
      expect(boundary.size.width).toBe(200);
      expect(boundary.size.height).toBe(150);

      const textbox = NodeData.createDefault('text-1', 'textbox', position);
      expect(textbox.type).toBe('textbox');
      expect(textbox.label).toBe('Text');
      expect(textbox.size.width).toBe(100);
      expect(textbox.size.height).toBe(40);
    });
  });

  describe('Immutable Updates', () => {
    let originalNodeData: NodeData;

    beforeEach(() => {
      originalNodeData = new NodeData(
        'node-1',
        'rect',
        'process',
        { x: 100, y: 200 },
        { width: 140, height: 80 },
        { text: { text: 'Original' } },
        {},
        1,
        true,
        [{ key: 'color', value: '#blue' }],
      );
    });

    it('should create new NodeData with updated position', () => {
      // Arrange
      const newPosition = { x: 150, y: 250 };

      // Act
      const updated = originalNodeData.withPosition(newPosition);

      // Assert
      expect(updated).not.toBe(originalNodeData);
      expect(updated.position).toEqual(newPosition);
      expect(updated.id).toBe(originalNodeData.id);
      expect(updated.label).toBe(originalNodeData.label);
      expect(originalNodeData.position.x).toBe(100); // Original unchanged
    });

    it('should create new NodeData with updated label', () => {
      // Arrange
      const newLabel = 'Updated Label';

      // Act
      const updated = originalNodeData.withLabel(newLabel);

      // Assert
      expect(updated).not.toBe(originalNodeData);
      expect(updated.label).toBe(newLabel);
      expect(updated.id).toBe(originalNodeData.id);
      expect(updated.position).toBe(originalNodeData.position);
      expect(originalNodeData.label).toBe('Original'); // Original unchanged
    });

    it('should create new NodeData with updated dimensions', () => {
      // Arrange
      const newWidth = 200;
      const newHeight = 100;

      // Act
      const updated = originalNodeData.withDimensions(newWidth, newHeight);

      // Assert
      expect(updated).not.toBe(originalNodeData);
      expect(updated.size.width).toBe(200);
      expect(updated.size.height).toBe(100);
      expect(updated.id).toBe(originalNodeData.id);
      expect(originalNodeData.size.width).toBe(140); // Original unchanged
    });

    it('should create new NodeData with updated metadata', () => {
      // Arrange
      const newMetadata: MetadataEntry[] = [
        { key: 'category', value: 'technical' },
        { key: 'priority', value: 'high' },
      ];

      // Act
      const updated = originalNodeData.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalNodeData);
      expect(updated.metadata).toEqual([
        { key: 'color', value: '#blue' },
        { key: 'category', value: 'technical' },
        { key: 'priority', value: 'high' },
      ]);
      expect(originalNodeData.metadata).toEqual([{ key: 'color', value: '#blue' }]); // Original unchanged
    });
  });

  describe('Utility Methods', () => {
    let nodeData: NodeData;

    beforeEach(() => {
      nodeData = new NodeData(
        'node-1',
        'rect',
        'process',
        { x: 100, y: 200 },
        { width: 140, height: 80 },
        { text: { text: 'Test Process' } },
        {},
        1,
        true,
        [{ key: 'color', value: '#blue' }],
      );
    });

    it('should calculate center point correctly', () => {
      // Act
      const center = nodeData.getCenter();

      // Assert
      expect(center.x).toBe(170); // 100 + 140/2
      expect(center.y).toBe(240); // 200 + 80/2
    });

    it('should calculate bounds correctly', () => {
      // Act
      const bounds = nodeData.getBounds();

      // Assert
      expect(bounds.topLeft.x).toBe(100);
      expect(bounds.topLeft.y).toBe(200);
      expect(bounds.bottomRight.x).toBe(240); // 100 + 140
      expect(bounds.bottomRight.y).toBe(280); // 200 + 80
    });

    it('should check equality correctly', () => {
      // Arrange
      const identical = new NodeData(
        'node-1',
        'rect',
        'process',
        { x: 100, y: 200 },
        { width: 140, height: 80 },
        { text: { text: 'Test Process' } },
        {},
        1,
        true,
        [{ key: 'color', value: '#blue' }],
      );
      const different = new NodeData(
        'node-2',
        'rect',
        'process',
        { x: 100, y: 200 },
        { width: 140, height: 80 },
        { text: { text: 'Test Process' } },
        {},
        1,
        true,
        [{ key: 'color', value: '#blue' }],
      );

      // Act & Assert
      expect(nodeData.equals(identical)).toBe(true);
      expect(nodeData.equals(different)).toBe(false);
    });

    it('should convert to string representation', () => {
      // Act
      const str = nodeData.toString();

      // Assert
      expect(str).toBe('NodeData(node-1, process, "Test Process")');
    });

    it('should serialize to JSON correctly', () => {
      // Act
      const json = nodeData.toJSON();

      // Assert
      expect(json).toEqual({
        id: 'node-1',
        type: 'process',
        label: 'Test Process',
        position: { x: 100, y: 200 },
        width: 140,
        height: 80,
        metadata: { color: '#blue' },
      });
    });
  });
});
