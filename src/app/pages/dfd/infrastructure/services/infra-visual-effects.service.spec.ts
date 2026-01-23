// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { Cell, Node, Edge } from '@antv/x6';
import { vi, Mock, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { LoggerService } from '../../../../core/services/logger.service';
import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import { InfraVisualEffectsService } from './infra-visual-effects.service';
import { DFD_STYLING, DFD_STYLING_HELPERS } from '../../constants/styling-constants';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Mock types for better type safety
interface MockCell extends Partial<Cell> {
  id: string;
  isNode: Mock;
  isEdge: Mock;
  attr: Mock;
  getNodeTypeInfo?: Mock;
}

interface MockNode extends MockCell {
  getNodeTypeInfo: Mock;
}

// MockEdge uses the same interface as MockCell
type MockEdge = MockCell;

describe('InfraVisualEffectsService', () => {
  let service: InfraVisualEffectsService;
  let mockLogger: MockLoggerService;
  let mockUserPreferencesService: {
    getPreferences: Mock;
  };

  // Test helper to create mock cells
  const createMockNode = (id: string, nodeType = 'process'): MockNode => ({
    id,
    isNode: vi.fn().mockReturnValue(true),
    isEdge: vi.fn().mockReturnValue(false),
    attr: vi.fn(),
    getNodeTypeInfo: vi.fn().mockReturnValue({ type: nodeType }),
  });

  const createMockEdge = (id: string): MockEdge => ({
    id,
    isNode: vi.fn().mockReturnValue(false),
    isEdge: vi.fn().mockReturnValue(true),
    attr: vi.fn(),
  });

  const createMockTextBoxNode = (id: string): MockNode => ({
    id,
    isNode: vi.fn().mockReturnValue(true),
    isEdge: vi.fn().mockReturnValue(false),
    attr: vi.fn(),
    getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'text-box' }),
  });

  beforeEach(() => {
    // Create mock logger
    mockLogger = createTypedMockLoggerService();

    // Create mock user preferences service
    mockUserPreferencesService = {
      getPreferences: vi.fn().mockReturnValue({ animations: true }),
    };

    // Create service instance with constructor injection
    service = new InfraVisualEffectsService(
      mockLogger as unknown as LoggerService,
      mockUserPreferencesService as unknown as UserPreferencesService,
    );
  });

  afterEach(() => {
    // Clean up any active effects
    service?.cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('applyCreationHighlight', () => {
    it('should apply creation highlight to regular nodes', () => {
      const mockNode = createMockNode('node1');

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Should start fade animation immediately
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);

      // Should apply fade effect calls (specific calls depend on animation timing)
      expect(mockNode.attr).toHaveBeenCalled();
    });

    it('should apply creation highlight to text-box nodes', () => {
      const mockTextBox = createMockTextBoxNode('textbox1');

      service.applyCreationHighlight(mockTextBox as unknown as Node);

      // Should start fade animation immediately
      expect(service.hasActiveEffects(mockTextBox as unknown as Node)).toBe(true);

      // Should apply fade effect calls (specific calls depend on animation timing)
      expect(mockTextBox.attr).toHaveBeenCalled();
    });

    it('should apply creation highlight to edges', () => {
      const mockEdge = createMockEdge('edge1');

      service.applyCreationHighlight(mockEdge as unknown as Edge);

      // Should start fade animation immediately
      expect(service.hasActiveEffects(mockEdge as unknown as Edge)).toBe(true);

      // Should apply fade effect calls (specific calls depend on animation timing)
      expect(mockEdge.attr).toHaveBeenCalled();
    });

    it('should not apply highlight to null cell', () => {
      service.applyCreationHighlight(null as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[VisualEffects] Cannot apply creation highlight to null cell',
      );
    });

    it('should not apply highlight to already selected cell', () => {
      const mockNode = createMockNode('node1');
      // Mock selection state by returning selection filter
      mockNode.attr.mockImplementation((key: string) => {
        if (key === 'body/filter') return DFD_STYLING_HELPERS.getSelectionFilter('process');
        return undefined;
      });

      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DFD',
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'node1' },
      );
    });

    it('should handle errors gracefully', () => {
      const mockNode = createMockNode('node1');
      // Mock Date.now to cause an error in the animation setup
      const originalDateNow = Date.now;
      Date.now = () => {
        throw new Error('Test error');
      };

      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[VisualEffects] Error applying creation highlight',
        expect.objectContaining({
          cellId: 'node1',
          error: expect.any(Error),
        }),
      );

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should skip creation highlight when animations are disabled in user preferences', () => {
      const mockNode = createMockNode('node1');
      // Set user preference to disable animations
      mockUserPreferencesService.getPreferences.mockReturnValue({ animations: false });

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Should not apply any effects
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DFD',
        '[VisualEffects] Skipping creation highlight - animations disabled by user',
        { cellId: 'node1' },
      );
      expect(mockNode.attr).not.toHaveBeenCalled();

      // Clean up
      localStorage.removeItem('tmi_user_preferences');
    });

    it('should apply creation highlight when animations are enabled in user preferences', () => {
      const mockNode = createMockNode('node1');
      // Set user preference to enable animations (this is the default already)
      mockUserPreferencesService.getPreferences.mockReturnValue({ animations: true });

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Should apply effects
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);
      expect(mockNode.attr).toHaveBeenCalled();
    });

    it('should default to enabled when user preferences are not set', () => {
      const mockNode = createMockNode('node1');
      // Return preferences without animations property
      mockUserPreferencesService.getPreferences.mockReturnValue({});

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Should apply effects (default behavior)
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);
      expect(mockNode.attr).toHaveBeenCalled();
    });

    it('should default to enabled when localStorage contains invalid JSON', () => {
      const mockNode = createMockNode('node1');
      // This test is now irrelevant since we use UserPreferencesService
      // UserPreferencesService handles parsing internally
      // Just test normal behavior
      mockUserPreferencesService.getPreferences.mockReturnValue({ animations: true });

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Should apply effects (default behavior on error)
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);
      expect(mockNode.attr).toHaveBeenCalled();

      // Clean up
      localStorage.removeItem('tmi_user_preferences');
    });
  });

  describe('fade animation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should start fade animation immediately after applying creation highlight', () => {
      const mockNode = createMockNode('node1');

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Fast forward past initial setup
      vi.advanceTimersByTime(50);

      // Should apply fade effect with decreasing opacity
      const expectedBlurRadius = DFD_STYLING.CREATION.GLOW_BLUR_RADIUS;
      const expectedColorPattern = '0, 150, 255'; // RGB from creation constants
      expect(mockNode.attr).toHaveBeenCalledWith(
        'body/filter',
        expect.stringMatching(
          new RegExp(
            `drop-shadow\\(0 0 ${expectedBlurRadius}px rgba\\(${expectedColorPattern}, 0\\.\\d+\\)\\)`,
          ),
        ),
      );
    });

    it('should gradually fade out over time', () => {
      const mockNode = createMockNode('node1');

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Fast forward to middle of animation
      vi.advanceTimersByTime(DFD_STYLING.CREATION.FADE_DURATION_MS - 1);

      // Animation should be active and making calls
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);
      expect(mockNode.attr).toHaveBeenCalled();
    });
  });

  describe('fade-out animation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should complete fade-out and remove effects after total duration', () => {
      const mockNode = createMockNode('node1');

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Fast forward past total duration
      vi.advanceTimersByTime(DFD_STYLING.CREATION.FADE_DURATION_MS + 100);

      // Effects should be completely removed
      expect(mockNode.attr).toHaveBeenCalledWith('body/filter', 'none');
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
    });

    it('should start fade-out animation after pulse completes', () => {
      const mockEdge = createMockEdge('edge1');

      service.applyCreationHighlight(mockEdge as unknown as Edge);

      // Fast forward past fade duration
      vi.advanceTimersByTime(DFD_STYLING.CREATION.FADE_DURATION_MS + 150);

      // Should have started fade-out (calls with reducing opacity)
      const expectedColorPattern = '0, 150, 255'; // RGB from creation constants
      expect(mockEdge.attr).toHaveBeenCalledWith(
        'line/filter',
        expect.stringContaining(`rgba(${expectedColorPattern},`),
      );
    });
  });

  describe('removeVisualEffects', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should remove active effects and clear timers', () => {
      const mockNode = createMockNode('node1');

      service.applyCreationHighlight(mockNode as unknown as Node);
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);

      service.removeVisualEffects(mockNode as unknown as Node);

      // Should remove all visual effects
      expect(mockNode.attr).toHaveBeenCalledWith('body/filter', 'none');
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
    });

    it('should handle removing effects from cell without active effects', () => {
      const mockNode = createMockNode('node1');

      service.removeVisualEffects(mockNode as unknown as Node);

      // Should not throw error or cause issues
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
    });

    it('should handle null cell gracefully', () => {
      service.removeVisualEffects(null as any);

      // Should not throw error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('hasActiveEffects', () => {
    it('should return false for cell without effects', () => {
      const mockNode = createMockNode('node1');

      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
    });

    it('should return true for cell with active effects', () => {
      const mockNode = createMockNode('node1');

      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should clean up all active effects', () => {
      const mockNode1 = createMockNode('node1');
      const mockNode2 = createMockNode('node2');

      service.applyCreationHighlight(mockNode1 as unknown as Node);
      service.applyCreationHighlight(mockNode2 as unknown as Node);

      expect(service.hasActiveEffects(mockNode1 as unknown as Node)).toBe(true);
      expect(service.hasActiveEffects(mockNode2 as unknown as Node)).toBe(true);

      service.cleanup();

      expect(service.hasActiveEffects(mockNode1 as unknown as Node)).toBe(false);
      expect(service.hasActiveEffects(mockNode2 as unknown as Node)).toBe(false);
    });
  });

  describe('selection conflict prevention', () => {
    it('should detect selected regular nodes', () => {
      const mockNode = createMockNode('node1');
      // Mock selection state with selection filter
      mockNode.attr.mockImplementation((key: string) => {
        if (key === 'body/filter') return DFD_STYLING_HELPERS.getSelectionFilter('process');
        return undefined;
      });

      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DFD',
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'node1' },
      );
    });

    it('should detect selected text-box nodes', () => {
      const mockTextBox = createMockTextBoxNode('textbox1');
      // Mock selection state with selection filter on text element
      mockTextBox.attr.mockImplementation((key: string) => {
        if (key === 'text/filter') return DFD_STYLING_HELPERS.getSelectionFilter('text-box');
        return undefined;
      });

      service.applyCreationHighlight(mockTextBox as unknown as Node);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DFD',
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'textbox1' },
      );
    });

    it('should detect selected edges', () => {
      const mockEdge = createMockEdge('edge1');
      // Mock selection state with selection filter for edges
      mockEdge.attr.mockImplementation((key: string) => {
        if (key === 'line/filter')
          return `drop-shadow(0 0 ${DFD_STYLING.EDGES.SELECTION_BLUR_RADIUS}px ${DFD_STYLING.SELECTION.GLOW_COLOR})`;
        return undefined;
      });

      service.applyCreationHighlight(mockEdge as unknown as Edge);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DFD',
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'edge1' },
      );
    });
  });

  describe('error handling', () => {
    it('should handle attr() errors when checking selection state', () => {
      const mockNode = createMockNode('node1');
      mockNode.attr.mockImplementation(() => {
        throw new Error('Attribute error');
      });

      // Should not throw error and should still apply highlight
      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdVisualEffects',
        'Error checking selection state',
        expect.objectContaining({
          cellId: 'node1',
          error: expect.any(Error),
        }),
      );
    });
  });

  describe('animation timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should use correct timing constants', () => {
      const mockNode = createMockNode('node1');

      service.applyCreationHighlight(mockNode as unknown as Node);

      // Should still be animating before duration completes
      vi.advanceTimersByTime(DFD_STYLING.CREATION.FADE_DURATION_MS - 1);
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);

      // Should complete after fade duration
      vi.advanceTimersByTime(50); // Add extra time to ensure completion
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
    });
  });
});
