/**
 * Styling Verification Helpers for DFD Integration Tests
 * 
 * This module provides comprehensive styling verification utilities for testing
 * DFD graph components with real X6 objects. All verification uses dynamic
 * constants rather than hardcoded values to ensure maintainability.
 */

import { Cell, Node, Edge } from '@antv/x6';
import { DFD_STYLING, DFD_STYLING_HELPERS, NodeType } from '../../constants/styling-constants';
import { TOOL_HELPERS } from '../../constants/tool-constants';

/**
 * Main styling verification class with static methods for testing
 */
export class StylingVerifier {
  /**
   * Verify a cell has default (clean) styling with no visual effects
   * This is critical for verifying restored cells after undo operations
   */
  static verifyCleanStyling(cell: Cell, nodeType: NodeType | 'edge'): void {
    if (nodeType === 'edge') {
      this.verifyCleanEdgeStyling(cell as Edge);
    } else {
      this.verifyCleanNodeStyling(cell as Node, nodeType);
    }
    
    // Verify no tools are present
    expect(cell.hasTools()).toBe(false);
  }
  
  /**
   * Verify a node has clean default styling
   */
  static verifyCleanNodeStyling(node: Node, nodeType: NodeType): void {
    // Verify shape-specific defaults
    const expectedStroke = DFD_STYLING_HELPERS.getDefaultStroke(nodeType);
    const expectedStrokeWidth = DFD_STYLING_HELPERS.getDefaultStrokeWidth(nodeType);
    const expectedFill = DFD_STYLING_HELPERS.getDefaultFill(nodeType);
    
    expect(node.attr('body/stroke')).toBe(expectedStroke);
    expect(node.attr('body/strokeWidth')).toBe(expectedStrokeWidth);
    expect(node.attr('body/fill')).toBe(expectedFill);
    
    // Verify no filter effects based on node type
    if (nodeType === 'text-box') {
      // Verify no text filter effects
      expect(node.attr('text/filter')).toBeOneOf(['none', undefined, null, '']);
    } else {
      // Verify no body filter effects
      expect(node.attr('body/filter')).toBeOneOf(['none', undefined, null, '']);
    }
    
    // Verify security boundary specific styling
    if (nodeType === 'security-boundary') {
      expect(node.attr('body/strokeDasharray')).toBe(DFD_STYLING.NODES.SECURITY_BOUNDARY.STROKE_DASHARRAY);
    }
  }
  
  /**
   * Verify an edge has clean default styling
   */
  static verifyCleanEdgeStyling(edge: Edge): void {
    // Verify default edge styling
    expect(edge.attr('line/stroke')).toBe(DFD_STYLING.EDGES.DEFAULT_STROKE);
    expect(edge.attr('line/strokeWidth')).toBe(DFD_STYLING.DEFAULT_STROKE_WIDTH);
    
    // Verify no filter effects
    expect(edge.attr('line/filter')).toBeOneOf(['none', undefined, null, '']);
  }
  
  /**
   * Verify a cell has correct selection styling applied
   */
  static verifySelectionStyling(cell: Cell, nodeType: NodeType | 'edge'): void {
    if (nodeType === 'edge') {
      this.verifyEdgeSelectionStyling(cell as Edge);
    } else {
      this.verifyNodeSelectionStyling(cell as Node, nodeType);
    }
  }
  
  /**
   * Verify a node has correct selection styling
   */
  static verifyNodeSelectionStyling(node: Node, nodeType: NodeType): void {
    const expectedFilter = DFD_STYLING_HELPERS.getSelectionFilter(nodeType);
    
    if (nodeType === 'text-box') {
      // Text-box nodes apply selection effects to text element
      expect(node.attr('text/filter')).toBe(expectedFilter);
    } else {
      // Regular nodes apply selection effects to body element
      expect(node.attr('body/filter')).toBe(expectedFilter);
      expect(node.attr('body/strokeWidth')).toBe(DFD_STYLING.SELECTION.STROKE_WIDTH);
    }
  }
  
  /**
   * Verify an edge has correct selection styling
   */
  static verifyEdgeSelectionStyling(edge: Edge): void {
    const expectedFilter = DFD_STYLING_HELPERS.getSelectionFilter('edge');
    expect(edge.attr('line/filter')).toBe(expectedFilter);
    expect(edge.attr('line/strokeWidth')).toBe(DFD_STYLING.SELECTION.STROKE_WIDTH);
  }
  
  /**
   * Verify a cell has correct hover styling applied
   */
  static verifyHoverStyling(cell: Cell, nodeType: NodeType | 'edge'): void {
    const expectedFilter = DFD_STYLING_HELPERS.getHoverFilter(nodeType);
    
    if (nodeType === 'edge') {
      expect(cell.attr('line/filter')).toBe(expectedFilter);
    } else if (nodeType === 'text-box') {
      expect(cell.attr('text/filter')).toBe(expectedFilter);
    } else {
      expect(cell.attr('body/filter')).toBe(expectedFilter);
    }
  }
  
  /**
   * Verify a cell has correct creation effect styling with specific opacity
   */
  static verifyCreationEffect(cell: Cell, nodeType: NodeType | 'edge', expectedOpacity: number): void {
    const expectedFilter = DFD_STYLING_HELPERS.getCreationFilter(expectedOpacity);
    
    if (DFD_STYLING_HELPERS.shouldUseNoneFilter(expectedOpacity)) {
      // For very low opacity, expect 'none' filter
      const filterAttr = DFD_STYLING_HELPERS.getFilterAttribute(nodeType);
      expect(cell.attr(filterAttr)).toBeOneOf(['none', undefined, null, '']);
    } else {
      // For visible opacity, expect creation filter
      if (nodeType === 'edge') {
        expect(cell.attr('line/filter')).toBe(expectedFilter);
      } else {
        const filterAttr = DFD_STYLING_HELPERS.getFilterAttribute(nodeType);
        expect(cell.attr(filterAttr)).toBe(expectedFilter);
      }
    }
  }
  
  /**
   * Verify a cell has the correct tools applied
   */
  static verifyToolsPresent(cell: Cell, cellType: 'node' | 'edge'): void {
    expect(cell.hasTools()).toBe(true);
    
    const expectedTools = TOOL_HELPERS.getToolsForCellType(cellType);
    const actualTools = cell.getTools();
    
    // Verify minimum expected tools are present (implementation may add additional tools)
    expect(actualTools.items.length).toBeGreaterThanOrEqual(expectedTools.length);
    
    // Verify each expected tool is present
    expectedTools.forEach(expectedTool => {
      const foundTool = actualTools.items.find((tool: any) => tool.name === expectedTool.name);
      expect(foundTool).toBeDefined();
      expect(foundTool.name).toBe(expectedTool.name);
    });
  }
  
  /**
   * Verify a specific tool is present with correct configuration
   */
  static verifySpecificTool(cell: Cell, toolName: string, cellType: 'node' | 'edge'): void {
    const actualTools = cell.getTools();
    const foundTool = actualTools.items.find((tool: any) => tool.name === toolName);
    
    expect(foundTool).toBeDefined();
    expect(foundTool.name).toBe(toolName);
    
    // Verify tool configuration matches constants
    const expectedTool = TOOL_HELPERS.getToolByName(toolName, cellType);
    expect(expectedTool).toBeDefined();
    
    // Compare key configuration properties
    if (expectedTool?.args) {
      Object.keys(expectedTool.args).forEach(key => {
        if (foundTool.options?.[key] !== undefined) {
          expect(foundTool.options[key]).toEqual(expectedTool.args[key]);
        }
      });
    }
  }
  
  /**
   * Verify Z-index values match expected constants
   */
  static verifyZIndex(cell: Cell, nodeType: NodeType | 'edge'): void {
    const actualZIndex = cell.getZIndex();
    
    if (nodeType === 'security-boundary') {
      expect(actualZIndex).toBe(DFD_STYLING.Z_ORDER.SECURITY_BOUNDARY_DEFAULT);
    } else if (nodeType === 'edge') {
      // Edges should inherit from connected nodes, verify it's not default
      expect(actualZIndex).toBeGreaterThanOrEqual(DFD_STYLING.Z_ORDER.NODE_DEFAULT);
    } else {
      expect(actualZIndex).toBe(DFD_STYLING.Z_ORDER.NODE_DEFAULT);
    }
  }
  
  /**
   * Verify port configuration matches constants
   */
  static verifyPortConfiguration(node: Node): void {
    const ports = node.getPorts();
    
    // Verify port count
    expect(ports).toHaveLength(DFD_STYLING.NODES.PORTS.COUNT);
    
    // Verify port positions
    const portIds = ports.map(port => port.id);
    DFD_STYLING.NODES.PORTS.POSITIONS.forEach(position => {
      expect(portIds).toContain(position);
    });
    
    // Verify port styling
    ports.forEach(port => {
      const portElement = node.getPortNode(port.id!);
      if (portElement) {
        // Check port styling attributes
        const circle = portElement.querySelector('circle');
        if (circle) {
          expect(circle.getAttribute('r')).toBe(DFD_STYLING.PORTS.RADIUS.toString());
          expect(circle.getAttribute('stroke')).toBe(DFD_STYLING.PORTS.STROKE);
          expect(circle.getAttribute('fill')).toBe(DFD_STYLING.PORTS.FILL);
        }
      }
    });
  }
  
  /**
   * Verify default node styling matches constants
   */
  static verifyDefaultNodeStyling(node: Node, nodeType: NodeType): void {
    // Verify basic styling
    this.verifyCleanNodeStyling(node, nodeType);
    
    // Verify Z-index
    this.verifyZIndex(node, nodeType);
    
    // Verify port configuration
    this.verifyPortConfiguration(node);
    
    // Verify font properties
    expect(node.attr('text/fontFamily')).toBe(DFD_STYLING.TEXT_FONT_FAMILY);
    expect(node.attr('text/fontSize')).toBe(DFD_STYLING.DEFAULT_FONT_SIZE);
  }
  
  /**
   * Verify default edge styling matches constants
   */
  static verifyDefaultEdgeStyling(edge: Edge): void {
    // Verify basic styling
    this.verifyCleanEdgeStyling(edge);
    
    // Verify edge-specific properties
    expect(edge.attr('line/sourceMarker/name')).toBe(DFD_STYLING.EDGES.ARROWHEAD);
    expect(edge.getLabelAt(0)?.attrs?.text?.text).toBe(DFD_STYLING.EDGES.DEFAULT_LABEL);
  }
}

/**
 * Test utility functions for common operations
 */
export class TestHelpers {
  /**
   * Get node type from a cell (with fallback)
   */
  static getNodeTypeFromCell(cell: Cell): NodeType | 'edge' {
    if (cell.isEdge()) return 'edge';
    
    // Try to get node type from cell properties
    const nodeTypeInfo = (cell as any).getNodeTypeInfo?.();
    return nodeTypeInfo?.type || 'unknown';
  }
  
  /**
   * Wait for animation to complete
   */
  static async waitForAnimationComplete(durationMs: number = DFD_STYLING.CREATION.FADE_DURATION_MS): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, durationMs + 50));
  }
  
  /**
   * Wait for a specific number of animation frames
   */
  static async waitForAnimationFrames(frameCount: number): Promise<void> {
    const frameTime = DFD_STYLING.CREATION.ANIMATION_FRAME_INTERVAL;
    return new Promise(resolve => setTimeout(resolve, frameTime * frameCount + 10));
  }
  
  /**
   * Create a mock event for testing interactions
   */
  static createMockEvent(type: string, properties: Record<string, any> = {}): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, properties);
    return event;
  }
}

/**
 * Custom Jest matchers for styling verification
 */
declare global {
  interface Matchers<R> {
    toBeOneOf(expected: any[]): R;
  }
}

// Extend expect with custom matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of ${expected.join(', ')}`,
      pass,
    };
  },
});