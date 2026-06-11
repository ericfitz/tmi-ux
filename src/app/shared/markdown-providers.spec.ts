// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest syntax anywhere in the project.

import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { SANITIZE } from 'ngx-markdown';
import {
  MARKDOWN_DOMPURIFY_CONFIG,
  provideMarkdownConfig,
  sanitizeMarkdownHtml,
} from './markdown-providers';

describe('MARKDOWN_DOMPURIFY_CONFIG', () => {
  it('strips a javascript: href from an anchor (no executable scheme survives)', () => {
    const dirty = '<a href="javascript:alert(1)">x</a>';
    const clean = DOMPurify.sanitize(dirty, MARKDOWN_DOMPURIFY_CONFIG);
    expect(clean).not.toContain('javascript:');
  });

  it('strips mixed-case JaVaScRiPt: and whitespace-smuggled schemes', () => {
    for (const href of ['JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', ' javascript:alert(1)']) {
      const clean = DOMPurify.sanitize(`<a href="${href}">x</a>`, MARKDOWN_DOMPURIFY_CONFIG);
      expect(clean.toLowerCase()).not.toContain('javascript:');
    }
  });

  it('drops event-handler attributes like onmouseover (attribute breakout)', () => {
    // Simulates the unescaped-quote breakout: href closes early, onmouseover injected.
    const dirty = '<a href="https://example.com" onmouseover="alert(1)">x</a>';
    const clean = DOMPurify.sanitize(dirty, MARKDOWN_DOMPURIFY_CONFIG);
    expect(clean).not.toContain('onmouseover');
  });

  it('preserves a legitimate external link with target/rel', () => {
    const dirty = '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>';
    const clean = DOMPurify.sanitize(dirty, MARKDOWN_DOMPURIFY_CONFIG);
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });
});

describe('sanitizeMarkdownHtml', () => {
  // These tests guard against a future renderer that forgets to call DOMPurify — the
  // SANITIZE function is the enforced CI chokepoint for all ngx-markdown parsed output.

  it('strips <script> elements from raw HTML', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script><p>World</p>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert(1)');
    expect(clean).toContain('<p>Hello</p>');
    expect(clean).toContain('<p>World</p>');
  });

  it('strips javascript: hrefs from raw HTML', () => {
    const dirty = '<a href="javascript:alert(1)">click me</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain('javascript:');
  });

  it('strips event-handler attributes (onerror, onmouseover) from raw HTML', () => {
    const dirty = '<img src="x" onerror="alert(1)"><a href="#" onmouseover="evil()">x</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onmouseover');
    expect(clean).not.toContain('evil()');
  });

  it('preserves heading with id attribute (heading anchor IDs must survive)', () => {
    const dirty = '<h2 id="section-one">Section One</h2>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('id="section-one"');
    expect(clean).toContain('<h2');
    expect(clean).toContain('Section One');
  });

  it('preserves GFM task-list <input type="checkbox" disabled checked>', () => {
    const dirty = '<li><input type="checkbox" disabled checked> Done</li>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('<input');
    expect(clean).toContain('type="checkbox"');
    expect(clean).toContain('disabled');
    expect(clean).toContain('checked');
  });

  it('preserves external link with target="_blank" rel="noopener noreferrer"', () => {
    const dirty =
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('preserves <img src="data:..."> (data: URIs on images allowed via DOMPurify DATA_URI_TAGS)', () => {
    // DOMPurify's built-in DATA_URI_TAGS allows data: on img/audio/video/source/track
    // regardless of ALLOWED_URI_REGEXP, so removing data: from the regexp does not
    // break inline images.
    const dataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
    const dirty = `<img src="${dataUri}" alt="pixel">`;
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).toContain('data:image/png;base64,');
  });

  it('strips data: from <a href> (data: anchors are not permitted)', () => {
    // data: URI on <a href> is a phishing/XSS vector and is not in DATA_URI_TAGS,
    // so it is blocked by the ALLOWED_URI_REGEXP which no longer includes "data".
    const dirty = '<a href="data:text/html,<script>alert(1)</script>">x</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    // DOMPurify should strip the href entirely when the scheme is disallowed
    expect(clean).not.toContain('data:text/html');
  });
});

describe('provideMarkdownConfig — wiring', () => {
  // This test prevents regression back to SecurityContext.NONE.
  // It asserts that provideMarkdown was called with the sanitizeMarkdownHtml function
  // as the SANITIZE provider value.
  it('includes a provider with provide === SANITIZE and useValue === sanitizeMarkdownHtml', () => {
    const config = provideMarkdownConfig();

    /**
     * Recursively flattens arrays and collects plain objects that have a `provide`
     * property (i.e., Angular provider literals). provideMarkdown returns a plain
     * Provider[] whose only non-literal entry is the MarkdownService class constructor
     * (skipped because typeof === 'function') — we only inspect the literal providers
     * we control.
     */
    function collectProviders(value: unknown): Record<string, unknown>[] {
      if (Array.isArray(value)) {
        return value.flatMap(collectProviders);
      }
      if (value !== null && typeof value === 'object' && 'provide' in value) {
        return [value];
      }
      return [];
    }

    const providers = collectProviders(config);
    const sanitizeProvider = providers.find(p => p['provide'] === SANITIZE);
    expect(
      sanitizeProvider,
      'SANITIZE provider not found in provideMarkdownConfig() result',
    ).toBeTruthy();
    expect(sanitizeProvider!['useValue']).toBe(sanitizeMarkdownHtml);
  });
});
