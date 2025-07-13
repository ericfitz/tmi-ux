import { Shape } from '@antv/x6';

/**
 * X6 Shape Definitions
 * Contains custom shape definitions for the DFD diagram
 */

/**
 * Register custom store shape with only top and bottom borders
 */
export function registerCustomShapes(): void {
  Shape.Rect.define({
    shape: 'store-shape',
    markup: [
      {
        tagName: 'rect',
        selector: 'body',
      },
      {
        tagName: 'text',
        selector: 'text',
      },
      {
        tagName: 'path',
        selector: 'topLine',
      },
      {
        tagName: 'path',
        selector: 'bottomLine',
      },
    ],
    attrs: {
      topLine: {
        stroke: '#333333',
        strokeWidth: 2,
        refD: 'M 0 0 l 200 0',
      },
      bottomLine: {
        stroke: '#333333',
        strokeWidth: 2,
        refY: '100%',
        refD: 'M 0 0 l 200 0',
      },
      body: {
        fill: '#FFFFFF',
        stroke: 'transparent',
        strokeWidth: 0,
      },
      text: {
        refX: '50%',
        refY: '50%',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
        fontFamily: '"Roboto Condensed", Arial, sans-serif',
        fontSize: 12,
        fill: '#000000',
      },
    },
  });
}

/**
 * Get X6 shape name for domain node type
 */
export function getX6ShapeForNodeType(nodeType: string): string {
  switch (nodeType) {
    case 'process':
      return 'ellipse';
    case 'store':
      return 'store-shape'; // Use custom shape for store
    case 'actor':
      return 'rect';
    case 'security-boundary':
      return 'rect';
    case 'textbox':
      return 'rect';
    default:
      return 'rect';
  }
}

/**
 * Get X6 edge attributes for domain edge type
 */
export function getEdgeAttrs(edgeType: string): Record<string, unknown> {
  const baseAttrs = {
    line: {
      stroke: '#000000',
      strokeWidth: 2,
      targetMarker: {
        name: 'classic',
        size: 8,
        fill: '#000000',
        stroke: '#000000',
      },
    },
  };

  switch (edgeType) {
    case 'data-flow':
      return baseAttrs;
    case 'trust-boundary':
      return {
        ...baseAttrs,
        line: {
          ...baseAttrs.line,
          stroke: '#000000',
          strokeDasharray: '5 5',
          targetMarker: {
            ...baseAttrs.line.targetMarker,
            fill: '#722ED1',
            stroke: '#000000',
          },
        },
      };
    default:
      return baseAttrs;
  }
}
