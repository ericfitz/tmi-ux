/**
 * DFD Styling Constants
 *
 * This file contains centralized styling constants for DFD components to ensure
 * visual consistency across the entire application and testing infrastructure.
 *
 * Key functionality:
 * - Defines default styling values for nodes, edges, and visual elements
 * - Provides selection and highlighting style configurations
 * - Centralizes color palettes and theming constants
 * - Includes port styling and state-based visual configurations
 * - Defines animation and transition timing constants
 * - Provides font families and typography settings
 * - Includes grid and layout spacing constants
 * - Defines zoom and scale-related styling parameters
 * - Provides accessibility-compliant color contrast ratios
 * - Includes shape-specific styling overrides and templates
 * - Centralizes all hardcoded styling values to prevent inconsistencies
 * - Supports responsive design and mobile-friendly configurations
 */

/**
 * Color blind color palette (Okabe-Ito)
 *
 * Sources:
 * https://www.thedataschool.co.uk/miles-cumiskey/accessible-color-tableau/
 * https://jfly.uni-koeln.de/html/manuals/pdf/color_blind.pdf
 * https://davidmathlogic.com/colorblind/
 *
 * Black          rgb(0,0,0)
 * Orange         rgb(230,159,0)
 * Sky Blue       rgb(86,180,233)
 * bluish Green   rgb(0,158,115)
 * Yellow         rgb(240,228,66)
 * Blue           rgb(0,114,178)
 * Vermilion      rgb(213,94,0)
 * reddish Purple rgb(204,121,167)
 *
 */

/**
 * Default styling values used across all DFD components
 */
export const DFD_STYLING = {
  // Base stroke and fill properties - these represent the most common defaults
  // Note: individual shapes may override these in their shape definitions
  DEFAULT_STROKE: '#000000',
  DEFAULT_STROKE_WIDTH: 2,
  DEFAULT_FILL: '#FFFFFF',
  DEFAULT_FONT_SIZE: 12,
  TEXT_FONT_FAMILY: "'Roboto Condensed', Arial, sans-serif",
  ICON_FONT_FAMILY: 'Material Symbols Outlined',

  // Raw color values (only used within this constants file)
  _COLORS: {
    WHITE: '#ffffff',
    BLACK: '#000000',
    GRAY: '#808080',
    LIGHT_GRAY: '#f5f5f5',
    DARK_GRAY: '#333333',
    RED: '#d62728',
    PURPLE: '#722ED1',
  },

  _STROKE_WIDTHS: {
    THIN: 1,
    NORMAL: 2,
    THICK: 3,
  },

  // Selection styling effects
  SELECTION: {
    STROKE_WIDTH: 2,
    STROKE_COLOR: '#000000',
    GLOW_COLOR: 'rgba(255, 0, 0, 0.8)',
    GLOW_COLOR_PREFIX: 'rgba(255, 0, 0', // Color prefix for filter detection
    GLOW_BLUR_RADIUS: 8,
    FILTER_TEMPLATE: (blur: number, color: string) => `drop-shadow(0 0 ${blur}px ${color})`,
  },

  // Hover effects styling
  HOVER: {
    GLOW_COLOR: 'rgba(255, 0, 0, 0.6)',
    GLOW_BLUR_RADIUS: 4,
    EDGE_GLOW_BLUR_RADIUS: 3, // Edges use slightly smaller hover effect
    FILTER_TEMPLATE: (blur: number, color: string) => `drop-shadow(0 0 ${blur}px ${color})`,
  },

  // Creation highlight effects
  CREATION: {
    GLOW_COLOR: 'rgba(0, 150, 255, 0.9)', // Blue for local operations
    GLOW_COLOR_RGB: { r: 0, g: 150, b: 255 }, // RGB values for local operations
    REMOTE_GLOW_COLOR_RGB: { r: 0, g: 255, b: 0 }, // Green RGB for remote operations
    GLOW_BLUR_RADIUS: 12,
    FADE_DURATION_MS: 500,
    ANIMATION_FRAME_INTERVAL: 16, // ~60fps
    FILTER_TEMPLATE: (blur: number, color: string) => `drop-shadow(0 0 ${blur}px ${color})`,
  },

  // Embedding and highlighting styles for X6 interactions
  HIGHLIGHTING: {
    // Default highlighting (fallback)
    DEFAULT: {
      PADDING: 2,
      STROKE_WIDTH: 2,
      STROKE_COLOR: '#ff0000', // Red
    },

    // Embedding parent highlighting (orange border during drag)
    EMBEDDING: {
      PADDING: 4,
      STROKE_WIDTH: 3,
      STROKE_COLOR: '#ff6b00', // Orange
    },

    // Magnet/port highlighting (when connecting edges)
    MAGNET_AVAILABLE: {
      PADDING: 2,
      STROKE_WIDTH: 2,
      STROKE_COLOR: '#31D06E', // Green
    },

    // When a valid connection is made (magnet adsorbed)
    MAGNET_ADSORBED: {
      PADDING: 3,
      STROKE_WIDTH: 3,
      STROKE_COLOR: '#1890ff', // Blue
    },

    // Invalid embedding feedback (used in visual-effects service)
    INVALID_EMBEDDING: {
      STROKE_WIDTH: 3,
      STROKE_COLOR: '#ff0000', // Red
      DURATION_MS: 300,
    },
  },

  // Node-specific styling constants
  NODES: {
    MIN_WIDTH: 40,
    MIN_HEIGHT: 30,
    DEFAULT_FONT_WEIGHT: 400,

    // Default node appearance (used as fallbacks)
    FILL: '#ffffff',
    STROKE: '#000000',
    STROKE_WIDTH: 1,

    // Default node labels
    LABEL_TEXT_COLOR: '#000000',
    LABEL_BACKGROUND: 'transparent',

    // Shape-specific default styling (matches x6-shape-definitions.ts)
    ACTOR: {
      STROKE: '#000000',
      STROKE_WIDTH: 2,
      FILL: '#FFFFFF',
      DEFAULT_WIDTH: 120,
      DEFAULT_HEIGHT: 60,
    },
    PROCESS: {
      STROKE: '#000000',
      STROKE_WIDTH: 2,
      FILL: '#FFFFFF',
      DEFAULT_WIDTH: 140,
      DEFAULT_HEIGHT: 60,
    },
    STORE: {
      STROKE: '#000000',
      STROKE_WIDTH: 2,
      FILL: '#FFFFFF',
      DEFAULT_WIDTH: 160,
      DEFAULT_HEIGHT: 80,
    },
    SECURITY_BOUNDARY: {
      STROKE: '#000000',
      STROKE_WIDTH: 2,
      FILL: '#FFFFFF',
      STROKE_DASHARRAY: '5,5',
      DEFAULT_Z_INDEX: 1,
      DEFAULT_WIDTH: 200,
      DEFAULT_HEIGHT: 150,
    },
    TEXT_BOX: {
      STROKE: 'none',
      STROKE_WIDTH: 0,
      FILL: 'transparent',
      DEFAULT_WIDTH: 100,
      DEFAULT_HEIGHT: 40,
    },

    // Port configuration for all nodes
    PORTS: {
      COUNT: 4, // top, right, bottom, left
      POSITIONS: ['top', 'right', 'bottom', 'left'] as const,
    },
  },

  // Edge styling constants
  EDGES: {
    DEFAULT_LABEL: 'Flow',
    DEFAULT_STROKE: '#000000', // Used in orchestrator for createEdge
    DEFAULT_STROKE_WIDTH: 2,
    DEFAULT_FILL: 'none',
    ARROWHEAD: 'block',
    CONNECTOR: 'smooth',
    ROUTER: 'normal',
    SELECTION_BLUR_RADIUS: 6, // Edges use different blur radius than nodes

    // Default edge appearance (data-flow style)
    STROKE: '#000000',
    STROKE_WIDTH: 2,
    FILL: 'none',

    // Default edge labels
    LABEL_TEXT_COLOR: '#000000',
    LABEL_BACKGROUND: '#ffffff',
    LABEL_BORDER: '#000000',
    LABEL_BORDER_WIDTH: 1,

    // Target marker (arrowhead) styling
    TARGET_MARKER: {
      NAME: 'classic',
      SIZE: 8,
      FILL: '#000000',
      STROKE: '#000000',
    },

    // Edge type specific styling
    DATA_FLOW: {
      STROKE: '#000000',
      STROKE_WIDTH: 2,
      MARKER_FILL: '#000000',
      MARKER_STROKE: '#000000',
    },
    TRUST_BOUNDARY: {
      STROKE: '#000000',
      STROKE_WIDTH: 2,
      STROKE_DASHARRAY: '5 5',
      MARKER_FILL: '#722ED1',
      MARKER_STROKE: '#000000',
    },
    CONTROL_FLOW: {
      STROKE: '#d62728',
      STROKE_WIDTH: 2,
      STROKE_DASHARRAY: '3,3',
      MARKER_FILL: '#d62728',
      MARKER_STROKE: '#d62728',
    },
  },

  // Port styling properties
  PORTS: {
    RADIUS: 5,
    STROKE: '#000000',
    FILL: '#ffffff',
    STROKE_WIDTH: 1,
    MAGNET: 'active',
  },

  // Z-order management values
  Z_ORDER: {
    SECURITY_BOUNDARY_DEFAULT: 1,
    NODE_DEFAULT: 10,
    EDGE_OFFSET: 0, // Edges inherit from connected nodes
  },

  // Grid and layout settings
  GRID: {
    SIZE: 10,
    VISIBLE: true,
    PRIMARY_COLOR: '#666666',
    SECONDARY_COLOR: '#888888',
  },

  // Canvas background
  CANVAS: {
    BACKGROUND_COLOR: '#f5f5f5', // Light gray background to match toolbar
  },

  // Zoom and pan constraints
  VIEWPORT: {
    MIN_ZOOM: 0.5,
    MAX_ZOOM: 1.25, // Maximum zoom for automatic zoom-to-fit (125%)
    MAX_MANUAL_ZOOM: 3.0, // Maximum zoom for manual zoom (Shift+Wheel) (300%)
    ZOOM_FACTOR: 1.1,
  },

  // Animation and transition settings
  ANIMATIONS: {
    FADE_OPACITY_THRESHOLD: 0.05, // Below this, use 'none' instead of filter
  },

  // Z-Index constants for proper layering
  Z_INDEX: {
    SECURITY_BOUNDARY: 1, // Security boundaries go behind regular nodes
    NODE_DEFAULT: 10, // Default z-index for regular nodes
    TEXT_BOX: 20, // Text boxes appear above regular nodes
    EDGE_DEFAULT: 10, // Default z-index for edges
    SELECTION: 50, // Selection indicators on top
    TOOLS: 100, // Node/edge tools on top of everything
  },
} as const;

// Freeze the constants object to prevent mutations
Object.freeze(DFD_STYLING);

/**
 * Type-safe access to styling constants
 */
export type DfdStyling = typeof DFD_STYLING;

/**
 * Helper functions for common styling operations
 */
export const DFD_STYLING_HELPERS = {
  /**
   * Generate selection filter for a given node type
   */
  getSelectionFilter(nodeType: string): string {
    const blurRadius =
      nodeType === 'edge'
        ? DFD_STYLING.EDGES.SELECTION_BLUR_RADIUS
        : DFD_STYLING.SELECTION.GLOW_BLUR_RADIUS;

    return DFD_STYLING.SELECTION.FILTER_TEMPLATE(blurRadius, DFD_STYLING.SELECTION.GLOW_COLOR);
  },

  /**
   * Generate hover filter for a given node type
   */
  getHoverFilter(nodeType: string): string {
    const blurRadius =
      nodeType === 'edge'
        ? DFD_STYLING.HOVER.EDGE_GLOW_BLUR_RADIUS
        : DFD_STYLING.HOVER.GLOW_BLUR_RADIUS;

    return DFD_STYLING.HOVER.FILTER_TEMPLATE(blurRadius, DFD_STYLING.HOVER.GLOW_COLOR);
  },

  /**
   * Generate creation effect filter with specific opacity
   */
  getCreationFilter(opacity: number): string {
    const color = DFD_STYLING.CREATION.GLOW_COLOR.replace('0.9', opacity.toString());
    return DFD_STYLING.CREATION.FILTER_TEMPLATE(DFD_STYLING.CREATION.GLOW_BLUR_RADIUS, color);
  },

  /**
   * Generate creation effect filter with custom color and opacity
   */
  getCreationFilterWithColor(color: { r: number; g: number; b: number }, opacity: number): string {
    const colorString = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
    return DFD_STYLING.CREATION.FILTER_TEMPLATE(DFD_STYLING.CREATION.GLOW_BLUR_RADIUS, colorString);
  },

  /**
   * Get the appropriate filter attribute path for a node type
   */
  getFilterAttribute(nodeType: string): string {
    return nodeType === 'text-box' ? 'text/filter' : 'body/filter';
  },

  /**
   * Get the appropriate stroke width attribute path for a node type
   */
  getStrokeWidthAttribute(nodeType: string): string {
    return nodeType === 'text-box' ? 'text/strokeWidth' : 'body/strokeWidth';
  },

  /**
   * Check if an opacity value should use 'none' filter
   */
  shouldUseNoneFilter(opacity: number): boolean {
    return opacity <= DFD_STYLING.ANIMATIONS.FADE_OPACITY_THRESHOLD;
  },

  /**
   * Check if a filter string indicates selection styling
   */
  isSelectionFilter(filter: string | null | undefined): boolean {
    return !!(
      filter &&
      typeof filter === 'string' &&
      filter.includes(DFD_STYLING.SELECTION.GLOW_COLOR_PREFIX) &&
      filter.includes('drop-shadow')
    );
  },

  /**
   * Extract selection glow color for comparison
   */
  getSelectionGlowColorPrefix(): string {
    return DFD_STYLING.SELECTION.GLOW_COLOR_PREFIX;
  },

  /**
   * Get remote creation highlight color (green to distinguish from local blue)
   */
  getRemoteCreationColor(): { r: number; g: number; b: number } {
    return DFD_STYLING.CREATION.REMOTE_GLOW_COLOR_RGB;
  },

  /**
   * Get local creation highlight color (blue)
   */
  getLocalCreationColor(): { r: number; g: number; b: number } {
    return DFD_STYLING.CREATION.GLOW_COLOR_RGB;
  },

  /**
   * Get X6 highlighter configuration for embedding (orange border)
   */
  getEmbeddingHighlighter(): {
    name: string;
    args: {
      padding: number;
      attrs: { 'stroke-width': number; stroke: string };
    };
  } {
    return {
      name: 'stroke',
      args: {
        padding: DFD_STYLING.HIGHLIGHTING.EMBEDDING.PADDING,
        attrs: {
          'stroke-width': DFD_STYLING.HIGHLIGHTING.EMBEDDING.STROKE_WIDTH,
          stroke: DFD_STYLING.HIGHLIGHTING.EMBEDDING.STROKE_COLOR,
        },
      },
    };
  },

  /**
   * Get X6 highlighter configuration for magnet availability (green)
   */
  getMagnetAvailableHighlighter(): {
    name: string;
    args: {
      padding: number;
      attrs: { 'stroke-width': number; stroke: string };
    };
  } {
    return {
      name: 'stroke',
      args: {
        padding: DFD_STYLING.HIGHLIGHTING.MAGNET_AVAILABLE.PADDING,
        attrs: {
          'stroke-width': DFD_STYLING.HIGHLIGHTING.MAGNET_AVAILABLE.STROKE_WIDTH,
          stroke: DFD_STYLING.HIGHLIGHTING.MAGNET_AVAILABLE.STROKE_COLOR,
        },
      },
    };
  },

  /**
   * Get X6 highlighter configuration for magnet adsorbed (blue)
   */
  getMagnetAdsorbedHighlighter(): {
    name: string;
    args: {
      padding: number;
      attrs: { 'stroke-width': number; stroke: string };
    };
  } {
    return {
      name: 'stroke',
      args: {
        padding: DFD_STYLING.HIGHLIGHTING.MAGNET_ADSORBED.PADDING,
        attrs: {
          'stroke-width': DFD_STYLING.HIGHLIGHTING.MAGNET_ADSORBED.STROKE_WIDTH,
          stroke: DFD_STYLING.HIGHLIGHTING.MAGNET_ADSORBED.STROKE_COLOR,
        },
      },
    };
  },

  /**
   * Get X6 highlighter configuration for default highlighting (red)
   */
  getDefaultHighlighter(): {
    name: string;
    args: {
      padding: number;
      attrs: { 'stroke-width': number; stroke: string };
    };
  } {
    return {
      name: 'stroke',
      args: {
        padding: DFD_STYLING.HIGHLIGHTING.DEFAULT.PADDING,
        attrs: {
          'stroke-width': DFD_STYLING.HIGHLIGHTING.DEFAULT.STROKE_WIDTH,
          stroke: DFD_STYLING.HIGHLIGHTING.DEFAULT.STROKE_COLOR,
        },
      },
    };
  },

  /**
   * Get default stroke for a specific node type
   */
  getDefaultStroke(nodeType: NodeType): string {
    switch (nodeType) {
      case 'actor':
        return DFD_STYLING.NODES.ACTOR.STROKE;
      case 'process':
        return DFD_STYLING.NODES.PROCESS.STROKE;
      case 'store':
        return DFD_STYLING.NODES.STORE.STROKE;
      case 'security-boundary':
        return DFD_STYLING.NODES.SECURITY_BOUNDARY.STROKE;
      case 'text-box':
        return DFD_STYLING.NODES.TEXT_BOX.STROKE;
      default:
        return DFD_STYLING.DEFAULT_STROKE;
    }
  },

  /**
   * Get default stroke width for a specific node type
   */
  getDefaultStrokeWidth(nodeType: NodeType): number {
    switch (nodeType) {
      case 'actor':
        return DFD_STYLING.NODES.ACTOR.STROKE_WIDTH;
      case 'process':
        return DFD_STYLING.NODES.PROCESS.STROKE_WIDTH;
      case 'store':
        return DFD_STYLING.NODES.STORE.STROKE_WIDTH;
      case 'security-boundary':
        return DFD_STYLING.NODES.SECURITY_BOUNDARY.STROKE_WIDTH;
      case 'text-box':
        return DFD_STYLING.NODES.TEXT_BOX.STROKE_WIDTH;
      default:
        return DFD_STYLING.DEFAULT_STROKE_WIDTH;
    }
  },

  /**
   * Get default fill for a specific node type
   */
  getDefaultFill(nodeType: NodeType): string {
    switch (nodeType) {
      case 'actor':
        return DFD_STYLING.NODES.ACTOR.FILL;
      case 'process':
        return DFD_STYLING.NODES.PROCESS.FILL;
      case 'store':
        return DFD_STYLING.NODES.STORE.FILL;
      case 'security-boundary':
        return DFD_STYLING.NODES.SECURITY_BOUNDARY.FILL;
      case 'text-box':
        return DFD_STYLING.NODES.TEXT_BOX.FILL;
      default:
        return DFD_STYLING.DEFAULT_FILL;
    }
  },

  /**
   * Get default dimensions for a specific node type
   */
  getDefaultDimensions(nodeType: NodeType): { width: number; height: number } {
    switch (nodeType) {
      case 'actor':
        return {
          width: DFD_STYLING.NODES.ACTOR.DEFAULT_WIDTH,
          height: DFD_STYLING.NODES.ACTOR.DEFAULT_HEIGHT,
        };
      case 'process':
        return {
          width: DFD_STYLING.NODES.PROCESS.DEFAULT_WIDTH,
          height: DFD_STYLING.NODES.PROCESS.DEFAULT_HEIGHT,
        };
      case 'store':
        return {
          width: DFD_STYLING.NODES.STORE.DEFAULT_WIDTH,
          height: DFD_STYLING.NODES.STORE.DEFAULT_HEIGHT,
        };
      case 'security-boundary':
        return {
          width: DFD_STYLING.NODES.SECURITY_BOUNDARY.DEFAULT_WIDTH,
          height: DFD_STYLING.NODES.SECURITY_BOUNDARY.DEFAULT_HEIGHT,
        };
      case 'text-box':
        return {
          width: DFD_STYLING.NODES.TEXT_BOX.DEFAULT_WIDTH,
          height: DFD_STYLING.NODES.TEXT_BOX.DEFAULT_HEIGHT,
        };
      default:
        return {
          width: DFD_STYLING.NODES.ACTOR.DEFAULT_WIDTH,
          height: DFD_STYLING.NODES.ACTOR.DEFAULT_HEIGHT,
        };
    }
  },

  /**
   * Get default z-index for a specific node type
   */
  getDefaultZIndex(nodeType: string): number {
    switch (nodeType) {
      case 'security-boundary':
        return DFD_STYLING.Z_INDEX.SECURITY_BOUNDARY;
      case 'text-box':
        return DFD_STYLING.Z_INDEX.TEXT_BOX;
      default:
        return DFD_STYLING.Z_INDEX.NODE_DEFAULT;
    }
  },
} as const;

/**
 * Node type definitions for type safety
 */
export type NodeType = 'actor' | 'process' | 'store' | 'security-boundary' | 'text-box';
export type EdgeType = 'edge';
export type CellType = NodeType | EdgeType;

/**
 * Port position definitions
 */
export type PortPosition = (typeof DFD_STYLING.NODES.PORTS.POSITIONS)[number];
