import { Injectable } from '@angular/core';
import { Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { DFD_STYLING, DFD_STYLING_HELPERS } from '../../constants/styling-constants';

/**
 * Interface for tracking active visual effects
 */
interface ActiveEffect {
  timer: any;
  cell: Cell;
  effectType: 'fade';
  startTime: number;
  color: { r: number; g: number; b: number };
}

/**
 * Visual Effects Service
 * Manages creation highlights with fade-out animations for programmatically created nodes and edges
 * Uses the same styling techniques as hover/selection effects but with customizable coloring
 */
@Injectable()
export class InfraVisualEffectsService {
  private readonly FADE_DURATION_MS = DFD_STYLING.CREATION.FADE_DURATION_MS;
  private readonly ANIMATION_FRAME_INTERVAL = DFD_STYLING.CREATION.ANIMATION_FRAME_INTERVAL;

  // Track active effects to prevent conflicts and memory leaks
  private activeEffects = new Map<string, ActiveEffect>();

  constructor(private logger: LoggerService) {}

  /**
   * Apply creation highlight with fade-out effect to a newly created cell
   * Starts bright and fades out over 1 second
   * @param cell - The cell to apply the effect to
   * @param graph - The graph instance for batching operations (optional, but recommended)
   * @param color - Optional RGB color object, defaults to light blue (0, 150, 255)
   * @param options - Optional configuration for the effect
   */
  applyCreationHighlight(
    cell: Cell,
    graph?: any,
    color?: { r: number; g: number; b: number },
    _options?: { silent?: boolean; skipFade?: boolean },
  ): void {
    if (!cell) {
      this.logger.warn('[VisualEffects] Cannot apply creation highlight to null cell');
      return;
    }

    // Don't apply if cell already has an active effect or is selected
    if (this.activeEffects.has(cell.id) || this.isCellSelected(cell)) {
      this.logger.debugComponent(
        'DFD',
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        {
          cellId: cell.id,
        },
      );
      return;
    }

    // Default to light blue if no color provided
    const effectColor = color || { r: 0, g: 150, b: 255 };

    // this.logger.info('[VisualEffects] Applying creation highlight', {
    //   cellId: cell.id,
    //   cellType: cell.isNode() ? 'node' : 'edge',
    //   hasActiveEffect: this.activeEffects.has(cell.id),
    //   isSelected: this.isCellSelected(cell),
    //   color: effectColor,
    // });

    try {
      // Start simple fade-out animation from bright to transparent
      // (startFadeAnimation handles history disable/enable for the entire animation lifecycle)
      this.startFadeAnimation(cell, effectColor, graph);
    } catch (error) {
      this.logger.error('[VisualEffects] Error applying creation highlight', {
        cellId: cell.id,
        error,
      });
    }
  }

  /**
   * Remove any active visual effects from a cell
   */
  removeVisualEffects(cell: Cell, graph?: any): void {
    if (!cell) return;

    const activeEffect = this.activeEffects.get(cell.id);
    if (activeEffect) {
      // Disable history during visual effect removal
      const historyWasDisabled = this._disableHistoryIfAvailable(graph);
      try {
        // Clear animation timer
        if (activeEffect.timer) {
          clearInterval(activeEffect.timer);
        }

        // Remove visual effects
        this.removeAllEffectsFromCell(cell);

        // Clean up tracking
        this.activeEffects.delete(cell.id);

        this.logger.debugComponent('DfdVisualEffects', 'Removed visual effects', {
          cellId: cell.id,
        });
      } finally {
        // Re-enable history if we disabled it
        this._enableHistoryIfAvailable(graph, historyWasDisabled);
      }
    }
  }

  /**
   * Check if a cell currently has active visual effects
   */
  hasActiveEffects(cell: Cell): boolean {
    return this.activeEffects.has(cell.id);
  }

  /**
   * Clean up all active effects (useful for component destruction)
   */
  cleanup(): void {
    this.activeEffects.forEach((effect, cellId) => {
      if (effect.timer) {
        clearInterval(effect.timer);
      }
      this.logger.debugComponent('DfdVisualEffects', 'Cleaned up effect during service cleanup', {
        cellId,
      });
    });
    this.activeEffects.clear();
  }

  /**
   * Alias for cleanup() to match test expectations
   */
  clearAllActiveEffects(): void {
    this.cleanup();
  }

  /**
   * Apply invalid embedding visual feedback (red stroke)
   * Shows user that the current drop target is not valid
   */
  applyInvalidEmbeddingFeedback(cell: Cell, _graph?: any): void {
    if (!cell || this.activeEffects.has(cell.id)) {
      return;
    }

    // Store original stroke attributes
    const originalStroke = cell.attr('body/stroke') || '#333333';
    const originalStrokeWidth = cell.attr('body/strokeWidth') || 2;

    // Convert to string to avoid object serialization issues
    const strokeStr = typeof originalStroke === 'string' ? originalStroke : '#333333';
    const strokeWidthStr = String(Number(originalStrokeWidth));

    if ((cell as any).setApplicationMetadata) {
      (cell as any).setApplicationMetadata('_originalStroke', strokeStr);
      (cell as any).setApplicationMetadata('_originalStrokeWidth', strokeWidthStr);
    }

    // Apply red stroke to indicate invalid target
    cell.attr('body/stroke', '#ff0000'); // Red
    cell.attr('body/strokeWidth', 3);

    // Track the effect
    this.activeEffects.set(cell.id, {
      timer: null,
      cell,
      effectType: 'fade' as any, // Reuse type since TypeScript doesn't allow extending the union
      startTime: Date.now(),
      color: { r: 255, g: 0, b: 0 },
    });

    this.logger.debugComponent('DfdVisualEffects', 'Applied invalid embedding feedback', {
      cellId: cell.id,
    });
  }

  /**
   * Remove invalid embedding visual feedback
   * Restores original stroke attributes
   */
  removeInvalidEmbeddingFeedback(cell: Cell, _graph?: any): void {
    const activeEffect = this.activeEffects.get(cell.id);
    if (!activeEffect) {
      return;
    }

    // Restore original stroke
    let originalStroke = '#333333';
    let originalStrokeWidth = 2;

    if ((cell as any).getApplicationMetadata) {
      const storedStroke = (cell as any).getApplicationMetadata('_originalStroke');
      const storedWidth = (cell as any).getApplicationMetadata('_originalStrokeWidth');

      if (storedStroke) originalStroke = storedStroke;
      if (storedWidth) originalStrokeWidth = Number(storedWidth);
    }

    cell.attr('body/stroke', originalStroke);
    cell.attr('body/strokeWidth', originalStrokeWidth);

    // Clean up metadata and tracking
    if ((cell as any).setApplicationMetadata) {
      (cell as any).setApplicationMetadata('_originalStroke', null);
      (cell as any).setApplicationMetadata('_originalStrokeWidth', null);
    }
    this.activeEffects.delete(cell.id);

    this.logger.debugComponent('DfdVisualEffects', 'Removed invalid embedding feedback', {
      cellId: cell.id,
    });
  }

  /**
   * Start simple fade animation from bright to transparent over 1 second
   * Disables history for the entire animation lifecycle to prevent excessive history entries
   */
  private startFadeAnimation(
    cell: Cell,
    color: { r: number; g: number; b: number },
    graph?: any,
  ): void {
    const startTime = Date.now();

    // Disable history for the entire animation lifecycle
    const historyWasDisabled = this._disableHistoryIfAvailable(graph);

    // this.logger.debugComponent('DfdVisualEffects', 'Starting fade animation', {
    //   cellId: cell.id,
    //   color,
    //   startTime,
    //   historyWasSuccessfullyDisabled: historyWasDisabled,
    // });

    const activeEffect: ActiveEffect = {
      timer: null,
      cell,
      effectType: 'fade',
      startTime,
      color,
    };

    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const fadeProgress = elapsed / this.FADE_DURATION_MS;

      if (fadeProgress >= 1.0) {
        // Fade complete - remove all effects and re-enable history
        this.removeAllEffectsFromCell(cell);
        this.activeEffects.delete(cell.id);

        // Re-enable history now that animation is complete
        this._enableHistoryIfAvailable(graph, historyWasDisabled);

        // this.logger.debugComponent(
        //   'DfdVisualEffects',
        //   'Creation highlight fade complete, history re-enabled',
        //   {
        //     cellId: cell.id,
        //   },
        // );
        return;
      }

      // Calculate fade opacity (start bright at 0.9, fade to 0)
      const opacity = 0.9 * (1 - fadeProgress);

      // Apply fading effect - history is disabled so this won't create entries
      this.applyFadeEffectDirect(cell, opacity, color);

      // Schedule next frame
      activeEffect.timer = setTimeout(fadeStep, this.ANIMATION_FRAME_INTERVAL);
    };

    // Apply initial bright effect immediately (no delay)
    // this.logger.debugComponent('DfdVisualEffects', 'Applying initial bright effect', {
    //   cellId: cell.id,
    //   opacity: 0.9,
    //   color,
    // });
    this.applyFadeEffectDirect(cell, 0.9, color);

    // Start the animation
    activeEffect.timer = setTimeout(fadeStep, this.ANIMATION_FRAME_INTERVAL);
    this.activeEffects.set(cell.id, activeEffect);
  }

  /**
   * Apply fade effect directly without any batching or history considerations
   * Used during animations when history is already disabled for the entire animation lifecycle
   */
  private applyFadeEffectDirect(
    cell: Cell,
    opacity: number,
    color: { r: number; g: number; b: number },
  ): void {
    if (cell.isNode()) {
      // Use getNodeTypeInfo for reliable node type detection
      const nodeTypeInfo = (cell as any).getNodeTypeInfo();
      const nodeType = nodeTypeInfo?.type || 'unknown';

      // Log critical information for debugging
      // this.logger.info('[VisualEffects] Applying creation effect', {
      //   cellId: cell.id,
      //   nodeType,
      //   opacity,
      //   willApplyFilter: !DFD_STYLING_HELPERS.shouldUseNoneFilter(opacity),
      // });

      if (nodeType === 'text-box') {
        if (DFD_STYLING_HELPERS.shouldUseNoneFilter(opacity)) {
          // Remove both filter and fill effects
          cell.attr('text/filter', 'none');
          cell.attr('body/fill', 'transparent'); // Restore default transparent fill
        } else {
          // IMPORTANT: Apply fill FIRST, then drop shadow, so shadow is visible against the background
          const fillColorString = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.3})`; // Lower opacity for fill
          cell.attr('body/fill', fillColorString);

          const filterValue = DFD_STYLING_HELPERS.getCreationFilterWithColor(color, opacity);
          cell.attr('text/filter', filterValue);

          // this.logger.info('[VisualEffects] Applied body fill then text filter to text-box', {
          //   fillColor: fillColorString,
          //   filterValue,
          // });
        }
      } else {
        if (DFD_STYLING_HELPERS.shouldUseNoneFilter(opacity)) {
          cell.attr('body/filter', 'none');
        } else {
          const filterValue = DFD_STYLING_HELPERS.getCreationFilterWithColor(color, opacity);
          cell.attr('body/filter', filterValue);
          // this.logger.info('[VisualEffects] Applied body filter to node type', {
          //   nodeType,
          //   filterValue,
          // });
        }
      }
    } else if (cell.isEdge()) {
      if (DFD_STYLING_HELPERS.shouldUseNoneFilter(opacity)) {
        cell.attr('line/filter', 'none');
      } else {
        const filterValue = DFD_STYLING_HELPERS.getCreationFilterWithColor(color, opacity);
        cell.attr('line/filter', filterValue);
      }
    }
  }

  /**
   * Remove all visual effects from a cell
   */
  private removeAllEffectsFromCell(cell: Cell): void {
    // this.logger.debugComponent('DfdVisualEffects', 'Removing all effects from cell', {
    //   cellId: cell.id,
    // });

    if (cell.isNode()) {
      // Use getNodeTypeInfo for reliable node type detection
      const nodeTypeInfo = (cell as any).getNodeTypeInfo();
      const nodeType = nodeTypeInfo?.type || 'unknown';

      if (nodeType === 'text-box') {
        cell.attr('text/filter', 'none');
        cell.attr('body/fill', 'transparent'); // Restore default transparent fill
      } else {
        cell.attr('body/filter', 'none');
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', 'none');
    }
  }

  /**
   * Check if a cell is currently selected (to avoid conflicts)
   */
  isCellSelected(cell: Cell): boolean {
    // Check if cell has selection filter attributes that would indicate it's selected
    // Only rely on filter attributes, not stroke width (which can match default stroke width)
    try {
      if (cell.isNode()) {
        // Use getNodeTypeInfo for reliable node type detection
        const nodeTypeInfo = (cell as any).getNodeTypeInfo();
        const nodeType = nodeTypeInfo?.type || 'unknown';

        if (nodeType === 'text-box') {
          const filter = cell.attr('text/filter');
          return DFD_STYLING_HELPERS.isSelectionFilter(filter as string);
        } else {
          const filter = cell.attr('body/filter');
          // Only check filter, not stroke width (stroke width can match default values)
          return DFD_STYLING_HELPERS.isSelectionFilter(filter as string);
        }
      } else if (cell.isEdge()) {
        const filter = cell.attr('line/filter');
        // Only check filter, not stroke width (stroke width can match default values)
        return DFD_STYLING_HELPERS.isSelectionFilter(filter as string);
      }
    } catch (error) {
      this.logger.debugComponent('DfdVisualEffects', 'Error checking selection state', {
        cellId: cell.id,
        error,
      });
    }

    return false;
  }

  /**
   * Disable history tracking if available
   * @param graph - Graph instance that may have history disable functionality
   * @returns true if history was disabled, false if it was already disabled or not available
   */
  private _disableHistoryIfAvailable(graph?: any): boolean {
    // Try multiple ways to access the history plugin
    let historyPlugin = null;

    // Method 1: Direct property access (what we've been trying)
    if (graph && graph.history) {
      historyPlugin = graph.history;
    }

    // Method 2: Try accessing via getPlugin method if it exists
    if (!historyPlugin && graph && typeof graph.getPlugin === 'function') {
      try {
        historyPlugin = graph.getPlugin('history');
      } catch {
        // Ignore errors from getPlugin
      }
    }

    // Method 3: Try accessing plugins array/object
    if (!historyPlugin && graph && graph.plugins) {
      // Check if plugins is an array
      if (Array.isArray(graph.plugins)) {
        historyPlugin = graph.plugins.find(
          (p: any) => p.name === 'history' || p.constructor.name === 'History',
        );
      } else if (typeof graph.plugins === 'object') {
        historyPlugin = graph.plugins.history || graph.plugins.History;
      }
    }

    // this.logger.debugComponent('DfdVisualEffects', 'Attempting to disable history', {
    //   hasGraph: !!graph,
    //   hasHistory: !!(graph && graph.history),
    //   hasHistoryPlugin: !!historyPlugin,
    //   hasDisableMethod: !!(historyPlugin && typeof historyPlugin.disable === 'function'),
    //   graphType: graph ? graph.constructor.name : 'undefined',
    //   historyType: historyPlugin ? historyPlugin.constructor.name : 'undefined',
    //   hasGetPlugin: !!(graph && typeof graph.getPlugin === 'function'),
    //   hasPlugins: !!(graph && graph.plugins),
    //   pluginsType:
    //     graph && graph.plugins
    //       ? Array.isArray(graph.plugins)
    //         ? 'array'
    //         : typeof graph.plugins
    //       : 'undefined',
    // });

    if (historyPlugin && typeof historyPlugin.disable === 'function') {
      try {
        historyPlugin.disable();
        // this.logger.debugComponent(
        //   'DfdVisualEffects',
        //   'History tracking disabled for visual effects',
        // );
        return true;
      } catch (error) {
        this.logger.warn('[VisualEffects] Failed to disable history tracking', { error });
      }
    }
    return false;
  }

  /**
   * Re-enable history tracking if it was previously disabled
   * @param graph - Graph instance that may have history enable functionality
   * @param wasDisabled - Whether history was previously disabled by this service
   */
  private _enableHistoryIfAvailable(graph?: any, wasDisabled?: boolean): void {
    if (!wasDisabled) return;

    // Try multiple ways to access the history plugin (same as disable method)
    let historyPlugin = null;

    // Method 1: Direct property access
    if (graph && graph.history) {
      historyPlugin = graph.history;
    }

    // Method 2: Try accessing via getPlugin method if it exists
    if (!historyPlugin && graph && typeof graph.getPlugin === 'function') {
      try {
        historyPlugin = graph.getPlugin('history');
      } catch {
        // Ignore errors from getPlugin
      }
    }

    // Method 3: Try accessing plugins array/object
    if (!historyPlugin && graph && graph.plugins) {
      if (Array.isArray(graph.plugins)) {
        historyPlugin = graph.plugins.find(
          (p: any) => p.name === 'history' || p.constructor.name === 'History',
        );
      } else if (typeof graph.plugins === 'object') {
        historyPlugin = graph.plugins.history || graph.plugins.History;
      }
    }

    if (historyPlugin && typeof historyPlugin.enable === 'function') {
      try {
        historyPlugin.enable();
        // this.logger.debugComponent(
        //   'DfdVisualEffects',
        //   'History tracking re-enabled after visual effects',
        // );
      } catch (error) {
        this.logger.warn('[VisualEffects] Failed to re-enable history tracking', { error });
      }
    }
  }
}
