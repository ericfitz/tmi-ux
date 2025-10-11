// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph, Node } from '@antv/x6';
import { InfraEmbeddingService } from './infra-embedding.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Mock SVG methods for X6 compatibility
const mockMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
  inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  multiply: vi.fn().mockReturnThis(),
  translate: vi.fn().mockReturnThis(),
  scale: vi.fn().mockReturnThis(),
  rotate: vi.fn().mockReturnThis(),
};

Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

describe('InfraEmbeddingService', () => {
  let service: InfraEmbeddingService;
  let mockLogger: MockLoggerService;
  let graph: Graph;
  let container: HTMLElement;

  beforeEach(() => {
    // Create mock logger
    mockLogger = createTypedMockLoggerService();

    // Create service instance
    service = new InfraEmbeddingService(mockLogger as unknown as LoggerService);

    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create graph
    graph = new Graph({
      container,
      width: 800,
      height: 600,
    });
  });

  afterEach(() => {
    // Clean up graph and container
    if (graph) {
      graph.dispose();
    }
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }

    // Clear all mocks
    vi.clearAllMocks();
  });

  // Helper function to create a mock node with node type info
  function createMockNodeWithType(
    id: string,
    type: string,
    position: { x: number; y: number } = { x: 100, y: 100 },
    size: { width: number; height: number } = { width: 100, height: 50 },
  ): Node {
    const node = graph.addNode({
      id,
      shape: 'rect',
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    });

    // Mock the getNodeTypeInfo method
    (node as any).getNodeTypeInfo = () => ({ type });

    return node;
  }

  describe('Embedding Depth Calculations', () => {
    it('should calculate depth 0 for non-embedded node', () => {
      const node = createMockNodeWithType('node1', 'process');

      const depth = service.calculateEmbeddingDepth(node);

      expect(depth).toBe(0);
    });

    it('should calculate depth 1 for single-level embedding', () => {
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'process');

      child.setParent(parent);

      const depth = service.calculateEmbeddingDepth(child);

      expect(depth).toBe(1);
    });

    it('should calculate depth 2 for two-level embedding', () => {
      const grandparent = createMockNodeWithType('grandparent', 'process');
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'process');

      parent.setParent(grandparent);
      child.setParent(parent);

      const depth = service.calculateEmbeddingDepth(child);

      expect(depth).toBe(2);
    });

    it('should calculate depth 3 for three-level embedding', () => {
      const greatGrandparent = createMockNodeWithType('greatGrandparent', 'process');
      const grandparent = createMockNodeWithType('grandparent', 'process');
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'process');

      grandparent.setParent(greatGrandparent);
      parent.setParent(grandparent);
      child.setParent(parent);

      const depth = service.calculateEmbeddingDepth(child);

      expect(depth).toBe(3);
    });

    it('should prevent infinite loops with maximum depth limit', () => {
      const node1 = createMockNodeWithType('node1', 'process');

      // Create a deep hierarchy that would exceed the limit
      let currentNode = node1;
      for (let i = 0; i < 15; i++) {
        const nextNode = createMockNodeWithType(`node${i + 2}`, 'process');
        nextNode.setParent(currentNode);
        currentNode = nextNode;
      }

      const depth = service.calculateEmbeddingDepth(currentNode);

      expect(depth).toBe(11); // Should be capped at 11 (increments before check)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Maximum embedding depth reached, breaking loop',
        { nodeId: currentNode.id },
      );
    });

    it('should handle nodes with non-node parents', () => {
      const node = createMockNodeWithType('node1', 'process');
      const edge = graph.addEdge({
        source: { x: 100, y: 100 },
        target: { x: 200, y: 200 },
      });

      // Set edge as parent (which is not a node)
      node.setParent(edge);

      const depth = service.calculateEmbeddingDepth(node);

      expect(depth).toBe(1); // Edge parent counts as one level
    });
  });

  describe('Fill Color Generation', () => {
    it('should return white for depth 0', () => {
      const color = service.calculateEmbeddingFillColor(0);

      expect(color).toBe('#FFFFFF');
    });

    it('should return light bluish color for depth 1', () => {
      const color = service.calculateEmbeddingFillColor(1);

      expect(color).toBe('rgb(230, 240, 255)'); // 240-10, 250-10, 255
    });

    it('should return darker bluish color for depth 2', () => {
      const color = service.calculateEmbeddingFillColor(2);

      expect(color).toBe('rgb(220, 230, 255)'); // 240-20, 250-20, 255
    });

    it('should return progressively darker colors for higher depths', () => {
      const color3 = service.calculateEmbeddingFillColor(3);
      const color4 = service.calculateEmbeddingFillColor(4);
      const color5 = service.calculateEmbeddingFillColor(5);

      expect(color3).toBe('rgb(210, 220, 255)'); // 240-30, 250-30, 255
      expect(color4).toBe('rgb(200, 210, 255)'); // 240-40, 250-40, 255
      expect(color5).toBe('rgb(200, 200, 255)'); // Capped at 200 for green
    });

    it('should cap color reduction to prevent going too dark', () => {
      const color10 = service.calculateEmbeddingFillColor(10);

      expect(color10).toBe('rgb(200, 200, 255)'); // Should be capped at minimum values
    });

    it('should maintain blue at maximum for bluish tint', () => {
      const color1 = service.calculateEmbeddingFillColor(1);
      const color5 = service.calculateEmbeddingFillColor(5);
      const color10 = service.calculateEmbeddingFillColor(10);

      expect(color1).toContain('255)'); // Blue should always be 255
      expect(color5).toContain('255)');
      expect(color10).toContain('255)');
    });
  });

  describe('Embedding Configuration', () => {
    it('should return complete configuration for non-embedded process node', () => {
      const node = createMockNodeWithType('node1', 'process');

      const config = service.getEmbeddingConfiguration(node);

      expect(config).toEqual({
        depth: 0,
        fillColor: '#FFFFFF',
        shouldUpdateColor: true,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Calculated embedding configuration', {
        nodeId: 'node1',
        nodeType: 'process',
        embeddingDepth: 0,
        fillColor: '#FFFFFF',
        shouldUpdateColor: true,
      });
    });

    it('should return configuration for embedded process node', () => {
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'process');
      child.setParent(parent);

      const config = service.getEmbeddingConfiguration(child);

      expect(config).toEqual({
        depth: 1,
        fillColor: 'rgb(230, 240, 255)',
        shouldUpdateColor: true,
      });
    });

    it('should not update color for text-box nodes', () => {
      const node = createMockNodeWithType('textbox1', 'text-box');

      const config = service.getEmbeddingConfiguration(node);

      expect(config.shouldUpdateColor).toBe(false);
      expect(config.depth).toBe(0);
      expect(config.fillColor).toBe('#FFFFFF');
    });

    it('should handle nodes without getNodeTypeInfo method', () => {
      const node = graph.addNode({
        id: 'node1',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const config = service.getEmbeddingConfiguration(node);

      expect(config.shouldUpdateColor).toBe(true); // Default to process type
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Calculated embedding configuration',
        expect.objectContaining({
          nodeType: 'process',
        }),
      );
    });
  });

  describe('Embedding Validation', () => {
    it('should allow process nodes to be embedded in process nodes', () => {
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'process');

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow actor nodes to be embedded in process nodes', () => {
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'actor');

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(true);
    });

    it('should allow store nodes to be embedded in process nodes', () => {
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'store');

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(true);
    });

    it('should allow text-box nodes to be embedded', () => {
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'text-box');

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(true);
    });

    it('should not allow embedding into text-box nodes', () => {
      const parent = createMockNodeWithType('parent', 'text-box');
      const child = createMockNodeWithType('child', 'process');

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Other shapes cannot be embedded into text-box shapes');
    });

    it('should allow security boundaries to be embedded in security boundaries', () => {
      const parent = createMockNodeWithType('parent', 'security-boundary');
      const child = createMockNodeWithType('child', 'security-boundary');

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(true);
    });

    it('should not allow security boundaries to be embedded in non-security-boundary nodes', () => {
      const parent = createMockNodeWithType('parent', 'process');
      const child = createMockNodeWithType('child', 'security-boundary');

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(
        'Security boundaries can only be embedded into other security boundaries',
      );
    });

    it('should handle nodes without getNodeTypeInfo method', () => {
      const parent = graph.addNode({
        id: 'parent',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });
      const child = graph.addNode({
        id: 'child',
        shape: 'rect',
        x: 150,
        y: 150,
        width: 80,
        height: 40,
      });

      const result = service.validateEmbedding(parent, child);

      expect(result.isValid).toBe(true); // Default to process type
    });
  });

  describe('Z-Index Calculations', () => {
    describe('Embedding Z-Indexes', () => {
      it('should calculate z-indexes for process nodes embedding', () => {
        const parent = createMockNodeWithType('parent', 'process');
        const child = createMockNodeWithType('child', 'process');

        const result = service.calculateEmbeddingZIndexes(parent, child);

        expect(result).toEqual({
          parentZIndex: 10,
          childZIndex: 15,
        });
      });

      it('should calculate z-indexes for security boundary parent', () => {
        const parent = createMockNodeWithType('parent', 'security-boundary');
        const child = createMockNodeWithType('child', 'process');

        const result = service.calculateEmbeddingZIndexes(parent, child);

        expect(result).toEqual({
          parentZIndex: 1, // Security boundaries stay at back
          childZIndex: 15,
        });
      });

      it('should calculate z-indexes for security boundary child', () => {
        const parent = createMockNodeWithType('parent', 'security-boundary');
        const child = createMockNodeWithType('child', 'security-boundary');

        const result = service.calculateEmbeddingZIndexes(parent, child);

        expect(result).toEqual({
          parentZIndex: 1,
          childZIndex: 2, // Security boundary child slightly higher but still behind regular nodes
        });
      });

      it('should handle nodes without getNodeTypeInfo method', () => {
        const parent = graph.addNode({
          id: 'parent',
          shape: 'rect',
          x: 100,
          y: 100,
          width: 100,
          height: 50,
        });
        const child = graph.addNode({
          id: 'child',
          shape: 'rect',
          x: 150,
          y: 150,
          width: 80,
          height: 40,
        });

        const result = service.calculateEmbeddingZIndexes(parent, child);

        expect(result).toEqual({
          parentZIndex: 10, // Default to process type
          childZIndex: 15,
        });
      });
    });

    describe('Unembedding Z-Index', () => {
      it('should return default z-index for process node', () => {
        const node = createMockNodeWithType('node1', 'process');

        const zIndex = service.calculateUnembeddingZIndex(node);

        expect(zIndex).toBe(10);
      });

      it('should return back z-index for security boundary', () => {
        const node = createMockNodeWithType('node1', 'security-boundary');

        const zIndex = service.calculateUnembeddingZIndex(node);

        expect(zIndex).toBe(1);
      });

      it('should return default z-index for actor node', () => {
        const node = createMockNodeWithType('node1', 'actor');

        const zIndex = service.calculateUnembeddingZIndex(node);

        expect(zIndex).toBe(10);
      });

      it('should handle nodes without getNodeTypeInfo method', () => {
        const node = graph.addNode({
          id: 'node1',
          shape: 'rect',
          x: 100,
          y: 100,
          width: 100,
          height: 50,
        });

        const zIndex = service.calculateUnembeddingZIndex(node);

        expect(zIndex).toBe(10); // Default to process type
      });
    });

    describe('Temporary Embedding Z-Index', () => {
      it('should return high temporary z-index for process node', () => {
        const node = createMockNodeWithType('node1', 'process');

        const zIndex = service.getTemporaryEmbeddingZIndex(node);

        expect(zIndex).toBe(20);
      });

      it('should return moderate temporary z-index for security boundary', () => {
        const node = createMockNodeWithType('node1', 'security-boundary');

        const zIndex = service.getTemporaryEmbeddingZIndex(node);

        expect(zIndex).toBe(5); // Higher than normal but still behind regular nodes
      });

      it('should return high temporary z-index for actor node', () => {
        const node = createMockNodeWithType('node1', 'actor');

        const zIndex = service.getTemporaryEmbeddingZIndex(node);

        expect(zIndex).toBe(20);
      });

      it('should handle nodes without getNodeTypeInfo method', () => {
        const node = graph.addNode({
          id: 'node1',
          shape: 'rect',
          x: 100,
          y: 100,
          width: 100,
          height: 50,
        });

        const zIndex = service.getTemporaryEmbeddingZIndex(node);

        expect(zIndex).toBe(20); // Default to process type
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null parent in depth calculation', () => {
      const node = createMockNodeWithType('node1', 'process');

      // Mock getParent to return null
      vi.spyOn(node, 'getParent').mockReturnValue(null);

      const depth = service.calculateEmbeddingDepth(node);

      expect(depth).toBe(0);
    });

    it('should handle negative depth values in color calculation', () => {
      const color = service.calculateEmbeddingFillColor(-1);

      expect(color).toBe('rgb(250, 260, 255)'); // Negative depth processed normally
    });

    it('should handle very large depth values in color calculation', () => {
      const color = service.calculateEmbeddingFillColor(100);

      expect(color).toBe('rgb(200, 200, 255)'); // Should be capped
    });

    it('should handle embedding validation with same node as parent and child', () => {
      const node = createMockNodeWithType('node1', 'process');

      const result = service.validateEmbedding(node, node);

      expect(result.isValid).toBe(false); // Self-embedding should be prevented (circular embedding)
      expect(result.reason).toContain('Circular embedding');
    });

    it('should handle z-index calculations with mixed node types', () => {
      const securityBoundary = createMockNodeWithType('sb1', 'security-boundary');
      const actor = createMockNodeWithType('actor1', 'actor');
      const store = createMockNodeWithType('store1', 'store');

      const result1 = service.calculateEmbeddingZIndexes(securityBoundary, actor);
      const result2 = service.calculateEmbeddingZIndexes(actor, store);

      expect(result1.parentZIndex).toBe(1); // Security boundary parent
      expect(result1.childZIndex).toBe(15); // Regular node child
      expect(result2.parentZIndex).toBe(10); // Regular node parent
      expect(result2.childZIndex).toBe(15); // Regular node child
    });
  });
});
