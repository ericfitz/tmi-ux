// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.
//
// These tests build a real SectionRenderContext (real PDFDocument, layout
// engine, font manager, and renderers) and assert observable behavior:
// cursor advancement, page creation, and the include_in_report filtering /
// empty-section omission rules. Transloco is the only mocked dependency.

import '@angular/compiler';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { TranslocoService } from '@jsverse/transloco';

import { PdfLayoutEngine, LayoutConfig, Cursor } from './pdf-layout-engine';
import { PdfFontManager } from './pdf-font-manager';
import { PdfTableRenderer } from './pdf-table-renderer';
import { PdfMarkdownRenderer } from './pdf-markdown-renderer';
import {
  SectionRenderContext,
  renderSummarySection,
  renderInputsGroup,
  renderOutputsGroup,
  addPageFooters,
} from './pdf-section-renderers';
import type {
  ThreatModel,
  Asset,
  Document,
  Repository,
  Note,
  Threat,
} from '../../models/threat-model.model';

const config: LayoutConfig = {
  pageWidth: 612,
  pageHeight: 792,
  margin: 54,
  footerReservedHeight: 20,
};

const mockLogger = {
  // SEM@2642c33b79db7cce0d4e58508ffe94f2a946e4e2: no-op logger info stub for test isolation (pure)
  info: () => undefined,
  // SEM@2642c33b79db7cce0d4e58508ffe94f2a946e4e2: no-op logger warn stub for test isolation (pure)
  warn: () => undefined,
  // SEM@2642c33b79db7cce0d4e58508ffe94f2a946e4e2: no-op logger error stub for test isolation (pure)
  error: () => undefined,
  // SEM@2642c33b79db7cce0d4e58508ffe94f2a946e4e2: no-op logger debugComponent stub for test isolation (pure)
  debugComponent: () => undefined,
};

/**
 * A minimal TranslocoService stub. translate() is a spy that echoes the key
 * (with the params object appended when present) so assertions can inspect
 * both the output and the call record; getActiveLang() returns a fixed locale.
 */
// SEM@2642c33b79db7cce0d4e58508ffe94f2a946e4e2: build a TranslocoService test double that echoes translation keys (pure)
function createMockTransloco(): TranslocoService {
  return {
    translate: vi.fn((key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    ),
    getActiveLang: () => 'en-US',
    getAvailableLangs: () => ['en-US'],
    // getFieldLabel -> migrateFieldValue reads translations to migrate legacy
    // values; an empty map means "no match", so the raw value is used as-is.
    getTranslation: () => ({}),
  } as unknown as TranslocoService;
}

/** Build a threat model with only the fields the renderers read. */
// SEM@2642c33b79db7cce0d4e58508ffe94f2a946e4e2: build a minimal threat model fixture with optional field overrides (pure)
function makeThreatModel(overrides: Partial<ThreatModel> = {}): ThreatModel {
  return {
    id: 'tm-1',
    name: 'Test Model',
    description: 'A description',
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-02-01T00:00:00Z',
    threat_model_framework: 'STRIDE',
    ...overrides,
  } as ThreatModel;
}

describe('pdf-section-renderers', () => {
  let doc: PDFDocument;
  let engine: PdfLayoutEngine;
  let fonts: PdfFontManager;
  let ctx: SectionRenderContext;
  let cursor: Cursor;

  beforeEach(async () => {
    // PdfFontManager.loadFonts() fetches NotoSans TTFs and falls back to the
    // standard Helvetica font on failure. Stub fetch so the fallback path is
    // taken deterministically without a dangling network task.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('fetch disabled in tests'))),
    );

    doc = await PDFDocument.create();
    engine = new PdfLayoutEngine(doc, config);
    fonts = new PdfFontManager(doc, mockLogger);
    await fonts.loadFonts('en-US');

    ctx = {
      engine,
      fonts,
      transloco: createMockTransloco(),
      tableRenderer: new PdfTableRenderer(engine, fonts),
      markdownRenderer: new PdfMarkdownRenderer(engine, fonts),
      doc,
    };

    cursor = engine.newPage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // renderSummarySection
  // -------------------------------------------------------------------------
  describe('renderSummarySection', () => {
    it('advances the cursor down the page', () => {
      const result = renderSummarySection(ctx, cursor, makeThreatModel());

      expect(result.y).toBeLessThan(cursor.y);
      expect(result.page).toBe(cursor.page);
    });

    it('still renders the fixed fields when optional fields are absent', () => {
      const sparse = makeThreatModel({
        description: undefined,
        created_by: undefined,
        security_reviewer: undefined,
        status: undefined,
      });

      // The summary always draws the fixed key-value pairs (generated-at,
      // created-at, etc.) and the description label, so the cursor advances
      // even when every optional value falls back to "no data".
      const result = renderSummarySection(ctx, cursor, sparse);

      expect(result.y).toBeLessThan(cursor.y);
    });

    it('renders created_by and security_reviewer when present', () => {
      const principal = {
        principal_type: 'user' as const,
        provider: 'google',
        provider_id: 'u@example.com',
        display_name: 'Test User',
      };
      const tm = makeThreatModel({
        created_by: principal,
        security_reviewer: principal,
        status: 'draft',
      });

      const result = renderSummarySection(ctx, cursor, tm);

      expect(result.y).toBeLessThan(cursor.y);
    });
  });

  // -------------------------------------------------------------------------
  // renderInputsGroup — filters on include_in_report, omits empty group
  // -------------------------------------------------------------------------
  describe('renderInputsGroup', () => {
    const asset: Asset = {
      id: 'a1',
      name: 'Customer DB',
      type: 'data',
      criticality: 'high',
      classification: ['PII'],
      sensitivity: 'confidential',
      description: 'Primary data store',
      include_in_report: true,
      created_at: '2024-01-01',
      modified_at: '2024-01-01',
    };
    const doc1: Document = {
      id: 'd1',
      name: 'Spec',
      uri: 'https://example.com/spec',
      description: 'Design spec',
      include_in_report: true,
      created_at: '2024-01-01',
      modified_at: '2024-01-01',
    };
    const repo: Repository = {
      id: 'r1',
      name: 'app-repo',
      type: 'git',
      uri: 'https://github.com/example/app',
      description: 'Application source',
      parameters: { refType: 'branch', refValue: 'main', subPath: 'src' },
      include_in_report: true,
      created_at: '2024-01-01',
      modified_at: '2024-01-01',
    };

    it('returns the cursor unchanged when there are no inputs at all', () => {
      const result = renderInputsGroup(ctx, cursor, makeThreatModel());

      expect(result).toBe(cursor);
    });

    it('returns the cursor unchanged when no input has include_in_report set', () => {
      const tm = makeThreatModel({
        assets: [{ ...asset, include_in_report: false }],
        documents: [{ ...doc1, include_in_report: false }],
        repositories: [{ ...repo, include_in_report: undefined }],
      });

      const result = renderInputsGroup(ctx, cursor, tm);

      expect(result).toBe(cursor);
    });

    it('renders the group and advances the cursor when an asset is included', () => {
      const tm = makeThreatModel({ assets: [asset] });

      const result = renderInputsGroup(ctx, cursor, tm);

      expect(result.y).toBeLessThan(cursor.y);
    });

    it('renders documents and repositories when included', () => {
      const tm = makeThreatModel({ documents: [doc1], repositories: [repo] });

      const result = renderInputsGroup(ctx, cursor, tm);

      expect(result.y).toBeLessThan(cursor.y);
    });

    it('renders only the included subset when inputs are mixed', () => {
      const tm = makeThreatModel({
        assets: [asset, { ...asset, id: 'a2', name: 'Excluded', include_in_report: false }],
        documents: [{ ...doc1, include_in_report: false }],
      });

      const result = renderInputsGroup(ctx, cursor, tm);

      // The included asset still advances the cursor; the excluded document
      // contributes nothing.
      expect(result.y).toBeLessThan(cursor.y);
    });

    it('renders an asset that has no detail fields without throwing', () => {
      const bare: Asset = {
        id: 'a3',
        name: 'Bare Asset',
        type: 'service',
        include_in_report: true,
        created_at: '2024-01-01',
        modified_at: '2024-01-01',
      };
      const tm = makeThreatModel({ assets: [bare] });

      expect(() => renderInputsGroup(ctx, cursor, tm)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // renderOutputsGroup — async; filters on include_in_report
  // -------------------------------------------------------------------------
  describe('renderOutputsGroup', () => {
    const threat: Threat = {
      id: 't1',
      threat_model_id: 'tm-1',
      name: 'SQL Injection',
      description: 'Untrusted input reaches the query',
      severity: 'high',
      score: 8.1,
      status: 'open',
      priority: 'high',
      threat_type: ['Tampering'],
      mitigation: 'Use parameterized queries',
      cwe_id: ['CWE-89'],
      cvss: [{ vector: 'AV:N/AC:L', score: 8.1 }],
      include_in_report: true,
      created_at: '2024-01-01',
      modified_at: '2024-01-01',
    };
    const note: Note = {
      id: 'n1',
      name: 'Review Notes',
      content: '# Heading\n\nSome **markdown** content.',
      include_in_report: true,
      created_at: '2024-01-01',
      modified_at: '2024-01-01',
    };

    it('returns the cursor unchanged when there are no outputs', async () => {
      const result = await renderOutputsGroup(ctx, cursor, makeThreatModel());

      expect(result).toBe(cursor);
    });

    it('returns the cursor unchanged when no output has include_in_report set', async () => {
      const tm = makeThreatModel({
        threats: [{ ...threat, include_in_report: false }],
        notes: [{ ...note, include_in_report: false }],
      });

      const result = await renderOutputsGroup(ctx, cursor, tm);

      expect(result).toBe(cursor);
    });

    it('renders threats and advances the cursor', async () => {
      const tm = makeThreatModel({ threats: [threat] });

      const result = await renderOutputsGroup(ctx, cursor, tm);

      expect(result.y).toBeLessThan(cursor.y);
    });

    it('renders notes with markdown content', async () => {
      const tm = makeThreatModel({ notes: [note] });

      const result = await renderOutputsGroup(ctx, cursor, tm);

      expect(result.y).toBeLessThan(cursor.y);
    });

    it('resolves linked asset and diagram names on a threat', async () => {
      const tm = makeThreatModel({
        assets: [
          {
            id: 'a1',
            name: 'Linked Asset',
            type: 'data',
            include_in_report: false,
            created_at: '2024-01-01',
            modified_at: '2024-01-01',
          },
        ],
        diagrams: [{ id: 'dg1', name: 'Linked Diagram' } as ThreatModel['diagrams'][number]],
        threats: [{ ...threat, asset_id: 'a1', diagram_id: 'dg1', issue_uri: 'https://x/issue/1' }],
      });

      const result = await renderOutputsGroup(ctx, cursor, tm);

      expect(result.y).toBeLessThan(cursor.y);
    });

    it('renders a diagram section with no image (image unavailable path)', async () => {
      const tm = makeThreatModel({
        diagrams: [
          {
            id: 'dg1',
            name: 'Empty Diagram',
            include_in_report: true,
          } as ThreatModel['diagrams'][number],
        ],
      });

      const result = await renderOutputsGroup(ctx, cursor, tm);

      // A diagram without an image still renders its name + "unavailable"
      // note, advancing the cursor down the page.
      expect(result.y).toBeLessThan(cursor.y);
    });
  });

  // -------------------------------------------------------------------------
  // addPageFooters
  // -------------------------------------------------------------------------
  describe('addPageFooters', () => {
    it('draws a page-number footer on every page', () => {
      engine.newPage();
      engine.newPage();
      expect(doc.getPageCount()).toBe(3);

      addPageFooters(
        doc,
        fonts,
        { pageWidth: config.pageWidth, margin: config.margin },
        null,
        ctx.transloco,
      );

      // The page-number footer is drawn once per page via
      // transloco.translate('report.pageOf', { current, total }).
      const translate = vi.mocked(ctx.transloco.translate);
      const pageOfCalls = translate.mock.calls.filter(([key]) => key === 'report.pageOf');
      expect(pageOfCalls).toHaveLength(3);
      expect(pageOfCalls[0][1]).toEqual({ current: 1, total: 3 });
      expect(pageOfCalls[2][1]).toEqual({ current: 3, total: 3 });
    });

    it('draws the page-number footer once when there is a single page', () => {
      expect(doc.getPageCount()).toBe(1);

      addPageFooters(
        doc,
        fonts,
        { pageWidth: config.pageWidth, margin: config.margin },
        'CONFIDENTIAL',
        ctx.transloco,
      );

      const translate = vi.mocked(ctx.transloco.translate);
      const pageOfCalls = translate.mock.calls.filter(([key]) => key === 'report.pageOf');
      expect(pageOfCalls).toHaveLength(1);
      expect(pageOfCalls[0][1]).toEqual({ current: 1, total: 1 });
    });

    it('renders the classification text when provided without throwing', () => {
      // Classification is drawn directly (not via translate); assert the call
      // completes — a rendering regression would throw on the pdf-lib draw.
      expect(() =>
        addPageFooters(
          doc,
          fonts,
          { pageWidth: config.pageWidth, margin: config.margin },
          'CONFIDENTIAL',
          ctx.transloco,
        ),
      ).not.toThrow();
    });

    it('omits the classification line when classification is null', () => {
      expect(() =>
        addPageFooters(
          doc,
          fonts,
          { pageWidth: config.pageWidth, margin: config.margin },
          null,
          ctx.transloco,
        ),
      ).not.toThrow();
    });
  });
});
