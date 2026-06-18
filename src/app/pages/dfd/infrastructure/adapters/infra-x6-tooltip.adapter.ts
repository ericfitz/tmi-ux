import { Injectable } from '@angular/core';
import { Cell, Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import { UiTooltipService } from '../../presentation/services/ui-tooltip.service';
import { DFD_STYLING } from '../../constants/styling-constants';

/**
 * X6 Tooltip Adapter
 * Handles X6-specific tooltip DOM manipulation and event handling
 * Delegates business logic to UiTooltipService
 */
@Injectable()
// SEM@fa402b2f2a4a64946fb4201c8bde6185adc6650d: manage DFD tooltip DOM lifecycle and X6 graph event bindings
export class X6TooltipAdapter {
  private tooltipElement: HTMLElement | null = null;
  private isInitialized = false;

  // SEM@003cf465e4def28cd84b3d18e926a98731eff98f: inject logger, tooltip service, and user preferences dependencies (pure)
  constructor(
    private logger: LoggerService,
    private tooltipService: UiTooltipService,
    private userPreferencesService: UserPreferencesService,
  ) {}

  /**
   * Initialize tooltip system for a graph
   */
  // SEM@003cf465e4def28cd84b3d18e926a98731eff98f: build tooltip DOM element and register all graph event handlers (mutates shared state)
  initialize(graph: Graph): void {
    if (this.isInitialized) {
      this.logger.warn('[X6TooltipAdapter] Already initialized, skipping');
      return;
    }

    try {
      this.createTooltipElement(graph);
      this.setupPortTooltipEvents(graph);
      this.setupCellMetadataTooltipEvents(graph);
      this.isInitialized = true;
      this.logger.info('[X6TooltipAdapter] Tooltip system initialized');
    } catch (error) {
      this.logger.error('[X6TooltipAdapter] Error initializing tooltip system', error);
    }
  }

  /**
   * Dispose tooltip system
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: remove tooltip DOM element and reset initialized state (mutates shared state)
  dispose(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
    this.isInitialized = false;
    this.logger.info('[X6TooltipAdapter] Tooltip system disposed');
  }

  /**
   * Show tooltip at specified position with content
   */
  // SEM@003cf465e4def28cd84b3d18e926a98731eff98f: display the tooltip at a position with formatted single-line content (mutates shared state)
  showTooltip(content: string, position: { x: number; y: number }): void {
    if (!this.tooltipElement) {
      this.logger.warn('[X6TooltipAdapter] Cannot show tooltip: element not initialized');
      return;
    }

    // Format content using service
    const formattedContent = this.tooltipService.formatTooltipContent(content);

    if (!this.tooltipService.shouldShowTooltip(formattedContent)) {
      this.hideTooltip();
      return;
    }

    // Reset to single-line styles (in case multi-line was previously applied)
    this.tooltipElement.style.whiteSpace = 'nowrap';
    this.tooltipElement.style.maxWidth = '200px';

    // Set content and position
    this.tooltipElement.textContent = formattedContent;
    this.tooltipElement.style.left = `${position.x}px`;
    this.tooltipElement.style.top = `${position.y}px`;
    this.tooltipElement.style.display = 'block';

    this.logger.debugComponent('X6Tooltip', 'Tooltip shown', {
      content: formattedContent,
      position,
    });
  }

  /**
   * Hide tooltip
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: hide the tooltip DOM element (mutates shared state)
  hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
    }
  }

  /**
   * Check if tooltip system is initialized
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return whether the tooltip system is initialized and its DOM element exists (pure)
  isReady(): boolean {
    return this.isInitialized && this.tooltipElement !== null;
  }

  /**
   * Create tooltip DOM element
   */
  // SEM@cd1e8083a933e71b69d89d729371e93ca3104dcd: build and attach the tooltip DOM element to the graph container (mutates shared state)
  private createTooltipElement(graph: Graph): void {
    if (!graph.container) {
      throw new Error('Graph container not available for tooltip creation');
    }

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'dfd-port-tooltip';
    this.tooltipElement.style.cssText = `
      display: none;
      position: fixed;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: ${DFD_STYLING.DEFAULT_FONT_SIZE}px;
      font-family: inherit;
      white-space: nowrap;
      z-index: 10000;
      pointer-events: none;
      max-width: 200px;
      word-wrap: break-word;
    `;

    graph.container.appendChild(this.tooltipElement);
    this.logger.debugComponent('X6Tooltip', 'Tooltip element created');
  }

  /**
   * Set up port tooltip event handlers
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: register X6 graph events that show or hide port tooltips on hover (mutates shared state)
  private setupPortTooltipEvents(graph: Graph): void {
    // Handle port mouseenter
    graph.on(
      'node:port:mouseenter',
      ({ node, port, e }: { node: Node; port: { id: string }; e: MouseEvent }) => {
        if (!port || !node || !port.id) {
          return;
        }

        try {
          // Get tooltip content from service
          const content = this.tooltipService.getPortTooltipContent(node, port.id);

          // Calculate position using service
          const position = this.tooltipService.calculateTooltipPosition(e);

          // Show tooltip using adapter
          this.showTooltip(content, position);
        } catch (error) {
          this.logger.error('[X6TooltipAdapter] Error handling port mouseenter', error);
        }
      },
    );

    // Handle port mouseleave
    graph.on('node:port:mouseleave', () => {
      this.hideTooltip();
    });

    // Hide tooltip on other graph events
    graph.on('blank:mousedown node:mousedown edge:mousedown', () => {
      this.hideTooltip();
    });

    // Hide tooltip on scroll events (to prevent tooltip staying in wrong position)
    graph.on('graph:panned', () => {
      this.hideTooltip();
    });

    // Hide tooltip on zoom events
    graph.on('scale', () => {
      this.hideTooltip();
    });

    this.logger.debugComponent('X6Tooltip', 'Port tooltip events set up');
  }

  /**
   * Show multi-line tooltip at specified position with raw content.
   * Bypasses formatTooltipContent to preserve line breaks.
   */
  // SEM@fa402b2f2a4a64946fb4201c8bde6185adc6650d: display tooltip with multi-line content, bypassing format truncation (mutates shared state)
  private showMultilineTooltip(content: string, position: { x: number; y: number }): void {
    if (!this.tooltipElement) {
      this.logger.warn('[X6TooltipAdapter] Cannot show tooltip: element not initialized');
      return;
    }

    if (!content || content.trim().length === 0) {
      this.hideTooltip();
      return;
    }

    // Apply multi-line styles
    this.tooltipElement.style.whiteSpace = 'pre-line';
    this.tooltipElement.style.maxWidth = '350px';

    // Set content directly (no formatting/truncation)
    this.tooltipElement.textContent = content;
    this.tooltipElement.style.left = `${position.x}px`;
    this.tooltipElement.style.top = `${position.y}px`;
    this.tooltipElement.style.display = 'block';

    // this.logger.debugComponent('X6Tooltip', 'Multi-line tooltip shown', {
    //   contentLines: content.split('\n').length,
    //   position,
    // });
  }

  /**
   * Set up cell metadata tooltip event handlers
   */
  // SEM@003cf465e4def28cd84b3d18e926a98731eff98f: register cell mouseenter/leave events to show metadata tooltip on hover (mutates shared state)
  private setupCellMetadataTooltipEvents(graph: Graph): void {
    graph.on('cell:mouseenter', ({ cell, e }: { cell: Cell; e: MouseEvent }) => {
      try {
        if (!this.userPreferencesService.getPreferences().hoverShowMetadata) {
          return;
        }

        const content = this.tooltipService.getCellMetadataTooltipContent(cell);
        if (content === null) {
          return;
        }

        const position = this.tooltipService.calculateTooltipPosition(e, {
          offsetX: 15,
          offsetY: -10,
        });
        this.showMultilineTooltip(content, position);
      } catch (error) {
        this.logger.error('[X6TooltipAdapter] Error handling cell metadata mouseenter', error);
      }
    });

    graph.on('cell:mouseleave', () => {
      this.hideTooltip();
    });

    this.logger.debugComponent('X6Tooltip', 'Cell metadata tooltip events set up');
  }
}
