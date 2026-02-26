import { Injectable, inject } from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import { BrandingConfigService } from '../../../../core/services/branding-config.service';
import { ThreatModel } from '../../models/threat-model.model';
import * as fontkit from 'fontkit';

import { PdfFontManager } from './pdf-font-manager';
import { PdfLayoutEngine, LayoutConfig, Cursor } from './pdf-layout-engine';
import { PdfTableRenderer } from './pdf-table-renderer';
import { PdfMarkdownRenderer } from './pdf-markdown-renderer';
import { REPORT_STYLES, SPACING } from './pdf-stylesheet';
import {
  SectionRenderContext,
  renderSummarySection,
  renderInputsGroup,
  renderOutputsGroup,
  addPageFooters,
} from './pdf-section-renderers';

/**
 * Page size configurations in PDF points (1 point = 1/72 inch).
 */
const PAGE_SIZES = {
  usLetter: { width: 612, height: 792 },
  A4: { width: 595, height: 842 },
} as const;

type PageSize = keyof typeof PAGE_SIZES;

/**
 * Margin configurations in PDF points.
 */
const MARGINS = {
  narrow: 36, // 0.5 inch
  standard: 54, // 0.75 inch
  wide: 72, // 1.0 inch
} as const;

type MarginSize = keyof typeof MARGINS;

/**
 * Service responsible for generating PDF reports from threat models.
 *
 * Orchestrates the layout engine, font manager, table renderer,
 * markdown renderer, and section renderers to produce a complete PDF.
 */
@Injectable({
  providedIn: 'root',
})
export class ThreatModelReportService {
  private pageSize: PageSize = 'usLetter';
  private marginSize: MarginSize = 'standard';

  private readonly userPreferencesService = inject(UserPreferencesService);

  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
    private languageService: LanguageService,
    private brandingConfig: BrandingConfigService,
  ) {}

  /**
   * Generate a PDF report for the given threat model.
   */
  async generateReport(threatModel: ThreatModel): Promise<void> {
    try {
      this.loadUserPreferences();

      this.logger.info('Generating PDF report', {
        threatModelId: threatModel.id,
        threatModelName: threatModel.name,
      });

      // Create PDF document
      const doc = await PDFDocument.create();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      doc.registerFontkit(fontkit as any);

      // Set document metadata
      doc.setTitle(`Threat Model Report - ${threatModel.name}`);
      doc.setAuthor('TMI Application');
      doc.setSubject(`Threat Model: ${threatModel.name}`);
      doc.setCreator('TMI Application');
      doc.setProducer('TMI Application');

      // Initialize font manager
      const fonts = new PdfFontManager(doc, this.logger);
      const currentLang = this.transloco.getActiveLang();
      await fonts.loadFonts(currentLang);

      // Create layout engine
      const layoutConfig: LayoutConfig = {
        pageWidth: PAGE_SIZES[this.pageSize].width,
        pageHeight: PAGE_SIZES[this.pageSize].height,
        margin: MARGINS[this.marginSize],
        footerReservedHeight: SPACING.footerReservedHeight,
      };
      const engine = new PdfLayoutEngine(doc, layoutConfig);

      // Create renderers
      const tableRenderer = new PdfTableRenderer(engine, fonts);
      const markdownRenderer = new PdfMarkdownRenderer(engine, fonts);

      // Build render context
      const ctx: SectionRenderContext = {
        engine,
        fonts,
        transloco: this.transloco,
        tableRenderer,
        markdownRenderer,
        doc,
      };

      // Generate report content
      let cursor = engine.newPage();

      // Title page: logo
      cursor = await this.addLogo(doc, cursor, engine);

      // Title page: threat model name
      cursor = this.addTitle(cursor, threatModel.name, engine, fonts);

      // Confidentiality warning
      const confidentialityWarning = this.brandingConfig.confidentialityWarning;
      if (confidentialityWarning) {
        cursor = this.addConfidentialityWarning(cursor, confidentialityWarning, engine, fonts);
      }

      // Data classification on title page
      const dataClassification = this.brandingConfig.dataClassification;
      if (dataClassification) {
        cursor = this.addTitlePageClassification(cursor, dataClassification, engine, fonts);
      }

      // Summary section
      cursor = renderSummarySection(ctx, cursor, threatModel);

      // Inputs group (Assets, Documents, Repositories)
      cursor = renderInputsGroup(ctx, cursor, threatModel);

      // Outputs group (Diagrams, Threats, Notes)
      await renderOutputsGroup(ctx, cursor, threatModel);

      // Add page footers (classification + page numbers)
      addPageFooters(
        doc,
        fonts,
        { pageWidth: layoutConfig.pageWidth, margin: layoutConfig.margin },
        dataClassification ?? null,
        this.transloco,
      );

      // Save PDF
      await this.savePdf(doc, threatModel.name);

      this.logger.debugComponent('ThreatModelReportService', 'PDF report generated successfully', {
        threatModelName: threatModel.name,
      });
    } catch (error) {
      this.logger.error('Error generating PDF report', error);
      throw error;
    }
  }

  private loadUserPreferences(): void {
    const preferences = this.userPreferencesService.getPreferences();

    if (preferences.pageSize && PAGE_SIZES[preferences.pageSize]) {
      this.pageSize = preferences.pageSize;
    }
    if (preferences.marginSize && MARGINS[preferences.marginSize]) {
      this.marginSize = preferences.marginSize;
    }

    this.logger.info('Loaded user preferences for report generation', {
      pageSize: this.pageSize,
      marginSize: this.marginSize,
    });
  }

  private addTitle(
    cursor: Cursor,
    title: string,
    engine: PdfLayoutEngine,
    fonts: PdfFontManager,
  ): Cursor {
    const style = REPORT_STYLES.title;
    const font = fonts.getFont(style.fontVariant);
    cursor = engine.drawText(cursor, title, font, style.fontSize, style.color, {
      centered: true,
    });
    return engine.advanceCursor(cursor, 30);
  }

  private addConfidentialityWarning(
    cursor: Cursor,
    warning: string,
    engine: PdfLayoutEngine,
    fonts: PdfFontManager,
  ): Cursor {
    const style = REPORT_STYLES.confidentiality;
    const font = fonts.getFont(style.fontVariant);
    cursor = engine.drawText(cursor, warning, font, style.fontSize, style.color, {
      centered: true,
    });
    return engine.advanceCursor(cursor, 25);
  }

  private addTitlePageClassification(
    cursor: Cursor,
    classification: string,
    engine: PdfLayoutEngine,
    fonts: PdfFontManager,
  ): Cursor {
    const style = REPORT_STYLES.classification;
    const font = fonts.getFont(style.fontVariant);
    cursor = engine.drawText(cursor, classification, font, style.fontSize, style.color, {
      centered: true,
    });
    return engine.advanceCursor(cursor, 25);
  }

  private async addLogo(
    doc: PDFDocument,
    cursor: Cursor,
    engine: PdfLayoutEngine,
  ): Promise<Cursor> {
    const logoPngData = this.brandingConfig.logoPngData;
    if (!logoPngData) {
      return cursor;
    }

    try {
      const image = await doc.embedPng(logoPngData);
      const maxWidth = 150;
      const maxHeight = 100;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const x = (engine.pageWidth - drawWidth) / 2;

      cursor.page.drawImage(image, {
        x,
        y: cursor.y - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });

      return engine.advanceCursor(cursor, drawHeight + 20);
    } catch (error) {
      this.logger.warn('Failed to embed logo in PDF', error);
      return cursor;
    }
  }

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
