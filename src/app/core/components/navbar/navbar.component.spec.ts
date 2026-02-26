// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { NavbarComponent } from './navbar.component';
import { ServerConnectionStatus } from '../../services/server-connection.service';
import { WebSocketState } from '../../services/websocket.adapter';
import { BrandingConfigService } from '../../services/branding-config.service';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let envInjector: EnvironmentInjector;
  let mockRouter: {
    url: string;
    events: Subject<unknown>;
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    isAuthenticated$: BehaviorSubject<boolean>;
    username$: BehaviorSubject<string>;
    userProfile$: BehaviorSubject<unknown>;
    userEmail: string;
    logout: ReturnType<typeof vi.fn>;
    getLandingPage: ReturnType<typeof vi.fn>;
  };
  let mockLanguageService: {
    getAvailableLanguages: ReturnType<typeof vi.fn>;
    currentLanguage$: BehaviorSubject<{ code: string; name: string }>;
    setLanguage: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockServerConnectionService: {
    connectionStatus$: BehaviorSubject<ServerConnectionStatus>;
  };
  let mockWebSocketAdapter: {
    connectionState$: BehaviorSubject<WebSocketState>;
    isConnected: boolean;
  };
  let mockCollaborationService: {
    collaborationState$: BehaviorSubject<{ isActive: boolean }>;
    getCurrentState: ReturnType<typeof vi.fn>;
    currentWebSocketUrl: string | null;
  };
  let mockTranslocoService: {
    translate: ReturnType<typeof vi.fn>;
  };
  let mockCdr: { detectChanges: ReturnType<typeof vi.fn> };
  let mockBrandingConfigService: {
    logoImageUrl$: BehaviorSubject<string>;
    organizationName$: BehaviorSubject<string | null>;
  };

  beforeEach(() => {
    mockRouter = {
      url: '/',
      events: new Subject(),
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockAuthService = {
      isAuthenticated$: new BehaviorSubject(false),
      username$: new BehaviorSubject(''),
      userProfile$: new BehaviorSubject(null),
      userEmail: 'user@example.com',
      logout: vi.fn(),
      getLandingPage: vi.fn().mockReturnValue('/dashboard'),
    };

    mockLanguageService = {
      getAvailableLanguages: vi.fn().mockReturnValue([
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
      ]),
      currentLanguage$: new BehaviorSubject({ code: 'en', name: 'English' }),
      setLanguage: vi.fn(),
    };

    mockDialog = { open: vi.fn() };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockServerConnectionService = {
      connectionStatus$: new BehaviorSubject(ServerConnectionStatus.NOT_CONFIGURED),
    };

    mockWebSocketAdapter = {
      connectionState$: new BehaviorSubject(WebSocketState.DISCONNECTED),
      isConnected: false,
    };

    mockCollaborationService = {
      collaborationState$: new BehaviorSubject({ isActive: false }),
      getCurrentState: vi.fn().mockReturnValue({ isActive: false }),
      currentWebSocketUrl: null,
    };

    mockTranslocoService = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    mockCdr = { detectChanges: vi.fn() };

    mockBrandingConfigService = {
      logoImageUrl$: new BehaviorSubject('/TMI-FullLogo-Transparent-512x512.png'),
      organizationName$: new BehaviorSubject<string | null>(null),
    };

    // Create an environment injector that provides BrandingConfigService
    envInjector = createEnvironmentInjector(
      [{ provide: BrandingConfigService, useValue: mockBrandingConfigService }],
      // Use a minimal parent injector
      {
        get: (token: unknown) => {
          if (token === EnvironmentInjector) return envInjector;
          return undefined;
        },
      } as EnvironmentInjector,
    );

    // Create the component within the injection context so inject() works
    runInInjectionContext(envInjector, () => {
      component = new NavbarComponent(
        mockRouter as any,
        mockAuthService as any,
        mockLanguageService as any,
        mockDialog as any,
        mockLogger as any,
        mockServerConnectionService as any,
        mockWebSocketAdapter as any,
        mockCollaborationService as any,
        mockTranslocoService as any,
        mockCdr as any,
      );
    });
  });

  afterEach(() => {
    component.ngOnDestroy();
    envInjector.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load available languages on construction', () => {
    expect(component.languages).toHaveLength(2);
    expect(component.languages[0].code).toBe('en');
  });

  describe('ngOnInit', () => {
    it('should subscribe to auth state', () => {
      component.ngOnInit();

      mockAuthService.isAuthenticated$.next(true);
      expect(component.isAuthenticated).toBe(true);
    });

    it('should subscribe to username', () => {
      component.ngOnInit();

      mockAuthService.username$.next('John Doe');
      expect(component.username).toBe('John Doe');
    });

    it('should subscribe to user profile for admin flag', () => {
      component.ngOnInit();

      mockAuthService.userProfile$.next({ is_admin: true, is_security_reviewer: false });
      expect(component.isAdmin).toBe(true);
      expect(component.isSecurityReviewer).toBe(false);
    });

    it('should subscribe to user profile for security reviewer flag', () => {
      component.ngOnInit();

      mockAuthService.userProfile$.next({ is_admin: false, is_security_reviewer: true });
      expect(component.isSecurityReviewer).toBe(true);
    });

    it('should detect DFD page from initial URL', () => {
      mockRouter.url = '/threat-models/123/dfd/456';
      component.ngOnInit();

      expect(component.isOnDfdPage).toBe(true);
    });

    it('should track DFD page on navigation', () => {
      component.ngOnInit();

      mockRouter.events.next(
        new NavigationEnd(1, '/threat-models/123/dfd/456', '/threat-models/123/dfd/456'),
      );
      expect(component.isOnDfdPage).toBe(true);

      mockRouter.events.next(new NavigationEnd(2, '/dashboard', '/dashboard'));
      expect(component.isOnDfdPage).toBe(false);
    });

    it('should subscribe to server connection status', () => {
      component.ngOnInit();

      mockServerConnectionService.connectionStatus$.next(ServerConnectionStatus.CONNECTED);
      expect(component.serverConnectionStatus).toBe(ServerConnectionStatus.CONNECTED);
    });

    it('should subscribe to WebSocket state', () => {
      component.ngOnInit();

      mockWebSocketAdapter.connectionState$.next(WebSocketState.CONNECTED);
      expect(component.webSocketState).toBe(WebSocketState.CONNECTED);
    });
  });

  describe('updateHomeLink', () => {
    it('should set home link to / when not authenticated', () => {
      component.isAuthenticated = false;
      component.updateHomeLink();

      expect(component.homeLink).toBe('/');
    });

    it('should use auth service landing page when authenticated', () => {
      component.isAuthenticated = true;
      component.updateHomeLink();

      expect(component.homeLink).toBe('/dashboard');
    });
  });

  describe('logout', () => {
    it('should call auth service logout', () => {
      component.logout();

      expect(mockAuthService.logout).toHaveBeenCalled();
    });
  });

  describe('switchLanguage', () => {
    it('should set language when different from current', () => {
      component.currentLanguage = { code: 'en', name: 'English' };
      component.switchLanguage({ code: 'es', name: 'Spanish' });

      expect(mockLanguageService.setLanguage).toHaveBeenCalledWith('es');
    });

    it('should not set language when same as current', () => {
      component.currentLanguage = { code: 'en', name: 'English' };
      component.switchLanguage({ code: 'en', name: 'English' });

      expect(mockLanguageService.setLanguage).not.toHaveBeenCalled();
    });
  });

  describe('getServerStatusIcon', () => {
    it('should return cloud for NOT_CONFIGURED', () => {
      component.serverConnectionStatus = ServerConnectionStatus.NOT_CONFIGURED;
      expect(component.getServerStatusIcon()).toBe('cloud');
    });

    it('should return cloud_off for OFFLINE', () => {
      component.serverConnectionStatus = ServerConnectionStatus.OFFLINE;
      expect(component.getServerStatusIcon()).toBe('cloud_off');
    });

    it('should return cloud_off for ERROR', () => {
      component.serverConnectionStatus = ServerConnectionStatus.ERROR;
      expect(component.getServerStatusIcon()).toBe('cloud_off');
    });

    it('should return cloud_alert for DEGRADED', () => {
      component.serverConnectionStatus = ServerConnectionStatus.DEGRADED;
      expect(component.getServerStatusIcon()).toBe('cloud_alert');
    });

    it('should return cloud_done for CONNECTED', () => {
      component.serverConnectionStatus = ServerConnectionStatus.CONNECTED;
      expect(component.getServerStatusIcon()).toBe('cloud_done');
    });
  });

  describe('getServerStatusIconClass', () => {
    it('should return correct class for each status', () => {
      component.serverConnectionStatus = ServerConnectionStatus.NOT_CONFIGURED;
      expect(component.getServerStatusIconClass()).toBe('server-status-not-configured');

      component.serverConnectionStatus = ServerConnectionStatus.OFFLINE;
      expect(component.getServerStatusIconClass()).toBe('server-status-offline');

      component.serverConnectionStatus = ServerConnectionStatus.DEGRADED;
      expect(component.getServerStatusIconClass()).toBe('server-status-degraded');

      component.serverConnectionStatus = ServerConnectionStatus.ERROR;
      expect(component.getServerStatusIconClass()).toBe('server-status-error');

      component.serverConnectionStatus = ServerConnectionStatus.CONNECTED;
      expect(component.getServerStatusIconClass()).toBe('server-status-connected');
    });
  });

  describe('getServerStatusTooltip', () => {
    it('should return base text only for NOT_CONFIGURED', () => {
      component.serverConnectionStatus = ServerConnectionStatus.NOT_CONFIGURED;
      const tooltip = component.getServerStatusTooltip();

      expect(tooltip).toBe('navbar.serverStatus.noServerConfigured');
    });

    it('should append API URL for CONNECTED status', () => {
      component.serverConnectionStatus = ServerConnectionStatus.CONNECTED;
      const tooltip = component.getServerStatusTooltip();

      expect(tooltip).toContain('navbar.serverStatus.serverConnected');
      expect(tooltip).toContain('\n');
    });
  });

  describe('getWebSocketStatusIcon', () => {
    it('should return sensors when connected', () => {
      mockWebSocketAdapter.isConnected = true;
      expect(component.getWebSocketStatusIcon()).toBe('sensors');
    });

    it('should return sensors_off when disconnected', () => {
      mockWebSocketAdapter.isConnected = false;
      expect(component.getWebSocketStatusIcon()).toBe('sensors_off');
    });
  });

  describe('getWebSocketStatusIconClass', () => {
    it('should return connected class when connected', () => {
      mockWebSocketAdapter.isConnected = true;
      expect(component.getWebSocketStatusIconClass()).toBe('websocket-status-connected');
    });

    it('should return error class when disconnected', () => {
      mockWebSocketAdapter.isConnected = false;
      expect(component.getWebSocketStatusIconClass()).toBe('websocket-status-error');
    });
  });

  describe('WebSocket status visibility', () => {
    it('should show WebSocket status when on DFD page and collaborating', () => {
      component.ngOnInit();

      // Navigate to DFD page
      mockRouter.events.next(
        new NavigationEnd(1, '/threat-models/1/dfd/2', '/threat-models/1/dfd/2'),
      );

      // Start collaboration
      mockCollaborationService.getCurrentState.mockReturnValue({ isActive: true });
      mockCollaborationService.collaborationState$.next({ isActive: true });

      expect(component.showWebSocketStatus).toBe(true);
    });

    it('should hide WebSocket status when not on DFD page', () => {
      component.ngOnInit();

      mockRouter.events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

      mockCollaborationService.getCurrentState.mockReturnValue({ isActive: true });
      mockCollaborationService.collaborationState$.next({ isActive: true });

      expect(component.showWebSocketStatus).toBe(false);
    });

    it('should hide WebSocket status when not collaborating', () => {
      component.ngOnInit();

      mockRouter.events.next(
        new NavigationEnd(1, '/threat-models/1/dfd/2', '/threat-models/1/dfd/2'),
      );

      mockCollaborationService.getCurrentState.mockReturnValue({ isActive: false });
      mockCollaborationService.collaborationState$.next({ isActive: false });

      expect(component.showWebSocketStatus).toBe(false);
    });
  });

  describe('copyUserEmailToClipboard', () => {
    it('should warn when no email available', () => {
      mockAuthService.userEmail = '';
      component.copyUserEmailToClipboard();

      expect(mockLogger.warn).toHaveBeenCalledWith('No user email available to copy');
    });
  });

  describe('ngOnDestroy', () => {
    it('should clean up subscriptions without error', () => {
      component.ngOnInit();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
