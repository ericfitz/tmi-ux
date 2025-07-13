import { Injectable } from '@angular/core';
import { NodeTypeInfo } from '../../utils/x6-cell-extensions';
import { getX6ShapeForNodeType } from '../adapters/x6-shape-definitions';

/**
 * Node attributes configuration interface
 */
export interface NodeAttrs {
  body?: Record<string, unknown>;
  text?: Record<string, unknown>;
  topLine?: Record<string, unknown>;
  bottomLine?: Record<string, unknown>;
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
 * across the X6GraphAdapter.
 */
@Injectable({
  providedIn: 'root',
})
export class NodeConfigurationService {
  /**
   * Get node attributes configuration for a specific node type
   */
  getNodeAttrs(nodeType: string): NodeAttrs {
    const baseAttrs = {
      body: {
        strokeWidth: 2,
        stroke: '#000000',
        fill: '#FFFFFF',
      },
      text: {
        fontFamily: '"Roboto Condensed", Arial, sans-serif',
        fontSize: 12,
        fill: '#000000',
      },
    };

    switch (nodeType) {
      case 'process':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
            rx: 30,
            ry: 30,
          },
        };

      case 'store':
        return {
          body: {
            fill: '#FFFFFF',
            stroke: 'transparent',
            strokeWidth: 0,
          },
          topLine: {
            stroke: '#333333',
            strokeWidth: 2,
          },
          bottomLine: {
            stroke: '#333333',
            strokeWidth: 2,
          },
          text: {
            fontFamily: '"Roboto Condensed", Arial, sans-serif',
            fontSize: 12,
            fill: '#000000',
          },
        };

      case 'actor':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
          },
        };

      case 'security-boundary':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
            strokeDasharray: '5 5',
            rx: 10,
            ry: 10,
          },
        };

      case 'textbox':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
            stroke: 'none',
            strokeWidth: 0,
            fill: 'transparent',
          },
          text: {
            ...baseAttrs.text,
            fontSize: 12,
          },
        };

      default:
        return baseAttrs;
    }
  }

  /**
   * Get port configuration for a specific node type
   */
  getNodePorts(nodeType: string): PortConfiguration {
    // Textbox shapes should not have ports
    if (nodeType === 'textbox') {
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
      items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    };
  }

  /**
   * Get X6 shape name for a specific node type
   */
  getNodeShape(nodeType: string): string {
    // Use centralized shape mapping from x6-shape-definitions
    return getX6ShapeForNodeType(nodeType);
  }

  /**
   * Get default z-index for a specific node type
   */
  getNodeZIndex(nodeType: string): number {
    switch (nodeType) {
      case 'security-boundary':
        return 1; // Security boundaries stay behind other nodes
      case 'textbox':
        return 20; // Textboxes appear above all other shapes
      default:
        return 10; // Default z-index for regular nodes
    }
  }

  /**
   * Check if a node type is a textbox
   */
  isTextboxNode(nodeType: string): boolean {
    return nodeType === 'textbox';
  }

  /**
   * Check if a node type is a security boundary
   */
  isSecurityBoundary(nodeType: string): boolean {
    return nodeType === 'security-boundary';
  }

  /**
   * Get comprehensive node type information
   */
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
  isValidNodeType(nodeType: string): boolean {
    const validTypes = ['process', 'store', 'actor', 'security-boundary', 'textbox'];
    return validTypes.includes(nodeType);
  }

  /**
   * Get all supported node types
   */
  getSupportedNodeTypes(): string[] {
    return ['process', 'store', 'actor', 'security-boundary', 'textbox'];
  }
}
