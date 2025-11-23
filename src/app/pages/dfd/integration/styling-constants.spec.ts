// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

/**
 * DFD Integration Tests - Styling Constants
 *
 * Tests to verify styling constants are correctly defined and helper utilities work.
 * This foundational test ensures all constants and helpers are properly configured
 * before implementing more complex integration tests.
 */

import { describe, it, expect } from 'vitest';
import { DFD_STYLING, DFD_STYLING_HELPERS, NodeType } from '../constants/styling-constants';
import { TOOL_CONFIG, TOOL_HELPERS } from '../constants/tool-constants';
import { StylingVerifier, TestHelpers } from './test-helpers/styling-helpers';

describe('DFD Integration - Styling Constants', () => {
  describe('Styling Constants Validation', () => {
    it('should have all required default styling properties', () => {
      // Verify base styling constants exist and are valid
      expect(DFD_STYLING.DEFAULT_STROKE).toBe('#000000');
      expect(DFD_STYLING.DEFAULT_STROKE_WIDTH).toBe(2);
      expect(DFD_STYLING.DEFAULT_FILL).toBe('#FFFFFF');

      // Verify these are valid CSS values
      expect(typeof DFD_STYLING.DEFAULT_STROKE).toBe('string');
      expect(DFD_STYLING.DEFAULT_STROKE).toMatch(/^#[0-9a-fA-F]{3,6}$/);
      expect(typeof DFD_STYLING.DEFAULT_STROKE_WIDTH).toBe('number');
      expect(DFD_STYLING.DEFAULT_STROKE_WIDTH).toBeGreaterThan(0);
    });

    it('should have valid selection styling constants', () => {
      expect(DFD_STYLING.SELECTION.STROKE_WIDTH).toBe(2);
      expect(DFD_STYLING.SELECTION.STROKE_COLOR).toBe('#000000');
      expect(DFD_STYLING.SELECTION.GLOW_COLOR).toBe('rgba(255, 0, 0, 0.8)');
      expect(DFD_STYLING.SELECTION.GLOW_BLUR_RADIUS).toBe(8);

      // Verify selection color is valid hex
      expect(DFD_STYLING.SELECTION.STROKE_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
      // Verify selection glow color is valid RGBA
      expect(DFD_STYLING.SELECTION.GLOW_COLOR).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);

      // Verify template function works
      expect(typeof DFD_STYLING.SELECTION.FILTER_TEMPLATE).toBe('function');
      const filterResult = DFD_STYLING.SELECTION.FILTER_TEMPLATE(8, 'rgba(255, 0, 0, 0.8)');
      expect(filterResult).toBe('drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');
    });

    it('should have valid hover styling constants', () => {
      expect(DFD_STYLING.HOVER.GLOW_COLOR).toBe('rgba(255, 0, 0, 0.6)');
      expect(DFD_STYLING.HOVER.GLOW_BLUR_RADIUS).toBe(4);

      // Verify hover has lower opacity than selection
      const hoverOpacity = parseFloat(DFD_STYLING.HOVER.GLOW_COLOR.match(/[\d.]+\)$/)?.[0] || '0');
      const selectionOpacity = parseFloat(
        DFD_STYLING.SELECTION.GLOW_COLOR.match(/[\d.]+\)$/)?.[0] || '0',
      );
      expect(hoverOpacity).toBeLessThan(selectionOpacity);
    });

    it('should have valid creation effect constants', () => {
      expect(DFD_STYLING.CREATION.GLOW_COLOR).toBe('rgba(0, 150, 255, 0.9)');
      expect(DFD_STYLING.CREATION.GLOW_BLUR_RADIUS).toBe(12);
      expect(DFD_STYLING.CREATION.FADE_DURATION_MS).toBe(500);
      expect(DFD_STYLING.CREATION.ANIMATION_FRAME_INTERVAL).toBe(16);

      // Verify creation effect is more prominent than selection
      expect(DFD_STYLING.CREATION.GLOW_BLUR_RADIUS).toBeGreaterThan(
        DFD_STYLING.SELECTION.GLOW_BLUR_RADIUS,
      );
    });

    it('should have valid node constants', () => {
      expect(DFD_STYLING.NODES.MIN_WIDTH).toBe(40);
      expect(DFD_STYLING.NODES.MIN_HEIGHT).toBe(30);
      expect(DFD_STYLING.TEXT_FONT_FAMILY).toBe("'Roboto Condensed', Arial, sans-serif");
      expect(DFD_STYLING.ICON_FONT_FAMILY).toBe('Material Symbols Outlined');
      expect(DFD_STYLING.DEFAULT_FONT_SIZE).toBe(12);

      // Verify node type specific constants
      expect(DFD_STYLING.NODES.SECURITY_BOUNDARY.STROKE_DASHARRAY).toBe('5,5');
      expect(DFD_STYLING.NODES.SECURITY_BOUNDARY.DEFAULT_Z_INDEX).toBe(1);
      expect(DFD_STYLING.NODES.TEXT_BOX.FILL).toBe('transparent');

      // Verify port configuration
      expect(DFD_STYLING.NODES.PORTS.COUNT).toBe(4);
      expect(DFD_STYLING.NODES.PORTS.POSITIONS).toEqual(['top', 'right', 'bottom', 'left']);
    });

    it('should have valid edge constants', () => {
      expect(DFD_STYLING.EDGES.DEFAULT_LABEL).toBe('Flow');
      expect(DFD_STYLING.EDGES.DEFAULT_STROKE).toBe('#333');
      expect(DFD_STYLING.EDGES.ARROWHEAD).toBe('block');
      expect(DFD_STYLING.EDGES.CONNECTOR).toBe('smooth');
      expect(DFD_STYLING.EDGES.ROUTER).toBe('normal');
      expect(DFD_STYLING.EDGES.SELECTION_BLUR_RADIUS).toBe(6);

      // Verify edges have different blur radius than nodes
      expect(DFD_STYLING.EDGES.SELECTION_BLUR_RADIUS).toBeLessThan(
        DFD_STYLING.SELECTION.GLOW_BLUR_RADIUS,
      );
    });

    it('should have valid port constants', () => {
      expect(DFD_STYLING.PORTS.RADIUS).toBe(5);
      expect(DFD_STYLING.PORTS.STROKE).toBe('#000');
      expect(DFD_STYLING.PORTS.FILL).toBe('#ffffff');
      expect(DFD_STYLING.PORTS.STROKE_WIDTH).toBe(1);
      expect(DFD_STYLING.PORTS.MAGNET).toBe('active');
    });

    it('should have valid z-order constants', () => {
      expect(DFD_STYLING.Z_ORDER.SECURITY_BOUNDARY_DEFAULT).toBe(1);
      expect(DFD_STYLING.Z_ORDER.NODE_DEFAULT).toBe(10);
      expect(DFD_STYLING.Z_ORDER.EDGE_OFFSET).toBe(0);

      // Verify z-order hierarchy
      expect(DFD_STYLING.Z_ORDER.NODE_DEFAULT).toBeGreaterThan(
        DFD_STYLING.Z_ORDER.SECURITY_BOUNDARY_DEFAULT,
      );
    });

    it('should have valid animation constants', () => {
      expect(DFD_STYLING.ANIMATIONS.FADE_OPACITY_THRESHOLD).toBe(0.05);
      expect(DFD_STYLING.ANIMATIONS.FADE_OPACITY_THRESHOLD).toBeLessThan(0.1);
    });
  });

  describe('Styling Helper Functions', () => {
    it('should generate correct selection filters', () => {
      const selectionFilter = DFD_STYLING_HELPERS.getSelectionFilter('actor');
      expect(selectionFilter).toBe('drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');

      // Should work for any node type
      const textBoxFilter = DFD_STYLING_HELPERS.getSelectionFilter('text-box');
      expect(textBoxFilter).toBe(selectionFilter); // Same filter for all node types
    });

    it('should generate correct hover filters', () => {
      const hoverFilter = DFD_STYLING_HELPERS.getHoverFilter('process');
      expect(hoverFilter).toBe('drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
    });

    it('should generate correct creation filters with opacity', () => {
      const fullOpacityFilter = DFD_STYLING_HELPERS.getCreationFilter(0.9);
      expect(fullOpacityFilter).toBe('drop-shadow(0 0 12px rgba(0, 150, 255, 0.9))');

      const halfOpacityFilter = DFD_STYLING_HELPERS.getCreationFilter(0.5);
      expect(halfOpacityFilter).toBe('drop-shadow(0 0 12px rgba(0, 150, 255, 0.5))');
    });

    it('should return correct filter attributes for node types', () => {
      expect(DFD_STYLING_HELPERS.getFilterAttribute('text-box')).toBe('text/filter');
      expect(DFD_STYLING_HELPERS.getFilterAttribute('actor')).toBe('body/filter');
      expect(DFD_STYLING_HELPERS.getFilterAttribute('process')).toBe('body/filter');
      expect(DFD_STYLING_HELPERS.getFilterAttribute('store')).toBe('body/filter');
      expect(DFD_STYLING_HELPERS.getFilterAttribute('security-boundary')).toBe('body/filter');
    });

    it('should return correct stroke width attributes for node types', () => {
      expect(DFD_STYLING_HELPERS.getStrokeWidthAttribute('text-box')).toBe('text/strokeWidth');
      expect(DFD_STYLING_HELPERS.getStrokeWidthAttribute('actor')).toBe('body/strokeWidth');
      expect(DFD_STYLING_HELPERS.getStrokeWidthAttribute('process')).toBe('body/strokeWidth');
    });

    it('should correctly identify when to use none filter', () => {
      expect(DFD_STYLING_HELPERS.shouldUseNoneFilter(0.04)).toBe(true);
      expect(DFD_STYLING_HELPERS.shouldUseNoneFilter(0.05)).toBe(true);
      expect(DFD_STYLING_HELPERS.shouldUseNoneFilter(0.051)).toBe(false);
      expect(DFD_STYLING_HELPERS.shouldUseNoneFilter(0.1)).toBe(false);
    });
  });

  describe('Tool Configuration Constants', () => {
    it('should have valid node tool configurations', () => {
      expect(TOOL_CONFIG.NODE_TOOLS).toHaveLength(2);

      const buttonRemove = TOOL_CONFIG.NODE_TOOLS.find(tool => tool.name === 'button-remove');
      expect(buttonRemove).toBeDefined();
      expect(buttonRemove?.args.x).toBe('100%');
      expect(buttonRemove?.args.y).toBe(0);

      const boundary = TOOL_CONFIG.NODE_TOOLS.find(tool => tool.name === 'boundary');
      expect(boundary).toBeDefined();
      expect(boundary?.args.attrs['stroke-dasharray']).toBe('5,5');
    });

    it('should have valid edge tool configurations', () => {
      expect(TOOL_CONFIG.EDGE_TOOLS).toHaveLength(4);

      const sourceArrowhead = TOOL_CONFIG.EDGE_TOOLS.find(tool => tool.name === 'source-arrowhead');
      expect(sourceArrowhead).toBeDefined();
      expect(sourceArrowhead?.args.attrs.fill).toBe('#31d0c6');

      const targetArrowhead = TOOL_CONFIG.EDGE_TOOLS.find(tool => tool.name === 'target-arrowhead');
      expect(targetArrowhead).toBeDefined();
      expect(targetArrowhead?.args.attrs.fill).toBe('#fe854f');

      const vertices = TOOL_CONFIG.EDGE_TOOLS.find(tool => tool.name === 'vertices');
      expect(vertices).toBeDefined();
    });

    it('should have valid tool helper functions', () => {
      const nodeTools = TOOL_HELPERS.getToolsForCellType('node');
      expect(nodeTools).toHaveLength(2);

      const edgeTools = TOOL_HELPERS.getToolsForCellType('edge');
      expect(edgeTools).toHaveLength(4);

      const buttonRemoveTool = TOOL_HELPERS.getToolByName('button-remove', 'node');
      expect(buttonRemoveTool).toBeDefined();
      expect(buttonRemoveTool?.name).toBe('button-remove');

      expect(TOOL_HELPERS.isValidTool('button-remove', 'node')).toBe(true);
      expect(TOOL_HELPERS.isValidTool('invalid-tool', 'node')).toBe(false);
    });
  });

  describe('Test Helper Utilities', () => {
    it('should provide utility functions for testing', () => {
      // Verify TestHelpers class exists and has expected methods
      expect(typeof TestHelpers.getNodeTypeFromCell).toBe('function');
      expect(typeof TestHelpers.waitForAnimationComplete).toBe('function');
      expect(typeof TestHelpers.waitForAnimationFrames).toBe('function');
      expect(typeof TestHelpers.createMockEvent).toBe('function');
    });

    it('should create mock events correctly', () => {
      const mockEvent = TestHelpers.createMockEvent('click', { clientX: 100, clientY: 200 });
      expect(mockEvent.type).toBe('click');
      expect((mockEvent as any).clientX).toBe(100);
      expect((mockEvent as any).clientY).toBe(200);
    });

    it('should calculate animation timing correctly', async () => {
      const startTime = Date.now();
      await TestHelpers.waitForAnimationFrames(3);
      const endTime = Date.now();

      const expectedTime = DFD_STYLING.CREATION.ANIMATION_FRAME_INTERVAL * 3;
      const actualTime = endTime - startTime;

      // Allow for some timing variance in test environment
      expect(actualTime).toBeGreaterThanOrEqual(expectedTime - 10);
      expect(actualTime).toBeLessThan(expectedTime + 50);
    });
  });

  describe('StylingVerifier Class', () => {
    it('should provide comprehensive styling verification methods', () => {
      // Verify StylingVerifier has all expected static methods
      expect(typeof StylingVerifier.verifyCleanStyling).toBe('function');
      expect(typeof StylingVerifier.verifySelectionStyling).toBe('function');
      expect(typeof StylingVerifier.verifyHoverStyling).toBe('function');
      expect(typeof StylingVerifier.verifyCreationEffect).toBe('function');
      expect(typeof StylingVerifier.verifyToolsPresent).toBe('function');
      expect(typeof StylingVerifier.verifySpecificTool).toBe('function');
      expect(typeof StylingVerifier.verifyZIndex).toBe('function');
      expect(typeof StylingVerifier.verifyPortConfiguration).toBe('function');
      expect(typeof StylingVerifier.verifyDefaultNodeStyling).toBe('function');
      expect(typeof StylingVerifier.verifyDefaultEdgeStyling).toBe('function');
    });
  });

  describe('Custom Jest Matchers', () => {
    it('should extend expect with toBeOneOf matcher', () => {
      // Test the custom matcher
      expect('none').toBeOneOf(['none', undefined, null, '']);
      expect(undefined).toBeOneOf(['none', undefined, null, '']);
      expect(null).toBeOneOf(['none', undefined, null, '']);
      expect('').toBeOneOf(['none', undefined, null, '']);

      // Should fail for values not in the array
      expect(() => {
        expect('invalid').toBeOneOf(['none', undefined, null, '']);
      }).toThrow();
    });
  });

  describe('Type Safety and Constants Integrity', () => {
    it('should maintain type safety for all constants', () => {
      // Verify constants are immutable at runtime through Object.isFrozen
      expect(Object.isFrozen(DFD_STYLING)).toBe(true);

      // Verify node type definitions
      const validNodeTypes: NodeType[] = [
        'actor',
        'process',
        'store',
        'security-boundary',
        'text-box',
      ];
      validNodeTypes.forEach(nodeType => {
        expect(typeof nodeType).toBe('string');
      });
    });

    it('should have consistent color schemes', () => {
      // Selection and hover should use red colors
      expect(DFD_STYLING.SELECTION.GLOW_COLOR).toContain('255, 0, 0');
      expect(DFD_STYLING.HOVER.GLOW_COLOR).toContain('255, 0, 0');

      // Creation should use blue color
      expect(DFD_STYLING.CREATION.GLOW_COLOR).toContain('0, 150, 255');

      // Tool colors should be distinct
      expect(TOOL_CONFIG.COLORS.SOURCE_ARROWHEAD).not.toBe(TOOL_CONFIG.COLORS.TARGET_ARROWHEAD);
    });
  });
});
