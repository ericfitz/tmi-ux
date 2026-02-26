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
import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import type { LoggerService } from '../../../../core/services/logger.service';
import type { TranslocoService } from '@jsverse/transloco';
import type { LanguageService } from '../../../../i18n/language.service';
import type { BrandingConfigService } from '../../../../core/services/branding-config.service';

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

  describe('service instantiation', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should have generateReport method', () => {
      expect(typeof service.generateReport).toBe('function');
    });
  });

  describe('loadUserPreferences', () => {
    it('should update pageSize when valid preference exists', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({ pageSize: 'A4' });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const pageSize = (service as Record<string, unknown>)['pageSize'];
      expect(pageSize).toBe('A4');
    });

    it('should keep default pageSize when invalid preference provided', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({
        pageSize: 'tabloid',
      });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const pageSize = (service as Record<string, unknown>)['pageSize'];
      expect(pageSize).toBe('usLetter');
    });

    it('should update marginSize when valid preference exists', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({ marginSize: 'narrow' });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const marginSize = (service as Record<string, unknown>)['marginSize'];
      expect(marginSize).toBe('narrow');
    });

    it('should keep default marginSize when invalid preference provided', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({
        marginSize: 'extraWide',
      });

      const loadPrefs = (service as Record<string, unknown>)['loadUserPreferences'] as () => void;
      loadPrefs.call(service);

      const marginSize = (service as Record<string, unknown>)['marginSize'];
      expect(marginSize).toBe('standard');
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
  });

  describe('generateReport error handling', () => {
    it('should log error and rethrow when report generation fails', async () => {
      const error = new Error('PDF generation failed');
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

      expect(mockLogger.error).toHaveBeenCalledWith('Error generating PDF report', error);
    });
  });
});
