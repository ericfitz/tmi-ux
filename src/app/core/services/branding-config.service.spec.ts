// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BrandingConfigService } from './branding-config.service';
import { LoggerService } from './logger.service';

// Mock environment
vi.mock('../../../environments/environment', () => ({
  environment: {
    apiUrl: 'http://localhost:8080/api',
  },
}));

describe('BrandingConfigService', () => {
  let service: BrandingConfigService;
  let mockLoggerService: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let fetchSpy: ReturnType<typeof vi.fn>;

  const mockConfig = {
    features: {},
    ui: {
      logo_url: 'https://example.com/logo.png',
      organization_name: 'Test Org',
      organization_url: 'https://example.com',
      support_url: 'https://example.com/support',
      confidentiality_warning: 'CONFIDENTIAL',
      data_classification: 'Internal Use Only',
      user_hyperlink_template: 'https://directory.example.com/?email={{user.email}}',
      user_hyperlink_provider: 'azure-ad',
    },
  };

  const createPngResponse = (ok = true, contentType = 'image/png', size = 100): Response => {
    const buffer = new ArrayBuffer(size);
    return {
      ok,
      status: ok ? 200 : 404,
      headers: {
        get: (name: string) => (name === 'content-type' ? contentType : null),
      },
      arrayBuffer: () => Promise.resolve(buffer),
      json: () => Promise.resolve({}),
    } as unknown as Response;
  };

  const createConfigResponse = (config: unknown, ok = true): Response => {
    return {
      ok,
      status: ok ? 200 : 404,
      json: () => Promise.resolve(config),
    } as unknown as Response;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    // Mock URL.createObjectURL which isn't available in Node/vitest
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    });

    service = new BrandingConfigService(
      {} as never, // HttpClient not used (service uses fetch)
      mockLoggerService as unknown as LoggerService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have default logo URL', () => {
      let url = '';
      service.logoImageUrl$.subscribe(v => (url = v));
      expect(url).toBe('/TMI-FullLogo-Transparent-512x512.png');
    });

    it('should have null config values by default', () => {
      expect(service.organizationName).toBeNull();
      expect(service.organizationUrl).toBeNull();
      expect(service.supportUrl).toBeNull();
      expect(service.confidentialityWarning).toBeNull();
      expect(service.dataClassification).toBeNull();
      expect(service.userHyperlinkTemplate).toBeNull();
      expect(service.userHyperlinkProvider).toBeNull();
      expect(service.logoPngData).toBeNull();
    });
  });

  describe('initialize()', () => {
    it('should fetch config and custom logo on success', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig)) // config fetch
        .mockResolvedValueOnce(createPngResponse()); // logo fetch

      await service.initialize();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(service.organizationName).toBe('Test Org');
      expect(service.organizationUrl).toBe('https://example.com');
      expect(service.supportUrl).toBe('https://example.com/support');
      expect(service.confidentialityWarning).toBe('CONFIDENTIAL');
      expect(service.dataClassification).toBe('Internal Use Only');
      expect(service.userHyperlinkTemplate).toBe(
        'https://directory.example.com/?email={{user.email}}',
      );
      expect(service.userHyperlinkProvider).toBe('azure-ad');
    });

    it('should store logo PNG data after successful logo fetch', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.logoPngData).toBeInstanceOf(Uint8Array);
    });

    it('should update logoImageUrl$ to object URL after successful logo fetch', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      let url = '';
      service.logoImageUrl$.subscribe(v => (url = v));
      expect(url).toBe('blob:mock-url');
    });

    it('should fall back to default logo when config has no logo_url', async () => {
      const configNoLogo = { ui: { organization_name: 'Test' } };
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(configNoLogo))
        .mockResolvedValueOnce(createPngResponse()); // default logo fetch

      await service.initialize();

      let url = '';
      service.logoImageUrl$.subscribe(v => (url = v));
      expect(url).toBe('/TMI-FullLogo-Transparent-512x512.png');
    });

    it('should handle 404 config response gracefully', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(null, false))
        .mockResolvedValueOnce(createPngResponse()); // default logo fetch

      await service.initialize();

      expect(service.organizationName).toBeNull();
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should handle network error on config fetch gracefully', async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createPngResponse()); // default logo fetch

      await service.initialize();

      expect(service.organizationName).toBeNull();
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should handle config with no ui property', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse({ features: {} }))
        .mockResolvedValueOnce(createPngResponse()); // default logo fetch

      await service.initialize();

      expect(service.organizationName).toBeNull();
      expect(service.dataClassification).toBeNull();
    });

    it('should handle empty config response body', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse({}))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.organizationName).toBeNull();
    });
  });

  describe('Logo Validation', () => {
    it('should reject non-PNG content type and fall back to default', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockResolvedValueOnce(createPngResponse(true, 'image/jpeg')) // invalid type
        .mockResolvedValueOnce(createPngResponse()); // default logo fallback

      await service.initialize();

      let url = '';
      service.logoImageUrl$.subscribe(v => (url = v));
      expect(url).toBe('/TMI-FullLogo-Transparent-512x512.png');
      expect(mockLoggerService.warn).toHaveBeenCalledWith(expect.stringContaining('content-type'));
    });

    it('should reject logo fetch failure and fall back to default', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockResolvedValueOnce(createPngResponse(false)) // logo 404
        .mockResolvedValueOnce(createPngResponse()); // default logo fallback

      await service.initialize();

      let url = '';
      service.logoImageUrl$.subscribe(v => (url = v));
      expect(url).toBe('/TMI-FullLogo-Transparent-512x512.png');
    });

    it('should reject logo exceeding max size', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockResolvedValueOnce(createPngResponse(true, 'image/png', 3 * 1024 * 1024)) // 3MB
        .mockResolvedValueOnce(createPngResponse()); // default logo fallback

      await service.initialize();

      let url = '';
      service.logoImageUrl$.subscribe(v => (url = v));
      expect(url).toBe('/TMI-FullLogo-Transparent-512x512.png');
    });

    it('should handle logo fetch network error and fall back to default', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockRejectedValueOnce(new Error('CORS error'))
        .mockResolvedValueOnce(createPngResponse()); // default logo fallback

      await service.initialize();

      let url = '';
      service.logoImageUrl$.subscribe(v => (url = v));
      expect(url).toBe('/TMI-FullLogo-Transparent-512x512.png');
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('custom logo fetch/validation failed'),
        expect.any(Error),
      );
    });
  });

  describe('Default Logo', () => {
    it('should load default logo PNG data for PDF use', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse({}))
        .mockResolvedValueOnce(createPngResponse()); // default logo

      await service.initialize();

      expect(service.logoPngData).toBeInstanceOf(Uint8Array);
    });

    it('should handle default logo fetch failure', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse({}))
        .mockRejectedValueOnce(new Error('Network error')); // default logo fetch fails

      await service.initialize();

      // logoPngData stays null but service doesn't crash
      expect(service.logoPngData).toBeNull();
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed to pre-load default logo'),
        expect.any(Error),
      );
    });
  });

  describe('Observables', () => {
    it('should emit organization name from config', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      let value: string | null = null;
      service.organizationName$.subscribe(v => (value = v));
      expect(value).toBe('Test Org');
    });

    it('should emit data classification from config', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(mockConfig))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      let value: string | null = null;
      service.dataClassification$.subscribe(v => (value = v));
      expect(value).toBe('Internal Use Only');
    });

    it('should emit null for missing config values', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse({ ui: {} }))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      let value: string | null = 'initial';
      service.organizationName$.subscribe(v => (value = v));
      expect(value).toBeNull();
    });
  });
});
