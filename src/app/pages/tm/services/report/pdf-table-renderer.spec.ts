import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PdfLayoutEngine, LayoutConfig } from './pdf-layout-engine';
import { PdfFontManager } from './pdf-font-manager';
import { PdfTableRenderer, TableColumn, TableRow } from './pdf-table-renderer';

describe('PdfTableRenderer', () => {
  let doc: PDFDocument;
  let engine: PdfLayoutEngine;
  let fonts: PdfFontManager;
  let renderer: PdfTableRenderer;

  const config: LayoutConfig = {
    pageWidth: 612,
    pageHeight: 792,
    margin: 54,
    footerReservedHeight: 20,
  };

  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debugComponent: () => {},
  };

  beforeEach(async () => {
    doc = await PDFDocument.create();
    engine = new PdfLayoutEngine(doc, config);
    fonts = new PdfFontManager(doc, mockLogger);
    // Load fonts using standard fonts (no fetch needed in test)
    await fonts.loadFonts('en-US');
    renderer = new PdfTableRenderer(engine, fonts);
  });

  describe('drawTable', () => {
    const columns: TableColumn[] = [
      { header: 'Name', proportion: 0.33 },
      { header: 'Type', proportion: 0.33 },
      { header: 'Value', proportion: 0.34 },
    ];

    it('should draw a table with header and rows', () => {
      const cursor = engine.newPage();
      const rows: TableRow[] = [
        { cells: ['Asset 1', 'Data', 'Description of asset 1'] },
        { cells: ['Asset 2', 'Hardware', 'Description of asset 2'] },
      ];

      const result = renderer.drawTable(cursor, columns, rows);

      // Cursor should have advanced past header + 2 rows
      expect(result.y).toBeLessThan(cursor.y);
      // Should still be on the same page for a small table
      expect(doc.getPageCount()).toBe(1);
    });

    it('should handle empty rows array', () => {
      const cursor = engine.newPage();
      const result = renderer.drawTable(cursor, columns, []);

      // Should just draw header and return
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should create new page for many rows', () => {
      const cursor = engine.newPage();
      const rows: TableRow[] = [];
      for (let i = 0; i < 60; i++) {
        rows.push({ cells: [`Row ${i}`, `Type ${i}`, `Description for row ${i}`] });
      }

      renderer.drawTable(cursor, columns, rows);

      // 60 rows should require multiple pages
      expect(doc.getPageCount()).toBeGreaterThan(1);
    });

    it('should handle cells with long wrapping text', () => {
      const cursor = engine.newPage();
      const rows: TableRow[] = [
        {
          cells: [
            'Short',
            'Medium-length type value',
            'A very long description that should wrap within the column to multiple lines in the output',
          ],
        },
      ];

      const result = renderer.drawTable(cursor, columns, rows);

      // Row should consume more vertical space due to wrapping
      expect(cursor.y - result.y).toBeGreaterThan(30);
    });

    it('should handle empty cell values', () => {
      const cursor = engine.newPage();
      const rows: TableRow[] = [{ cells: ['Name', '', ''] }];

      const result = renderer.drawTable(cursor, columns, rows);
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should handle rows with fewer cells than columns', () => {
      const cursor = engine.newPage();
      const rows: TableRow[] = [{ cells: ['Only one cell'] }];

      // Should not throw
      const result = renderer.drawTable(cursor, columns, rows);
      expect(result.y).toBeLessThan(cursor.y);
    });
  });
});
