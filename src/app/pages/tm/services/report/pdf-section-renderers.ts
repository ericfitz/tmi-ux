import { PDFDocument } from 'pdf-lib';
import { TranslocoService } from '@jsverse/transloco';
import { PdfLayoutEngine, Cursor } from './pdf-layout-engine';
import { PdfFontManager } from './pdf-font-manager';
import { PdfTableRenderer, TableColumn, TableRow } from './pdf-table-renderer';
import { PdfMarkdownRenderer } from './pdf-markdown-renderer';
import {
  REPORT_STYLES,
  TABLE_PROPORTIONS,
  MIN_ORPHAN_HEIGHT,
  STRUCTURAL_COLORS,
  SPACING,
} from './pdf-stylesheet';
import {
  ThreatModel,
  Asset,
  Document,
  Repository,
  Note,
  Threat,
} from '../../models/threat-model.model';
import { getFieldLabel, FieldType } from '../../../../shared/utils/field-value-helpers';
import { getPrincipalDisplayName } from '../../../../shared/utils/principal-display.utils';

/**
 * Dependencies shared across section renderers.
 */
export interface SectionRenderContext {
  engine: PdfLayoutEngine;
  fonts: PdfFontManager;
  transloco: TranslocoService;
  tableRenderer: PdfTableRenderer;
  markdownRenderer: PdfMarkdownRenderer;
  doc: PDFDocument;
}

/**
 * Format a date for display in the report.
 */
function formatDate(date: string | Date | undefined, transloco: TranslocoService): string {
  if (!date) return transloco.translate('common.noDataAvailable');

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(transloco.getActiveLang(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return transloco.translate('common.noDataAvailable');
  }
}

/**
 * Draw a section heading (e.g., "Inputs", "Outputs").
 */
function drawSectionHeading(ctx: SectionRenderContext, cursor: Cursor, text: string): Cursor {
  const style = REPORT_STYLES.sectionHeading;
  cursor = ctx.engine.advanceCursor(cursor, style.spaceBefore);
  cursor = ctx.engine.ensureSpace(cursor, MIN_ORPHAN_HEIGHT);

  const font = ctx.fonts.getFont(style.fontVariant);
  cursor = ctx.engine.drawWrappedText(cursor, text, font, style.fontSize, style.color, {
    lineHeight: style.lineHeight,
  });

  return ctx.engine.advanceCursor(cursor, style.spaceAfter);
}

/**
 * Draw a sub-section heading (e.g., "Assets", "Documents").
 */
function drawSubSectionHeading(ctx: SectionRenderContext, cursor: Cursor, text: string): Cursor {
  const style = REPORT_STYLES.subSectionHeading;
  cursor = ctx.engine.advanceCursor(cursor, style.spaceBefore);
  cursor = ctx.engine.ensureSpace(cursor, MIN_ORPHAN_HEIGHT);

  const font = ctx.fonts.getFont(style.fontVariant);
  cursor = ctx.engine.drawWrappedText(cursor, text, font, style.fontSize, style.color, {
    lineHeight: style.lineHeight,
  });

  return ctx.engine.advanceCursor(cursor, style.spaceAfter);
}

// ────────────────────────────────────────────────────────────────────
// Summary Section
// ────────────────────────────────────────────────────────────────────

/**
 * Render the summary section below the title page content.
 *
 * Fields: Report generated at, TM created at, TM created by,
 * TM last modified, TM status, Security Reviewer, Description.
 */
export function renderSummarySection(
  ctx: SectionRenderContext,
  cursor: Cursor,
  tm: ThreatModel,
): Cursor {
  const { engine, fonts, transloco } = ctx;
  const labelFont = fonts.getFont(REPORT_STYLES.label.fontVariant);
  const valueFont = fonts.getFont(REPORT_STYLES.value.fontVariant);
  const labelColor = REPORT_STYLES.label.color;
  const valueColor = REPORT_STYLES.value.color;
  const fontSize = REPORT_STYLES.label.fontSize;
  const noData = transloco.translate('common.noDataAvailable');

  const kvPairs: { label: string; value: string }[] = [
    {
      label: transloco.translate('report.generatedAt'),
      value: formatDate(new Date().toISOString(), transloco),
    },
    {
      label: transloco.translate('common.created'),
      value: formatDate(tm.created_at, transloco),
    },
    {
      label: transloco.translate('common.createdBy'),
      value: tm.created_by ? getPrincipalDisplayName(tm.created_by) : noData,
    },
    {
      label: transloco.translate('common.lastModified'),
      value: formatDate(tm.modified_at, transloco),
    },
    {
      label: transloco.translate('common.status'),
      value: tm.status
        ? getFieldLabel(tm.status, 'threatModels.status' as FieldType, transloco)
        : noData,
    },
    {
      label: transloco.translate('threatModels.securityReviewer'),
      value: tm.security_reviewer ? getPrincipalDisplayName(tm.security_reviewer) : noData,
    },
  ];

  for (const kv of kvPairs) {
    cursor = engine.drawKeyValuePair(
      cursor,
      kv.label,
      kv.value,
      labelFont,
      valueFont,
      fontSize,
      labelColor,
      valueColor,
    );
  }

  // Blank line before description
  cursor = engine.advanceCursor(cursor, 10);

  // Description (may be long, render with wrapping)
  const description = tm.description || noData;
  cursor = engine.drawKeyValuePair(
    cursor,
    transloco.translate('common.description'),
    description,
    labelFont,
    valueFont,
    fontSize,
    labelColor,
    valueColor,
  );

  return engine.advanceCursor(cursor, 20);
}

// ────────────────────────────────────────────────────────────────────
// Inputs Group (Assets, Documents, Repositories)
// ────────────────────────────────────────────────────────────────────

/**
 * Render the "Inputs" section group. Omitted entirely if all sub-sections are empty.
 */
export function renderInputsGroup(
  ctx: SectionRenderContext,
  cursor: Cursor,
  tm: ThreatModel,
): Cursor {
  const filteredAssets = (tm.assets ?? []).filter(a => a.include_in_report !== false);
  const filteredDocs = (tm.documents ?? []).filter(d => d.include_in_report !== false);
  const filteredRepos = (tm.repositories ?? []).filter(r => r.include_in_report !== false);

  if (!filteredAssets.length && !filteredDocs.length && !filteredRepos.length) {
    return cursor;
  }

  cursor = drawSectionHeading(ctx, cursor, ctx.transloco.translate('threatModels.sections.inputs'));

  if (filteredAssets.length) {
    cursor = renderAssetsSection(ctx, cursor, filteredAssets);
  }
  if (filteredDocs.length) {
    cursor = renderDocumentsTable(ctx, cursor, filteredDocs);
  }
  if (filteredRepos.length) {
    cursor = renderRepositoriesSection(ctx, cursor, filteredRepos);
  }

  return cursor;
}

// ────────────────────────────────────────────────────────────────────
// Outputs Group (Diagrams, Threats, Notes)
// ────────────────────────────────────────────────────────────────────

/**
 * Render the "Outputs" section group. Omitted entirely if all sub-sections are empty.
 */
export async function renderOutputsGroup(
  ctx: SectionRenderContext,
  cursor: Cursor,
  tm: ThreatModel,
): Promise<Cursor> {
  const filteredDiagrams = (tm.diagrams ?? []).filter(d => d.include_in_report !== false);
  const filteredThreats = (tm.threats ?? []).filter(t => t.include_in_report !== false);
  const filteredNotes = (tm.notes ?? []).filter(n => n.include_in_report !== false);

  if (!filteredDiagrams.length && !filteredThreats.length && !filteredNotes.length) {
    return cursor;
  }

  cursor = drawSectionHeading(
    ctx,
    cursor,
    ctx.transloco.translate('threatModels.sections.outputs'),
  );

  if (filteredDiagrams.length) {
    cursor = await renderDiagramsSection(ctx, cursor, filteredDiagrams);
  }
  if (filteredThreats.length) {
    cursor = renderThreatsSection(ctx, cursor, filteredThreats, tm);
  }
  if (filteredNotes.length) {
    cursor = renderNotesSection(ctx, cursor, filteredNotes);
  }

  return cursor;
}

// ────────────────────────────────────────────────────────────────────
// Assets Section (compact table + detail rows)
// ────────────────────────────────────────────────────────────────────

function renderAssetsSection(ctx: SectionRenderContext, cursor: Cursor, assets: Asset[]): Cursor {
  const { engine, fonts, transloco } = ctx;

  cursor = drawSubSectionHeading(ctx, cursor, transloco.translate('common.objectTypes.assets'));

  const columns: TableColumn[] = [
    { header: transloco.translate('common.name'), proportion: TABLE_PROPORTIONS.assets[0] },
    { header: transloco.translate('assetEditor.type'), proportion: TABLE_PROPORTIONS.assets[1] },
    { header: transloco.translate('common.criticality'), proportion: TABLE_PROPORTIONS.assets[2] },
  ];

  const rows: TableRow[] = assets.map(asset => ({
    cells: [
      asset.name || '',
      asset.type ? transloco.translate(`assetEditor.types.${asset.type}`) : '',
      asset.criticality || '',
    ],
  }));

  // Draw the compact table
  cursor = ctx.tableRenderer.drawTable(cursor, columns, rows);

  // Draw detail rows for each asset
  const labelFont = fonts.getFont(REPORT_STYLES.label.fontVariant);
  const valueFont = fonts.getFont(REPORT_STYLES.value.fontVariant);
  const fontSize = REPORT_STYLES.value.fontSize;
  const labelColor = REPORT_STYLES.label.color;
  const valueColor = REPORT_STYLES.value.color;
  const indent = SPACING.detailIndent;

  for (const asset of assets) {
    const hasClassification = asset.classification && asset.classification.length > 0;
    const hasSensitivity = !!asset.sensitivity;
    const hasDescription = !!asset.description;

    if (!hasClassification && !hasSensitivity && !hasDescription) {
      continue;
    }

    // Asset name as reference
    cursor = engine.ensureSpace(cursor, REPORT_STYLES.value.lineHeight * 2);

    const cardFont = fonts.getFont(REPORT_STYLES.cardTitle.fontVariant);
    cursor = engine.drawWrappedText(
      cursor,
      asset.name,
      cardFont,
      REPORT_STYLES.cardTitle.fontSize,
      REPORT_STYLES.cardTitle.color,
      { lineHeight: REPORT_STYLES.cardTitle.lineHeight },
    );

    if (hasClassification) {
      cursor = engine.drawKeyValuePair(
        cursor,
        transloco.translate('common.classification'),
        asset.classification!.join(', '),
        labelFont,
        valueFont,
        fontSize,
        labelColor,
        valueColor,
        { indent },
      );
    }

    if (hasSensitivity) {
      cursor = engine.drawKeyValuePair(
        cursor,
        transloco.translate('common.sensitivity'),
        asset.sensitivity!,
        labelFont,
        valueFont,
        fontSize,
        labelColor,
        valueColor,
        { indent },
      );
    }

    if (hasDescription) {
      cursor = engine.drawKeyValuePair(
        cursor,
        transloco.translate('common.description'),
        asset.description!,
        labelFont,
        valueFont,
        fontSize,
        labelColor,
        valueColor,
        { indent },
      );
    }

    cursor = engine.drawHorizontalRule(cursor, STRUCTURAL_COLORS.detailSeparator, 0.5, indent);
  }

  return cursor;
}

// ────────────────────────────────────────────────────────────────────
// Documents Table (standard 3-column)
// ────────────────────────────────────────────────────────────────────

function renderDocumentsTable(
  ctx: SectionRenderContext,
  cursor: Cursor,
  documents: Document[],
): Cursor {
  const { transloco } = ctx;

  cursor = drawSubSectionHeading(ctx, cursor, transloco.translate('common.objectTypes.documents'));

  const columns: TableColumn[] = [
    { header: transloco.translate('common.name'), proportion: TABLE_PROPORTIONS.documents[0] },
    {
      header: transloco.translate('threatModels.documentUrl'),
      proportion: TABLE_PROPORTIONS.documents[1],
    },
    {
      header: transloco.translate('common.description'),
      proportion: TABLE_PROPORTIONS.documents[2],
    },
  ];

  const rows: TableRow[] = documents.map(doc => ({
    cells: [doc.name || '', doc.uri || '', doc.description || ''],
  }));

  return ctx.tableRenderer.drawTable(cursor, columns, rows);
}

// ────────────────────────────────────────────────────────────────────
// Repositories Section (compact table + detail rows)
// ────────────────────────────────────────────────────────────────────

function renderRepositoriesSection(
  ctx: SectionRenderContext,
  cursor: Cursor,
  repositories: Repository[],
): Cursor {
  const { engine, fonts, transloco } = ctx;

  cursor = drawSubSectionHeading(
    ctx,
    cursor,
    transloco.translate('common.objectTypes.repositories'),
  );

  const columns: TableColumn[] = [
    { header: transloco.translate('common.name'), proportion: TABLE_PROPORTIONS.repositories[0] },
    {
      header: transloco.translate('threatModels.repositoryType'),
      proportion: TABLE_PROPORTIONS.repositories[1],
    },
    {
      header: transloco.translate('threatModels.repositoryUri'),
      proportion: TABLE_PROPORTIONS.repositories[2],
    },
  ];

  const rows: TableRow[] = repositories.map(repo => ({
    cells: [repo.name || '', repo.type || '', repo.uri || ''],
  }));

  cursor = ctx.tableRenderer.drawTable(cursor, columns, rows);

  // Draw detail rows for repos that have parameters or descriptions
  const labelFont = fonts.getFont(REPORT_STYLES.label.fontVariant);
  const valueFont = fonts.getFont(REPORT_STYLES.value.fontVariant);
  const fontSize = REPORT_STYLES.value.fontSize;
  const labelColor = REPORT_STYLES.label.color;
  const valueColor = REPORT_STYLES.value.color;
  const indent = SPACING.detailIndent;

  for (const repo of repositories) {
    const hasRef = repo.parameters && repo.parameters.refType && repo.parameters.refValue;
    const hasDescription = !!repo.description;

    if (!hasRef && !hasDescription) {
      continue;
    }

    cursor = engine.ensureSpace(cursor, REPORT_STYLES.value.lineHeight * 2);

    const cardFont = fonts.getFont(REPORT_STYLES.cardTitle.fontVariant);
    cursor = engine.drawWrappedText(
      cursor,
      repo.name,
      cardFont,
      REPORT_STYLES.cardTitle.fontSize,
      REPORT_STYLES.cardTitle.color,
      { lineHeight: REPORT_STYLES.cardTitle.lineHeight },
    );

    if (hasRef) {
      const refValue = `${repo.parameters!.refType}: ${repo.parameters!.refValue}`;
      const subPath = repo.parameters?.subPath ? ` (${repo.parameters.subPath})` : '';
      cursor = engine.drawKeyValuePair(
        cursor,
        transloco.translate('report.refLabel'),
        refValue + subPath,
        labelFont,
        valueFont,
        fontSize,
        labelColor,
        valueColor,
        { indent },
      );
    }

    if (hasDescription) {
      cursor = engine.drawKeyValuePair(
        cursor,
        transloco.translate('common.description'),
        repo.description!,
        labelFont,
        valueFont,
        fontSize,
        labelColor,
        valueColor,
        { indent },
      );
    }

    cursor = engine.drawHorizontalRule(cursor, STRUCTURAL_COLORS.detailSeparator, 0.5, indent);
  }

  return cursor;
}

// ────────────────────────────────────────────────────────────────────
// Diagrams Section
// ────────────────────────────────────────────────────────────────────

async function renderDiagramsSection(
  ctx: SectionRenderContext,
  cursor: Cursor,
  diagrams: import('../../models/diagram.model').Diagram[],
): Promise<Cursor> {
  const { engine, fonts, doc, transloco } = ctx;

  cursor = drawSubSectionHeading(ctx, cursor, transloco.translate('common.objectTypes.diagrams'));

  for (const [index, diagram] of diagrams.entries()) {
    // Each diagram starts on a fresh page (except possibly the first)
    if (index > 0 || cursor.y < 400) {
      cursor = engine.newPage();
    }

    // Diagram name
    const nameFont = fonts.getFont(REPORT_STYLES.cardTitle.fontVariant);
    cursor = engine.drawWrappedText(
      cursor,
      diagram.name,
      nameFont,
      REPORT_STYLES.cardTitle.fontSize,
      REPORT_STYLES.cardTitle.color,
      { lineHeight: REPORT_STYLES.cardTitle.lineHeight },
    );
    cursor = engine.advanceCursor(cursor, 10);

    // Render diagram image if available
    if (diagram.image?.svg) {
      try {
        const printableWidth = engine.contentWidth;
        const { pngData, width, height } = await convertSvgToPng(diagram.image.svg, printableWidth);

        const image = await doc.embedPng(pngData);

        // Check if we need a new page for the image
        if (cursor.y - height < engine.bottomBound) {
          cursor = engine.newPage();
        }

        cursor.page.drawImage(image, {
          x: engine.leftX,
          y: cursor.y - height,
          width,
          height,
        });

        cursor = { page: cursor.page, y: cursor.y - height - 20 };
      } catch {
        const noDataFont = fonts.getFont(REPORT_STYLES.noData.fontVariant);
        cursor = engine.drawWrappedText(
          cursor,
          transloco.translate('report.diagramRenderFailed'),
          noDataFont,
          REPORT_STYLES.noData.fontSize,
          REPORT_STYLES.noData.color,
        );
      }
    } else {
      const noDataFont = fonts.getFont(REPORT_STYLES.noData.fontVariant);
      cursor = engine.drawWrappedText(
        cursor,
        transloco.translate('report.diagramImageUnavailable'),
        noDataFont,
        REPORT_STYLES.noData.fontSize,
        REPORT_STYLES.noData.color,
      );
    }
  }

  return cursor;
}

// ────────────────────────────────────────────────────────────────────
// Threats Section (card-style blocks)
// ────────────────────────────────────────────────────────────────────

function renderThreatsSection(
  ctx: SectionRenderContext,
  cursor: Cursor,
  threats: Threat[],
  tm: ThreatModel,
): Cursor {
  const { engine, fonts, transloco } = ctx;

  cursor = drawSubSectionHeading(ctx, cursor, transloco.translate('common.objectTypes.threats'));

  const labelFont = fonts.getFont(REPORT_STYLES.label.fontVariant);
  const valueFont = fonts.getFont(REPORT_STYLES.value.fontVariant);
  const fontSize = REPORT_STYLES.value.fontSize;
  const labelColor = REPORT_STYLES.label.color;
  const valueColor = REPORT_STYLES.value.color;

  for (const threat of threats) {
    // Ensure heading + at least a few key-value lines stay together
    cursor = engine.ensureSpace(cursor, MIN_ORPHAN_HEIGHT);

    // Threat name as card title
    cursor = engine.advanceCursor(cursor, REPORT_STYLES.cardTitle.spaceBefore);
    const titleFont = fonts.getFont(REPORT_STYLES.cardTitle.fontVariant);
    cursor = engine.drawWrappedText(
      cursor,
      threat.name,
      titleFont,
      REPORT_STYLES.cardTitle.fontSize,
      REPORT_STYLES.cardTitle.color,
      { lineHeight: REPORT_STYLES.cardTitle.lineHeight },
    );
    cursor = engine.advanceCursor(cursor, REPORT_STYLES.cardTitle.spaceAfter);

    // Build key-value pairs from all non-empty fields
    const kvPairs: { label: string; value: string }[] = [];

    if (threat.description) {
      kvPairs.push({
        label: transloco.translate('common.description'),
        value: threat.description,
      });
    }
    if (threat.severity) {
      kvPairs.push({
        label: transloco.translate('common.severity'),
        value: getFieldLabel(
          threat.severity,
          'threatEditor.threatSeverity' as FieldType,
          transloco,
        ),
      });
    }
    if (threat.score != null) {
      kvPairs.push({
        label: transloco.translate('common.score'),
        value: String(threat.score),
      });
    }
    if (threat.status) {
      kvPairs.push({
        label: transloco.translate('common.status'),
        value: getFieldLabel(threat.status, 'threatEditor.threatStatus' as FieldType, transloco),
      });
    }
    if (threat.priority) {
      kvPairs.push({
        label: transloco.translate('common.priority'),
        value: getFieldLabel(
          threat.priority,
          'threatEditor.threatPriority' as FieldType,
          transloco,
        ),
      });
    }
    if (threat.threat_type && threat.threat_type.length > 0) {
      kvPairs.push({
        label: transloco.translate('common.threatType'),
        value: threat.threat_type.join(', '),
      });
    }
    if (threat.mitigation) {
      kvPairs.push({
        label: transloco.translate('common.mitigation'),
        value: threat.mitigation,
      });
    }
    if (threat.cwe_id && threat.cwe_id.length > 0) {
      kvPairs.push({
        label: transloco.translate('report.cweIds'),
        value: threat.cwe_id.join(', '),
      });
    }
    if (threat.cvss && threat.cvss.length > 0) {
      for (const cvss of threat.cvss) {
        kvPairs.push({
          label: transloco.translate('report.cvss'),
          value: `${cvss.vector} (${cvss.score})`,
        });
      }
    }
    if (threat.asset_id) {
      const asset = tm.assets?.find(a => a.id === threat.asset_id);
      if (asset) {
        kvPairs.push({
          label: transloco.translate('report.linkedAsset'),
          value: asset.name,
        });
      }
    }
    if (threat.diagram_id) {
      const diagram = tm.diagrams?.find(d => d.id === threat.diagram_id);
      if (diagram) {
        kvPairs.push({
          label: transloco.translate('report.linkedDiagram'),
          value: diagram.name,
        });
      }
    }
    if (threat.issue_uri) {
      kvPairs.push({
        label: transloco.translate('common.issueUri'),
        value: threat.issue_uri,
      });
    }

    // Draw all key-value pairs
    for (const kv of kvPairs) {
      cursor = engine.drawKeyValuePair(
        cursor,
        kv.label,
        kv.value,
        labelFont,
        valueFont,
        fontSize,
        labelColor,
        valueColor,
        { indent: SPACING.detailIndent },
      );
    }

    // Thin separator between threat cards
    cursor = engine.drawHorizontalRule(cursor, STRUCTURAL_COLORS.cardSeparator, 0.5);
  }

  return cursor;
}

// ────────────────────────────────────────────────────────────────────
// Notes Section (content blocks with markdown)
// ────────────────────────────────────────────────────────────────────

function renderNotesSection(ctx: SectionRenderContext, cursor: Cursor, notes: Note[]): Cursor {
  const { engine, fonts, transloco, markdownRenderer } = ctx;

  cursor = drawSubSectionHeading(ctx, cursor, transloco.translate('common.objectTypes.notes'));

  for (const note of notes) {
    // Ensure heading + some content stay together
    cursor = engine.ensureSpace(cursor, MIN_ORPHAN_HEIGHT);

    // Note name as card title
    cursor = engine.advanceCursor(cursor, REPORT_STYLES.cardTitle.spaceBefore);
    const titleFont = fonts.getFont(REPORT_STYLES.cardTitle.fontVariant);
    cursor = engine.drawWrappedText(
      cursor,
      note.name,
      titleFont,
      REPORT_STYLES.cardTitle.fontSize,
      REPORT_STYLES.cardTitle.color,
      { lineHeight: REPORT_STYLES.cardTitle.lineHeight },
    );
    cursor = engine.advanceCursor(cursor, REPORT_STYLES.cardTitle.spaceAfter);

    // Render note content as markdown
    if (note.content) {
      cursor = markdownRenderer.render(cursor, note.content);
    }

    // Separator between notes
    cursor = engine.advanceCursor(cursor, 6);
    cursor = engine.drawHorizontalRule(cursor, STRUCTURAL_COLORS.cardSeparator, 0.5);
  }

  return cursor;
}

// ────────────────────────────────────────────────────────────────────
// Page Footer
// ────────────────────────────────────────────────────────────────────

/**
 * Add data classification footer and page numbers to all pages.
 * Classification is centered, page number is right-aligned.
 */
export function addPageFooters(
  doc: PDFDocument,
  fonts: PdfFontManager,
  config: { pageWidth: number; margin: number },
  classificationText: string | null,
  transloco: TranslocoService,
): void {
  const pages = doc.getPages();
  const totalPages = pages.length;
  const font = fonts.getFont(REPORT_STYLES.footer.fontVariant);
  const fontSize = REPORT_STYLES.footer.fontSize;
  const color = REPORT_STYLES.footer.color;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const y = config.margin / 2;

    // Data classification centered
    if (classificationText) {
      const classWidth = font.widthOfTextAtSize(classificationText, fontSize);
      const classX = (page.getWidth() - classWidth) / 2;

      page.drawText(classificationText, {
        x: classX,
        y,
        size: fontSize,
        font,
        color,
      });
    }

    // Page number right-aligned: "Page X of Y"
    const pageNumText = transloco.translate('report.pageOf', {
      current: i + 1,
      total: totalPages,
    });
    const numWidth = font.widthOfTextAtSize(pageNumText, fontSize);
    const numX = page.getWidth() - config.margin - numWidth;

    page.drawText(pageNumText, {
      x: numX,
      y,
      size: fontSize,
      font,
      color,
    });
  }
}

// ────────────────────────────────────────────────────────────────────
// SVG to PNG Conversion (migrated from original service)
// ────────────────────────────────────────────────────────────────────

const PRINT_DPI = 300;
const SCREEN_DPI = 72;

/**
 * Convert base64-encoded SVG to PNG for pdf-lib embedding.
 * Renders at 300 DPI for print quality.
 */
function convertSvgToPng(
  base64Svg: string,
  displayWidth: number,
): Promise<{ pngData: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    try {
      const svgString = atob(base64Svg);
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (!svgElement) {
        throw new Error('Invalid SVG: no svg element found');
      }

      let originalWidth = 800;
      let originalHeight = 600;

      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');

      if (widthAttr && heightAttr) {
        originalWidth = parseFloat(widthAttr);
        originalHeight = parseFloat(heightAttr);
      } else {
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(parseFloat);
          if (vbWidth && vbHeight) {
            originalWidth = vbWidth;
            originalHeight = vbHeight;
          }
        }
      }

      const aspectRatio = originalHeight / originalWidth;
      const displayHeight = Math.round(displayWidth * aspectRatio);
      const dpiScale = PRINT_DPI / SCREEN_DPI;
      const canvasWidth = Math.round(displayWidth * dpiScale);
      const canvasHeight = Math.round(displayHeight * dpiScale);

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.scale(dpiScale, dpiScale);

      const img = new Image();

      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to convert canvas to blob'));
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              if (reader.result instanceof ArrayBuffer) {
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
      img.src = `data:image/svg+xml;base64,${base64Svg}`;
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
