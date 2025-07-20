/**
 * Visual attributes for a node
 * Matches the NodeAttrs schema from the OpenAPI specification
 */
export interface NodeAttrs {
  /**
   * Body/shape styling attributes
   */
  body?: {
    /**
     * Fill color
     */
    fill?: string;

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

    /**
     * Font weight
     */
    fontWeight?: string | number;

    /**
     * Text alignment
     */
    textAnchor?: 'start' | 'middle' | 'end';

    /**
     * Vertical text alignment
     */
    dominantBaseline?: 'auto' | 'middle' | 'central' | 'text-top' | 'text-bottom';
  };
}

/**
 * Default node attributes
 */
export const DEFAULT_NODE_ATTRS: NodeAttrs = {
  body: {
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 2,
  },
  text: {
    text: '',
    fontSize: 14,
    fill: '#000000',
    fontFamily: 'Arial, sans-serif',
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  },
};

/**
 * Creates default node attributes for a specific node type
 */
export function createDefaultNodeAttrs(nodeType: string, label?: string): NodeAttrs {
  const attrs: NodeAttrs = {
    body: { ...DEFAULT_NODE_ATTRS.body },
    text: { ...DEFAULT_NODE_ATTRS.text, text: label || '' },
  };

  // Customize based on node type
  switch (nodeType) {
    case 'actor':
      attrs.body!.fill = '#e8f4fd';
      attrs.body!.stroke = '#1f77b4';
      break;
    case 'process':
      attrs.body!.fill = '#fff7e6';
      attrs.body!.stroke = '#ff7f0e';
      break;
    case 'store':
      attrs.body!.fill = '#e8f5e8';
      attrs.body!.stroke = '#2ca02c';
      break;
    case 'security-boundary':
      attrs.body!.fill = '#ffeaea';
      attrs.body!.stroke = '#d62728';
      attrs.body!.strokeDasharray = '5,5';
      break;
    case 'text-box':
      attrs.body!.fill = 'transparent';
      attrs.body!.stroke = 'transparent';
      attrs.text!.fontSize = 12;
      break;
  }

  return attrs;
}