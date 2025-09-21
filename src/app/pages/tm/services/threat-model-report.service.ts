import { Injectable } from '@angular/core';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../core/services/logger.service';
import { LanguageService } from '../../../i18n/language.service';
import { ThreatModel, Threat, Document, Source } from '../models/threat-model.model';

interface FontConfig {
  name: string;
  fontPath: string;
  fallbacks: string[];
  rtl?: boolean;
}

/**
 * Service responsible for generating PDF reports from threat models using pdf-lib
 */
@Injectable({
  providedIn: 'root',
})
export class ThreatModelReportService {
  private fontConfigs: Map<string, FontConfig> = new Map([
    [
      'en-US',
      {
        name: 'NotoSans',
        fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
      },
    ],
    [
      'de',
      {
        name: 'NotoSans',
        fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
      },
    ],
    [
      'zh',
      {
        name: 'NotoSansSC',
        fontPath: 'assets/fonts/ttf/NotoSansSC-VariableFont_wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
      },
    ],
    [
      'ar',
      {
        name: 'NotoSansArabic',
        fontPath: 'assets/fonts/ttf/NotoSansArabic-VariableFont_wdth,wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
        rtl: true,
      },
    ],
    [
      'th',
      {
        name: 'NotoSansThai',
        fontPath: 'assets/fonts/ttf/NotoSansThai-VariableFont_wdth,wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
      },
    ],
    [
      'ja',
      {
        name: 'NotoSansJP',
        fontPath: 'assets/fonts/ttf/NotoSansJP-VariableFont_wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
      },
    ],
    [
      'ko',
      {
        name: 'NotoSansKR',
        fontPath: 'assets/fonts/ttf/NotoSansKR-VariableFont_wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
      },
    ],
    [
      'he',
      {
        name: 'NotoSansHebrew',
        fontPath: 'assets/fonts/ttf/NotoSansHebrew-VariableFont_wdth,wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
        rtl: true,
      },
    ],
  ]);

  private loadedFonts: Map<string, Uint8Array> = new Map();
  private currentFont: any = StandardFonts.Helvetica;

  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
    private languageService: LanguageService,
  ) {}

  /**
   * Generate a PDF report for the given threat model
   */
  async generateReport(threatModel: ThreatModel): Promise<void> {
    try {
      this.logger.info('Generating PDF report with pdf-lib', {
        threatModelId: threatModel.id,
        threatModelName: threatModel.name,
      });

      // Create pdf-lib document
      const doc = await PDFDocument.create();
      
      // Set document metadata
      doc.setTitle(`Threat Model Report - ${threatModel.name}`);
      doc.setAuthor('TMI Application');
      doc.setSubject(`Threat Model: ${threatModel.name}`);
      doc.setCreator('TMI Application');
      doc.setProducer('TMI Application');

      // Load fonts for the current language
      await this.loadFonts(doc);

      // Generate report content
      await this.generateReportContent(doc, threatModel);

      // Save the PDF
      await this.savePdf(doc, threatModel.name);

      this.logger.info('PDF report generated successfully with pdf-lib', {
        threatModelName: threatModel.name,
      });
    } catch (error) {
      this.logger.error('Error generating PDF report with pdf-lib', error);
      throw error;
    }
  }

  /**
   * Load and register fonts for the current language
   */
  private async loadFonts(doc: PDFDocument): Promise<void> {
    try {
      const currentLang = this.transloco.getActiveLang();
      const fontConfig = this.fontConfigs.get(currentLang) || this.fontConfigs.get('en-US')!;

      this.logger.info('Loading fonts for language', {
        language: currentLang,
        fontConfig: fontConfig.name,
      });

      // Use standard fonts for now to avoid font loading issues
      this.logger.info(`Using standard Helvetica font for language: ${currentLang}`);
      this.currentFont = await doc.embedFont(StandardFonts.Helvetica);
    } catch (error) {
      this.logger.error('Error loading fonts, using Helvetica fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.currentFont = await doc.embedFont(StandardFonts.Helvetica);
    }
  }

  /**
   * Fetch font file as Uint8Array
   */
  private async fetchFont(fontPath: string): Promise<Uint8Array> {
    const cacheKey = fontPath;
    
    if (this.loadedFonts.has(cacheKey)) {
      return this.loadedFonts.get(cacheKey)!;
    }

    const response = await fetch(fontPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
    }

    const fontData = new Uint8Array(await response.arrayBuffer());
    this.loadedFonts.set(cacheKey, fontData);
    return fontData;
  }

  /**
   * Generate the complete report content
   */
  private async generateReportContent(doc: PDFDocument, threatModel: ThreatModel): Promise<void> {
    let page = doc.addPage();
    let yPosition = page.getHeight() - 50;

    // Title
    yPosition = this.addTitle(page, threatModel.name, yPosition);

    // Threat Model Summary
    yPosition = this.addThreatModelSummary(page, threatModel, yPosition);

    // Diagrams Section
    if (threatModel.diagrams && threatModel.diagrams.length > 0) {
      const result = this.addDiagramsSection(doc, page, threatModel, yPosition);
      page = result.page;
      yPosition = result.yPosition;
    }

    // Documents Table
    if (threatModel.documents && threatModel.documents.length > 0) {
      const result = this.addDocumentsSection(doc, page, threatModel.documents, yPosition);
      page = result.page;
      yPosition = result.yPosition;
    }

    // Source Code Table
    if (threatModel.sourceCode && threatModel.sourceCode.length > 0) {
      const result = this.addSourceCodeSection(doc, page, threatModel.sourceCode, yPosition);
      page = result.page;
      yPosition = result.yPosition;
    }

    // Threats Table
    if (threatModel.threats && threatModel.threats.length > 0) {
      this.addThreatsSection(doc, page, threatModel.threats, yPosition);
    }
  }

  /**
   * Add report title
   */
  private addTitle(page: PDFPage, title: string, yPosition: number): number {
    const fontSize = 24;
    const textWidth = this.currentFont.widthOfTextAtSize(title, fontSize);
    const x = (page.getWidth() - textWidth) / 2;
    
    page.drawText(title, {
      x,
      y: yPosition,
      size: fontSize,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });
    
    return yPosition - 50;
  }

  /**
   * Add threat model summary section
   */
  private addThreatModelSummary(page: PDFPage, threatModel: ThreatModel, yPosition: number): number {
    const sectionTitle = this.transloco.translate('threatModels.summary');
    
    page.drawText(sectionTitle, {
      x: 50,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });
    
    yPosition -= 30;

    const summaryItems = [
      { 
        label: this.transloco.translate('threatModels.description'), 
        value: threatModel.description || this.transloco.translate('common.noDataAvailable')
      },
      { 
        label: this.transloco.translate('common.owner'), 
        value: threatModel.owner || this.transloco.translate('common.noDataAvailable')
      },
      { 
        label: this.transloco.translate('common.createdAt'), 
        value: this.formatDate(threatModel.created_at) 
      },
      { 
        label: this.transloco.translate('common.updatedAt'), 
        value: this.formatDate(threatModel.modified_at) 
      },
      { 
        label: this.transloco.translate('threatModels.framework'), 
        value: threatModel.threat_model_framework || this.transloco.translate('common.noDataAvailable')
      },
    ];

    summaryItems.forEach(item => {
      page.drawText(`${item.label}: ${item.value}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: this.currentFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    });

    return yPosition - 20;
  }

  /**
   * Add diagrams section
   */
  private addDiagramsSection(doc: PDFDocument, page: PDFPage, threatModel: ThreatModel, yPosition: number): { page: PDFPage; yPosition: number } {
    if (yPosition < 200) {
      page = doc.addPage();
      yPosition = page.getHeight() - 50;
    }

    const sectionTitle = this.transloco.translate('threatModels.diagrams');
    
    page.drawText(sectionTitle, {
      x: 50,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });
    
    yPosition -= 30;

    if (!threatModel.diagrams || threatModel.diagrams.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: 50,
        y: yPosition,
        size: 12,
        font: this.currentFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      return { page, yPosition: yPosition - 20 };
    }

    threatModel.diagrams.forEach((diagram, index) => {
      if (index > 0 || yPosition < 350) {
        page = doc.addPage();
        yPosition = page.getHeight() - 50;
      }

      page.drawText(diagram.name, {
        x: 50,
        y: yPosition,
        size: 14,
        font: this.currentFont,
        color: rgb(0, 0, 0),
      });
      
      yPosition -= 30;

      // Add SVG placeholder - pdf-lib doesn't support SVG directly
      if (diagram.image?.svg) {
        try {
          // Draw a placeholder rectangle for the diagram
          page.drawRectangle({
            x: 50,
            y: yPosition - 200,
            width: 400,
            height: 200,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
          });
          
          page.drawText(`Diagram: ${diagram.name}`, {
            x: 250 - (this.currentFont.widthOfTextAtSize(`Diagram: ${diagram.name}`, 10) / 2),
            y: yPosition - 100,
            size: 10,
            font: this.currentFont,
            color: rgb(0.4, 0.4, 0.4),
          });
          
          yPosition -= 220;
        } catch (error) {
          this.logger.warn('Failed to render SVG diagram', { diagramId: diagram.id, error });
          page.drawText('Diagram could not be rendered', {
            x: 50,
            y: yPosition,
            size: 10,
            font: this.currentFont,
            color: rgb(0.4, 0.4, 0.4),
          });
          yPosition -= 20;
        }
      }
    });

    return { page, yPosition };
  }

  /**
   * Add documents section with table
   */
  private addDocumentsSection(doc: PDFDocument, page: PDFPage, documents: Document[], yPosition: number): { page: PDFPage; yPosition: number } {
    if (yPosition < 200) {
      page = doc.addPage();
      yPosition = page.getHeight() - 50;
    }

    const sectionTitle = this.transloco.translate('threatModels.documents');
    
    page.drawText(sectionTitle, {
      x: 50,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });
    
    yPosition -= 30;

    if (documents.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: 50,
        y: yPosition,
        size: 12,
        font: this.currentFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      return { page, yPosition: yPosition - 20 };
    }

    // Table headers
    const headers = [
      this.transloco.translate('threatModels.name'),
      this.transloco.translate('common.url'),
      this.transloco.translate('common.description'),
    ];

    yPosition = this.drawTableRow(page, headers, yPosition, true);
    yPosition -= 10;

    // Table rows
    documents.forEach((document) => {
      if (yPosition < 50) {
        page = doc.addPage();
        yPosition = page.getHeight() - 50;
      }

      const rowData: string[] = [
        document.name || this.transloco.translate('common.noDataAvailable'),
        document.url || this.transloco.translate('common.noDataAvailable'),
        document.description || this.transloco.translate('common.noDataAvailable'),
      ];

      yPosition = this.drawTableRow(page, rowData, yPosition, false);
    });

    return { page, yPosition: yPosition - 20 };
  }

  /**
   * Add source code section with table
   */
  private addSourceCodeSection(doc: PDFDocument, page: PDFPage, sources: Source[], yPosition: number): { page: PDFPage; yPosition: number } {
    if (yPosition < 200) {
      page = doc.addPage();
      yPosition = page.getHeight() - 50;
    }

    const sectionTitle = this.transloco.translate('threatModels.sourceCode');
    
    page.drawText(sectionTitle, {
      x: 50,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });
    
    yPosition -= 30;

    if (sources.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: 50,
        y: yPosition,
        size: 12,
        font: this.currentFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      return { page, yPosition: yPosition - 20 };
    }

    // Table headers
    const headers = [
      this.transloco.translate('threatModels.name'),
      this.transloco.translate('threatModels.sourceCodeType'),
      this.transloco.translate('common.url'),
      this.transloco.translate('common.description'),
    ];

    yPosition = this.drawTableRow(page, headers, yPosition, true);
    yPosition -= 10;

    // Table rows
    sources.forEach((source) => {
      if (yPosition < 50) {
        page = doc.addPage();
        yPosition = page.getHeight() - 50;
      }

      const rowData: string[] = [
        source.name || this.transloco.translate('common.noDataAvailable'),
        source.type || this.transloco.translate('common.noDataAvailable'),
        source.url || this.transloco.translate('common.noDataAvailable'),
        source.description || this.transloco.translate('common.noDataAvailable'),
      ];

      yPosition = this.drawTableRow(page, rowData, yPosition, false);
    });

    return { page, yPosition: yPosition - 20 };
  }

  /**
   * Add threats section with table
   */
  private addThreatsSection(doc: PDFDocument, page: PDFPage, threats: Threat[], yPosition: number): { page: PDFPage; yPosition: number } {
    if (yPosition < 200) {
      page = doc.addPage();
      yPosition = page.getHeight() - 50;
    }

    const sectionTitle = this.transloco.translate('threatModels.threats');
    
    page.drawText(sectionTitle, {
      x: 50,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });
    
    yPosition -= 30;

    if (threats.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: 50,
        y: yPosition,
        size: 12,
        font: this.currentFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      return { page, yPosition: yPosition - 20 };
    }

    // Table headers
    const headers = [
      this.transloco.translate('threatModels.name'),
      this.transloco.translate('common.severity'),
      this.transloco.translate('common.status'),
      this.transloco.translate('common.priority'),
    ];

    yPosition = this.drawTableRow(page, headers, yPosition, true);
    yPosition -= 10;

    // Table rows
    threats.forEach((threat) => {
      if (yPosition < 50) {
        page = doc.addPage();
        yPosition = page.getHeight() - 50;
      }

      const rowData: string[] = [
        threat.name || this.transloco.translate('common.noDataAvailable'),
        threat.severity || this.transloco.translate('common.noDataAvailable'),
        threat.status || this.transloco.translate('common.noDataAvailable'),
        threat.priority?.toString() || this.transloco.translate('common.noDataAvailable'),
      ];

      yPosition = this.drawTableRow(page, rowData, yPosition, false);
    });

    return { page, yPosition: yPosition - 20 };
  }

  /**
   * Draw a table row
   */
  private drawTableRow(page: PDFPage, data: string[], yPosition: number, isHeader: boolean): number {
    const columnWidths = [120, 120, 120, 120];
    const startX = 50;
    let currentX = startX;
    const fontSize = isHeader ? 12 : 10;
    const color = isHeader ? rgb(0, 0, 0) : rgb(0.2, 0.2, 0.2);

    data.forEach((text, index) => {
      if (index < columnWidths.length) {
        // Truncate text if too long
        const maxWidth = columnWidths[index] - 10;
        const textWidth = this.currentFont.widthOfTextAtSize(text, fontSize);
        let displayText = text;
        
        if (textWidth > maxWidth) {
          // Estimate characters that fit
          const avgCharWidth = textWidth / text.length;
          const maxChars = Math.floor(maxWidth / avgCharWidth) - 3;
          displayText = text.substring(0, maxChars) + '...';
        }

        page.drawText(displayText, {
          x: currentX,
          y: yPosition,
          size: fontSize,
          font: this.currentFont,
          color,
        });
        currentX += columnWidths[index];
      }
    });

    // Draw horizontal line under header
    if (isHeader) {
      page.drawLine({
        start: { x: startX, y: yPosition - 5 },
        end: { x: startX + columnWidths.reduce((sum, width) => sum + width, 0), y: yPosition - 5 },
        color: rgb(0.8, 0.8, 0.8),
        thickness: 1,
      });
    }

    return yPosition - (isHeader ? 25 : 20);
  }

  /**
   * Format date for display with localization
   */
  private formatDate(date: string | Date | undefined): string {
    if (!date) return this.transloco.translate('common.noDataAvailable');
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString(this.transloco.getActiveLang(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return this.transloco.translate('common.noDataAvailable');
    }
  }

  /**
   * Save PDF to file
   */
  private async savePdf(doc: PDFDocument, filename: string): Promise<void> {
    try {
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes] as BlobPart[], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      this.logger.error('Error saving PDF', error);
      throw error;
    }
  }
}