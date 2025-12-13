/**
 * Unit tests for LanguageService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/i18n/language.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let mockTranslocoService: {
    getActiveLang: ReturnType<typeof vi.fn>;
    setActiveLang: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    langChanges$: BehaviorSubject<string>;
  };

  // Save original window properties
  let originalLocation: Location;
  let originalNavigator: Navigator;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Save originals
    originalLocation = window.location;
    originalNavigator = window.navigator;
    originalLocalStorage = window.localStorage;

    // Mock localStorage
    const localStorageMock: Record<string, string> = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        Object.keys(localStorageMock).forEach(key => delete localStorageMock[key]);
      }),
      key: vi.fn(),
      length: 0,
    } as Storage;

    // Mock window.location
    delete (window as { location?: Location }).location;
    window.location = {
      ...originalLocation,
      search: '',
      href: 'http://localhost:4200',
    } as Location;

    // Mock window.navigator
    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'en-US',
      },
      writable: true,
      configurable: true,
    });

    // Mock document.documentElement
    Object.defineProperty(document.documentElement, 'dir', {
      value: 'ltr',
      writable: true,
      configurable: true,
    });

    Object.defineProperty(document.documentElement, 'lang', {
      value: 'en-US',
      writable: true,
      configurable: true,
    });

    // Create mock Transloco service
    mockTranslocoService = {
      getActiveLang: vi.fn(() => 'en-US'),
      setActiveLang: vi.fn(),
      load: vi.fn(() => of({})),
      langChanges$: new BehaviorSubject<string>('en-US'),
    };

    // Create service with mocks
    service = new LanguageService(mockTranslocoService as any);
  });

  afterEach(() => {
    service.ngOnDestroy();
    window.location = originalLocation;
    global.localStorage = originalLocalStorage;
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with active language from Transloco', () => {
      expect(mockTranslocoService.getActiveLang).toHaveBeenCalled();
    });

    it('should subscribe to language changes', () => {
      let currentLang: any;
      service.currentLanguage$.subscribe(lang => {
        currentLang = lang;
      });

      expect(currentLang.code).toBe('en-US');
    });
  });

  describe('getAvailableLanguages()', () => {
    it('should return list of available languages', () => {
      const languages = service.getAvailableLanguages();

      expect(languages).toHaveLength(5);
      expect(languages[0].code).toBe('en-US');
      expect(languages[0].name).toBe('English');
    });

    it('should include RTL language (Arabic)', () => {
      const languages = service.getAvailableLanguages();
      const arabic = languages.find(lang => lang.code === 'ar');

      expect(arabic).toBeDefined();
      expect(arabic?.rtl).toBe(true);
    });

    it('should include all supported languages', () => {
      const languages = service.getAvailableLanguages();
      const codes = languages.map(lang => lang.code);

      expect(codes).toContain('en-US');
      expect(codes).toContain('de');
      expect(codes).toContain('zh');
      expect(codes).toContain('ar');
      expect(codes).toContain('th');
    });
  });

  describe('setLanguage()', () => {
    it('should set language in Transloco', () => {
      service.setLanguage('de');

      expect(mockTranslocoService.setActiveLang).toHaveBeenCalledWith('de');
    });

    it('should load translations', () => {
      service.setLanguage('de');

      expect(mockTranslocoService.load).toHaveBeenCalledWith('de');
    });

    it('should save language to localStorage', () => {
      service.setLanguage('de');

      expect(localStorage.setItem).toHaveBeenCalledWith('preferredLanguage', 'de');
    });

    it('should update current language observable', () => {
      service.setLanguage('de');

      let currentLang: any;
      service.currentLanguage$.subscribe(lang => {
        currentLang = lang;
      });

      expect(currentLang.code).toBe('de');
      expect(currentLang.name).toBe('German');
    });

    it('should update direction to LTR for German', () => {
      service.setLanguage('de');

      let direction: any;
      service.direction$.subscribe(dir => {
        direction = dir;
      });

      expect(direction).toBe('ltr');
    });

    it('should update direction to RTL for Arabic', () => {
      service.setLanguage('ar');

      let direction: any;
      service.direction$.subscribe(dir => {
        direction = dir;
      });

      expect(direction).toBe('rtl');
    });

    it('should set document direction', () => {
      service.setLanguage('ar');

      expect(document.documentElement.dir).toBe('rtl');
    });

    it('should set document language', () => {
      service.setLanguage('de');

      expect(document.documentElement.lang).toBe('de');
    });

    it('should handle translation loading errors', () => {
      mockTranslocoService.load.mockReturnValue(throwError(() => new Error('Load failed')));

      // Should not throw
      expect(() => service.setLanguage('de')).not.toThrow();
    });
  });

  describe('Language Changes', () => {
    it('should react to Transloco language changes', () => {
      let currentLang: any;
      service.currentLanguage$.subscribe(lang => {
        currentLang = lang;
      });

      // Trigger language change
      mockTranslocoService.langChanges$.next('de');

      expect(currentLang.code).toBe('de');
      expect(currentLang.name).toBe('German');
    });

    it('should update direction when language changes', () => {
      let direction: any;
      service.direction$.subscribe(dir => {
        direction = dir;
      });

      mockTranslocoService.langChanges$.next('ar');

      expect(direction).toBe('rtl');
    });

    it('should fallback to English for unknown language code', () => {
      let currentLang: any;
      service.currentLanguage$.subscribe(lang => {
        currentLang = lang;
      });

      mockTranslocoService.langChanges$.next('unknown');

      expect(currentLang.code).toBe('en-US');
    });
  });

  describe('ngOnDestroy()', () => {
    it('should unsubscribe from language changes', () => {
      const unsubscribeSpy = vi.spyOn(
        (service as any).langChangeSub as { unsubscribe: () => void },
        'unsubscribe',
      );

      service.ngOnDestroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });
  });

  describe('Document Direction Safety', () => {
    it('should handle read-only document properties gracefully', () => {
      // Make dir property read-only
      Object.defineProperty(document.documentElement, 'dir', {
        value: 'ltr',
        writable: false,
        configurable: true,
      });

      // Should not throw even if property is read-only
      expect(() => service.setLanguage('ar')).not.toThrow();
    });
  });
});
