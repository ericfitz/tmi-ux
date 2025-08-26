import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { LoggerService } from '../../../core/services/logger.service';
import { ThreatModel, Threat, Document, Source } from '../models/threat-model.model';

interface DiagramImage {
  diagramId: string;
  diagramName: string;
  imageData: string;
}

/**
 * Service responsible for generating PDF reports from threat models
 */
@Injectable({
  providedIn: 'root',
})
export class ThreatModelReportService {
  constructor(private logger: LoggerService) {}

  /**
   * Generate a PDF report for the given threat model
   */
  async generateReport(threatModel: ThreatModel): Promise<void> {
    try {
      this.logger.info('Generating PDF report for threat model', {
        threatModelId: threatModel.id,
        threatModelName: threatModel.name,
      });

      // Create new PDF document
      const doc = new jsPDF();

      // Render diagrams as images
      const diagramImages = this.renderDiagrams(threatModel);

      // Generate PDF content
      this.createPdfContent(doc, threatModel, diagramImages);

      // Save the PDF file
      await this.savePdfFile(doc, threatModel.name);

      this.logger.info('PDF report generated successfully', {
        threatModelName: threatModel.name,
      });
    } catch (error) {
      this.logger.error('Error generating PDF report', error);
      throw error;
    }
  }

  /**
   * Get diagram metadata for placeholder rendering in PDF
   * Note: Actual diagram rendering will be implemented in future iteration
   */
  private renderDiagrams(threatModel: ThreatModel): DiagramImage[] {
    const diagramPlaceholders: DiagramImage[] = [];

    if (!threatModel.diagrams || threatModel.diagrams.length === 0) {
      return diagramPlaceholders;
    }

    // For now, we'll create placeholders for each diagram
    // Future implementation will include pre-rendered diagram images
    for (const diagram of threatModel.diagrams) {
      diagramPlaceholders.push({
        diagramId: diagram.id,
        diagramName: diagram.name || 'Untitled Diagram',
        imageData: '', // No actual image data in placeholder implementation
      });
    }

    this.logger.info('Using diagram placeholders in PDF report', {
      diagramCount: diagramPlaceholders.length,
    });

    return diagramPlaceholders;
  }

  /**
   * Export diagram as base64 PNG image
   * Currently not implemented - using placeholder approach
   * TODO: Remove this method when implementing pre-rendered diagram storage
   */
  private exportDiagramAsBase64(_graph: unknown, _diagramName: string): Promise<string> {
    // This method is not used in the current placeholder implementation
    // but kept for future reference when implementing actual diagram rendering
    return Promise.resolve('');
  }

  /**
   * Create PDF content using jsPDF
   */
  private createPdfContent(
    doc: jsPDF,
    threatModel: ThreatModel,
    diagramImages: DiagramImage[],
  ): void {
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - 2 * margin;

    // Title
    doc.setFontSize(24);
    doc.setTextColor(51, 51, 51);
    doc.text(threatModel.name, margin, yPosition);
    yPosition += 15;

    // Description
    if (threatModel.description) {
      doc.setFontSize(12);
      doc.setTextColor(102, 102, 102);
      const descriptionLines = doc.splitTextToSize(threatModel.description, contentWidth) as
        | string
        | string[];
      const linesArray = Array.isArray(descriptionLines) ? descriptionLines : [descriptionLines];
      doc.text(descriptionLines, margin, yPosition);
      yPosition += linesArray.length * 5 + 10;
    }

    // Basic Information Section
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.text(`Framework: ${threatModel.threat_model_framework}`, margin, yPosition);
    doc.text(`Owner: ${threatModel.owner}`, margin + contentWidth / 2, yPosition);
    yPosition += 8;

    doc.text(
      `Created: ${new Date(threatModel.created_at).toLocaleDateString()}`,
      margin,
      yPosition,
    );
    doc.text(
      `Last Modified: ${new Date(threatModel.modified_at).toLocaleDateString()}`,
      margin + contentWidth / 2,
      yPosition,
    );
    yPosition += 15;

    // Check if we need a new page
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    // Diagrams Section
    if (diagramImages.length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text('Diagrams', margin, yPosition);
      yPosition += 12;

      for (const diagram of diagramImages) {
        // Check if we need a new page for the diagram
        if (yPosition > pageHeight - 120) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.text(diagram.diagramName, margin, yPosition);
        yPosition += 8;

        // Show diagram placeholder since we don't have pre-rendered images yet
        doc.setFontSize(10);
        doc.setTextColor(102, 102, 102);
        doc.text('📊 Diagram available in DFD Editor', margin, yPosition);
        yPosition += 6;
        doc.text(`Diagram ID: ${diagram.diagramId}`, margin, yPosition);
        yPosition += 6;
        doc.text(
          'Note: Full diagram rendering will be available in a future update',
          margin,
          yPosition,
        );
        yPosition += 15;
      }
    }

    // Threats Section
    if (threatModel.threats && threatModel.threats.length > 0) {
      // Check if we need a new page
      if (yPosition > pageHeight - 100) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text(`Threats (${threatModel.threats.length})`, margin, yPosition);
      yPosition += 12;

      this.addThreatsTable(doc, threatModel.threats, margin, yPosition, contentWidth);
      yPosition = this.getNextYPosition(doc, yPosition, threatModel.threats.length * 15);
    }

    // Documents Section
    if (threatModel.documents && threatModel.documents.length > 0) {
      // Check if we need a new page
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text(`Documents (${threatModel.documents.length})`, margin, yPosition);
      yPosition += 12;

      this.addDocumentsTable(doc, threatModel.documents, margin, yPosition, contentWidth);
      yPosition = this.getNextYPosition(doc, yPosition, threatModel.documents.length * 12);
    }

    // Source Code Section
    if (threatModel.sourceCode && threatModel.sourceCode.length > 0) {
      // Check if we need a new page
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text(`Source Code (${threatModel.sourceCode.length})`, margin, yPosition);
      yPosition += 12;

      this.addSourceCodeTable(doc, threatModel.sourceCode, margin, yPosition, contentWidth);
    }
  }

  /**
   * Add threats table to PDF
   */
  private addThreatsTable(
    doc: jsPDF,
    threats: Threat[],
    x: number,
    y: number,
    width: number,
  ): void {
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    let currentY = y;

    // Table header
    doc.setFont('helvetica', 'bold');
    doc.text('Name', x, currentY);
    doc.text('Severity', x + width * 0.3, currentY);
    doc.text('Status', x + width * 0.5, currentY);
    doc.text('Type', x + width * 0.7, currentY);
    currentY += 8;

    // Separator line
    doc.line(x, currentY - 2, x + width, currentY - 2);

    // Threat data
    doc.setFont('helvetica', 'normal');
    threats.forEach(threat => {
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        currentY = 20;
      }

      const nameLines = doc.splitTextToSize(threat.name, width * 0.28) as string | string[];
      const descLines = doc.splitTextToSize(threat.description || '', width * 0.9) as
        | string
        | string[];
      const nameLinesArray = Array.isArray(nameLines) ? nameLines : [nameLines];
      const descLinesArray = Array.isArray(descLines) ? descLines : [descLines];

      doc.text(nameLines, x, currentY);
      doc.text(threat.severity, x + width * 0.3, currentY);
      doc.text(threat.status || 'Unknown', x + width * 0.5, currentY);
      doc.text(threat.threat_type, x + width * 0.7, currentY);

      currentY += Math.max(nameLinesArray.length * 4, 8);

      if (threat.description) {
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        doc.text(descLinesArray.slice(0, 2), x, currentY); // Limit to 2 lines
        currentY += Math.min(descLinesArray.length, 2) * 4 + 4;
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  /**
   * Add documents table to PDF
   */
  private addDocumentsTable(
    doc: jsPDF,
    documents: Document[],
    x: number,
    y: number,
    width: number,
  ): void {
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    let currentY = y;

    // Table header
    doc.setFont('helvetica', 'bold');
    doc.text('Name', x, currentY);
    doc.text('URL', x + width * 0.4, currentY);
    currentY += 8;

    // Separator line
    doc.line(x, currentY - 2, x + width, currentY - 2);

    // Document data
    doc.setFont('helvetica', 'normal');
    documents.forEach(document => {
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        currentY = 20;
      }

      const nameLines = doc.splitTextToSize(document.name, width * 0.35) as string | string[];
      const urlLines = doc.splitTextToSize(document.url, width * 0.55) as string | string[];
      const nameLinesArray = Array.isArray(nameLines) ? nameLines : [nameLines];
      const urlLinesArray = Array.isArray(urlLines) ? urlLines : [urlLines];

      doc.text(nameLines, x, currentY);
      doc.text(urlLines, x + width * 0.4, currentY);

      currentY += Math.max(nameLinesArray.length * 4, urlLinesArray.length * 4, 8);

      if (document.description) {
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        const descLines = doc.splitTextToSize(document.description, width * 0.9) as
          | string
          | string[];
        const descLinesArray = Array.isArray(descLines) ? descLines : [descLines];
        doc.text(descLinesArray.slice(0, 2), x, currentY); // Limit to 2 lines
        currentY += Math.min(descLinesArray.length, 2) * 4 + 4;
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  /**
   * Add source code table to PDF
   */
  private addSourceCodeTable(
    doc: jsPDF,
    sources: Source[],
    x: number,
    y: number,
    width: number,
  ): void {
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    let currentY = y;

    // Table header
    doc.setFont('helvetica', 'bold');
    doc.text('Name', x, currentY);
    doc.text('Type', x + width * 0.25, currentY);
    doc.text('URL', x + width * 0.4, currentY);
    doc.text('Ref', x + width * 0.7, currentY);
    currentY += 8;

    // Separator line
    doc.line(x, currentY - 2, x + width, currentY - 2);

    // Source data
    doc.setFont('helvetica', 'normal');
    sources.forEach(source => {
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        currentY = 20;
      }

      const nameLines = doc.splitTextToSize(source.name, width * 0.22) as string | string[];
      const urlLines = doc.splitTextToSize(source.url, width * 0.25) as string | string[];
      const nameLinesArray = Array.isArray(nameLines) ? nameLines : [nameLines];
      const urlLinesArray = Array.isArray(urlLines) ? urlLines : [urlLines];
      const ref = source.parameters
        ? `${source.parameters.refType}:${source.parameters.refValue}`
        : '';

      doc.text(nameLines, x, currentY);
      doc.text(source.type, x + width * 0.25, currentY);
      doc.text(urlLines, x + width * 0.4, currentY);
      doc.text(ref, x + width * 0.7, currentY);

      currentY += Math.max(nameLinesArray.length * 4, urlLinesArray.length * 4, 8);

      if (source.description) {
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        const descLines = doc.splitTextToSize(source.description, width * 0.9) as string | string[];
        const descLinesArray = Array.isArray(descLines) ? descLines : [descLines];
        doc.text(descLinesArray.slice(0, 1), x, currentY); // Limit to 1 line
        currentY += Math.min(descLinesArray.length, 1) * 4 + 4;
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  /**
   * Calculate next Y position with page break consideration
   */
  private getNextYPosition(doc: jsPDF, currentY: number, additionalHeight: number): number {
    const pageHeight = doc.internal.pageSize.height;
    const newY = currentY + additionalHeight;

    if (newY > pageHeight - 50) {
      doc.addPage();
      return 20;
    }

    return newY;
  }

  /**
   * Save PDF file using the same pattern as DFD export service
   */
  private async savePdfFile(doc: jsPDF, threatModelName: string): Promise<void> {
    const pdfBlob = doc.output('blob');
    const filename = this.generateFilename(threatModelName);

    // Check if File System Access API is supported
    if ('showSaveFilePicker' in window) {
      try {
        this.logger.debugComponent(
          'ThreatModelReport',
          'Using File System Access API for file save',
        );

        const fileHandle = await (
          window as unknown as { showSaveFilePicker: (options: unknown) => Promise<unknown> }
        ).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'PDF files',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });

        const writable = await (
          fileHandle as {
            createWritable: () => Promise<{
              write: (data: unknown) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }
        ).createWritable();
        await writable.write(pdfBlob);
        await writable.close();

        this.logger.info('PDF report saved successfully using File System Access API', {
          filename,
        });
        return;
      } catch (error) {
        // Handle File System Access API errors
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.logger.info('PDF report save cancelled by user');
          return;
        } else {
          this.logger.warn('File System Access API failed, falling back to download method', error);
        }
      }
    } else {
      this.logger.debugComponent(
        'ThreatModelReport',
        'File System Access API not supported, using fallback download method',
      );
    }

    // Fallback method for unsupported browsers or API failures
    try {
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.logger.info('PDF report downloaded successfully using fallback method', {
        filename,
      });
    } catch (fallbackError) {
      this.logger.error(
        'Both File System Access API and fallback method failed for PDF save',
        fallbackError,
      );
      throw fallbackError;
    }
  }

  /**
   * Generate filename for the PDF report
   * Format: "{threatModelName}.pdf"
   */
  private generateFilename(threatModelName: string): string {
    // Sanitize the name for filename use
    const sanitized = threatModelName
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename characters with dash
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes

    // Truncate if too long
    const maxLength = 200; // Leave room for .pdf extension
    const truncated = sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;

    return `${truncated}.pdf`;
  }
}
