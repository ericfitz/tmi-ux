import { PDFDocument, PDFPage, PDFFont, Color } from 'pdf-lib';
import { SPACING } from './pdf-stylesheet';

/**
 * Configuration for the layout engine, derived from user preferences.
 */
export interface LayoutConfig {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  footerReservedHeight: number;
}

/**
 * Cursor state tracking the current page and vertical position.
 * Y decreases from top to bottom in PDF coordinate space.
 */
export interface Cursor {
  page: PDFPage;
  y: number;
}

/**
 * Options for wrapped text drawing.
 */
interface DrawWrappedTextOptions {
  /** Maximum width for text wrapping. Defaults to contentWidth. */
  maxWidth?: number;
  /** Left indent from margin in points. */
  indent?: number;
  /** Line height override. Defaults to fontSize * 1.4. */
  lineHeight?: number;
  /** Center each wrapped line horizontally on the page. */
  centered?: boolean;
}

/**
 * Core layout engine for PDF report generation.
 *
 * Manages text wrapping, cursor tracking, page breaks, and orphan prevention.
 * All drawing methods accept and return a Cursor, making the flow explicit
 * and the engine composable.
 */
// SEM@f8104de88552a4dfddc56d5f7839c36cbe0aa074: render text, rules, and key-value pairs onto paginated PDF pages (mutates shared state)
export class PdfLayoutEngine {
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: build a layout engine bound to a PDF document and layout config (pure)
  constructor(
    private doc: PDFDocument,
    private config: LayoutConfig,
  ) {}

  /** Usable content area width (page width minus both margins). */
  get contentWidth(): number {
    return this.config.pageWidth - 2 * this.config.margin;
  }

  /** Bottom boundary: margin + footer reservation. */
  get bottomBound(): number {
    return this.config.margin + (this.config.footerReservedHeight ?? SPACING.footerReservedHeight);
  }

  /** Starting Y position for content on a new page. */
  get topBound(): number {
    return this.config.pageHeight - this.config.margin;
  }

  /** Left margin X coordinate. */
  get leftX(): number {
    return this.config.margin;
  }

  /** Page dimensions from config. */
  get pageWidth(): number {
    return this.config.pageWidth;
  }

  get pageHeight(): number {
    return this.config.pageHeight;
  }

  get margin(): number {
    return this.config.margin;
  }

  /**
   * Create a new page and return a cursor at the top content position.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: add a new page to the PDF document and return a cursor at the top content position (mutates shared state)
  newPage(): Cursor {
    const page = this.doc.addPage([this.config.pageWidth, this.config.pageHeight]);
    return { page, y: this.topBound };
  }

  /**
   * Ensure at least `requiredHeight` points remain on the current page.
   * If not, starts a new page. Used for orphan prevention.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: start a new page if remaining vertical space is insufficient for required height (mutates shared state)
  ensureSpace(cursor: Cursor, requiredHeight: number): Cursor {
    if (cursor.y - requiredHeight < this.bottomBound) {
      return this.newPage();
    }
    return cursor;
  }

  /**
   * Advance the cursor vertically by the given number of points.
   * Starts a new page if the cursor would go below the bottom bound.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: move cursor down by given points, starting a new page if below bottom bound (mutates shared state)
  advanceCursor(cursor: Cursor, points: number): Cursor {
    const newY = cursor.y - points;
    if (newY < this.bottomBound) {
      return this.newPage();
    }
    return { page: cursor.page, y: newY };
  }

  /**
   * Word-wrap text to fit within the given width.
   *
   * Algorithm:
   * 1. Split text on whitespace boundaries
   * 2. Accumulate words into a line, measuring width via font metrics
   * 3. When a word would exceed maxWidth, start a new line
   * 4. Handle single words exceeding maxWidth by character-level break
   *
   * @returns Array of wrapped line strings
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: wrap text into lines fitting a max pixel width, breaking overlong words by character (pure)
  wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    if (!text || maxWidth <= 0) {
      return text ? [text] : [''];
    }

    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      return [''];
    }

    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        // Current line is full — push it and start new line with this word
        lines.push(currentLine);

        // Check if the single word itself exceeds maxWidth
        const wordWidth = font.widthOfTextAtSize(word, fontSize);
        if (wordWidth > maxWidth) {
          const brokenLines = this.breakWord(word, font, fontSize, maxWidth);
          // Add all but the last broken line (the last becomes currentLine)
          for (let i = 0; i < brokenLines.length - 1; i++) {
            lines.push(brokenLines[i]);
          }
          currentLine = brokenLines[brokenLines.length - 1];
        } else {
          currentLine = word;
        }
      } else if (testWidth > maxWidth && !currentLine) {
        // First word on the line exceeds maxWidth — character break needed
        const brokenLines = this.breakWord(word, font, fontSize, maxWidth);
        for (let i = 0; i < brokenLines.length - 1; i++) {
          lines.push(brokenLines[i]);
        }
        currentLine = brokenLines[brokenLines.length - 1];
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }

  /**
   * Break a single word into lines that fit within maxWidth.
   * Used when a word is too long for the available space.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: split a single word into character-level segments that fit within max width (pure)
  private breakWord(word: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = '';

    for (const char of word) {
      const test = current + char;
      const testWidth = font.widthOfTextAtSize(test, fontSize);

      if (testWidth > maxWidth && current) {
        lines.push(current);
        current = char;
      } else {
        current = test;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [''];
  }

  /**
   * Draw a single line of text at the cursor position (no wrapping).
   * Does NOT handle page breaks — caller must ensureSpace first.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: draw a single text line at cursor position without wrapping or page break (mutates shared state)
  drawText(
    cursor: Cursor,
    text: string,
    font: PDFFont,
    fontSize: number,
    color: Color,
    options?: { x?: number; centered?: boolean },
  ): Cursor {
    let x = options?.x ?? this.leftX;

    if (options?.centered) {
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      x = (this.config.pageWidth - textWidth) / 2;
      x = Math.max(this.leftX, x);
    }

    cursor.page.drawText(text, {
      x,
      y: cursor.y,
      size: fontSize,
      font,
      color,
    });

    return cursor;
  }

  /**
   * Draw text with automatic word wrapping and page break handling.
   * Returns the cursor positioned after all text has been drawn.
   */
  // SEM@f8104de88552a4dfddc56d5f7839c36cbe0aa074: draw word-wrapped text across pages, advancing cursor after each line (mutates shared state)
  drawWrappedText(
    cursor: Cursor,
    text: string,
    font: PDFFont,
    fontSize: number,
    color: Color,
    options?: DrawWrappedTextOptions,
  ): Cursor {
    const maxWidth = options?.maxWidth ?? this.contentWidth;
    const indent = options?.indent ?? 0;
    const centered = options?.centered ?? false;
    const lineHeight = options?.lineHeight ?? fontSize * 1.4;
    const effectiveMaxWidth = maxWidth - indent;

    const lines = this.wrapText(text, font, fontSize, effectiveMaxWidth);
    const baseX = this.leftX + indent;

    for (const line of lines) {
      if (cursor.y - lineHeight < this.bottomBound) {
        cursor = this.newPage();
      }

      let x = baseX;
      if (centered) {
        const lineWidth = font.widthOfTextAtSize(line, fontSize);
        x = Math.max(this.leftX, (this.config.pageWidth - lineWidth) / 2);
      }

      cursor.page.drawText(line, {
        x,
        y: cursor.y,
        size: fontSize,
        font,
        color,
      });

      cursor = { page: cursor.page, y: cursor.y - lineHeight };
    }

    return cursor;
  }

  /**
   * Draw a horizontal rule across the content width.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: draw a horizontal rule line across the content width at cursor position (mutates shared state)
  drawHorizontalRule(
    cursor: Cursor,
    color: Color,
    thickness: number = 0.5,
    indent: number = 0,
  ): Cursor {
    const startX = this.leftX + indent;
    const endX = this.leftX + this.contentWidth;
    const y = cursor.y - 2;

    cursor.page.drawLine({
      start: { x: startX, y },
      end: { x: endX, y },
      color,
      thickness,
    });

    return { page: cursor.page, y: y - 4 };
  }

  /**
   * Draw a "Label: Value" pair where the label is drawn with one font
   * and the value with another. Value text wraps if needed.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: draw a label-value pair, wrapping the value text if it exceeds available width (mutates shared state)
  drawKeyValuePair(
    cursor: Cursor,
    labelText: string,
    valueText: string,
    labelFont: PDFFont,
    valueFont: PDFFont,
    fontSize: number,
    labelColor: Color,
    valueColor: Color,
    options?: { indent?: number; lineHeight?: number },
  ): Cursor {
    const indent = options?.indent ?? 0;
    const lineHeight = options?.lineHeight ?? fontSize * 1.4;
    const x = this.leftX + indent;

    // Measure the label width to place the value after it
    const labelWithColon = `${labelText}: `;
    const labelWidth = labelFont.widthOfTextAtSize(labelWithColon, fontSize);
    const availableForValue = this.contentWidth - indent - labelWidth;

    // Ensure space for at least one line
    cursor = this.ensureSpace(cursor, lineHeight);

    // Draw label
    cursor.page.drawText(labelWithColon, {
      x,
      y: cursor.y,
      size: fontSize,
      font: labelFont,
      color: labelColor,
    });

    // If value fits on the same line, draw it inline
    const valueWidth = valueFont.widthOfTextAtSize(valueText, fontSize);
    if (valueWidth <= availableForValue) {
      cursor.page.drawText(valueText, {
        x: x + labelWidth,
        y: cursor.y,
        size: fontSize,
        font: valueFont,
        color: valueColor,
      });
      return { page: cursor.page, y: cursor.y - lineHeight };
    }

    // Value needs wrapping — wrap to the available width after the label
    const valueLines = this.wrapText(valueText, valueFont, fontSize, availableForValue);

    // Draw first line inline with label
    if (valueLines.length > 0) {
      cursor.page.drawText(valueLines[0], {
        x: x + labelWidth,
        y: cursor.y,
        size: fontSize,
        font: valueFont,
        color: valueColor,
      });
      cursor = { page: cursor.page, y: cursor.y - lineHeight };
    }

    // Draw remaining lines indented to align with value start
    for (let i = 1; i < valueLines.length; i++) {
      if (cursor.y - lineHeight < this.bottomBound) {
        cursor = this.newPage();
      }

      cursor.page.drawText(valueLines[i], {
        x: x + labelWidth,
        y: cursor.y,
        size: fontSize,
        font: valueFont,
        color: valueColor,
      });
      cursor = { page: cursor.page, y: cursor.y - lineHeight };
    }

    return cursor;
  }

  /**
   * Calculate the total height that wrapped text would occupy,
   * without actually drawing it. Useful for pre-measuring.
   */
  // SEM@1cafa46a66ac309a41eca39407da0ab7c5628cb2: compute total height of wrapped text without drawing it (pure)
  measureWrappedTextHeight(
    text: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number,
    lineHeight?: number,
  ): number {
    const lh = lineHeight ?? fontSize * 1.4;
    const lines = this.wrapText(text, font, fontSize, maxWidth);
    return lines.length * lh;
  }
}
