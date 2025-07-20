/**
 * DFD Tool Configuration Constants
 * 
 * Centralized tool configuration for X6 tools used in DFD components.
 * These constants define the exact configuration for node and edge tools
 * to ensure consistency between implementation and testing.
 */

/**
 * Tool configuration for nodes when selected
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
 * Tool configuration for edges when selected
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

/**
 * Combined tool configuration
 */
export const TOOL_CONFIG = {
  NODE_TOOLS,
  EDGE_TOOLS,
  
  // Tool-specific constants
  COLORS: {
    REMOVE_BUTTON: '#ff4d4f',
    SOURCE_ARROWHEAD: '#4C9AFF', 
    TARGET_ARROWHEAD: '#FF7452',
    BOUNDARY: '#000',
    VERTEX: '#ffffff',
  },
  
  SIZES: {
    REMOVE_BUTTON_RADIUS: 8,
    ARROWHEAD_RADIUS: 6,
    VERTEX_RADIUS: 4,
  },
  
  POSITIONING: {
    REMOVE_BUTTON_OFFSET: { x: -10, y: 10 },
    EDGE_REMOVE_DISTANCE: '50%',
  },
  
  STYLING: {
    BOUNDARY_DASHARRAY: '2,4',
    STROKE_WIDTH: 2,
    VERTEX_STROKE_WIDTH: 1,
  },
} as const;

/**
 * Type definitions for tool configurations
 */
export type NodeToolConfig = typeof NODE_TOOLS[number];
export type EdgeToolConfig = typeof EDGE_TOOLS[number];
export type ToolConfig = typeof TOOL_CONFIG;

/**
 * Helper functions for tool operations
 */
export const TOOL_HELPERS = {
  /**
   * Get tools configuration for a specific cell type
   */
  getToolsForCellType(cellType: 'node' | 'edge'): readonly any[] {
    return cellType === 'node' ? NODE_TOOLS : EDGE_TOOLS;
  },
  
  /**
   * Get specific tool configuration by name
   */
  getToolByName(toolName: string, cellType: 'node' | 'edge'): NodeToolConfig | EdgeToolConfig | undefined {
    const tools = cellType === 'node' ? NODE_TOOLS : EDGE_TOOLS;
    return tools.find(tool => tool.name === toolName);
  },
  
  /**
   * Check if a tool name is valid for a cell type
   */
  isValidTool(toolName: string, cellType: 'node' | 'edge'): boolean {
    const tools = cellType === 'node' ? NODE_TOOLS : EDGE_TOOLS;
    return tools.some(tool => tool.name === toolName);
  },
} as const;