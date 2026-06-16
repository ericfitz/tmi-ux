// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IdentityLinkService } from './identity-link.service';
import type { ApiService } from '@app/core/services/api.service';
import type { LoggerService } from '@app/core/services/logger.service';
import { StepUpRequiredError } from '../models/identity-link.types';

describe('IdentityLinkService', () => {
  let service: IdentityLinkService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let logger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
    logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    service = new IdentityLinkService(
      api as unknown as ApiService,
      logger as unknown as LoggerService,
    );
  });

  it('listIdentities() calls GET me/identities', async () => {
    api.get.mockReturnValue(of({ primary: { provider: 'google', email: 'a@b.com' }, linked: [] }));
    const res = await firstValueFrom(service.listIdentities());
    expect(api.get).toHaveBeenCalledWith('me/identities');
    expect(res.primary.provider).toBe('google');
  });

  it('startLink() passes idp and the link callback URL', async () => {
    api.get.mockReturnValue(
      of({ link_state: 's', authorization_url: 'https://idp', expires_at: 'x' }),
    );
    await firstValueFrom(service.startLink('github'));
    expect(api.get).toHaveBeenCalledWith(
      'me/identities/link/start',
      expect.objectContaining({
        idp: 'github',
        client_callback: `${window.location.origin}/oauth2/link/callback`,
      }),
    );
  });

  it('getPending() calls GET with the URL-encoded token path', async () => {
    api.get.mockReturnValue(
      of({
        pending: { provider: 'github', provider_user_id: 'gh' },
        account: { provider: 'google', email: 'a@b.com' },
      }),
    );
    const res = await firstValueFrom(service.getPending('a/b'));
    expect(api.get).toHaveBeenCalledWith('me/identities/link/pending/a%2Fb');
    expect(res.pending.provider).toBe('github');
  });

  it('unlink() calls DELETE with the URL-encoded id path', async () => {
    api.delete.mockReturnValue(of(undefined));
    await firstValueFrom(service.unlink('a/b'));
    expect(api.delete).toHaveBeenCalledWith('me/identities/a%2Fb');
  });

  it('confirmLink() POSTs the token', async () => {
    api.post.mockReturnValue(
      of({ id: '1', provider: 'github', provider_user_id: 'gh', linked_at: 'x' }),
    );
    await firstValueFrom(service.confirmLink('tok'));
    expect(api.post).toHaveBeenCalledWith('me/identities/link/confirm', { token: 'tok' });
  });

  it('maps 401 insufficient_user_authentication to StepUpRequiredError', async () => {
    const err = new HttpErrorResponse({
      status: 401,
      headers: new HttpHeaders({
        'WWW-Authenticate': 'Bearer error="insufficient_user_authentication"',
      }),
    });
    api.post.mockReturnValue(throwError(() => err));
    await expect(firstValueFrom(service.confirmLink('tok'))).rejects.toBeInstanceOf(
      StepUpRequiredError,
    );
  });

  it('passes a plain 409 through unchanged', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { error: 'identity_already_bound' } });
    api.post.mockReturnValue(throwError(() => err));
    await expect(firstValueFrom(service.confirmLink('tok'))).rejects.toBe(err);
  });
});
