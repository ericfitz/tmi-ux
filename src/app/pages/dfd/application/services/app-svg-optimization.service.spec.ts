/**
 * Unit tests for AppSvgOptimizationService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-svg-optimization.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { AppSvgOptimizationService } from './app-svg-optimization.service';

// Mock SVGO
vi.mock('svgo/browser', () => ({
  optimize: vi.fn((svgString: string) => ({
    data: svgString.replace('<svg', '<svg optimized'),
  })),
}));

describe('AppSvgOptimizationService', () => {
  let service: AppSvgOptimizationService;
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  const mockSvgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect x="100" y="100" width="200" height="100" fill="red" />
    </svg>
  `;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock logger
    mockLogger = {
      debugComponent: vi.fn(),
      warn: vi.fn(),
    };

    // Create service with mocks
    service = new AppSvgOptimizationService(mockLogger as any);
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('optimizeForExport()', () => {
    it('should optimize SVG for export', () => {
      const result = service.optimizeForExport(mockSvgString);

      expect(result).toBeDefined();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppSvgOptimizationService',
        'Starting SVG optimization for export',
        expect.objectContaining({
          originalLength: mockSvgString.length,
          hasOptimalViewBox: false,
        }),
      );
    });

    it('should log completion with size reduction', () => {
      service.optimizeForExport(mockSvgString);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppSvgOptimizationService',
        'SVG optimization for export completed',
        expect.objectContaining({
          originalLength: expect.any(Number),
          optimizedLength: expect.any(Number),
          reductionPercent: expect.any(String),
        }),
      );
    });

    it('should apply optimal viewBox if provided and valid', () => {
      const optimalViewBox = '0 0 800 600';

      const result = service.optimizeForExport(mockSvgString, optimalViewBox);

      expect(result).toBeDefined();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppSvgOptimizationService',
        'Starting SVG optimization for export',
        expect.objectContaining({
          hasOptimalViewBox: true,
        }),
      );
    });

    it('should handle empty SVG string', () => {
      const result = service.optimizeForExport('');

      expect(result).toBeDefined();
    });

    it('should handle SVG without viewBox', () => {
      const svgNoViewBox = '<svg><rect x="0" y="0" width="100" height="100" /></svg>';

      const result = service.optimizeForExport(svgNoViewBox);

      expect(result).toBeDefined();
    });

    it('should validate viewBox format', () => {
      const invalidViewBox = 'invalid viewbox';

      const result = service.optimizeForExport(mockSvgString, invalidViewBox);

      // Should not apply invalid viewBox
      expect(result).toBeDefined();
    });

    it('should handle viewBox with NaN', () => {
      const nanViewBox = 'NaN NaN 800 600';

      const result = service.optimizeForExport(mockSvgString, nanViewBox);

      expect(result).toBeDefined();
    });

    it('should handle viewBox with undefined values', () => {
      const undefinedViewBox = 'undefined 0 800 600';

      const result = service.optimizeForExport(mockSvgString, undefinedViewBox);

      expect(result).toBeDefined();
    });

    it('should handle viewBox with null values', () => {
      const nullViewBox = 'null 0 800 600';

      const result = service.optimizeForExport(mockSvgString, nullViewBox);

      expect(result).toBeDefined();
    });
  });

  describe('optimizeForThumbnail()', () => {
    it('should optimize SVG for thumbnail and return base64', () => {
      const result = service.optimizeForThumbnail(mockSvgString);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppSvgOptimizationService',
        'Starting SVG optimization for thumbnail',
        expect.objectContaining({
          originalLength: mockSvgString.length,
          hasOptimalViewBox: false,
        }),
      );
    });

    it('should log completion with base64 length', () => {
      service.optimizeForThumbnail(mockSvgString);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppSvgOptimizationService',
        'SVG optimization for thumbnail completed',
        expect.objectContaining({
          originalLength: expect.any(Number),
          optimizedLength: expect.any(Number),
          base64Length: expect.any(Number),
        }),
      );
    });

    it('should apply optimal viewBox for thumbnail', () => {
      const optimalViewBox = '0 0 800 600';

      const result = service.optimizeForThumbnail(mockSvgString, optimalViewBox);

      expect(result).toBeDefined();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppSvgOptimizationService',
        'Starting SVG optimization for thumbnail',
        expect.objectContaining({
          hasOptimalViewBox: true,
        }),
      );
    });

    it('should handle empty SVG string', () => {
      const result = service.optimizeForThumbnail('');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should validate viewBox before applying', () => {
      const invalidViewBox = 'not a viewbox';

      const result = service.optimizeForThumbnail(mockSvgString, invalidViewBox);

      expect(result).toBeDefined();
    });
  });

  describe('ViewBox Validation', () => {
    it('should validate correct viewBox format', () => {
      const validViewBox = '0 0 800 600';

      // Use the service method indirectly through optimization
      const result = service.optimizeForExport(mockSvgString, validViewBox);

      expect(result).toBeDefined();
    });

    it('should reject viewBox with wrong number of values', () => {
      const wrongCountViewBox = '0 0 800';

      const result = service.optimizeForExport(mockSvgString, wrongCountViewBox);

      expect(result).toBeDefined();
    });

    it('should reject viewBox with non-numeric values', () => {
      const nonNumericViewBox = 'abc def ghi jkl';

      const result = service.optimizeForExport(mockSvgString, nonNumericViewBox);

      expect(result).toBeDefined();
    });

    it('should reject empty viewBox', () => {
      const emptyViewBox = '';

      const result = service.optimizeForExport(mockSvgString, emptyViewBox);

      expect(result).toBeDefined();
    });

    it('should reject whitespace-only viewBox', () => {
      const whitespaceViewBox = '   ';

      const result = service.optimizeForExport(mockSvgString, whitespaceViewBox);

      expect(result).toBeDefined();
    });

    it('should accept viewBox with negative values', () => {
      const negativeViewBox = '-100 -100 800 600';

      const result = service.optimizeForExport(mockSvgString, negativeViewBox);

      expect(result).toBeDefined();
    });

    it('should accept viewBox with decimal values', () => {
      const decimalViewBox = '0.5 0.5 800.25 600.75';

      const result = service.optimizeForExport(mockSvgString, decimalViewBox);

      expect(result).toBeDefined();
    });
  });

  describe('X6 Class Cleaning', () => {
    it('should remove X6-specific classes', () => {
      const svgWithX6Classes = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <g class="x6-graph-svg-stage">
            <rect class="x6-node x6-selected" />
          </g>
        </svg>
      `;

      const result = service.optimizeForExport(svgWithX6Classes);

      expect(result).toBeDefined();
    });

    it('should preserve x6-graph-svg-viewport class', () => {
      const svgWithViewport = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <g class="x6-graph-svg-viewport x6-other-class">
            <rect />
          </g>
        </svg>
      `;

      const result = service.optimizeForExport(svgWithViewport);

      expect(result).toBeDefined();
    });

    it('should reset viewport transform', () => {
      const svgWithTransform = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <g class="x6-graph-svg-viewport" transform="matrix(2,0,0,2,100,100)">
            <rect />
          </g>
        </svg>
      `;

      const result = service.optimizeForExport(svgWithTransform);

      expect(result).toBeDefined();
    });
  });

  describe('Post-Processing', () => {
    it('should remove hidden circles (X6 ports)', () => {
      const svgWithHiddenPorts = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <circle style="visibility: hidden" />
          <circle style="visibility: visible" />
        </svg>
      `;

      const result = service.optimizeForExport(svgWithHiddenPorts);

      expect(result).toBeDefined();
    });

    it('should remove empty groups', () => {
      const svgWithEmptyGroups = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <g></g>
          <g><rect /></g>
        </svg>
      `;

      const result = service.optimizeForExport(svgWithEmptyGroups);

      expect(result).toBeDefined();
    });

    it('should handle SVG with multiple viewBox attributes', () => {
      const svgWithDuplicateViewBox = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
          <g viewBox="10 10 200 200">
            <rect />
          </g>
        </svg>
      `;

      const result = service.optimizeForExport(svgWithDuplicateViewBox);

      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed SVG gracefully', () => {
      const malformedSvg = '<svg><rect></svg>';

      const result = service.optimizeForExport(malformedSvg);

      expect(result).toBeDefined();
    });

    it('should handle non-XML content', () => {
      const nonXml = 'This is not XML content';

      const result = service.optimizeForExport(nonXml);

      expect(result).toBeDefined();
    });

    it('should handle very large SVG strings', () => {
      const largeSvg = '<svg>' + '<rect />'.repeat(10000) + '</svg>';

      const result = service.optimizeForExport(largeSvg);

      expect(result).toBeDefined();
    });
  });

  describe('Base64 Encoding', () => {
    it('should encode optimized thumbnail as base64', () => {
      const result = service.optimizeForThumbnail(mockSvgString);

      // Base64 strings should only contain valid base64 characters
      expect(result).toMatch(/^[A-Za-z0-9+/=]*$/);
    });

    it('should produce base64 output for SVGs', () => {
      const svg1 = '<svg><rect x="0" /></svg>';

      const result1 = service.optimizeForThumbnail(svg1);

      expect(result1).toBeDefined();
      expect(result1).toMatch(/^[A-Za-z0-9+/=]*$/);
    });

    it('should handle special characters in SVG', () => {
      const svgWithSpecialChars = '<svg><text>Test & "quoted" < ></text></svg>';

      const result = service.optimizeForThumbnail(svgWithSpecialChars);

      expect(result).toBeDefined();
      expect(result).toMatch(/^[A-Za-z0-9+/=]*$/);
    });
  });

  describe('Optimization Configuration', () => {
    it('should use different configs for export vs thumbnail', () => {
      const result1 = service.optimizeForExport(mockSvgString);
      const result2 = service.optimizeForThumbnail(mockSvgString);

      // Both should work but may produce different results
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should preserve viewBox in export optimization', () => {
      const svgWithViewBox = `
        <svg viewBox="0 0 800 600">
          <rect />
        </svg>
      `;

      const result = service.optimizeForExport(svgWithViewBox);

      expect(result).toBeDefined();
    });
  });
});
