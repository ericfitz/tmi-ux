import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PdfLayoutEngine, LayoutConfig } from './pdf-layout-engine';
import { PdfFontManager } from './pdf-font-manager';
import { PdfMarkdownRenderer } from './pdf-markdown-renderer';
import { lexer, Token } from 'marked';

describe('PdfMarkdownRenderer', () => {
  let doc: PDFDocument;
  let engine: PdfLayoutEngine;
  let fonts: PdfFontManager;
  let renderer: PdfMarkdownRenderer;

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
    await fonts.loadFonts('en-US');
    renderer = new PdfMarkdownRenderer(engine, fonts);
  });

  describe('flattenInlineTokens', () => {
    it('should handle plain text', () => {
      const tokens = lexer('Just plain text.');
      // First token is a paragraph with inline tokens
      const para = tokens[0] as { tokens: Token[] };
      const segments = renderer.flattenInlineTokens(para.tokens);

      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe('Just plain text.');
      expect(segments[0].style).toBe('regular');
    });

    it('should handle bold text', () => {
      const tokens = lexer('Some **bold** text.');
      const para = tokens[0] as { tokens: Token[] };
      const segments = renderer.flattenInlineTokens(para.tokens);

      expect(segments.length).toBeGreaterThanOrEqual(3);

      const boldSegment = segments.find(s => s.style === 'bold');
      expect(boldSegment).toBeDefined();
      expect(boldSegment!.text).toBe('bold');

      const textSegments = segments.filter(s => s.style === 'regular');
      expect(textSegments.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle italic text', () => {
      const tokens = lexer('Some *italic* text.');
      const para = tokens[0] as { tokens: Token[] };
      const segments = renderer.flattenInlineTokens(para.tokens);

      const italicSegment = segments.find(s => s.style === 'italic');
      expect(italicSegment).toBeDefined();
      expect(italicSegment!.text).toBe('italic');
    });

    it('should handle inline code', () => {
      const tokens = lexer('Use `console.log()` for debugging.');
      const para = tokens[0] as { tokens: Token[] };
      const segments = renderer.flattenInlineTokens(para.tokens);

      const codeSegment = segments.find(s => s.style === 'monospace');
      expect(codeSegment).toBeDefined();
      expect(codeSegment!.text).toBe('console.log()');
    });

    it('should handle links', () => {
      const tokens = lexer('Visit [Example](https://example.com) for more.');
      const para = tokens[0] as { tokens: Token[] };
      const segments = renderer.flattenInlineTokens(para.tokens);

      // Link should be rendered as "Example (https://example.com)"
      const linkSegment = segments.find(s => s.text.includes('example.com'));
      expect(linkSegment).toBeDefined();
    });

    it('should handle mixed inline styles', () => {
      const tokens = lexer('**Bold** then *italic* then `code`.');
      const para = tokens[0] as { tokens: Token[] };
      const segments = renderer.flattenInlineTokens(para.tokens);

      const styles = segments.map(s => s.style);
      expect(styles).toContain('bold');
      expect(styles).toContain('italic');
      expect(styles).toContain('monospace');
    });

    it('should return empty array for empty tokens', () => {
      const segments = renderer.flattenInlineTokens([]);
      expect(segments).toHaveLength(0);
    });
  });

  describe('render', () => {
    it('should handle empty string', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '');
      expect(result.y).toBe(cursor.y);
    });

    it('should handle whitespace-only string', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '   \n  \n  ');
      expect(result.y).toBe(cursor.y);
    });

    it('should render a heading', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '# Hello World');
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should render a paragraph', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, 'This is a simple paragraph.');
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should render a code block', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '```\nconst x = 1;\nconsole.log(x);\n```');
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should render an unordered list', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '- Item 1\n- Item 2\n- Item 3');
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should render an ordered list', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '1. First\n2. Second\n3. Third');
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should render a blockquote', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '> This is a blockquote');
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should render a horizontal rule', () => {
      const cursor = engine.newPage();
      const result = renderer.render(cursor, '---');
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('should render complex markdown with multiple elements', () => {
      const cursor = engine.newPage();
      const markdown = `# Security Overview

## Authentication

This system uses **OAuth 2.0** with JWT tokens.

### Key Controls

- Multi-factor authentication (MFA)
- Role-based access control (RBAC)
- Session timeout: 30 minutes

## Encryption

- **In Transit**: TLS 1.3
- **At Rest**: AES-256

> All connections must be encrypted.

\`\`\`
const config = {
  tls: true,
  version: '1.3'
};
\`\`\`
`;

      const result = renderer.render(cursor, markdown);
      expect(result.y).toBeLessThan(cursor.y);
      // Complex markdown should consume significant space
      expect(cursor.y - result.y).toBeGreaterThan(100);
    });

    it('should handle page breaks in long content', () => {
      const cursor = engine.newPage();
      // Generate enough content to force multiple pages
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`Line ${i}: This is a paragraph that provides some content for testing.`);
        lines.push('');
      }
      const longMarkdown = lines.join('\n');

      renderer.render(cursor, longMarkdown);
      expect(doc.getPageCount()).toBeGreaterThan(1);
    });
  });
});
