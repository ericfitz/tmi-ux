import { Injectable } from '@angular/core';
import { Graph } from '@antv/x6';

/**
 * GraphHistoryCoordinator service - manages what gets included in X6 history
 * Provides proper filtering for visual effects, port visibility, and other non-semantic changes
 */
@Injectable()
export class GraphHistoryCoordinator {
  
  /**
   * Execute an atomic operation by batching all changes into a single history entry
   */
  executeAtomicOperation<T>(graph: Graph, operation: () => T): T {
    return graph.batchUpdate(() => {
      return operation();
    });
  }

  /**
   * Execute a compound operation by batching all changes into a single history entry
   */
  executeCompoundOperation<T>(graph: Graph, operation: () => T): T {
    return graph.batchUpdate(() => {
      return operation();
    });
  }

  /**
   * Execute a visual effect with history suppressed
   * Visual effects should never appear in undo/redo history
   */
  executeVisualEffect(graph: Graph, operation: () => void): void {
    const historyPlugin = (graph as any).history;
    if (historyPlugin && typeof historyPlugin.disable === 'function' && typeof historyPlugin.enable === 'function') {
      // Temporarily disable history for visual effects
      historyPlugin.disable();
      try {
        operation();
      } finally {
        // Re-enable history after the operation
        historyPlugin.enable();
      }
    } else {
      // No history plugin or already disabled, execute directly
      operation();
    }
  }

  /**
   * Get default options for operation - visual effects should be excluded
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
   * Check if an attribute path should be excluded from history
   * Returns true for visual-only attributes that shouldn't trigger undo/redo
   */
  shouldExcludeAttribute(attributePath?: string, propertyPath?: string): boolean {
    if (!attributePath && !propertyPath) {
      return false;
    }

    // Check full property path first (for port changes)
    if (propertyPath) {
      // Port visibility changes should be excluded
      if (this._isPortVisibilityPath(propertyPath)) {
        return true;
      }
    }

    // Check attribute path (for style/visual changes) 
    if (attributePath) {
      return this._isVisualAttributePath(attributePath);
    }

    return false;
  }

  /**
   * Check if a property path represents a port visibility change
   */
  private _isPortVisibilityPath(propertyPath: string): boolean {
    // Port visibility paths look like: "ports/items/0/attrs/circle/style/visibility"
    return propertyPath.includes('ports/items/') && 
           propertyPath.includes('/attrs/circle/style/visibility');
  }

  /**
   * Check if an attribute path represents a visual-only change
   */
  private _isVisualAttributePath(attributePath: string): boolean {
    const visualPaths = [
      // Selection and hover effects
      'body/filter',
      'label/filter', 
      'text/filter',
      
      // Stroke effects for selection/hover
      'body/stroke',
      'body/strokeWidth',
      'body/strokeDasharray',
      
      // Shadow and glow effects
      'body/dropShadow',
      'body/shadowOffsetX',
      'body/shadowOffsetY',
      'body/shadowBlur',
      'body/shadowColor',
      
      // Port highlighting  
      'circle/stroke',
      'circle/strokeWidth',
      'circle/fill',
      'circle/filter',
      
      // Tool-related attributes
      'tools',
      
      // Z-index changes (handled separately but included here for completeness)
      'zIndex'
    ];

    // Check if the attribute path starts with any visual path
    return visualPaths.some(visualPath => 
      attributePath.startsWith(visualPath) || 
      attributePath.includes(`/${visualPath}`) ||
      attributePath.endsWith(`/${visualPath}`)
    );
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