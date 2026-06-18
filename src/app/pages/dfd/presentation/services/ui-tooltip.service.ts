import { Injectable } from '@angular/core';
import { Cell, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { Metadata } from '../../domain/value-objects/metadata';

/**
 * Interface for port object structure
 */
interface PortObject {
  id?: string;
  attrs?: Record<string, { text?: string }>;
}

/**
 * Service for managing tooltip content and positioning logic
 * Contains business logic for tooltip data extraction and formatting
 */
@Injectable()
// SEM@003cf465e4def28cd84b3d18e926a98731eff98f: extract and format tooltip content for graph nodes, ports, and cell metadata (pure)
export class UiTooltipService {
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: inject logger dependency (pure)
  constructor(private logger: LoggerService) {}

  /**
   * Get tooltip content for a port
   */
  // SEM@cd1e8083a933e71b69d89d729371e93ca3104dcd: fetch label text for a graph node port, falling back to port ID (pure)
  getPortTooltipContent(node: Node, portId: string): string {
    if (!node || !portId) {
      this.logger.warn('[TooltipService] Invalid input for port tooltip', { node: !!node, portId });
      return '';
    }

    try {
      // Get the port object using X6's getPort method
      const portObj = (node as any).getPort(String(portId)) as PortObject;
      if (!portObj) {
        this.logger.debugComponent('DfdTooltip', 'Port object not found', {
          nodeId: node.id,
          portId,
        });
        return String(portId); // Fallback to port ID
      }

      // Extract label text from port attributes
      let labelText = this.extractPortLabelText(portObj);

      // If no label found, use the port ID as fallback
      if (!labelText || labelText.trim() === '') {
        labelText = String(portId);
      }

      this.logger.debugComponent('DfdTooltip', 'Generated port tooltip content', {
        nodeId: node.id,
        portId,
        content: labelText,
      });

      return labelText;
    } catch (error) {
      this.logger.error('[TooltipService] Error getting port tooltip content', error);
      return String(portId); // Fallback to port ID
    }
  }

  /**
   * Calculate tooltip position relative to mouse event
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: compute viewport-clamped tooltip position from a mouse event (pure)
  calculateTooltipPosition(
    mouseEvent: MouseEvent,
    options: { offsetX?: number; offsetY?: number } = {},
  ): { x: number; y: number } {
    const { offsetX = 10, offsetY = -30 } = options;

    const position = {
      x: mouseEvent.clientX + offsetX,
      y: mouseEvent.clientY + offsetY,
    };

    // Ensure tooltip doesn't go off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipEstimatedWidth = 200; // Estimate tooltip width
    const tooltipEstimatedHeight = 30; // Estimate tooltip height

    // Adjust X position if tooltip would go off right edge
    if (position.x + tooltipEstimatedWidth > viewportWidth) {
      position.x = mouseEvent.clientX - tooltipEstimatedWidth - Math.abs(offsetX);
    }

    // Adjust Y position if tooltip would go off top edge
    if (position.y < 0) {
      position.y = mouseEvent.clientY + Math.abs(offsetY);
    }

    // Adjust Y position if tooltip would go off bottom edge
    if (position.y + tooltipEstimatedHeight > viewportHeight) {
      position.y = mouseEvent.clientY - tooltipEstimatedHeight - Math.abs(offsetY);
    }

    return position;
  }

  /**
   * Format tooltip content for display
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: trim, truncate, and normalize whitespace in tooltip text (pure)
  formatTooltipContent(content: string, maxLength: number = 50): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Trim whitespace
    let formatted = content.trim();

    // Truncate if too long
    if (formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength - 3) + '...';
    }

    // Replace multiple spaces with single space
    formatted = formatted.replace(/\s+/g, ' ');

    return formatted;
  }

  /**
   * Validate if tooltip should be shown
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate whether tooltip content is long enough to display (pure)
  shouldShowTooltip(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // Don't show tooltip for very short content (probably just port ID)
    const trimmedContent = content.trim();
    if (trimmedContent.length <= 2) {
      return false;
    }

    return true;
  }

  /**
   * Get tooltip content for a node (can be extended for node tooltips)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build tooltip label from a graph node's type and label (pure)
  getNodeTooltipContent(node: Node): string {
    if (!node) {
      return '';
    }

    try {
      // Get node label or name
      const label = (node as any).getLabel ? (node as any).getLabel() : '';
      // Use getNodeTypeInfo for reliable node type detection
      const nodeTypeInfo = (node as any).getNodeTypeInfo();
      const nodeType = nodeTypeInfo?.type || 'unknown';

      if (label && label.trim() !== '') {
        return `${nodeType}: ${label}`;
      } else {
        return `${nodeType} (${node.id})`;
      }
    } catch (error) {
      this.logger.error('[TooltipService] Error getting node tooltip content', error);
      return `Node: ${node.id}`;
    }
  }

  /**
   * Get tooltip content for a cell's metadata.
   * Returns null if the cell has no metadata, suppressing the tooltip.
   */
  // SEM@003cf465e4def28cd84b3d18e926a98731eff98f: format a graph cell's metadata entries as tooltip text, null if none (pure)
  getCellMetadataTooltipContent(cell: Cell): string | null {
    if (!cell) {
      return null;
    }

    try {
      const metadata: Metadata[] = cell.getData()?._metadata || [];
      if (!metadata.length) {
        return null;
      }

      return metadata.map(entry => `${entry.key} : ${entry.value}`).join('\n');
    } catch (error) {
      this.logger.error('[TooltipService] Error getting cell metadata tooltip content', error);
      return null;
    }
  }

  /**
   * Extract label text from port attributes
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: parse label text from a port's attribute map (pure)
  private extractPortLabelText(portObj: PortObject): string {
    if (!portObj?.attrs) {
      return '';
    }

    // Look for text attribute in port attrs
    if ('text' in portObj.attrs) {
      const textAttr = portObj.attrs['text'];
      if (textAttr && typeof textAttr['text'] === 'string') {
        return textAttr['text'];
      }
    }

    // Look for other common label attributes
    const labelAttributes = ['label', 'title', 'name'];
    for (const attr of labelAttributes) {
      if (attr in portObj.attrs) {
        const attrValue = portObj.attrs[attr];
        if (attrValue && typeof attrValue === 'string') {
          return attrValue;
        }
        if (attrValue && typeof attrValue === 'object' && 'text' in attrValue) {
          const text = (attrValue as any).text;
          if (typeof text === 'string') {
            return text;
          }
        }
      }
    }

    return '';
  }
}
