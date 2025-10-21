import { Injectable } from '@angular/core';
import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../core/services/logger.service';
import { LanguageService } from '../../../i18n/language.service';
import { ThreatModel, Threat, Document, Repository } from '../models/threat-model.model';
import * as fontkit from 'fontkit';

interface FontConfig {
  name: string;
  fontPath: string;
  italicFontPath?: string;
  fallbacks: string[];
  rtl?: boolean;
}

/**
 * Page size configurations in PDF points (1 point = 1/72 inch)
 */
const PAGE_SIZES = {
  usLetter: { width: 612, height: 792 }, // 8.5" × 11"
  A4: { width: 595, height: 842 }, // 210mm × 297mm
} as const;

type PageSize = keyof typeof PAGE_SIZES;

/**
 * Margin configurations in PDF points
 * All margins are uniform (same for top, bottom, left, right)
 */
const MARGINS = {
  narrow: 36, // 0.5 inch
  standard: 54, // 0.75 inch
  wide: 72, // 1.0 inch
} as const;

type MarginSize = keyof typeof MARGINS;

/**
 * Print DPI for high-quality diagram rendering
 */
const PRINT_DPI = 300;
const SCREEN_DPI = 72; // PDF points are 72 DPI

/**
 * Service responsible for generating PDF reports from threat models using pdf-lib
 */
@Injectable({
  providedIn: 'root',
})
export class ThreatModelReportService {
  // PDF layout configuration - loaded from user preferences
  private pageSize: PageSize = 'usLetter';
  private marginSize: MarginSize = 'standard';

  private fontConfigs: Map<string, FontConfig> = new Map([
    [
      'en-US',
      {
        name: 'NotoSans',
        fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
        italicFontPath: 'assets/fonts/ttf/NotoSans-Italic-VariableFont_wdth,wght.ttf',
        fallbacks: ['Helvetica', 'Arial'],
      },
    ],
    [
      'de',
      {
        name: 'NotoSans',
        fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
        italicFontPath: 'assets/fonts/ttf/NotoSans-Italic-VariableFont_wdth,wght.ttf',
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
  private currentFont: PDFFont | undefined = undefined;
  private currentItalicFont: PDFFont | undefined = undefined;

  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
    private languageService: LanguageService,
  ) {}

  /**
   * Load user preferences for page size and margins from localStorage
   */
  private loadUserPreferences(): void {
    try {
      const stored = localStorage.getItem('tmi_user_preferences');
      if (stored) {
        const preferences = JSON.parse(stored) as {
          pageSize?: PageSize;
          marginSize?: MarginSize;
        };

        // Update page size if valid preference exists
        if (preferences.pageSize && PAGE_SIZES[preferences.pageSize]) {
          this.pageSize = preferences.pageSize;
        }

        // Update margin size if valid preference exists
        if (preferences.marginSize && MARGINS[preferences.marginSize]) {
          this.marginSize = preferences.marginSize;
        }

        this.logger.info('Loaded user preferences for report generation', {
          pageSize: this.pageSize,
          marginSize: this.marginSize,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to load user preferences, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Keep default values if loading fails
    }
  }

  /**
   * Get the current page dimensions
   */
  private getPageDimensions(): { width: number; height: number } {
    return PAGE_SIZES[this.pageSize];
  }

  /**
   * Get the current margin size in points
   */
  private getMargin(): number {
    return MARGINS[this.marginSize];
  }

  /**
   * Get the printable area width (page width - left margin - right margin)
   */
  private getPrintableWidth(): number {
    const margin = this.getMargin();
    return this.getPageDimensions().width - 2 * margin;
  }

  /**
   * Calculate the DPI scale factor for converting screen points to print resolution
   */
  private getPrintDpiScale(): number {
    return PRINT_DPI / SCREEN_DPI; // 300 / 72 = 4.166...
  }

  /**
   * Add a new page to the PDF document with configured dimensions
   */
  private addNewPage(doc: PDFDocument): PDFPage {
    const pageDims = this.getPageDimensions();
    return doc.addPage([pageDims.width, pageDims.height]);
  }

  /**
   * Get the starting Y position for a new page (page height - top margin)
   */
  private getStartingYPosition(): number {
    const pageDims = this.getPageDimensions();
    const margin = this.getMargin();
    return pageDims.height - margin;
  }

  /**
   * Generate a PDF report for the given threat model
   */
  async generateReport(threatModel: ThreatModel): Promise<void> {
    try {
      // Load user preferences for page size and margins
      this.loadUserPreferences();

      this.logger.info('Generating PDF report with pdf-lib', {
        threatModelId: threatModel.id,
        threatModelName: threatModel.name,
      });

      // Create pdf-lib document
      const doc = await PDFDocument.create();

      // Register fontkit with pdf-lib for variable font support
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      doc.registerFontkit(fontkit as any);

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
        fontPath: fontConfig.fontPath,
      });

      // Load the main font
      try {
        const fontData = await this.fetchFont(fontConfig.fontPath);
        this.currentFont = await doc.embedFont(fontData);
        this.logger.info(`Successfully embedded custom font: ${fontConfig.name}`);
      } catch (fontError) {
        this.logger.warn(`Failed to load custom font ${fontConfig.name}, using fallback`, {
          error: fontError instanceof Error ? fontError.message : String(fontError),
        });
        this.currentFont = await doc.embedFont(StandardFonts.Helvetica);
      }

      // Load the italic font if available
      if (fontConfig.italicFontPath) {
        try {
          const italicFontData = await this.fetchFont(fontConfig.italicFontPath);
          this.currentItalicFont = await doc.embedFont(italicFontData);
          this.logger.info(`Successfully embedded italic font: ${fontConfig.name}-Italic`);
        } catch (italicError) {
          this.logger.warn(`Failed to load italic font, using standard italic fallback`, {
            error: italicError instanceof Error ? italicError.message : String(italicError),
          });
          this.currentItalicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
        }
      } else {
        this.currentItalicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
      }
    } catch (error) {
      this.logger.error('Error loading fonts, using standard fallbacks', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.currentFont = await doc.embedFont(StandardFonts.Helvetica);
      this.currentItalicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
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
    let page = this.addNewPage(doc);
    let yPosition = this.getStartingYPosition();

    // Title
    yPosition = this.addTitle(page, threatModel.name, yPosition);

    // Threat Model Summary
    yPosition = this.addThreatModelSummary(page, threatModel, yPosition);

    // Diagrams Section
    if (threatModel.diagrams && threatModel.diagrams.length > 0) {
      const result = await this.addDiagramsSection(doc, page, threatModel, yPosition);
      page = result.page;
      yPosition = result.yPosition;
    }

    // Documents Table
    if (threatModel.documents && threatModel.documents.length > 0) {
      const result = this.addDocumentsSection(doc, page, threatModel.documents, yPosition);
      page = result.page;
      yPosition = result.yPosition;
    }

    // Repository Table
    if (threatModel.repositories && threatModel.repositories.length > 0) {
      const result = this.addRepositoriesSection(doc, page, threatModel.repositories, yPosition);
      page = result.page;
      yPosition = result.yPosition;
    }

    // Threats Table
    if (threatModel.threats && threatModel.threats.length > 0) {
      this.addThreatsSection(doc, page, threatModel.threats, yPosition);
    }
  }

  /**
   * Convert base64-encoded SVG to PNG Uint8Array for pdf-lib
   * Renders at 300 DPI for print quality
   * @param base64Svg Base64-encoded SVG string
   * @param displayWidth Display width in PDF points (72 DPI)
   * @returns Promise resolving to PNG data as Uint8Array and dimensions
   */
  private async convertSvgToPng(
    base64Svg: string,
    displayWidth: number,
  ): Promise<{ pngData: Uint8Array; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      try {
        // Decode base64 SVG
        const svgString = atob(base64Svg);

        // Parse SVG to extract dimensions
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');

        if (!svgElement) {
          throw new Error('Invalid SVG: no svg element found');
        }

        // Extract original dimensions from SVG
        let originalWidth = 800;
        let originalHeight = 600;

        // Try to get dimensions from width/height attributes
        const widthAttr = svgElement.getAttribute('width');
        const heightAttr = svgElement.getAttribute('height');

        if (widthAttr && heightAttr) {
          originalWidth = parseFloat(widthAttr);
          originalHeight = parseFloat(heightAttr);
        } else {
          // Try to get dimensions from viewBox
          const viewBox = svgElement.getAttribute('viewBox');
          if (viewBox) {
            const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(parseFloat);
            if (vbWidth && vbHeight) {
              originalWidth = vbWidth;
              originalHeight = vbHeight;
            }
          }
        }

        // Calculate aspect ratio and display dimensions
        const aspectRatio = originalHeight / originalWidth;
        const displayHeight = Math.round(displayWidth * aspectRatio);

        // Calculate canvas size for 300 DPI print quality
        // PDF points are 72 DPI, so we scale by PRINT_DPI / SCREEN_DPI
        const dpiScale = this.getPrintDpiScale(); // 300 / 72 ≈ 4.167
        const canvasWidth = Math.round(displayWidth * dpiScale);
        const canvasHeight = Math.round(displayHeight * dpiScale);

        // Create high-resolution canvas for 300 DPI output
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Scale the context to render at 300 DPI
        ctx.scale(dpiScale, dpiScale);

        // Create image and load SVG
        const img = new Image();

        img.onload = () => {
          // Fill white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, displayWidth, displayHeight);

          // Draw SVG image at display size (rendered at 300 DPI due to scale)
          ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

          // Convert canvas to blob with maximum quality
          canvas.toBlob(
            blob => {
              if (!blob) {
                reject(new Error('Failed to convert canvas to blob'));
                return;
              }

              // Convert blob to Uint8Array
              const reader = new FileReader();
              reader.onloadend = () => {
                if (reader.result instanceof ArrayBuffer) {
                  // Return PNG data with display dimensions (not canvas dimensions)
                  resolve({
                    pngData: new Uint8Array(reader.result),
                    width: displayWidth,
                    height: displayHeight,
                  });
                } else {
                  reject(new Error('Failed to read blob as ArrayBuffer'));
                }
              };
              reader.onerror = () => reject(new Error('Failed to read blob'));
              reader.readAsArrayBuffer(blob);
            },
            'image/png',
            1.0,
          );
        };

        img.onerror = () => reject(new Error('Failed to load SVG image'));

        // Set image source to base64 SVG
        img.src = `data:image/svg+xml;base64,${base64Svg}`;
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Add report title
   */
  private addTitle(page: PDFPage, title: string, yPosition: number): number {
    if (!this.currentFont) {
      throw new Error('No font loaded for PDF generation');
    }

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

    return yPosition - 30;
  }

  /**
   * Add threat model summary section
   */
  private addThreatModelSummary(
    page: PDFPage,
    threatModel: ThreatModel,
    yPosition: number,
  ): number {
    const margin = this.getMargin();

    if (!this.currentFont) {
      throw new Error('No font loaded for PDF generation');
    }

    const sectionTitle = this.transloco.translate('threatModels.details');

    page.drawText(sectionTitle, {
      x: margin,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    const summaryItems = [
      {
        label: this.transloco.translate('common.description'),
        value: threatModel.description || this.transloco.translate('common.noDataAvailable'),
      },
      {
        label: this.transloco.translate('common.roles.owner'),
        value: threatModel.owner || this.transloco.translate('common.noDataAvailable'),
      },
      {
        label: this.transloco.translate('common.created'),
        value: this.formatDate(threatModel.created_at),
      },
      {
        label: this.transloco.translate('common.lastModified'),
        value: this.formatDate(threatModel.modified_at),
      },
      {
        label: this.transloco.translate('threatModels.threatModelFramework'),
        value:
          threatModel.threat_model_framework || this.transloco.translate('common.noDataAvailable'),
      },
    ];

    summaryItems.forEach(item => {
      page.drawText(`${item.label}: ${item.value}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: this.currentFont!,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    });

    return yPosition - 20;
  }

  /**
   * Add diagrams section
   */
  private async addDiagramsSection(
    doc: PDFDocument,
    page: PDFPage,
    threatModel: ThreatModel,
    yPosition: number,
  ): Promise<{ page: PDFPage; yPosition: number }> {
    const margin = this.getMargin();
    const printableWidth = this.getPrintableWidth();

    if (yPosition < 200) {
      page = this.addNewPage(doc);
      yPosition = this.getStartingYPosition();
    }

    const sectionTitle = this.transloco.translate('threatModels.diagrams');

    page.drawText(sectionTitle, {
      x: margin,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    if (!threatModel.diagrams || threatModel.diagrams.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: margin,
        y: yPosition,
        size: 12,
        font: this.currentFont!,
        color: rgb(0.4, 0.4, 0.4),
      });
      return { page, yPosition: yPosition - 20 };
    }

    for (const [index, diagram] of threatModel.diagrams.entries()) {
      if (index > 0 || yPosition < 400) {
        page = this.addNewPage(doc);
        yPosition = this.getStartingYPosition();
      }

      page.drawText(diagram.name, {
        x: margin,
        y: yPosition,
        size: 14,
        font: this.currentFont!,
        color: rgb(0, 0, 0),
      });

      yPosition -= 30;

      // Render diagram image if SVG data is available
      if (diagram.image?.svg) {
        try {
          // Use full printable width for diagrams (responsive to page size and margins)
          const diagramWidth = printableWidth;

          // Convert SVG to high-DPI PNG (300 DPI for print quality)
          const { pngData, width, height } = await this.convertSvgToPng(
            diagram.image.svg,
            diagramWidth,
          );

          // Embed PNG in PDF
          const image = await doc.embedPng(pngData);

          // Check if we need a new page for the image
          if (yPosition - height < margin) {
            page = this.addNewPage(doc);
            yPosition = this.getStartingYPosition();
          }

          // Draw the image at display size (PNG is 300 DPI internally)
          page.drawImage(image, {
            x: margin,
            y: yPosition - height,
            width: width,
            height: height,
          });

          yPosition -= height + 20;
        } catch (error) {
          this.logger.warn('Failed to render diagram image', { diagramId: diagram.id, error });
          page.drawText('Diagram could not be rendered', {
            x: margin,
            y: yPosition,
            size: 10,
            font: this.currentFont!,
            color: rgb(0.4, 0.4, 0.4),
          });
          yPosition -= 20;
        }
      } else {
        // No SVG data - show placeholder
        page.drawText('No diagram image available', {
          x: margin,
          y: yPosition,
          size: 10,
          font: this.currentFont!,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 20;
      }
    }

    return { page, yPosition };
  }

  /**
   * Add documents section with table
   */
  private addDocumentsSection(
    doc: PDFDocument,
    page: PDFPage,
    documents: Document[],
    yPosition: number,
  ): { page: PDFPage; yPosition: number } {
    const margin = this.getMargin();

    if (!this.currentFont) {
      throw new Error('No font loaded for PDF generation');
    }

    if (yPosition < 200) {
      page = this.addNewPage(doc);
      yPosition = this.getStartingYPosition();
    }

    const sectionTitle = this.transloco.translate('common.objectTypes.documents');

    page.drawText(sectionTitle, {
      x: margin,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    if (documents.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: margin,
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
      this.transloco.translate('threatModels.documentUrl'),
      this.transloco.translate('common.description'),
    ];

    yPosition = this.drawTableRow(page, headers, yPosition, true);
    yPosition -= 10;

    // Table rows
    documents.forEach(document => {
      if (yPosition < margin) {
        page = this.addNewPage(doc);
        yPosition = this.getStartingYPosition();
      }

      const rowData: string[] = [
        document.name || this.transloco.translate('common.noDataAvailable'),
        document.uri || this.transloco.translate('common.noDataAvailable'),
        document.description || this.transloco.translate('common.noDataAvailable'),
      ];

      yPosition = this.drawTableRow(page, rowData, yPosition, false);
    });

    return { page, yPosition: yPosition - 20 };
  }

  /**
   * Add repositories section with table
   */
  private addRepositoriesSection(
    doc: PDFDocument,
    page: PDFPage,
    repositories: Repository[],
    yPosition: number,
  ): { page: PDFPage; yPosition: number } {
    const margin = this.getMargin();

    if (!this.currentFont) {
      throw new Error('No font loaded for PDF generation');
    }

    if (yPosition < 200) {
      page = this.addNewPage(doc);
      yPosition = this.getStartingYPosition();
    }

    const sectionTitle = this.transloco.translate('common.objectTypes.repositories');

    page.drawText(sectionTitle, {
      x: margin,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    if (repositories.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: margin,
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
      this.transloco.translate('threatModels.repositoryType'),
      this.transloco.translate('threatModels.repositoryUri'),
      this.transloco.translate('common.description'),
    ];

    yPosition = this.drawTableRow(page, headers, yPosition, true);
    yPosition -= 10;

    // Table rows
    repositories.forEach(repository => {
      if (yPosition < margin) {
        page = this.addNewPage(doc);
        yPosition = this.getStartingYPosition();
      }

      const rowData: string[] = [
        repository.name || this.transloco.translate('common.noDataAvailable'),
        repository.type || this.transloco.translate('common.noDataAvailable'),
        repository.uri || this.transloco.translate('common.noDataAvailable'),
        repository.description || this.transloco.translate('common.noDataAvailable'),
      ];

      yPosition = this.drawTableRow(page, rowData, yPosition, false);
    });

    return { page, yPosition: yPosition - 20 };
  }

  /**
   * Add threats section with table
   */
  private addThreatsSection(
    doc: PDFDocument,
    page: PDFPage,
    threats: Threat[],
    yPosition: number,
  ): { page: PDFPage; yPosition: number } {
    const margin = this.getMargin();

    if (!this.currentFont) {
      throw new Error('No font loaded for PDF generation');
    }

    if (yPosition < 200) {
      page = this.addNewPage(doc);
      yPosition = this.getStartingYPosition();
    }

    const sectionTitle = this.transloco.translate('common.objectTypes.threats');

    page.drawText(sectionTitle, {
      x: margin,
      y: yPosition,
      size: 18,
      font: this.currentFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    if (threats.length === 0) {
      page.drawText(this.transloco.translate('common.noDataAvailable'), {
        x: margin,
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
    threats.forEach(threat => {
      if (yPosition < margin) {
        page = this.addNewPage(doc);
        yPosition = this.getStartingYPosition();
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
  private drawTableRow(
    page: PDFPage,
    data: string[],
    yPosition: number,
    isHeader: boolean,
  ): number {
    const margin = this.getMargin();

    if (!this.currentFont) {
      throw new Error('No font loaded for PDF generation');
    }

    const columnWidths = [120, 120, 120, 120];
    const startX = margin;
    let currentX = startX;
    const fontSize = isHeader ? 12 : 10;
    const color = isHeader ? rgb(0, 0, 0) : rgb(0.2, 0.2, 0.2);

    data.forEach((text, index) => {
      if (index < columnWidths.length) {
        // Truncate text if too long
        const maxWidth = columnWidths[index] - 10;
        const textWidth = this.currentFont!.widthOfTextAtSize(text, fontSize);
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
          font: this.currentFont!,
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
