import { Component, OnInit, OnDestroy, Inject, LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

// Direct Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

// Services
import { AuthService } from '../../../auth/services/auth.service';

interface Language {
  code: string;
  name: string;
  localName: string;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    MatToolbarModule, 
    MatButtonModule, 
    MatIconModule,
    MatMenuModule
  ]
})
export class NavbarComponent implements OnInit, OnDestroy {
  isAuthenticated = false;
  username = '';
  homeLink = '/';
  
  // Available languages
  languages: Language[] = [
    { code: 'en-US', name: 'English', localName: 'English' },
    { code: 'de', name: 'German', localName: 'Deutsch' },
    { code: 'zh', name: 'Chinese', localName: '中文' },
    { code: 'ar', name: 'Arabic', localName: 'العربية' }
  ];
  
  currentLanguage: Language;
  
  // Subscriptions
  private authSubscription: Subscription | null = null;
  private usernameSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    // Initialize with current locale
    this.currentLanguage = this.languages.find(lang => lang.code === localeId) || this.languages[0];
  }

  ngOnInit(): void {
    // Subscribe to auth state
    this.authSubscription = this.authService.isAuthenticated$.subscribe(
      (isAuthenticated) => {
        this.isAuthenticated = isAuthenticated;
        this.updateHomeLink();
      }
    );
    
    // Subscribe to username
    this.usernameSubscription = this.authService.username$.subscribe(
      (username) => {
        this.username = username;
      }
    );
    
    // Load saved language preference
    this.loadLanguagePreference();
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    
    if (this.usernameSubscription) {
      this.usernameSubscription.unsubscribe();
    }
  }

  updateHomeLink(): void {
    this.homeLink = this.isAuthenticated ? '/diagram-management' : '/';
  }

  logout(): void {
    // Use auth service for logout
    this.authService.logout();
  }
  
  // Load language preference - this should sync with app.config.ts logic
  loadLanguagePreference(): void {
    // First check URL query parameter (highest priority - explicit user choice)
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam) {
      const langFromParam = this.languages.find(l => l.code === langParam);
      if (langFromParam) {
        this.currentLanguage = langFromParam;
        return;
      }
    }
    
    // Then check localStorage (second priority - previously selected language)
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang) {
      const langFromStorage = this.languages.find(l => l.code === savedLang);
      if (langFromStorage) {
        this.currentLanguage = langFromStorage;
        return;
      }
    }
    
    // Try to use browser locale (third priority - browser preference)
    const browserLang = navigator.language || (navigator as any).userLanguage;
    if (browserLang) {
      // Look for an exact match
      let matchingLang = this.languages.find(l => l.code === browserLang);
      
      // If no exact match, try matching just the language part (e.g. 'en' from 'en-US')
      if (!matchingLang) {
        const baseLang = browserLang.split('-')[0];
        matchingLang = this.languages.find(l => l.code.startsWith(baseLang));
      }
      
      if (matchingLang) {
        this.currentLanguage = matchingLang;
        return;
      }
    }
    
    // Fallback to English (lowest priority - fallback)
    this.currentLanguage = this.languages[0];
  }
  
  // Switch language
  switchLanguage(lang: Language): void {
    if (lang.code !== this.currentLanguage.code) {
      // Save preference to localStorage
      localStorage.setItem('preferredLanguage', lang.code);
      
      // Force reload with the new language parameter
      // This will trigger the locale change in app.config.ts
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('lang', lang.code);
      window.location.href = currentUrl.toString();
    }
  }
}
