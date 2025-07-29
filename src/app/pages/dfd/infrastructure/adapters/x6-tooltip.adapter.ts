import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { DfdTooltipService } from '../../services/dfd-tooltip.service';
import { DFD_STYLING } from '../../constants/styling-constants';

/**
 * X6 Tooltip Adapter
 * Handles X6-specific tooltip DOM manipulation and event handling
 * Delegates business logic to DfdTooltipService
 */
@Injectable()
export class X6TooltipAdapter {
  private tooltipElement: HTMLElement | null = null;
  private isInitialized = false;

  constructor(
    private logger: LoggerService,
    private tooltipService: DfdTooltipService,
  ) {}

  /**
   * Initialize tooltip system for a graph
   */
  initialize(graph: Graph): void {
    if (this.isInitialized) {
      this.logger.warn('[X6TooltipAdapter] Already initialized, skipping');
      return;
    }

    try {
      this.createTooltipElement(graph);
      this.setupPortTooltipEvents(graph);
      this.isInitialized = true;
      this.logger.info('[X6TooltipAdapter] Tooltip system initialized');
    } catch (error) {
      this.logger.error('[X6TooltipAdapter] Error initializing tooltip system', error);
    }
  }

  /**
   * Dispose tooltip system
   */
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
  hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
    }
  }

  /**
   * Check if tooltip system is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.tooltipElement !== null;
  }

  /**
   * Create tooltip DOM element
   */
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
}
