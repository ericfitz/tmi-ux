import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

// Import only the specific Material modules needed
import { CoreMaterialModule } from '../../../shared/material/core-material.module';
import { FeedbackMaterialModule } from '../../../shared/material/feedback-material.module';

// Services
import { AuthService } from '../../../auth/services/auth.service';
import { LanguageService, Language } from '../../../i18n/language.service';
import { LoggerService } from '../../services/logger.service';
import {
  ServerConnectionService,
  ServerConnectionStatus,
} from '../../services/server-connection.service';

// Import the MockDataToggleComponent
import { MockDataToggleComponent } from '../mock-data-toggle/mock-data-toggle.component';
import { UserPreferencesDialogComponent } from '../user-preferences-dialog/user-preferences-dialog.component';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CoreMaterialModule,
    FeedbackMaterialModule,
    TranslocoModule,
    MockDataToggleComponent,
  ],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isAuthenticated = false;
  username = '';
  userEmail = '';
  homeLink = '/';

  // Flag to determine if we're in development mode
  isDevelopmentMode = isDevMode();

  // Languages
  languages: Language[] = [];
  currentLanguage!: Language;

  // Server connection status
  serverConnectionStatus: ServerConnectionStatus = ServerConnectionStatus.NOT_CONFIGURED;
  ServerConnectionStatus = ServerConnectionStatus; // Expose enum to template

  // Subscriptions
  private authSubscription: Subscription | null = null;
  private usernameSubscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private serverConnectionSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private languageService: LanguageService,
    private dialog: MatDialog,
    private logger: LoggerService,
    private serverConnectionService: ServerConnectionService,
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
      this.loadUserEmail();
    });

    // Subscribe to language changes
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(language => {
      this.currentLanguage = language;
    });

    // Subscribe to server connection status
    this.serverConnectionSubscription = this.serverConnectionService.connectionStatus$.subscribe(
      status => {
        this.serverConnectionStatus = status;
      },
    );
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

    if (this.serverConnectionSubscription) {
      this.serverConnectionSubscription.unsubscribe();
    }
  }

  updateHomeLink(): void {
    this.homeLink = this.isAuthenticated ? '/tm' : '/';
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

  private loadUserEmail(): void {
    const userProfile = localStorage.getItem('user_profile');
    if (userProfile) {
      try {
        const profile = JSON.parse(userProfile) as { email?: string };
        this.userEmail = profile.email || '';
      } catch (e) {
        this.logger.error('Error parsing user profile:', e);
        this.userEmail = '';
      }
    }
  }

  openUserPreferences(): void {
    this.dialog.open(UserPreferencesDialogComponent, {
      width: '400px',
      disableClose: false,
    });
  }

  /**
   * Get the appropriate Material icon for the current server connection status
   */
  getServerStatusIcon(): string {
    switch (this.serverConnectionStatus) {
      case ServerConnectionStatus.NOT_CONFIGURED:
        return 'cloud';
      case ServerConnectionStatus.ERROR:
        return 'cloud_off';
      case ServerConnectionStatus.CONNECTED:
        return 'cloud_done';
      default:
        return 'cloud';
    }
  }

  /**
   * Get the appropriate CSS class for the server connection status icon
   */
  getServerStatusIconClass(): string {
    switch (this.serverConnectionStatus) {
      case ServerConnectionStatus.NOT_CONFIGURED:
        return 'server-status-not-configured';
      case ServerConnectionStatus.ERROR:
        return 'server-status-error';
      case ServerConnectionStatus.CONNECTED:
        return 'server-status-connected';
      default:
        return 'server-status-not-configured';
    }
  }

  /**
   * Get the appropriate localization key for the server connection status tooltip
   */
  getServerStatusTooltipKey(): string {
    switch (this.serverConnectionStatus) {
      case ServerConnectionStatus.NOT_CONFIGURED:
        return 'navbar.serverStatus.noServerConfigured';
      case ServerConnectionStatus.ERROR:
        return 'navbar.serverStatus.serverConnectionError';
      case ServerConnectionStatus.CONNECTED:
        return 'navbar.serverStatus.serverConnected';
      default:
        return 'navbar.serverStatus.noServerConfigured';
    }
  }
}
