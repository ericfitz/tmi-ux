// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { Node, Edge } from '@antv/x6';
import { ZOrderService } from './z-order.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { vi, expect, beforeEach, describe, it } from 'vitest';

// Mock interfaces for type safety
interface MockLoggerService {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

interface MockNode {
  id: string;
  getZIndex: ReturnType<typeof vi.fn>;
  getParent: ReturnType<typeof vi.fn>;
  getChildren: ReturnType<typeof vi.fn>;
  isNode: ReturnType<typeof vi.fn>;
  getNodeTypeInfo?: ReturnType<typeof vi.fn>;
}

interface MockEdge {
  id: string;
  getZIndex: ReturnType<typeof vi.fn>;
}

describe('ZOrderService', () => {
  let service: ZOrderService;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new ZOrderService(mockLogger as unknown as LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getNewSecurityBoundaryZIndex', () => {
    it('should return 1 for new security boundaries', () => {
      const result = service.getNewSecurityBoundaryZIndex();
      expect(result).toBe(1);
    });
  });

  describe('getNewNodeZIndex', () => {
    it('should return 1 for security boundary nodes', () => {
      const result = service.getNewNodeZIndex('security-boundary');
      expect(result).toBe(1);
    });

    it('should return 10 for regular nodes', () => {
      const result = service.getNewNodeZIndex('process');
      expect(result).toBe(10);
    });

    it('should return 20 for textbox nodes', () => {
      const result = service.getNewNodeZIndex('text-box');
      expect(result).toBe(20);
    });
  });

  describe('getNewEdgeZIndex', () => {
    let sourceNode: MockNode;
    let targetNode: MockNode;

    beforeEach(() => {
      sourceNode = {
        id: 'source-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
      targetNode = {
        id: 'target-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
    });

    it('should return the higher z-index of source and target nodes', () => {
      sourceNode.getZIndex.mockReturnValue(5);
      targetNode.getZIndex.mockReturnValue(8);

      const result = service.getNewEdgeZIndex(
        sourceNode as unknown as Node,
        targetNode as unknown as Node,
      );
      expect(result).toBe(8);
    });

    it('should return source z-index when it is higher', () => {
      sourceNode.getZIndex.mockReturnValue(12);
      targetNode.getZIndex.mockReturnValue(7);

      const result = service.getNewEdgeZIndex(
        sourceNode as unknown as Node,
        targetNode as unknown as Node,
      );
      expect(result).toBe(12);
    });

    it('should handle undefined z-index values with defaults', () => {
      sourceNode.getZIndex.mockReturnValue(undefined);
      targetNode.getZIndex.mockReturnValue(15);

      const result = service.getNewEdgeZIndex(
        sourceNode as unknown as Node,
        targetNode as unknown as Node,
      );
      expect(result).toBe(15);
    });

    it('should use default values when both nodes have undefined z-index', () => {
      sourceNode.getZIndex.mockReturnValue(undefined);
      targetNode.getZIndex.mockReturnValue(undefined);

      const result = service.getNewEdgeZIndex(
        sourceNode as unknown as Node,
        targetNode as unknown as Node,
      );
      expect(result).toBe(10); // Default z-index for process nodes
    });
  });

  describe('updateEdgeZIndexOnReconnection', () => {
    let edge: MockEdge;
    let sourceNode: MockNode;
    let targetNode: MockNode;

    beforeEach(() => {
      edge = {
        id: 'edge-1',
        getZIndex: vi.fn(),
      };
      sourceNode = {
        id: 'source-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
      targetNode = {
        id: 'target-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
    });

    it('should calculate and return new z-index based on connected nodes', () => {
      sourceNode.getZIndex.mockReturnValue(5);
      targetNode.getZIndex.mockReturnValue(8);

      const result = service.updateEdgeZIndexOnReconnection(
        edge as unknown as Edge,
        sourceNode as unknown as Node,
        targetNode as unknown as Node,
      );

      expect(result).toBe(8);
      expect(mockLogger.info).toHaveBeenCalledWith('Updating edge z-index on reconnection', {
        edgeId: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        sourceZIndex: 5,
        targetZIndex: 8,
        newEdgeZIndex: 8,
      });
    });
  });

  describe('calculateEmbeddedNodeZIndex', () => {
    let parentNode: MockNode;
    let childNode: MockNode;

    beforeEach(() => {
      parentNode = {
        id: 'parent-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
      childNode = {
        id: 'child-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
        getNodeTypeInfo: vi.fn(),
      };
    });

    it('should return parent z-index + 1 for regular nodes', () => {
      parentNode.getZIndex.mockReturnValue(10);
      childNode.getNodeTypeInfo!.mockReturnValue({ type: 'process' });

      const result = service.calculateEmbeddedNodeZIndex(
        parentNode as unknown as Node,
        childNode as unknown as Node,
      );

      expect(result).toBe(11);
      expect(mockLogger.info).toHaveBeenCalledWith('Calculated embedded node z-index', {
        parentId: 'parent-1',
        parentZIndex: 10,
        childId: 'child-1',
        childType: 'process',
        calculatedZIndex: 11,
      });
    });

    it('should handle security boundary child nodes with special rules', () => {
      parentNode.getZIndex.mockReturnValue(10);
      childNode.getNodeTypeInfo!.mockReturnValue({ type: 'security-boundary' });

      const result = service.calculateEmbeddedNodeZIndex(
        parentNode as unknown as Node,
        childNode as unknown as Node,
      );

      expect(result).toBe(11); // Math.max(10 + 1, 2) = 11
    });

    it('should ensure minimum z-index of 2 for embedded security boundaries', () => {
      parentNode.getZIndex.mockReturnValue(1);
      childNode.getNodeTypeInfo!.mockReturnValue({ type: 'security-boundary' });

      const result = service.calculateEmbeddedNodeZIndex(
        parentNode as unknown as Node,
        childNode as unknown as Node,
      );

      expect(result).toBe(2); // Math.max(1 + 1, 2) = 2
    });

    it('should handle undefined parent z-index', () => {
      parentNode.getZIndex.mockReturnValue(undefined);
      childNode.getNodeTypeInfo!.mockReturnValue({ type: 'process' });

      const result = service.calculateEmbeddedNodeZIndex(
        parentNode as unknown as Node,
        childNode as unknown as Node,
      );

      expect(result).toBe(11); // Default 10 + 1
    });
  });

  describe('getDescendantNodesForCascadingUpdate', () => {
    let parentNode: MockNode;
    let childNode1: MockNode;
    let childNode2: MockNode;
    let grandchildNode: MockNode;

    beforeEach(() => {
      parentNode = {
        id: 'parent-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
      childNode1 = {
        id: 'child-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
      childNode2 = {
        id: 'child-2',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
      grandchildNode = {
        id: 'grandchild-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
    });

    it('should return empty array when node has no children', () => {
      parentNode.getChildren.mockReturnValue([]);

      const result = service.getDescendantNodesForCascadingUpdate(parentNode as unknown as Node);

      expect(result).toEqual([]);
    });

    it('should return direct children when they have no descendants', () => {
      childNode1.isNode.mockReturnValue(true);
      childNode1.getChildren.mockReturnValue([]);
      childNode2.isNode.mockReturnValue(true);
      childNode2.getChildren.mockReturnValue([]);

      parentNode.getChildren.mockReturnValue([childNode1, childNode2]);

      const result = service.getDescendantNodesForCascadingUpdate(parentNode as unknown as Node);

      expect(result).toEqual([childNode1, childNode2]);
    });

    it('should recursively include grandchildren', () => {
      grandchildNode.isNode.mockReturnValue(true);
      grandchildNode.getChildren.mockReturnValue([]);

      childNode1.isNode.mockReturnValue(true);
      childNode1.getChildren.mockReturnValue([grandchildNode]);
      childNode2.isNode.mockReturnValue(true);
      childNode2.getChildren.mockReturnValue([]);

      parentNode.getChildren.mockReturnValue([childNode1, childNode2]);

      const result = service.getDescendantNodesForCascadingUpdate(parentNode as unknown as Node);

      expect(result).toEqual([childNode1, grandchildNode, childNode2]);
    });

    it('should filter out non-node children', () => {
      const nonNodeChild = {
        id: 'non-node',
        isNode: vi.fn().mockReturnValue(false),
      };

      childNode1.isNode.mockReturnValue(true);
      childNode1.getChildren.mockReturnValue([]);

      parentNode.getChildren.mockReturnValue([childNode1, nonNodeChild]);

      const result = service.getDescendantNodesForCascadingUpdate(parentNode as unknown as Node);

      expect(result).toEqual([childNode1]);
    });
  });

  describe('validateEmbeddingZOrderHierarchy', () => {
    let parentNode: MockNode;
    let childNode: MockNode;

    beforeEach(() => {
      parentNode = {
        id: 'parent-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
      };
      childNode = {
        id: 'child-1',
        getZIndex: vi.fn(),
        getParent: vi.fn(),
        getChildren: vi.fn(),
        isNode: vi.fn(),
        getNodeTypeInfo: vi.fn(),
      };
    });

    it('should return empty array when all nodes have correct hierarchy', () => {
      parentNode.getZIndex.mockReturnValue(10);
      childNode.getParent.mockReturnValue(parentNode);
      childNode.getZIndex.mockReturnValue(15);

      const result = service.validateEmbeddingZOrderHierarchy([
        parentNode as unknown as Node,
        childNode as unknown as Node,
      ]);

      expect(result).toEqual([]);
    });

    it('should detect violations when child z-index is not higher than parent', () => {
      parentNode.getZIndex.mockReturnValue(10);
      parentNode.isNode.mockReturnValue(true);
      childNode.getParent.mockReturnValue(parentNode);
      childNode.getZIndex.mockReturnValue(8); // Lower than parent
      childNode.getNodeTypeInfo!.mockReturnValue({ type: 'process' });

      const result = service.validateEmbeddingZOrderHierarchy([
        parentNode as unknown as Node,
        childNode as unknown as Node,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        node: childNode,
        issue: 'Embedded node z-index 8 <= parent z-index 10',
        correctedZIndex: 11, // parent (10) + 1
      });
    });

    it('should ignore nodes without parents', () => {
      childNode.getParent.mockReturnValue(null);
      childNode.getZIndex.mockReturnValue(5);

      const result = service.validateEmbeddingZOrderHierarchy([childNode as unknown as Node]);

      expect(result).toEqual([]);
    });

    it('should handle equal z-index values as violations', () => {
      parentNode.getZIndex.mockReturnValue(10);
      parentNode.isNode.mockReturnValue(true);
      childNode.getParent.mockReturnValue(parentNode);
      childNode.getZIndex.mockReturnValue(10); // Equal to parent
      childNode.getNodeTypeInfo!.mockReturnValue({ type: 'process' });

      const result = service.validateEmbeddingZOrderHierarchy([
        parentNode as unknown as Node,
        childNode as unknown as Node,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].issue).toBe('Embedded node z-index 10 <= parent z-index 10');
    });
  });

  describe('calculateUnembeddedSecurityBoundaryZIndex', () => {
    it('should return default security boundary z-index for unembedded security boundary node', () => {
      // Arrange
      const mockNode: MockNode = {
        id: 'security-boundary-1',
        getZIndex: vi.fn().mockReturnValue(5),
        getParent: vi.fn().mockReturnValue(null), // Not embedded
        getChildren: vi.fn(),
        isNode: vi.fn(),
        getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'security-boundary' }),
      };

      // Act
      const result = service.calculateUnembeddedSecurityBoundaryZIndex(mockNode as unknown as Node);

      // Assert
      expect(result).toBe(1); // Default security boundary z-index
    });

    it('should return default security boundary z-index even if node has higher current z-index', () => {
      // Arrange
      const mockNode: MockNode = {
        id: 'security-boundary-1',
        getZIndex: vi.fn().mockReturnValue(15),
        getParent: vi.fn().mockReturnValue(null), // Not embedded
        getChildren: vi.fn(),
        isNode: vi.fn(),
        getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'security-boundary' }),
      };

      // Act
      const result = service.calculateUnembeddedSecurityBoundaryZIndex(mockNode as unknown as Node);

      // Assert
      expect(result).toBe(1); // Always reset to default security boundary z-index
    });

    it('should return default security boundary z-index for node that was previously embedded', () => {
      // Arrange
      const mockNode: MockNode = {
        id: 'security-boundary-1',
        getZIndex: vi.fn().mockReturnValue(12),
        getParent: vi.fn().mockReturnValue(null), // No longer embedded
        getChildren: vi.fn(),
        isNode: vi.fn(),
        getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'security-boundary' }),
      };

      // Act
      const result = service.calculateUnembeddedSecurityBoundaryZIndex(mockNode as unknown as Node);

      // Assert
      expect(result).toBe(1); // Reset to default security boundary z-index
    });
  });
});
