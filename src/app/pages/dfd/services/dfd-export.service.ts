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
          this.logger.debugComponent('DfdExport', 'File System Access API not supported, using fallback download method');
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

      // Cast graph to access export methods added by the plugin
      const exportGraph = graph as {
        toSVG: (callback: (svgString: string) => void) => void;
        toPNG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
        toJPEG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
      };

      if (format === 'svg') {
        exportGraph.toSVG((svgString: string) => {
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          // Handle async operation without blocking the callback
          handleExport(blob, filename, 'image/svg+xml')
            .then(() => {
              this.logger.info('SVG export completed', { filename });
            })
            .catch(error => {
              this.logger.error('SVG export failed', error);
            });
        });
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
