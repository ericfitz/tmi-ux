// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { Graph } from '@antv/x6';
import { NodeInfo, NodeType } from '../../domain/value-objects/node-info';
import { InfraNodeConfigurationService } from './infra-node-configuration.service';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import { registerCustomShapes } from '../adapters/infra-x6-shape-definitions';
import { getX6ShapeForNodeType } from '../adapters/infra-x6-shape-definitions';
import { expect, beforeEach, afterEach, describe, it } from 'vitest';

describe('InfraNodeService - Core Functionality Tests', () => {
  let graph: Graph;
  let infraNodeConfigurationService: InfraNodeConfigurationService;

  beforeEach(() => {
    // Initialize X6 cell extensions and register DFD shapes
    initializeX6CellExtensions();
    registerCustomShapes();

    // Create real X6 graph for integration testing
    graph = new Graph({
      container: document.createElement('div'),
      width: 800,
      height: 600,
    });

    // Create real InfraNodeConfigurationService for proper port configuration
    infraNodeConfigurationService = new InfraNodeConfigurationService();
  });

  afterEach(() => {
    graph.dispose();
  });

  describe('Shape Mapping', () => {
    it('should map node types to correct X6 shapes', () => {
      expect(getX6ShapeForNodeType('actor')).toBe('actor');
      expect(getX6ShapeForNodeType('process')).toBe('process');
      expect(getX6ShapeForNodeType('store')).toBe('store');
      expect(getX6ShapeForNodeType('security-boundary')).toBe('security-boundary');
      expect(getX6ShapeForNodeType('text-box')).toBe('text-box');
      expect(getX6ShapeForNodeType('unknown')).toBe('rect'); // fallback
    });
  });

  describe('NodeInfo Creation and Validation', () => {
    it('should create NodeInfo with all properties', () => {
      const nodeInfo = NodeInfo.create({
        id: 'test-node-1',
        type: 'process',
        position: { x: 100, y: 200 },
        width: 150,
        height: 70,
        label: 'Test Process',
        metadata: { key1: 'value1', key2: 'value2' },
      });

      expect(nodeInfo.id).toBe('test-node-1');
      expect(nodeInfo.type).toBe('process');
      expect(nodeInfo.x).toBe(100);
      expect(nodeInfo.y).toBe(200);
      expect(nodeInfo.width).toBe(150);
      expect(nodeInfo.height).toBe(70);
      expect(nodeInfo.label).toBe('Test Process');
      expect(nodeInfo.zIndex).toBe(10); // NodeInfo.create now uses type-specific default for 'process'
    });

    it('should create NodeInfo with minimal properties', () => {
      const nodeInfo = NodeInfo.create({
        id: 'minimal-node',
        type: 'actor',
        position: { x: 50, y: 50 },
        width: 80,
        height: 80,
        label: 'Test Actor',
      });

      expect(nodeInfo.id).toBe('minimal-node');
      expect(nodeInfo.type).toBe('actor');
      expect(nodeInfo.x).toBe(50);
      expect(nodeInfo.y).toBe(50);
      expect(nodeInfo.width).toBe(80);
      expect(nodeInfo.height).toBe(80);
      expect(nodeInfo.label).toBe('Test Actor');
    });
  });

  describe('Node Configuration', () => {
    it('should provide correct port configuration for different node types', () => {
      const nodeTypes: NodeType[] = ['actor', 'process', 'store', 'security-boundary'];

      nodeTypes.forEach(nodeType => {
        const portConfig = infraNodeConfigurationService.getNodePorts(nodeType);

        expect(portConfig.groups).toBeDefined();
        expect(portConfig.items).toBeDefined();
        expect(portConfig.items).toHaveLength(4); // top, right, bottom, left

        // Verify port structure
        expect(portConfig.items).toEqual([
          { group: 'top', id: 'top' },
          { group: 'right', id: 'right' },
          { group: 'bottom', id: 'bottom' },
          { group: 'left', id: 'left' },
        ]);
      });
    });

    it('should provide empty port configuration for text-box nodes', () => {
      const portConfig = infraNodeConfigurationService.getNodePorts('text-box');

      expect(portConfig.groups).toEqual({});
      expect(portConfig.items).toEqual([]);
    });

    it('should indicate correct port capabilities for node types', () => {
      expect(infraNodeConfigurationService.getNodeTypeInfo('text-box').hasPorts).toBe(false);
      expect(infraNodeConfigurationService.getNodeTypeInfo('text-box').isTextbox).toBe(true);

      expect(infraNodeConfigurationService.getNodeTypeInfo('process').hasPorts).toBe(true);
      expect(infraNodeConfigurationService.getNodeTypeInfo('process').isTextbox).toBe(false);
    });
  });

  describe('X6 Integration', () => {
    it('should create nodes with registered shapes', () => {
      const nodeTypes: Array<{ type: NodeType; expectedShape: string }> = [
        { type: 'actor', expectedShape: 'actor' },
        { type: 'process', expectedShape: 'process' },
        { type: 'store', expectedShape: 'store' },
        { type: 'security-boundary', expectedShape: 'security-boundary' },
        { type: 'text-box', expectedShape: 'text-box' },
      ];

      nodeTypes.forEach(({ type, expectedShape }) => {
        const x6Shape = getX6ShapeForNodeType(type);
        expect(x6Shape).toBe(expectedShape);

        // Verify we can create nodes with these shapes
        const node = graph.addNode({
          id: `test-${type}`,
          shape: x6Shape,
          x: 100,
          y: 100,
          width: 120,
          height: 80,
          label: `Test ${type}`,
        });

        expect(node).toBeDefined();
        expect(node.shape).toBe(expectedShape);
      });
    });

    it('should handle node creation with port configuration', () => {
      const nodeInfo = NodeInfo.create({
        id: 'port-test-node',
        type: 'process',
        position: { x: 0, y: 0 },
        width: 120,
        height: 80,
        label: 'Port Test Node',
      });

      const portConfig = infraNodeConfigurationService.getNodePorts(nodeInfo.type);

      const node = graph.addNode({
        id: nodeInfo.id,
        shape: getX6ShapeForNodeType(nodeInfo.type),
        x: nodeInfo.x,
        y: nodeInfo.y,
        width: nodeInfo.width,
        height: nodeInfo.height,
        label: nodeInfo.attrs?.text?.text || '',
        ports: portConfig,
      });

      expect(node).toBeDefined();
      expect(node.getPorts()).toHaveLength(4);

      // Verify port IDs match expectations
      const portIds = node.getPorts().map(port => port.id);
      expect(portIds).toEqual(['top', 'right', 'bottom', 'left']);
    });
  });

  describe('NodeInfo Metadata Handling', () => {
    it('should handle metadata conversion correctly', () => {
      const nodeInfo = NodeInfo.create({
        id: 'metadata-test',
        type: 'process',
        position: { x: 0, y: 0 },
        width: 120,
        height: 80,
        label: 'Metadata Test',
        metadata: { key1: 'value1', key2: 'value2' },
      });

      const metadataRecord = nodeInfo.getMetadataAsRecord();
      expect(metadataRecord).toEqual({ key1: 'value1', key2: 'value2' });

      // Test metadata array conversion
      const metadataArray = Object.entries(metadataRecord).map(([key, value]) => ({
        key,
        value,
      }));

      expect(metadataArray).toEqual([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ]);
    });
  });

  describe('Default zIndex Application', () => {
    it('should verify NodeInfo.create() uses correct defaults for all node types', () => {
      const nodeTypeZIndexMap = [
        { type: 'security-boundary' as NodeType, expectedZIndex: 1 },
        { type: 'process' as NodeType, expectedZIndex: 10 },
        { type: 'store' as NodeType, expectedZIndex: 10 },
        { type: 'actor' as NodeType, expectedZIndex: 10 },
        { type: 'text-box' as NodeType, expectedZIndex: 20 },
      ];

      nodeTypeZIndexMap.forEach(({ type, expectedZIndex }) => {
        const nodeInfo = NodeInfo.create({
          id: `create-test-${type}`,
          type,
          position: { x: 0, y: 0 },
          width: 120,
          height: 80,
          label: `Test ${type}`,
        });

        expect(nodeInfo.zIndex).toBe(expectedZIndex);
      });
    });

    it('should return correct default zIndex for each node type', () => {
      const nodeTypeZIndexMap = [
        { type: 'security-boundary' as NodeType, expectedZIndex: 1 },
        { type: 'process' as NodeType, expectedZIndex: 10 },
        { type: 'store' as NodeType, expectedZIndex: 10 },
        { type: 'actor' as NodeType, expectedZIndex: 10 },
        { type: 'text-box' as NodeType, expectedZIndex: 20 },
      ];

      nodeTypeZIndexMap.forEach(({ type, expectedZIndex }) => {
        // Test InfraNodeConfigurationService directly - this is what InfraNodeService uses for defaults
        const defaultZIndex = infraNodeConfigurationService.getNodeZIndex(type);
        expect(defaultZIndex).toBe(expectedZIndex);
      });
    });

    it('should use correct default zIndex for each node type from NodeInfo.create()', () => {
      const nodeTypeZIndexMap = [
        { type: 'security-boundary' as NodeType, expectedZIndex: 1 },
        { type: 'process' as NodeType, expectedZIndex: 10 },
        { type: 'store' as NodeType, expectedZIndex: 10 },
        { type: 'actor' as NodeType, expectedZIndex: 10 },
        { type: 'text-box' as NodeType, expectedZIndex: 20 },
      ];

      nodeTypeZIndexMap.forEach(({ type, expectedZIndex }) => {
        const nodeInfo = NodeInfo.create({
          id: `test-${type}`,
          type,
          position: { x: 0, y: 0 },
          width: 120,
          height: 80,
          label: `Test ${type}`,
        });

        expect(nodeInfo.zIndex).toBe(expectedZIndex);

        // Simulate InfraNodeService logic: nodeInfo.zIndex || getNodeZIndex(type)
        // Since nodeInfo.zIndex is always truthy (positive number), it should use nodeInfo.zIndex
        const x6NodeConfig = {
          zIndex: nodeInfo.zIndex || infraNodeConfigurationService.getNodeZIndex(nodeInfo.type),
        };

        expect(x6NodeConfig.zIndex).toBe(expectedZIndex); // Uses nodeInfo.zIndex which is now correct
      });
    });

    it('should use type default when NodeInfo zIndex is explicitly set to falsy value', () => {
      // Create a NodeInfo with zIndex 0 (falsy) to test the fallback
      const nodeInfoWithFalsyZIndex = NodeInfo.fromJSON({
        id: 'test-with-zindex-0',
        type: 'process',
        position: { x: 0, y: 0 },
        width: 120,
        height: 80,
        label: 'Test Process With Zero ZIndex',
        zIndex: 0, // Falsy zIndex
        visible: true,
        angle: 0,
        attrs: {
          body: { fill: '#ffffff', stroke: '#000000', strokeWidth: 2 },
          text: { text: 'Test Process With Zero ZIndex', fontSize: 12, fill: '#000000' },
        },
        ports: { groups: {}, items: [] },
        data: [],
      });

      // Verify the NodeInfo has the falsy zIndex
      expect(nodeInfoWithFalsyZIndex.zIndex).toBe(0);

      // Simulate InfraNodeService logic: since zIndex is 0 (falsy), should use type default
      const x6NodeConfig = {
        zIndex:
          nodeInfoWithFalsyZIndex.zIndex ||
          infraNodeConfigurationService.getNodeZIndex(nodeInfoWithFalsyZIndex.type),
      };

      expect(x6NodeConfig.zIndex).toBe(10); // Uses type default for 'process'
    });

    it('should preserve explicit zIndex when provided via fromJSON', () => {
      // Create a NodeInfo using fromJSON with explicit zIndex that differs from type default
      const nodeInfoWithExplicitZIndex = NodeInfo.fromJSON({
        id: 'explicit-zindex-test',
        type: 'process',
        position: { x: 0, y: 0 },
        width: 120,
        height: 80,
        label: 'Test Process With Explicit ZIndex',
        zIndex: 15, // Explicit zIndex different from type default (10)
        visible: true,
        angle: 0,
        attrs: {
          body: { fill: '#ffffff', stroke: '#000000', strokeWidth: 2 },
          text: { text: 'Test Process With Explicit ZIndex', fontSize: 12, fill: '#000000' },
        },
        ports: { groups: {}, items: [] },
        data: [],
      });

      // The explicit zIndex should be preserved
      expect(nodeInfoWithExplicitZIndex.zIndex).toBe(15);

      // Simulate InfraNodeService logic: nodeInfo.zIndex || getNodeZIndex(type)
      // Since zIndex is 15 (truthy), should use 15
      const x6NodeConfig = {
        zIndex:
          nodeInfoWithExplicitZIndex.zIndex ||
          infraNodeConfigurationService.getNodeZIndex(nodeInfoWithExplicitZIndex.type),
      };

      expect(x6NodeConfig.zIndex).toBe(15); // Should use explicit zIndex, not default (10)
    });

    it('should use correct type default when no zIndex provided to fromJSON', () => {
      const nodeTypeZIndexMap = [
        { type: 'security-boundary' as NodeType, expectedZIndex: 1 },
        { type: 'process' as NodeType, expectedZIndex: 10 },
        { type: 'store' as NodeType, expectedZIndex: 10 },
        { type: 'actor' as NodeType, expectedZIndex: 10 },
        { type: 'text-box' as NodeType, expectedZIndex: 20 },
      ];

      nodeTypeZIndexMap.forEach(({ type, expectedZIndex }) => {
        const nodeInfo = NodeInfo.fromJSON({
          id: `test-${type}`,
          shape: type,
          position: { x: 0, y: 0 },
          width: 120,
          height: 80,
          label: `Test ${type}`,
          // No zIndex provided - should use type default
          visible: true,
          angle: 0,
          attrs: {
            body: { fill: '#ffffff', stroke: '#000000', strokeWidth: 2 },
            text: { text: `Test ${type}`, fontSize: 12, fill: '#000000' },
          },
          ports: { groups: {}, items: [] },
          data: [],
        });

        expect(nodeInfo.zIndex).toBe(expectedZIndex);
      });
    });
  });
});
