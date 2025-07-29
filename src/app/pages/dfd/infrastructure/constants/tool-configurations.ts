/**
 * Shared X6 Tool Configurations for DFD Components
 *
 * These constants define the standard tool configurations used across
 * the DFD component infrastructure for consistent visual feedback and
 * interaction behavior.
 */

/**
 * Standard node tools configuration
 * Used for node selection, manipulation, and deletion
 */
export const NODE_TOOLS = [
  {
    name: 'button-remove',
    args: {
      x: '100%',
      y: 0,
      offset: { x: -10, y: 10 },
    },
  },
  {
    name: 'boundary',
    args: {
      padding: 5,
      attrs: {
        fill: 'none',
        stroke: '#fe854f',
        'stroke-width': 2,
        'stroke-dasharray': '5,5',
        'pointer-events': 'none',
      },
    },
  },
] as const;

/**
 * Standard edge tools configuration
 * Used for edge manipulation, vertex editing, and deletion
 */
export const EDGE_TOOLS = [
  {
    name: 'vertices',
    args: {
      attrs: {
        body: {
          fill: '#fe854f',
          stroke: '#fe854f',
          'stroke-width': 2,
          r: 5,
          cursor: 'move',
        },
      },
      addable: true,
      removable: true,
      snapRadius: 10,
      threshold: 40,
      stopPropagation: false,
      useCellGeometry: true,
    },
  },
  {
    name: 'source-arrowhead',
    args: {
      attrs: {
        fill: '#31d0c6',
        stroke: '#31d0c6',
        'stroke-width': 2,
        r: 6,
        cursor: 'move',
      },
      tagName: 'circle',
      stopPropagation: false,
    },
  },
  {
    name: 'target-arrowhead',
    args: {
      attrs: {
        fill: '#fe854f',
        stroke: '#fe854f',
        'stroke-width': 2,
        r: 6,
        cursor: 'move',
      },
      tagName: 'circle',
      stopPropagation: false,
    },
  },
  {
    name: 'button-remove',
    args: {
      distance: 0.5,
      offset: { x: 10, y: -10 },
    },
  },
] as const;
