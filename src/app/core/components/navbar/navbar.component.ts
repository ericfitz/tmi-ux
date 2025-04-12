import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

// Import only the specific Material modules needed
import { CoreMaterialModule } from '../../../shared/material/core-material.module';

// Services
import { AuthService } from '../../../auth/services/auth.service';
import { LanguageService, Language } from '../../../i18n/language.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
  imports: [CommonModule, RouterModule, CoreMaterialModule, TranslocoModule],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isAuthenticated = false;
  username = '';
  homeLink = '/';

  // Languages
  languages: Language[] = [];
  currentLanguage!: Language;

  // Subscriptions
  private authSubscription: Subscription | null = null;
  private usernameSubscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private languageService: LanguageService,
  ) {
    // Get available languages
    this.languages = this.languageService.getAvailableLanguages();
  }

  ngOnInit(): void {
    // Subscribe to auth state
    this.authSubscription = this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAuthenticated = isAuthenticated;
      this.updateHomeLink();
    });

    // Subscribe to username
    this.usernameSubscription = this.authService.username$.subscribe(username => {
      this.username = username;
    });

    // Subscribe to language changes
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(language => {
      this.currentLanguage = language;
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }

    if (this.usernameSubscription) {
      this.usernameSubscription.unsubscribe();
    }

    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  updateHomeLink(): void {
    this.homeLink = this.isAuthenticated ? '/diagram-management' : '/';
  }

  logout(): void {
    // Use auth service for logout
    this.authService.logout();
  }

  // Switch language
  switchLanguage(lang: Language): void {
    if (lang.code !== this.currentLanguage.code) {
      this.languageService.setLanguage(lang.code);
    }
  }
}
