// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Graph, Node } from '@antv/x6';
import { SelectionService } from './selection.service';
import { LoggerService } from '../../../../core/services/logger.service';

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

describe('SelectionService', () => {
  let service: SelectionService;
  let mockLogger: LoggerService;
  let graph: Graph;
  let container: HTMLElement;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as any;

    // Create service instance
    service = new SelectionService(mockLogger);

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

  describe('Copy and Paste Operations', () => {
    it('should copy selected cells', () => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        label: 'Node 1',
      });

      const node2 = graph.addNode({
        shape: 'ellipse',
        x: 300,
        y: 200,
        width: 80,
        height: 80,
        label: 'Node 2',
      });

      const selectedCells = [node1, node2];
      const copiedCells = service.copySelectedCells(selectedCells);

      expect(copiedCells).toHaveLength(2);
      expect(copiedCells[0]).not.toBe(node1); // Should be cloned
      expect(copiedCells[1]).not.toBe(node2); // Should be cloned
      expect(mockLogger.info).toHaveBeenCalledWith('Copied selected cells', { count: 2 });
    });

    it('should return empty array when no cells selected for copying', () => {
      const copiedCells = service.copySelectedCells([]);

      expect(copiedCells).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('No cells selected for copying');
    });

    it('should calculate paste positions with default offset', () => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const node2 = graph.addNode({
        shape: 'ellipse',
        x: 300,
        y: 200,
        width: 80,
        height: 80,
      });

      const cells = [node1, node2];
      const pastePositions = service.calculatePastePositions(cells);

      expect(pastePositions).toHaveLength(2);
      expect(pastePositions[0].position).toEqual({ x: 120, y: 120 }); // +20, +20
      expect(pastePositions[1].position).toEqual({ x: 320, y: 220 }); // +20, +20
      expect(pastePositions[0].cell).not.toBe(node1); // Should be cloned
      expect(pastePositions[1].cell).not.toBe(node2); // Should be cloned
    });

    it('should calculate paste positions with custom offset', () => {
      const node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const pastePositions = service.calculatePastePositions([node], 50, 30);

      expect(pastePositions).toHaveLength(1);
      expect(pastePositions[0].position).toEqual({ x: 150, y: 130 }); // +50, +30
    });

    it('should handle non-node cells in paste position calculation', () => {
      const node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const edge = graph.addEdge({
        source: { x: 100, y: 100 },
        target: { x: 200, y: 200 },
      });

      const pastePositions = service.calculatePastePositions([node, edge]);

      expect(pastePositions).toHaveLength(2);
      expect(pastePositions[0].position).toEqual({ x: 120, y: 120 }); // Node position
      expect(pastePositions[1].position).toEqual({ x: 0, y: 0 }); // Edge default position
    });
  });

  describe('Bounding Box Calculations', () => {
    it('should calculate bounding box for multiple nodes', () => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 200,
        width: 80,
        height: 60,
      });

      const node3 = graph.addNode({
        shape: 'rect',
        x: 150,
        y: 50,
        width: 60,
        height: 40,
      });

      const boundingBox = service.calculateGroupBoundingBox([node1, node2, node3]);

      // Expected: minX=100, minY=50, maxX=380, maxY=260
      // With 10px padding: x=90, y=40, width=300, height=230
      expect(boundingBox).toEqual({
        x: 90,
        y: 40,
        width: 300,
        height: 230,
      });
    });

    it('should calculate bounding box for single node', () => {
      const node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const boundingBox = service.calculateGroupBoundingBox([node]);

      expect(boundingBox).toEqual({
        x: 90, // 100 - 10
        y: 90, // 100 - 10
        width: 120, // 100 + 20
        height: 70, // 50 + 20
      });
    });

    it('should throw error for empty node list', () => {
      expect(() => {
        service.calculateGroupBoundingBox([]);
      }).toThrow('Cannot calculate bounding box for empty node list');
    });
  });

  describe('Alignment Calculations', () => {
    let nodes: Node[];

    beforeEach(() => {
      nodes = [
        graph.addNode({
          shape: 'rect',
          x: 100,
          y: 100,
          width: 100,
          height: 50,
        }),
        graph.addNode({
          shape: 'rect',
          x: 300,
          y: 150,
          width: 80,
          height: 60,
        }),
        graph.addNode({
          shape: 'rect',
          x: 200,
          y: 80,
          width: 120,
          height: 40,
        }),
      ];
    });

    it('should calculate left alignment positions', () => {
      const positions = service.calculateAlignmentPositions(nodes, 'left');

      expect(positions).toHaveLength(3);
      // All nodes should align to x=100 (leftmost)
      expect(positions[0].position).toEqual({ x: 100, y: 100 });
      expect(positions[1].position).toEqual({ x: 100, y: 150 });
      expect(positions[2].position).toEqual({ x: 100, y: 80 });
      expect(mockLogger.info).toHaveBeenCalledWith('Calculated alignment positions', {
        alignment: 'left',
        count: 3,
      });
    });

    it('should calculate right alignment positions', () => {
      const positions = service.calculateAlignmentPositions(nodes, 'right');

      expect(positions).toHaveLength(3);
      // All nodes should align to rightmost edge (x=380 for 300+80)
      expect(positions[0].position).toEqual({ x: 280, y: 100 }); // 380-100
      expect(positions[1].position).toEqual({ x: 300, y: 150 }); // 380-80
      expect(positions[2].position).toEqual({ x: 260, y: 80 }); // 380-120
    });

    it('should calculate center alignment positions', () => {
      const positions = service.calculateAlignmentPositions(nodes, 'center');

      expect(positions).toHaveLength(3);
      // Center should be average of all center points
      // Node1 center: 150, Node2 center: 340, Node3 center: 260
      // Average: (150+340+260)/3 = 250
      expect(positions[0].position).toEqual({ x: 200, y: 100 }); // 250-50
      expect(positions[1].position).toEqual({ x: 210, y: 150 }); // 250-40
      expect(positions[2].position).toEqual({ x: 190, y: 80 }); // 250-60
    });

    it('should calculate top alignment positions', () => {
      const positions = service.calculateAlignmentPositions(nodes, 'top');

      expect(positions).toHaveLength(3);
      // All nodes should align to y=80 (topmost)
      expect(positions[0].position).toEqual({ x: 100, y: 80 });
      expect(positions[1].position).toEqual({ x: 300, y: 80 });
      expect(positions[2].position).toEqual({ x: 200, y: 80 });
    });

    it('should calculate bottom alignment positions', () => {
      const positions = service.calculateAlignmentPositions(nodes, 'bottom');

      expect(positions).toHaveLength(3);
      // All nodes should align to bottommost edge (y=210 for 150+60)
      expect(positions[0].position).toEqual({ x: 100, y: 160 }); // 210-50
      expect(positions[1].position).toEqual({ x: 300, y: 150 }); // 210-60
      expect(positions[2].position).toEqual({ x: 200, y: 170 }); // 210-40
    });

    it('should calculate middle alignment positions', () => {
      const positions = service.calculateAlignmentPositions(nodes, 'middle');

      expect(positions).toHaveLength(3);
      // Middle should be average of all center points
      // Node1 center: 125, Node2 center: 180, Node3 center: 100
      // Average: (125+180+100)/3 = 135
      expect(positions[0].position).toEqual({ x: 100, y: 110 }); // 135-25
      expect(positions[1].position).toEqual({ x: 300, y: 105 }); // 135-30
      expect(positions[2].position).toEqual({ x: 200, y: 115 }); // 135-20
    });

    it('should return empty array for single node alignment', () => {
      const positions = service.calculateAlignmentPositions([nodes[0]], 'left');

      expect(positions).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Need at least 2 nodes to align');
    });

    it('should return empty array for empty node list', () => {
      const positions = service.calculateAlignmentPositions([], 'left');

      expect(positions).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Need at least 2 nodes to align');
    });
  });

  describe('Distribution Calculations', () => {
    let nodes: Node[];

    beforeEach(() => {
      nodes = [
        graph.addNode({
          shape: 'rect',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
        }),
        graph.addNode({
          shape: 'rect',
          x: 200,
          y: 150,
          width: 50,
          height: 50,
        }),
        graph.addNode({
          shape: 'rect',
          x: 400,
          y: 200,
          width: 50,
          height: 50,
        }),
        graph.addNode({
          shape: 'rect',
          x: 300,
          y: 120,
          width: 50,
          height: 50,
        }),
      ];
    });

    it('should calculate horizontal distribution positions', () => {
      const positions = service.calculateDistributionPositions(nodes, 'horizontal');

      expect(positions).toHaveLength(4);

      // Nodes should be sorted by x position: 100, 200, 300, 400
      // First and last stay in place, middle nodes distributed evenly
      // Total width: 450 - 100 = 350, spacing: 350/3 = 116.67

      // First node stays at x=100
      expect(positions.find(p => p.node === nodes[0])?.position).toEqual({ x: 100, y: 100 });

      // Last node stays at x=400
      expect(positions.find(p => p.node === nodes[2])?.position).toEqual({ x: 400, y: 200 });

      // Middle nodes distributed
      const sortedByX = [...nodes].sort((a, b) => a.getPosition().x - b.getPosition().x);
      const middlePositions = positions.filter(
        p => p.node !== sortedByX[0] && p.node !== sortedByX[sortedByX.length - 1],
      );

      expect(middlePositions).toHaveLength(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Calculated distribution positions', {
        direction: 'horizontal',
        count: 4,
      });
    });

    it('should calculate vertical distribution positions', () => {
      const positions = service.calculateDistributionPositions(nodes, 'vertical');

      expect(positions).toHaveLength(4);

      // Nodes should be sorted by y position: 100, 120, 150, 200
      // First and last stay in place, middle nodes distributed evenly

      // First node (topmost) stays in place
      const sortedByY = [...nodes].sort((a, b) => a.getPosition().y - b.getPosition().y);
      expect(positions.find(p => p.node === sortedByY[0])?.position.y).toBe(100);

      // Last node (bottommost) stays in place
      expect(positions.find(p => p.node === sortedByY[3])?.position.y).toBe(200);

      expect(mockLogger.info).toHaveBeenCalledWith('Calculated distribution positions', {
        direction: 'vertical',
        count: 4,
      });
    });

    it('should return empty array for less than 3 nodes', () => {
      const positions = service.calculateDistributionPositions([nodes[0], nodes[1]], 'horizontal');

      expect(positions).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Need at least 3 nodes to distribute');
    });

    it('should return empty array for empty node list', () => {
      const positions = service.calculateDistributionPositions([], 'horizontal');

      expect(positions).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Need at least 3 nodes to distribute');
    });
  });

  describe('Grouping Operations', () => {
    it('should validate that nodes can be grouped', () => {
      const node1 = graph.addNode({ shape: 'rect', x: 100, y: 100, width: 50, height: 50 });
      const node2 = graph.addNode({ shape: 'rect', x: 200, y: 200, width: 50, height: 50 });

      expect(service.canGroupNodes([node1, node2])).toBe(true);
      expect(service.canGroupNodes([node1])).toBe(false);
      expect(service.canGroupNodes([])).toBe(false);
    });

    it('should validate that node can be ungrouped', () => {
      const parentNode = graph.addNode({ shape: 'rect', x: 100, y: 100, width: 200, height: 200 });
      const childNode = graph.addNode({ shape: 'rect', x: 120, y: 120, width: 50, height: 50 });

      // Add child to parent
      parentNode.addChild(childNode);

      expect(service.canUngroupNode(parentNode)).toBe(true);

      const nodeWithoutChildren = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 300,
        width: 50,
        height: 50,
      });
      expect(service.canUngroupNode(nodeWithoutChildren)).toBe(false);
    });

    it('should get group configuration', () => {
      const boundingBox = { x: 90, y: 90, width: 220, height: 120 };
      const config = service.getGroupConfiguration(boundingBox);

      expect(config).toEqual({
        x: 90,
        y: 90,
        width: 220,
        height: 120,
        shape: 'rect',
        attrs: {
          body: {
            fill: 'transparent',
            stroke: '#666',
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
          label: {
            text: 'Group',
            fontSize: 12,
            fill: '#666',
            fontFamily: '"Roboto Condensed", Arial, sans-serif',
          },
        },
        zIndex: -1,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle nodes with zero dimensions in bounding box calculation', () => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 0,
        height: 0,
      });

      const node2 = graph.addNode({
        shape: 'rect',
        x: 200,
        y: 200,
        width: 50,
        height: 50,
      });

      const boundingBox = service.calculateGroupBoundingBox([node1, node2]);

      expect(boundingBox.x).toBe(90); // 100 - 10
      expect(boundingBox.y).toBe(90); // 100 - 10
      expect(boundingBox.width).toBe(170); // 250 - 100 + 20
      expect(boundingBox.height).toBe(170); // 250 - 100 + 20
    });

    it('should handle nodes at negative positions', () => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: -50,
        y: -30,
        width: 100,
        height: 60,
      });

      const node2 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });

      const boundingBox = service.calculateGroupBoundingBox([node1, node2]);

      expect(boundingBox.x).toBe(-60); // -50 - 10
      expect(boundingBox.y).toBe(-40); // -30 - 10
      expect(boundingBox.width).toBe(220); // 150 - (-50) + 20
      expect(boundingBox.height).toBe(200); // 150 - (-30) + 20
    });

    it('should handle alignment with nodes of different sizes', () => {
      const smallNode = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 20,
        height: 20,
      });

      const largeNode = graph.addNode({
        shape: 'rect',
        x: 200,
        y: 200,
        width: 200,
        height: 100,
      });

      const positions = service.calculateAlignmentPositions([smallNode, largeNode], 'center');

      expect(positions).toHaveLength(2);
      // Center calculation: (110 + 300) / 2 = 205
      expect(positions[0].position).toEqual({ x: 195, y: 100 }); // 205 - 10
      expect(positions[1].position).toEqual({ x: 105, y: 200 }); // 205 - 100
    });

    it('should handle distribution with nodes in random order', () => {
      const nodes = [
        graph.addNode({ shape: 'rect', x: 300, y: 100, width: 50, height: 50 }),
        graph.addNode({ shape: 'rect', x: 100, y: 100, width: 50, height: 50 }),
        graph.addNode({ shape: 'rect', x: 500, y: 100, width: 50, height: 50 }),
        graph.addNode({ shape: 'rect', x: 200, y: 100, width: 50, height: 50 }),
      ];

      const positions = service.calculateDistributionPositions(nodes, 'horizontal');

      expect(positions).toHaveLength(4);

      // Should sort by x position and distribute evenly
      const sortedPositions = positions.sort((a, b) => a.position.x - b.position.x);

      // First and last should stay in original positions
      expect(sortedPositions[0].position.x).toBe(100);
      expect(sortedPositions[3].position.x).toBe(500);
    });

    it('should handle copy operation with mixed cell types', () => {
      const node = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const edge = graph.addEdge({
        source: { x: 100, y: 100 },
        target: { x: 200, y: 200 },
      });

      const copiedCells = service.copySelectedCells([node, edge]);

      expect(copiedCells).toHaveLength(2);
      expect(copiedCells[0]).not.toBe(node);
      expect(copiedCells[1]).not.toBe(edge);
    });

    it('should handle grouping validation with null children', () => {
      const node = graph.addNode({ shape: 'rect', x: 100, y: 100, width: 50, height: 50 });

      // Mock getChildren to return null
      vi.spyOn(node, 'getChildren').mockReturnValue(null);

      expect(service.canUngroupNode(node)).toBe(false);
    });
  });
});
