import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import { AppSvgOptimizationService } from './app-svg-optimization.service';

/**
 * Service responsible for diagram export functionality in DFD diagrams
 * Provides helper methods for export preparation and SVG optimization
 */
@Injectable({
  providedIn: 'root',
})
export class AppExportService {
  constructor(
    private logger: LoggerService,
    private svgOptimizationService: AppSvgOptimizationService,
  ) {}

  /**
   * Prepare image export by calculating bounding box and creating export options
   * Used for SVG, PNG, and JPEG exports in file export path, and SVG strings in thumbnail path
   * @param graph The X6 graph instance
   * @param padding Padding around the content (default: 20)
   * @returns Export preparation data or null if no cells to export
   */
  prepareImageExport(
    graph: any,
    padding: number = 20,
  ): {
    bbox: any;
    viewBox: string;
    exportOptions: {
      padding: number;
      copyStyles: boolean;
      preserveAspectRatio: string;
      viewBox?: string;
    };
  } | null {
    // Get tight bbox of all cells + padding (no zoom needed for vector export)
    const cells = graph.getCells();
    if (cells.length === 0) {
      this.logger.warn('No cells to export');
      return null;
    }
    const bbox = graph.getCellsBBox(cells);
    if (!bbox) {
      this.logger.warn('Could not get bounding box for cells');
      return null;
    }

    const viewBox = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + 2 * padding} ${bbox.height + 2 * padding}`;

    // Validate viewBox calculation
    if (viewBox.includes('NaN') || viewBox.includes('undefined') || viewBox.includes('null')) {
      this.logger.warn('Invalid viewBox calculated, falling back without explicit viewBox', {
        bbox,
        padding,
        viewBox,
      });
      // Return export options without explicit viewBox to avoid corruption
      const exportOptions = {
        padding,
        copyStyles: false,
        preserveAspectRatio: 'xMidYMid meet',
      };
      return { bbox, viewBox: '', exportOptions };
    }

    const exportOptions = {
      padding, // Still apply if needed for internal
      copyStyles: false,
      preserveAspectRatio: 'xMidYMid meet',
      // Don't set viewBox here to avoid duplicates - we'll apply it during SVG processing
    };

    this.logger.debugComponent('AppExportService', 'Using bounding box approach for SVG export', {
      bbox,
      viewBox,
      exportOptions,
    });

    return { bbox, viewBox, exportOptions };
  }

  /**
   * Process SVG string for export - preserves natural size with border
   * @param svgString The raw SVG string from X6
   * @param encodeBase64 Whether to encode the result as base64 (for thumbnails)
   * @returns Processed SVG string, optionally base64 encoded
   */
  processSvg(svgString: string, encodeBase64: boolean = false, optimalViewBox?: string): string {
    if (encodeBase64) {
      // For thumbnails, use SVGO optimization with base64 encoding
      return this.svgOptimizationService.optimizeForThumbnail(svgString, optimalViewBox);
    } else {
      // For exports, use SVGO optimization
      return this.svgOptimizationService.optimizeForExport(svgString, optimalViewBox);
    }
  }
}
