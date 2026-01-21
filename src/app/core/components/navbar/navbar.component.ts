import {
  Component,
  OnInit,
  OnDestroy,
  isDevMode,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';

// Import the shared constants
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

// Services
import { AuthService } from '../../../auth/services/auth.service';
import { LanguageService, Language } from '../../../i18n/language.service';
import { LoggerService } from '../../services/logger.service';
import {
  ServerConnectionService,
  ServerConnectionStatus,
} from '../../services/server-connection.service';
import { WebSocketAdapter, WebSocketState } from '../../services/websocket.adapter';
import { DfdCollaborationService } from '../../services/dfd-collaboration.service';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';

import { UserPreferencesDialogComponent } from '../user-preferences-dialog/user-preferences-dialog.component';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
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

  // WebSocket connection status
  webSocketState: WebSocketState = WebSocketState.DISCONNECTED;
  showWebSocketStatus = false; // Only show when in a collaboration session AND on DFD page
  isOnDfdPage = false;

  // Menu trigger reference
  @ViewChild('userProfileMenuTrigger', { read: MatMenuTrigger })
  userProfileMenuTrigger!: MatMenuTrigger;

  // Context menu position
  contextMenuPosition = { x: '0px', y: '0px' };

  // Subscriptions
  private authSubscription: Subscription | null = null;
  private usernameSubscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private serverConnectionSubscription: Subscription | null = null;
  private webSocketConnectionSubscription: Subscription | null = null;
  private routerSubscription: Subscription | null = null;
  private collaborationSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private languageService: LanguageService,
    private dialog: MatDialog,
    private logger: LoggerService,
    private serverConnectionService: ServerConnectionService,
    private webSocketAdapter: WebSocketAdapter,
    private collaborationService: DfdCollaborationService,
    private translocoService: TranslocoService,
    private cdr: ChangeDetectorRef,
  ) {
    // Get available languages
    this.languages = this.languageService.getAvailableLanguages();
  }

  ngOnInit(): void {
    // Initialize current page state
    this.isOnDfdPage = this.router.url.includes('/dfd');

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

    // Subscribe to WebSocket connection status changes
    this.webSocketConnectionSubscription = this.webSocketAdapter.connectionState$.subscribe(
      state => {
        this.webSocketState = state;
      },
    );

    // Subscribe to router navigation events to track current page
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.isOnDfdPage = event.urlAfterRedirects.includes('/dfd');
        this.updateWebSocketStatusVisibility();
      });

    // Subscribe to collaboration state to show/hide WebSocket indicator
    this.collaborationSubscription = this.collaborationService.collaborationState$.subscribe(
      _state => {
        this.updateWebSocketStatusVisibility();
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

    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    if (this.collaborationSubscription) {
      this.collaborationSubscription.unsubscribe();
    }
  }

  /**
   * Update websocket status visibility based on current page and collaboration state
   */
  private updateWebSocketStatusVisibility(): void {
    const collaborationState = this.collaborationService.getCurrentState();
    this.showWebSocketStatus = this.isOnDfdPage && collaborationState.isActive;
  }

  updateHomeLink(): void {
    this.homeLink = this.isAuthenticated ? '/dashboard' : '/';
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
    // Use auth service's userEmail getter instead of parsing localStorage directly
    // The auth service handles encrypted user profiles properly
    this.userEmail = this.authService.userEmail;
  }

  openUserPreferences(): void {
    this.dialog.open(UserPreferencesDialogComponent, {
      width: '800px',
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

    // Set the position of the context menu to where the user right-clicked
    this.contextMenuPosition = {
      x: `${event.clientX}px`,
      y: `${event.clientY}px`,
    };

    // Force change detection to update the position
    this.cdr.detectChanges();

    // Open the context menu
    this.userProfileMenuTrigger.openMenu();
  }

  /**
   * Copy user email to clipboard
   */
  copyUserEmailToClipboard(): void {
    try {
      const userEmail = this.authService.userEmail || '';

      if (!userEmail) {
        this.logger.warn('No user email available to copy');
        return;
      }

      // Copy email as plain string to clipboard
      void navigator.clipboard.writeText(userEmail);
      this.logger.info('User email copied to clipboard', { email: userEmail });
    } catch (error) {
      this.logger.error('Error copying user email to clipboard', error);
    }
  }

  /**
   * Get the appropriate Material icon for the current server connection status
   */
  getServerStatusIcon(): string {
    switch (this.serverConnectionStatus) {
      case ServerConnectionStatus.NOT_CONFIGURED:
        return 'cloud';
      case ServerConnectionStatus.OFFLINE:
      case ServerConnectionStatus.ERROR:
        return 'cloud_off';
      case ServerConnectionStatus.DEGRADED:
        return 'cloud_alert';
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
      case ServerConnectionStatus.OFFLINE:
        return 'server-status-offline';
      case ServerConnectionStatus.DEGRADED:
        return 'server-status-degraded';
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
      case ServerConnectionStatus.OFFLINE:
      case ServerConnectionStatus.DEGRADED:
      case ServerConnectionStatus.ERROR:
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
      case ServerConnectionStatus.OFFLINE:
        return 'navbar.serverStatus.serverOffline';
      case ServerConnectionStatus.DEGRADED:
        return 'navbar.serverStatus.serverDegraded';
      case ServerConnectionStatus.ERROR:
        return 'navbar.serverStatus.serverError';
      case ServerConnectionStatus.CONNECTED:
        return 'navbar.serverStatus.serverConnected';
      default:
        return 'navbar.serverStatus.noServerConfigured';
    }
  }

  /**
   * Get the appropriate Material icon for the WebSocket connection status
   */
  getWebSocketStatusIcon(): string {
    if (this.webSocketAdapter.isConnected) {
      return 'sensors';
    } else {
      return 'sensors_off';
    }
  }

  /**
   * Get the appropriate CSS class for the WebSocket connection status icon
   */
  getWebSocketStatusIconClass(): string {
    if (this.webSocketAdapter.isConnected) {
      return 'websocket-status-connected';
    } else {
      return 'websocket-status-error';
    }
  }

  /**
   * Get the appropriate tooltip text for the WebSocket connection status
   */
  getWebSocketStatusTooltip(): string {
    let statusText: string;
    if (this.webSocketAdapter.isConnected) {
      statusText = this.translocoService.translate('collaboration.websocketStatus.connected');
    } else {
      statusText = this.translocoService.translate('collaboration.websocketStatus.notConnected');
    }

    // Get the actual WebSocket URL from the collaboration service
    const wsUrl = this.collaborationService.currentWebSocketUrl || 'WebSocket URL: (unavailable)';

    return `${statusText}\n${wsUrl}`;
  }

  /**
   * Open the server URL in a new browser window
   */
  openServerUrl(): void {
    if (this.serverConnectionStatus === ServerConnectionStatus.CONNECTED) {
      window.open(environment.apiUrl, '_blank');
    }
  }

  /**
   * Open the feedback URL in a new browser window
   */
  openFeedbackUrl(): void {
    window.open('https://github.com/ericfitz/tmi-ux/issues/new', '_blank');
  }
}
