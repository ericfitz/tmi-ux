// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach } from 'vitest';
import { NodeInfo, NodeType } from './node-info';
import { Point } from './point';
import { Metadata } from './metadata';
import { NodeAttrs, createDefaultNodeAttrs } from './node-attrs';
import { PortConfiguration, createDefaultPortConfiguration } from './port-configuration';

describe('NodeInfo', () => {
  describe('Construction', () => {
    it('should create valid NodeInfo with all parameters', () => {
      // Arrange
      const id = 'node-1';
      const shape = 'process' as NodeType;
      const x = 100;
      const y = 100;
      const width = 120;
      const height = 60;
      const zIndex = 2;
      const visible = true;
      const attrs: NodeAttrs = { body: { fill: '#fff' }, text: { text: 'Test Process' } };
      const ports: PortConfiguration = createDefaultPortConfiguration('process');
      const metadata: Metadata[] = [
        { key: 'category', value: 'business' },
        { key: 'description', value: 'A test process' },
      ];
      const angle = 0;
      const parent = null;

      // Act
      const nodeInfo = new NodeInfo(id, shape, x, y, width, height, zIndex, visible, attrs, ports, metadata, angle, parent);

      // Assert
      expect(nodeInfo.id).toBe(id);
      expect(nodeInfo.shape).toBe(shape);
      expect(nodeInfo.type).toBe(shape);
      expect(nodeInfo.x).toBe(x);
      expect(nodeInfo.y).toBe(y);
      expect(nodeInfo.width).toBe(width);
      expect(nodeInfo.height).toBe(height);
      expect(nodeInfo.position).toEqual(new Point(x, y));
      expect(nodeInfo.size).toEqual({ width, height });
      expect(nodeInfo.attrs).toBe(attrs);
      expect(nodeInfo.ports).toBe(ports);
      expect(nodeInfo.zIndex).toBe(zIndex);
      expect(nodeInfo.visible).toBe(visible);
      expect(nodeInfo.data).toBe(metadata);
      expect(nodeInfo.angle).toBe(angle);
      expect(nodeInfo.parent).toBe(parent);
      expect(nodeInfo.label).toBe('Test Process');
    });

    it('should create NodeInfo with minimal parameters', () => {
      // Act
      const nodeInfo = new NodeInfo(
        'node-1',
        'process',
        100,
        100,
        120,
        60,
        1,
        true,
        createDefaultNodeAttrs('process', 'Process')
      );

      // Assert
      expect(nodeInfo.id).toBe('node-1');
      expect(nodeInfo.shape).toBe('process');
      expect(nodeInfo.label).toBe('Process');
      expect(nodeInfo.zIndex).toBe(1);
      expect(nodeInfo.visible).toBe(true);
      expect(nodeInfo.data).toEqual([]);
      expect(nodeInfo.angle).toBe(0);
      expect(nodeInfo.parent).toBe(undefined);
    });

    it('should throw error for empty ID', () => {
      // Act & Assert
      expect(() => new NodeInfo(
        '',
        'process',
        100,
        100,
        120,
        60
      )).toThrow('Node ID cannot be empty');
    });

    it('should throw error for invalid node type', () => {
      // Act & Assert
      expect(() => new NodeInfo(
        'node-1',
        'invalid-type' as NodeType,
        100,
        100,
        120,
        60
      )).toThrow('Invalid node shape: invalid-type');
    });

    it('should throw error for empty label', () => {
      // Act & Assert
      expect(() => new NodeInfo(
        'node-1',
        'process',
        100,
        100,
        120,
        60,
        1,
        true,
        { body: {}, text: { text: '' } }
      )).toThrow('Node label cannot be empty');
    });

    it('should throw error for invalid dimensions', () => {
      // Act & Assert
      expect(() => new NodeInfo(
        'node-1',
        'process',
        100,
        100,
        0,
        60,
        1,
        true,
        createDefaultNodeAttrs('process', 'Process')
      )).toThrow('Node dimensions must be positive');

      expect(() => new NodeInfo(
        'node-1',
        'process',
        100,
        100,
        120,
        -10,
        1,
        true,
        createDefaultNodeAttrs('process', 'Process')
      )).toThrow('Node dimensions must be positive');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create NodeInfo from JSON (OpenAPI format)', () => {
      // Arrange
      const json = {
        id: 'node-1',
        shape: 'process' as NodeType,
        x: 150,
        y: 200,
        width: 140,
        height: 80,
        zIndex: 3,
        visible: true,
        attrs: createDefaultNodeAttrs('process', 'My Process'),
        angle: 45,
        parent: 'parent-1',
        data: [{ key: 'category', value: 'business' }, { key: 'priority', value: 'high' }] as Metadata[],
      };

      // Act
      const nodeInfo = NodeInfo.fromJSON(json);

      // Assert
      expect(nodeInfo.id).toBe('node-1');
      expect(nodeInfo.shape).toBe('process');
      expect(nodeInfo.x).toBe(150);
      expect(nodeInfo.y).toBe(200);
      expect(nodeInfo.width).toBe(140);
      expect(nodeInfo.height).toBe(80);
      expect(nodeInfo.position).toEqual(new Point(150, 200));
      expect(nodeInfo.size).toEqual({ width: 140, height: 80 });
      expect(nodeInfo.label).toBe('My Process');
      expect(nodeInfo.zIndex).toBe(3);
      expect(nodeInfo.visible).toBe(true);
      expect(nodeInfo.angle).toBe(45);
      expect(nodeInfo.parent).toBe('parent-1');
      expect(nodeInfo.getMetadataAsRecord()).toEqual({ category: 'business', priority: 'high' });
    });

    it('should create NodeInfo from JSON (legacy format with position/size)', () => {
      // Arrange
      const json = {
        id: 'node-1',
        type: 'process' as NodeType,
        position: { x: 150, y: 200 },
        size: { width: 140, height: 80 },
        label: 'My Process',
        zIndex: 3,
        visible: true,
        metadata: { category: 'business', priority: 'high' },
      };

      // Act
      const nodeInfo = NodeInfo.fromJSON(json);

      // Assert
      expect(nodeInfo.id).toBe('node-1');
      expect(nodeInfo.shape).toBe('process');
      expect(nodeInfo.position).toEqual(new Point(150, 200));
      expect(nodeInfo.size).toEqual({ width: 140, height: 80 });
      expect(nodeInfo.label).toBe('My Process');
      expect(nodeInfo.zIndex).toBe(3);
      expect(nodeInfo.visible).toBe(true);
      expect(nodeInfo.getMetadataAsRecord()).toEqual({ category: 'business', priority: 'high' });
    });

    it('should create NodeInfo from legacy JSON', () => {
      // Arrange
      const json = {
        id: 'node-1',
        type: 'actor' as NodeType,
        label: 'User',
        position: { x: 50, y: 75 },
        width: 120,
        height: 60,
        metadata: { role: 'external' },
      };

      // Act
      const nodeInfo = NodeInfo.fromLegacyJSON(json);

      // Assert
      expect(nodeInfo.id).toBe('node-1');
      expect(nodeInfo.shape).toBe('actor');
      expect(nodeInfo.label).toBe('User');
      expect(nodeInfo.position).toEqual({ x: 50, y: 75 });
      expect(nodeInfo.width).toBe(120);
      expect(nodeInfo.height).toBe(60);
      expect(nodeInfo.getMetadataAsRecord()).toEqual({ role: 'external' });
    });

    it('should create NodeInfo using create method', () => {
      // Arrange
      const data = {
        id: 'node-1',
        type: 'store' as NodeType,
        label: 'Database',
        position: { x: 200, y: 150 },
        width: 160,
        height: 60,
        metadata: { type: 'sql', persistent: 'true' },
      };

      // Act
      const nodeInfo = NodeInfo.create(data);

      // Assert
      expect(nodeInfo.id).toBe('node-1');
      expect(nodeInfo.shape).toBe('store');
      expect(nodeInfo.label).toBe('Database');
    });

    it('should create default NodeInfo', () => {
      // Arrange
      const position = new Point(100, 100);

      // Act
      const nodeInfo = NodeInfo.createDefault('node-1', 'process', position);

      // Assert
      expect(nodeInfo.id).toBe('node-1');
      expect(nodeInfo.shape).toBe('process');
      expect(nodeInfo.position).toEqual({ x: 100, y: 100 });
      expect(nodeInfo.width).toBe(140); // Default process width
      expect(nodeInfo.height).toBe(80); // Default process height
      expect(nodeInfo.label).toBe('Process'); // Default English label
    });
  });

  describe('Immutable Updates', () => {
    let originalNodeInfo: NodeInfo;

    beforeEach(() => {
      originalNodeInfo = new NodeInfo(
        'node-1',
        'process',
        100,
        100,
        120,
        60,
        1,
        true,
        createDefaultNodeAttrs('process', 'Original Process'),
        createDefaultPortConfiguration('process'),
        [{ key: 'category', value: 'business' }]
      );
    });

    it('should create new NodeInfo with updated position', () => {
      // Arrange
      const newPosition = new Point(200, 150);

      // Act
      const updated = originalNodeInfo.withPosition(newPosition);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.position).toEqual(new Point(200, 150));
      expect(updated.id).toBe(originalNodeInfo.id);
      expect(originalNodeInfo.position).toEqual(new Point(100, 100)); // Original unchanged
    });

    it('should create new NodeInfo with updated label', () => {
      // Arrange
      const newLabel = 'Updated Process';

      // Act
      const updated = originalNodeInfo.withLabel(newLabel);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.label).toBe(newLabel);
      expect(updated.id).toBe(originalNodeInfo.id);
      expect(originalNodeInfo.label).toBe('Original Process'); // Original unchanged
    });

    it('should create new NodeInfo with updated width', () => {
      // Arrange
      const newWidth = 200;

      // Act
      const updated = originalNodeInfo.withWidth(newWidth);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.width).toBe(newWidth);
      expect(updated.height).toBe(originalNodeInfo.height);
      expect(originalNodeInfo.width).toBe(120); // Original unchanged
    });

    it('should create new NodeInfo with updated height', () => {
      // Arrange
      const newHeight = 100;

      // Act
      const updated = originalNodeInfo.withHeight(newHeight);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.height).toBe(newHeight);
      expect(updated.width).toBe(originalNodeInfo.width);
      expect(originalNodeInfo.height).toBe(60); // Original unchanged
    });

    it('should create new NodeInfo with updated dimensions', () => {
      // Arrange
      const newWidth = 180;
      const newHeight = 90;

      // Act
      const updated = originalNodeInfo.withDimensions(newWidth, newHeight);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.width).toBe(newWidth);
      expect(updated.height).toBe(newHeight);
      expect(originalNodeInfo.width).toBe(120); // Original unchanged
      expect(originalNodeInfo.height).toBe(60); // Original unchanged
    });

    it('should create new NodeInfo with updated metadata (Record format)', () => {
      // Arrange
      const newMetadata = { priority: 'high', owner: 'team-alpha' };

      // Act
      const updated = originalNodeInfo.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.getMetadataAsRecord()).toEqual({
        category: 'business',
        priority: 'high',
        owner: 'team-alpha',
      });
      expect(originalNodeInfo.getMetadataAsRecord()).toEqual({ category: 'business' }); // Original unchanged
    });

    it('should create new NodeInfo with updated metadata (Metadata format)', () => {
      // Arrange
      const newMetadata: Metadata[] = [
        { key: 'priority', value: 'high' },
        { key: 'owner', value: 'team-alpha' },
      ];

      // Act
      const updated = originalNodeInfo.withMetadata(newMetadata);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.data).toHaveLength(3); // Original + 2 new entries
      expect(updated.getMetadataAsRecord()).toEqual({
        category: 'business',
        priority: 'high',
        owner: 'team-alpha',
      });
    });

    it('should create new NodeInfo with updated angle', () => {
      // Arrange
      const newAngle = 90;

      // Act
      const updated = originalNodeInfo.withAngle(newAngle);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.angle).toBe(newAngle);
      expect(updated.id).toBe(originalNodeInfo.id);
      expect(originalNodeInfo.angle).toBe(0); // Original unchanged
    });

    it('should create new NodeInfo with updated parent', () => {
      // Arrange
      const newParent = 'parent-node-1';

      // Act
      const updated = originalNodeInfo.withParent(newParent);

      // Assert
      expect(updated).not.toBe(originalNodeInfo);
      expect(updated.parent).toBe(newParent);
      expect(updated.id).toBe(originalNodeInfo.id);
      expect(originalNodeInfo.parent).toBeUndefined(); // Original unchanged
    });
  });

  describe('Utility Methods', () => {
    let nodeInfo: NodeInfo;

    beforeEach(() => {
      nodeInfo = new NodeInfo(
        'node-1',
        'process',
        100,
        100,
        120,
        60,
        1,
        true,
        createDefaultNodeAttrs('process', 'Test Process'),
        createDefaultPortConfiguration('process'),
        [{ key: 'category', value: 'business' }]
      );
    });

    it('should get the center point correctly', () => {
      // Act
      const center = nodeInfo.getCenter();

      // Assert
      expect(center.x).toBe(160); // 100 + 120/2
      expect(center.y).toBe(130); // 100 + 60/2
    });

    it('should get bounds correctly', () => {
      // Act
      const bounds = nodeInfo.getBounds();

      // Assert
      expect(bounds.topLeft).toEqual(new Point(100, 100));
      expect(bounds.bottomRight).toEqual(new Point(220, 160));
    });

    it('should convert metadata to Record format', () => {
      // Act
      const metadataRecord = nodeInfo.getMetadataAsRecord();

      // Assert
      expect(metadataRecord).toEqual({ category: 'business' });
    });

    it('should check equality correctly', () => {
      // Arrange
      const identical = new NodeInfo(
        'node-1',
        'process',
        100,
        100,
        120,
        60,
        1,
        true,
        createDefaultNodeAttrs('process', 'Test Process'),
        createDefaultPortConfiguration('process'),
        [{ key: 'category', value: 'business' }]
      );
      const different = new NodeInfo(
        'node-2',
        'process',
        100,
        100,
        120,
        60,
        1,
        true,
        createDefaultNodeAttrs('process', 'Test Process'),
        createDefaultPortConfiguration('process'),
        [{ key: 'category', value: 'business' }]
      );

      // Act & Assert
      expect(nodeInfo.equals(identical)).toBe(true);
      expect(nodeInfo.equals(different)).toBe(false);
    });

    it('should convert to string representation', () => {
      // Act
      const str = nodeInfo.toString();

      // Assert
      expect(str).toBe('NodeInfo(node-1, process, "Test Process")');
    });

    it('should serialize to OpenAPI JSON correctly', () => {
      // Act
      const json = nodeInfo.toJSON();

      // Assert
      expect(json.id).toBe('node-1');
      expect(json.shape).toBe('process');
      expect(json.x).toBe(100);
      expect(json.y).toBe(100);
      expect(json.width).toBe(120);
      expect(json.height).toBe(60);
      expect(json.zIndex).toBe(1);
      expect(json.visible).toBe(true);
      expect(json.attrs).toBeDefined();
      expect(json.ports).toBeDefined();
      expect(json.data).toEqual([{ key: 'category', value: 'business' }]);
      expect(json.angle).toBe(0);
      expect(json.parent).toBeUndefined();
    });

    it('should serialize to legacy JSON correctly', () => {
      // Act
      const json = nodeInfo.toLegacyJSON();

      // Assert
      expect(json).toEqual({
        id: 'node-1',
        type: 'process',
        label: 'Test Process',
        position: { x: 100, y: 100 },
        width: 120,
        height: 60,
        metadata: { category: 'business' },
      });
    });
  });

  describe('Default Dimensions and Labels', () => {
    it('should have correct default dimensions for each node type', () => {
      const types: NodeType[] = ['actor', 'process', 'store', 'security-boundary', 'text-box'];
      const expectedDimensions = [
        { width: 120, height: 60 },  // actor
        { width: 140, height: 80 },  // process  
        { width: 160, height: 60 },  // store
        { width: 200, height: 150 }, // security-boundary
        { width: 100, height: 40 },  // text-box
      ];

      types.forEach((type, index) => {
        const nodeInfo = NodeInfo.createDefault(`node-${index}`, type, new Point(0, 0));
        expect(nodeInfo.width).toBe(expectedDimensions[index].width);
        expect(nodeInfo.height).toBe(expectedDimensions[index].height);
      });
    });

    it('should have correct default labels for each node type', () => {
      const types: NodeType[] = ['actor', 'process', 'store', 'security-boundary', 'text-box'];
      const expectedLabels = ['Actor', 'Process', 'Data Store', 'Security Boundary', 'Text'];

      types.forEach((type, index) => {
        const nodeInfo = NodeInfo.createDefault(`node-${index}`, type, new Point(0, 0));
        expect(nodeInfo.label).toBe(expectedLabels[index]);
      });
    });
  });
});