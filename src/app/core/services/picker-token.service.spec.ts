import '@angular/compiler';

import { of, throwError, firstValueFrom } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';

import { PickerTokenService } from './picker-token.service';
import type { ApiService } from './api.service';
import type { LoggerService } from './logger.service';
import { ContentTokenNotLinkedError } from '../models/content-provider.types';

describe('PickerTokenService', () => {
  let svc: PickerTokenService;
  let mockApi: { post: ReturnType<typeof vi.fn> };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockApi = { post: vi.fn() };
    mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    svc = new PickerTokenService(
      mockApi as unknown as ApiService,
      mockLogger as unknown as LoggerService,
    );
  });

  it('mint() POSTs /me/picker_tokens/{id}', async () => {
    const response = {
      access_token: 'ya29.x',
      expires_at: '2026-04-26T01:00:00Z',
      developer_key: 'AIza...',
      app_id: '12345',
    };
    mockApi.post.mockReturnValue(of(response));

    const result = await firstValueFrom(svc.mint('google_workspace'));

    expect(mockApi.post).toHaveBeenCalledWith('me/picker_tokens/google_workspace', {});
    expect(result).toEqual(response);
  });

  it('mint() maps 404 to ContentTokenNotLinkedError', async () => {
    const httpErr = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    mockApi.post.mockReturnValue(throwError(() => httpErr));

    await expect(firstValueFrom(svc.mint('google_workspace'))).rejects.toThrow(
      ContentTokenNotLinkedError,
    );
  });

  it('mint() does NOT cache — each call hits the endpoint', async () => {
    mockApi.post.mockReturnValue(
      of({ access_token: 't', expires_at: '...', developer_key: 'k', app_id: 'a' }),
    );
    await firstValueFrom(svc.mint('google_workspace'));
    await firstValueFrom(svc.mint('google_workspace'));
    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });
});
