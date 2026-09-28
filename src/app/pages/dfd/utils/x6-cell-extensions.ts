/**
 * X6 Cell Extensions
 *
 * Helper functions for DFD-specific operations on X6 cells: unified label access across nodes
 * and edges, application metadata stored in `data._metadata`, and node type detection.
 *
 * These are plain functions rather than methods on `Cell.prototype`, so they are typed without
 * casts and need no startup initialization.
 */

import { Cell } from '@antv/x6';
import { DFD_STYLING } from '../constants/styling-constants';
import { Metadata } from '../domain/value-objects/metadata';

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
 * Set a cell's label. Nodes store it in `text/text`; edges store it in the first label's
 * `attrs.text.text`, preserving existing label position and styling.
 */
export function setCellLabel(cell: Cell, label: string): void {
  if (cell.isNode()) {
    cell.setAttrByPath('text/text', label);
  } else if (cell.isEdge()) {
    const edge = cell;
    const existingLabels = edge.getLabels();
    if (existingLabels && existingLabels.length > 0) {
      const updatedLabels = existingLabels.map(existingLabel => {
        if (existingLabel && typeof existingLabel === 'object') {
          const existingAttrs = existingLabel.attrs as any;
          const existingTextAttrs = existingAttrs?.text || {};

          return {
            position: (existingLabel as any).position ?? 0.5,
            attrs: {
              text: {
                fontSize: existingTextAttrs.fontSize || DFD_STYLING.DEFAULT_FONT_SIZE,
                fill: existingTextAttrs.fill || '#333',
                fontFamily: existingTextAttrs.fontFamily || DFD_STYLING.TEXT_FONT_FAMILY,
                textAnchor: existingTextAttrs.textAnchor || 'middle',
                dominantBaseline: existingTextAttrs.dominantBaseline || 'middle',
                text: label,
              },
            },
          };
        }
        return existingLabel;
      });
      edge.setLabels(updatedLabels);
    } else {
      edge.setLabels([
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
          },
        },
      ]);
    }
  }
}

/**
 * Get a cell's label: `text/text` for nodes, the first label's `attrs.text.text` for edges.
 * Returns '' when there is no label.
 */
export function getCellLabel(cell: Cell): string {
  if (cell.isNode()) {
    const textValue = cell.getAttrByPath('text/text');
    return typeof textValue === 'string' ? textValue : '';
  }
  if (cell.isEdge()) {
    const firstLabel = cell.getLabels()[0];
    const text = (firstLabel?.attrs as any)?.['text']?.['text'];
    return typeof text === 'string' ? text : '';
  }
  return '';
}

/**
 * Get an application metadata value from `data._metadata`, or '' if the key is absent.
 */
export function getApplicationMetadata(cell: Cell, key: string): string {
  const metadata: Metadata[] = cell.getData()?._metadata || [];
  return metadata.find(entry => entry.key === key)?.value ?? '';
}

/**
 * Set an application metadata value in `data._metadata`, replacing any entry with the same key.
 */
export function setApplicationMetadata(cell: Cell, key: string, value: string): void {
  const currentData = cell.getData() || {};
  const existingMetadata: Metadata[] = currentData._metadata || [];
  cell.setData(
    {
      ...currentData,
      _metadata: [...existingMetadata.filter(entry => entry.key !== key), { key, value }],
    },
    { overwrite: true },
  );
}

/**
 * Remove an application metadata entry from `data._metadata`.
 */
export function removeApplicationMetadata(cell: Cell, key: string): void {
  const currentData = cell.getData() || {};
  const existingMetadata: Metadata[] = currentData._metadata || [];
  cell.setData(
    {
      ...currentData,
      _metadata: existingMetadata.filter(entry => entry.key !== key),
    },
    { overwrite: true },
  );
}

/**
 * Get DFD node type information, derived from the cell's shape. Returns null for non-nodes.
 */
export function getNodeTypeInfo(cell: Cell): NodeTypeInfo | null {
  if (!cell.isNode()) {
    return null;
  }

  const nodeType = cell.shape || 'unknown';

  const isTextbox = nodeType === 'text-box';
  const isSecurityBoundary = nodeType === 'security-boundary';

  // Determine default z-index based on node type
  let defaultZIndex = 10; // Default for regular nodes
  if (isSecurityBoundary) {
    defaultZIndex = 1; // Security boundaries stay behind
  } else if (isTextbox) {
    defaultZIndex = 20; // Textboxes appear above all other shapes
  }

  return {
    type: nodeType,
    isTextbox,
    isSecurityBoundary,
    defaultZIndex,
    hasTools: !isTextbox, // Textboxes typically don't have tools
    hasPorts: !isTextbox, // Textboxes don't have ports
    shape: nodeType === 'store' ? 'store' : 'rect',
  };
}
