import { Injectable, OnDestroy } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Language, SUPPORTED_LANGUAGES, detectPreferredLanguage } from './language-config';

export type { Language } from './language-config';

@Injectable({
  providedIn: 'root',
})
// SEM@e19c6684da148f53fab89e000721a9721f83d6d2: manage active locale, text direction, and translation loading (mutates shared state)
export class LanguageService implements OnDestroy {
  // Private subjects
  private currentLanguageSubject = new BehaviorSubject<Language>(SUPPORTED_LANGUAGES[0]);
  private directionSubject = new BehaviorSubject<'ltr' | 'rtl'>('ltr');
  private langChangeSub: Subscription | null = null;

  // Public observables
  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  public direction$ = this.directionSubject.asObservable();

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: sync service state with Transloco's active language on initialization (mutates shared state)
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

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: unsubscribe from language change subscription on service teardown
  ngOnDestroy(): void {
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
  }

  /**
   * Get all available languages
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: list all supported locales (pure)
  getAvailableLanguages(): Language[] {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Set the active language
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: persist and activate a new locale, loading its translations (mutates shared state)
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
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: update the active language subject and document direction (mutates shared state)
  private updateCurrentLanguage(langCode: string): void {
    const language =
      SUPPORTED_LANGUAGES.find(lang => lang.code === langCode) || SUPPORTED_LANGUAGES[0];
    this.currentLanguageSubject.next(language);

    // Update direction
    const direction = language.rtl ? 'rtl' : 'ltr';
    this.directionSubject.next(direction);

    // Set document direction safely
    try {
      document.documentElement.dir = direction;
      document.documentElement.lang = langCode;
    } catch (error) {
      // In some environments, these properties might be read-only
      // Log the error but don't throw to avoid breaking the application
      console.warn('Could not set document direction/language properties:', error);
    }
  }

  /**
   * Initialize language based on various sources
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: detect and set the preferred locale from URL or storage on startup (mutates shared state)
  private initializeLanguage(): void {
    const preferredLang = detectPreferredLanguage(new URLSearchParams(window.location.search));

    // Clean URL if language was specified in the URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('lang')) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('lang');
      window.history.replaceState({}, '', newUrl.toString());
    }

    this.setLanguage(preferredLang);
  }

  /**
   * Log translation error and fallback to English
   * @param langCode The language code that failed to load
   * @param err The error that occurred
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fall back to English when a translation file fails to load (mutates shared state)
  private logTranslationError(langCode: string, _err: unknown): void {
    // Fallback to English on error
    if (langCode !== 'en-US') {
      this.translocoService.setActiveLang('en-US');
    }
  }
}
