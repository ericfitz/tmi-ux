/**
 * Shared language configuration and detection logic.
 * Single source of truth for supported languages and language detection.
 */

export interface Language {
  code: string;
  name: string;
  localName: string;
  rtl?: boolean;
}

/** Canonical list of supported languages */
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English', localName: 'English' },
  { code: 'ar-SA', name: 'Arabic', localName: 'العربية', rtl: true },
  { code: 'bn-BD', name: 'Bengali', localName: 'বাংলা' },
  { code: 'de-DE', name: 'German', localName: 'Deutsch' },
  { code: 'es-ES', name: 'Spanish', localName: 'Español' },
  { code: 'fr-FR', name: 'French', localName: 'Français' },
  { code: 'he-IL', name: 'Hebrew', localName: 'עברית', rtl: true },
  { code: 'hi-IN', name: 'Hindi', localName: 'हिन्दी' },
  { code: 'id-ID', name: 'Indonesian', localName: 'Bahasa Indonesia' },
  { code: 'ja-JP', name: 'Japanese', localName: '日本語' },
  { code: 'ko-KR', name: 'Korean', localName: '한국어' },
  { code: 'pt-BR', name: 'Portuguese', localName: 'Português' },
  { code: 'ru-RU', name: 'Russian', localName: 'Русский' },
  { code: 'th-TH', name: 'Thai', localName: 'ไทย' },
  { code: 'ur-PK', name: 'Urdu', localName: 'اردو', rtl: true },
  { code: 'zh-CN', name: 'Chinese', localName: '中文' },
];

/** Language codes derived from the canonical list */
export const SUPPORTED_LANGUAGE_CODES: string[] = SUPPORTED_LANGUAGES.map(lang => lang.code);

/** Default language code */
export const DEFAULT_LANGUAGE = 'en-US';

/**
 * Detect the preferred language based on available signals.
 *
 * Priority order:
 * 1. URL query parameter (`?lang=xx-XX`)
 * 2. localStorage preference
 * 3. Browser navigator.language (exact match, then base-language prefix match)
 * 4. Default (en-US)
 *
 * @param urlSearchParams Optional URL search params (pass `null` to skip URL detection)
 * @returns A supported language code
 */
export function detectPreferredLanguage(urlSearchParams?: URLSearchParams | null): string {
  // 1. Check URL query parameter
  if (urlSearchParams) {
    const langParam = urlSearchParams.get('lang');
    if (langParam && SUPPORTED_LANGUAGE_CODES.includes(langParam)) {
      return langParam;
    }
  }

  // 2. Check localStorage
  try {
    const storedLang = localStorage.getItem('preferredLanguage');
    if (storedLang && SUPPORTED_LANGUAGE_CODES.includes(storedLang)) {
      return storedLang;
    }
  } catch {
    // localStorage may be unavailable (e.g., in some test environments)
  }

  // 3. Check browser language
  try {
    const browserLang = navigator.language;
    if (browserLang) {
      if (SUPPORTED_LANGUAGE_CODES.includes(browserLang)) {
        return browserLang;
      }

      const baseLang = browserLang.split('-')[0];
      const baseMatch = SUPPORTED_LANGUAGES.find(lang => lang.code.startsWith(baseLang));
      if (baseMatch) {
        return baseMatch.code;
      }
    }
  } catch {
    // navigator may be unavailable in some environments
  }

  // 4. Default
  return DEFAULT_LANGUAGE;
}
