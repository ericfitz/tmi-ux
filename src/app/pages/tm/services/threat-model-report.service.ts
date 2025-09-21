import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../core/services/logger.service';
import { LanguageService } from '../../../i18n/language.service';
import { ThreatModel, Threat, Document, Source } from '../models/threat-model.model';

// Font loading will be done dynamically to avoid build issues with large font files

interface DiagramImage {
  diagramId: string;
  diagramName: string;
  diagramType: string;
  imageData: string;
}

interface FontConfig {
  name: string;
  jsPDFName: string;
  fallbacks: string[];
  rtl?: boolean;
}

/**
 * Service responsible for generating PDF reports from threat models
 */
@Injectable({
  providedIn: 'root',
})
export class ThreatModelReportService {
  private fontConfigs: Map<string, FontConfig> = new Map([
    [
      'en-US',
      {
        name: 'Noto Sans',
        jsPDFName: 'NotoSans-VariableFont_wdth,wght',
        fallbacks: ['helvetica', 'arial'],
      },
    ],
    [
      'de',
      {
        name: 'Noto Sans',
        jsPDFName: 'NotoSans-VariableFont_wdth,wght',
        fallbacks: ['helvetica', 'arial'],
      },
    ],
    [
      'zh',
      {
        name: 'Noto Sans SC',
        jsPDFName: 'NotoSansSC-VariableFont_wght',
        fallbacks: ['NotoSansSC', 'simhei', 'simsun'],
      },
    ],
    [
      'ar',
      {
        name: 'Noto Sans Arabic',
        jsPDFName: 'NotoSansArabic-VariableFont_wdth,wght',
        fallbacks: ['NotoSansArabic', 'tahoma'],
        rtl: true,
      },
    ],
    [
      'th',
      {
        name: 'Noto Sans Thai',
        jsPDFName: 'NotoSansThai-VariableFont_wdth,wght',
        fallbacks: ['NotoSansThai', 'cordiaupc'],
      },
    ],
    [
      'ja',
      {
        name: 'Noto Sans JP',
        jsPDFName: 'NotoSansJP-VariableFont_wght',
        fallbacks: ['NotoSansJP'],
      },
    ],
    [
      'ko',
      {
        name: 'Noto Sans KR',
        jsPDFName: 'NotoSansKR-VariableFont_wght',
        fallbacks: ['NotoSansKR'],
      },
    ],
    [
      'he',
      {
        name: 'Noto Sans Hebrew',
        jsPDFName: 'NotoSansHebrew-VariableFont_wdth,wght',
        fallbacks: ['NotoSansHebrew'],
        rtl: true,
      },
    ],
  ]);


  private loadedFontNames: Set<string> = new Set();

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
      this.logger.info('Generating PDF report for threat model', {
        threatModelId: threatModel.id,
        threatModelName: threatModel.name,
      });

      // Create new PDF document
      const doc = new jsPDF();

      // Configure fonts and encoding for current language
      await this.configurePdfForLanguage(doc);

      // Render diagrams as images
      const diagramImages = this.renderDiagrams(threatModel);

      // Generate PDF content
      await this.createPdfContent(doc, threatModel, diagramImages);

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
   * Configure PDF document for proper font support based on current language
   */
  private async configurePdfForLanguage(doc: jsPDF): Promise<void> {
    const currentLang = this.transloco.getActiveLang();
    const fontConfig = this.fontConfigs.get(currentLang) || this.fontConfigs.get('en-US')!;

    this.logger.info('Configuring PDF fonts for language', {
      language: currentLang,
      fontConfig,
    });

    try {
      // Set document properties for proper handling
      doc.setProperties({
        title: 'Threat Model Report',
        creator: 'TMI Application',
      });

      // Set the embedded font for the document
      await this.setEmbeddedFont(doc, fontConfig, currentLang);

      // Set text direction for RTL languages
      if (fontConfig.rtl) {
        // Note: jsPDF has limited RTL support, we'll handle RTL in our text positioning
        // The setR2L method exists but we'll use our custom RTL handling instead
        this.logger.debugComponent('ThreatModelReport', 'Configuring RTL text handling');
      }
    } catch (error) {
      this.logger.warn('Error configuring PDF fonts, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to helvetica with UTF-8 support
      doc.setFont('helvetica');
    }
  }

  /**
   * Load font script dynamically and set the embedded font for the PDF document
   */
  private async setEmbeddedFont(doc: jsPDF, fontConfig: FontConfig, langCode: string): Promise<void> {
    try {
      // Load the font if not already loaded
      await this.loadFontScript(fontConfig, langCode);
      
      // Set the embedded font for the current language
      doc.setFont(fontConfig.jsPDFName, 'normal');
      this.logger.debugComponent(
        'ThreatModelReport',
        `Using embedded font: ${fontConfig.jsPDFName} for language: ${langCode}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to set embedded font ${fontConfig.jsPDFName}, using fallback`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Use first fallback font
      doc.setFont(fontConfig.fallbacks[0] || 'helvetica', 'normal');
    }
  }

  /**
   * Dynamically load font script if not already loaded
   */
  private async loadFontScript(fontConfig: FontConfig, langCode: string): Promise<void> {
    const fontKey = `${langCode}-${fontConfig.jsPDFName}`;
    
    if (this.loadedFontNames.has(fontKey)) {
      return; // Already loaded
    }

    return new Promise((resolve, reject) => {
      try {
        // Map language codes to font file names
        const fontFileMap: Record<string, string> = {
          'en-US': 'NotoSans-VariableFont_wdth,wght-normal.js',
          'de': 'NotoSans-VariableFont_wdth,wght-normal.js', 
          'zh': 'NotoSansSC-VariableFont_wght-normal.js',
          'ar': 'NotoSansArabic-VariableFont_wdth,wght-normal.js',
          'th': 'NotoSansThai-VariableFont_wdth,wght-normal.js',
          'ja': 'NotoSansJP-VariableFont_wght-normal.js',
          'ko': 'NotoSansKR-VariableFont_wght-normal.js',
          'he': 'NotoSansHebrew-VariableFont_wdth,wght-normal.js'
        };

        const fontFileName = fontFileMap[langCode];
        if (!fontFileName) {
          this.logger.warn(`No font file mapping for language: ${langCode}`);
          resolve();
          return;
        }

        // Check if script already exists
        const scriptId = `font-${fontKey}`;
        if (document.getElementById(scriptId)) {
          this.loadedFontNames.add(fontKey);
          resolve();
          return;
        }

        // Create and load script
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `assets/fonts/${fontFileName}`;
        script.onload = () => {
          this.loadedFontNames.add(fontKey);
          this.logger.debugComponent('ThreatModelReport', `Font script loaded: ${fontFileName}`);
          resolve();
        };
        script.onerror = () => {
          this.logger.warn(`Failed to load font script: ${fontFileName}`);
          reject(new Error(`Failed to load font script: ${fontFileName}`));
        };
        
        document.head.appendChild(script);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Add text with proper language and RTL support using embedded fonts
   */
  private addTextWithLanguageSupport(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    options: {
      isRTL?: boolean;
      contentWidth?: number;
      maxWidth?: number;
    } = {},
  ): void {
    try {
      const {
        isRTL = false,
        contentWidth,
        maxWidth,
      } = options;
      const currentLang = this.transloco.getActiveLang();
      const fontConfig = this.fontConfigs.get(currentLang) || this.fontConfigs.get('en-US')!;

      // Set the embedded font for the current language
      try {
        doc.setFont(fontConfig.jsPDFName, 'normal');
        this.logger.debugComponent(
          'ThreatModelReport',
          `Using embedded font: ${fontConfig.jsPDFName} for language: ${currentLang}`,
        );
      } catch (fontError) {
        this.logger.warn(`Failed to set embedded font ${fontConfig.jsPDFName}, using fallback`, {
          error: fontError instanceof Error ? fontError.message : String(fontError),
        });
        // Use first fallback font
        doc.setFont(fontConfig.fallbacks[0] || 'helvetica', 'normal');
      }

      // Use standard jsPDF text rendering with the embedded font
      this.addStandardText(doc, text, x, y, { isRTL, contentWidth, maxWidth });
    } catch (error) {
      this.logger.warn('Error adding text with language support, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to basic text rendering
      doc.setFont('helvetica', 'normal');
      doc.text(text, x, y);
    }
  }


  /**
   * Add text using standard jsPDF text rendering
   */
  private addStandardText(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    options: { isRTL?: boolean; contentWidth?: number; maxWidth?: number } = {},
  ): void {
    const { isRTL = false, contentWidth, maxWidth } = options;

    // For RTL languages, adjust text positioning
    if (isRTL && contentWidth) {
      // Measure text width and position from right
      const textWidth = doc.getTextWidth(text);
      const adjustedX = x + contentWidth - textWidth;
      doc.text(text, adjustedX, y);
    } else if (maxWidth) {
      // Handle text wrapping
      const lines = doc.splitTextToSize(text, maxWidth) as string | string[];
      doc.text(lines, x, y);
    } else {
      // Standard left-to-right text
      doc.text(text, x, y);
    }
  }

  /**
   * Get diagram data for SVG rendering in PDF
   */
  private renderDiagrams(threatModel: ThreatModel): DiagramImage[] {
    const diagramImages: DiagramImage[] = [];

    if (!threatModel.diagrams || threatModel.diagrams.length === 0) {
      return diagramImages;
    }

    // Extract actual SVG data from diagrams
    for (const diagram of threatModel.diagrams) {
      diagramImages.push({
        diagramId: diagram.id,
        diagramName: diagram.name || this.transloco.translate('threatModels.diagramName'),
        diagramType: diagram.type || 'Unknown',
        imageData: diagram.image?.svg || '', // Base64 encoded SVG
      });
    }

    this.logger.info('Extracted diagram SVG data for PDF report', {
      diagramCount: diagramImages.length,
      diagramsWithImages: diagramImages.filter(d => d.imageData).length,
    });

    return diagramImages;
  }

  /**
   * Create PDF content using jsPDF
   */
  private async createPdfContent(
    doc: jsPDF,
    threatModel: ThreatModel,
    diagramImages: DiagramImage[],
  ): Promise<void> {
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - 2 * margin;
    const currentLang = this.transloco.getActiveLang();
    const isRTL = this.fontConfigs.get(currentLang)?.rtl || false;

    // Title
    doc.setFontSize(24);
    doc.setTextColor(51, 51, 51);
    this.addTextWithLanguageSupport(doc, threatModel.name, margin, yPosition, {
      isRTL,
      contentWidth,
    });
    yPosition += 15;

    // Description
    if (threatModel.description) {
      doc.setFontSize(12);
      doc.setTextColor(102, 102, 102);
      const descriptionLines = doc.splitTextToSize(threatModel.description, contentWidth) as
        | string
        | string[];
      const linesArray = Array.isArray(descriptionLines) ? descriptionLines : [descriptionLines];

      if (Array.isArray(descriptionLines)) {
        descriptionLines.forEach((line, index) => {
          this.addTextWithLanguageSupport(doc, line, margin, yPosition + index * 5, {
            isRTL,
            contentWidth,
          });
        });
      } else {
        this.addTextWithLanguageSupport(doc, descriptionLines, margin, yPosition, {
          isRTL,
          contentWidth,
        });
      }
      yPosition += linesArray.length * 5 + 10;
    }

    // Basic Information Section
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const frameworkText = `${this.transloco.translate('threatModels.threatModelFramework')}: ${threatModel.threat_model_framework}`;
    const ownerText = `${this.transloco.translate('common.roles.owner')}: ${threatModel.owner}`;

    if (isRTL) {
      this.addTextWithLanguageSupport(doc, frameworkText, margin, yPosition, {
        isRTL,
        contentWidth: contentWidth / 2,
      });
      this.addTextWithLanguageSupport(doc, ownerText, margin + contentWidth / 2, yPosition, {
        isRTL,
        contentWidth: contentWidth / 2,
      });
    } else {
      this.addTextWithLanguageSupport(doc, frameworkText, margin, yPosition);
      this.addTextWithLanguageSupport(doc, ownerText, margin + contentWidth / 2, yPosition);
    }
    yPosition += 8;

    const createdText = `${this.transloco.translate('common.created')}: ${new Date(threatModel.created_at).toLocaleDateString()}`;
    const modifiedText = `${this.transloco.translate('common.lastModified')}: ${new Date(threatModel.modified_at).toLocaleDateString()}`;

    if (isRTL) {
      this.addTextWithLanguageSupport(doc, createdText, margin, yPosition, {
        isRTL,
        contentWidth: contentWidth / 2,
      });
      this.addTextWithLanguageSupport(doc, modifiedText, margin + contentWidth / 2, yPosition, {
        isRTL,
        contentWidth: contentWidth / 2,
      });
    } else {
      this.addTextWithLanguageSupport(doc, createdText, margin, yPosition);
      this.addTextWithLanguageSupport(doc, modifiedText, margin + contentWidth / 2, yPosition);
    }
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
      this.addTextWithLanguageSupport(
        doc,
        this.transloco.translate('threatModels.diagrams'),
        margin,
        yPosition,
        { isRTL, contentWidth },
      );
      yPosition += 12;

      for (const diagram of diagramImages) {
        // Check if we need a new page for the diagram
        if (yPosition > pageHeight - 200) {
          doc.addPage();
          yPosition = 20;
        }

        // Diagram name and type
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        this.addTextWithLanguageSupport(doc, diagram.diagramName, margin, yPosition, {
          isRTL,
          contentWidth,
        });
        yPosition += 8;

        doc.setFontSize(10);
        doc.setTextColor(102, 102, 102);
        const diagramTypeText = `${this.transloco.translate('threatModels.diagramType')}: ${diagram.diagramType}`;
        this.addTextWithLanguageSupport(doc, diagramTypeText, margin, yPosition, {
          isRTL,
          contentWidth,
        });
        yPosition += 10;

        // Render actual SVG if available
        if (diagram.imageData) {
          try {
            // Calculate display dimensions for PDF (what will be shown in the PDF)
            const maxDisplayWidth = contentWidth * 0.8; // Use 80% of content width
            const maxDisplayHeight = 200; // Increased for better visibility

            // Get original SVG dimensions to calculate aspect ratio
            const svgDimensions = await this.extractSvgDimensions(diagram.imageData);
            const aspectRatio = svgDimensions.width / svgDimensions.height;

            let displayWidth = maxDisplayWidth;
            let displayHeight = maxDisplayWidth / aspectRatio;

            // If height exceeds max, constrain by height
            if (displayHeight > maxDisplayHeight) {
              displayHeight = maxDisplayHeight;
              displayWidth = maxDisplayHeight * aspectRatio;
            }

            // Render at ultra-high resolution (5K width) for maximum quality
            const targetRenderWidth = 5120; // 5K width
            const renderWidth = targetRenderWidth;
            const renderHeight = Math.round(targetRenderWidth / aspectRatio);

            this.logger.info('Rendering diagram at ultra-high resolution', {
              diagramId: diagram.diagramId,
              originalDimensions: svgDimensions,
              displayDimensions: { width: displayWidth, height: displayHeight },
              renderDimensions: { width: renderWidth, height: renderHeight },
              scaleFactor: renderWidth / displayWidth,
            });

            // Convert SVG to ultra-high-resolution PNG
            const pngDataUrl = await this.convertSvgToPng(
              diagram.imageData,
              renderWidth,
              renderHeight,
            );

            // Add the PNG image to the PDF at display size
            doc.addImage(pngDataUrl, 'PNG', margin, yPosition, displayWidth, displayHeight);
            yPosition += displayHeight + 15;
          } catch (error) {
            this.logger.warn('Failed to render SVG diagram in PDF', {
              diagramId: diagram.diagramId,
              error,
            });
            // Fallback to placeholder text
            doc.setFontSize(10);
            doc.setTextColor(102, 102, 102);
            doc.text('📊 Diagram rendering failed - view in DFD Editor', margin, yPosition);
            yPosition += 15;
          }
        } else {
          // No image data available
          doc.setFontSize(10);
          doc.setTextColor(102, 102, 102);
          doc.text('📊 No diagram image available - view in DFD Editor', margin, yPosition);
          yPosition += 15;
        }
      }
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
      doc.text(
        `${this.transloco.translate('common.objectTypes.documents')} (${threatModel.documents.length})`,
        margin,
        yPosition,
      );
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
      doc.text(
        `${this.transloco.translate('common.objectTypes.sourceCode')} (${threatModel.sourceCode.length})`,
        margin,
        yPosition,
      );
      yPosition += 12;

      this.addSourceCodeTable(doc, threatModel.sourceCode, margin, yPosition, contentWidth);
      yPosition = this.getNextYPosition(doc, yPosition, threatModel.sourceCode.length * 12);
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
      doc.text(
        `${this.transloco.translate('common.objectTypes.threats')} (${threatModel.threats.length})`,
        margin,
        yPosition,
      );
      yPosition += 12;

      this.addThreatsTable(doc, threatModel.threats, margin, yPosition, contentWidth);
      yPosition = this.getNextYPosition(doc, yPosition, threatModel.threats.length * 15);
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
    doc.text(this.transloco.translate('threatModels.name'), x, currentY);
    doc.text(this.transloco.translate('common.severity'), x + width * 0.25, currentY);
    doc.text(this.transloco.translate('common.status'), x + width * 0.4, currentY);
    doc.text(this.transloco.translate('common.threatType'), x + width * 0.55, currentY);
    doc.text(this.transloco.translate('common.priority'), x + width * 0.7, currentY);
    doc.text(this.transloco.translate('common.score'), x + width * 0.85, currentY);
    currentY += 6;

    // Separator line - positioned below text with proper spacing
    doc.line(x, currentY, x + width, currentY);
    currentY += 4;

    // Threat data
    doc.setFont('helvetica', 'normal');
    threats.forEach(threat => {
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        currentY = 20;
      }

      const nameLines = doc.splitTextToSize(threat.name, width * 0.22) as string | string[];
      const descLines = doc.splitTextToSize(threat.description || '', width * 0.9) as
        | string
        | string[];
      const nameLinesArray = Array.isArray(nameLines) ? nameLines : [nameLines];
      const descLinesArray = Array.isArray(descLines) ? descLines : [descLines];

      doc.text(nameLines, x, currentY);
      doc.text(threat.severity, x + width * 0.25, currentY);
      doc.text(
        threat.status || this.transloco.translate('common.severityUnknown'),
        x + width * 0.4,
        currentY,
      );
      doc.text(threat.threat_type, x + width * 0.55, currentY);
      doc.text(threat.priority || '', x + width * 0.7, currentY);
      doc.text(threat.score ? threat.score.toString() : '', x + width * 0.85, currentY);

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
    doc.text(this.transloco.translate('threatModels.name'), x, currentY);
    doc.text(this.transloco.translate('common.objectTypes.document'), x + width * 0.25, currentY);
    doc.text(this.transloco.translate('common.description'), x + width * 0.5, currentY);
    currentY += 6;

    // Separator line - positioned below text with proper spacing
    doc.line(x, currentY, x + width, currentY);
    currentY += 4;

    // Document data
    doc.setFont('helvetica', 'normal');
    documents.forEach(document => {
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        currentY = 20;
      }

      const nameLines = doc.splitTextToSize(document.name, width * 0.22) as string | string[];
      const typeText =
        document.metadata?.find(m => m.key === 'document_type')?.value ||
        this.transloco.translate('common.other');
      const typeLines = doc.splitTextToSize(typeText || '', width * 0.22) as string | string[];
      const descLines = doc.splitTextToSize(document.description || '', width * 0.45) as
        | string
        | string[];
      const nameLinesArray = Array.isArray(nameLines) ? nameLines : [nameLines];
      const typeLinesArray = Array.isArray(typeLines) ? typeLines : [typeLines];
      const descLinesArray = Array.isArray(descLines) ? descLines : [descLines];

      doc.text(nameLines, x, currentY);
      doc.text(typeLines, x + width * 0.25, currentY);
      doc.text(descLines, x + width * 0.5, currentY);

      currentY += Math.max(
        nameLinesArray.length * 4,
        typeLinesArray.length * 4,
        descLinesArray.length * 4,
        8,
      );

      // Add a small gap between entries
      currentY += 4;
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
    doc.text(this.transloco.translate('threatModels.name'), x, currentY);
    doc.text(this.transloco.translate('threatModels.sourceCodeType'), x + width * 0.2, currentY);
    doc.text(this.transloco.translate('common.description'), x + width * 0.35, currentY);
    doc.text(this.transloco.translate('threatModels.sourceCodeRefType'), x + width * 0.6, currentY);
    doc.text(
      this.transloco.translate('threatModels.sourceCodeRefValue'),
      x + width * 0.8,
      currentY,
    );
    currentY += 6;

    // Separator line - positioned below text with proper spacing
    doc.line(x, currentY, x + width, currentY);
    currentY += 4;

    // Source data
    doc.setFont('helvetica', 'normal');
    sources.forEach(source => {
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        currentY = 20;
      }

      const nameLines = doc.splitTextToSize(source.name, width * 0.18) as string | string[];
      const descLines = doc.splitTextToSize(source.description || '', width * 0.22) as
        | string
        | string[];
      const refType = source.parameters?.refType || '';
      const refValue = source.parameters?.refValue || '';
      const nameLinesArray = Array.isArray(nameLines) ? nameLines : [nameLines];
      const descLinesArray = Array.isArray(descLines) ? descLines : [descLines];

      doc.text(nameLines, x, currentY);
      doc.text(source.type, x + width * 0.2, currentY);
      doc.text(descLines, x + width * 0.35, currentY);
      doc.text(refType, x + width * 0.6, currentY);
      doc.text(refValue, x + width * 0.8, currentY);

      currentY += Math.max(nameLinesArray.length * 4, descLinesArray.length * 4, 8);

      // Add a small gap between entries
      currentY += 4;
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
   * Extract dimensions from SVG content
   * @param base64Svg Base64 encoded SVG string
   * @returns Promise resolving to SVG dimensions
   */
  private extractSvgDimensions(base64Svg: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      try {
        // Decode the base64 SVG
        const svgString = atob(base64Svg);

        // Parse SVG to extract viewBox or width/height
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');

        if (!svgElement) {
          reject(new Error('Invalid SVG content'));
          return;
        }

        let width = 800; // Default fallback
        let height = 600; // Default fallback

        // Try to get dimensions from viewBox first
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
          if (vbWidth && vbHeight) {
            width = vbWidth;
            height = vbHeight;
          }
        } else {
          // Fall back to width/height attributes
          const widthAttr = svgElement.getAttribute('width');
          const heightAttr = svgElement.getAttribute('height');

          if (widthAttr && heightAttr) {
            width = parseFloat(widthAttr);
            height = parseFloat(heightAttr);
          }
        }

        resolve({ width, height });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Convert base64 SVG to ultra-high-resolution PNG data URL for PDF rendering
   * Renders at 5K resolution (5120px width) and scales down for maximum quality
   * @param base64Svg Base64 encoded SVG string
   * @param width Target render width (ultra-high resolution, typically 5120px)
   * @param height Target render height (ultra-high resolution, proportional)
   * @returns Promise resolving to PNG data URL
   */
  private convertSvgToPng(base64Svg: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Decode the base64 SVG
        const svgString = atob(base64Svg);

        // Create a blob from the SVG string
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        // Create an image element
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          try {
            // Create a canvas element
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }

            // Set canvas dimensions to exact target size
            canvas.width = width;
            canvas.height = height;

            // Enable high-quality rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Fill with white background (important for PDF)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            // Draw the image to fill the entire canvas (already sized correctly)
            ctx.drawImage(img, 0, 0, width, height);

            // Convert canvas to PNG data URL with high quality
            const pngDataUrl = canvas.toDataURL('image/png', 1.0); // Maximum quality

            // Clean up
            URL.revokeObjectURL(svgUrl);

            resolve(pngDataUrl);
          } catch (error) {
            URL.revokeObjectURL(svgUrl);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          reject(new Error('Failed to load SVG image'));
        };

        // Load the SVG
        img.src = svgUrl;
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
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
