import { Injectable } from '@angular/core';
import { NodeTypeInfo } from '../../utils/x6-cell-extensions';
import { getX6ShapeForNodeType } from '../adapters/infra-x6-shape-definitions';
import { DFD_STYLING } from '../../constants/styling-constants';

/**
 * Node attributes configuration interface
 */
export interface NodeAttrs {
  body?: Record<string, unknown>;
  text?: Record<string, unknown>;
}

/**
 * Port configuration interface
 */
export interface PortConfiguration {
  groups: Record<string, unknown>;
  items: Array<{ group: string; id?: string }>;
}

/**
 * Service responsible for providing node configuration based on node types.
 * Centralizes all node-specific configuration logic that was previously scattered
 * across the InfraX6GraphAdapter.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@0c4b0e63a2f170695121de276aae1d8887c94516: provide visual and port configuration for all DFD node types (pure)
export class InfraNodeConfigurationService {
  /**
   * Get node attributes configuration for a specific node type
   */
  // SEM@35a2315496da5f569769b294cb213b0ebabe7569: return text and body styling attributes for a given node type (pure)
  getNodeAttrs(nodeType: string): NodeAttrs {
    // Since we now use custom shapes with their own predefined attributes,
    // we only need to provide minimal overrides for dynamic content like text
    const baseTextAttrs = {
      fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
      fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
      fill: '#000000',
      refX: '50%',
      refY: '50%',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
    };

    switch (nodeType) {
      case 'process':
        // Custom process shape handles the ellipse styling
        return {
          text: baseTextAttrs,
        };

      case 'store':
        // Custom store shape handles the top/bottom line styling
        return {
          text: baseTextAttrs,
        };

      case 'actor':
        // Custom actor shape handles the rectangular styling
        return {
          text: baseTextAttrs,
        };

      case 'security-boundary':
        // Custom security-boundary shape handles the dashed border styling
        return {
          text: baseTextAttrs,
        };

      case 'text-box':
        // Custom text-box shape handles the transparent background
        return {
          text: baseTextAttrs,
        };

      default:
        // Fallback for unknown node types
        return {
          body: {
            strokeWidth: 2,
            stroke: '#000000',
            fill: '#FFFFFF',
          },
          text: baseTextAttrs,
        };
    }
  }

  /**
   * Get port configuration for a specific node type
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: return four-directional port configuration for a node type; empty for text-box (pure)
  getNodePorts(nodeType: string): PortConfiguration {
    // text-box shapes should not have ports
    if (nodeType === 'text-box') {
      return {
        groups: {},
        items: [],
      };
    }

    // All other node types get the same port configuration
    return {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 5,
              magnet: 'active',
              'port-group': 'top',
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 5,
              magnet: 'active',
              'port-group': 'right',
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 5,
              magnet: 'active',
              'port-group': 'bottom',
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 5,
              magnet: 'active',
              'port-group': 'left',
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
      },
      items: [
        { group: 'top', id: 'top' },
        { group: 'right', id: 'right' },
        { group: 'bottom', id: 'bottom' },
        { group: 'left', id: 'left' },
      ],
    };
  }

  /**
   * Get X6 shape name for a specific node type
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return the X6 shape name registered for a node type (pure)
  getNodeShape(nodeType: string): string {
    // Use centralized shape mapping from x6-shape-definitions
    return getX6ShapeForNodeType(nodeType);
  }

  /**
   * Get default z-index for a specific node type
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return the default z-index for a node type (pure)
  getNodeZIndex(nodeType: string): number {
    switch (nodeType) {
      case 'security-boundary':
        return 1; // Security boundaries stay behind other nodes
      case 'text-box':
        return 20; // text-boxes appear above all other shapes
      default:
        return 10; // Default z-index for regular nodes
    }
  }

  /**
   * Check if a node type is a text-box
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate whether a node type is a text-box annotation node (pure)
  isTextboxNode(nodeType: string): boolean {
    return nodeType === 'text-box';
  }

  /**
   * Check if a node type is a security boundary
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate whether a node type is a security boundary (pure)
  isSecurityBoundary(nodeType: string): boolean {
    return nodeType === 'security-boundary';
  }

  /**
   * Get comprehensive node type information
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a NodeTypeInfo descriptor aggregating flags, shape, and z-index for a node type (pure)
  getNodeTypeInfo(nodeType: string): NodeTypeInfo {
    const isTextbox = this.isTextboxNode(nodeType);
    const isSecurityBoundary = this.isSecurityBoundary(nodeType);

    return {
      type: nodeType,
      isTextbox,
      isSecurityBoundary,
      defaultZIndex: this.getNodeZIndex(nodeType),
      hasTools: !isTextbox, // Textboxes typically don't have tools
      hasPorts: !isTextbox, // Textboxes don't have ports
      shape: this.getNodeShape(nodeType),
    };
  }

  /**
   * Validate if a node type is supported
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate whether a string is a recognized DFD node type (pure)
  isValidNodeType(nodeType: string): boolean {
    const validTypes = ['process', 'store', 'actor', 'security-boundary', 'text-box'];
    return validTypes.includes(nodeType);
  }

  /**
   * Get all supported node types
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: list all supported DFD node type identifiers (pure)
  getSupportedNodeTypes(): string[] {
    return ['process', 'store', 'actor', 'security-boundary', 'text-box'];
  }
}
