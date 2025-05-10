import { Edge, Graph, Node } from '@antv/x6';
import { ActorShape } from '../models/actor-shape.model';
import { ProcessShape } from '../models/process-shape.model';
import { StoreShape } from '../models/store-shape.model';
import { SecurityBoundaryShape } from '../models/security-boundary-shape.model';
import { TextboxShape } from '../models/textbox-shape.model';
import { ShapeType } from '../services/dfd-node.service';

/**
 * Utility functions for DFD components
 */

/**
 * Generate a unique ID string
 * @returns A unique string ID
 */
export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if a node is one of the DFD shape types
 * @param node Node to check
 * @returns Boolean indicating if this is a DFD shape
 */
export function isDfdNode(node: Node): boolean {
  return (
    node instanceof ActorShape ||
    node instanceof ProcessShape ||
    node instanceof StoreShape ||
    node instanceof SecurityBoundaryShape ||
    node instanceof TextboxShape
  );
}

/**
 * Get shape type from node instance
 * @param node The node to check
 * @returns The shape type or undefined if not recognized
 */
export function getShapeType(node: Node): ShapeType | undefined {
  if (node instanceof ActorShape) return 'actor';
  if (node instanceof ProcessShape) return 'process';
  if (node instanceof StoreShape) return 'store';
  if (node instanceof SecurityBoundaryShape) return 'securityBoundary';
  if (node instanceof TextboxShape) return 'textbox';
  return undefined;
}

/**
 * Converts a data URI to a Blob
 * @param dataUri The data URI string
 * @param mimeType The MIME type of the resulting blob
 * @returns A Blob representing the data
 */
export function dataUriToBlob(dataUri: string, mimeType: string): Blob {
  const byteString = atob(dataUri.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeType });
}

/**
 * Saves a blob to a file
 * @param blob The blob to save
 * @param filename The filename to use
 */
export function saveBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Generate a timestamp string suitable for filenames
 * @returns A timestamp string
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Get all descendants of a node
 * @param graph The graph
 * @param node The parent node
 * @returns Array of descendant nodes
 */
export function getDescendants(graph: Graph, node: Node): Node[] {
  // Get all children of this node
  const children = graph.getNodes().filter(childNode => {
    return childNode.getParent()?.id === node.id;
  });

  let descendants = [...children];

  children.forEach(child => {
    descendants = [...descendants, ...getDescendants(graph, child)];
  });

  return descendants;
}

/**
 * Find all edges connected to a node
 * @param graph The graph
 * @param node The node
 * @param options Options for filtering edges
 * @returns Connected edges
 */
export function getConnectedEdges(
  graph: Graph,
  node: Node,
  options?: { incoming?: boolean; outgoing?: boolean },
): Edge[] {
  const defaultOptions = { incoming: true, outgoing: true };
  const mergedOptions = { ...defaultOptions, ...options };

  const edges: Edge[] = [];

  if (mergedOptions.incoming) {
    edges.push(...(graph.getIncomingEdges(node) || []));
  }

  if (mergedOptions.outgoing) {
    edges.push(...(graph.getOutgoingEdges(node) || []));
  }

  return edges;
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
    if (node instanceof SecurityBoundaryShape) {
      node.setZIndex(-1);
    }
  });

  // Second pass: build hierarchy
  const hierarchy = new Map<string, Node[]>();
  const rootNodes: Node[] = [];

  nodes
    .filter(node => !(node instanceof SecurityBoundaryShape))
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
