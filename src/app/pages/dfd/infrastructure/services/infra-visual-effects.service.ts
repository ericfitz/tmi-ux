import { Injectable } from '@angular/core';
import { Cell, Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
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
// SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: manage transient visual effects (highlights, labels) on diagram cells (mutates shared state)
export class InfraVisualEffectsService {
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: inject logger and user-preferences dependencies for the visual effects service (pure)
  constructor(
    private readonly logger: LoggerService,
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  private readonly FADE_DURATION_MS = DFD_STYLING.CREATION.FADE_DURATION_MS;
  private readonly ANIMATION_FRAME_INTERVAL = DFD_STYLING.CREATION.ANIMATION_FRAME_INTERVAL;

  // Track active effects to prevent conflicts and memory leaks
  private activeEffects = new Map<string, ActiveEffect>();

  // Track active user label overlays (keyed by `${cellId}-${email}`)
  private _activeLabels = new Map<string, HTMLElement>();
  // Track label count per cell for vertical stacking
  private _cellLabelCounts = new Map<string, number>();

  /**
   * Apply creation highlight with fade-out effect to a newly created cell
   * Starts bright and fades out over 1 second
   * @param cell - The cell to apply the effect to
   * @param graph - The graph instance for batching operations (optional, but recommended)
   * @param color - Optional RGB color object, defaults to light blue (0, 150, 255)
   * @param options - Optional configuration for the effect
   */
  // SEM@4caca46d4b23a62c77ebde47a08b8419d566f71d: apply a fade-out glow to a newly created diagram cell; skips if animations disabled (mutates shared state)
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

    // Check user preference for animations
    if (!this.areAnimationsEnabled()) {
      this.logger.debugComponent(
        'DFD',
        '[VisualEffects] Skipping creation highlight - animations disabled by user',
        {
          cellId: cell.id,
        },
      );
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
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: cancel active visual effects and clear visual state on a diagram cell (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a diagram cell currently has a tracked visual effect (pure)
  hasActiveEffects(cell: Cell): boolean {
    return this.activeEffects.has(cell.id);
  }

  /**
   * Show a user display name label near a cell for remote collaboration feedback.
   * Creates a DOM overlay that fades out over USER_LABEL.FADE_DURATION_MS.
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: display a collaborator's name overlay near a diagram cell then fade it out (mutates shared state)
  showUserLabel(cell: Cell, graph: Graph, email: string, displayName: string): void {
    if (!cell || !graph?.container) {
      return;
    }

    if (!this.areAnimationsEnabled()) {
      return;
    }

    const cellId = cell.id;
    const labelKey = `${cellId}-${email}`;

    // Remove existing label for same cell+user if present
    this._removeLabel(labelKey, cellId);

    // Get cell position in client coordinates
    const bbox = cell.getBBox();
    const clientPoint = graph.localToClient(bbox.x + bbox.width / 2, bbox.y);

    // Calculate vertical offset for stacking
    const currentCount = this._cellLabelCounts.get(cellId) || 0;
    const stackOffset =
      currentCount *
      (DFD_STYLING.USER_LABEL.FONT_SIZE +
        DFD_STYLING.USER_LABEL.PADDING_Y * 2 +
        DFD_STYLING.USER_LABEL.STACK_GAP);

    // Get user color and contrasting text color
    const color = DFD_STYLING_HELPERS.getUserLabelColor(email);
    const textColor = this._getUserLabelTextColor(color);

    // Create and position the label element
    const label = this._createUserLabelElement(
      displayName,
      color,
      textColor,
      clientPoint.x,
      clientPoint.y + DFD_STYLING.USER_LABEL.OFFSET_Y - stackOffset,
    );

    graph.container.appendChild(label);

    // Track the label
    this._activeLabels.set(labelKey, label);
    this._cellLabelCounts.set(cellId, currentCount + 1);

    // Start fade after a frame to ensure initial opacity is painted
    requestAnimationFrame(() => {
      label.style.opacity = '0';
    });

    // Clean up after transition ends
    label.addEventListener(
      'transitionend',
      () => {
        this._removeLabel(labelKey, cellId);
      },
      { once: true },
    );

    // Fallback cleanup in case transitionend doesn't fire
    setTimeout(() => {
      if (this._activeLabels.has(labelKey)) {
        this._removeLabel(labelKey, cellId);
      }
    }, DFD_STYLING.USER_LABEL.FADE_DURATION_MS + 500);
  }

  /**
   * Create a styled DOM element for the user label overlay
   */
  // SEM@7d86e38e60e4f1878b92a548e7a76a7545389ec1: build a styled DOM overlay element for a collaborator display-name label (pure)
  private _createUserLabelElement(
    displayName: string,
    color: { r: number; g: number; b: number },
    textColor: string,
    x: number,
    y: number,
  ): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dfd-user-label';
    el.textContent = displayName;
    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: ${DFD_STYLING.USER_LABEL.Z_INDEX};
      font-size: ${DFD_STYLING.USER_LABEL.FONT_SIZE}px;
      font-family: ${DFD_STYLING.TEXT_FONT_FAMILY};
      padding: ${DFD_STYLING.USER_LABEL.PADDING_Y}px ${DFD_STYLING.USER_LABEL.PADDING_X}px;
      border-radius: ${DFD_STYLING.USER_LABEL.BORDER_RADIUS}px;
      white-space: nowrap;
      background-color: rgba(${color.r}, ${color.g}, ${color.b}, 0.85);
      color: ${textColor};
      opacity: 1;
      transition: opacity ${DFD_STYLING.USER_LABEL.FADE_DURATION_MS}ms ease-out;
    `;
    return el;
  }

  /**
   * Get contrasting text color (white or black) based on background luminance
   */
  // SEM@7d86e38e60e4f1878b92a548e7a76a7545389ec1: compute a contrasting text color (black or white) for a given background color (pure)
  private _getUserLabelTextColor(color: { r: number; g: number; b: number }): string {
    const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    return luminance > 186 ? '#000000' : '#ffffff';
  }

  /**
   * Remove a user label element and update tracking maps
   */
  // SEM@7d86e38e60e4f1878b92a548e7a76a7545389ec1: remove a collaborator label element from the DOM and decrement its cell counter (mutates shared state)
  private _removeLabel(labelKey: string, cellId: string): void {
    const existing = this._activeLabels.get(labelKey);
    if (existing) {
      existing.remove();
      this._activeLabels.delete(labelKey);
      const count = this._cellLabelCounts.get(cellId) || 0;
      if (count <= 1) {
        this._cellLabelCounts.delete(cellId);
      } else {
        this._cellLabelCounts.set(cellId, count - 1);
      }
    }
  }

  /**
   * Clean up all active effects (useful for component destruction)
   */
  // SEM@7d86e38e60e4f1878b92a548e7a76a7545389ec1: cancel all active effects and remove all collaborator label overlays (mutates shared state)
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

    // Clean up user label overlays
    this._activeLabels.forEach(label => label.remove());
    this._activeLabels.clear();
    this._cellLabelCounts.clear();
  }

  /**
   * Alias for cleanup() to match test expectations
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: cancel all active visual effects; delegates to cleanup (mutates shared state)
  clearAllActiveEffects(): void {
    this.cleanup();
  }

  /**
   * Apply invalid embedding visual feedback (red stroke)
   * Shows user that the current drop target is not valid
   */
  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: apply a red stroke to a diagram cell to signal an invalid drop target (mutates shared state)
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

    // Apply red stroke to indicate invalid target (using constants)
    cell.attr('body/stroke', DFD_STYLING.HIGHLIGHTING.INVALID_EMBEDDING.STROKE_COLOR);
    cell.attr('body/strokeWidth', DFD_STYLING.HIGHLIGHTING.INVALID_EMBEDDING.STROKE_WIDTH);

    // Track the effect
    this.activeEffects.set(cell.id, {
      timer: null,
      cell,
      effectType: 'fade', // Reuse type since TypeScript doesn't allow extending the union
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
  // SEM@41de72ef1c753a3e626b8cc587c272e5e4614a4a: restore original stroke on a diagram cell after invalid embedding feedback (mutates shared state)
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
  // SEM@e2ca46c9764dd30e66d02e1b3dc7c25f22057c23: run a timed fade-out glow animation on a diagram cell, suppressing history entries (mutates shared state)
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

    // SEM@e2ca46c9764dd30e66d02e1b3dc7c25f22057c23: advance one animation frame of a cell fade-out, scheduling next frame or cleanup (mutates shared state)
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
  // SEM@e2ca46c9764dd30e66d02e1b3dc7c25f22057c23: apply a color-tinted drop-shadow filter at given opacity to a diagram cell (mutates shared state)
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
  // SEM@e2ca46c9764dd30e66d02e1b3dc7c25f22057c23: strip all visual filter effects from a diagram cell, restoring default appearance (mutates shared state)
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
  // SEM@cd1e8083a933e71b69d89d729371e93ca3104dcd: check whether a diagram cell currently has selection filter attributes applied (pure)
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

  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: locate the history plugin on a graph instance via multiple access strategies (pure)
  private _discoverHistoryPlugin(graph?: any): any {
    // Method 1: Direct property access
    if (graph && graph.history) {
      return graph.history;
    }

    // Method 2: Try accessing via getPlugin method if it exists
    if (graph && typeof graph.getPlugin === 'function') {
      try {
        const plugin = graph.getPlugin('history');
        if (plugin) return plugin;
      } catch {
        // Ignore errors from getPlugin
      }
    }

    // Method 3: Try accessing plugins array/object
    if (graph && graph.plugins) {
      if (Array.isArray(graph.plugins)) {
        const found = graph.plugins.find(
          (p: any) => p.name === 'history' || p.constructor.name === 'History',
        );
        if (found) return found;
      } else if (typeof graph.plugins === 'object') {
        const found = graph.plugins.history || graph.plugins.History;
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Disable history tracking if available
   * @param graph - Graph instance that may have history disable functionality
   * @returns true if history was disabled, false if it was already disabled or not available
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: disable the graph history plugin if present, returning whether it was disabled (mutates shared state)
  private _disableHistoryIfAvailable(graph?: any): boolean {
    const historyPlugin = this._discoverHistoryPlugin(graph);

    if (historyPlugin && typeof historyPlugin.disable === 'function') {
      try {
        historyPlugin.disable();
        return true;
      } catch (error) {
        this.logger.warn('[VisualEffects] Failed to disable history tracking', { error });
      }
    }
    return false;
  }

  /**
   * Check if animations are enabled in user preferences
   * @returns true if animations are enabled or preference not set, false otherwise
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: fetch the user preference for animations, defaulting to enabled (reads DB)
  private areAnimationsEnabled(): boolean {
    const prefs = this.userPreferencesService.getPreferences();
    return prefs.animations !== false;
  }

  /**
   * Re-enable history tracking if it was previously disabled
   * @param graph - Graph instance that may have history enable functionality
   * @param wasDisabled - Whether history was previously disabled by this service
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: re-enable the graph history plugin only if it was previously disabled by this service (mutates shared state)
  private _enableHistoryIfAvailable(graph?: any, wasDisabled?: boolean): void {
    if (!wasDisabled) return;

    const historyPlugin = this._discoverHistoryPlugin(graph);

    if (historyPlugin && typeof historyPlugin.enable === 'function') {
      try {
        historyPlugin.enable();
      } catch (error) {
        this.logger.warn('[VisualEffects] Failed to re-enable history tracking', { error });
      }
    }
  }
}
