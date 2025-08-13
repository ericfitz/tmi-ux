import { Injectable } from '@angular/core';
import { Graph } from '@antv/x6';

/**
 * Stub implementation of GraphHistoryCoordinator service
 * TODO: Implement proper history coordination if needed
 */
@Injectable()
export class GraphHistoryCoordinator {
  
  /**
   * Execute an atomic operation (stub implementation)
   */
  executeAtomicOperation(graph: Graph, operation: () => any): any {
    // Simply execute the operation without history coordination
    return operation();
  }

  /**
   * Execute a compound operation (stub implementation)  
   */
  executeCompoundOperation(graph: Graph, operation: () => any): any {
    // Simply execute the operation without history coordination
    return operation();
  }

  /**
   * Execute a visual effect (stub implementation)
   */
  executeVisualEffect(graph: Graph, operation: () => void): void {
    // Simply execute the operation without history coordination
    operation();
  }

  /**
   * Get default options for operation (stub implementation)
   */
  getDefaultOptionsForOperation(): any {
    return {
      includeVisualEffects: false,
      includePortVisibility: false,
      includeHighlighting: false,
      includeToolChanges: false,
    };
  }

  /**
   * Check if attribute should be excluded (stub implementation)
   */
  shouldExcludeAttribute(): boolean {
    return false;
  }
}

/**
 * History operation types (stub implementation)
 */
export const HISTORY_OPERATION_TYPES = {
  DIAGRAM_LOAD: 'diagram-load',
  NODE_CREATE: 'node-create',
  NODE_CREATION_DOMAIN: 'node-creation-domain',
  NODE_CREATION_USER: 'node-creation-user',
  NODE_DELETE: 'node-delete',
  NODE_MOVE: 'node-move',
  NODE_RESIZE: 'node-resize',
  EDGE_CREATE: 'edge-create',
  EDGE_CREATION: 'edge-creation',
  EDGE_DELETE: 'edge-delete',
  CELL_DELETION: 'cell-deletion',
  TOOL_DELETION: 'tool-deletion',
  GROUP_CREATION: 'group-creation',
};