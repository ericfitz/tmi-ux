/**
 * Unit tests for TranslocoHttpLoader
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/i18n/transloco-loader.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, lastValueFrom, throwError } from 'rxjs';
import { TranslocoHttpLoader } from './transloco-loader.service';

describe('TranslocoHttpLoader', () => {
  let loader: TranslocoHttpLoader;
  let mockHttp: {
    get: ReturnType<typeof vi.fn>;
  };

  const mockEnglishTranslations = {
    'app.title': 'Threat Modeling Tool',
    'app.welcome': 'Welcome',
    'nav.home': 'Home',
  };

  const mockGermanTranslations = {
    'app.title': 'Bedrohungsmodellierungstool',
    'app.welcome': 'Willkommen',
    'nav.home': 'Startseite',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockHttp = {
      get: vi.fn(),
    };

    loader = new TranslocoHttpLoader(mockHttp as any);
  });

  describe('Service Initialization', () => {
    it('should create the loader', () => {
      expect(loader).toBeDefined();
    });
  });

  describe('getTranslation()', () => {
    it('should load English translations', async () => {
      mockHttp.get.mockReturnValue(of(mockEnglishTranslations));

      const translations = await lastValueFrom(loader.getTranslation('en-US'));

      expect(mockHttp.get).toHaveBeenCalledWith('/assets/i18n/en-US.json');
      expect(translations).toEqual(mockEnglishTranslations);
    });

    it('should load German translations', async () => {
      mockHttp.get.mockReturnValue(of(mockGermanTranslations));

      const translations = await lastValueFrom(loader.getTranslation('de'));

      expect(mockHttp.get).toHaveBeenCalledWith('/assets/i18n/de.json');
      expect(translations).toEqual(mockGermanTranslations);
    });

    it('should load Chinese translations', async () => {
      mockHttp.get.mockReturnValue(of({ 'app.title': '威胁建模工具' }));

      await lastValueFrom(loader.getTranslation('zh'));

      expect(mockHttp.get).toHaveBeenCalledWith('/assets/i18n/zh.json');
    });

    it('should load Arabic translations', async () => {
      mockHttp.get.mockReturnValue(of({ 'app.title': 'أداة نمذجة التهديدات' }));

      await lastValueFrom(loader.getTranslation('ar'));

      expect(mockHttp.get).toHaveBeenCalledWith('/assets/i18n/ar.json');
    });

    it('should load Thai translations', async () => {
      mockHttp.get.mockReturnValue(of({ 'app.title': 'เครื่องมือสร้างแบบจำลองภัยคุกคาม' }));

      await lastValueFrom(loader.getTranslation('th'));

      expect(mockHttp.get).toHaveBeenCalledWith('/assets/i18n/th.json');
    });

    it('should handle HTTP errors', async () => {
      mockHttp.get.mockReturnValue(throwError(() => new Error('File not found')));

      await expect(lastValueFrom(loader.getTranslation('invalid'))).rejects.toThrow(
        'File not found',
      );
    });

    it('should handle network errors', async () => {
      mockHttp.get.mockReturnValue(throwError(() => new Error('Network error: Failed to fetch')));

      await expect(lastValueFrom(loader.getTranslation('en-US'))).rejects.toThrow('Network error');
    });

    it('should construct correct asset path', async () => {
      mockHttp.get.mockReturnValue(of({}));

      await lastValueFrom(loader.getTranslation('custom-lang'));

      expect(mockHttp.get).toHaveBeenCalledWith('/assets/i18n/custom-lang.json');
    });

    it('should return observable', () => {
      mockHttp.get.mockReturnValue(of(mockEnglishTranslations));

      const result = loader.getTranslation('en-US');

      expect(result).toBeDefined();
      expect(typeof result.subscribe).toBe('function');
    });
  });

  describe('Translation File Structure', () => {
    it('should handle empty translation file', async () => {
      mockHttp.get.mockReturnValue(of({}));

      const translations = await lastValueFrom(loader.getTranslation('en-US'));

      expect(translations).toEqual({});
    });

    it('should handle nested translation keys', async () => {
      const nestedTranslations = {
        app: {
          title: 'Title',
          nav: {
            home: 'Home',
            about: 'About',
          },
        },
      };
      mockHttp.get.mockReturnValue(of(nestedTranslations));

      const translations = await lastValueFrom(loader.getTranslation('en-US'));

      expect(translations).toEqual(nestedTranslations);
    });

    it('should handle translations with special characters', async () => {
      const specialTranslations = {
        'key.with.dots': 'Value',
        'key-with-dashes': 'Value',
        key_with_underscores: 'Value',
      };
      mockHttp.get.mockReturnValue(of(specialTranslations));

      const translations = await lastValueFrom(loader.getTranslation('en-US'));

      expect(translations).toEqual(specialTranslations);
    });
  });
});
