/**
 * Lazy-loaded Markdown Provider Configuration
 *
 * This file contains all markdown, mermaid, prism, and DOMPurify configuration
 * that was previously in app.config.ts and main.ts. By isolating these heavy
 * dependencies here, they are only loaded when a route that needs markdown
 * rendering is activated (tm and triage routes).
 */

import { SecurityContext, Provider, EnvironmentProviders } from '@angular/core';
import {
  provideMarkdown,
  MARKED_OPTIONS,
  MERMAID_OPTIONS,
  SANITIZE,
  MarkedRenderer,
  MarkedOptions,
} from 'ngx-markdown';
import mermaid from 'mermaid';
import type { MermaidConfig } from 'mermaid';
import DOMPurify from 'dompurify';

// Import Prism for syntax highlighting in markdown code blocks
import 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';

// Marked configuration with security and syntax highlighting
function markedOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();

  // Override the renderer's heading method to add IDs
  renderer.heading = function (args): string {
    const text = this.parser.parseInline(args.tokens);
    const level = args.depth;
    // Generate ID from heading text (lowercase, replace spaces with hyphens)
    // Use DOMPurify to strip HTML tags to avoid incomplete multi-character sanitization
    // vulnerability (text is already rendered HTML at this point from parseInline)
    const id = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();

    return `<h${level} id="${id}">${text}</h${level}>`;
  };

  // Override the renderer's link method to open external links in new tab
  renderer.link = function (token): string {
    const href = token.href;
    const title = token.title;
    const text = this.parser.parseInline(token.tokens);

    // Check if this is an external link (starts with http:// or https://)
    const isExternal = href && /^https?:\/\//i.test(href);

    // Build the anchor tag with proper attributes
    let html = '<a href="' + href + '"';
    if (title) {
      html += ' title="' + title + '"';
    }
    if (isExternal) {
      html += ' target="_blank" rel="noopener noreferrer"';
    }
    html += '>' + text + '</a>';

    return html;
  };

  // Override the renderer's html method to sanitize output
  const originalHtml = renderer.html.bind(renderer);
  renderer.html = (args): string => {
    const html = originalHtml(args);
    return DOMPurify.sanitize(html, {
      // Allow all standard markdown HTML elements
      ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'strong',
        'em',
        'del',
        'a',
        'img',
        'code',
        'pre',
        'ul',
        'ol',
        'li',
        'blockquote',
        'table',
        'colgroup',
        'col',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'hr',
        'input',
        'span',
        'div',
        'svg',
        'path',
        'g',
        'rect',
        'circle',
        'line',
        'polygon',
        'text',
        'tspan',
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'type',
        'checked',
        'disabled',
        'data-line',
        'data-sourcepos',
        'style',
        'viewBox',
        'xmlns',
        'width',
        'height',
        'fill',
        'stroke',
        'stroke-width',
        'd',
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'points',
        'transform',
        'target',
        'rel',
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
    });
  };

  return {
    renderer,
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
    pedantic: false,
  };
}

// Mermaid configuration
function mermaidOptionsFactory(): MermaidConfig {
  const config: MermaidConfig = {
    theme: 'default',
    startOnLoad: false,
    securityLevel: 'strict', // Prevent XSS in mermaid diagrams
    maxTextSize: 50000,
  };

  // Expose mermaid globally for ngx-markdown (it checks for window.mermaid)
  if (typeof window !== 'undefined') {
    (window as unknown as { mermaid: typeof mermaid }).mermaid = mermaid;
  }

  // Initialize mermaid with the config
  mermaid.initialize(config);

  return config;
}

/**
 * Provides markdown rendering configuration for routes that need it.
 * Include this in the `providers` array of a parent route to make
 * markdown rendering available to all child routes.
 */
export function provideMarkdownConfig(): (Provider | EnvironmentProviders)[] {
  return [
    provideMarkdown({
      sanitize: { provide: SANITIZE, useValue: SecurityContext.NONE }, // We handle sanitization via DOMPurify in the renderer
    }),
    {
      provide: MARKED_OPTIONS,
      useFactory: markedOptionsFactory,
    },
    {
      provide: MERMAID_OPTIONS,
      useFactory: mermaidOptionsFactory,
    },
  ];
}
