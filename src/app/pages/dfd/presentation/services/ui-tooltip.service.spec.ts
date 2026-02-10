// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiTooltipService } from './ui-tooltip.service';
import type { LoggerService } from '@app/core/services/logger.service';
import type { Cell, Node } from '@antv/x6';

describe('UiTooltipService', () => {
  let service: UiTooltipService;
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock LoggerService
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    // Instantiate service with mock dependency
    service = new UiTooltipService(mockLogger as unknown as LoggerService);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('getPortTooltipContent()', () => {
    it('should return port label text when port has text attribute', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue({
          id: 'port-1',
          attrs: {
            text: {
              text: 'Input Data',
            },
          },
        }),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('Input Data');
      expect(mockNode.getPort).toHaveBeenCalledWith('port-1');
    });

    it('should return port ID when port has no label', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue({
          id: 'port-1',
          attrs: {},
        }),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('port-1');
    });

    it('should return port ID when port has empty label', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue({
          id: 'port-1',
          attrs: {
            text: {
              text: '   ',
            },
          },
        }),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('port-1');
    });

    it('should return port ID when port not found', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue(null),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('port-1');
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdTooltip',
        'Port object not found',
        { nodeId: 'node-1', portId: 'port-1' },
      );
    });

    it('should return empty string when node is null', () => {
      const result = service.getPortTooltipContent(null as unknown as Node, 'port-1');

      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[TooltipService] Invalid input for port tooltip',
        { node: false, portId: 'port-1' },
      );
    });

    it('should return empty string when portId is empty', () => {
      const mockNode = {
        id: 'node-1',
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, '');

      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockImplementation(() => {
          throw new Error('Port access error');
        }),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('port-1');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[TooltipService] Error getting port tooltip content',
        expect.any(Error),
      );
    });

    it('should extract label from port attrs label attribute', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue({
          id: 'port-1',
          attrs: {
            label: 'Port Label',
          },
        }),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('Port Label');
    });

    it('should extract label from port attrs title attribute', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue({
          id: 'port-1',
          attrs: {
            title: 'Port Title',
          },
        }),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('Port Title');
    });

    it('should extract nested text from label object', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue({
          id: 'port-1',
          attrs: {
            label: {
              text: 'Nested Label Text',
            },
          },
        }),
      } as unknown as Node;

      const result = service.getPortTooltipContent(mockNode, 'port-1');

      expect(result).toBe('Nested Label Text');
    });

    it('should log debug info when tooltip content is generated', () => {
      const mockNode = {
        id: 'node-1',
        getPort: vi.fn().mockReturnValue({
          id: 'port-1',
          attrs: {
            text: {
              text: 'Data Flow',
            },
          },
        }),
      } as unknown as Node;

      service.getPortTooltipContent(mockNode, 'port-1');

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdTooltip',
        'Generated port tooltip content',
        {
          nodeId: 'node-1',
          portId: 'port-1',
          content: 'Data Flow',
        },
      );
    });
  });

  describe('calculateTooltipPosition()', () => {
    beforeEach(() => {
      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });
    });

    it('should calculate position with default offsets', () => {
      const mouseEvent = { clientX: 100, clientY: 200 } as MouseEvent;

      const position = service.calculateTooltipPosition(mouseEvent);

      expect(position).toEqual({ x: 110, y: 170 });
    });

    it('should calculate position with custom offsets', () => {
      const mouseEvent = { clientX: 100, clientY: 200 } as MouseEvent;

      const position = service.calculateTooltipPosition(mouseEvent, { offsetX: 20, offsetY: -40 });

      expect(position).toEqual({ x: 120, y: 160 });
    });

    it('should adjust X position when tooltip would go off right edge', () => {
      const mouseEvent = { clientX: 900, clientY: 200 } as MouseEvent;

      const position = service.calculateTooltipPosition(mouseEvent);

      // Should flip to left side: 900 - 200 - 10 = 690
      expect(position.x).toBeLessThan(900);
      expect(position.x).toBe(690);
    });

    it('should adjust Y position when tooltip would go off top edge', () => {
      const mouseEvent = { clientX: 100, clientY: 10 } as MouseEvent;

      const position = service.calculateTooltipPosition(mouseEvent);

      // Should move below cursor: 10 + 30 = 40
      expect(position.y).toBeGreaterThan(10);
      expect(position.y).toBe(40);
    });

    it('should adjust Y position when tooltip would go off bottom edge', () => {
      const mouseEvent = { clientX: 100, clientY: 780 } as MouseEvent;

      const position = service.calculateTooltipPosition(mouseEvent);

      // Initial: 780 - 30 = 750
      // Check: 750 + 30 = 780 > 768? Yes
      // Adjust: 780 - 30 - 30 = 720
      expect(position.y).toBeLessThan(780);
      expect(position.y).toBe(720);
    });

    it('should handle tooltip at screen edges', () => {
      const mouseEvent = { clientX: 0, clientY: 0 } as MouseEvent;

      const position = service.calculateTooltipPosition(mouseEvent);

      // Should apply default offset even at edges
      expect(position.x).toBe(10);
      expect(position.y).toBe(30); // Adjusted for top edge
    });
  });

  describe('formatTooltipContent()', () => {
    it('should trim whitespace', () => {
      const result = service.formatTooltipContent('  Hello World  ');

      expect(result).toBe('Hello World');
    });

    it('should truncate long content', () => {
      const longContent = 'A'.repeat(100);

      const result = service.formatTooltipContent(longContent, 50);

      expect(result).toBe('A'.repeat(47) + '...');
      expect(result.length).toBe(50);
    });

    it('should replace multiple spaces with single space', () => {
      const result = service.formatTooltipContent('Hello    World   Test');

      expect(result).toBe('Hello World Test');
    });

    it('should return empty string for null input', () => {
      const result = service.formatTooltipContent(null as unknown as string);

      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = service.formatTooltipContent(undefined as unknown as string);

      expect(result).toBe('');
    });

    it('should return empty string for non-string input', () => {
      const result = service.formatTooltipContent(123 as unknown as string);

      expect(result).toBe('');
    });

    it('should handle content shorter than max length', () => {
      const result = service.formatTooltipContent('Short', 50);

      expect(result).toBe('Short');
    });

    it('should use default max length of 50', () => {
      const longContent = 'A'.repeat(100);

      const result = service.formatTooltipContent(longContent);

      expect(result.length).toBe(50);
    });
  });

  describe('shouldShowTooltip()', () => {
    it('should return true for valid content', () => {
      const result = service.shouldShowTooltip('Valid tooltip text');

      expect(result).toBe(true);
    });

    it('should return false for very short content', () => {
      expect(service.shouldShowTooltip('A')).toBe(false);
      expect(service.shouldShowTooltip('AB')).toBe(false);
    });

    it('should return true for content with exactly 3 characters', () => {
      const result = service.shouldShowTooltip('ABC');

      expect(result).toBe(true);
    });

    it('should return false for empty string', () => {
      const result = service.shouldShowTooltip('');

      expect(result).toBe(false);
    });

    it('should return false for whitespace-only string', () => {
      const result = service.shouldShowTooltip('   ');

      expect(result).toBe(false);
    });

    it('should return false for null', () => {
      const result = service.shouldShowTooltip(null as unknown as string);

      expect(result).toBe(false);
    });

    it('should return false for undefined', () => {
      const result = service.shouldShowTooltip(undefined as unknown as string);

      expect(result).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(service.shouldShowTooltip(123 as unknown as string)).toBe(false);
      expect(service.shouldShowTooltip({} as unknown as string)).toBe(false);
    });

    it('should trim whitespace before checking length', () => {
      expect(service.shouldShowTooltip('  A  ')).toBe(false);
      expect(service.shouldShowTooltip('  ABC  ')).toBe(true);
    });
  });

  describe('getNodeTooltipContent()', () => {
    it('should return node type and label when label exists', () => {
      const mockNode = {
        id: 'node-1',
        getLabel: vi.fn().mockReturnValue('Database Server'),
        getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'process' }),
      } as unknown as Node;

      const result = service.getNodeTooltipContent(mockNode);

      expect(result).toBe('process: Database Server');
    });

    it('should return node type and ID when label is empty', () => {
      const mockNode = {
        id: 'node-1',
        getLabel: vi.fn().mockReturnValue(''),
        getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'data-store' }),
      } as unknown as Node;

      const result = service.getNodeTooltipContent(mockNode);

      expect(result).toBe('data-store (node-1)');
    });

    it('should return node type and ID when label is whitespace', () => {
      const mockNode = {
        id: 'node-1',
        getLabel: vi.fn().mockReturnValue('   '),
        getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'external-entity' }),
      } as unknown as Node;

      const result = service.getNodeTooltipContent(mockNode);

      expect(result).toBe('external-entity (node-1)');
    });

    it('should handle missing getLabel method', () => {
      const mockNode = {
        id: 'node-1',
        getNodeTypeInfo: vi.fn().mockReturnValue({ type: 'process' }),
      } as unknown as Node;

      const result = service.getNodeTooltipContent(mockNode);

      expect(result).toBe('process (node-1)');
    });

    it('should use "unknown" type when getNodeTypeInfo returns no type', () => {
      const mockNode = {
        id: 'node-1',
        getLabel: vi.fn().mockReturnValue('Node Label'),
        getNodeTypeInfo: vi.fn().mockReturnValue({}),
      } as unknown as Node;

      const result = service.getNodeTooltipContent(mockNode);

      expect(result).toBe('unknown: Node Label');
    });

    it('should return empty string when node is null', () => {
      const result = service.getNodeTooltipContent(null as unknown as Node);

      expect(result).toBe('');
    });

    it('should handle errors gracefully', () => {
      const mockNode = {
        id: 'node-1',
        getLabel: vi.fn().mockImplementation(() => {
          throw new Error('Label access error');
        }),
        getNodeTypeInfo: vi.fn(),
      } as unknown as Node;

      const result = service.getNodeTooltipContent(mockNode);

      expect(result).toBe('Node: node-1');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[TooltipService] Error getting node tooltip content',
        expect.any(Error),
      );
    });
  });

  describe('getCellMetadataTooltipContent()', () => {
    it('should return formatted metadata when cell has metadata', () => {
      const mockCell = {
        getData: vi.fn().mockReturnValue({
          _metadata: [
            { key: 'threat', value: 'SQL Injection' },
            { key: 'severity', value: 'High' },
          ],
        }),
      } as unknown as Cell;

      const result = service.getCellMetadataTooltipContent(mockCell);

      expect(result).toBe('threat : SQL Injection\nseverity : High');
    });

    it('should return null when cell has no metadata', () => {
      const mockCell = {
        getData: vi.fn().mockReturnValue({}),
      } as unknown as Cell;

      const result = service.getCellMetadataTooltipContent(mockCell);

      expect(result).toBeNull();
    });

    it('should return null when metadata is empty array', () => {
      const mockCell = {
        getData: vi.fn().mockReturnValue({ _metadata: [] }),
      } as unknown as Cell;

      const result = service.getCellMetadataTooltipContent(mockCell);

      expect(result).toBeNull();
    });

    it('should return null when cell is null', () => {
      const result = service.getCellMetadataTooltipContent(null as unknown as Cell);

      expect(result).toBeNull();
    });

    it('should return null when getData returns null', () => {
      const mockCell = {
        getData: vi.fn().mockReturnValue(null),
      } as unknown as Cell;

      const result = service.getCellMetadataTooltipContent(mockCell);

      expect(result).toBeNull();
    });

    it('should handle getData throwing error gracefully', () => {
      const mockCell = {
        getData: vi.fn().mockImplementation(() => {
          throw new Error('data error');
        }),
      } as unknown as Cell;

      const result = service.getCellMetadataTooltipContent(mockCell);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[TooltipService] Error getting cell metadata tooltip content',
        expect.any(Error),
      );
    });

    it('should format single metadata entry', () => {
      const mockCell = {
        getData: vi.fn().mockReturnValue({
          _metadata: [{ key: 'status', value: 'reviewed' }],
        }),
      } as unknown as Cell;

      const result = service.getCellMetadataTooltipContent(mockCell);

      expect(result).toBe('status : reviewed');
    });
  });
});
