import { describe, it, expect } from 'vitest';
import { NodeData, NodeType } from './node-data';
import { Point } from './point';

describe('NodeData', () => {
  describe('Construction', () => {
    it('should create valid NodeData with all parameters', () => {
      // Arrange
      const id = 'node-1';
      const type = 'process';
      const label = 'Test Process';
      const position = new Point(100, 200);
      const width = 140;
      const height = 80;
      const metadata = { color: '#blue', category: 'business' };

      // Act
      const nodeData = new NodeData(id, type, label, position, width, height, metadata);

      // Assert
      expect(nodeData.id).toBe(id);
      expect(nodeData.type).toBe(type);
      expect(nodeData.label).toBe(label);
      expect(nodeData.position).toBe(position);
      expect(nodeData.width).toBe(width);
      expect(nodeData.height).toBe(height);
      expect(nodeData.metadata).toEqual(metadata);
    });

    it('should create NodeData with default metadata', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act
      const nodeData = new NodeData('node-1', 'process', 'Test', position, 140, 80);

      // Assert
      expect(nodeData.metadata).toEqual({});
    });

    it('should throw error for empty ID', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act & Assert
      expect(() => new NodeData('', 'process', 'Test', position, 140, 80)).toThrow(
        'Node ID cannot be empty',
      );
    });

    it('should throw error for invalid node type', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act & Assert
      expect(
        () => new NodeData('node-1', 'invalid' as unknown as NodeType, 'Test', position, 140, 80),
      ).toThrow('Invalid node type: invalid');
    });

    it('should throw error for empty label', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act & Assert
      expect(() => new NodeData('node-1', 'process', '', position, 140, 80)).toThrow(
        'Node label cannot be empty',
      );
    });

    it('should throw error for negative dimensions', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act & Assert
      expect(() => new NodeData('node-1', 'process', 'Test', position, -10, 80)).toThrow(
        'Node dimensions must be positive',
      );
      expect(() => new NodeData('node-1', 'process', 'Test', position, 140, -10)).toThrow(
        'Node dimensions must be positive',
      );
    });

    it('should throw error for infinite dimensions', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act & Assert
      expect(() => new NodeData('node-1', 'process', 'Test', position, Infinity, 80)).toThrow(
        'Node dimensions must be finite numbers',
      );
      expect(() => new NodeData('node-1', 'process', 'Test', position, 140, NaN)).toThrow(
        'Node dimensions must be finite numbers',
      );
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
      expect(nodeData.width).toBe(140);
      expect(nodeData.height).toBe(80);
      expect(nodeData.metadata).toEqual({ color: '#blue' });
    });

    it('should create default NodeData for each type', () => {
      // Arrange
      const position = new Point(100, 200);

      // Act & Assert
      const actor = NodeData.createDefault('actor-1', 'actor', position);
      expect(actor.type).toBe('actor');
      expect(actor.label).toBe('Actor');
      expect(actor.width).toBe(120);
      expect(actor.height).toBe(60);

      const process = NodeData.createDefault('process-1', 'process', position);
      expect(process.type).toBe('process');
      expect(process.label).toBe('Process');
      expect(process.width).toBe(140);
      expect(process.height).toBe(80);

      const store = NodeData.createDefault('store-1', 'store', position);
      expect(store.type).toBe('store');
      expect(store.label).toBe('Data Store');
      expect(store.width).toBe(160);
      expect(store.height).toBe(60);

      const boundary = NodeData.createDefault('boundary-1', 'security-boundary', position);
      expect(boundary.type).toBe('security-boundary');
      expect(boundary.label).toBe('Security Boundary');
      expect(boundary.width).toBe(200);
      expect(boundary.height).toBe(150);

      const textbox = NodeData.createDefault('text-1', 'textbox', position);
      expect(textbox.type).toBe('textbox');
      expect(textbox.label).toBe('Text');
      expect(textbox.width).toBe(100);
      expect(textbox.height).toBe(40);
    });
  });

  describe('Immutable Updates', () => {
    let originalNodeData: NodeData;

    beforeEach(() => {
      originalNodeData = new NodeData(
        'node-1',
        'process',
        'Original',
        new Point(100, 200),
        140,
        80,
        { color: '#blue' },
      );
    });

    it('should create new NodeData with updated position', () => {
      // Arrange
      const newPosition = new Point(150, 250);

      // Act
      const updated = originalNodeData.withPosition(newPosition);

      // Assert
      expect(updated).not.toBe(originalNodeData);
      expect(updated.position).toBe(newPosition);
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
      expect(updated.width).toBe(newWidth);
      expect(updated.height).toBe(newHeight);
      expect(updated.id).toBe(originalNodeData.id);
      expect(originalNodeData.width).toBe(140); // Original unchanged
    });

    it('should create new NodeData with updated metadata', () => {
      // Arrange
      const newMetadata = { category: 'technical', priority: 'high' };

      // Act
      const updated = originalNodeData.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalNodeData);
      expect(updated.metadata).toEqual({ color: '#blue', category: 'technical', priority: 'high' });
      expect(originalNodeData.metadata).toEqual({ color: '#blue' }); // Original unchanged
    });
  });

  describe('Utility Methods', () => {
    let nodeData: NodeData;

    beforeEach(() => {
      nodeData = new NodeData('node-1', 'process', 'Test Process', new Point(100, 200), 140, 80, {
        color: '#blue',
      });
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
        'process',
        'Test Process',
        new Point(100, 200),
        140,
        80,
        { color: '#blue' },
      );
      const different = new NodeData(
        'node-2',
        'process',
        'Test Process',
        new Point(100, 200),
        140,
        80,
        { color: '#blue' },
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
