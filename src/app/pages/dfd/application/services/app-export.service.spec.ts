/**
 * Unit tests for AppExportService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-export.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { AppExportService } from './app-export.service';

describe('AppExportService', () => {
  let service: AppExportService;
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockSvgOptimizationService: {
    optimizeForThumbnail: ReturnType<typeof vi.fn>;
    optimizeForExport: ReturnType<typeof vi.fn>;
  };
  let mockGraph: {
    getCells: ReturnType<typeof vi.fn>;
    getCellsBBox: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock logger
    mockLogger = {
      warn: vi.fn(),
      debugComponent: vi.fn(),
    };

    // Create mock SVG optimization service
    mockSvgOptimizationService = {
      optimizeForThumbnail: vi.fn(() => 'base64-thumbnail'),
      optimizeForExport: vi.fn(() => 'optimized-svg'),
    };

    // Create mock graph
    mockGraph = {
      getCells: vi.fn(() => [{ id: 'cell1' }, { id: 'cell2' }]),
      getCellsBBox: vi.fn(() => ({
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      })),
    };

    // Create service with mocks
    service = new AppExportService(mockLogger as any, mockSvgOptimizationService as any);
  });

  afterEach(() => {
    // Service doesn't have ngOnDestroy
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('prepareImageExport()', () => {
    it('should prepare export with default padding', () => {
      const result = service.prepareImageExport(mockGraph as any);

      expect(result).toBeDefined();
      expect(result?.bbox).toEqual({
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      });
      expect(result?.viewBox).toBe('80 80 440 340');
      expect(result?.exportOptions).toEqual({
        padding: 20,
        copyStyles: false,
        preserveAspectRatio: 'xMidYMid meet',
      });
    });

    it('should prepare export with custom padding', () => {
      const result = service.prepareImageExport(mockGraph as any, 50);

      expect(result?.viewBox).toBe('50 50 500 400');
      expect(result?.exportOptions.padding).toBe(50);
    });

    it('should calculate correct viewBox from bounding box', () => {
      mockGraph.getCellsBBox.mockReturnValue({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });

      const result = service.prepareImageExport(mockGraph as any, 10);

      expect(result?.viewBox).toBe('-10 -10 820 620');
    });

    it('should return null if no cells to export', () => {
      mockGraph.getCells.mockReturnValue([]);

      const result = service.prepareImageExport(mockGraph as any);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No cells to export');
    });

    it('should return null if bounding box is not available', () => {
      mockGraph.getCellsBBox.mockReturnValue(null);

      const result = service.prepareImageExport(mockGraph as any);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Could not get bounding box for cells');
    });

    it('should handle invalid viewBox with NaN', () => {
      mockGraph.getCellsBBox.mockReturnValue({
        x: NaN,
        y: 100,
        width: 400,
        height: 300,
      });

      const result = service.prepareImageExport(mockGraph as any);

      expect(result?.viewBox).toBe('');
      expect(result?.exportOptions.viewBox).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid viewBox calculated, falling back without explicit viewBox',
        expect.any(Object),
      );
    });

    it('should handle invalid viewBox with undefined', () => {
      mockGraph.getCellsBBox.mockReturnValue({
        x: 100,
        y: undefined,
        width: 400,
        height: 300,
      });

      const result = service.prepareImageExport(mockGraph as any);

      expect(result?.viewBox).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid viewBox calculated, falling back without explicit viewBox',
        expect.any(Object),
      );
    });

    it('should handle bounding box with string values', () => {
      // Test that numeric strings get concatenated incorrectly, triggering validation failure
      mockGraph.getCellsBBox.mockReturnValue({
        x: 'invalid' as any,
        y: 100,
        width: 400,
        height: 300,
      });

      const result = service.prepareImageExport(mockGraph as any);

      // The viewBox will contain 'NaN' which triggers the validation
      expect(result?.viewBox).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid viewBox calculated, falling back without explicit viewBox',
        expect.any(Object),
      );
    });

    it('should log debug information for valid export', () => {
      service.prepareImageExport(mockGraph as any);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppExportService',
        'Using bounding box approach for SVG export',
        expect.objectContaining({
          bbox: expect.any(Object),
          viewBox: expect.any(String),
          exportOptions: expect.any(Object),
        }),
      );
    });
  });

  describe('processSvg()', () => {
    it('should optimize SVG for export without encoding', () => {
      const svgString = '<svg>test content</svg>';

      const result = service.processSvg(svgString, false);

      expect(result).toBe('optimized-svg');
      expect(mockSvgOptimizationService.optimizeForExport).toHaveBeenCalledWith(
        svgString,
        undefined,
      );
      expect(mockSvgOptimizationService.optimizeForThumbnail).not.toHaveBeenCalled();
    });

    it('should optimize SVG for thumbnail with base64 encoding', () => {
      const svgString = '<svg>test content</svg>';

      const result = service.processSvg(svgString, true);

      expect(result).toBe('base64-thumbnail');
      expect(mockSvgOptimizationService.optimizeForThumbnail).toHaveBeenCalledWith(
        svgString,
        undefined,
      );
      expect(mockSvgOptimizationService.optimizeForExport).not.toHaveBeenCalled();
    });

    it('should pass optimal viewBox to export optimizer', () => {
      const svgString = '<svg>test content</svg>';
      const viewBox = '0 0 800 600';

      service.processSvg(svgString, false, viewBox);

      expect(mockSvgOptimizationService.optimizeForExport).toHaveBeenCalledWith(svgString, viewBox);
    });

    it('should pass optimal viewBox to thumbnail optimizer', () => {
      const svgString = '<svg>test content</svg>';
      const viewBox = '0 0 800 600';

      service.processSvg(svgString, true, viewBox);

      expect(mockSvgOptimizationService.optimizeForThumbnail).toHaveBeenCalledWith(
        svgString,
        viewBox,
      );
    });

    it('should handle empty SVG string', () => {
      const result = service.processSvg('', false);

      expect(mockSvgOptimizationService.optimizeForExport).toHaveBeenCalledWith('', undefined);
      expect(result).toBe('optimized-svg');
    });

    it('should handle complex SVG with multiple elements', () => {
      const complexSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
          <rect x="0" y="0" width="100" height="100" fill="red" />
          <circle cx="50" cy="50" r="25" fill="blue" />
          <text x="10" y="20">Test</text>
        </svg>
      `;

      const result = service.processSvg(complexSvg, false);

      expect(mockSvgOptimizationService.optimizeForExport).toHaveBeenCalledWith(
        complexSvg,
        undefined,
      );
      expect(result).toBe('optimized-svg');
    });
  });

  describe('Export Options', () => {
    it('should set copyStyles to false', () => {
      const result = service.prepareImageExport(mockGraph as any);

      expect(result?.exportOptions.copyStyles).toBe(false);
    });

    it('should set preserveAspectRatio to xMidYMid meet', () => {
      const result = service.prepareImageExport(mockGraph as any);

      expect(result?.exportOptions.preserveAspectRatio).toBe('xMidYMid meet');
    });

    it('should not include viewBox in export options', () => {
      const result = service.prepareImageExport(mockGraph as any);

      // viewBox should not be in exportOptions to avoid duplicates
      expect(result?.exportOptions.viewBox).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-width bounding box', () => {
      mockGraph.getCellsBBox.mockReturnValue({
        x: 100,
        y: 100,
        width: 0,
        height: 300,
      });

      const result = service.prepareImageExport(mockGraph as any, 10);

      expect(result?.viewBox).toBe('90 90 20 320');
    });

    it('should handle zero-height bounding box', () => {
      mockGraph.getCellsBBox.mockReturnValue({
        x: 100,
        y: 100,
        width: 400,
        height: 0,
      });

      const result = service.prepareImageExport(mockGraph as any, 10);

      expect(result?.viewBox).toBe('90 90 420 20');
    });

    it('should handle negative coordinates in bounding box', () => {
      mockGraph.getCellsBBox.mockReturnValue({
        x: -50,
        y: -50,
        width: 400,
        height: 300,
      });

      const result = service.prepareImageExport(mockGraph as any, 10);

      expect(result?.viewBox).toBe('-60 -60 420 320');
    });

    it('should handle zero padding', () => {
      const result = service.prepareImageExport(mockGraph as any, 0);

      expect(result?.viewBox).toBe('100 100 400 300');
      expect(result?.exportOptions.padding).toBe(0);
    });

    it('should handle large padding values', () => {
      const result = service.prepareImageExport(mockGraph as any, 100);

      expect(result?.viewBox).toBe('0 0 600 500');
      expect(result?.exportOptions.padding).toBe(100);
    });
  });
});
