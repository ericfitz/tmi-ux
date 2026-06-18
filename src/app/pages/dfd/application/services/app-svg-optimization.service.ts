import { Injectable } from '@angular/core';
import { optimize } from 'svgo/browser';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Application SVG Optimization Service
 * Service responsible for SVG optimization using SVGO
 * Specifically configured for X6 graph-generated SVGs
 */
@Injectable({
  providedIn: 'root',
})
// SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: optimize exported SVG for X6 graphs by stripping artifacts and compressing output (pure)
export class AppSvgOptimizationService {
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: inject the logger dependency for the SVG optimization service (pure)
  constructor(private logger: LoggerService) {}

  /**
   * Get SVGO configuration optimized for X6 graph exports
   * Preserves viewBox and removes X6-specific artifacts
   */
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: build SVGO plugin config for X6 graph export, preserving viewBox (pure)
  private getX6OptimizationConfig(): any {
    return {
      plugins: [
        // Use default preset but disable problematic plugins
        {
          name: 'preset-default',
          params: {
            overrides: {
              // Keep viewBox - critical for X6 compatibility
              removeViewBox: false,
              // Don't remove unknown elements/attributes yet - we'll handle X6-specific ones
              removeUnknownsAndDefaults: false,
              // Keep important structural elements
              inlineStyles: false,
            },
          },
        },
        // Remove X6-specific attributes
        {
          name: 'removeAttrs',
          params: {
            attrs: [
              'data-cell-id',
              'data-shape',
              'port',
              'port-group',
              'magnet',
              'cursor',
              'pointer-events',
            ],
          },
        },
        // Clean up numeric values for smaller file size
        {
          name: 'cleanupNumericValues',
          params: {
            floatPrecision: 2,
          },
        },
        // Remove comments
        'removeComments',
        // Remove metadata
        'removeMetadata',
        // Remove editor-specific data
        'removeEditorsNSData',
        // Remove empty containers
        'removeEmptyContainers',
        // Remove hidden elements (like X6 ports)
        'removeHiddenElems',
        // Merge paths where possible
        'mergePaths',
      ],
    };
  }

  /**
   * Get SVGO configuration for thumbnail optimization
   * More aggressive optimization for smaller file sizes
   */
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: build aggressive SVGO plugin config for thumbnail size reduction (pure)
  private getThumbnailOptimizationConfig(): any {
    return {
      plugins: [
        'preset-default',
        // Remove X6-specific attributes
        {
          name: 'removeAttrs',
          params: {
            attrs: [
              'data-cell-id',
              'data-shape',
              'port',
              'port-group',
              'magnet',
              'cursor',
              'pointer-events',
            ],
          },
        },
        // More aggressive numeric cleanup for thumbnails
        {
          name: 'cleanupNumericValues',
          params: {
            floatPrecision: 1,
          },
        },
        // Remove unused namespaces
        'removeUnusedNS',
        // Convert colors to shorter formats
        'convertColors',
        // Remove empty text elements
        'removeEmptyText',
      ],
    };
  }

  /**
   * Optimize SVG for export with X6-specific cleaning
   * @param svgString The original SVG string from X6
   * @param optimalViewBox Optional optimal viewBox to apply
   * @returns Optimized SVG string
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: optimize an X6 SVG string for export, returning cleaned SVG markup (pure)
  optimizeForExport(svgString: string, optimalViewBox?: string): string {
    try {
      this.logger.debugComponent(
        'AppSvgOptimizationService',
        'Starting SVG optimization for export',
        {
          originalLength: svgString.length,
          hasOptimalViewBox: !!optimalViewBox,
        },
      );

      // First, apply optimal viewBox if provided
      let processedSvg = svgString;
      if (optimalViewBox && this.isValidViewBox(optimalViewBox)) {
        processedSvg = this.applyOptimalViewBox(processedSvg, optimalViewBox);
      }

      // Clean X6-specific classes before SVGO optimization
      processedSvg = this.cleanX6Classes(processedSvg);

      // Run SVGO optimization
      const result = optimize(processedSvg, this.getX6OptimizationConfig());

      // SVGO throws errors rather than returning them in the result
      const optimizedSvg = result.data;

      // Post-process to handle any remaining X6-specific issues
      const finalSvg = this.postProcessX6Svg(optimizedSvg);

      this.logger.debugComponent(
        'AppSvgOptimizationService',
        'SVG optimization for export completed',
        {
          originalLength: svgString.length,
          optimizedLength: finalSvg.length,
          reductionPercent: (
            ((svgString.length - finalSvg.length) / svgString.length) *
            100
          ).toFixed(1),
        },
      );

      return finalSvg;
    } catch (error) {
      this.logger.warn('SVG optimization failed, returning original', { error });
      return svgString;
    }
  }

  /**
   * Optimize SVG for thumbnail with aggressive optimization
   * @param svgString The original SVG string from X6
   * @param optimalViewBox Optional optimal viewBox to apply
   * @returns Base64 encoded optimized SVG
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: optimize an X6 SVG string for thumbnail and return base64-encoded result (pure)
  optimizeForThumbnail(svgString: string, optimalViewBox?: string): string {
    try {
      this.logger.debugComponent(
        'AppSvgOptimizationService',
        'Starting SVG optimization for thumbnail',
        {
          originalLength: svgString.length,
          hasOptimalViewBox: !!optimalViewBox,
        },
      );

      // First, apply optimal viewBox if provided
      let processedSvg = svgString;
      if (optimalViewBox && this.isValidViewBox(optimalViewBox)) {
        processedSvg = this.applyOptimalViewBox(processedSvg, optimalViewBox);
      }

      // Clean X6-specific classes before SVGO optimization
      processedSvg = this.cleanX6Classes(processedSvg);

      // Run SVGO optimization with thumbnail config
      const result = optimize(processedSvg, this.getThumbnailOptimizationConfig());

      // SVGO throws errors rather than returning them in the result
      processedSvg = this.postProcessX6Svg(result.data);

      // Convert to base64
      const encoder = new TextEncoder();
      const data = encoder.encode(processedSvg);
      const base64 = btoa(String.fromCharCode(...data));

      this.logger.debugComponent(
        'AppSvgOptimizationService',
        'SVG optimization for thumbnail completed',
        {
          originalLength: svgString.length,
          optimizedLength: processedSvg.length,
          base64Length: base64.length,
        },
      );

      return base64;
    } catch (error) {
      this.logger.warn('SVG thumbnail optimization failed, using fallback', { error });
      // Fallback to simple base64 encoding
      const encoder = new TextEncoder();
      const data = encoder.encode(svgString);
      return btoa(String.fromCharCode(...data));
    }
  }

  /**
   * Clean X6-specific classes that SVGO might not handle properly
   * @param svgString The SVG string to clean
   * @returns SVG string with X6 classes cleaned
   */
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: strip X6-specific CSS classes and reset viewport transform from SVG markup (pure)
  private cleanX6Classes(svgString: string): string {
    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');

      // Clean X6-specific classes
      const elementsToClean = svgDoc.querySelectorAll('*');
      elementsToClean.forEach(element => {
        const classNames = (element.className as any)?.baseVal || element.className;
        if (typeof classNames === 'string') {
          // Special handling for x6-graph-svg-viewport - reset transform
          if (classNames.includes('x6-graph-svg-viewport')) {
            element.setAttribute('transform', 'matrix(1,0,0,1,0,0)');
          }

          // Remove X6-specific classes except viewport
          const cleanedClasses = classNames
            .split(' ')
            .filter(cls => !cls.startsWith('x6-') || cls === 'x6-graph-svg-viewport')
            .join(' ');

          if (cleanedClasses) {
            element.setAttribute('class', cleanedClasses);
          } else {
            element.removeAttribute('class');
          }
        }
      });

      return new XMLSerializer().serializeToString(svgDoc);
    } catch (error) {
      this.logger.warn('Failed to clean X6 classes, returning original', { error });
      return svgString;
    }
  }

  /**
   * Apply optimal viewBox to SVG string
   * @param svgString The SVG string
   * @param optimalViewBox The optimal viewBox to apply
   * @returns SVG string with optimal viewBox applied
   */
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: set viewBox and preserveAspectRatio on the root SVG element (pure)
  private applyOptimalViewBox(svgString: string, optimalViewBox: string): string {
    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (svgElement) {
        svgElement.setAttribute('viewBox', optimalViewBox);
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        return new XMLSerializer().serializeToString(svgDoc);
      }
    } catch (error) {
      this.logger.warn('Failed to apply optimal viewBox', { error });
    }
    return svgString;
  }

  /**
   * Post-process SVG to handle remaining X6-specific issues
   * @param svgString The SVG string to post-process
   * @returns Post-processed SVG string
   */
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: remove X6 decorative elements, hidden ports, and empty groups from SVG (pure)
  private postProcessX6Svg(svgString: string): string {
    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');

      // Remove specific X6 decorative elements
      const decorativeSelectors = [
        '.x6-graph-svg-primer',
        '.x6-graph-svg-decorator',
        '.x6-graph-svg-overlay',
      ];
      decorativeSelectors.forEach(selector => {
        const elements = svgDoc.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // Remove unused hidden circles (X6 ports)
      const hiddenCircles = svgDoc.querySelectorAll('circle');
      hiddenCircles.forEach(circle => {
        const style = circle.getAttribute('style');
        if (style && style.includes('visibility: hidden')) {
          circle.remove();
        }
      });

      // Remove empty groups
      const groups = svgDoc.querySelectorAll('g');
      groups.forEach(group => {
        if (group.children.length === 0 && group.textContent?.trim() === '') {
          const attributes = group.attributes;
          if (attributes.length <= 1) {
            group.remove();
          }
        }
      });

      // Clean duplicate viewBox attributes
      this.cleanDuplicateViewBoxAttributes(svgDoc);

      return new XMLSerializer().serializeToString(svgDoc);
    } catch (error) {
      this.logger.warn('Post-processing failed, returning original', { error });
      return svgString;
    }
  }

  /**
   * Clean duplicate viewBox attributes from SVG document
   * @param svgDoc The parsed SVG document
   */
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: deduplicate viewBox attributes, keeping first valid one on root SVG (mutates shared state)
  private cleanDuplicateViewBoxAttributes(svgDoc: Document): void {
    const elementsWithViewBox = svgDoc.querySelectorAll('[viewBox]');

    if (elementsWithViewBox.length <= 1) {
      return;
    }

    let validViewBox: string | null = null;

    // Find the first valid viewBox
    for (const element of elementsWithViewBox) {
      const viewBox = element.getAttribute('viewBox');
      if (this.isValidViewBox(viewBox)) {
        validViewBox = viewBox;
        break;
      }
    }

    // Remove viewBox from all elements
    elementsWithViewBox.forEach(element => {
      element.removeAttribute('viewBox');
    });

    // Restore the valid viewBox to the root SVG
    if (validViewBox) {
      const rootSvg = svgDoc.querySelector('svg');
      if (rootSvg) {
        rootSvg.setAttribute('viewBox', validViewBox);
      }
    }
  }

  /**
   * Validate if a viewBox string is valid
   * @param viewBox The viewBox attribute value
   * @returns True if the viewBox is valid
   */
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: validate a viewBox string has four finite numeric components (pure)
  private isValidViewBox(viewBox: string | null): boolean {
    if (!viewBox || !viewBox.trim()) {
      return false;
    }

    // Check for invalid values
    if (
      viewBox.includes('NaN') ||
      viewBox.includes('undefined') ||
      viewBox.includes('null') ||
      viewBox.trim() === ''
    ) {
      return false;
    }

    // Check if it has the correct format (4 numbers)
    const parts = viewBox.trim().split(/\s+/);
    if (parts.length !== 4) {
      return false;
    }

    // Check if all parts are valid numbers
    return parts.every(part => !isNaN(parseFloat(part)) && isFinite(parseFloat(part)));
  }
}
