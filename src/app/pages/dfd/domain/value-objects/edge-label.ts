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
