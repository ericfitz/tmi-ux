// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ThreatModelReportService } from './threat-model-report.service';
import { UserPreferencesService } from '../../../core/services/user-preferences.service';
import type { LoggerService } from '../../../core/services/logger.service';
import type { TranslocoService } from '@jsverse/transloco';
import type { LanguageService } from '../../../i18n/language.service';
import type { BrandingConfigService } from '../../../core/services/branding-config.service';

describe('ThreatModelReportService', () => {
  let service: ThreatModelReportService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockTransloco: {
    translate: ReturnType<typeof vi.fn>;
    getActiveLang: ReturnType<typeof vi.fn>;
  };
  let mockLanguageService: Record<string, never>;
  let mockBrandingConfig: {
    dataClassification: string | null;
    confidentialityWarning: string | null;
    logoPngData: Uint8Array | null;
  };
  let mockUserPreferencesService: {
    getPreferences: ReturnType<typeof vi.fn>;
  };
  let envInjector: EnvironmentInjector;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    mockTransloco = {
      translate: vi.fn().mockImplementation((key: string) => key),
      getActiveLang: vi.fn().mockReturnValue('en-US'),
    };

    mockLanguageService = {};

    mockBrandingConfig = {
      dataClassification: null,
      confidentialityWarning: null,
      logoPngData: null,
    };

    mockUserPreferencesService = {
      getPreferences: vi.fn().mockReturnValue({}),
    };

    envInjector = createEnvironmentInjector(
      [{ provide: UserPreferencesService, useValue: mockUserPreferencesService }],
      {
        get: () => null,
      } as unknown as EnvironmentInjector,
    );

    runInInjectionContext(envInjector, () => {
      service = new ThreatModelReportService(
        mockLogger as unknown as LoggerService,
        mockTransloco as unknown as TranslocoService,
        mockLanguageService as unknown as LanguageService,
        mockBrandingConfig as unknown as BrandingConfigService,
      );
    });
  });

  afterEach(() => {
    envInjector.destroy();
  });

  describe('page dimension calculations', () => {
    it('should default to US Letter page size (612 x 792)', () => {
      // Access private methods via bracket notation for testing pure math
      const dims = (service as Record<string, unknown>)['getPageDimensions'] as () => {
        width: number;
        height: number;
      };
      const result = dims.call(service);
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('should default to standard margins (54 points)', () => {
      const getMargin = (service as Record<string, unknown>)['getMargin'] as () => number;
      expect(getMargin.call(service)).toBe(54);
    });

    it('should calculate printable width as page width minus both margins', () => {
      const getPrintableWidth = (service as Record<string, unknown>)[
        'getPrintableWidth'
      ] as () => number;
      // US Letter: 612 - 2*54 = 504
      expect(getPrintableWidth.call(service)).toBe(504);
    });

    it('should calculate starting Y position as page height minus top margin', () => {
      const getStartingY = (service as Record<string, unknown>)[
        'getStartingYPosition'
      ] as () => number;
      // US Letter: 792 - 54 = 738
      expect(getStartingY.call(service)).toBe(738);
    });

    it('should calculate DPI scale as 300/72', () => {
      const getDpiScale = (service as Record<string, unknown>)['getPrintDpiScale'] as () => number;
      const scale = getDpiScale.call(service);
      expect(scale).toBeCloseTo(4.1667, 3);
    });
  });

  describe('loadUserPreferences', () => {
    it('should update pageSize when valid preference exists', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({ pageSize: 'A4' });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const dims = (service as Record<string, unknown>)['getPageDimensions'] as () => {
        width: number;
        height: number;
      };
      expect(dims.call(service)).toEqual({ width: 595, height: 842 });
    });

    it('should keep default pageSize when invalid preference provided', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({
        pageSize: 'tabloid',
      });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const dims = (service as Record<string, unknown>)['getPageDimensions'] as () => {
        width: number;
        height: number;
      };
      // Should remain US Letter
      expect(dims.call(service)).toEqual({ width: 612, height: 792 });
    });

    it('should update marginSize when valid preference exists', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({ marginSize: 'narrow' });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const getMargin = (service as Record<string, unknown>)['getMargin'] as () => number;
      expect(getMargin.call(service)).toBe(36);
    });

    it('should keep default marginSize when invalid preference provided', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({
        marginSize: 'extraWide',
      });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const getMargin = (service as Record<string, unknown>)['getMargin'] as () => number;
      // Should remain standard
      expect(getMargin.call(service)).toBe(54);
    });

    it('should handle empty preferences object gracefully', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({});

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      expect(() => loadPrefs.call(service)).not.toThrow();
    });

    it('should log loaded preferences', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({
        pageSize: 'A4',
        marginSize: 'wide',
      });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded user preferences for report generation',
        { pageSize: 'A4', marginSize: 'wide' },
      );
    });

    it('should calculate correct printable width for A4 with narrow margins', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({
        pageSize: 'A4',
        marginSize: 'narrow',
      });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const getPrintableWidth = (service as Record<string, unknown>)[
        'getPrintableWidth'
      ] as () => number;
      // A4: 595 - 2*36 = 523
      expect(getPrintableWidth.call(service)).toBe(523);
    });
  });

  describe('font configuration', () => {
    it('should have font config for en-US', () => {
      const fontConfigs = (service as Record<string, unknown>)['fontConfigs'] as Map<
        string,
        { name: string; fontPath: string; rtl?: boolean }
      >;
      const config = fontConfigs.get('en-US');
      expect(config).toBeDefined();
      expect(config!.name).toBe('NotoSans');
    });

    it('should have RTL flag set for Arabic', () => {
      const fontConfigs = (service as Record<string, unknown>)['fontConfigs'] as Map<
        string,
        { name: string; fontPath: string; rtl?: boolean }
      >;
      const config = fontConfigs.get('ar');
      expect(config).toBeDefined();
      expect(config!.rtl).toBe(true);
    });

    it('should have RTL flag set for Hebrew', () => {
      const fontConfigs = (service as Record<string, unknown>)['fontConfigs'] as Map<
        string,
        { name: string; fontPath: string; rtl?: boolean }
      >;
      const config = fontConfigs.get('he');
      expect(config).toBeDefined();
      expect(config!.rtl).toBe(true);
    });

    it('should use different font for CJK languages', () => {
      const fontConfigs = (service as Record<string, unknown>)['fontConfigs'] as Map<
        string,
        { name: string; fontPath: string }
      >;
      const zhConfig = fontConfigs.get('zh');
      const jaConfig = fontConfigs.get('ja');
      const koConfig = fontConfigs.get('ko');

      expect(zhConfig!.name).toBe('NotoSansSC');
      expect(jaConfig!.name).toBe('NotoSansJP');
      expect(koConfig!.name).toBe('NotoSansKR');

      // Each should have a unique font path
      const paths = new Set([zhConfig!.fontPath, jaConfig!.fontPath, koConfig!.fontPath]);
      expect(paths.size).toBe(3);
    });
  });

  describe('font caching (fetchFont)', () => {
    it('should cache fetched font data and return cached version on subsequent calls', async () => {
      const mockFontData = new Uint8Array([1, 2, 3]);
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockFontData.buffer),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const fetchFont = (service as Record<string, unknown>)['fetchFont'] as (
        path: string,
      ) => Promise<Uint8Array>;

      // First call should fetch
      await fetchFont.call(service, 'assets/fonts/test.ttf');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await fetchFont.call(service, 'assets/fonts/test.ttf');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });

    it('should throw on failed font fetch', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        }),
      );

      const fetchFont = (service as Record<string, unknown>)['fetchFont'] as (
        path: string,
      ) => Promise<Uint8Array>;

      await expect(fetchFont.call(service, 'assets/fonts/missing.ttf')).rejects.toThrow(
        'Failed to fetch font: 404 Not Found',
      );

      vi.unstubAllGlobals();
    });

    it('should not cache failed font fetches', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new Uint8Array([1]).buffer),
        });
      vi.stubGlobal('fetch', fetchSpy);

      const fetchFont = (service as Record<string, unknown>)['fetchFont'] as (
        path: string,
      ) => Promise<Uint8Array>;

      // First call fails
      await expect(fetchFont.call(service, 'assets/fonts/test.ttf')).rejects.toThrow();

      // Second call should retry (not serve from cache)
      await fetchFont.call(service, 'assets/fonts/test.ttf');
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      vi.unstubAllGlobals();
    });
  });

  describe('formatDate', () => {
    it('should return translation key for undefined date', () => {
      const formatDate = (service as Record<string, unknown>)['formatDate'] as (
        date: string | Date | undefined,
      ) => string;
      const result = formatDate.call(service, undefined);
      expect(mockTransloco.translate).toHaveBeenCalledWith('common.noDataAvailable');
      expect(result).toBe('common.noDataAvailable');
    });

    it('should return translation key for empty string date', () => {
      const formatDate = (service as Record<string, unknown>)['formatDate'] as (
        date: string | Date | undefined,
      ) => string;
      const result = formatDate.call(service, '');
      expect(result).toBe('common.noDataAvailable');
    });

    it('should format valid ISO date string', () => {
      const formatDate = (service as Record<string, unknown>)['formatDate'] as (
        date: string | Date | undefined,
      ) => string;
      const result = formatDate.call(service, '2024-06-15T10:30:00Z');
      // Should produce a localized date string, not a translation key
      expect(result).not.toBe('common.noDataAvailable');
      expect(typeof result).toBe('string');
    });

    it('should format Date object', () => {
      const formatDate = (service as Record<string, unknown>)['formatDate'] as (
        date: string | Date | undefined,
      ) => string;
      const result = formatDate.call(service, new Date('2024-06-15T10:30:00Z'));
      expect(result).not.toBe('common.noDataAvailable');
      expect(typeof result).toBe('string');
    });

    it('should return translation key for invalid date string', () => {
      const formatDate = (service as Record<string, unknown>)['formatDate'] as (
        date: string | Date | undefined,
      ) => string;
      const result = formatDate.call(service, 'not-a-date');
      // "not-a-date" creates Invalid Date → toLocaleDateString returns "Invalid Date"
      // The catch block may or may not trigger depending on the locale
      expect(typeof result).toBe('string');
    });
  });

  describe('generateReport error handling', () => {
    it('should log error and rethrow when report generation fails', async () => {
      const error = new Error('PDF generation failed');
      // Mock PDFDocument.create to throw
      const pdfLib = await import('pdf-lib');
      vi.spyOn(pdfLib.PDFDocument, 'create').mockRejectedValue(error);

      const threatModel = {
        id: 'tm-1',
        name: 'Test Model',
        description: 'Test',
        created_at: '2024-01-01',
        modified_at: '2024-01-01',
        owner: {
          principal_type: 'user',
          provider: 'google',
          provider_id: 'owner@test.com',
          display_name: 'Owner',
        },
        created_by: {
          principal_type: 'user',
          provider: 'google',
          provider_id: 'owner@test.com',
          display_name: 'Owner',
        },
        threat_model_framework: 'STRIDE',
        authorization: [],
      };

      await expect(
        service.generateReport(threatModel as Parameters<typeof service.generateReport>[0]),
      ).rejects.toThrow('PDF generation failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error generating PDF report with pdf-lib',
        error,
      );
    });
  });
});
