import { Graph, Node } from '@antv/x6';
import { NodeType } from '../domain/value-objects/node-data';

// Type alias for backward compatibility - extends NodeType to include legacy values
type ShapeType = NodeType | 'securityBoundary';

/**
 * Utility functions for DFD components
 */

/**
 * Get shape type from node instance
 * @param node The node to check
 * @returns The shape type or undefined if not recognized
 */
export function getShapeType(node: Node): ShapeType | undefined {
  try {
    // First try to get the shape type from the data-shape-type attribute
    const shapeType = node.attr('data-shape-type');
    if (shapeType) {
      return shapeType as ShapeType;
    }

    // Fallback to checking constructor name
    const constructorName = node.constructor.name;
    switch (constructorName) {
      case 'ActorShape':
        return 'actor';
      case 'ProcessShape':
        return 'process';
      case 'StoreShape':
        return 'store';
      case 'SecurityBoundaryShape':
        return 'securityBoundary';
      case 'TextboxShape':
        return 'text-box';
      default:
        return undefined;
    }
  } catch {
    // Error is intentionally ignored
    return undefined;
  }
}

/**
 * Efficiently update z-indices for all nodes in the graph
 * @param graph The graph instance
 */
export function updateZIndices(graph: Graph): void {
  if (!graph) return;

  // Get all nodes
  const nodes = graph.getNodes();

  // First pass: security boundaries to z-index -1
  nodes.forEach(node => {
    // Check if this is a security boundary by type
    const shapeType = getShapeType(node);
    if (shapeType === 'securityBoundary' || shapeType === 'security-boundary') {
      node.setZIndex(-1);
    }
  });

  // Second pass: build hierarchy
  const hierarchy = new Map<string, Node[]>();
  const rootNodes: Node[] = [];

  nodes
    .filter(node => getShapeType(node) !== 'securityBoundary')
    .forEach(node => {
      const parent = node.getParent();
      if (parent) {
        const parentId = parent.id;
        if (!hierarchy.has(parentId)) {
          hierarchy.set(parentId, []);
        }
        hierarchy.get(parentId)?.push(node);
      } else {
        rootNodes.push(node);
      }
    });

  // Third pass: set z-indices
  // Root nodes at z-index 0
  rootNodes.forEach(node => {
    node.setZIndex(0);
  });

  // Process hierarchy
  const processChildren = (parentNode: Node, startZ: number): number => {
    let nextZ = startZ;
    const children = hierarchy.get(parentNode.id) || [];

    children.forEach(child => {
      child.setZIndex(nextZ);
      nextZ++;

      // Process this child's children
      nextZ = processChildren(child, nextZ);
    });

    return nextZ;
  };

  rootNodes.forEach(node => {
    processChildren(node, 1);
  });
}
