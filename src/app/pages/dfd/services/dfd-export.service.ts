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
  exportDiagram(format: ExportFormat): void {
    const graph = this.x6GraphAdapter.getGraph();
    if (!graph) {
      this.logger.warn('Cannot export - graph not initialized');
      return;
    }

    this.logger.info('Exporting diagram', { format });

    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dfd-diagram-${timestamp}.${format}`;

      // Modern file save callback using File System Access API
      const handleExport = async (blob: Blob, name: string, mimeType: string): Promise<void> => {
        try {
          // Check if File System Access API is supported
          if ('showSaveFilePicker' in window) {
            const fileHandle = await window.showSaveFilePicker({
              suggestedName: name,
              types: [{
                description: `${format.toUpperCase()} files`,
                accept: { [mimeType]: [`.${format}`] },
              }],
            });

            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            this.logger.info('File saved successfully using File System Access API', { filename: name });
          } else {
            // Fallback for browsers that don't support File System Access API
            this.logger.warn('File System Access API not supported, using fallback download method');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        } catch (error) {
          // User cancelled or API error
          if (error instanceof DOMException && error.name === 'AbortError') {
            this.logger.info('File save cancelled by user');
          } else {
            this.logger.error('Error saving file', error);
            throw error;
          }
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
}
