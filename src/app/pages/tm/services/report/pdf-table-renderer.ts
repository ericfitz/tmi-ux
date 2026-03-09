import { PdfLayoutEngine, Cursor } from './pdf-layout-engine';
import { PdfFontManager } from './pdf-font-manager';
import { REPORT_STYLES, STRUCTURAL_COLORS, SPACING } from './pdf-stylesheet';

/**
 * Column definition for a table.
 */
export interface TableColumn {
  header: string;
  proportion: number;
}

/**
 * A row of string cell values.
 */
export interface TableRow {
  cells: string[];
}

/**
 * Renders tables with proportional column widths and word-wrapped cells.
 *
 * Key behaviors:
 * - Column widths are proportional fractions of the content width
 * - Cell text wraps within its column
 * - Row height is determined by the tallest cell
 * - Page breaks between rows (never mid-row)
 * - Header row is repeated on new pages
 */
export class PdfTableRenderer {
  constructor(
    private engine: PdfLayoutEngine,
    private fonts: PdfFontManager,
  ) {}

  /**
   * Render a complete table with header and data rows.
   */
  drawTable(cursor: Cursor, columns: TableColumn[], rows: TableRow[]): Cursor {
    const columnWidths = this.computeColumnWidths(columns);

    // Draw initial header
    cursor = this.drawHeaderRow(cursor, columns, columnWidths);

    // Draw data rows
    for (const row of rows) {
      const rowHeight = this.measureRowHeight(row, columnWidths);

      // Check if row fits on current page; if not, start new page with header
      if (cursor.y - rowHeight < this.engine.bottomBound) {
        cursor = this.engine.newPage();
        cursor = this.drawHeaderRow(cursor, columns, columnWidths);
      }

      cursor = this.drawDataRow(cursor, row, columnWidths);
    }

    return cursor;
  }

  /**
   * Compute absolute column widths from proportions.
   */
  private computeColumnWidths(columns: TableColumn[]): number[] {
    const contentWidth = this.engine.contentWidth;
    return columns.map(col => col.proportion * contentWidth);
  }

  /**
   * Pre-compute the height of a row by measuring all cells.
   */
  private measureRowHeight(row: TableRow, columnWidths: number[]): number {
    const font = this.fonts.getFont(REPORT_STYLES.tableCell.fontVariant);
    const fontSize = REPORT_STYLES.tableCell.fontSize;
    const lineHeight = REPORT_STYLES.tableCell.lineHeight;
    const padding = SPACING.tableCellPadding;

    let maxHeight: number = lineHeight;

    for (let i = 0; i < row.cells.length && i < columnWidths.length; i++) {
      const cellWidth = columnWidths[i] - padding * 2;
      const cellText = row.cells[i] || '';
      const height = this.engine.measureWrappedTextHeight(
        cellText,
        font,
        fontSize,
        cellWidth,
        lineHeight,
      );
      maxHeight = Math.max(maxHeight, height);
    }

    return maxHeight + padding; // padding below row
  }

  /**
   * Draw the header row with word-wrapped cells and a horizontal line underneath.
   */
  private drawHeaderRow(cursor: Cursor, columns: TableColumn[], columnWidths: number[]): Cursor {
    const font = this.fonts.getFont(REPORT_STYLES.tableHeader.fontVariant);
    const fontSize = REPORT_STYLES.tableHeader.fontSize;
    const color = REPORT_STYLES.tableHeader.color;
    const lineHeight = REPORT_STYLES.tableHeader.lineHeight;
    const padding = SPACING.tableCellPadding;

    // Pre-compute wrapped lines for each header to find the row height
    const headerLines: string[][] = [];
    for (let i = 0; i < columns.length && i < columnWidths.length; i++) {
      const cellWidth = columnWidths[i] - padding * 2;
      const lines = this.engine.wrapText(columns[i].header, font, fontSize, cellWidth);
      headerLines.push(lines);
    }

    const maxLines = Math.max(...headerLines.map(lines => lines.length), 1);
    const headerHeight = maxLines * lineHeight;

    // Ensure space for header + at least one data row
    cursor = this.engine.ensureSpace(cursor, headerHeight + 30);

    const rowStartY = cursor.y;

    // Draw each header cell's wrapped lines
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      let x = this.engine.leftX;

      for (let colIdx = 0; colIdx < headerLines.length; colIdx++) {
        const lines = headerLines[colIdx];
        if (lineIdx < lines.length) {
          cursor.page.drawText(lines[lineIdx], {
            x: x + padding,
            y: rowStartY - lineIdx * lineHeight,
            size: fontSize,
            font,
            color,
          });
        }
        x += columnWidths[colIdx];
      }
    }

    // Move cursor down past all header lines and draw separator line
    cursor = { page: cursor.page, y: rowStartY - headerHeight - 2 };

    const lineEndX = this.engine.leftX + columnWidths.reduce((sum, w) => sum + w, 0);
    cursor.page.drawLine({
      start: { x: this.engine.leftX, y: cursor.y },
      end: { x: lineEndX, y: cursor.y },
      color: STRUCTURAL_COLORS.tableLine,
      thickness: 1,
    });

    cursor = { page: cursor.page, y: cursor.y - 4 };
    return cursor;
  }

  /**
   * Draw a single data row with word-wrapped cells.
   */
  private drawDataRow(cursor: Cursor, row: TableRow, columnWidths: number[]): Cursor {
    const font = this.fonts.getFont(REPORT_STYLES.tableCell.fontVariant);
    const fontSize = REPORT_STYLES.tableCell.fontSize;
    const color = REPORT_STYLES.tableCell.color;
    const lineHeight = REPORT_STYLES.tableCell.lineHeight;
    const padding = SPACING.tableCellPadding;

    // Pre-compute wrapped lines for each cell to find the row height
    const cellLines: string[][] = [];
    for (let i = 0; i < row.cells.length && i < columnWidths.length; i++) {
      const cellWidth = columnWidths[i] - padding * 2;
      const cellText = row.cells[i] || '';
      const lines = this.engine.wrapText(cellText, font, fontSize, cellWidth);
      cellLines.push(lines);
    }

    const maxLines = Math.max(...cellLines.map(lines => lines.length), 1);
    const rowStartY = cursor.y;

    // Draw each cell's lines
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      let x = this.engine.leftX;

      for (let colIdx = 0; colIdx < cellLines.length; colIdx++) {
        const lines = cellLines[colIdx];
        if (lineIdx < lines.length) {
          cursor.page.drawText(lines[lineIdx], {
            x: x + padding,
            y: rowStartY - lineIdx * lineHeight,
            size: fontSize,
            font,
            color,
          });
        }
        x += columnWidths[colIdx];
      }
    }

    // Advance cursor past all lines plus padding
    const totalRowHeight = maxLines * lineHeight + padding;
    return { page: cursor.page, y: rowStartY - totalRowHeight };
  }
}
