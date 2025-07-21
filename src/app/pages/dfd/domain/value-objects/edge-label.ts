import { DFD_STYLING } from '../../constants/styling-constants';

/**
 * Text label positioned along an edge
 * Matches the EdgeLabel schema from the OpenAPI specification
 */
export interface EdgeLabel {
  /**
   * Styling attributes for the label
   */
  attrs?: {
    /**
     * Text styling properties
     */
    text?: {
      /**
       * Label text content
       */
      text?: string;

      /**
       * Font size in pixels
       */
      fontSize?: number;

      /**
       * Text color
       */
      fill?: string;

      /**
       * Font family
       */
      fontFamily?: string;

      /**
       * Font weight
       */
      fontWeight?: string | number;

      /**
       * Text alignment
       */
      textAnchor?: 'start' | 'middle' | 'end';
    };

    /**
     * Background/container styling
     */
    rect?: {
      /**
       * Background fill color
       */
      fill?: string;

      /**
       * Background stroke color
       */
      stroke?: string;

      /**
       * Background stroke width
       */
      strokeWidth?: number;

      /**
       * Corner radius for rounded backgrounds
       */
      rx?: number;

      /**
       * Corner radius for rounded backgrounds
       */
      ry?: number;
    };
  };

  /**
   * Position along the edge (0.0 = start, 1.0 = end)
   */
  position?: number;

  /**
   * Offset from the edge path
   */
  offset?: {
    x?: number;
    y?: number;
  };

  /**
   * Rotation angle in degrees
   */
  angle?: number;

  /**
   * Whether the label should rotate with the edge
   */
  keepGradient?: boolean;

  /**
   * Markup configuration for complex labels
   */
  markup?: Array<{
    tagName: string;
    attrs?: Record<string, unknown>;
  }>;
}

/**
 * Creates a simple edge label with text
 */
export function createSimpleEdgeLabel(
  text: string,
  position: number = 0.5,
  options?: {
    fontSize?: number;
    fill?: string;
    backgroundColor?: string;
  }
): EdgeLabel {
  return {
    attrs: {
      text: {
        text,
        fontSize: options?.fontSize || DFD_STYLING.DEFAULT_FONT_SIZE,
        fill: options?.fill || '#333333',
        fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
        textAnchor: 'middle',
      },
      ...(options?.backgroundColor && {
        rect: {
          fill: options.backgroundColor,
          stroke: '#cccccc',
          strokeWidth: 1,
          rx: 3,
          ry: 3,
        },
      }),
    },
    position,
  };
}

/**
 * Creates an edge label positioned at the start of the edge
 */
export function createStartLabel(text: string, options?: { fontSize?: number; fill?: string }): EdgeLabel {
  return createSimpleEdgeLabel(text, 0.1, options);
}

/**
 * Creates an edge label positioned at the end of the edge
 */
export function createEndLabel(text: string, options?: { fontSize?: number; fill?: string }): EdgeLabel {
  return createSimpleEdgeLabel(text, 0.9, options);
}

/**
 * Creates an edge label positioned at the middle of the edge
 */
export function createMiddleLabel(text: string, options?: { fontSize?: number; fill?: string }): EdgeLabel {
  return createSimpleEdgeLabel(text, 0.5, options);
}