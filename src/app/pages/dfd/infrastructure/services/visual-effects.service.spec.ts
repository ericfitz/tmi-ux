import { Cell, Node, Edge } from '@antv/x6';
import { vi, Mock, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { LoggerService } from '../../../../core/services/logger.service';
import { VisualEffectsService } from './visual-effects.service';

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

describe('VisualEffectsService', () => {
  let service: VisualEffectsService;
  let mockLogger: Partial<LoggerService>;

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
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Create service directly with mock logger
    service = new VisualEffectsService(mockLogger as LoggerService);
  });

  afterEach(() => {
    // Clean up any active effects
    service.cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('applyCreationHighlight', () => {
    it('should apply creation highlight to regular nodes', () => {
      const mockNode = createMockNode('node1');
      
      service.applyCreationHighlight(mockNode as unknown as Node);

      // Should apply initial blue glow effect to body
      expect(mockNode.attr).toHaveBeenCalledWith('body/filter', 'drop-shadow(0 0 12px rgba(0, 150, 255, 0.9))');
      expect(mockNode.attr).toHaveBeenCalledWith('body/strokeWidth', 4);
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);
    });

    it('should apply creation highlight to text-box nodes', () => {
      const mockTextBox = createMockTextBoxNode('textbox1');
      
      service.applyCreationHighlight(mockTextBox as unknown as Node);

      // Should apply initial blue glow effect to text element
      expect(mockTextBox.attr).toHaveBeenCalledWith('text/filter', 'drop-shadow(0 0 12px rgba(0, 150, 255, 0.9))');
      expect(service.hasActiveEffects(mockTextBox as unknown as Node)).toBe(true);
    });

    it('should apply creation highlight to edges', () => {
      const mockEdge = createMockEdge('edge1');
      
      service.applyCreationHighlight(mockEdge as unknown as Edge);

      // Should apply initial blue glow effect to line
      expect(mockEdge.attr).toHaveBeenCalledWith('line/filter', 'drop-shadow(0 0 10px rgba(0, 150, 255, 0.9))');
      expect(mockEdge.attr).toHaveBeenCalledWith('line/strokeWidth', 4);
      expect(service.hasActiveEffects(mockEdge as unknown as Edge)).toBe(true);
    });

    it('should not apply highlight to null cell', () => {
      service.applyCreationHighlight(null as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[VisualEffects] Cannot apply creation highlight to null cell'
      );
    });

    it('should not apply highlight to already selected cell', () => {
      const mockNode = createMockNode('node1');
      // Mock selection state by returning red filter (indicates selection)
      mockNode.attr.mockImplementation((key: string) => {
        if (key === 'body/filter') return 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))';
        return undefined;
      });
      
      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'node1' }
      );
    });

    it('should handle errors gracefully', () => {
      const mockNode = createMockNode('node1');
      mockNode.attr.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[VisualEffects] Error applying creation highlight',
        expect.objectContaining({
          cellId: 'node1',
          error: expect.any(Error),
        })
      );
    });
  });

  describe('pulse animation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should start pulse animation after applying creation highlight', () => {
      const mockNode = createMockNode('node1');
      
      service.applyCreationHighlight(mockNode as unknown as Node);

      // Fast forward past initial setup
      vi.advanceTimersByTime(50);

      // Pulse should modulate the filter intensity
      expect(mockNode.attr).toHaveBeenCalledWith(
        'body/filter',
        expect.stringMatching(/drop-shadow\(0 0 \d+px rgba\(0, 150, 255, 0\.\d+\)\)/)
      );
    });

    it('should transition from pulse to fade-out after pulse duration', () => {
      const mockNode = createMockNode('node1');
      
      service.applyCreationHighlight(mockNode as unknown as Node);

      // Fast forward past pulse duration (600ms)
      vi.advanceTimersByTime(650);

      // Should start fade-out phase
      expect(mockNode.attr).toHaveBeenCalledWith(
        'body/filter',
        expect.stringMatching(/rgba\(0, 150, 255, 0\.[0-6]\)/)
      );
    });
  });

  describe('fade-out animation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should complete fade-out and remove effects after total duration', () => {
      const mockNode = createMockNode('node1');
      
      service.applyCreationHighlight(mockNode as unknown as Node);

      // Fast forward past total duration (1000ms)
      vi.advanceTimersByTime(1100);

      // Effects should be completely removed
      expect(mockNode.attr).toHaveBeenCalledWith('body/filter', 'none');
      expect(mockNode.attr).toHaveBeenCalledWith('body/strokeWidth', 2);
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
    });

    it('should start fade-out animation after pulse completes', () => {
      const mockEdge = createMockEdge('edge1');
      
      service.applyCreationHighlight(mockEdge as unknown as Edge);

      // Fast forward past pulse duration
      vi.advanceTimersByTime(650);

      // Should have started fade-out (calls with reducing opacity)
      expect(mockEdge.attr).toHaveBeenCalledWith(
        'line/filter',
        expect.stringContaining('rgba(0, 150, 255,')
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
      expect(mockNode.attr).toHaveBeenCalledWith('body/strokeWidth', 2);
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
      // Mock selection state with red glow filter
      mockNode.attr.mockImplementation((key: string) => {
        if (key === 'body/filter') return 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))';
        return undefined;
      });
      
      service.applyCreationHighlight(mockNode as unknown as Node);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'node1' }
      );
    });

    it('should detect selected text-box nodes', () => {
      const mockTextBox = createMockTextBoxNode('textbox1');
      // Mock selection state with red glow filter on text element
      mockTextBox.attr.mockImplementation((key: string) => {
        if (key === 'text/filter') return 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))';
        return undefined;
      });
      
      service.applyCreationHighlight(mockTextBox as unknown as Node);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'textbox1' }
      );
    });

    it('should detect selected edges', () => {
      const mockEdge = createMockEdge('edge1');
      // Mock selection state with red glow filter
      mockEdge.attr.mockImplementation((key: string) => {
        if (key === 'line/filter') return 'drop-shadow(0 0 6px rgba(255, 0, 0, 0.8))';
        return undefined;
      });
      
      service.applyCreationHighlight(mockEdge as unknown as Edge);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        { cellId: 'edge1' }
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

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[VisualEffects] Error checking selection state',
        expect.objectContaining({
          cellId: 'node1',
          error: expect.any(Error),
        })
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

      // Should start fade-out after pulse duration (600ms)
      vi.advanceTimersByTime(599);
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(true);
      
      vi.advanceTimersByTime(2); // 601ms total
      // Fade-out should have started
      
      // Should complete after total duration (1000ms)
      vi.advanceTimersByTime(400); // 1001ms total
      expect(service.hasActiveEffects(mockNode as unknown as Node)).toBe(false);
    });
  });
});