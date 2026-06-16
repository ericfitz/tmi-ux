// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import {
  isStepUpChallenge,
  buildStepUpState,
  buildStepUpRequestParams,
  buildStepUpUrl,
} from './step-up.utils';

describe('isStepUpChallenge', () => {
  it('detects the challenge in the WWW-Authenticate header', () => {
    const error = new HttpErrorResponse({
      status: 401,
      headers: new HttpHeaders({
        'WWW-Authenticate': 'Bearer error="insufficient_user_authentication"',
      }),
    });
    expect(isStepUpChallenge(error)).toBe(true);
  });

  it('detects the challenge in the error body as fallback', () => {
    const error = new HttpErrorResponse({
      status: 401,
      error: { error: 'insufficient_user_authentication' },
    });
    expect(isStepUpChallenge(error)).toBe(true);
  });

  it('returns false for a plain 401', () => {
    const error = new HttpErrorResponse({
      status: 401,
      error: { error: 'invalid_token' },
    });
    expect(isStepUpChallenge(error)).toBe(false);
  });

  it('returns false for non-401 statuses', () => {
    const error = new HttpErrorResponse({ status: 403 });
    expect(isStepUpChallenge(error)).toBe(false);
  });

  it('returns false for a non-step-up WWW-Authenticate challenge', () => {
    const error = new HttpErrorResponse({
      status: 401,
      headers: new HttpHeaders({
        'WWW-Authenticate': 'Bearer error="invalid_token"',
      }),
    });
    expect(isStepUpChallenge(error)).toBe(false);
  });
});

describe('buildStepUpState', () => {
  it('encodes csrf, returnUrl, and stepUp flag as base64 JSON', () => {
    const state = buildStepUpState('/admin/settings');
    const decoded = JSON.parse(atob(state)) as {
      csrf: string;
      returnUrl: string;
      stepUp: boolean;
    };
    expect(decoded.csrf).toMatch(/^[0-9a-f]{32}$/);
    expect(decoded.returnUrl).toBe('/admin/settings');
    expect(decoded.stepUp).toBe(true);
  });

  it('produces a unique csrf per call', () => {
    const a = JSON.parse(atob(buildStepUpState('/x'))) as { csrf: string };
    const b = JSON.parse(atob(buildStepUpState('/x'))) as { csrf: string };
    expect(a.csrf).not.toBe(b.csrf);
  });
});

describe('buildStepUpRequestParams', () => {
  it('returns the 4 required keys', () => {
    const p = buildStepUpRequestParams('mystate', 'challenge', 'S256', 'https://app.example.com');
    expect(Object.keys(p).sort()).toEqual(
      ['client_callback', 'code_challenge', 'code_challenge_method', 'state'].sort(),
    );
  });

  it('sets client_callback to origin/oauth2/callback', () => {
    const p = buildStepUpRequestParams('s', 'c', 'S256', 'https://app.example.com');
    expect(p['client_callback']).toBe('https://app.example.com/oauth2/callback');
  });

  it('passes through state, challenge, and method unchanged', () => {
    const p = buildStepUpRequestParams('mystate', 'mychallenge', 'S256', 'https://app.example.com');
    expect(p['state']).toBe('mystate');
    expect(p['code_challenge']).toBe('mychallenge');
    expect(p['code_challenge_method']).toBe('S256');
  });
});

describe('buildStepUpUrl', () => {
  it('trims a trailing slash from the base URL', () => {
    const url = buildStepUpUrl('https://api.example.com/', { state: 's', client_callback: 'cb' });
    expect(url).toContain('https://api.example.com/oauth2/step_up?');
    expect(url).not.toContain('//oauth2/step_up');
  });

  it('joins params with & and prefixes /oauth2/step_up?', () => {
    const url = buildStepUpUrl('https://api.example.com', { state: 's', foo: 'bar' });
    expect(url).toContain('/oauth2/step_up?');
    expect(url).toContain('state=s');
    expect(url).toContain('foo=bar');
    expect(url).toContain('&');
  });

  it('percent-encodes values containing +, /, and =', () => {
    const base64State = 'abc+def/ghi=';
    const url = buildStepUpUrl('https://api.example.com', { state: base64State });
    expect(url).toContain('state=abc%2Bdef%2Fghi%3D');
    expect(url).not.toContain('state=abc+def/ghi=');
  });
});
