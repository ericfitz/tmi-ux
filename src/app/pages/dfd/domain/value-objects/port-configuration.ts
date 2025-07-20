/**
 * Port configuration for node connections
 * Matches the PortConfiguration schema from the OpenAPI specification
 */
export interface PortConfiguration {
  /**
   * Port group definitions
   */
  groups?: {
    [groupName: string]: {
      /**
       * Position of ports in this group
       */
      position?: string;

      /**
       * Port styling attributes
       */
      attrs?: {
        circle?: {
          fill?: string;
          stroke?: string;
          strokeWidth?: number;
          r?: number;
        };
        rect?: {
          fill?: string;
          stroke?: string;
          strokeWidth?: number;
          width?: number;
          height?: number;
        };
      };

      /**
       * Port markup configuration
       */
      markup?: Array<{
        tagName: string;
        attrs?: Record<string, unknown>;
      }>;

      /**
       * Port label configuration
       */
      label?: {
        position?: string;
        attrs?: {
          text?: {
            text?: string;
            fontSize?: number;
            fill?: string;
            fontFamily?: string;
          };
        };
      };
    };
  };

  /**
   * Individual port items
   */
  items?: Array<{
    /**
     * Unique port identifier
     */
    id: string;

    /**
     * Port group this port belongs to
     */
    group?: string;

    /**
     * Port-specific attributes (overrides group attributes)
     */
    attrs?: Record<string, unknown>;

    /**
     * Port label
     */
    label?: {
      text?: string;
      position?: string;
    };

    /**
     * Port arguments for positioning
     */
    args?: Record<string, unknown>;
  }>;
}

/**
 * Default port configuration for different node types
 */
export const DEFAULT_PORT_CONFIGURATIONS: Record<string, PortConfiguration> = {
  actor: {
    groups: {
      in: {
        position: 'left',
        attrs: {
          circle: {
            fill: '#ffffff',
            stroke: '#1f77b4',
            strokeWidth: 2,
            r: 4,
          },
        },
      },
      out: {
        position: 'right',
        attrs: {
          circle: {
            fill: '#ffffff',
            stroke: '#1f77b4',
            strokeWidth: 2,
            r: 4,
          },
        },
      },
    },
    items: [
      { id: 'left', group: 'in' },
      { id: 'right', group: 'out' },
    ],
  },
  process: {
    groups: {
      in: {
        position: 'left',
        attrs: {
          circle: {
            fill: '#ffffff',
            stroke: '#ff7f0e',
            strokeWidth: 2,
            r: 4,
          },
        },
      },
      out: {
        position: 'right',
        attrs: {
          circle: {
            fill: '#ffffff',
            stroke: '#ff7f0e',
            strokeWidth: 2,
            r: 4,
          },
        },
      },
    },
    items: [
      { id: 'left', group: 'in' },
      { id: 'right', group: 'out' },
    ],
  },
  store: {
    groups: {
      in: {
        position: 'left',
        attrs: {
          circle: {
            fill: '#ffffff',
            stroke: '#2ca02c',
            strokeWidth: 2,
            r: 4,
          },
        },
      },
      out: {
        position: 'right',
        attrs: {
          circle: {
            fill: '#ffffff',
            stroke: '#2ca02c',
            strokeWidth: 2,
            r: 4,
          },
        },
      },
    },
    items: [
      { id: 'left', group: 'in' },
      { id: 'right', group: 'out' },
    ],
  },
  'security-boundary': {
    groups: {
      all: {
        position: 'top',
        attrs: {
          circle: {
            fill: '#ffffff',
            stroke: '#d62728',
            strokeWidth: 2,
            r: 3,
          },
        },
      },
    },
    items: [
      { id: 'top', group: 'all' },
      { id: 'right', group: 'all' },
      { id: 'bottom', group: 'all' },
      { id: 'left', group: 'all' },
    ],
  },
  'text-box': {
    // Text boxes typically don't have visible ports
    groups: {},
    items: [],
  },
};

/**
 * Creates default port configuration for a specific node type
 */
export function createDefaultPortConfiguration(nodeType: string): PortConfiguration {
  return DEFAULT_PORT_CONFIGURATIONS[nodeType] || DEFAULT_PORT_CONFIGURATIONS['process'];
}

/**
 * Creates a simple port configuration with basic input/output ports
 */
export function createSimplePortConfiguration(): PortConfiguration {
  return {
    groups: {
      in: { position: 'left' },
      out: { position: 'right' },
    },
    items: [
      { id: 'left', group: 'in' },
      { id: 'right', group: 'out' },
    ],
  };
}