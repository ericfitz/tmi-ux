// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest syntax anywhere in the project.

import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { MARKDOWN_DOMPURIFY_CONFIG } from './markdown-providers';

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
    const dirty =
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>';
    const clean = DOMPurify.sanitize(dirty, MARKDOWN_DOMPURIFY_CONFIG);
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });
});
