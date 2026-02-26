import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { FontVariant } from './pdf-stylesheet';

/**
 * Configuration for a language-specific font family.
 */
export interface FontConfig {
  name: string;
  fontPath: string;
  italicFontPath?: string;
  fallbacks: string[];
  rtl?: boolean;
}

/** Logger interface matching the subset used by the font manager */
export interface FontManagerLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: unknown): void;
  debugComponent(component: string, message: string, context?: Record<string, unknown>): void;
}

/**
 * Default font configurations keyed by language code.
 * Includes support for Latin, CJK, Arabic, Hebrew, and Thai scripts.
 */
export const DEFAULT_FONT_CONFIGS: Map<string, FontConfig> = new Map([
  [
    'en-US',
    {
      name: 'NotoSans',
      fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
      italicFontPath: 'assets/fonts/ttf/NotoSans-Italic-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
    },
  ],
  [
    'de',
    {
      name: 'NotoSans',
      fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
      italicFontPath: 'assets/fonts/ttf/NotoSans-Italic-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
    },
  ],
  [
    'zh',
    {
      name: 'NotoSansSC',
      fontPath: 'assets/fonts/ttf/NotoSansSC-VariableFont_wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
    },
  ],
  [
    'ar',
    {
      name: 'NotoSansArabic',
      fontPath: 'assets/fonts/ttf/NotoSansArabic-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
      rtl: true,
    },
  ],
  [
    'th',
    {
      name: 'NotoSansThai',
      fontPath: 'assets/fonts/ttf/NotoSansThai-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
    },
  ],
  [
    'ja',
    {
      name: 'NotoSansJP',
      fontPath: 'assets/fonts/ttf/NotoSansJP-VariableFont_wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
    },
  ],
  [
    'ko',
    {
      name: 'NotoSansKR',
      fontPath: 'assets/fonts/ttf/NotoSansKR-VariableFont_wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
    },
  ],
  [
    'he',
    {
      name: 'NotoSansHebrew',
      fontPath: 'assets/fonts/ttf/NotoSansHebrew-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
      rtl: true,
    },
  ],
]);

/**
 * Manages font loading, embedding, and variant resolution for PDF generation.
 *
 * Provides 4 font variants:
 * - `regular`: Language-specific NotoSans variant
 * - `italic`: NotoSans Italic or HelveticaOblique fallback
 * - `bold`: HelveticaBold (Latin-only limitation; CJK/Arabic/Hebrew use regular weight)
 * - `monospace`: Courier (for code blocks)
 */
export class PdfFontManager {
  private fonts: Map<FontVariant, PDFFont> = new Map();
  private loadedFontData: Map<string, Uint8Array> = new Map();
  private fontConfigs: Map<string, FontConfig>;

  constructor(
    private doc: PDFDocument,
    private logger: FontManagerLogger,
    fontConfigs?: Map<string, FontConfig>,
  ) {
    this.fontConfigs = fontConfigs ?? DEFAULT_FONT_CONFIGS;
  }

  /**
   * Load and embed all required font variants for the given language.
   * Must be called before any getFont() calls.
   */
  async loadFonts(language: string): Promise<void> {
    const fontConfig = this.fontConfigs.get(language) || this.fontConfigs.get('en-US')!;

    this.logger.debugComponent('PdfFontManager', 'Loading fonts for language', {
      language,
      fontConfig: fontConfig.name,
    });

    // Load regular font
    await this.loadRegularFont(fontConfig);

    // Load italic font
    await this.loadItalicFont(fontConfig);

    // Load bold font (HelveticaBold — Latin only)
    await this.loadBoldFont();

    // Load monospace font (Courier — always available)
    await this.loadMonospaceFont();
  }

  /**
   * Get the embedded PDFFont for a specific variant.
   * Throws if fonts have not been loaded yet.
   */
  getFont(variant: FontVariant): PDFFont {
    const font = this.fonts.get(variant);
    if (!font) {
      throw new Error(`Font variant '${variant}' not loaded. Call loadFonts() before getFont().`);
    }
    return font;
  }

  /**
   * Check whether a specific font variant has been loaded.
   */
  hasFont(variant: FontVariant): boolean {
    return this.fonts.has(variant);
  }

  private async loadRegularFont(fontConfig: FontConfig): Promise<void> {
    try {
      const fontData = await this.fetchFont(fontConfig.fontPath);
      const font = await this.doc.embedFont(fontData);
      this.fonts.set('regular', font);
      this.logger.debugComponent('PdfFontManager', `Embedded regular font: ${fontConfig.name}`);
    } catch (error) {
      this.logger.warn('Failed to load custom regular font, using Helvetica fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      const font = await this.doc.embedFont(StandardFonts.Helvetica);
      this.fonts.set('regular', font);
    }
  }

  private async loadItalicFont(fontConfig: FontConfig): Promise<void> {
    if (fontConfig.italicFontPath) {
      try {
        const fontData = await this.fetchFont(fontConfig.italicFontPath);
        const font = await this.doc.embedFont(fontData);
        this.fonts.set('italic', font);
        this.logger.debugComponent(
          'PdfFontManager',
          `Embedded italic font: ${fontConfig.name}-Italic`,
        );
        return;
      } catch (error) {
        this.logger.warn('Failed to load italic font, using HelveticaOblique fallback', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const font = await this.doc.embedFont(StandardFonts.HelveticaOblique);
    this.fonts.set('italic', font);
  }

  private async loadBoldFont(): Promise<void> {
    try {
      const font = await this.doc.embedFont(StandardFonts.HelveticaBold);
      this.fonts.set('bold', font);
    } catch (error) {
      this.logger.warn('Failed to load bold font, using regular as fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall back to regular if bold fails (should not happen with standard fonts)
      const regular = this.fonts.get('regular');
      if (regular) {
        this.fonts.set('bold', regular);
      }
    }
  }

  private async loadMonospaceFont(): Promise<void> {
    try {
      const font = await this.doc.embedFont(StandardFonts.Courier);
      this.fonts.set('monospace', font);
    } catch (error) {
      this.logger.warn('Failed to load monospace font, using regular as fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      const regular = this.fonts.get('regular');
      if (regular) {
        this.fonts.set('monospace', regular);
      }
    }
  }

  /**
   * Fetch font data from a URL path, with caching.
   */
  private async fetchFont(fontPath: string): Promise<Uint8Array> {
    if (this.loadedFontData.has(fontPath)) {
      return this.loadedFontData.get(fontPath)!;
    }

    const response = await fetch(fontPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
    }

    const fontData = new Uint8Array(await response.arrayBuffer());
    this.loadedFontData.set(fontPath, fontData);
    return fontData;
  }
}
