import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import type { Injector } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { AccessDiagnosticsPanelComponent } from './access-diagnostics-panel.component';
import { ContentTokenService } from '../../../core/services/content-token.service';
import type { Document } from '../../../pages/tm/models/threat-model.model';

describe('AccessDiagnosticsPanelComponent', () => {
  let mockClip: { copy: ReturnType<typeof vi.fn> };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTokens: { authorize: ReturnType<typeof vi.fn> };
  let mockRouter: { url: string };
  let mockTransloco: {
    translate: ReturnType<typeof vi.fn>;
    selectTranslate: ReturnType<typeof vi.fn>;
  };
  let mockInjector: { get: ReturnType<typeof vi.fn> };

  function createComponent(doc: Document): AccessDiagnosticsPanelComponent {
    const component = new AccessDiagnosticsPanelComponent(
      mockInjector as unknown as Injector,
      mockTransloco as unknown as TranslocoService,
      mockClip as unknown as Clipboard,
      mockSnack as unknown as MatSnackBar,
      mockTokens as unknown as ContentTokenService,
      mockRouter as unknown as Router,
    );
    component.document = doc;
    return component;
  }

  beforeEach(() => {
    mockClip = { copy: vi.fn(() => true) };
    mockSnack = { open: vi.fn() };
    mockTokens = { authorize: vi.fn().mockReturnValue(of({ authorization_url: 'https://x' })) };
    mockRouter = { url: '/tm/abc' };
    mockTransloco = {
      translate: vi.fn((key: string) => key),
      selectTranslate: vi.fn((key: string) => of(key)),
    };
    mockInjector = { get: vi.fn() };
  });

  it('returns empty message when access_diagnostics is missing', () => {
    const c = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'accessible',
    });
    expect(c.message).toBe('');
  });

  it('renders translated message for known reason_code', () => {
    const c = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'auth_required',
      access_diagnostics: { reason_code: 'token_not_linked', remediations: [] },
    });
    expect(c.message).toBe('documentAccess.reason.tokenNotLinked');
  });

  it('falls back to documentAccess.reason.fallback for unknown reason_code', () => {
    const c = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: {
        reason_code: 'totally_new_code' as never,
        remediations: [],
      },
    });
    expect(c.message).toBe('documentAccess.reason.fallback');
  });

  it('returns reason_detail verbatim when reason_code is "other"', () => {
    const c = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: {
        reason_code: 'other',
        reason_detail: 'Something specific went wrong',
        remediations: [],
      },
    });
    expect(c.message).toBe('Something specific went wrong');
  });

  it('share_with_service_account remediation copies email and shows snackbar', () => {
    const c = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: {
        reason_code: 'no_accessible_source',
        remediations: [
          {
            action: 'share_with_service_account',
            params: { service_account_email: 'svc@x.iam.gserviceaccount.com' },
          },
        ],
      },
    });
    c.handleRemediation({
      action: 'share_with_service_account',
      params: { service_account_email: 'svc@x.iam.gserviceaccount.com' },
    });
    expect(mockClip.copy).toHaveBeenCalledWith('svc@x.iam.gserviceaccount.com');
    expect(mockSnack.open).toHaveBeenCalled();
  });

  it('showCheckNow is true only when document is pending_access', () => {
    const pending = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: {
        reason_code: 'microsoft_not_shared',
        remediations: [
          {
            action: 'share_with_application',
            params: {
              drive_id: 'b!abc',
              item_id: '01XYZ',
              app_object_id: 'app-guid',
              graph_call: 'POST https://graph.microsoft.com/v1.0/foo',
              graph_body: '{}',
            },
          },
        ],
      },
    });
    expect(pending.showCheckNow).toBe(true);

    const accessible = createComponent({
      id: '2',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'accessible',
    });
    expect(accessible.showCheckNow).toBe(false);
  });

  it('onCheckNow emits the recheck Output', () => {
    const c = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: { reason_code: 'microsoft_not_shared', remediations: [] },
    });
    const emitted = vi.fn();
    c.recheck.subscribe(emitted);
    c.onCheckNow();
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('link_account remediation calls authorize with current url as return_to', () => {
    const c = createComponent({
      id: '1',
      name: 'd',
      uri: 'u',
      created_at: '',
      modified_at: '',
      access_status: 'auth_required',
      access_diagnostics: {
        reason_code: 'token_not_linked',
        remediations: [{ action: 'link_account', params: { provider_id: 'google_workspace' } }],
      },
    });
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' },
    });
    try {
      c.handleRemediation({
        action: 'link_account',
        params: { provider_id: 'google_workspace' },
      });
      expect(mockTokens.authorize).toHaveBeenCalledWith('google_workspace', '/tm/abc');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });
});
