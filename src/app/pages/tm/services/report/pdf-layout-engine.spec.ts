import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import { PdfLayoutEngine, LayoutConfig } from './pdf-layout-engine';

describe('PdfLayoutEngine', () => {
  let doc: PDFDocument;
  let engine: PdfLayoutEngine;
  let font: PDFFont;
  const config: LayoutConfig = {
    pageWidth: 612, // US Letter
    pageHeight: 792,
    margin: 54, // standard (0.75")
    footerReservedHeight: 20,
  };

  beforeEach(async () => {
    doc = await PDFDocument.create();
    engine = new PdfLayoutEngine(doc, config);
    font = await doc.embedFont('Helvetica');
  });

  describe('computed properties', () => {
    it('should calculate contentWidth as page width minus both margins', () => {
      expect(engine.contentWidth).toBe(612 - 2 * 54);
      expect(engine.contentWidth).toBe(504);
    });

    it('should calculate bottomBound as margin + footer reserved height', () => {
      expect(engine.bottomBound).toBe(54 + 20);
      expect(engine.bottomBound).toBe(74);
    });

    it('should calculate topBound as page height minus margin', () => {
      expect(engine.topBound).toBe(792 - 54);
      expect(engine.topBound).toBe(738);
    });

    it('should expose leftX as the margin', () => {
      expect(engine.leftX).toBe(54);
    });

    it('should work with A4 and narrow margins', () => {
      const a4Engine = new PdfLayoutEngine(doc, {
        pageWidth: 595,
        pageHeight: 842,
        margin: 36,
        footerReservedHeight: 20,
      });
      expect(a4Engine.contentWidth).toBe(595 - 72);
      expect(a4Engine.topBound).toBe(842 - 36);
    });
  });

  describe('newPage', () => {
    it('should add a page to the document', () => {
      const initialPageCount = doc.getPageCount();
      engine.newPage();
      expect(doc.getPageCount()).toBe(initialPageCount + 1);
    });

    it('should return cursor at topBound', () => {
      const cursor = engine.newPage();
      expect(cursor.y).toBe(738);
    });

    it('should return the newly created page', () => {
      const cursor = engine.newPage();
      const pages = doc.getPages();
      expect(cursor.page).toBe(pages[pages.length - 1]);
    });
  });

  describe('ensureSpace', () => {
    it('should return same cursor when enough space exists', () => {
      const cursor = engine.newPage();
      const result = engine.ensureSpace(cursor, 100);
      expect(result.y).toBe(cursor.y);
      expect(result.page).toBe(cursor.page);
    });

    it('should create new page when not enough space', () => {
      const cursor = engine.newPage();
      // Position cursor near bottom
      const lowCursor = { page: cursor.page, y: engine.bottomBound + 10 };
      const result = engine.ensureSpace(lowCursor, 50);
      expect(result.y).toBe(engine.topBound);
      expect(result.page).not.toBe(cursor.page);
    });

    it('should keep current page when exactly enough space', () => {
      const cursor = engine.newPage();
      const lowCursor = { page: cursor.page, y: engine.bottomBound + 100 };
      const result = engine.ensureSpace(lowCursor, 100);
      expect(result.page).toBe(cursor.page);
    });
  });

  describe('advanceCursor', () => {
    it('should decrease y by the given amount', () => {
      const cursor = engine.newPage();
      const result = engine.advanceCursor(cursor, 50);
      expect(result.y).toBe(cursor.y - 50);
      expect(result.page).toBe(cursor.page);
    });

    it('should create new page when advancing below bottom bound', () => {
      const cursor = engine.newPage();
      const lowCursor = { page: cursor.page, y: engine.bottomBound + 5 };
      const result = engine.advanceCursor(lowCursor, 10);
      expect(result.y).toBe(engine.topBound);
      expect(result.page).not.toBe(cursor.page);
    });
  });

  describe('wrapText', () => {
    it('should return single line for empty string', () => {
      const result = engine.wrapText('', font, 10, 200);
      expect(result).toEqual(['']);
    });

    it('should return single line when text fits', () => {
      const result = engine.wrapText('Hello', font, 10, 500);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Hello');
    });

    it('should wrap text at word boundaries', () => {
      // Create a string that won't fit on one line at 200pt width
      const longText = 'The quick brown fox jumps over the lazy dog and keeps running far away';
      const result = engine.wrapText(longText, font, 10, 200);
      expect(result.length).toBeGreaterThan(1);

      // Each line should fit within 200pt
      for (const line of result) {
        const lineWidth = font.widthOfTextAtSize(line, 10);
        expect(lineWidth).toBeLessThanOrEqual(200 + 1); // +1 for floating point
      }

      // Reconstructed text should match original (modulo whitespace normalization)
      expect(result.join(' ')).toBe(longText);
    });

    it('should handle single word exceeding max width with character break', () => {
      const longWord = 'Superlongwordthatdoesnotfitinthecolumn';
      const result = engine.wrapText(longWord, font, 10, 80);
      expect(result.length).toBeGreaterThan(1);

      // Reconstructed should match original
      expect(result.join('')).toBe(longWord);
    });

    it('should handle text with multiple spaces', () => {
      const result = engine.wrapText('hello   world', font, 10, 500);
      expect(result).toEqual(['hello world']);
    });

    it('should handle single word that fits', () => {
      const result = engine.wrapText('Hello', font, 10, 500);
      expect(result).toEqual(['Hello']);
    });

    it('should handle text with only whitespace', () => {
      const result = engine.wrapText('   ', font, 10, 500);
      expect(result).toEqual(['']);
    });

    it('should handle very narrow max width', () => {
      const result = engine.wrapText('AB', font, 10, 5);
      // Each character should be on its own line if 5pt is too narrow for 2 chars
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join('')).toBe('AB');
    });

    it('should return text as-is when maxWidth is 0', () => {
      const result = engine.wrapText('Hello', font, 10, 0);
      expect(result).toEqual(['Hello']);
    });
  });

  describe('drawText', () => {
    it('should draw text at the cursor position', () => {
      const cursor = engine.newPage();
      const drawTextSpy = vi.spyOn(cursor.page, 'drawText');

      engine.drawText(cursor, 'Hello', font, 12, rgb(0, 0, 0));

      expect(drawTextSpy).toHaveBeenCalledWith('Hello', {
        x: engine.leftX,
        y: cursor.y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
    });

    it('should center text when centered option is true', () => {
      const cursor = engine.newPage();
      const drawTextSpy = vi.spyOn(cursor.page, 'drawText');

      engine.drawText(cursor, 'Hi', font, 12, rgb(0, 0, 0), { centered: true });

      const call = drawTextSpy.mock.calls[0];
      const textWidth = font.widthOfTextAtSize('Hi', 12);
      const expectedX = (612 - textWidth) / 2;

      expect(call[1].x).toBeCloseTo(expectedX, 0);
    });

    it('should use custom x when provided', () => {
      const cursor = engine.newPage();
      const drawTextSpy = vi.spyOn(cursor.page, 'drawText');

      engine.drawText(cursor, 'Test', font, 10, rgb(0, 0, 0), { x: 100 });

      expect(drawTextSpy.mock.calls[0][1].x).toBe(100);
    });
  });

  describe('drawWrappedText', () => {
    it('should advance cursor by line height for single-line text', () => {
      const cursor = engine.newPage();
      const result = engine.drawWrappedText(cursor, 'Short', font, 10, rgb(0, 0, 0));
      expect(result.y).toBe(cursor.y - 14); // default lineHeight = 10 * 1.4
    });

    it('should handle page break during wrapping', () => {
      const cursor = engine.newPage();
      // Position cursor near bottom with room for only 1 line
      const lowCursor = { page: cursor.page, y: engine.bottomBound + 15 };

      const result = engine.drawWrappedText(
        lowCursor,
        'Line one and also line two which should be on a new page',
        font,
        10,
        rgb(0, 0, 0),
        { maxWidth: 100 },
      );

      // Should have created a new page
      expect(doc.getPageCount()).toBeGreaterThan(1);
      expect(result.page).not.toBe(cursor.page);
    });

    it('should respect indent option', () => {
      const cursor = engine.newPage();
      const drawTextSpy = vi.spyOn(cursor.page, 'drawText');

      engine.drawWrappedText(cursor, 'Indented text', font, 10, rgb(0, 0, 0), {
        indent: 20,
      });

      const call = drawTextSpy.mock.calls[0];
      expect(call[1].x).toBe(engine.leftX + 20);
    });

    it('should respect custom lineHeight', () => {
      const cursor = engine.newPage();
      const result = engine.drawWrappedText(cursor, 'Test', font, 10, rgb(0, 0, 0), {
        lineHeight: 20,
      });
      expect(result.y).toBe(cursor.y - 20);
    });
  });

  describe('drawHorizontalRule', () => {
    it('should draw a line and advance cursor', () => {
      const cursor = engine.newPage();
      const drawLineSpy = vi.spyOn(cursor.page, 'drawLine');

      const result = engine.drawHorizontalRule(cursor, rgb(0.8, 0.8, 0.8));

      expect(drawLineSpy).toHaveBeenCalledTimes(1);
      expect(result.y).toBeLessThan(cursor.y);
    });
  });

  describe('measureWrappedTextHeight', () => {
    it('should return line height for single-line text', () => {
      const height = engine.measureWrappedTextHeight('Short', font, 10, 500);
      expect(height).toBeCloseTo(14, 0); // 10 * 1.4
    });

    it('should return multiple line heights for multi-line wrapping', () => {
      const text = 'The quick brown fox jumps over the lazy dog and keeps running far away';
      const lines = engine.wrapText(text, font, 10, 200);
      const height = engine.measureWrappedTextHeight(text, font, 10, 200);
      expect(height).toBeCloseTo(lines.length * 14, 0);
    });

    it('should respect custom lineHeight', () => {
      const height = engine.measureWrappedTextHeight('Short', font, 10, 500, 20);
      expect(height).toBe(20);
    });
  });

  describe('drawKeyValuePair', () => {
    it('should draw label and value on same line when value fits', () => {
      const cursor = engine.newPage();
      const drawTextSpy = vi.spyOn(cursor.page, 'drawText');

      engine.drawKeyValuePair(
        cursor,
        'Status',
        'Open',
        font,
        font,
        10,
        rgb(0.3, 0.3, 0.3),
        rgb(0, 0, 0),
      );

      // Should have drawn both label and value
      expect(drawTextSpy).toHaveBeenCalledTimes(2);
      // First call is the label
      expect(drawTextSpy.mock.calls[0][0]).toBe('Status: ');
      // Second call is the value
      expect(drawTextSpy.mock.calls[1][0]).toBe('Open');
    });

    it('should wrap long values across multiple lines', () => {
      // Use a narrow engine to force wrapping
      const narrowConfig: LayoutConfig = {
        pageWidth: 300,
        pageHeight: 792,
        margin: 30,
        footerReservedHeight: 20,
      };
      const narrowEngine = new PdfLayoutEngine(doc, narrowConfig);
      const cursor = narrowEngine.newPage();
      const longValue =
        'This is a very long description that should definitely wrap across multiple lines in the narrow PDF output area given the constrained width available';

      const result = narrowEngine.drawKeyValuePair(
        cursor,
        'Description',
        longValue,
        font,
        font,
        10,
        rgb(0.3, 0.3, 0.3),
        rgb(0, 0, 0),
        { indent: 0 },
      );

      // Cursor should have advanced more than one line height (14pt)
      expect(cursor.y - result.y).toBeGreaterThan(14);
    });
  });
});
