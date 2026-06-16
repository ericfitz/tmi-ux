// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';

import { StepUpService } from './step-up.service';
import { PkceService } from './pkce.service';
import { StepUpResponse } from '../models/step-up.models';
import { createMockLoggerService } from '../../../testing/mocks';
import { SKIP_ERROR_HANDLING } from '../../core/tokens/http-context.tokens';

interface MockHttp {
  get: ReturnType<typeof vi.fn>;
}
interface MockRouter {
  url: string;
}
interface MockDialog {
  open: ReturnType<typeof vi.fn>;
}
interface MockPkce {
  generatePkceParameters: ReturnType<typeof vi.fn>;
  clearVerifier: ReturnType<typeof vi.fn>;
}

describe('StepUpService', () => {
  let service: StepUpService;
  let http: MockHttp;
  let router: MockRouter;
  let dialog: MockDialog;
  let pkce: MockPkce;

  const pkceParams = {
    codeVerifier: 'v'.repeat(43),
    codeChallenge: 'c'.repeat(43),
    codeChallengeMethod: 'S256',
    generatedAt: 0,
  };

  const weakResponse: StepUpResponse = { result: 'step_up_weak_complete', provider: 'github' };
  const strongResponse: StepUpResponse = {
    result: 'step_up_redirect',
    redirect_url: 'https://idp.example.com/authorize?prompt=login',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    http = { get: vi.fn().mockReturnValue(of(weakResponse)) };
    router = { url: '/admin/settings' };
    dialog = { open: vi.fn() };
    pkce = {
      generatePkceParameters: vi.fn().mockResolvedValue(pkceParams),
      clearVerifier: vi.fn(),
    };

    service = new StepUpService(
      http as never,
      router as never,
      dialog as never,
      pkce as unknown as PkceService,
      createMockLoggerService(),
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('calls /oauth2/step_up with PKCE params, state, and JSON accept', async () => {
    const outcome = await new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    expect(outcome).toBe('weak_complete');
    const [url, options] = http.get.mock.calls[0] as [
      string,
      {
        params: Record<string, string>;
        headers: Record<string, string>;
        context: { get: (token: unknown) => unknown };
      },
    ];
    expect(url).toContain('/oauth2/step_up');
    expect(options.headers['Accept']).toBe('application/json');
    expect(options.params['code_challenge']).toBe(pkceParams.codeChallenge);
    expect(options.params['code_challenge_method']).toBe('S256');
    expect(options.params['client_callback']).toContain('/oauth2/callback');
    // The state sent is the step-up state (storage-independent: the weak path
    // clears localStorage after completing, so decode the sent value directly).
    const decodedState = JSON.parse(atob(options.params['state'])) as { stepUp?: boolean };
    expect(decodedState.stepUp).toBe(true);
    expect(options.context.get(SKIP_ERROR_HANDLING)).toBe(true);
  });

  it('stores oauth_provider for the callback token exchange on the strong path', async () => {
    http.get.mockReturnValue(of(strongResponse));
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    service.navigateTo = vi.fn();
    await new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    expect(localStorage.getItem('oauth_provider')).toBe('github');
  });

  it('weak path resolves weak_complete without opening the dialog', async () => {
    const outcome = await new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    expect(outcome).toBe('weak_complete');
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('strong path opens the confirm dialog and resolves cancelled on dismiss', async () => {
    http.get.mockReturnValue(of(strongResponse));
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const outcome = await new Promise(resolve => service.beginStepUp('google').subscribe(resolve));
    expect(dialog.open).toHaveBeenCalled();
    expect(outcome).toBe('cancelled');
  });

  it('strong path redirects on confirm', async () => {
    http.get.mockReturnValue(of(strongResponse));
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const navigateSpy = vi.fn();
    service.navigateTo = navigateSpy;
    const outcome = await new Promise(resolve => service.beginStepUp('google').subscribe(resolve));
    expect(outcome).toBe('redirecting');
    expect(navigateSpy).toHaveBeenCalledWith(strongResponse.redirect_url);
  });

  it('resolves cancelled when the step_up request errors', async () => {
    http.get.mockReturnValue(throwError(() => new Error('503')));
    const outcome = await new Promise(resolve => service.beginStepUp('google').subscribe(resolve));
    expect(outcome).toBe('cancelled');
  });

  it('clears orphaned handoff storage on the weak short-circuit', async () => {
    await new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    expect(localStorage.getItem('oauth_state')).toBeNull();
    expect(localStorage.getItem('oauth_provider')).toBeNull();
    expect(pkce.clearVerifier).toHaveBeenCalled();
  });

  it('clears handoff storage when the user cancels the confirm dialog', async () => {
    http.get.mockReturnValue(of(strongResponse));
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    await new Promise(resolve => service.beginStepUp('google').subscribe(resolve));
    expect(localStorage.getItem('oauth_state')).toBeNull();
    expect(localStorage.getItem('oauth_provider')).toBeNull();
    expect(pkce.clearVerifier).toHaveBeenCalled();
  });

  it('clears handoff storage when the step_up request errors', async () => {
    http.get.mockReturnValue(throwError(() => new Error('503')));
    await new Promise(resolve => service.beginStepUp('google').subscribe(resolve));
    expect(localStorage.getItem('oauth_state')).toBeNull();
    expect(localStorage.getItem('oauth_provider')).toBeNull();
    expect(pkce.clearVerifier).toHaveBeenCalled();
  });

  it('preserves handoff storage on the strong redirect path (callback consumes it)', async () => {
    http.get.mockReturnValue(of(strongResponse));
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    service.navigateTo = vi.fn();
    const outcome = await new Promise(resolve => service.beginStepUp('google').subscribe(resolve));
    expect(outcome).toBe('redirecting');
    expect(localStorage.getItem('oauth_state')).not.toBeNull();
    expect(localStorage.getItem('oauth_provider')).toBe('google');
    expect(pkce.clearVerifier).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent challenges into one in-flight step-up', async () => {
    const gate = new Subject<StepUpResponse>();
    http.get.mockReturnValue(gate.asObservable());
    const first = new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    const second = new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    // Flush the microtask queue so generatePkceParameters() resolves and the
    // switchMap subscribes to gate before we emit from it.
    await Promise.resolve();
    gate.next(weakResponse);
    gate.complete();
    expect(await first).toBe('weak_complete');
    expect(await second).toBe('weak_complete');
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});
