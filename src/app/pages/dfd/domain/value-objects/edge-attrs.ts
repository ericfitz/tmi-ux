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
   * Text/label styling attributes (deprecated - use labels array instead)
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
    stroke: '#808080',
    strokeWidth: 1,
    targetMarker: {
      name: 'classic',
      size: 8,
      fill: '#808080',
      stroke: '#808080',
    },
  },
};

/**
 * Creates default edge attributes
 */
export function createDefaultEdgeAttrs(edgeType: string = 'edge'): EdgeAttrs {
  const attrs: EdgeAttrs = {
    line: { ...DEFAULT_EDGE_ATTRS.line },
  };

  // Customize based on edge type if needed
  switch (edgeType) {
    case 'data-flow':
      attrs.line!.stroke = '#2ca02c';
      attrs.line!.strokeWidth = 2;
      break;
    case 'control-flow':
      attrs.line!.stroke = '#d62728';
      attrs.line!.strokeDasharray = '3,3';
      break;
    case 'trust-boundary':
      attrs.line!.stroke = '#ff7f0e';
      attrs.line!.strokeWidth = 3;
      attrs.line!.strokeDasharray = '10,5';
      break;
  }

  return attrs;
}
