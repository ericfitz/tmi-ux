import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';

import { ShareWithApplicationRemediationComponent } from './share-with-application-remediation.component';
import { LoggerService } from '@app/core/services/logger.service';
import type { AccessRemediation } from '@app/core/models/content-provider.types';

const VALID_REMEDIATION: AccessRemediation = {
  action: 'share_with_application',
  params: {
    drive_id: 'b!abc',
    item_id: '01XYZ',
    app_object_id: 'app-guid',
    graph_call: 'POST https://graph.microsoft.com/v1.0/drives/b!abc/items/01XYZ/permissions',
    graph_body:
      '{"roles":["read"],"grantedToIdentities":[{"application":{"id":"app-guid","displayName":"TMI"}}]}',
  },
};

describe('ShareWithApplicationRemediationComponent', () => {
  let mockClip: { copy: ReturnType<typeof vi.fn> };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTransloco: { translate: ReturnType<typeof vi.fn> };
  let mockLogger: { warn: ReturnType<typeof vi.fn> };

  function createComponent(
    remediation: AccessRemediation,
  ): ShareWithApplicationRemediationComponent {
    const c = new ShareWithApplicationRemediationComponent(
      mockClip as unknown as Clipboard,
      mockSnack as unknown as MatSnackBar,
      mockTransloco as unknown as TranslocoService,
      mockLogger as unknown as LoggerService,
    );
    c.remediation = remediation;
    c.ngOnChanges();
    return c;
  }

  beforeEach(() => {
    mockClip = { copy: vi.fn(() => true) };
    mockSnack = { open: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) };
    mockLogger = { warn: vi.fn() };
  });

  it('builds all three snippets when params are complete', () => {
    const c = createComponent(VALID_REMEDIATION);
    expect(c.params).not.toBeNull();
    expect(c.rawSnippet).toContain('POST https://graph.microsoft.com');
    expect(c.powershellSnippet).toContain('Invoke-MgGraphRequest `');
    expect(c.curlSnippet).toContain('curl -X POST');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('renders fallback (params null) and warns when params are missing', () => {
    const c = createComponent({
      action: 'share_with_application',
      params: { drive_id: 'b!abc' },
    });
    expect(c.params).toBeNull();
    expect(c.rawSnippet).toBe('');
    expect(c.powershellSnippet).toBe('');
    expect(c.curlSnippet).toBe('');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('copy() invokes Clipboard with the snippet and shows success snackbar', () => {
    const c = createComponent(VALID_REMEDIATION);
    c.copy(c.rawSnippet);
    expect(mockClip.copy).toHaveBeenCalledWith(c.rawSnippet);
    expect(mockSnack.open).toHaveBeenCalledWith(
      'documentAccess.remediation.shareWithApplication.copied',
      undefined,
      { duration: 2000 },
    );
  });

  it('copy() shows failure snackbar when Clipboard.copy returns false', () => {
    mockClip.copy.mockReturnValue(false);
    const c = createComponent(VALID_REMEDIATION);
    c.copy(c.rawSnippet);
    expect(mockSnack.open).toHaveBeenCalledWith(
      'documentAccess.remediation.shareWithApplication.copyFailed',
      undefined,
      { duration: 2000 },
    );
  });
});
