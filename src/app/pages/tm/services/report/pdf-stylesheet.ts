import { rgb, Color } from 'pdf-lib';

/**
 * Named text style definition used by the layout engine and renderers.
 */
export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  color: Color;
  fontVariant: FontVariant;
  spaceBefore: number;
  spaceAfter: number;
}

export type FontVariant = 'regular' | 'bold' | 'italic' | 'monospace';

/**
 * Centralized style definitions for the PDF report.
 * All visual constants are defined here so the report appearance
 * can be adjusted from a single location.
 */
export const REPORT_STYLES = {
  // Title page
  title: {
    fontSize: 24,
    lineHeight: 30,
    color: rgb(0, 0, 0),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 10,
  },
  confidentiality: {
    fontSize: 14,
    lineHeight: 20,
    color: rgb(0.3, 0.3, 0.3),
    fontVariant: 'italic' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 10,
  },
  classification: {
    fontSize: 12,
    lineHeight: 17,
    color: rgb(0.4, 0.4, 0.4),
    fontVariant: 'regular' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 10,
  },

  // Section headings (Inputs / Outputs)
  sectionHeading: {
    fontSize: 18,
    lineHeight: 25,
    color: rgb(0, 0, 0),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 20,
    spaceAfter: 10,
  },
  // Sub-section headings (Assets, Documents, Threats, etc.)
  subSectionHeading: {
    fontSize: 14,
    lineHeight: 20,
    color: rgb(0.1, 0.1, 0.1),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 15,
    spaceAfter: 8,
  },
  // Card title (individual threat or note name)
  cardTitle: {
    fontSize: 12,
    lineHeight: 17,
    color: rgb(0, 0, 0),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 12,
    spaceAfter: 4,
  },

  // Body text
  body: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0.15, 0.15, 0.15),
    fontVariant: 'regular' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 4,
  },
  bodyBold: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0.15, 0.15, 0.15),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 4,
  },
  bodyItalic: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0.15, 0.15, 0.15),
    fontVariant: 'italic' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 4,
  },

  // Key-value pair styles (threat cards, summary, detail rows)
  label: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0.3, 0.3, 0.3),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 2,
  },
  value: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0.15, 0.15, 0.15),
    fontVariant: 'regular' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 2,
  },

  // Table styles
  tableHeader: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0, 0, 0),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 0,
  },
  tableCell: {
    fontSize: 9,
    lineHeight: 13,
    color: rgb(0.2, 0.2, 0.2),
    fontVariant: 'regular' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 0,
  },

  // Markdown element styles
  mdH1: {
    fontSize: 14,
    lineHeight: 20,
    color: rgb(0, 0, 0),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 12,
    spaceAfter: 6,
  },
  mdH2: {
    fontSize: 12,
    lineHeight: 17,
    color: rgb(0.1, 0.1, 0.1),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 10,
    spaceAfter: 4,
  },
  mdH3: {
    fontSize: 11,
    lineHeight: 16,
    color: rgb(0.15, 0.15, 0.15),
    fontVariant: 'bold' as FontVariant,
    spaceBefore: 8,
    spaceAfter: 4,
  },
  mdCode: {
    fontSize: 9,
    lineHeight: 13,
    color: rgb(0.2, 0.2, 0.2),
    fontVariant: 'monospace' as FontVariant,
    spaceBefore: 6,
    spaceAfter: 6,
  },
  mdBlockquote: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0.3, 0.3, 0.3),
    fontVariant: 'italic' as FontVariant,
    spaceBefore: 6,
    spaceAfter: 6,
  },

  // Footer
  footer: {
    fontSize: 8,
    lineHeight: 11,
    color: rgb(0.4, 0.4, 0.4),
    fontVariant: 'regular' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 0,
  },

  // Placeholder / empty state
  noData: {
    fontSize: 10,
    lineHeight: 14,
    color: rgb(0.5, 0.5, 0.5),
    fontVariant: 'italic' as FontVariant,
    spaceBefore: 0,
    spaceAfter: 4,
  },
} as const satisfies Record<string, TextStyle>;

export type StyleName = keyof typeof REPORT_STYLES;

/**
 * Table column proportions (must sum to 1.0 per entity type).
 * These are fractions of the printable content width.
 */
export const TABLE_PROPORTIONS = {
  // Assets compact table: Name, Type, Criticality
  assets: [0.4, 0.3, 0.3],
  // Documents standard table: Name, URI, Description
  documents: [0.25, 0.4, 0.35],
  // Repositories compact table: Name, Type, URI
  repositories: [0.25, 0.15, 0.6],
} as const;

/**
 * Minimum height (in points) required below a heading to prevent orphaning.
 * Ensures at least the heading + ~2 body text lines stay together.
 */
export const MIN_ORPHAN_HEIGHT = 60;

/**
 * Colors used for structural elements (separators, table lines).
 */
export const STRUCTURAL_COLORS = {
  tableLine: rgb(0.8, 0.8, 0.8),
  cardSeparator: rgb(0.85, 0.85, 0.85),
  detailSeparator: rgb(0.9, 0.9, 0.9),
} as const;

/**
 * Indentation and spacing constants.
 */
export const SPACING = {
  /** Indent for detail rows below compact table entries */
  detailIndent: 15,
  /** Indent for list items in markdown */
  listIndent: 15,
  /** Indent for blockquotes in markdown */
  blockquoteIndent: 20,
  /** Padding between table cells */
  tableCellPadding: 5,
  /** Space reserved for the footer area */
  footerReservedHeight: 20,
} as const;
