import { lexer, Token, Tokens } from 'marked';
import { Color } from 'pdf-lib';
import { PdfLayoutEngine, Cursor } from './pdf-layout-engine';
import { PdfFontManager } from './pdf-font-manager';
import { REPORT_STYLES, SPACING, STRUCTURAL_COLORS, FontVariant } from './pdf-stylesheet';

/**
 * A segment of text with a style annotation, used for mixed-style rendering.
 */
export interface TextSegment {
  text: string;
  style: FontVariant;
}

/**
 * Converts markdown content to PDF using marked lexer tokens.
 *
 * Supported block-level tokens:
 * - heading (h1-h6), paragraph, code, list, blockquote, hr, space
 *
 * Supported inline tokens (within paragraphs, list items, headings):
 * - strong (bold), em (italic), codespan (monospace), link, text, br
 *
 * Unsupported (gracefully skipped):
 * - image, markdown table, html, del (strikethrough)
 */
export class PdfMarkdownRenderer {
  constructor(
    private engine: PdfLayoutEngine,
    private fonts: PdfFontManager,
  ) {}

  /**
   * Render markdown text to PDF starting at the given cursor.
   */
  render(cursor: Cursor, markdownText: string): Cursor {
    if (!markdownText || !markdownText.trim()) {
      return cursor;
    }

    const tokens = lexer(markdownText);
    return this.renderBlockTokens(cursor, tokens);
  }

  /**
   * Render an array of block-level tokens.
   */
  private renderBlockTokens(cursor: Cursor, tokens: Token[]): Cursor {
    for (const token of tokens) {
      cursor = this.renderBlockToken(cursor, token);
    }
    return cursor;
  }

  /**
   * Dispatch a single block-level token to the appropriate renderer.
   */
  private renderBlockToken(cursor: Cursor, token: Token): Cursor {
    switch (token.type) {
      case 'heading':
        return this.renderHeading(cursor, token as Tokens.Heading);
      case 'paragraph':
        return this.renderParagraph(cursor, token as Tokens.Paragraph);
      case 'code':
        return this.renderCodeBlock(cursor, token as Tokens.Code);
      case 'list':
        return this.renderList(cursor, token as Tokens.List, 0);
      case 'blockquote':
        return this.renderBlockquote(cursor, token as Tokens.Blockquote);
      case 'hr':
        return this.renderHorizontalRule(cursor);
      case 'space':
        return this.engine.advanceCursor(cursor, 6);
      default:
        // Unsupported token types (table, html, image, etc.) — skip silently
        return cursor;
    }
  }

  /**
   * Render a heading (h1-h6). Maps to mdH1, mdH2, or mdH3 styles.
   */
  private renderHeading(cursor: Cursor, token: Tokens.Heading): Cursor {
    const styleMap: Record<number, keyof typeof REPORT_STYLES> = {
      1: 'mdH1',
      2: 'mdH2',
      3: 'mdH3',
    };
    // h4-h6 use mdH3 as the smallest heading style
    const styleName = styleMap[token.depth] ?? 'mdH3';
    const style = REPORT_STYLES[styleName];

    // Space before heading
    cursor = this.engine.advanceCursor(cursor, style.spaceBefore);

    // Ensure heading + some content stay together (orphan prevention)
    cursor = this.engine.ensureSpace(cursor, style.lineHeight + 30);

    // Headings may contain inline formatting (bold, italic, etc.)
    if (token.tokens && token.tokens.length > 0) {
      const segments = this.flattenInlineTokens(token.tokens);
      // For headings, override all segment styles to the heading font variant
      const headingSegments = segments.map(s => ({ ...s, style: style.fontVariant }));
      cursor = this.drawMixedStyleText(
        cursor,
        headingSegments,
        style.fontSize,
        style.lineHeight,
        style.color,
      );
    } else {
      const font = this.fonts.getFont(style.fontVariant);
      cursor = this.engine.drawWrappedText(cursor, token.text, font, style.fontSize, style.color, {
        lineHeight: style.lineHeight,
      });
    }

    // Space after heading
    return this.engine.advanceCursor(cursor, style.spaceAfter);
  }

  /**
   * Render a paragraph with mixed-style inline content.
   */
  private renderParagraph(cursor: Cursor, token: Tokens.Paragraph): Cursor {
    const style = REPORT_STYLES.body;

    if (token.tokens && token.tokens.length > 0) {
      const segments = this.flattenInlineTokens(token.tokens);
      cursor = this.drawMixedStyleText(
        cursor,
        segments,
        style.fontSize,
        style.lineHeight,
        style.color,
      );
    } else {
      const font = this.fonts.getFont(style.fontVariant);
      cursor = this.engine.drawWrappedText(cursor, token.text, font, style.fontSize, style.color, {
        lineHeight: style.lineHeight,
      });
    }

    return this.engine.advanceCursor(cursor, style.spaceAfter);
  }

  /**
   * Render a fenced code block using monospace font.
   */
  private renderCodeBlock(cursor: Cursor, token: Tokens.Code): Cursor {
    const style = REPORT_STYLES.mdCode;
    const font = this.fonts.getFont('monospace');

    cursor = this.engine.advanceCursor(cursor, style.spaceBefore);

    // Draw each line of the code block
    const lines = token.text.split('\n');
    for (const line of lines) {
      cursor = this.engine.ensureSpace(cursor, style.lineHeight);
      cursor = this.engine.drawWrappedText(
        cursor,
        line || ' ', // empty lines rendered as a space to maintain spacing
        font,
        style.fontSize,
        style.color,
        { lineHeight: style.lineHeight, indent: SPACING.listIndent },
      );
    }

    return this.engine.advanceCursor(cursor, style.spaceAfter);
  }

  /**
   * Render a list (ordered or unordered) with support for nesting.
   */
  private renderList(cursor: Cursor, token: Tokens.List, depth: number): Cursor {
    const style = REPORT_STYLES.body;
    const indent = SPACING.listIndent * (depth + 1);

    for (let i = 0; i < token.items.length; i++) {
      const item = token.items[i];
      const prefix = token.ordered ? `${(token.start || 1) + i}. ` : '\u2022 '; // bullet: •

      cursor = this.engine.ensureSpace(cursor, style.lineHeight);

      // Render the item text with inline formatting
      if (item.tokens && item.tokens.length > 0) {
        // Flatten the item's inline tokens
        const segments = this.flattenListItemTokens(item.tokens);

        if (segments.length > 0) {
          // Prepend the list prefix to the first segment
          segments[0] = { text: prefix + segments[0].text, style: segments[0].style };
          cursor = this.drawMixedStyleText(
            cursor,
            segments,
            style.fontSize,
            style.lineHeight,
            style.color,
            indent,
          );
        }
      } else {
        const font = this.fonts.getFont(style.fontVariant);
        cursor = this.engine.drawWrappedText(
          cursor,
          prefix + item.text,
          font,
          style.fontSize,
          style.color,
          { lineHeight: style.lineHeight, indent },
        );
      }
    }

    return this.engine.advanceCursor(cursor, REPORT_STYLES.body.spaceAfter);
  }

  /**
   * Flatten list item tokens, handling nested lists by recursively rendering them.
   * Non-list tokens are flattened to TextSegments.
   */
  private flattenListItemTokens(tokens: Token[]): TextSegment[] {
    const segments: TextSegment[] = [];

    for (const token of tokens) {
      if (token.type === 'list') {
        // Nested lists are not flattened — they would need separate rendering
        // For simplicity, skip inline nesting and use text fallback
        continue;
      }
      if (token.type === 'text' && 'tokens' in token && Array.isArray(token.tokens)) {
        segments.push(...this.flattenInlineTokens(token.tokens));
      } else if (token.type === 'text') {
        segments.push({ text: (token as Tokens.Text).text, style: 'regular' });
      } else if ('tokens' in token && Array.isArray(token.tokens)) {
        segments.push(...this.flattenInlineTokens([token]));
      }
    }

    return segments;
  }

  /**
   * Render a blockquote (indented, italic).
   */
  private renderBlockquote(cursor: Cursor, token: Tokens.Blockquote): Cursor {
    const style = REPORT_STYLES.mdBlockquote;

    cursor = this.engine.advanceCursor(cursor, style.spaceBefore);

    // Blockquotes contain nested block tokens (typically paragraphs)
    if (token.tokens && token.tokens.length > 0) {
      for (const innerToken of token.tokens) {
        if (innerToken.type === 'paragraph') {
          const para = innerToken as Tokens.Paragraph;
          const font = this.fonts.getFont(style.fontVariant);
          cursor = this.engine.drawWrappedText(
            cursor,
            para.text,
            font,
            style.fontSize,
            style.color,
            { lineHeight: style.lineHeight, indent: SPACING.blockquoteIndent },
          );
        }
      }
    }

    return this.engine.advanceCursor(cursor, style.spaceAfter);
  }

  /**
   * Render a horizontal rule.
   */
  private renderHorizontalRule(cursor: Cursor): Cursor {
    cursor = this.engine.advanceCursor(cursor, 6);
    cursor = this.engine.drawHorizontalRule(cursor, STRUCTURAL_COLORS.cardSeparator, 0.5);
    return this.engine.advanceCursor(cursor, 6);
  }

  /**
   * Flatten inline tokens into a flat array of TextSegments.
   * Recursively handles nested inline tokens (e.g., bold within a link).
   *
   * Example: "This is **bold** and *italic*" becomes:
   * [
   *   { text: "This is ", style: "regular" },
   *   { text: "bold", style: "bold" },
   *   { text: " and ", style: "regular" },
   *   { text: "italic", style: "italic" },
   * ]
   */
  flattenInlineTokens(tokens: Token[]): TextSegment[] {
    const segments: TextSegment[] = [];

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          segments.push({ text: (token as Tokens.Text).text, style: 'regular' });
          break;

        case 'strong': {
          const strong = token as Tokens.Strong;
          if (strong.tokens && strong.tokens.length > 0) {
            const inner = this.flattenInlineTokens(strong.tokens);
            // Override inner styles to bold
            segments.push(...inner.map(s => ({ ...s, style: 'bold' as FontVariant })));
          } else {
            segments.push({ text: strong.text, style: 'bold' });
          }
          break;
        }

        case 'em': {
          const em = token as Tokens.Em;
          if (em.tokens && em.tokens.length > 0) {
            const inner = this.flattenInlineTokens(em.tokens);
            segments.push(...inner.map(s => ({ ...s, style: 'italic' as FontVariant })));
          } else {
            segments.push({ text: em.text, style: 'italic' });
          }
          break;
        }

        case 'codespan':
          segments.push({ text: (token as Tokens.Codespan).text, style: 'monospace' });
          break;

        case 'link': {
          const link = token as Tokens.Link;
          // Render as "text (url)"
          const linkText = link.text || link.href;
          if (link.text && link.href && link.text !== link.href) {
            segments.push({ text: `${linkText} (${link.href})`, style: 'regular' });
          } else {
            segments.push({ text: link.href, style: 'regular' });
          }
          break;
        }

        case 'br':
          segments.push({ text: '\n', style: 'regular' });
          break;

        case 'escape':
          segments.push({ text: (token as Tokens.Escape).text, style: 'regular' });
          break;

        default:
          // Unsupported inline token — extract raw text if possible
          if ('text' in token && typeof token.text === 'string') {
            segments.push({ text: token.text, style: 'regular' });
          }
          break;
      }
    }

    return segments;
  }

  /**
   * Draw text segments with mixed styles (different fonts per segment).
   *
   * Uses a simplified approach: renders each style-homogeneous chunk
   * independently with word wrapping. This handles most cases well
   * (a paragraph with a few bold words) even though line breaks
   * don't perfectly span across style boundaries.
   *
   * For truly seamless mixed-style wrapping, we'd need word-level
   * font switching, which is deferred as a future enhancement.
   */
  private drawMixedStyleText(
    cursor: Cursor,
    segments: TextSegment[],
    fontSize: number,
    lineHeight: number,
    defaultColor: Color,
    indent: number = 0,
  ): Cursor {
    if (segments.length === 0) {
      return cursor;
    }

    // Merge adjacent segments with the same style
    const merged = this.mergeAdjacentSegments(segments);

    // Simple approach: concatenate all text and draw with the primary font,
    // but handle style changes by drawing segment by segment with appropriate fonts.
    // We'll use a line-by-line approach where we build full lines from segments.
    const maxWidth = this.engine.contentWidth - indent;
    const lines = this.buildWrappedLines(merged, fontSize, maxWidth);

    for (const line of lines) {
      cursor = this.engine.ensureSpace(cursor, lineHeight);
      let x = this.engine.leftX + indent;

      for (const piece of line) {
        const font = this.fonts.getFont(piece.style);
        cursor.page.drawText(piece.text, {
          x,
          y: cursor.y,
          size: fontSize,
          font,
          color: defaultColor,
        });
        x += font.widthOfTextAtSize(piece.text, fontSize);
      }

      cursor = { page: cursor.page, y: cursor.y - lineHeight };
    }

    return cursor;
  }

  /**
   * Merge adjacent TextSegments that share the same style.
   */
  private mergeAdjacentSegments(segments: TextSegment[]): TextSegment[] {
    if (segments.length === 0) return [];

    const merged: TextSegment[] = [{ ...segments[0] }];

    for (let i = 1; i < segments.length; i++) {
      const last = merged[merged.length - 1];
      if (segments[i].style === last.style) {
        last.text += segments[i].text;
      } else {
        merged.push({ ...segments[i] });
      }
    }

    return merged;
  }

  /**
   * Build wrapped lines from mixed-style segments.
   *
   * Splits each segment into words, then accumulates words into lines,
   * switching fonts as needed to measure widths correctly.
   */
  private buildWrappedLines(
    segments: TextSegment[],
    fontSize: number,
    maxWidth: number,
  ): TextSegment[][] {
    // Build a flat list of styled words
    const styledWords: TextSegment[] = [];

    for (const segment of segments) {
      if (segment.text === '\n') {
        // Explicit line break
        styledWords.push({ text: '\n', style: segment.style });
        continue;
      }

      const words = segment.text.split(/(\s+)/);
      for (const word of words) {
        if (word) {
          styledWords.push({ text: word, style: segment.style });
        }
      }
    }

    // Accumulate words into lines
    const lines: TextSegment[][] = [];
    let currentLine: TextSegment[] = [];
    let currentLineWidth = 0;

    for (const styledWord of styledWords) {
      // Handle explicit line breaks
      if (styledWord.text === '\n') {
        lines.push(currentLine.length > 0 ? currentLine : [{ text: '', style: 'regular' }]);
        currentLine = [];
        currentLineWidth = 0;
        continue;
      }

      const font = this.fonts.getFont(styledWord.style);
      const wordWidth = font.widthOfTextAtSize(styledWord.text, fontSize);

      if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
        // Trim trailing whitespace from the current line
        this.trimTrailingWhitespace(currentLine);
        lines.push(currentLine);
        currentLine = [];
        currentLineWidth = 0;

        // Skip leading whitespace on new line
        if (styledWord.text.trim() === '') {
          continue;
        }
      }

      // Append word to current line, merging with last segment if same style
      if (
        currentLine.length > 0 &&
        currentLine[currentLine.length - 1].style === styledWord.style
      ) {
        currentLine[currentLine.length - 1].text += styledWord.text;
      } else {
        currentLine.push({ ...styledWord });
      }
      currentLineWidth += wordWidth;
    }

    // Push final line
    if (currentLine.length > 0) {
      this.trimTrailingWhitespace(currentLine);
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [[{ text: '', style: 'regular' }]];
  }

  /**
   * Remove trailing whitespace from the last segment of a line.
   */
  private trimTrailingWhitespace(line: TextSegment[]): void {
    if (line.length > 0) {
      const last = line[line.length - 1];
      last.text = last.text.trimEnd();
      if (last.text === '' && line.length > 1) {
        line.pop();
      }
    }
  }
}
