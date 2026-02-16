import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectPreferredLanguage,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
} from './language-config';

describe('language-config', () => {
  describe('constants', () => {
    it('should have en-US as the default language', () => {
      expect(DEFAULT_LANGUAGE).toBe('en-US');
    });

    it('should derive language codes from SUPPORTED_LANGUAGES', () => {
      expect(SUPPORTED_LANGUAGE_CODES).toEqual(SUPPORTED_LANGUAGES.map(l => l.code));
    });

    it('should include en-US in supported languages', () => {
      expect(SUPPORTED_LANGUAGE_CODES).toContain('en-US');
    });

    it('should mark RTL languages', () => {
      const rtlLangs = SUPPORTED_LANGUAGES.filter(l => l.rtl);
      const rtlCodes = rtlLangs.map(l => l.code);
      expect(rtlCodes).toContain('ar-SA');
      expect(rtlCodes).toContain('he-IL');
      expect(rtlCodes).toContain('ur-PK');
    });
  });

  describe('detectPreferredLanguage', () => {
    let localStorageGetSpy: ReturnType<typeof vi.spyOn>;
    const originalNavigator = navigator.language;

    beforeEach(() => {
      localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      Object.defineProperty(navigator, 'language', {
        value: originalNavigator,
        configurable: true,
      });
    });

    it('should return URL lang param when valid', () => {
      const params = new URLSearchParams('?lang=fr-FR');
      expect(detectPreferredLanguage(params)).toBe('fr-FR');
    });

    it('should ignore invalid URL lang param', () => {
      const params = new URLSearchParams('?lang=invalid');
      expect(detectPreferredLanguage(params)).toBe('en-US');
    });

    it('should skip URL check when null is passed', () => {
      localStorageGetSpy.mockReturnValue('de-DE');
      expect(detectPreferredLanguage(null)).toBe('de-DE');
    });

    it('should return localStorage preference when valid', () => {
      localStorageGetSpy.mockReturnValue('ja-JP');
      expect(detectPreferredLanguage()).toBe('ja-JP');
    });

    it('should ignore invalid localStorage preference', () => {
      localStorageGetSpy.mockReturnValue('invalid-lang');
      expect(detectPreferredLanguage()).toBe('en-US');
    });

    it('should match exact browser language', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'es-ES',
        configurable: true,
      });
      expect(detectPreferredLanguage()).toBe('es-ES');
    });

    it('should match base language prefix', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'fr',
        configurable: true,
      });
      expect(detectPreferredLanguage()).toBe('fr-FR');
    });

    it('should match base language from regional variant', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'pt-PT',
        configurable: true,
      });
      // pt-PT is not in the list, but pt-BR is, so base match on "pt" should find pt-BR
      expect(detectPreferredLanguage()).toBe('pt-BR');
    });

    it('should fall back to en-US when nothing matches', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'xx-XX',
        configurable: true,
      });
      expect(detectPreferredLanguage()).toBe('en-US');
    });

    it('should prioritize URL param over localStorage', () => {
      localStorageGetSpy.mockReturnValue('ja-JP');
      const params = new URLSearchParams('?lang=ko-KR');
      expect(detectPreferredLanguage(params)).toBe('ko-KR');
    });

    it('should prioritize localStorage over browser language', () => {
      localStorageGetSpy.mockReturnValue('zh-CN');
      Object.defineProperty(navigator, 'language', {
        value: 'de-DE',
        configurable: true,
      });
      expect(detectPreferredLanguage()).toBe('zh-CN');
    });
  });
});
