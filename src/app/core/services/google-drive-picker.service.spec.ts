import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';

import { GoogleDrivePickerService } from './google-drive-picker.service';
import type { PickerTokenService } from './picker-token.service';
import type { LoggerService } from './logger.service';
import {
  ContentTokenNotLinkedError,
  PickerAlreadyOpenError,
} from '../models/content-provider.types';
import * as loader from '../../shared/utils/lazy-script-loader';

interface PickerCallbackData {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string; url: string }>;
}

describe('GoogleDrivePickerService', () => {
  let svc: GoogleDrivePickerService;
  let mockTokenSvc: { mint: ReturnType<typeof vi.fn> };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let pickerCallback: ((d: PickerCallbackData) => void) | null = null;

  beforeEach(() => {
    vi.spyOn(loader, 'loadScriptOnce').mockResolvedValue();
    pickerCallback = null;

    function createDocsView(): unknown {
      const view = {
        setIncludeFolders: vi.fn(() => view),
        setMimeTypes: vi.fn(() => view),
      };
      return view;
    }

    function createBuilder(): unknown {
      const builder: Record<string, unknown> = {};
      builder['setOAuthToken'] = vi.fn(() => builder);
      builder['setDeveloperKey'] = vi.fn(() => builder);
      builder['setAppId'] = vi.fn(() => builder);
      builder['addView'] = vi.fn(() => builder);
      builder['setCallback'] = vi.fn((cb: (d: PickerCallbackData) => void) => {
        pickerCallback = cb;
        return builder;
      });
      builder['build'] = vi.fn(() => ({ setVisible: vi.fn() }));
      return builder;
    }

    (globalThis as unknown as { gapi: unknown }).gapi = {
      load: (_module: string, opts: { callback: () => void }): void => opts.callback(),
    };
    (globalThis as unknown as { google: unknown }).google = {
      picker: {
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
        DocsView: vi.fn().mockImplementation(createDocsView),
        PickerBuilder: vi.fn().mockImplementation(createBuilder),
      },
    };

    mockTokenSvc = { mint: vi.fn() };
    mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    svc = new GoogleDrivePickerService(
      mockTokenSvc as unknown as PickerTokenService,
      mockLogger as unknown as LoggerService,
    );
  });

  afterEach(() => {
    delete (globalThis as Partial<{ gapi: unknown; google: unknown }>).gapi;
    delete (globalThis as Partial<{ gapi: unknown; google: unknown }>).google;
    vi.restoreAllMocks();
  });

  function fireCallback(data: PickerCallbackData): void {
    if (!pickerCallback) throw new Error('callback not set');
    pickerCallback(data);
  }

  it('pick() emits {kind: "picked"} on Picker selection', async () => {
    mockTokenSvc.mint.mockReturnValue(
      of({
        access_token: 'ya29.x',
        expires_at: '2026-04-26T01:00:00Z',
        developer_key: 'k',
        app_id: 'a',
      }),
    );

    const promise = firstValueFrom(svc.pick());
    await new Promise(r => setTimeout(r));
    fireCallback({
      action: 'picked',
      docs: [
        {
          id: '1abc',
          name: 'My doc.pdf',
          mimeType: 'application/pdf',
          url: 'https://drive.google.com/file/d/1abc',
        },
      ],
    });

    await expect(promise).resolves.toEqual({
      kind: 'picked',
      file: {
        fileId: '1abc',
        name: 'My doc.pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/1abc',
      },
    });
  });

  it('pick() emits {kind: "cancelled"} on cancel', async () => {
    mockTokenSvc.mint.mockReturnValue(
      of({ access_token: 't', expires_at: '...', developer_key: 'k', app_id: 'a' }),
    );

    const promise = firstValueFrom(svc.pick());
    await new Promise(r => setTimeout(r));
    fireCallback({ action: 'cancel' });

    await expect(promise).resolves.toEqual({ kind: 'cancelled' });
  });

  it('pick() while another is open rejects with PickerAlreadyOpenError', async () => {
    mockTokenSvc.mint.mockReturnValue(
      of({ access_token: 't', expires_at: '...', developer_key: 'k', app_id: 'a' }),
    );

    const first = firstValueFrom(svc.pick());
    await new Promise(r => setTimeout(r));
    await expect(firstValueFrom(svc.pick())).rejects.toThrow(PickerAlreadyOpenError);
    fireCallback({ action: 'cancel' });
    await first;
  });

  it('pick() surfaces ContentTokenNotLinkedError when picker token mint 404s', async () => {
    mockTokenSvc.mint.mockReturnValue(
      throwError(() => new ContentTokenNotLinkedError('google_workspace')),
    );
    await expect(firstValueFrom(svc.pick())).rejects.toThrow(ContentTokenNotLinkedError);
  });
});
