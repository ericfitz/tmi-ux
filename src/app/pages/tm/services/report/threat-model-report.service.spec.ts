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
    getAvailableLangs: ReturnType<typeof vi.fn>;
    getTranslation: ReturnType<typeof vi.fn>;
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
      getAvailableLangs: vi.fn().mockReturnValue(['en-US']),
      getTranslation: vi.fn().mockReturnValue({}),
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

  describe('generateReport happy path', () => {
    // savePdf() triggers a browser download via an anchor element and
    // URL.createObjectURL. Stub the URL APIs and the anchor click so the
    // test exercises real PDF generation without a real download.
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // PdfFontManager fetches NotoSans TTFs and falls back to Helvetica on
      // failure — stub fetch so the fallback path runs without a network call.
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('fetch disabled in tests'))),
      );

      createObjectURL = vi.fn().mockReturnValue('blob:report');
      revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL,
        revokeObjectURL,
      });

      clickSpy = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const baseThreatModel = {
      id: 'tm-1',
      name: 'Test Model',
      description: 'A test threat model',
      created_at: '2024-01-01T00:00:00Z',
      modified_at: '2024-02-01T00:00:00Z',
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

    it('generates a PDF and triggers the download for a minimal threat model', async () => {
      await service.generateReport(baseThreatModel as Parameters<typeof service.generateReport>[0]);

      // savePdf created a blob URL, clicked the download link, then revoked it.
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('renders the confidentiality warning and classification when branding provides them', async () => {
      mockBrandingConfig.confidentialityWarning = 'Internal use only';
      mockBrandingConfig.dataClassification = 'CONFIDENTIAL';

      await service.generateReport(baseThreatModel as Parameters<typeof service.generateReport>[0]);

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('generates a PDF that includes inputs and outputs sections', async () => {
      const fullModel = {
        ...baseThreatModel,
        assets: [
          {
            id: 'a1',
            name: 'Customer DB',
            type: 'data',
            criticality: 'high',
            include_in_report: true,
            created_at: '2024-01-01',
            modified_at: '2024-01-01',
          },
        ],
        threats: [
          {
            id: 't1',
            threat_model_id: 'tm-1',
            name: 'SQL Injection',
            description: 'Untrusted input',
            severity: 'high',
            threat_type: ['Tampering'],
            include_in_report: true,
            created_at: '2024-01-01',
            modified_at: '2024-01-01',
          },
        ],
        notes: [
          {
            id: 'n1',
            name: 'Review Notes',
            content: '# Notes\n\nSome content.',
            include_in_report: true,
            created_at: '2024-01-01',
            modified_at: '2024-01-01',
          },
        ],
      };

      await service.generateReport(fullModel as Parameters<typeof service.generateReport>[0]);

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('applies the A4 page size from user preferences', async () => {
      mockUserPreferencesService.getPreferences.mockReturnValue({
        pageSize: 'A4',
        marginSize: 'wide',
      });

      await service.generateReport(baseThreatModel as Parameters<typeof service.generateReport>[0]);

      expect((service as Record<string, unknown>)['pageSize']).toBe('A4');
      expect((service as Record<string, unknown>)['marginSize']).toBe('wide');
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
