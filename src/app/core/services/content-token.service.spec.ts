// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { of, firstValueFrom, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ContentTokenService, buildContentAuthorizeErrorMessage } from './content-token.service';
import type { ApiService } from './api.service';
import type { LoggerService } from './logger.service';
import type { TranslocoService } from '@jsverse/transloco';
import {
  ContentTokenProviderNotConfiguredError,
  type ContentProviderId,
  type ContentTokenInfo,
} from '../models/content-provider.types';

describe('ContentTokenService', () => {
  let svc: ContentTokenService;
  let mockApi: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    svc = new ContentTokenService(
      mockApi as unknown as ApiService,
      mockLogger as unknown as LoggerService,
    );
  });

  it('list() GETs /me/content_tokens and unwraps content_tokens', async () => {
    const tokens: ContentTokenInfo[] = [
      {
        provider_id: 'google_workspace',
        status: 'active',
        scopes: [],
        created_at: '2026-04-26T00:00:00Z',
      },
    ];
    mockApi.get.mockReturnValue(of({ content_tokens: tokens }));

    const result = await firstValueFrom(svc.list());

    expect(mockApi.get).toHaveBeenCalledWith('me/content_tokens');
    expect(result).toEqual(tokens);
  });

  it('authorize() POSTs to /me/content_tokens/{id}/authorize with client_callback', async () => {
    mockApi.post.mockReturnValue(of({ authorization_url: 'https://x', expires_at: '...' }));

    await firstValueFrom(svc.authorize('google_workspace', '/dashboard'));

    expect(mockApi.post).toHaveBeenCalledWith(
      'me/content_tokens/google_workspace/authorize',
      expect.objectContaining({
        client_callback: expect.stringContaining('/oauth2/content-callback?return_to='),
      }),
    );
    const callArg = mockApi.post.mock.calls[0][1] as { client_callback: string };
    expect(callArg.client_callback).toContain(encodeURIComponent('/dashboard'));
  });

  it('authorize() translates 422 content_token_provider_not_configured into typed error', async () => {
    mockApi.post.mockReturnValue(
      throwError(() => ({
        status: 422,
        error: { error: 'content_token_provider_not_configured', provider_id: 'google_workspace' },
      })),
    );

    await expect(
      firstValueFrom(svc.authorize('google_workspace', '/dashboard')),
    ).rejects.toBeInstanceOf(ContentTokenProviderNotConfiguredError);
  });

  it('authorize() rethrows unrelated errors unchanged', async () => {
    const httpErr = { status: 500, error: { error: 'internal' } };
    mockApi.post.mockReturnValue(throwError(() => httpErr));

    await expect(firstValueFrom(svc.authorize('google_workspace', '/dashboard'))).rejects.toBe(
      httpErr,
    );
  });

  it('unlink() DELETEs /me/content_tokens/{id}', async () => {
    mockApi.delete.mockReturnValue(of(undefined));
    await firstValueFrom(svc.unlink('google_workspace'));
    expect(mockApi.delete).toHaveBeenCalledWith('me/content_tokens/google_workspace');
  });

  it('contentTokens$ caches results until refresh()', async () => {
    mockApi.get.mockReturnValue(of({ content_tokens: [] }));
    await firstValueFrom(svc.contentTokens$);
    await firstValueFrom(svc.contentTokens$);
    expect(mockApi.get).toHaveBeenCalledTimes(1);

    svc.refresh();
    await firstValueFrom(svc.contentTokens$);
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it('unlink() invalidates the cache', async () => {
    mockApi.get.mockReturnValue(of({ content_tokens: [] }));
    mockApi.delete.mockReturnValue(of(undefined));
    await firstValueFrom(svc.contentTokens$);
    expect(mockApi.get).toHaveBeenCalledTimes(1);

    await firstValueFrom(svc.unlink('google_workspace'));
    await firstValueFrom(svc.contentTokens$);

    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });
});

describe('buildContentAuthorizeErrorMessage', () => {
  let mockTransloco: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockTransloco = {
      translate: vi.fn((key: string) =>
        key === 'documentSources.googleDrive.name' ? 'Google Drive' : key,
      ),
    };
  });

  it('returns the notConfigured key when err is ContentTokenProviderNotConfiguredError', () => {
    const msg = buildContentAuthorizeErrorMessage(
      new ContentTokenProviderNotConfiguredError('google_workspace'),
      'google_workspace',
      mockTransloco as unknown as TranslocoService,
    );
    expect(msg).toBe('documentSources.callback.notConfigured');
    expect(mockTransloco.translate).toHaveBeenCalledWith('documentSources.callback.notConfigured', {
      source: 'Google Drive',
    });
  });

  it('returns the generic error key for other errors', () => {
    const msg = buildContentAuthorizeErrorMessage(
      new Error('boom'),
      'google_workspace',
      mockTransloco as unknown as TranslocoService,
    );
    expect(msg).toBe('documentSources.callback.error');
    expect(mockTransloco.translate).toHaveBeenCalledWith('documentSources.callback.error', {
      source: 'Google Drive',
      reason: '',
    });
  });

  it('falls back to raw provider id when registry has no entry', () => {
    buildContentAuthorizeErrorMessage(
      new ContentTokenProviderNotConfiguredError('confluence' as unknown as ContentProviderId),
      'confluence' as unknown as ContentProviderId,
      mockTransloco as unknown as TranslocoService,
    );
    expect(mockTransloco.translate).toHaveBeenCalledWith('documentSources.callback.notConfigured', {
      source: 'confluence',
    });
  });
});
