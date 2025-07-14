import { Shape } from '@antv/x6';

/**
 * X6 Shape Definitions
 * Contains custom shape definitions for the DFD diagram
 */

/**
 * Register all custom shapes for DFD diagrams
 */
export function registerCustomShapes(): void {
  // Register custom store shape with only top and bottom borders
  Shape.Rect.define({
    shape: 'store',
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

  // Register custom actor shape (rectangular with standard styling)
  Shape.Rect.define({
    shape: 'actor',
    markup: [
      {
        tagName: 'rect',
        selector: 'body',
      },
      {
        tagName: 'text',
        selector: 'text',
      },
    ],
    attrs: {
      body: {
        strokeWidth: 2,
        stroke: '#000000',
        fill: '#FFFFFF',
        rx: 0,
        ry: 0,
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

  // Register custom process shape (elliptical/circular)
  Shape.Ellipse.define({
    shape: 'process',
    markup: [
      {
        tagName: 'ellipse',
        selector: 'body',
      },
      {
        tagName: 'text',
        selector: 'text',
      },
    ],
    attrs: {
      body: {
        strokeWidth: 2,
        stroke: '#000000',
        fill: '#FFFFFF',
        rx: 30,
        ry: 30,
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

  // Register custom security boundary shape (dashed rectangular border)
  Shape.Rect.define({
    shape: 'security-boundary',
    markup: [
      {
        tagName: 'rect',
        selector: 'body',
      },
      {
        tagName: 'text',
        selector: 'text',
      },
    ],
    attrs: {
      body: {
        strokeWidth: 2,
        stroke: '#000000',
        fill: '#FFFFFF',
        strokeDasharray: '5 5',
        rx: 10,
        ry: 10,
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

  // Register custom textbox shape (transparent background, text only)
  Shape.Rect.define({
    shape: 'textbox',
    markup: [
      {
        tagName: 'rect',
        selector: 'body',
      },
      {
        tagName: 'text',
        selector: 'text',
      },
    ],
    attrs: {
      body: {
        stroke: 'none',
        strokeWidth: 0,
        fill: 'transparent',
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
      return 'process'; // Use custom shape for process
    case 'store':
      return 'store'; // Use custom shape for store
    case 'actor':
      return 'actor'; // Use custom shape for actor
    case 'security-boundary':
      return 'security-boundary'; // Use custom shape for security boundary
    case 'textbox':
      return 'textbox'; // Use custom shape for textbox
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
