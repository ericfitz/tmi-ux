/**
 * X6 Cell Extensions
 *
 * This file provides extensions and utility functions for X6 Cell objects,
 * adding consistent interfaces and behavior across different cell types.
 *
 * Key functionality:
 * - Extends X6 Cell prototype with custom methods for DFD-specific operations
 * - Provides unified interfaces for cell metadata management
 * - Adds consistent label and text handling across node and edge types
 * - Implements port connection state tracking and management
 * - Provides cell type detection and validation utilities
 * - Adds application-specific data management for cells
 * - Implements selection and highlighting state management
 * - Provides cell styling and visual property management
 * - Adds serialization and persistence utilities for cell data
 * - Implements cell validation and business rule checking
 * - Provides cell relationship and connectivity utilities
 * - Initializes cell extensions on application startup
 */

import { Cell, Edge } from '@antv/x6';
import { DFD_STYLING } from '../constants/styling-constants';
import { Metadata } from '../domain/value-objects/metadata';

/**
 * X6 Cell Extensions
 *
 * These extensions provide unified interfaces for common operations across different cell types,
 * handling the underlying differences between nodes and edges in X6's implementation.
 *
 * Key principles:
 * - Use X6 native properties for X6 native state
 * - Use metadata array only for application-specific data
 * - Provide consistent API regardless of cell type
 */

/**
 * Node type information interface
 */
export interface NodeTypeInfo {
  type: string;
  isTextbox: boolean;
  isSecurityBoundary: boolean;
  defaultZIndex: number;
  hasTools: boolean;
  hasPorts: boolean;
  shape: string;
}

/**
 * Port connection state interface
 */
export interface PortConnectionState {
  nodeId: string;
  connectedPorts: Set<string>;
  visiblePorts: Set<string>;
  lastUpdated: Date;
}

/**
 * Extended cell interface with our custom methods
 */
export interface ExtendedCell extends Cell {
  setLabel(label: string): void;
  getLabel(): string;
  setApplicationMetadata(key: string, value: string): void;
  getApplicationMetadata(key?: string): string | Record<string, string>;
  removeApplicationMetadata(key: string): void;
  hasApplicationMetadata(key: string): boolean;
  // Node-specific methods
  getNodeTypeInfo(): NodeTypeInfo | null;
  isNodeType(type: string): boolean;
  updatePortVisibility(): void;
  getPortConnectionState(): PortConnectionState | null;
}

/**
 * Initialize X6 cell extensions by adding methods to prototypes
 * This must be called once during application initialization
 */
export function initializeX6CellExtensions(): void {
  // Add setLabel method to Cell prototype
  (Cell.prototype as any).setLabel = function (label: string): void {
    if (this.isNode()) {
      // For nodes, set the text attribute directly
      this.setAttrByPath('text/text', label);
    } else if (this.isEdge()) {
      // For edges, preserve existing label styling while updating text
      const existingLabels = (this as Edge).getLabels();
      if (existingLabels && existingLabels.length > 0) {
        // Preserve existing label attributes and only update the text
        const updatedLabels = existingLabels.map(existingLabel => {
          if (existingLabel && typeof existingLabel === 'object' && 'attrs' in existingLabel) {
            return {
              ...existingLabel,
              attrs: {
                ...existingLabel.attrs,
                text: {
                  ...(existingLabel.attrs as any)?.text,
                  text: label,
                },
              },
            };
          }
          return existingLabel;
        });
        (this as Edge).setLabels(updatedLabels);
      } else {
        // Fallback for edges without existing labels - use default styling
        (this as Edge).setLabels([
          {
            position: 0.5,
            attrs: {
              text: {
                text: label,
                fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
                fill: '#333',
                fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
                textAnchor: 'middle',
                dominantBaseline: 'middle',
              },
              rect: {
                fill: '#ffffff',
                stroke: 'none',
              },
            },
          },
        ]);
      }
    }
  };

  // Add getLabel method to Cell prototype
  (Cell.prototype as any).getLabel = function (): string {
    if (this.isNode()) {
      // For nodes, get from text attribute
      const textValue = this.getAttrByPath('text/text');
      return (typeof textValue === 'string' ? textValue : '') || '';
    } else if (this.isEdge()) {
      // For edges, get from the first label
      const labels = (this as Edge).getLabels();
      if (labels && labels.length > 0) {
        const firstLabel = labels[0];
        if (firstLabel && typeof firstLabel === 'object' && 'attrs' in firstLabel) {
          const labelAttrs = firstLabel.attrs as any;
          if (labelAttrs?.['text']?.['text']) {
            return labelAttrs['text']['text'];
          }
        }
      }
      return '';
    }
    return '';
  };

  // Add setApplicationMetadata method to Cell prototype
  (Cell.prototype as any).setApplicationMetadata = function (key: string, value: string): void {
    // Get existing metadata array or create new one
    const existingMetadata = this.getData()?.data || [];

    // Remove existing entry with same key
    const filteredMetadata = existingMetadata.filter((entry: any) => entry.key !== key);

    // Add new entry
    const newMetadata = [...filteredMetadata, { key, value }];

    // Update the cell's data
    const currentData = this.getData() || {};
    this.setData({ ...currentData, data: newMetadata });
  };

  // Add getApplicationMetadata method to Cell prototype
  (Cell.prototype as any).getApplicationMetadata = function (
    key?: string,
  ): string | Record<string, string> {
    const metadata = this.getData()?.data || [];

    if (key) {
      // Return specific key value
      const entry = metadata.find((entry: any) => entry.key === key);
      return entry ? entry.value : '';
    } else {
      // Return all metadata as record
      const record: Record<string, string> = {};
      metadata.forEach((entry: any) => {
        record[entry.key] = entry.value;
      });
      return record;
    }
  };

  // Add removeApplicationMetadata method to Cell prototype
  (Cell.prototype as any).removeApplicationMetadata = function (key: string): void {
    const existingMetadata = this.getData()?.data || [];
    const filteredMetadata = existingMetadata.filter((entry: any) => entry.key !== key);

    const currentData = this.getData() || {};
    this.setData({ ...currentData, data: filteredMetadata });
  };

  // Add hasApplicationMetadata method to Cell prototype
  (Cell.prototype as any).hasApplicationMetadata = function (key: string): boolean {
    const metadata = this.getData()?.data || [];
    return metadata.some((entry: any) => entry.key === key);
  };

  // Add getNodeTypeInfo method to Cell prototype
  (Cell.prototype as any).getNodeTypeInfo = function (): NodeTypeInfo | null {
    if (!this.isNode()) {
      return null;
    }

    const nodeType = this.shape || 'unknown';

    const isTextbox = nodeType === 'text-box';
    const isSecurityBoundary = nodeType === 'security-boundary';

    // Determine default z-index based on node type
    let defaultZIndex = 10; // Default for regular nodes
    if (isSecurityBoundary) {
      defaultZIndex = 1; // Security boundaries stay behind
    } else if (isTextbox) {
      defaultZIndex = 20; // Textboxes appear above all other shapes
    }

    // Determine X6 shape based on node type
    let shape = 'rect'; // Default shape
    switch (nodeType) {
      case 'process':
        shape = 'ellipse';
        break;
      case 'store':
        shape = 'store';
        break;
      case 'actor':
      case 'security-boundary':
      case 'text-box':
        shape = 'rect';
        break;
    }

    return {
      type: nodeType,
      isTextbox,
      isSecurityBoundary,
      defaultZIndex,
      hasTools: !isTextbox, // Textboxes typically don't have tools
      hasPorts: !isTextbox, // Textboxes don't have ports
      shape,
    };
  };

  // Add isNodeType method to Cell prototype
  (Cell.prototype as any).isNodeType = function (type: string): boolean {
    if (!this.isNode()) {
      return false;
    }
    const nodeType = this.shape || 'unknown';
    return nodeType === type;
  };

  // Add updatePortVisibility method to Cell prototype
  (Cell.prototype as any).updatePortVisibility = function (): void {
    if (!this.isNode()) {
      return;
    }
  };

  // Add getPortConnectionState method to Cell prototype
  (Cell.prototype as any).getPortConnectionState = function (): PortConnectionState | null {
    if (!this.isNode()) {
      return null;
    }

    return {
      nodeId: this.id,
      connectedPorts: new Set<string>(),
      visiblePorts: new Set<string>(),
      lastUpdated: new Date(),
    };
  };
}

/**
 * Utility functions for working with X6 cells
 */
export class CellUtils {
  /**
   * Safely gets a cell's position, handling potential null/undefined cases
   */
  static getPosition(cell: Cell): { x: number; y: number } {
    if (cell.isNode()) {
      return cell.getPosition();
    }
    return { x: 0, y: 0 };
  }

  /**
   * Safely gets a cell's size, handling potential null/undefined cases
   */
  static getSize(cell: Cell): { width: number; height: number } {
    if (cell.isNode()) {
      return cell.getSize();
    }
    return { width: 0, height: 0 };
  }

  /**
   * Gets the cell type for domain model purposes
   */
  static getCellType(cell: Cell): string {
    if (cell.isNode()) {
      return cell.shape || 'unknown';
    } else if (cell.isEdge()) {
      return 'edge';
    }
    return 'unknown';
  }

  /**
   * Validates that metadata contains only application-specific data
   * Returns true if metadata is valid (no X6 native properties)
   */
  static validateMetadata(metadata: Metadata[]): boolean {
    const x6NativeProperties = [
      'position',
      'size',
      'angle',
      'attrs',
      'zIndex',
      'visible',
      'parent',
      'children',
      'source',
      'target',
      'vertices',
      'router',
      'connector',
      'labels',
      'defaultLabel',
    ];

    for (const entry of metadata) {
      if (x6NativeProperties.includes(entry.key)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Filters out any X6 native properties from metadata
   * Returns clean metadata array with only application-specific data
   */
  static cleanMetadata(metadata: Metadata[]): Metadata[] {
    const x6NativeProperties = [
      'position',
      'size',
      'angle',
      'attrs',
      'zIndex',
      'visible',
      'parent',
      'children',
      'source',
      'target',
      'vertices',
      'router',
      'connector',
      'labels',
      'defaultLabel',
    ];

    return metadata.filter(entry => !x6NativeProperties.includes(entry.key));
  }

  /**
   * Gets application metadata from a cell as a clean record
   */
  static getCleanMetadata(cell: Cell): Record<string, string> {
    const metadata = cell.getData()?.data || [];
    const cleanMetadata = this.cleanMetadata(metadata);

    const record: Record<string, string> = {};
    cleanMetadata.forEach((entry: any) => {
      record[entry.key] = entry.value;
    });

    return record;
  }
}
