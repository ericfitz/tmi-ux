import '@angular/compiler';

import { of, throwError, firstValueFrom } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';

import { MicrosoftPickerGrantService } from './microsoft-picker-grant.service';
import type { ApiService } from './api.service';
import type { LoggerService } from './logger.service';
import {
  MicrosoftAccountNotLinkedError,
  MicrosoftGraphPermissionRejectedError,
  MicrosoftGraphUnavailableError,
  MicrosoftPickerGrantBadRequestError,
  MicrosoftPickerGrantServerError,
} from '../models/content-provider.types';

describe('MicrosoftPickerGrantService', () => {
  let svc: MicrosoftPickerGrantService;
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
    svc = new MicrosoftPickerGrantService(
      mockApi as unknown as ApiService,
      mockLogger as unknown as LoggerService,
    );
  });

  it('grant() POSTs /me/microsoft/picker_grants with drive and item ids', async () => {
    const response = { permission_id: 'p1', drive_id: 'd1', item_id: 'i1' };
    mockApi.post.mockReturnValue(of(response));

    const result = await firstValueFrom(svc.grant('d1', 'i1'));

    expect(mockApi.post).toHaveBeenCalledWith('me/microsoft/picker_grants', {
      drive_id: 'd1',
      item_id: 'i1',
    });
    expect(result).toEqual(response);
  });

  it.each([
    [400, MicrosoftPickerGrantBadRequestError],
    [404, MicrosoftAccountNotLinkedError],
    [422, MicrosoftGraphPermissionRejectedError],
    [500, MicrosoftPickerGrantServerError],
    [503, MicrosoftGraphUnavailableError],
  ])('grant() maps HTTP %i to the expected typed error', async (status, ErrCtor) => {
    const httpErr = new HttpErrorResponse({ status, statusText: 'err' });
    mockApi.post.mockReturnValue(throwError(() => httpErr));

    await expect(firstValueFrom(svc.grant('d1', 'i1'))).rejects.toBeInstanceOf(ErrCtor);
  });

  it('grant() rethrows untyped HttpErrorResponse for unmapped 4xx (e.g., 401, 403)', async () => {
    const httpErr = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    mockApi.post.mockReturnValue(throwError(() => httpErr));
    await expect(firstValueFrom(svc.grant('d1', 'i1'))).rejects.toBe(httpErr);
  });

  it('grant() wraps non-HTTP errors as Error', async () => {
    mockApi.post.mockReturnValue(throwError(() => 'boom'));
    await expect(firstValueFrom(svc.grant('d1', 'i1'))).rejects.toBeInstanceOf(Error);
  });
});
