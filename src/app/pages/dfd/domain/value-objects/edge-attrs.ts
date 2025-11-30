import { DFD_STYLING } from '../../constants/styling-constants';

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

/**
 * Default edge attributes
 */
export const DEFAULT_EDGE_ATTRS: EdgeAttrs = {
  line: {
    stroke: DFD_STYLING._COLORS.GRAY,
    strokeWidth: DFD_STYLING._STROKE_WIDTHS.THIN,
    targetMarker: {
      name: DFD_STYLING.EDGES.TARGET_MARKER.NAME,
      size: DFD_STYLING.EDGES.TARGET_MARKER.SIZE,
      fill: DFD_STYLING._COLORS.GRAY,
      stroke: DFD_STYLING._COLORS.GRAY,
    },
  },
};
