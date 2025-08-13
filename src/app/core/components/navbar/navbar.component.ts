import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, isDevMode, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';

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
import { WebSocketAdapter } from '../../../pages/dfd/infrastructure/adapters/websocket.adapter';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';

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

  // Menu trigger reference
  @ViewChild('userProfileButton', { read: MatMenuTrigger }) userProfileMenuTrigger!: MatMenuTrigger;

  // Subscriptions
  private authSubscription: Subscription | null = null;
  private usernameSubscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private serverConnectionSubscription: Subscription | null = null;
  private webSocketConnectionSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private languageService: LanguageService,
    private dialog: MatDialog,
    private logger: LoggerService,
    private serverConnectionService: ServerConnectionService,
    private webSocketAdapter: WebSocketAdapter,
    private translocoService: TranslocoService,
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

    // Subscribe to WebSocket connection status changes to trigger tooltip updates
    this.webSocketConnectionSubscription = this.webSocketAdapter.connectionState$.subscribe(
      () => {
        // This subscription triggers change detection when WebSocket state changes
        // The tooltip will be updated automatically through Angular's change detection
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

    if (this.webSocketConnectionSubscription) {
      this.webSocketConnectionSubscription.unsubscribe();
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
   * Handle right-click context menu on user profile button (development only)
   */
  openUserProfileContextMenu(event: MouseEvent): void {
    if (!this.isDevelopmentMode) {
      return; // Do nothing in production
    }
    
    event.preventDefault(); // Prevent default browser context menu
    this.userProfileMenuTrigger.openMenu(); // Open the context menu
  }

  /**
   * Copy user profile to clipboard
   */
  copyUserProfileToClipboard(): void {
    try {
      // Serialize user profile data
      const userProfile = this.serializeUserProfile();
      
      // Copy to clipboard
      void navigator.clipboard.writeText(JSON.stringify(userProfile, null, 2));
    } catch (error) {
      this.logger.error('Error copying user profile to clipboard', error);
    }
  }

  /**
   * Serialize current user profile data
   */
  private serializeUserProfile(): Record<string, unknown> {
    // Get user profile from localStorage
    const storedProfile = localStorage.getItem('user_profile');
    let userProfile: Record<string, unknown> = {};
    
    if (storedProfile) {
      try {
        userProfile = JSON.parse(storedProfile) as Record<string, unknown>;
      } catch (error) {
        this.logger.warn('Error parsing stored user profile', error);
      }
    }

    // Create comprehensive user profile object
    return {
      // Authentication state
      isAuthenticated: this.isAuthenticated,
      username: this.username,
      userEmail: this.userEmail,
      
      // Stored profile data
      storedProfile: userProfile,
      
      // Current session info
      currentLanguage: this.currentLanguage,
      isDevelopmentMode: this.isDevelopmentMode,
      
      // Timestamp
      exportedAt: new Date().toISOString(),
      
      // Environment info
      environment: {
        production: environment.production
      }
    };
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
   * Get the appropriate tooltip text for the server connection status with additional details
   */
  getServerStatusTooltip(): string {
    const baseKey = this.getServerStatusTooltipKey();
    const baseText = this.translocoService.translate(baseKey);
    
    switch (this.serverConnectionStatus) {
      case ServerConnectionStatus.NOT_CONFIGURED:
        return baseText;
      case ServerConnectionStatus.ERROR:
        return `${baseText}\n${environment.apiUrl}`;
      case ServerConnectionStatus.CONNECTED:
        return `${baseText}\n${environment.apiUrl}`;
      default:
        return baseText;
    }
  }

  /**
   * Get the appropriate localization key for the server connection status tooltip
   */
  private getServerStatusTooltipKey(): string {
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
