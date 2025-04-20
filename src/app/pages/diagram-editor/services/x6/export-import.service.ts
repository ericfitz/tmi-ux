import { Injectable } from '@angular/core';
import { Graph, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphService } from './x6-graph.service';
import { DiagramService } from './diagram.service';

@Injectable({
  providedIn: 'root',
})
export class ExportImportService {
  constructor(
    private logger: LoggerService,
    private graphService: X6GraphService,
    private diagramService: DiagramService,
  ) {
    this.logger.info('ExportImportService initialized');
  }

  /**
   * Export the current diagram as JSON
   */
  exportAsJson(): void {
    try {
      const graph = this.graphService.getGraph();
      if (!graph) {
        this.logger.error('Cannot export: Graph not initialized');
        return;
      }

      const currentDiagram = this.diagramService.getCurrentDiagram();
      if (!currentDiagram) {
        this.logger.error('Cannot export: No current diagram');
        return;
      }

      // Get the cells from the graph
      const cells = graph.toJSON().cells;

      // Create the export data
      const exportData = {
        ...currentDiagram,
        cells,
        exportDate: new Date().toISOString(),
        version: '1.0.0',
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2);

      // Create a blob and save it
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `${currentDiagram.name.replace(/\s+/g, '_')}.json`;

      this.saveFileWithNativeAPI(blob, fileName, 'application/json');
    } catch (error) {
      this.logger.error('Error exporting diagram as JSON', error);
    }
  }

  /**
   * Export the current diagram as PNG
   */
  exportAsPng(): void {
    try {
      const graph = this.graphService.getGraph();
      if (!graph) {
        this.logger.error('Cannot export: Graph not initialized');
        return;
      }

      const currentDiagram = this.diagramService.getCurrentDiagram();
      if (!currentDiagram) {
        this.logger.error('Cannot export: No current diagram');
        return;
      }

      // Export as PNG using toDataURL
      const canvas = document.createElement('canvas');
      const rect = graph.getContentBBox();

      canvas.width = rect.width + 40; // Add padding
      canvas.height = rect.height + 40; // Add padding

      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create a temporary SVG
      const svg = this.createSVG(graph);
      const svgString = new XMLSerializer().serializeToString(svg);

      // Convert SVG to image
      const img = new Image();
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        ctx.drawImage(img, 20, 20); // Draw with padding
        const dataUri = canvas.toDataURL('image/png');

        // Convert data URI to blob
        const binaryString = atob(dataUri.split(',')[1]);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes.buffer], { type: 'image/png' });
        const fileName = `${currentDiagram.name.replace(/\s+/g, '_')}.png`;

        this.saveFileWithNativeAPI(blob, fileName, 'image/png');
        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (error) {
      this.logger.error('Error exporting diagram as PNG', error);
    }
  }

  /**
   * Export the current diagram as SVG
   */
  exportAsSvg(): void {
    try {
      const graph = this.graphService.getGraph();
      if (!graph) {
        this.logger.error('Cannot export: Graph not initialized');
        return;
      }

      const currentDiagram = this.diagramService.getCurrentDiagram();
      if (!currentDiagram) {
        this.logger.error('Cannot export: No current diagram');
        return;
      }

      // Export as SVG
      const svg = this.createSVG(graph);
      if (!svg) {
        this.logger.error('Failed to generate SVG');
        return;
      }

      // Convert SVG to string
      const svgString = new XMLSerializer().serializeToString(svg);

      // Create a blob and save it
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const fileName = `${currentDiagram.name.replace(/\s+/g, '_')}.svg`;

      this.saveFileWithNativeAPI(blob, fileName, 'image/svg+xml');
    } catch (error) {
      this.logger.error('Error exporting diagram as SVG', error);
    }
  }

  /**
   * Import a diagram from a JSON file
   */
  importFromJson(file: File): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const reader = new FileReader();

        reader.onload = (event: ProgressEvent<FileReader>) => {
          try {
            if (!event.target || !event.target.result) {
              this.logger.error('Failed to read file');
              reject(new Error('Failed to read file'));
              return;
            }

            // Parse the JSON
            const jsonString = event.target.result as string;
            const importData = JSON.parse(jsonString);

            // Validate the import data
            if (!importData.cells || !Array.isArray(importData.cells)) {
              this.logger.error('Invalid import data: Missing cells array');
              reject(new Error('Invalid import data: Missing cells array'));
              return;
            }

            // Create a new diagram with the imported data
            const newDiagram = {
              id: importData.id || this.generateId(),
              name: importData.name || 'Imported Diagram',
              cells: importData.cells,
            };

            // Load the diagram
            this.diagramService.loadDiagram(newDiagram);

            this.logger.info(`Diagram imported: ${newDiagram.name}`);
            resolve(true);
          } catch (error) {
            this.logger.error('Error parsing import data', error);
            reject(error);
          }
        };

        reader.onerror = error => {
          this.logger.error('Error reading file', error);
          reject(error);
        };

        // Read the file as text
        reader.readAsText(file);
      } catch (error) {
        this.logger.error('Error importing diagram', error);
        reject(error);
      }
    });
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Create an SVG element from the graph
   */
  private createSVG(graph: Graph): SVGSVGElement {
    // Create a new SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const content = graph.getContentBBox();

    // Set attributes
    svg.setAttribute('width', String(content.width + 40)); // Add padding
    svg.setAttribute('height', String(content.height + 40)); // Add padding
    svg.setAttribute(
      'viewBox',
      `${content.x - 20} ${content.y - 20} ${content.width + 40} ${content.height + 40}`,
    );

    // Create a background rectangle
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('x', String(content.x - 20));
    background.setAttribute('y', String(content.y - 20));
    background.setAttribute('width', String(content.width + 40));
    background.setAttribute('height', String(content.height + 40));
    background.setAttribute('fill', '#ffffff');
    svg.appendChild(background);

    // Get all cells and convert them to SVG
    const cells = graph.getCells();
    cells.forEach((cell: Cell) => {
      const cellView = graph.findViewByCell(cell);
      if (cellView) {
        const cellSvg = cellView.findOne('svg') as SVGElement;
        if (cellSvg) {
          svg.appendChild(cellSvg.cloneNode(true));
        }
      }
    });

    return svg;
  }

  /**
   * Save a file using the native File System Access API
   */
  private async saveFileWithNativeAPI(
    blob: Blob,
    suggestedName: string,
    mimeType: string,
  ): Promise<void> {
    try {
      // Define the file type options based on the mime type
      const fileTypeOptions: any = {};

      if (mimeType === 'application/json') {
        fileTypeOptions.description = 'JSON File';
        fileTypeOptions.accept = { 'application/json': ['.json'] };
      } else if (mimeType === 'image/png') {
        fileTypeOptions.description = 'PNG Image';
        fileTypeOptions.accept = { 'image/png': ['.png'] };
      } else if (mimeType === 'image/svg+xml') {
        fileTypeOptions.description = 'SVG Image';
        fileTypeOptions.accept = { 'image/svg+xml': ['.svg'] };
      }

      // Show the file save dialog
      const fileHandle = await window.showSaveFilePicker({
        suggestedName,
        types: [fileTypeOptions],
      });

      // Create a writable stream
      const writable = await fileHandle.createWritable();

      // Write the blob to the file
      await writable.write(blob);

      // Close the file
      await writable.close();

      this.logger.info(`File saved: ${suggestedName}`);
    } catch (error) {
      // User cancelled or API not supported
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.logger.info('File save cancelled by user');
      } else if (!window.showSaveFilePicker) {
        this.logger.error('File System Access API not supported in this browser');
        // Fallback to traditional download
        this.fallbackSaveFile(blob, suggestedName);
      } else {
        this.logger.error('Error saving file', error);
      }
    }
  }

  /**
   * Fallback method for browsers that don't support the File System Access API
   */
  private fallbackSaveFile(blob: Blob, fileName: string): void {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    this.logger.info(`File saved using fallback method: ${fileName}`);
  }
}
