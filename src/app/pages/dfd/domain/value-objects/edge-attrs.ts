/**
 * Visual attributes for an edge
 * Matches the EdgeAttrs schema from the OpenAPI specification
 */
export interface EdgeAttrs {
  /**
   * Line/path styling attributes
   */
  line?: {
    /**
     * Stroke color
     */
    stroke?: string;

    /**
     * Stroke width in pixels
     */
    strokeWidth?: number;

    /**
     * Dash pattern for strokes
     */
    strokeDasharray?: string | null;

    /**
     * Target marker (arrowhead) configuration
     */
    targetMarker?: {
      /**
       * Marker type name
       */
      name?: string;

      /**
       * Marker size
       */
      size?: number;

      /**
       * Marker fill color
       */
      fill?: string;

      /**
       * Marker stroke color
       */
      stroke?: string;
    };

    /**
     * Source marker configuration
     */
    sourceMarker?: {
      /**
       * Marker type name
       */
      name?: string;

      /**
       * Marker size
       */
      size?: number;

      /**
       * Marker fill color
       */
      fill?: string;

      /**
       * Marker stroke color
       */
      stroke?: string;
    };
  };

  /**
   * Text/label styling attributes
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
  };
}
