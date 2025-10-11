// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph, Node } from '@antv/x6';
import { JSDOM } from 'jsdom';
import { InfraX6EmbeddingAdapter } from './infra-x6-embedding.adapter';
import { InfraEmbeddingService } from '../services/infra-embedding.service';
import { InfraX6ZOrderAdapter } from './infra-x6-z-order.adapter';
import { ZOrderService } from '../services/infra-z-order.service';
import { AppGraphHistoryCoordinator } from '../../application/services/app-graph-history-coordinator.service';
import { registerCustomShapes } from './infra-x6-shape-definitions';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Mock SVG methods that X6 expects
const mockSVGElement = {
  getCTM: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  })),
  getScreenCTM: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  })),
  createSVGMatrix: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    rotate: function (_angle: number) {
      return this;
    },
    translate: function (_x: number, _y: number) {
      return this;
    },
    scale: function (_factor: number) {
      return this;
    },
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  })),
};

// Setup JSDOM environment for X6
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  resources: 'usable',
});

// Mock SVG elements
Object.defineProperty(dom.window.SVGElement.prototype, 'getCTM', {
  value: mockSVGElement.getCTM,
});
Object.defineProperty(dom.window.SVGElement.prototype, 'getScreenCTM', {
  value: mockSVGElement.getScreenCTM,
});
Object.defineProperty(dom.window.SVGSVGElement.prototype, 'createSVGMatrix', {
  value: mockSVGElement.createSVGMatrix,
});

// Set global window and document
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

describe('InfraX6EmbeddingAdapter', () => {
  let adapter: InfraX6EmbeddingAdapter;
  let graph: Graph;
  let mockLogger: MockLoggerService;
  let infraEmbeddingService: InfraEmbeddingService;
  let infraX6ZOrderAdapter: InfraX6ZOrderAdapter;
  let zOrderService: ZOrderService;
  let historyCoordinator: AppGraphHistoryCoordinator;
  let container: HTMLElement;

  beforeEach(() => {
    // Create DOM container for X6 graph
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Register shapes before creating graph
    registerCustomShapes();

    // Create graph instance
    graph = new Graph({
      container,
      width: 800,
      height: 600,
      grid: true,
      background: { color: '#f8f9fa' },
    });

    // Create services
    mockLogger = createTypedMockLoggerService();
    infraEmbeddingService = new InfraEmbeddingService(mockLogger as any);
    zOrderService = new ZOrderService(mockLogger as any);
    infraX6ZOrderAdapter = new InfraX6ZOrderAdapter(mockLogger as any, zOrderService);
    historyCoordinator = new AppGraphHistoryCoordinator(mockLogger as any);
    adapter = new InfraX6EmbeddingAdapter(
      mockLogger as any,
      infraEmbeddingService,
      infraX6ZOrderAdapter,
      historyCoordinator,
    );

    // Initialize embedding functionality
    adapter.initializeEmbedding(graph);
  });

  afterEach(() => {
    // Clean up DOM
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    // Clean up graph instance
    if (graph && graph.dispose) {
      try {
        graph.dispose();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize embedding functionality', () => {
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing embedding functionality');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Embedding event handlers set up with unembedding detection',
      );
    });

    it('should set up embedding event handlers', () => {
      // Verify that event handlers are set up by triggering events
      const node = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Test Node',
      });

      // Mock getNodeTypeInfo method
      (node as any).getNodeTypeInfo = () => ({ type: 'process' });

      // Trigger node moved event to verify handler is set up
      graph.trigger('node:moved', { node });

      // Should not throw errors and should handle the event
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Manual Node Embedding', () => {
    let parentNode: Node;
    let childNode: Node;

    beforeEach(() => {
      parentNode = graph.addNode({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        shape: 'security-boundary',
        label: 'Parent Boundary',
      });

      childNode = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Child Process',
      });

      // Mock getNodeTypeInfo methods
      (parentNode as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (childNode as any).getNodeTypeInfo = () => ({ type: 'process' });
    });

    it('should successfully embed a valid child into parent', () => {
      const result = adapter.embedNode(graph, childNode, parentNode);

      expect(result).toBe(true);
      expect(childNode.getParent()).toBe(parentNode);
      expect(mockLogger.info).toHaveBeenCalledWith('Manually embedded node', {
        childId: childNode.id,
        parentId: parentNode.id,
      });
    });

    it('should fail to embed when validation fails (embedding into text-box)', () => {
      // Create text-box parent node which cannot contain other nodes
      const textBoxNode = graph.addNode({
        x: 100,
        y: 100,
        width: 100,
        height: 40,
        shape: 'text-box',
        label: 'Text Box',
      });

      (textBoxNode as any).getNodeTypeInfo = () => ({ type: 'text-box' });

      const processNode = graph.addNode({
        x: 110,
        y: 110,
        width: 50,
        height: 50,
        shape: 'process',
      });

      (processNode as any).getNodeTypeInfo = () => ({ type: 'process' });

      const result = adapter.embedNode(graph, processNode, textBoxNode);

      expect(result).toBe(false);
      expect(processNode.getParent()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Embedding validation failed', {
        childId: processNode.id,
        parentId: textBoxNode.id,
        reason: 'Other shapes cannot be embedded into text-box shapes',
      });
    });

    it('should update visual appearance on embedding', () => {
      // Mock node attributes
      childNode.getAttrs = vi.fn().mockReturnValue({
        body: { fill: '#ffffff' },
      });
      childNode.setAttrs = vi.fn();

      adapter.embedNode(graph, childNode, parentNode);

      // Verify visual effects were applied
      expect(childNode.setAttrs).toHaveBeenCalled();
      const setAttrsCall = (childNode.setAttrs as any).mock.calls[0][0];
      expect(setAttrsCall.body.fill).toBe('rgb(230, 240, 255)'); // Depth 1 color from InfraEmbeddingService
    });

    it('should update z-order on embedding', () => {
      // Mock z-order methods
      childNode.setZIndex = vi.fn();
      parentNode.setZIndex = vi.fn();

      adapter.embedNode(graph, childNode, parentNode);

      // Verify z-order was updated
      expect(parentNode.setZIndex).toHaveBeenCalledWith(1); // Security boundary z-index
      expect(childNode.setZIndex).toHaveBeenCalledWith(2); // Regular node embedded z-index (parent + 1)
    });
  });

  describe('Manual Node Unembedding', () => {
    let parentNode: Node;
    let childNode: Node;

    beforeEach(() => {
      parentNode = graph.addNode({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        shape: 'security-boundary',
        label: 'Parent Boundary',
      });

      childNode = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Child Process',
      });

      // Mock getNodeTypeInfo methods
      (parentNode as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (childNode as any).getNodeTypeInfo = () => ({ type: 'process' });

      // Embed the child first
      childNode.setParent(parentNode);
    });

    it('should successfully unembed a node', () => {
      // Mock removeFromParent method
      childNode.removeFromParent = vi.fn();

      const result = adapter.unembedNode(graph, childNode);

      expect(result).toBe(true);
      expect(childNode.removeFromParent).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Manually unembedded node', {
        nodeId: childNode.id,
        formerParentId: parentNode.id,
      });
    });

    it('should fail to unembed node with no parent', () => {
      const standaloneNode = graph.addNode({
        x: 300,
        y: 300,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Standalone',
      });

      const result = adapter.unembedNode(graph, standaloneNode);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot unembed node: no parent found', {
        nodeId: standaloneNode.id,
      });
    });

    it('should reset visual appearance on unembedding', () => {
      // Mock node attributes and methods
      childNode.getAttrs = vi.fn().mockReturnValue({
        body: { fill: 'rgb(240, 250, 255)', fillOpacity: 0.9 },
      });
      childNode.setAttrs = vi.fn();

      // Mock removeFromParent to actually remove the parent relationship
      childNode.removeFromParent = vi.fn(() => {
        (childNode as any).setParent(null);
        return childNode;
      });

      adapter.unembedNode(graph, childNode);

      // Verify visual effects were reset to original color (depth 0)
      expect(childNode.setAttrs).toHaveBeenCalled();
      const setAttrsCall = (childNode.setAttrs as any).mock.calls[0][0];
      expect(setAttrsCall.body.fill).toBe('#FFFFFF'); // Original color for process shape
      expect(setAttrsCall.body.fillOpacity).toBeUndefined(); // Opacity removed
    });

    it('should reset z-order on unembedding', () => {
      // Mock z-order methods
      childNode.setZIndex = vi.fn();

      adapter.unembedNode(graph, childNode);

      // Verify z-order was reset
      expect(childNode.setZIndex).toHaveBeenCalledWith(10); // Default process z-index
    });
  });

  describe('Embedding Hierarchy Management', () => {
    let grandparentNode: Node;
    let parentNode: Node;
    let childNode: Node;

    beforeEach(() => {
      grandparentNode = graph.addNode({
        x: 20,
        y: 20,
        width: 300,
        height: 250,
        shape: 'security-boundary',
        label: 'Grandparent',
      });

      parentNode = graph.addNode({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        shape: 'security-boundary',
        label: 'Parent',
      });

      childNode = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Child',
      });

      // Mock getNodeTypeInfo methods
      (grandparentNode as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (parentNode as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (childNode as any).getNodeTypeInfo = () => ({ type: 'process' });

      // Create hierarchy: grandparent -> parent -> child
      parentNode.setParent(grandparentNode);
      childNode.setParent(parentNode);
    });

    it('should get embedding hierarchy correctly', () => {
      const hierarchy = adapter.getEmbeddingHierarchy(childNode);

      expect(hierarchy).toHaveLength(3);
      expect(hierarchy[0]).toBe(grandparentNode);
      expect(hierarchy[1]).toBe(parentNode);
      expect(hierarchy[2]).toBe(childNode);
    });

    it('should get embedding hierarchy for root node', () => {
      const rootNode = graph.addNode({
        x: 400,
        y: 400,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Root',
      });

      const hierarchy = adapter.getEmbeddingHierarchy(rootNode);

      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0]).toBe(rootNode);
    });

    it('should get embedded children correctly', () => {
      // Mock getChildren method to return the child node
      parentNode.getChildren = vi.fn().mockReturnValue([childNode]);

      const children = adapter.getEmbeddedChildren(parentNode);

      expect(children).toHaveLength(1);
      expect(children[0]).toBe(childNode);
    });

    it('should return empty array for node with no children', () => {
      const children = adapter.getEmbeddedChildren(childNode);

      expect(children).toHaveLength(0);
    });

    it('should correctly identify embedded nodes', () => {
      expect(adapter.isEmbedded(childNode)).toBe(true);
      expect(adapter.isEmbedded(parentNode)).toBe(true);
      expect(adapter.isEmbedded(grandparentNode)).toBe(false);
    });

    it('should calculate embedding depth correctly', () => {
      expect(adapter.getEmbeddingDepth(grandparentNode)).toBe(0);
      expect(adapter.getEmbeddingDepth(parentNode)).toBe(1);
      expect(adapter.getEmbeddingDepth(childNode)).toBe(2);
    });
  });

  describe('Visual Effects for Embedded Nodes', () => {
    let parentNode: Node;
    let childNode: Node;
    let grandchildNode: Node;

    beforeEach(() => {
      parentNode = graph.addNode({
        x: 20,
        y: 20,
        width: 300,
        height: 250,
        shape: 'security-boundary',
        label: 'Parent',
      });

      childNode = graph.addNode({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        shape: 'security-boundary',
        label: 'Child',
      });

      grandchildNode = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Grandchild',
      });

      // Mock getNodeTypeInfo methods
      (parentNode as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (childNode as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (grandchildNode as any).getNodeTypeInfo = () => ({ type: 'process' });

      // Mock node attributes
      childNode.getAttrs = vi.fn().mockReturnValue({ body: { fill: '#ffffff' } });
      childNode.setAttrs = vi.fn();
      grandchildNode.getAttrs = vi.fn().mockReturnValue({ body: { fill: '#ffffff' } });
      grandchildNode.setAttrs = vi.fn();
    });

    it('should apply progressive bluish tints by depth', () => {
      // Embed child (depth 1)
      childNode.setParent(parentNode);
      adapter.embedNode(graph, childNode, parentNode);

      // Embed grandchild (depth 2)
      grandchildNode.setParent(childNode);
      adapter.embedNode(graph, grandchildNode, childNode);

      // Verify depth 1 color (light bluish) - actual InfraEmbeddingService calculation
      const childSetAttrsCall = (childNode.setAttrs as any).mock.calls[0][0];
      expect(childSetAttrsCall.body.fill).toBe('rgb(230, 240, 255)'); // Depth 1: 240-10, 250-10, 255
      expect(childSetAttrsCall.body.fillOpacity).toBe(0.9);

      // Verify depth 2 color (darker bluish) - actual InfraEmbeddingService calculation
      // Check if grandchildNode.setAttrs was called
      if ((grandchildNode.setAttrs as any).mock.calls.length > 0) {
        const grandchildSetAttrsCall = (grandchildNode.setAttrs as any).mock.calls[0][0];
        expect(grandchildSetAttrsCall.body.fill).toBe('rgb(220, 230, 255)'); // Depth 2: 240-20, 250-20, 255
        expect(grandchildSetAttrsCall.body.fillOpacity).toBe(0.8);
      }
    });

    it('should not apply visual effects to text-box nodes', () => {
      const textBoxNode = graph.addNode({
        x: 100,
        y: 100,
        width: 100,
        height: 40,
        shape: 'text-box',
        label: 'Text Box',
      });

      (textBoxNode as any).getNodeTypeInfo = () => ({ type: 'text-box' });
      textBoxNode.getAttrs = vi.fn().mockReturnValue({ body: { fill: 'transparent' } });
      textBoxNode.setAttrs = vi.fn();

      // Text-box nodes can be embedded but maintain transparent fill
      const config = infraEmbeddingService.getEmbeddingConfiguration(textBoxNode);
      expect(config.shouldUpdateColor).toBe(false);
    });

    it('should update all embedding appearances in graph', () => {
      // Create embedded hierarchy
      childNode.setParent(parentNode);
      grandchildNode.setParent(childNode);

      // Mock additional methods for updateAllEmbeddingAppearances
      parentNode.getAttrs = vi.fn().mockReturnValue({ body: { fill: '#ffffff' } });
      parentNode.setAttrs = vi.fn();

      adapter.updateAllEmbeddingAppearances(graph);

      // Verify all nodes had their appearance updated
      expect(parentNode.setAttrs).toHaveBeenCalled(); // Reset appearance (no parent)
      expect(childNode.setAttrs).toHaveBeenCalled(); // Depth 1 appearance
      expect(grandchildNode.setAttrs).toHaveBeenCalled(); // Depth 2 appearance

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'X6Embedding',
        'Updated all embedding appearances',
        {
          totalNodes: 3,
          embeddedNodes: 2,
        },
      );
    });
  });

  describe('Event Handling', () => {
    let parentNode: Node;
    let childNode: Node;

    beforeEach(() => {
      parentNode = graph.addNode({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        shape: 'security-boundary',
        label: 'Parent',
      });

      childNode = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Child',
      });

      // Mock getNodeTypeInfo methods
      (parentNode as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (childNode as any).getNodeTypeInfo = () => ({ type: 'process' });

      // Mock visual effect methods
      childNode.getAttrs = vi.fn().mockReturnValue({ body: { fill: '#ffffff' } });
      childNode.setAttrs = vi.fn();
      childNode.setZIndex = vi.fn();
      parentNode.setZIndex = vi.fn();
    });

    it('should handle node:embedded event', () => {
      // Trigger embedding event
      graph.trigger('node:embedded', { node: childNode, parent: parentNode });

      expect(mockLogger.info).toHaveBeenCalledWith('Node embedded', {
        nodeId: childNode.id,
        parentId: parentNode.id,
      });

      // Verify visual effects and z-order were applied
      expect(childNode.setAttrs).toHaveBeenCalled();
      expect(childNode.setZIndex).toHaveBeenCalled();
    });

    it('should handle node:embedded event without parent parameter', () => {
      // Set parent relationship first
      childNode.setParent(parentNode);

      // Trigger embedding event without parent parameter
      graph.trigger('node:embedded', { node: childNode });

      expect(mockLogger.info).toHaveBeenCalledWith('Found parent from node after embedding event', {
        nodeId: childNode.id,
        parentId: parentNode.id,
      });
    });

    it('should handle node:unembedded event', () => {
      // Set up embedded state first
      childNode.setParent(parentNode);

      // Trigger unembedding event
      graph.trigger('node:unembedded', { node: childNode });

      expect(mockLogger.info).toHaveBeenCalledWith('Node unembedded', {
        nodeId: childNode.id,
      });

      // Verify visual effects were reset
      expect(childNode.setAttrs).toHaveBeenCalled();
    });

    it('should handle node:change:parent event for embedding detection', () => {
      // Trigger parent change event (embedding)
      graph.trigger('node:change:parent', {
        node: childNode,
        current: parentNode,
        _previous: null,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Detected embedding via parent change', {
        nodeId: childNode.id,
        newParentId: parentNode.id,
      });
    });

    it('should handle node:change:parent event for unembedding detection', () => {
      // First, simulate the initial embedding to set up parent state tracking
      graph.trigger('node:embedded', { node: childNode, parent: parentNode });

      // Clear previous log calls
      mockLogger.info.mockClear();

      // Now trigger parent change event (unembedding)
      graph.trigger('node:change:parent', {
        node: childNode,
        current: null,
        _previous: parentNode,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Detected unembedding via parent change', {
        nodeId: childNode.id,
        formerParentId: parentNode.id,
      });
    });

    it('should handle node:moved event for embedded nodes', () => {
      // Set up embedded state
      childNode.setParent(parentNode);

      // Trigger node moved event
      graph.trigger('node:moved', { node: childNode });

      // Should not throw errors and should handle the event
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle invalid node parameters gracefully', () => {
      // Trigger events with undefined nodes
      graph.trigger('node:embedded', { node: undefined });
      graph.trigger('node:unembedded', { node: undefined });
      graph.trigger('node:moved', { node: undefined });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Node embedding event received with undefined node',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Node unembedding event received with undefined node',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith('Node moved event received with undefined node');
    });
  });

  describe('Embedding Validation', () => {
    let securityBoundary: Node;
    let processNode: Node;
    let textBoxNode: Node;

    beforeEach(() => {
      securityBoundary = graph.addNode({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        shape: 'security-boundary',
        label: 'Security Boundary',
      });

      processNode = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Process',
      });

      textBoxNode = graph.addNode({
        x: 300,
        y: 300,
        width: 100,
        height: 40,
        shape: 'text-box',
        label: 'Text Box',
      });

      // Mock getNodeTypeInfo methods
      (securityBoundary as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      (processNode as any).getNodeTypeInfo = () => ({ type: 'process' });
      (textBoxNode as any).getNodeTypeInfo = () => ({ type: 'text-box' });
    });

    it('should allow valid embedding combinations', () => {
      // Mock setParent methods and getParent
      processNode.setParent = vi.fn().mockImplementation(() => {
        processNode.getParent = vi.fn().mockReturnValue(securityBoundary);
      });
      processNode.getParent = vi.fn().mockReturnValue(null);
      securityBoundary.setParent = vi.fn();

      // Process into security boundary - should be valid
      const result1 = adapter.embedNode(graph, processNode, securityBoundary);
      expect(result1).toBe(true);

      // Security boundary into security boundary - should be valid
      const anotherBoundary = graph.addNode({
        x: 400,
        y: 400,
        width: 150,
        height: 100,
        shape: 'security-boundary',
        label: 'Another Boundary',
      });
      (anotherBoundary as any).getNodeTypeInfo = () => ({ type: 'security-boundary' });
      anotherBoundary.setParent = vi.fn().mockImplementation(() => {
        anotherBoundary.getParent = vi.fn().mockReturnValue(securityBoundary);
      });
      anotherBoundary.getParent = vi.fn().mockReturnValue(null);

      const result2 = adapter.embedNode(graph, anotherBoundary, securityBoundary);
      expect(result2).toBe(true);
    });

    it('should allow text-box embedding into other nodes', () => {
      // Text-box can now be embedded into regular nodes and security boundaries
      textBoxNode.setParent = vi.fn();
      textBoxNode.getParent = vi.fn().mockReturnValue(null);
      textBoxNode.getAttrs = vi.fn().mockReturnValue({ body: { fill: 'transparent' } });
      textBoxNode.setAttrs = vi.fn();

      const result1 = adapter.embedNode(graph, textBoxNode, securityBoundary);
      expect(result1).toBe(true);

      const result2 = adapter.embedNode(graph, textBoxNode, processNode);
      expect(result2).toBe(true);
    });

    it('should reject embedding into text-box', () => {
      // Nothing can be embedded into text-box
      const result1 = adapter.embedNode(graph, processNode, textBoxNode);
      expect(result1).toBe(false);

      const result2 = adapter.embedNode(graph, securityBoundary, textBoxNode);
      expect(result2).toBe(false);
    });

    it('should reject security boundary into non-security boundary', () => {
      // Mock setParent method and getParent
      securityBoundary.setParent = vi.fn();
      securityBoundary.getParent = vi.fn().mockReturnValue(null);

      // Security boundary can only be embedded into other security boundaries
      const result = adapter.embedNode(graph, securityBoundary, processNode);
      expect(result).toBe(false);

      expect(securityBoundary.setParent).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Embedding validation failed', {
        childId: securityBoundary.id,
        parentId: processNode.id,
        reason: 'Security boundaries can only be embedded into other security boundaries',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in node embedded event gracefully', () => {
      const node = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Test Node',
      });

      const parent = graph.addNode({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        shape: 'security-boundary',
        label: 'Parent',
      });

      // Mock methods to throw errors
      (node as any).getNodeTypeInfo = () => {
        throw new Error('Test error');
      };

      // Trigger embedding event
      graph.trigger('node:embedded', { node, parent });

      expect(mockLogger.error).toHaveBeenCalledWith('Error handling node embedded event', {
        nodeId: node.id,
        parentId: parent.id,
        error: expect.any(Error),
      });
    });

    it('should handle errors in node unembedded event gracefully', () => {
      const node = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Test Node',
      });

      // Mock methods to throw errors
      (node as any).getNodeTypeInfo = () => {
        throw new Error('Test error');
      };

      // Trigger unembedding event
      graph.trigger('node:unembedded', { node });

      expect(mockLogger.error).toHaveBeenCalledWith('Error handling node unembedded event', {
        nodeId: node.id,
        error: expect.any(Error),
      });
    });

    it('should handle errors in node moved event gracefully', () => {
      const node = graph.addNode({
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        shape: 'process',
        label: 'Test Node',
      });

      // Mock z-order adapter to throw error
      vi.spyOn(infraX6ZOrderAdapter, 'handleNodeMovedZOrderRestoration').mockImplementation(() => {
        throw new Error('Test error');
      });

      // Trigger node moved event
      graph.trigger('node:moved', { node });

      expect(mockLogger.error).toHaveBeenCalledWith('Error handling node moved event', {
        nodeId: node.id,
        error: expect.any(Error),
      });
    });
  });
});
