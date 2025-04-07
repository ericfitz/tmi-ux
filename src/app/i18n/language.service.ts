import { Injectable, OnDestroy } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, Subscription } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  localName: string;
  rtl?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LanguageService implements OnDestroy {
  // Available languages
  private availableLanguages: Language[] = [
    { code: 'en-US', name: 'English', localName: 'English' },
    { code: 'de', name: 'German', localName: 'Deutsch' },
    { code: 'zh', name: 'Chinese', localName: '中文' },
    { code: 'ar', name: 'Arabic', localName: 'العربية', rtl: true },
  ];

  // Private subjects
  private currentLanguageSubject = new BehaviorSubject<Language>(this.availableLanguages[0]);
  private directionSubject = new BehaviorSubject<'ltr' | 'rtl'>('ltr');
  
  // Public observables
  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  public direction$ = this.directionSubject.asObservable();

  // Subscription to clean up
  private langChangeSub: Subscription | null = null;

  constructor(private translocoService: TranslocoService) {
    // Initialize by syncing with Transloco's active language
    const activeLang = this.translocoService.getActiveLang();
    if (activeLang) {
      this.updateCurrentLanguage(activeLang);
    } else {
      // This fallback should rarely be needed since we preload in APP_INITIALIZER
      this.initializeLanguage();
    }

    // Subscribe to Transloco's active language changes
    this.langChangeSub = this.translocoService.langChanges$.subscribe(langCode => {
      this.updateCurrentLanguage(langCode);
    });
  }

  ngOnDestroy(): void {
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): Language[] {
    return this.availableLanguages;
  }

  /**
   * Set the active language
   */
  setLanguage(langCode: string): void {
    // Save preference to localStorage
    localStorage.setItem('preferredLanguage', langCode);

    // Set the language in Transloco and load it with error handling
    this.translocoService.setActiveLang(langCode);

    // Always load the language (Transloco will handle caching internally)
    this.translocoService.load(langCode).subscribe({
      next: _translations => {
        // Successfully loaded translations
      },
      error: err => {
        // Log error and fallback to English
        this.logTranslationError(langCode, err);
      },
    });

    // Update current language in our service
    this.updateCurrentLanguage(langCode);
  }

  /**
   * Update the current language object and direction
   */
  private updateCurrentLanguage(langCode: string): void {
    const language =
      this.availableLanguages.find(lang => lang.code === langCode) || this.availableLanguages[0];
    this.currentLanguageSubject.next(language);

    // Update direction
    const direction = language.rtl ? 'rtl' : 'ltr';
    this.directionSubject.next(direction);

    // Set document direction
    document.documentElement.dir = direction;
    document.documentElement.lang = langCode;
  }

  /**
   * Initialize language based on various sources
   */
  private initializeLanguage(): void {
    const preferredLang = this.getPreferredLanguage();
    this.setLanguage(preferredLang);
  }
  
  /**
   * Log translation error and fallback to English
   * @param langCode The language code that failed to load
   * @param err The error that occurred
   */
  private logTranslationError(langCode: string, _err: unknown): void {
    // Fallback to English on error
    if (langCode !== 'en-US') {
      this.translocoService.setActiveLang('en-US');
    }
  }

  /**
   * Get preferred language in order of priority:
   * 1. URL query parameter
   * 2. LocalStorage
   * 3. Browser language
   * 4. Default (en-US)
   */
  private getPreferredLanguage(): string {
    const supportedCodes = this.availableLanguages.map(lang => lang.code);

    // Check URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam && supportedCodes.includes(langParam)) {
      // Clean URL if language was specified in the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('lang');
      window.history.replaceState({}, '', newUrl.toString());
      return langParam;
    }

    // Check localStorage
    const storedLang = localStorage.getItem('preferredLanguage');
    if (storedLang && supportedCodes.includes(storedLang)) {
      return storedLang;
    }

    // Check browser language
    const browserLang = navigator.language;
    if (browserLang) {
      // Try exact match
      if (supportedCodes.includes(browserLang)) {
        return browserLang;
      }

      // Try base language match
      const baseLang = browserLang.split('-')[0];
      const baseMatch = this.availableLanguages.find(lang => lang.code.startsWith(baseLang));
      if (baseMatch) {
        return baseMatch.code;
      }
    }

    // Default to English
    return 'en-US';
  }
}
