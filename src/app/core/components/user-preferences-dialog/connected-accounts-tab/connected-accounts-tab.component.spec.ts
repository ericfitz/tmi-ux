import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ConnectedAccountsTabComponent } from './connected-accounts-tab.component';
import { ContentTokenService } from '../../../services/content-token.service';
import { LoggerService } from '../../../services/logger.service';
import type { ContentTokenInfo } from '../../../models/content-provider.types';

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

  function createComponent(): ConnectedAccountsTabComponent {
    return new ConnectedAccountsTabComponent(
      mockTokenSvc as unknown as ContentTokenService,
      mockTransloco as unknown as TranslocoService,
      mockDialog as unknown as MatDialog,
      mockSnack as unknown as MatSnackBar,
      mockLogger as unknown as LoggerService,
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
  });

  it('initializes by calling refresh on the token service', () => {
    const component = createComponent();
    component.ngOnInit();
    expect(mockTokenSvc.refresh).toHaveBeenCalled();
  });

  it('connectableProviders includes google_workspace', () => {
    const component = createComponent();
    expect(component.connectableProviders.some(p => p.id === 'google_workspace')).toBe(true);
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
