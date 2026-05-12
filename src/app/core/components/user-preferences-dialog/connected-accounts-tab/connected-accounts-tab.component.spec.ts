import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ConnectedAccountsTabComponent } from './connected-accounts-tab.component';
import { ContentTokenService } from '../../../services/content-token.service';
import { LoggerService } from '../../../services/logger.service';
import {
  ContentProvidersService,
  type SelectableSource,
} from '../../../services/content-providers.service';
import {
  ContentTokenProviderNotConfiguredError,
  type ContentTokenInfo,
} from '../../../models/content-provider.types';

describe('ConnectedAccountsTabComponent', () => {
  let tokens$: BehaviorSubject<ContentTokenInfo[]>;
  let mockTokenSvc: {
    contentTokens$: BehaviorSubject<ContentTokenInfo[]>;
    refresh: ReturnType<typeof vi.fn>;
    authorize: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTransloco: {
    translate: ReturnType<typeof vi.fn>;
    selectTranslate: ReturnType<typeof vi.fn>;
  };
  let mockLogger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let sources$: BehaviorSubject<SelectableSource[]>;
  let mockContentProviders: { selectableSources$: BehaviorSubject<SelectableSource[]> };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  /** Default sources: server advertises only delegated google_workspace. */
  const DEFAULT_SOURCES: SelectableSource[] = [
    {
      id: 'google_workspace',
      displayName: 'Google Workspace',
      displayNameKey: 'documentSources.googleDrive.name',
      icon: 'fa-brands fa-google',
      kind: 'delegated',
      hasPicker: true,
    },
  ];

  function createComponent(): ConnectedAccountsTabComponent {
    return new ConnectedAccountsTabComponent(
      mockTokenSvc as unknown as ContentTokenService,
      mockTransloco as unknown as TranslocoService,
      mockDialog as unknown as MatDialog,
      mockSnack as unknown as MatSnackBar,
      mockLogger as unknown as LoggerService,
      mockContentProviders as unknown as ContentProvidersService,
      mockCdr as unknown as ChangeDetectorRef,
    );
  }

  beforeEach(() => {
    tokens$ = new BehaviorSubject<ContentTokenInfo[]>([]);
    mockTokenSvc = {
      contentTokens$: tokens$,
      refresh: vi.fn(),
      authorize: vi.fn(),
      unlink: vi.fn().mockReturnValue(of(undefined)),
    };
    mockDialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
    mockSnack = { open: vi.fn() };
    mockTransloco = {
      translate: vi.fn().mockReturnValue('Google Drive'),
      selectTranslate: vi.fn().mockReturnValue(of('Google Drive')),
    };
    mockLogger = { info: vi.fn(), error: vi.fn() };
    sources$ = new BehaviorSubject<SelectableSource[]>(DEFAULT_SOURCES);
    mockContentProviders = { selectableSources$: sources$ };
    mockCdr = { markForCheck: vi.fn() };
  });

  it('initializes by calling refresh on the token service', () => {
    const component = createComponent();
    component.ngOnInit();
    expect(mockTokenSvc.refresh).toHaveBeenCalled();
  });

  it('connectableProviders includes server-advertised delegated providers after ngOnInit', () => {
    const component = createComponent();
    component.ngOnInit();
    expect(component.connectableProviders.some(p => p.id === 'google_workspace')).toBe(true);
  });

  it('connectableProviders excludes service-mode providers (e.g. google_drive)', () => {
    sources$.next([
      ...DEFAULT_SOURCES,
      {
        id: 'google_drive',
        displayName: 'Google Drive',
        displayNameKey: 'documentSources.googleDrive.name',
        icon: 'fa-brands fa-google-drive',
        kind: 'service',
        hasPicker: true,
      },
    ]);
    const component = createComponent();
    component.ngOnInit();
    expect(component.connectableProviders.some(p => p.id === 'google_drive')).toBe(false);
    expect(component.connectableProviders.some(p => p.id === 'google_workspace')).toBe(true);
  });

  it('connectableProviders includes both google_workspace and microsoft when server advertises both', () => {
    sources$.next([
      ...DEFAULT_SOURCES,
      {
        id: 'microsoft',
        displayName: 'OneDrive/SharePoint',
        displayNameKey: 'documentSources.microsoft.name',
        icon: 'fa-brands fa-microsoft',
        kind: 'delegated',
        hasPicker: true,
      },
    ]);
    const component = createComponent();
    component.ngOnInit();
    expect(component.connectableProviders.some(p => p.id === 'google_workspace')).toBe(true);
    expect(component.connectableProviders.some(p => p.id === 'microsoft')).toBe(true);
  });

  it('onConnect routes Microsoft authorize call with the correct provider id', () => {
    sources$.next([
      {
        id: 'microsoft',
        displayName: 'OneDrive/SharePoint',
        displayNameKey: 'documentSources.microsoft.name',
        icon: 'fa-brands fa-microsoft',
        kind: 'delegated',
        hasPicker: true,
      },
    ]);
    mockTokenSvc.authorize.mockReturnValue(
      of({ authorization_url: 'https://auth.microsoft.com', expires_at: '...' }),
    );
    const component = createComponent();
    component.ngOnInit();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' },
    });
    try {
      component.onConnect('microsoft');
      expect(mockTokenSvc.authorize).toHaveBeenCalledWith(
        'microsoft',
        expect.stringContaining('openPrefs=document-sources'),
      );
      expect(window.location.href).toBe('https://auth.microsoft.com');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });

  it('connectableProviders is empty when server advertises no delegated providers', () => {
    sources$.next([
      {
        id: 'google_drive',
        displayName: 'Google Drive',
        displayNameKey: 'documentSources.googleDrive.name',
        icon: 'fa-brands fa-google-drive',
        kind: 'service',
        hasPicker: true,
      },
    ]);
    const component = createComponent();
    component.ngOnInit();
    expect(component.connectableProviders).toEqual([]);
  });

  it('onConnect calls authorize with returnTo pointing at the prefs deep-link', () => {
    mockTokenSvc.authorize.mockReturnValue(
      of({ authorization_url: 'https://auth.example.com', expires_at: '...' }),
    );
    const component = createComponent();
    // Replace window.location to capture the redirect attempt without
    // triggering an actual jsdom navigation.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' },
    });
    try {
      component.onConnect('google_workspace');
      expect(mockTokenSvc.authorize).toHaveBeenCalledWith(
        'google_workspace',
        expect.stringContaining('openPrefs=document-sources'),
      );
      expect(window.location.href).toBe('https://auth.example.com');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });

  it('onConnect surfaces notConfigured snackbar when provider is not configured server-side', () => {
    mockTokenSvc.authorize.mockReturnValue(
      throwError(() => new ContentTokenProviderNotConfiguredError('google_workspace')),
    );
    mockTransloco.translate.mockImplementation((key: string) =>
      key === 'documentSources.googleDrive.name' ? 'Google Drive' : key,
    );
    const component = createComponent();
    component.onConnect('google_workspace');
    expect(mockSnack.open).toHaveBeenCalledWith(
      'documentSources.callback.notConfigured',
      undefined,
      { duration: 6000 },
    );
    expect(mockTransloco.translate).toHaveBeenCalledWith(
      'documentSources.callback.notConfigured',
      expect.objectContaining({ source: 'Google Drive' }),
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('onConnect surfaces generic snackbar for other authorize errors', () => {
    mockTokenSvc.authorize.mockReturnValue(throwError(() => new Error('boom')));
    mockTransloco.translate.mockImplementation((key: string) =>
      key === 'documentSources.googleDrive.name' ? 'Google Drive' : key,
    );
    const component = createComponent();
    component.onConnect('google_workspace');
    expect(mockSnack.open).toHaveBeenCalledWith('documentSources.callback.error', undefined, {
      duration: 6000,
    });
    expect(mockTransloco.translate).toHaveBeenCalledWith(
      'documentSources.callback.error',
      expect.objectContaining({ source: 'Google Drive', reason: '' }),
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('onUnlink opens the confirm dialog and calls unlink when confirmed', () => {
    const component = createComponent();
    component.onUnlink('google_workspace');
    expect(mockDialog.open).toHaveBeenCalled();
    // afterClosed yields true → unlink should fire
    expect(mockTokenSvc.unlink).toHaveBeenCalledWith('google_workspace');
  });

  it('onUnlink does NOT call unlink when the dialog is cancelled', () => {
    mockDialog.open = vi.fn(() => ({ afterClosed: () => of(false) }));
    const component = createComponent();
    component.onUnlink('google_workspace');
    expect(mockTokenSvc.unlink).not.toHaveBeenCalled();
  });
});
