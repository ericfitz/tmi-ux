import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../core/services/logger.service';
import { LanguageService } from '../../../i18n/language.service';
import { ThreatModel, Threat, Document, Source } from '../models/threat-model.model';

interface DiagramImage {
  diagramId: string;
  diagramName: string;
  diagramType: string;
  imageData: string;
}

interface FontConfig {
  name: string;
  fallbacks: string[];
  rtl?: boolean;
  googleFontUrl?: string;
}

interface LoadedFont {
  fontName: string;
  fontData: string;
  loaded: boolean;
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
        fallbacks: ['helvetica', 'arial'],
        googleFontUrl:
          'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap',
      },
    ],
    [
      'de',
      {
        name: 'Noto Sans',
        fallbacks: ['helvetica', 'arial'],
        googleFontUrl:
          'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap',
      },
    ],
    [
      'zh',
      {
        name: 'Noto Sans SC',
        fallbacks: ['NotoSansSC', 'simhei', 'simsun'],
        googleFontUrl:
          'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
      },
    ],
    [
      'ar',
      {
        name: 'Noto Sans Arabic',
        fallbacks: ['NotoSansArabic', 'tahoma'],
        rtl: true,
        googleFontUrl:
          'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap',
      },
    ],
    [
      'th',
      {
        name: 'Noto Sans Thai',
        fallbacks: ['NotoSansThai', 'cordiaupc'],
        googleFontUrl:
          'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700&display=swap',
      },
    ],
  ]);

  private loadedFonts: Map<string, LoadedFont> = new Map();

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

      // Load Google Fonts and configure fonts
      await this.loadGoogleFontsAndConfigure(doc, fontConfig, currentLang);

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
   * Load Google Fonts and configure PDF document fonts
   */
  private async loadGoogleFontsAndConfigure(
    doc: jsPDF,
    fontConfig: FontConfig,
    langCode: string,
  ): Promise<void> {
    try {
      // Load Google Font CSS if specified
      if (fontConfig.googleFontUrl) {
        await this.loadGoogleFont(fontConfig.googleFontUrl, fontConfig.name);
      }

      // Wait for font to be available and set it
      this.setDocumentFont(doc, fontConfig, langCode);
    } catch (error) {
      this.logger.warn('Failed to load Google Font, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.setFontWithFallback(doc, fontConfig);
    }
  }

  /**
   * Load Google Font CSS and ensure font is available
   */
  private async loadGoogleFont(fontUrl: string, fontName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if font is already loaded
        const fontKey = `google-${fontName}`;
        if (this.loadedFonts.has(fontKey) && this.loadedFonts.get(fontKey)?.loaded) {
          resolve();
          return;
        }

        // Check if font link already exists
        const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
        if (!existingLink) {
          // Create and append font link
          const link = document.createElement('link');
          link.href = fontUrl;
          link.rel = 'stylesheet';
          link.onload = () => {
            this.logger.debugComponent('ThreatModelReport', `Google Font CSS loaded: ${fontName}`);
          };
          link.onerror = () => {
            this.logger.warn('Failed to load Google Font CSS', { fontUrl });
          };
          document.head.appendChild(link);
        }

        // Wait for font to be available using Font Loading API
        if ('fonts' in document) {
          document.fonts
            .load(`12px ${fontName}`)
            .then(() => {
              this.loadedFonts.set(fontKey, {
                fontName,
                fontData: '',
                loaded: true,
              });
              this.logger.debugComponent('ThreatModelReport', `Font loaded and ready: ${fontName}`);
              resolve();
            })
            .catch(error => {
              const errorMsg = error instanceof Error ? error.message : String(error);
              this.logger.warn('Font loading failed', { fontName, error: errorMsg });
              reject(new Error(`Font loading failed: ${errorMsg}`));
            });

          // Fallback timeout in case font loading takes too long
          setTimeout(() => {
            if (!this.loadedFonts.get(fontKey)?.loaded) {
              this.logger.warn('Font loading timeout, proceeding anyway', { fontName });
              resolve();
            }
          }, 3000); // 3 second timeout
        } else {
          // Fallback for older browsers without Font Loading API
          setTimeout(() => {
            this.loadedFonts.set(fontKey, {
              fontName,
              fontData: '',
              loaded: true,
            });
            this.logger.debugComponent(
              'ThreatModelReport',
              `Font assumed loaded (no API): ${fontName}`,
            );
            resolve();
          }, 1000);
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Set the document font after ensuring it's loaded
   */
  private setDocumentFont(doc: jsPDF, fontConfig: FontConfig, _langCode: string): void {
    try {
      const fontKey = `google-${fontConfig.name}`;
      const loadedFont = this.loadedFonts.get(fontKey);

      if (loadedFont?.loaded) {
        // For jsPDF, we still need to use built-in fonts, but we can apply the loaded font
        // when rendering text to canvas for enhanced rendering
        doc.setFont('helvetica');
        this.logger.debugComponent(
          'ThreatModelReport',
          `Using helvetica with ${fontConfig.name} loaded for enhanced rendering`,
        );
      } else {
        // Fallback to standard fonts
        this.setFontWithFallback(doc, fontConfig);
      }
    } catch (error) {
      this.logger.warn('Error setting document font', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.setFontWithFallback(doc, fontConfig);
    }
  }

  /**
   * Set font with fallback support for Unicode characters
   */
  private setFontWithFallback(doc: jsPDF, fontConfig: FontConfig): void {
    try {
      // Use helvetica as fallback when Noto Sans fonts aren't loaded
      doc.setFont('helvetica');
      this.logger.debugComponent(
        'ThreatModelReport',
        `Using helvetica fallback for ${fontConfig.name}`,
      );
    } catch (error) {
      this.logger.warn('Font fallback failed, using default', {
        error: error instanceof Error ? error.message : String(error),
      });
      doc.setFont('helvetica');
    }
  }

  /**
   * Add text with proper language and RTL support using loaded fonts
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
      const fontKey = `google-${fontConfig.name}`;
      const loadedFont = this.loadedFonts.get(fontKey);

      // Check if we should use enhanced text rendering with loaded fonts
      if (loadedFont?.loaded && this.shouldUseEnhancedTextRendering(currentLang)) {
        this.addEnhancedText(doc, text, x, y, {
          fontName: fontConfig.name,
          fontSize: 12,
          fontWeight: 'normal',
          isRTL,
          contentWidth,
          maxWidth,
        });
        return;
      }

      // Fallback to standard jsPDF text rendering
      this.addStandardText(doc, text, x, y, { isRTL, contentWidth, maxWidth });
    } catch (error) {
      this.logger.warn('Error adding text with language support, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to basic text rendering
      doc.text(text, x, y);
    }
  }

  /**
   * Determine if enhanced text rendering should be used
   */
  private shouldUseEnhancedTextRendering(_langCode: string): boolean {
    // Only use enhanced rendering for specific cases where it's needed
    // For now, disable enhanced rendering to fix positioning issues
    return false;
  }

  /**
   * Add enhanced text using canvas rendering with loaded fonts
   */
  private addEnhancedText(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    options: {
      fontName: string;
      fontSize: number;
      fontWeight: string;
      isRTL?: boolean;
      contentWidth?: number;
      maxWidth?: number;
    },
  ): void {
    try {
      const { fontName, fontSize, fontWeight, isRTL = false, contentWidth, maxWidth } = options;

      // For short, simple text, render as canvas and add as image
      if (text.length < 100 && !maxWidth) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          this.addStandardText(doc, text, x, y, { isRTL, contentWidth });
          return;
        }

        // Set font and measure text
        ctx.font = `${fontWeight} ${fontSize}px ${fontName}, helvetica, sans-serif`;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize * 1.2; // Approximate height with line spacing

        // Set canvas size with some padding
        canvas.width = Math.ceil(textWidth + 4);
        canvas.height = Math.ceil(textHeight + 4);

        // Re-set font after canvas resize (canvas clears context)
        ctx.font = `${fontWeight} ${fontSize}px ${fontName}, helvetica, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        // Render text to canvas
        ctx.fillText(text, 2, 2);

        // Convert canvas to image and add to PDF
        const imageData = canvas.toDataURL('image/png');
        const adjustedX = isRTL && contentWidth ? x + contentWidth - textWidth : x;

        // Add image to PDF at the same scale as text
        doc.addImage(imageData, 'PNG', adjustedX, y - fontSize, textWidth, textHeight);

        this.logger.debugComponent(
          'ThreatModelReport',
          `Enhanced text rendered: ${text.substring(0, 20)}...`,
        );
      } else {
        // For longer text or text with wrapping, fall back to standard rendering
        this.addStandardText(doc, text, x, y, {
          isRTL: options.isRTL,
          contentWidth: options.contentWidth,
          maxWidth: options.maxWidth,
        });
      }
    } catch (error) {
      this.logger.warn('Enhanced text rendering failed, using standard', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.addStandardText(doc, text, x, y, {
        isRTL: options.isRTL,
        contentWidth: options.contentWidth,
        maxWidth: options.maxWidth,
      });
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
