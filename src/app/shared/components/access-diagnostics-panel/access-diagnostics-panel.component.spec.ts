import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';

import { AccessDiagnosticsPanelComponent } from './access-diagnostics-panel.component';
import type { Document } from '../../../pages/tm/models/threat-model.model';

describe('AccessDiagnosticsPanelComponent', () => {
  let mockTransloco: { translate: ReturnType<typeof vi.fn> };

  function createComponent(doc: Document): AccessDiagnosticsPanelComponent {
    const component = new AccessDiagnosticsPanelComponent(
      mockTransloco as unknown as TranslocoService,
    );
    component.document = doc;
    return component;
  }

  beforeEach(() => {
    mockTransloco = { translate: vi.fn((key: string) => key) };
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

  it('translates the source name from a remediation provider_id when building the message', () => {
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
    expect(c.message).toBe('documentAccess.reason.tokenNotLinked');
    expect(mockTransloco.translate).toHaveBeenCalledWith('documentSources.googleDrive.name');
    expect(mockTransloco.translate).toHaveBeenCalledWith('documentAccess.reason.tokenNotLinked', {
      source: 'documentSources.googleDrive.name',
    });
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
});
