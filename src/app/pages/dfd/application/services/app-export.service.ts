import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import { SvgOptimizationService } from '../../../dfd/services/svg-optimization.service';

type ExportFormat = 'png' | 'jpeg' | 'svg';

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
    private svgOptimizationService: SvgOptimizationService,
  ) {}

  /**
   * Export the diagram to the specified format
   * @deprecated This method is deprecated. Use the orchestrator's export method instead.
   */
  exportDiagram(
    format: ExportFormat,
    threatModelName?: string,
    diagramName?: string,
    graph?: any,
  ): void {
    if (!graph) {
      this.logger.warn('Cannot export - graph not provided');
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

      // Clear selection before export to avoid highlighting selected cells in the exported image
      const selectedCells = graph.getSelectedCells();
      selectedCells.forEach((cell: any) => {
        graph.unselect(cell);
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
          const finalSvg = this.svgOptimizationService.optimizeForExport(
            svgString,
            exportPrep.viewBox,
          );
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
  processSvg(svgString: string, encodeBase64: boolean = false, optimalViewBox?: string): string {
    if (encodeBase64) {
      // For thumbnails, use SVGO optimization with base64 encoding
      return this.svgOptimizationService.optimizeForThumbnail(svgString, optimalViewBox);
    } else {
      // For exports, use SVGO optimization
      return this.svgOptimizationService.optimizeForExport(svgString, optimalViewBox);
    }
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
