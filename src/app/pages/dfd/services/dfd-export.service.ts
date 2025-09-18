import { Injectable } from '@angular/core';
import { LoggerService } from '../../../core/services/logger.service';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';

type ExportFormat = 'png' | 'jpeg' | 'svg';

/**
 * Service responsible for diagram export functionality in DFD diagrams
 */
@Injectable({
  providedIn: 'root',
})
export class DfdExportService {
  constructor(
    private logger: LoggerService,
    private x6GraphAdapter: X6GraphAdapter,
  ) {}

  /**
   * Export the diagram to the specified format
   */
  exportDiagram(format: ExportFormat, threatModelName?: string, diagramName?: string): void {
    const graph = this.x6GraphAdapter.getGraph();
    if (!graph) {
      this.logger.warn('Cannot export - graph not initialized');
      return;
    }

    this.logger.info('Exporting diagram', { format, threatModelName, diagramName });

    try {
      // Generate filename based on threat model and diagram names
      const filename = this.generateFilename(format, threatModelName, diagramName);

      // Modern file save callback using File System Access API
      const handleExport = async (blob: Blob, name: string, mimeType: string): Promise<void> => {
        // Check if File System Access API is supported
        if ('showSaveFilePicker' in window) {
          try {
            this.logger.debugComponent('DfdExport', 'Using File System Access API for file save');
            const fileHandle = await window.showSaveFilePicker({
              suggestedName: name,
              types: [
                {
                  description: `${format.toUpperCase()} files`,
                  accept: { [mimeType]: [`.${format}`] },
                },
              ],
            });

            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            this.logger.info('File saved successfully using File System Access API', {
              filename: name,
            });
            return; // Success, exit early
          } catch (error) {
            // Handle File System Access API errors
            if (error instanceof DOMException && error.name === 'AbortError') {
              this.logger.info('File save cancelled by user');
              return; // User cancelled, exit without fallback
            } else {
              this.logger.warn(
                'File System Access API failed, falling back to download method',
                error,
              );
              // Continue to fallback method below
            }
          }
        } else {
          this.logger.debugComponent(
            'DfdExport',
            'File System Access API not supported, using fallback download method',
          );
        }

        // Fallback method for unsupported browsers or API failures
        try {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          this.logger.info('File downloaded successfully using fallback method', {
            filename: name,
          });
        } catch (fallbackError) {
          this.logger.error(
            'Both File System Access API and fallback method failed',
            fallbackError,
          );
          throw fallbackError;
        }
      };

      // Get the content area (no zoom needed for vector export)
      const contentArea = graph.getContentArea();

      this.logger.debug('Content area for export', {
        format,
        contentArea: contentArea,
        padding: 20,
      });

      // Cast graph to access export methods added by the plugin
      const exportGraph = graph as {
        toSVG: (
          callback: (svgString: string) => void,
          options?: {
            padding?: number;
            viewBox?: string;
            preserveAspectRatio?: string;
            copyStyles?: boolean;
          },
        ) => void;
        toPNG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
        toJPEG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
      };

      if (format === 'svg') {
        const exportPrep = this.prepareImageExport(graph);
        if (!exportPrep) {
          return; // prepareImageExport handles logging
        }

        exportGraph.toSVG((svgString: string) => {
          const finalSvg = this.processSvg(svgString);
          const blob = new Blob([finalSvg], { type: 'image/svg+xml' });

          // Handle async operation without blocking the callback
          handleExport(blob, filename, 'image/svg+xml')
            .then(() => {
              this.logger.info('SVG export completed', {
                filename,
                originalLength: svgString.length,
                finalLength: finalSvg.length,
              });
            })
            .catch(error => {
              this.logger.error('SVG export failed', error);
            });
        }, exportPrep.exportOptions);
      } else {
        const exportOptions = {
          backgroundColor: 'white',
          padding: 20,
          quality: format === 'jpeg' ? 0.8 : 1,
        };

        if (format === 'png') {
          exportGraph.toPNG((dataUri: string) => {
            const blob = this.dataUriToBlob(dataUri, 'image/png');
            // Handle async operation without blocking the callback
            handleExport(blob, filename, 'image/png')
              .then(() => {
                this.logger.info('PNG export completed', { filename });
              })
              .catch(error => {
                this.logger.error('PNG export failed', error);
              });
          }, exportOptions);
        } else {
          exportGraph.toJPEG((dataUri: string) => {
            const blob = this.dataUriToBlob(dataUri, 'image/jpeg');
            // Handle async operation without blocking the callback
            handleExport(blob, filename, 'image/jpeg')
              .then(() => {
                this.logger.info('JPEG export completed', { filename });
              })
              .catch(error => {
                this.logger.error('JPEG export failed', error);
              });
          }, exportOptions);
        }
      }
    } catch (error) {
      this.logger.error('Error exporting diagram', error);
    }
  }

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
      viewBox: string;
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

    const exportOptions = {
      padding, // Still apply if needed for internal
      copyStyles: false,
      preserveAspectRatio: 'xMidYMid meet',
      viewBox, // Set explicit viewBox for tight fit
    };

    this.logger.debug('Using bounding box approach for SVG export', {
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
  processSvg(svgString: string, encodeBase64: boolean = false): string {
    if (encodeBase64) {
      // For thumbnails, use scaling approach
      return this.processSvgForThumbnail(svgString);
    } else {
      // For exports, preserve natural size
      return this.processSvgForExport(svgString);
    }
  }

  /**
   * Process SVG for export - captures entire original SVG with border at natural size
   * Preserves viewport, dimensions, and scale information for high-quality exports
   * @param svgString The raw SVG string from X6
   * @returns Processed SVG string with natural dimensions preserved
   */
  private processSvgForExport(svgString: string): string {
    const cleanedSvg = this.cleanSvgContent(svgString);
    return cleanedSvg;
  }

  /**
   * Process SVG for thumbnail display - scales to fit thumbnail container
   * @param svgString The raw SVG string from X6
   * @returns Base64 encoded SVG scaled for thumbnail display
   */
  private processSvgForThumbnail(svgString: string): string {
    const cleanedSvg = this.cleanSvgContent(svgString);

    // Convert to base64
    const encoder = new TextEncoder();
    const data = encoder.encode(cleanedSvg);
    return btoa(String.fromCharCode(...data));
  }

  /**
   * Convert data URI to Blob
   */
  private dataUriToBlob(dataUri: string, mimeType: string): Blob {
    const byteString = atob(dataUri.split(',')[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeType });
  }

  /**
   * Remove invalid UTF-8, XML, and SVG characters
   * @param svgString The SVG string to clean
   * @returns SVG string with invalid characters removed
   */
  private cleanInvalidCharacters(svgString: string): string {
    // Remove non-breaking spaces (0xa0) and other problematic characters
    let cleanedString = svgString;

    // Replace non-breaking spaces with regular spaces
    cleanedString = cleanedString.replace(/\u00A0/g, ' ');

    // Remove any remaining &nbsp; entities
    cleanedString = cleanedString.replace(/&nbsp;/g, ' ');

    // Remove control characters that can cause UTF-8/XML issues
    // Filter out characters by checking their char codes
    cleanedString = cleanedString
      .split('')
      .filter(char => {
        const code = char.charCodeAt(0);
        // Keep normal characters, but remove problematic control chars
        // Allow: tab (9), line feed (10), carriage return (13), and printable chars (32+)
        return code === 9 || code === 10 || code === 13 || code >= 32;
      })
      .join('');

    // Normalize multiple spaces to single space
    cleanedString = cleanedString.replace(/ +/g, ' ');

    return cleanedString.trim();
  }


  /**
   * Clean SVG content by removing X6-specific elements and attributes
   * Preserves natural dimensions and viewport information for both exports and thumbnails
   * @param svgString The original SVG string from X6
   * @returns Cleaned SVG string with X6 artifacts removed
   */
  private cleanSvgContent(svgString: string): string {
    try {
      // Parse the SVG
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (!svgElement) {
        return svgString; // Return original if parsing fails
      }

      // PRESERVE width, height, and viewBox - don't remove them!
      // This maintains the natural size with border captured during generation
      // If there's a viewBox, make sure it stays centered on the content
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }

      // Clean up X6-specific elements and attributes
      this.cleanSvgElements(svgDoc);

      // Serialize and clean invalid characters
      const serializedSvg = new XMLSerializer().serializeToString(svgDoc);
      return this.cleanInvalidCharacters(serializedSvg);
    } catch (error) {
      this.logger.warn('Failed to clean SVG content, returning original', { error });
      return svgString;
    }
  }

  /**
   * Common SVG element cleaning logic for removing X6-specific artifacts
   * @param svgDoc The parsed SVG document
   */
  private cleanSvgElements(svgDoc: Document): void {
    // Remove X6-specific classes and attributes
    const elementsToClean = svgDoc.querySelectorAll('*');
    elementsToClean.forEach(element => {
      // Special handling for x6-graph-svg-viewport - reset transform to identity matrix
      const classNames = (element.className as any)?.baseVal || element.className;
      if (typeof classNames === 'string' && classNames.includes('x6-graph-svg-viewport')) {
        element.setAttribute('transform', 'matrix(1,0,0,1,0,0)');
      }

      // Remove X6-specific classes except viewport
      if (typeof classNames === 'string') {
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

      // Remove X6-specific attributes
      const attributesToRemove = [
        'data-cell-id',
        'data-shape',
        'port',
        'port-group',
        'magnet',
        'cursor',
        'pointer-events',
      ];
      attributesToRemove.forEach(attr => {
        element.removeAttribute(attr);
      });

      // Clean up style attributes
      const style = element.getAttribute('style');
      if (style) {
        const cleanedStyle = style
          .split(';')
          .filter(prop => prop.trim() !== '') // Only remove empty properties
          .join(';');
        if (cleanedStyle) {
          element.setAttribute('style', cleanedStyle);
        } else {
          element.removeAttribute('style');
        }
      }
    });

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

    // Remove unused (hidden) port (circle) elements
    const hiddenCircles = svgDoc.querySelectorAll('circle');
    hiddenCircles.forEach(circle => {
      const style = circle.getAttribute('style');
      if (style && style.includes('visibility: hidden')) {
        circle.remove();
      }
    });

    // Remove empty group elements that only contain a transform attribute
    const groups = svgDoc.querySelectorAll('g');
    groups.forEach(group => {
      if (group.children.length === 0 && group.textContent?.trim() === '') {
        const attributes = group.attributes;
        if (attributes.length === 1 && attributes[0].name === 'transform') {
          group.remove();
        } else if (attributes.length === 0) {
          group.remove();
        }
      }
    });
  }

  /**
   * Generate filename based on threat model name, diagram name, and format
   * Format: "{threatModelName}-{diagramName}-DFD.{format}"
   * Names are truncated to 63 characters if longer
   */
  private generateFilename(
    format: ExportFormat,
    threatModelName?: string,
    diagramName?: string,
  ): string {
    // Helper function to sanitize and truncate names for filenames
    const sanitizeAndTruncate = (name: string, maxLength: number): string => {
      // Remove or replace characters that are invalid in filenames
      const sanitized = name
        .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename characters with dash
        .replace(/\s+/g, '-') // Replace spaces with dashes
        .replace(/-+/g, '-') // Replace multiple dashes with single dash
        .replace(/^-|-$/g, ''); // Remove leading/trailing dashes

      // Truncate to max length
      return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
    };

    const filenameParts: string[] = [];

    // Add threat model name if available
    if (threatModelName && threatModelName.trim()) {
      filenameParts.push(sanitizeAndTruncate(threatModelName.trim(), 63));
    }

    // Add diagram name if available
    if (diagramName && diagramName.trim()) {
      filenameParts.push(sanitizeAndTruncate(diagramName.trim(), 63));
    }

    // Add DFD suffix
    filenameParts.push('DFD');

    // If no names were provided, use default with timestamp
    if (filenameParts.length === 1) {
      // Only 'DFD' was added
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return `dfd-diagram-${timestamp}.${format}`;
    }

    // Join parts and add extension
    const filename = `${filenameParts.join('-')}.${format}`;

    this.logger.debugComponent('DfdExport', 'Generated filename', {
      threatModelName,
      diagramName,
      format,
      filename,
    });

    return filename;
  }
}
