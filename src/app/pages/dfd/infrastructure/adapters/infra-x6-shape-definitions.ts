import { NumberExt, Shape } from '@antv/x6';
import { DFD_STYLING } from '../../constants/styling-constants';

/**
 * X6 Shape Definitions
 * Contains custom shape definitions for the DFD diagram
 */

/**
 * Track registered shapes to prevent duplicate registration
 */
const registeredShapes = new Set<string>();

/**
 * Register all custom shapes for DFD diagrams
 */
export function registerCustomShapes(): void {
  // Register custom store shape (cylinder/drum per DFD3 spec)
  // Adapted from official X6 custom cylinder example
  if (!registeredShapes.has('store')) {
    registeredShapes.add('store');
    Shape.Rect.define({
      shape: 'store',
      markup: [
        {
          tagName: 'path',
          selector: 'body',
        },
        {
          tagName: 'ellipse',
          selector: 'top',
        },
        {
          tagName: 'text',
          selector: 'text',
        },
      ],
      attrs: {
        body: {
          fill: DFD_STYLING.NODES.STORE.FILL,
          stroke: DFD_STYLING.NODES.STORE.STROKE,
          strokeWidth: DFD_STYLING.NODES.STORE.STROKE_WIDTH,
          lateral: 10,
        },
        top: {
          fill: DFD_STYLING.NODES.STORE.FILL,
          stroke: DFD_STYLING.NODES.STORE.STROKE,
          strokeWidth: DFD_STYLING.NODES.STORE.STROKE_WIDTH,
          refCx: '50%',
          refRx: '50%',
          cy: 10,
          ry: 10,
        },
        text: {
          refX: '50%',
          refY: '55%',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
          fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
          fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
        },
      },
      attrHooks: {
        lateral: {
          set(val, { refBBox }) {
            let t: number | string = val as number | string;
            const isPercentage = NumberExt.isPercentage(t);
            if (isPercentage) {
              t = parseFloat(t as string) / 100;
            }

            const x = refBBox.x;
            const y = refBBox.y;
            const w = refBBox.width;
            const h = refBBox.height;

            const rx = w / 2;
            const ry = isPercentage ? h * (t as number) : (t as number);
            const kappa = 0.551784;
            const cx = kappa * rx;
            const cy = kappa * ry;

            const xLeft = x;
            const xCenter = x + w / 2;
            const xRight = x + w;

            const ySideTop = y + ry;
            const yCurveTop = ySideTop - ry;
            const ySideBottom = y + h - ry;
            const yCurveBottom = y + h;

            const data = [
              'M',
              xLeft,
              ySideTop,
              'L',
              xLeft,
              ySideBottom,
              'C',
              x,
              ySideBottom + cy,
              xCenter - cx,
              yCurveBottom,
              xCenter,
              yCurveBottom,
              'C',
              xCenter + cx,
              yCurveBottom,
              xRight,
              ySideBottom + cy,
              xRight,
              ySideBottom,
              'L',
              xRight,
              ySideTop,
              'C',
              xRight,
              ySideTop - cy,
              xCenter + cx,
              yCurveTop,
              xCenter,
              yCurveTop,
              'C',
              xCenter - cx,
              yCurveTop,
              xLeft,
              ySideTop - cy,
              xLeft,
              ySideTop,
              'Z',
            ];

            return { d: data.join(' ') };
          },
        },
      },
    });
  }

  // Register custom actor shape (rectangular with standard styling)
  if (!registeredShapes.has('actor')) {
    registeredShapes.add('actor');
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
          strokeWidth: DFD_STYLING.NODES.ACTOR.STROKE_WIDTH,
          stroke: DFD_STYLING.NODES.ACTOR.STROKE,
          fill: DFD_STYLING.NODES.ACTOR.FILL,
          rx: 0,
          ry: 0,
        },
        text: {
          refX: '50%',
          refY: '50%',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
          fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
          fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
        },
      },
    });
  }

  // Register custom process shape (rounded rectangle per DFD3 spec)
  if (!registeredShapes.has('process')) {
    registeredShapes.add('process');
    Shape.Rect.define({
      shape: 'process',
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
          strokeWidth: DFD_STYLING.NODES.PROCESS.STROKE_WIDTH,
          stroke: DFD_STYLING.NODES.PROCESS.STROKE,
          fill: DFD_STYLING.NODES.PROCESS.FILL,
          rx: 10,
          ry: 10,
        },
        text: {
          refX: '50%',
          refY: '50%',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
          fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
          fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
        },
      },
    });
  }

  // Register custom security boundary shape (dashed rectangular border)
  if (!registeredShapes.has('security-boundary')) {
    registeredShapes.add('security-boundary');
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
          strokeWidth: DFD_STYLING.NODES.SECURITY_BOUNDARY.STROKE_WIDTH,
          stroke: DFD_STYLING.NODES.SECURITY_BOUNDARY.STROKE,
          fill: DFD_STYLING.NODES.SECURITY_BOUNDARY.FILL,
          strokeDasharray: DFD_STYLING.NODES.SECURITY_BOUNDARY.STROKE_DASHARRAY,
          rx: 10,
          ry: 10,
        },
        text: {
          refX: '50%',
          refY: '50%',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
          fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
          fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
        },
      },
    });
  }

  // Register custom text-box shape (transparent background, text only)
  if (!registeredShapes.has('text-box')) {
    registeredShapes.add('text-box');
    Shape.Rect.define({
      shape: 'text-box',
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
          stroke: DFD_STYLING.NODES.TEXT_BOX.STROKE,
          strokeWidth: DFD_STYLING.NODES.TEXT_BOX.STROKE_WIDTH,
          fill: DFD_STYLING.NODES.TEXT_BOX.FILL,
        },
        text: {
          refX: '50%',
          refY: '50%',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
          fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
          fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
        },
      },
    });
  }
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
    case 'text-box':
      return 'text-box'; // Use custom shape for text-box
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
      stroke: DFD_STYLING.EDGES.STROKE,
      strokeWidth: DFD_STYLING.EDGES.STROKE_WIDTH,
      targetMarker: {
        name: DFD_STYLING.EDGES.TARGET_MARKER.NAME,
        size: DFD_STYLING.EDGES.TARGET_MARKER.SIZE,
        fill: DFD_STYLING.EDGES.TARGET_MARKER.FILL,
        stroke: DFD_STYLING.EDGES.TARGET_MARKER.STROKE,
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
          stroke: DFD_STYLING.EDGES.TRUST_BOUNDARY.STROKE,
          strokeWidth: DFD_STYLING.EDGES.TRUST_BOUNDARY.STROKE_WIDTH,
          strokeDasharray: DFD_STYLING.EDGES.TRUST_BOUNDARY.STROKE_DASHARRAY,
          targetMarker: {
            ...baseAttrs.line.targetMarker,
            fill: DFD_STYLING.EDGES.TRUST_BOUNDARY.MARKER_FILL,
            stroke: DFD_STYLING.EDGES.TRUST_BOUNDARY.MARKER_STROKE,
          },
        },
      };
    case 'control-flow':
      return {
        ...baseAttrs,
        line: {
          ...baseAttrs.line,
          stroke: DFD_STYLING.EDGES.CONTROL_FLOW.STROKE,
          strokeWidth: DFD_STYLING.EDGES.CONTROL_FLOW.STROKE_WIDTH,
          strokeDasharray: DFD_STYLING.EDGES.CONTROL_FLOW.STROKE_DASHARRAY,
          targetMarker: {
            ...baseAttrs.line.targetMarker,
            fill: DFD_STYLING.EDGES.CONTROL_FLOW.MARKER_FILL,
            stroke: DFD_STYLING.EDGES.CONTROL_FLOW.MARKER_STROKE,
          },
        },
      };
    default:
      return baseAttrs;
  }
}
