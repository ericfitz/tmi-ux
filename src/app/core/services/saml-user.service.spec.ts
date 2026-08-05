// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { SamlUserService } from './saml-user.service';
import type { ApiService } from './api.service';
import type { LoggerService } from './logger.service';
import type { SAMLUsersResponse } from '@app/types/user.types';

describe('SamlUserService', () => {
  let service: SamlUserService;
  let mockApiService: { get: ReturnType<typeof vi.fn> };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const response: SAMLUsersResponse = {
    idp: 'saml_okta',
    users: [
      {
        internal_uuid: 'saml-uuid-1',
        email: 'carol@corp.example.com',
        name: 'Carol White',
        last_login: '2026-01-15T10:30:00Z',
      },
    ],
    total: 1,
  };

  beforeEach(() => {
    mockApiService = { get: vi.fn().mockReturnValue(of(response)) };
    mockLogger = { debug: vi.fn(), error: vi.fn() };

    service = new SamlUserService(
      mockApiService as unknown as ApiService,
      mockLogger as unknown as LoggerService,
    );
  });

  it('calls the SAML users endpoint for the given idp', () => {
    let result: SAMLUsersResponse | undefined;
    service.list('saml_okta').subscribe(r => (result = r));

    expect(mockApiService.get).toHaveBeenCalledWith('saml/providers/saml_okta/users', undefined);
    expect(result).toEqual(response);
  });

  it('passes email filter and pagination as query params', () => {
    service.list('saml_okta', { email: 'car', limit: 10 }).subscribe();

    expect(mockApiService.get).toHaveBeenCalledWith('saml/providers/saml_okta/users', {
      email: 'car',
      limit: 10,
    });
  });

  it('URL-encodes the idp path segment', () => {
    service.list('saml/odd idp').subscribe();

    expect(mockApiService.get).toHaveBeenCalledWith(
      'saml/providers/saml%2Fodd%20idp/users',
      undefined,
    );
  });

  it('logs and rethrows API errors', () => {
    const apiError = new Error('forbidden');
    mockApiService.get.mockReturnValue(throwError(() => apiError));

    let caught: unknown;
    service.list('saml_okta').subscribe({ error: e => (caught = e) });

    expect(caught).toBe(apiError);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
