import { Injectable } from '@angular/core';
import { Graph } from '@antv/x6';
import { History } from '@antv/x6-plugin-history';
import { LoggerService } from '../../../core/services/logger.service';
import { X6HistoryManager } from '../infrastructure/adapters/x6-history-manager';

/**
 * Configuration options for history operations
 */
export interface HistoryOperationOptions {
  /**
   * Include visual effects (highlights, animations) in history
   * @default false
   */
  includeVisualEffects?: boolean;

  /**
   * Include highlighting and selection effects in history
   * @default false
   */
  includeHighlighting?: boolean;

  /**
   * Include port visibility changes in history
   * @default false
   */
  includePortVisibility?: boolean;

  /**
   * Include tool state changes in history
   * @default false
   */
  includeToolChanges?: boolean;

  /**
   * Custom attribute patterns to exclude from history
   * @default []
   */
  customExclusions?: string[];

  /**
   * Custom regex patterns to exclude from history
   * @default []
   */
  customPatterns?: RegExp[];
}

/**
 * Standard operation types for consistent history management
 */
export const HISTORY_OPERATION_TYPES = {
  // Structural operations (always recorded)
  NODE_CREATION: 'node-creation',
  NODE_CREATION_USER: 'node-creation-user',
  NODE_CREATION_DOMAIN: 'node-creation-domain',
  EDGE_CREATION: 'edge-creation',
  EDGE_CREATION_USER: 'edge-creation-user',
  EDGE_CREATION_INVERSE: 'edge-creation-inverse',
  NODE_DELETION: 'node-deletion',
  EDGE_DELETION: 'edge-deletion',
  CELL_DELETION: 'cell-deletion',
  TOOL_DELETION: 'tool-deletion',
  NODE_POSITIONING: 'node-positioning',
  NODE_RESIZING: 'node-resizing',
  DIAGRAM_LOAD: 'diagram-load',

  // Grouping operations (structural)
  GROUP_CREATION: 'group-creation',
  GROUP_EXPANSION: 'group-expansion',
  GROUP_UNGROUPING: 'group-ungrouping',

  // Visual operations (excluded by default)
  HIGHLIGHTING: 'highlighting',
  SELECTION_EFFECTS: 'selection-effects',
  HOVER_EFFECTS: 'hover-effects',
  CREATION_ANIMATIONS: 'creation-animations',
  PORT_VISIBILITY: 'port-visibility',
  TOOL_UPDATES: 'tool-updates',
} as const;

export type HistoryOperationType =
  (typeof HISTORY_OPERATION_TYPES)[keyof typeof HISTORY_OPERATION_TYPES];

/**
 * Centralized service for coordinating history management across all graph operations.
 * Ensures consistent filtering and atomic batching for node/edge creation and modification.
 */
@Injectable()
export class GraphHistoryCoordinator {
  private readonly historyFilters = {
    // Visual effects exclusions
    visualEffects: [
      'tools',
      'items',
      'name',
      'body/filter',
      'line/filter',
      'text/filter',
      'body/strokeWidth',
      'line/strokeWidth',
      'line/stroke',
    ],

    // Highlighting and selection effects
    highlighting: [
      'body/stroke',
      'body/strokeWidth',
      'line/stroke',
      'line/strokeWidth',
      'attrs/body/stroke',
      'attrs/body/strokeWidth',
      'attrs/line/stroke',
      'attrs/line/strokeWidth',
      'stroke',
      'strokeWidth',
    ],

    // Tool state changes
    toolChanges: ['tools', 'items', 'name', 'attrs/tools', 'attrs/items'],

    // Port visibility patterns (regex)
    portVisibilityPatterns: [
      // Match port visibility changes in groups structure: ports/groups/*/attrs/circle/style/visibility
      /^ports\/groups\/.*\/attrs\/circle\/style\/visibility$/,
      /^ports\/groups\/.*\/attrs\/.*\/style\/visibility$/,

      // Match port visibility in items structure: ports/items/*/attrs/circle/style/visibility
      /^ports\/items\/.*\/attrs\/circle\/style\/visibility$/,
      /^ports\/items\/.*\/attrs\/.*\/style\/visibility$/,

      // Match any port attribute changes (broader catch-all)
      /^ports\/.*\/attrs\/.*$/,

      // Legacy patterns for other port structures
      /^attrs\/circle\/style\/visibility$/,
      /^attrs\/ports\/.*$/,

      // Dot notation versions (in case X6 reports with dots)
      /^ports\.groups\..*\.attrs\.circle\.style\.visibility$/,
      /^ports\.groups\..*\.attrs\..*\.style\.visibility$/,
      /^ports\.items\..*\.attrs\.circle\.style\.visibility$/,
      /^ports\.items\..*\.attrs\..*\.style\.visibility$/,
    ],
  };

  constructor(
    private x6HistoryManager: X6HistoryManager,
    private loggerService: LoggerService,
  ) {}

  /**
   * Execute a batched operation with consistent history filtering.
   * All structural changes are grouped into a single atomic batch.
   *
   * @param graph The X6 Graph instance
   * @param operationType Standard operation type for logging and debugging
   * @param operation The operation to execute within the batch
   * @param options Configuration for history filtering
   * @returns The result of the operation
   */
  executeAtomicOperation<T>(
    graph: Graph,
    operationType: HistoryOperationType,
    operation: () => T,
    options: HistoryOperationOptions = {},
  ): T {
    this.loggerService.debugComponent('GraphHistoryCoordinator', `Starting atomic operation: ${operationType}`, {
      options,
      timestamp: new Date().toISOString(),
    });

    try {
      // Configure filters for this operation
      this.applyOperationFilters(graph, options);

      // Execute in atomic batch to ensure single undo/redo entry
      const result = graph.batchUpdate(`${operationType}-batch`, () => {
        this.loggerService.debugComponent('GraphHistoryCoordinator', `Executing batched operation: ${operationType}`);
        return operation();
      });

      this.loggerService.debugComponent('GraphHistoryCoordinator', `Completed atomic operation: ${operationType}`, {
        success: true,
      });

      return result;
    } catch (error) {
      this.loggerService.error(`Failed atomic operation: ${operationType}`, {
        error: error instanceof Error ? error.message : String(error),
        options,
      });
      throw error;
    }
  }

  /**
   * Execute visual effects outside of history tracking.
   * These operations are completely excluded from undo/redo.
   *
   * @param graph The X6 Graph instance
   * @param effectName Name of the visual effect for logging
   * @param effect The visual effect operation to execute
   */
  executeVisualEffect(graph: Graph, effectName: string, effect: () => void): void {
    // this.loggerService.debug(`Executing visual effect: ${effectName}`);

    // Disable history for visual effects
    this.x6HistoryManager.disable(graph);

    try {
      effect();
      // this.loggerService.debug(`Completed visual effect: ${effectName}`);
    } catch (error) {
      this.loggerService.error(`Failed visual effect: ${effectName}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      // Re-enable history
      this.x6HistoryManager.enable(graph);
    }
  }

  /**
   * Execute a compound operation that includes both structural changes and visual effects.
   * Structural changes are batched and recorded in history, visual effects are excluded.
   *
   * @param graph The X6 Graph instance
   * @param operationType Standard operation type
   * @param structuralOperation Structural changes (recorded in history)
   * @param visualEffect Visual effects (excluded from history)
   * @param options Configuration for history filtering
   * @returns The result of the structural operation
   */
  executeCompoundOperation<T>(
    graph: Graph,
    operationType: HistoryOperationType,
    structuralOperation: () => T,
    visualEffect?: () => void,
    options: HistoryOperationOptions = {},
  ): T {
    // Execute structural changes in history
    const result = this.executeAtomicOperation(graph, operationType, structuralOperation, options);

    // Execute visual effects outside history
    if (visualEffect) {
      this.executeVisualEffect(graph, `${operationType}-visual-effects`, visualEffect);
    }

    return result;
  }

  /**
   * Check if a specific attribute should be excluded from history based on current filters.
   * This can be used for custom validation logic.
   *
   * @param attributePath The attribute path to check (e.g., 'body/stroke')
   * @param options Current operation options (defaults to exclude visual effects)
   * @returns true if the attribute should be excluded from history
   */
  shouldExcludeAttribute(
    attributePath: string,
    options: HistoryOperationOptions = {
      includeVisualEffects: false,
      includeHighlighting: false,
      includePortVisibility: false,
      includeToolChanges: false,
    },
  ): boolean {
    const {
      includeVisualEffects = false,
      includeHighlighting = false,
      includePortVisibility = false,
      includeToolChanges = false,
      customExclusions = [],
      customPatterns = [],
    } = options;

    // Check custom exclusions first
    if (customExclusions.includes(attributePath)) {
      return true;
    }

    // Check custom patterns
    if (customPatterns.some(pattern => pattern.test(attributePath))) {
      return true;
    }

    // Check visual effects
    if (!includeVisualEffects && this.historyFilters.visualEffects.includes(attributePath)) {
      return true;
    }

    // Check highlighting
    if (!includeHighlighting && this.historyFilters.highlighting.includes(attributePath)) {
      return true;
    }

    // Check tool changes
    if (!includeToolChanges && this.historyFilters.toolChanges.includes(attributePath)) {
      return true;
    }

    // Check port visibility patterns
    if (!includePortVisibility) {
      const isPortVisibility = this.historyFilters.portVisibilityPatterns.some(pattern =>
        pattern.test(attributePath),
      );

      // Debug logging for port visibility filtering
      if (attributePath.includes('port') || attributePath.includes('visibility')) {
        this.loggerService.debug(
          `Port visibility check: "${attributePath}" -> excluded: ${isPortVisibility}`,
        );
      }

      return isPortVisibility;
    }

    return false;
  }

  /**
   * Get default options for specific operation types.
   * This ensures consistent behavior for common operations.
   *
   * @param operationType The type of operation
   * @returns Default options for the operation type
   */
  getDefaultOptionsForOperation(operationType: HistoryOperationType): HistoryOperationOptions {
    switch (operationType) {
      case HISTORY_OPERATION_TYPES.NODE_CREATION:
      case HISTORY_OPERATION_TYPES.NODE_CREATION_USER:
      case HISTORY_OPERATION_TYPES.NODE_CREATION_DOMAIN:
      case HISTORY_OPERATION_TYPES.EDGE_CREATION:
      case HISTORY_OPERATION_TYPES.EDGE_CREATION_USER:
      case HISTORY_OPERATION_TYPES.EDGE_CREATION_INVERSE:
      case HISTORY_OPERATION_TYPES.NODE_DELETION:
      case HISTORY_OPERATION_TYPES.EDGE_DELETION:
      case HISTORY_OPERATION_TYPES.CELL_DELETION:
      case HISTORY_OPERATION_TYPES.TOOL_DELETION:
        return {
          includeVisualEffects: false,
          includeHighlighting: false,
          includePortVisibility: false,
          includeToolChanges: false,
        };

      case HISTORY_OPERATION_TYPES.GROUP_CREATION:
      case HISTORY_OPERATION_TYPES.GROUP_EXPANSION:
      case HISTORY_OPERATION_TYPES.GROUP_UNGROUPING:
        return {
          includeVisualEffects: false,
          includeHighlighting: false,
          includePortVisibility: false,
          includeToolChanges: false,
        };

      case HISTORY_OPERATION_TYPES.HIGHLIGHTING:
      case HISTORY_OPERATION_TYPES.SELECTION_EFFECTS:
      case HISTORY_OPERATION_TYPES.HOVER_EFFECTS:
      case HISTORY_OPERATION_TYPES.CREATION_ANIMATIONS:
      case HISTORY_OPERATION_TYPES.PORT_VISIBILITY:
      case HISTORY_OPERATION_TYPES.TOOL_UPDATES:
        // These should typically use executeVisualEffect instead
        return {
          includeVisualEffects: true,
          includeHighlighting: true,
          includePortVisibility: true,
          includeToolChanges: true,
        };

      default:
        // Conservative defaults - exclude visual effects
        return {
          includeVisualEffects: false,
          includeHighlighting: false,
          includePortVisibility: false,
          includeToolChanges: false,
        };
    }
  }

  /**
   * Apply operation-specific filters to the graph's history plugin.
   * This is called internally by executeAtomicOperation.
   */
  private applyOperationFilters(graph: Graph, options: HistoryOperationOptions): void {
    const history = graph.getPlugin('history') as History;
    if (!history) {
      this.loggerService.warn('History plugin not found on graph - filters cannot be applied');
      return;
    }

    // The actual filter application will be handled by the History plugin's
    // beforeAddCommand callback, which can access these options through
    // a mechanism we'll implement in the next phase

    this.loggerService.debug('Applied operation filters', {
      includeVisualEffects: options.includeVisualEffects,
      includeHighlighting: options.includeHighlighting,
      includePortVisibility: options.includePortVisibility,
      includeToolChanges: options.includeToolChanges,
      customExclusions: options.customExclusions?.length || 0,
      customPatterns: options.customPatterns?.length || 0,
    });
  }
}
