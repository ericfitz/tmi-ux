# OAuth2 Step-Up Retry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handle `401 + WWW-Authenticate: insufficient_user_authentication` on step-up-protected admin writes: weak providers complete invisibly with a transparent in-flight retry; strong providers get a confirm dialog → IdP redirect → return-and-redo.

**Architecture:** Per the approved spec (`docs/superpowers/specs/2026-06-11-oauth2-step-up-retry-design.md`). A new `StepUpService` (no `AuthService` dependency — provider id is passed in, avoiding an import cycle) orchestrates the `/oauth2/step_up` XHR, confirm dialog, and redirect. `JwtInterceptor` gets a challenge branch *before* its refresh path. Post-callback UX (redo snackbar, identity-mismatch dialog) lives in `AuthCallbackComponent`, which can inject everything without service cycles. `AuthService` changes are minimal: expose state decoding with a `stepUp` flag, expose the last auth error, and detect `identity_mismatch` in the token exchange.

**Tech Stack:** Angular standalone/OnPush, Angular Material (dialog, snackbar), Transloco, Vitest (native syntax, direct class instantiation with typed mocks — no TestBed).

---

## ⚠️ Pre-flight: server contract check

**Implementation is blocked on [tmi#455](https://github.com/ericfitz/tmi/issues/455)** (JSON content negotiation on `/oauth2/step_up`). Before Task 1:

1. Fetch the server OpenAPI spec (`https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/dev/1.4.0/api-schema/tmi-openapi.json` or local clone path from `.local-projects.json`).
2. Confirm `GET /oauth2/step_up` documents the `Accept: application/json` behavior: `200 {result: "step_up_redirect", redirect_url}` (strong) and `200 {result: "step_up_weak_complete", ...}` (weak). If absent, STOP — still blocked on tmi#455.
3. Check tmi#455 for the server team's answers on (a) `Access-Control-Expose-Headers: WWW-Authenticate` and (b) the `identity_mismatch` error body shape on `POST /oauth2/token`. Adjust `isStepUpChallenge()` (Task 1) and the mismatch detection (Task 5) if the confirmed shapes differ from the assumptions coded below.

## Project conventions

Same as all tmi-ux work: pnpm scripts only; 2 spaces/single quotes/100 chars/strict TS; standalone OnPush components; `LoggerService` not console; vitest native syntax with the standard spec header comment (copy from any existing spec) and direct class instantiation (see `src/app/auth/components/auth-callback/auth-callback.component.spec.ts` and `src/app/core/services/api.service.spec.ts` for idioms); buttons only `mat-flat-button`/`mat-button`/`mat-icon-button`; dialog actions `[Cancel mat-button] [Primary mat-flat-button color="primary" cdkFocusInitial]`.

## File structure

```
Create: src/app/auth/utils/step-up.utils.ts (+ .spec.ts)        # challenge detection + state builder
Create: src/app/auth/models/step-up.models.ts                   # response/outcome types
Create: src/app/auth/services/step-up.service.ts (+ .spec.ts)   # orchestration
Create: src/app/auth/components/step-up-confirm-dialog/
        step-up-confirm-dialog.component.{ts,html} (no scss needed)
Create: src/app/auth/components/step-up-mismatch-dialog/
        step-up-mismatch-dialog.component.{ts,html}
Modify: src/app/core/tokens/http-context.tokens.ts              # IS_STEPUP_RETRY
Modify: src/app/auth/interceptors/jwt.interceptor.ts            # challenge branch
Modify: src/app/auth/interceptors/jwt.interceptor.spec.ts       # branch tests
Modify: src/app/auth/services/auth.service.ts                   # decodeState public+stepUp, lastAuthError, identity_mismatch
Modify: src/app/auth/services/auth.service.spec.ts              # new tests
Modify: src/app/auth/components/auth-callback/auth-callback.component.ts (+ spec)  # post-callback UX
Modify: src/assets/i18n/en-US.json                              # stepUp.* keys
```

---

### Task 1: Challenge detection util, state builder, and context token

**Files:**
- Create: `src/app/auth/utils/step-up.utils.ts`
- Test: `src/app/auth/utils/step-up.utils.spec.ts`
- Modify: `src/app/core/tokens/http-context.tokens.ts`

- [ ] **Step 1: Add the context token**

Append to `src/app/core/tokens/http-context.tokens.ts`:

```typescript
/**
 * HTTP context token to mark a request as a post-step-up retry attempt.
 * If a request with this flag receives another step-up challenge, the
 * interceptor does not initiate step-up again (prevents loops).
 */
export const IS_STEPUP_RETRY = new HttpContextToken<boolean>(() => false);
```

- [ ] **Step 2: Write the failing util spec**

```typescript
// src/app/auth/utils/step-up.utils.spec.ts
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { isStepUpChallenge, buildStepUpState } from './step-up.utils';

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
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm run test src/app/auth/utils/step-up.utils.spec.ts`
Expected: FAIL — cannot resolve `./step-up.utils`.

- [ ] **Step 4: Implement**

```typescript
// src/app/auth/utils/step-up.utils.ts
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Detect the step-up challenge on a 401 response.
 * Primary signal: WWW-Authenticate header (requires the server to expose it
 * via Access-Control-Expose-Headers — see tmi#455).
 * Fallback: error code in the JSON body.
 */
export function isStepUpChallenge(error: HttpErrorResponse): boolean {
  if (error.status !== 401) {
    return false;
  }
  const header = error.headers?.get('WWW-Authenticate') ?? '';
  if (header.toLowerCase().includes('insufficient_user_authentication')) {
    return true;
  }
  const body = error.error as { error?: string } | null;
  return body?.error === 'insufficient_user_authentication';
}

/**
 * Build the OAuth state parameter for a step-up round-trip.
 * Same base64-JSON format as AuthService.generateRandomState, with an
 * additional stepUp flag so the callback knows which flow it is finishing.
 */
export function buildStepUpState(returnUrl: string): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  const csrf = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  const stateJson = JSON.stringify({ csrf, returnUrl, stepUp: true });
  const encoder = new TextEncoder();
  return btoa(String.fromCharCode(...encoder.encode(stateJson)));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm run test src/app/auth/utils/step-up.utils.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/auth/utils/ src/app/core/tokens/http-context.tokens.ts
git commit -m "feat(auth): step-up challenge detection and state builder (#680)"
```

---

### Task 2: Models and confirm dialog

**Files:**
- Create: `src/app/auth/models/step-up.models.ts`
- Create: `src/app/auth/components/step-up-confirm-dialog/step-up-confirm-dialog.component.ts`
- Create: `src/app/auth/components/step-up-confirm-dialog/step-up-confirm-dialog.component.html`

No spec — the dialog is pure template (returns its result via `mat-dialog-close`).

- [ ] **Step 1: Models**

```typescript
// src/app/auth/models/step-up.models.ts
/**
 * Response from GET /oauth2/step_up with Accept: application/json.
 * Contract per tmi#455 (verify against published OpenAPI spec — see plan pre-flight).
 */
export interface StepUpResponse {
  result: 'step_up_weak_complete' | 'step_up_redirect';
  /** Present when result is step_up_redirect: the upstream IdP authorize URL */
  redirect_url?: string;
  provider?: string;
  auth_time?: number;
  message?: string;
}

/** Outcome of StepUpService.beginStepUp() as seen by the interceptor */
export type StepUpOutcome = 'weak_complete' | 'redirecting' | 'cancelled';
```

- [ ] **Step 2: Confirm dialog component**

```typescript
// src/app/auth/components/step-up-confirm-dialog/step-up-confirm-dialog.component.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Confirms the user wants to leave the page for a fresh IdP sign-in
 * (strong step-up path). Closes with true (re-authenticate) or undefined.
 */
@Component({
  selector: 'app-step-up-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, A11yModule, TranslocoModule],
  templateUrl: './step-up-confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepUpConfirmDialogComponent {}
```

```html
<!-- src/app/auth/components/step-up-confirm-dialog/step-up-confirm-dialog.component.html -->
<h2 mat-dialog-title>{{ 'stepUp.confirmTitle' | transloco }}</h2>
<mat-dialog-content>
  <p>{{ 'stepUp.confirmBody' | transloco }}</p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
  <button mat-flat-button color="primary" [mat-dialog-close]="true" cdkFocusInitial>
    {{ 'stepUp.confirmAction' | transloco }}
  </button>
</mat-dialog-actions>
```

(Verify the exact key for Cancel — `common.cancel` — exists in `en-US.json`; if the project uses a different key for Cancel buttons, use that one.)

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/models/step-up.models.ts src/app/auth/components/step-up-confirm-dialog/
git commit -m "feat(auth): step-up models and confirm dialog (#680)"
```

---

### Task 3: StepUpService

**Files:**
- Create: `src/app/auth/services/step-up.service.ts`
- Test: `src/app/auth/services/step-up.service.spec.ts`

- [ ] **Step 1: Write the failing spec**

```typescript
// src/app/auth/services/step-up.service.spec.ts
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
    generatedAt: Date.now(),
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
    pkce = { generatePkceParameters: vi.fn().mockResolvedValue(pkceParams) };

    service = new StepUpService(
      http as never,
      router as never,
      dialog as never,
      pkce as unknown as PkceService,
      createMockLoggerService() as never,
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('calls /oauth2/step_up with PKCE params, state, and JSON accept', async () => {
    const outcome = await new Promise(resolve =>
      service.beginStepUp('github').subscribe(resolve),
    );

    expect(outcome).toBe('weak_complete');
    const [url, options] = http.get.mock.calls[0] as [
      string,
      { params: Record<string, string>; headers: Record<string, string> },
    ];
    expect(url).toContain('/oauth2/step_up');
    expect(options.headers['Accept']).toBe('application/json');
    expect(options.params['code_challenge']).toBe(pkceParams.codeChallenge);
    expect(options.params['code_challenge_method']).toBe('S256');
    expect(options.params['client_callback']).toContain('/oauth2/callback');
    expect(options.params['state']).toBe(localStorage.getItem('oauth_state'));
  });

  it('stores oauth_provider for the callback token exchange', async () => {
    await new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    expect(localStorage.getItem('oauth_provider')).toBe('github');
  });

  it('weak path resolves weak_complete without opening the dialog', async () => {
    const outcome = await new Promise(resolve =>
      service.beginStepUp('github').subscribe(resolve),
    );
    expect(outcome).toBe('weak_complete');
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('strong path opens the confirm dialog and resolves cancelled on dismiss', async () => {
    http.get.mockReturnValue(of(strongResponse));
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

    const outcome = await new Promise(resolve =>
      service.beginStepUp('google').subscribe(resolve),
    );

    expect(dialog.open).toHaveBeenCalled();
    expect(outcome).toBe('cancelled');
  });

  it('strong path redirects on confirm', async () => {
    http.get.mockReturnValue(of(strongResponse));
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const navigateSpy = vi.fn();
    service.navigateTo = navigateSpy;

    const outcome = await new Promise(resolve =>
      service.beginStepUp('google').subscribe(resolve),
    );

    expect(outcome).toBe('redirecting');
    expect(navigateSpy).toHaveBeenCalledWith(strongResponse.redirect_url);
  });

  it('resolves cancelled when the step_up request errors', async () => {
    http.get.mockReturnValue(throwError(() => new Error('503')));
    const outcome = await new Promise(resolve =>
      service.beginStepUp('google').subscribe(resolve),
    );
    expect(outcome).toBe('cancelled');
  });

  it('deduplicates concurrent challenges into one in-flight step-up', async () => {
    const gate = new Subject<StepUpResponse>();
    http.get.mockReturnValue(gate.asObservable());

    const first = new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    const second = new Promise(resolve => service.beginStepUp('github').subscribe(resolve));
    gate.next(weakResponse);
    gate.complete();

    expect(await first).toBe('weak_complete');
    expect(await second).toBe('weak_complete');
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run test src/app/auth/services/step-up.service.spec.ts`
Expected: FAIL — cannot resolve `./step-up.service`.

- [ ] **Step 3: Implement**

```typescript
// src/app/auth/services/step-up.service.ts
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, from, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap } from 'rxjs/operators';

import { LoggerService } from '../../core/services/logger.service';
import { SKIP_ERROR_HANDLING } from '../../core/tokens/http-context.tokens';
import { environment } from '../../../environments/environment';
import { PkceService } from './pkce.service';
import { StepUpOutcome, StepUpResponse } from '../models/step-up.models';
import { buildStepUpState } from '../utils/step-up.utils';
import { StepUpConfirmDialogComponent } from '../components/step-up-confirm-dialog/step-up-confirm-dialog.component';

/**
 * Orchestrates the OAuth2 step-up flow (tmi-ux#680).
 * Deliberately has NO dependency on AuthService (the interceptor passes the
 * provider id in) to avoid an import cycle through the HTTP interceptor chain.
 *
 * Weak providers: /oauth2/step_up returns step_up_weak_complete with rotated
 * cookies; outcome weak_complete tells the interceptor to retry in-flight.
 * Strong providers: confirm dialog, then top-level redirect to the IdP.
 */
@Injectable({
  providedIn: 'root',
})
export class StepUpService {
  private inFlight$: Observable<StepUpOutcome> | null = null;

  /** Seam for tests: performs the top-level navigation to the IdP */
  navigateTo: (url: string) => void = url => {
    window.location.href = url;
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private dialog: MatDialog,
    private pkceService: PkceService,
    private logger: LoggerService,
  ) {}

  /**
   * Begin step-up for the current user's provider. Concurrent calls share
   * one in-flight flow (same pattern as AuthService.forceRefreshToken).
   */
  public beginStepUp(providerId: string): Observable<StepUpOutcome> {
    if (this.inFlight$) {
      return this.inFlight$;
    }

    this.inFlight$ = from(this.pkceService.generatePkceParameters()).pipe(
      switchMap(pkceParams => {
        const state = buildStepUpState(this.router.url);
        localStorage.setItem('oauth_state', state);
        localStorage.setItem('oauth_provider', providerId);

        const params = {
          client_callback: `${window.location.origin}/oauth2/callback`,
          state,
          code_challenge: pkceParams.codeChallenge,
          code_challenge_method: 'S256',
        };

        // SKIP_ERROR_HANDLING: a failure here must not trigger the
        // interceptor's refresh/logout machinery.
        return this.http.get<StepUpResponse>(`${environment.apiUrl}/oauth2/step_up`, {
          params,
          headers: { Accept: 'application/json' },
          context: new HttpContext().set(SKIP_ERROR_HANDLING, true),
        });
      }),
      switchMap(response => this.handleStepUpResponse(response)),
      catchError(error => {
        this.logger.error('Step-up initiation failed', error);
        return of('cancelled' as const);
      }),
      finalize(() => {
        this.inFlight$ = null;
      }),
      shareReplay(1),
    );

    return this.inFlight$;
  }

  private handleStepUpResponse(response: StepUpResponse): Observable<StepUpOutcome> {
    if (response.result === 'step_up_weak_complete') {
      // Cookies already rotated via Set-Cookie; no user-facing message by design.
      this.logger.info('Step-up completed via weak short-circuit', {
        provider: response.provider,
      });
      return of('weak_complete' as const);
    }

    return this.dialog
      .open(StepUpConfirmDialogComponent)
      .afterClosed()
      .pipe(
        map((confirmed: boolean | undefined) => {
          if (confirmed && response.redirect_url) {
            this.navigateTo(response.redirect_url);
            return 'redirecting' as const;
          }
          return 'cancelled' as const;
        }),
      );
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm run test src/app/auth/services/step-up.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/services/step-up.service.ts src/app/auth/services/step-up.service.spec.ts
git commit -m "feat(auth): StepUpService orchestrating /oauth2/step_up flow (#680)"
```

---

### Task 4: Interceptor challenge branch

**Files:**
- Modify: `src/app/auth/interceptors/jwt.interceptor.ts`
- Modify: `src/app/auth/interceptors/jwt.interceptor.spec.ts` (append tests; mirror the file's existing mock setup)

- [ ] **Step 1: Write the failing tests**

Append a describe block to the existing spec, reusing its mock construction (read the file's `beforeEach` first and follow it exactly — it constructs the interceptor with a mock `Injector` whose `get` returns the mock AuthService; extend that mock so `injector.get(StepUpService)` returns a mock step-up service):

```typescript
  describe('step-up challenge handling', () => {
    const challengeError = new HttpErrorResponse({
      status: 401,
      headers: new HttpHeaders({
        'WWW-Authenticate': 'Bearer error="insufficient_user_authentication"',
      }),
      url: 'http://localhost:8080/admin/settings/foo',
    });

    it('initiates step-up instead of token refresh on the challenge', () => {
      mockStepUpService.beginStepUp.mockReturnValue(of('cancelled'));
      mockNext.handle.mockReturnValue(throwError(() => challengeError));

      let caught: unknown;
      interceptor
        .intercept(makeAdminRequest(), mockNext)
        .subscribe({ error: e => (caught = e) });

      expect(mockStepUpService.beginStepUp).toHaveBeenCalled();
      expect(mockAuthService.forceRefreshToken).not.toHaveBeenCalled();
      expect(caught).toBe(challengeError);
    });

    it('passes the current provider id to beginStepUp', () => {
      mockAuthService.userProfile = { provider: 'google' };
      mockStepUpService.beginStepUp.mockReturnValue(of('cancelled'));
      mockNext.handle.mockReturnValue(throwError(() => challengeError));

      interceptor.intercept(makeAdminRequest(), mockNext).subscribe({ error: () => {} });

      expect(mockStepUpService.beginStepUp).toHaveBeenCalledWith('google');
    });

    it('retries the original request once after weak_complete', () => {
      mockStepUpService.beginStepUp.mockReturnValue(of('weak_complete'));
      const okResponse = new HttpResponse({ status: 200 });
      mockNext.handle
        .mockReturnValueOnce(throwError(() => challengeError))
        .mockReturnValueOnce(of(okResponse));

      let result: unknown;
      interceptor.intercept(makeAdminRequest(), mockNext).subscribe(r => (result = r));

      expect(mockNext.handle).toHaveBeenCalledTimes(2);
      const retried = mockNext.handle.mock.calls[1][0] as HttpRequest<unknown>;
      expect(retried.context.get(IS_STEPUP_RETRY)).toBe(true);
      expect(result).toBe(okResponse);
    });

    it('does not loop when the retried request is challenged again', () => {
      mockStepUpService.beginStepUp.mockReturnValue(of('weak_complete'));
      mockNext.handle.mockReturnValue(throwError(() => challengeError));

      const retriedRequest = makeAdminRequest().clone({
        context: new HttpContext().set(IS_STEPUP_RETRY, true),
      });
      let caught: unknown;
      interceptor.intercept(retriedRequest, mockNext).subscribe({ error: e => (caught = e) });

      expect(mockStepUpService.beginStepUp).not.toHaveBeenCalled();
      expect(caught).toBe(challengeError);
    });

    it('plain 401 without challenge still uses the refresh path', () => {
      const plain401 = new HttpErrorResponse({
        status: 401,
        url: 'http://localhost:8080/admin/settings/foo',
      });
      mockNext.handle.mockReturnValue(throwError(() => plain401));
      mockAuthService.forceRefreshToken.mockReturnValue(throwError(() => plain401));

      interceptor.intercept(makeAdminRequest(), mockNext).subscribe({ error: () => {} });

      expect(mockAuthService.forceRefreshToken).toHaveBeenCalled();
      expect(mockStepUpService.beginStepUp).not.toHaveBeenCalled();
    });
  });
```

Helper `makeAdminRequest()` — add near the spec's existing request builders if one doesn't exist:

```typescript
  function makeAdminRequest(): HttpRequest<unknown> {
    return new HttpRequest('PUT', 'http://localhost:8080/admin/settings/foo', { value: 1 });
  }
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm run test src/app/auth/interceptors/jwt.interceptor.spec.ts`
Expected: new tests FAIL (`beginStepUp` never called / `IS_STEPUP_RETRY` unknown); pre-existing tests PASS.

- [ ] **Step 3: Implement the branch**

In `jwt.interceptor.ts`:

1. Extend imports:

```typescript
import {
  IS_AUTH_RETRY,
  IS_LOGOUT_REQUEST,
  IS_STEPUP_RETRY,
  SKIP_ERROR_HANDLING,
} from '../../core/tokens/http-context.tokens';
import { StepUpService } from '../services/step-up.service';
import { isStepUpChallenge } from '../utils/step-up.utils';
```

2. Add a lazy resolver alongside the existing `authService` getter (same circular-dependency rationale):

```typescript
  private _stepUpService: StepUpService | null = null;

  private get stepUpService(): StepUpService {
    if (!this._stepUpService) {
      this._stepUpService = this.injector.get(StepUpService);
    }
    return this._stepUpService;
  }
```

3. In `intercept()`, inside the existing `if (error.status === 401)` block, add the challenge branch BEFORE `handleUnauthorizedErrorWithRefresh` is called:

```typescript
          if (error.status === 401) {
            if (isStepUpChallenge(error)) {
              return this.handleStepUpChallenge(request, next, error);
            }
            this.logger.error('401 UNAUTHORIZED on API request', {
              // ... (existing logging unchanged)
```

4. Add the handler method:

```typescript
  /**
   * Handle a step-up challenge (401 + insufficient_user_authentication).
   * Token refresh cannot satisfy a freshness challenge, so this branches
   * before the refresh path. Weak providers complete in-flight and the
   * original request is retried once; strong providers redirect (the page
   * unloads) or the user cancels — either way the original error propagates.
   */
  private handleStepUpChallenge(
    request: HttpRequest<unknown>,
    next: HttpHandler,
    originalError: HttpErrorResponse,
  ): Observable<HttpEvent<unknown>> {
    if (request.context.get(IS_STEPUP_RETRY)) {
      this.logger.warn('Step-up challenge on retried request - not retrying again', {
        url: request.url,
      });
      return throwError(() => originalError);
    }

    const providerId = this.authService.userProfile?.provider ?? '';
    this.logger.info('Step-up challenge received - initiating step-up', {
      url: request.url,
      provider: providerId,
    });

    return this.stepUpService.beginStepUp(providerId).pipe(
      switchMap(outcome => {
        if (outcome === 'weak_complete') {
          const retryRequest = request.clone({
            context: new HttpContext().set(IS_STEPUP_RETRY, true),
          });
          return next.handle(retryRequest);
        }
        // redirecting (page is unloading) or cancelled: propagate the original error
        return throwError(() => originalError);
      }),
    );
  }
```

(`HttpContext` is already imported in this file.)

- [ ] **Step 4: Run the full interceptor spec**

Run: `pnpm run test src/app/auth/interceptors/jwt.interceptor.spec.ts`
Expected: PASS — all new and pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/interceptors/
git commit -m "feat(auth): branch step-up challenges before token refresh in JwtInterceptor (#680)"
```

---

### Task 5: AuthService — stepUp state, lastAuthError, identity_mismatch

**Files:**
- Modify: `src/app/auth/services/auth.service.ts`
- Modify: `src/app/auth/services/auth.service.spec.ts` (append tests using the file's existing setup)

- [ ] **Step 1: Write the failing tests**

Append (adapt the construction to the spec file's existing `beforeEach`):

```typescript
  describe('decodeState (public, step-up aware)', () => {
    it('exposes the stepUp flag from structured state', () => {
      const state = btoa(
        JSON.stringify({ csrf: 'a'.repeat(32), returnUrl: '/admin/settings', stepUp: true }),
      );
      const decoded = service.decodeState(state);
      expect(decoded.stepUp).toBe(true);
      expect(decoded.returnUrl).toBe('/admin/settings');
    });

    it('returns stepUp undefined for login-flow state', () => {
      const state = btoa(JSON.stringify({ csrf: 'a'.repeat(32), returnUrl: '/tm' }));
      expect(service.decodeState(state).stepUp).toBeUndefined();
    });
  });

  describe('identity_mismatch on token exchange', () => {
    it('surfaces identity_mismatch as a distinct auth error and remains non-destructive', () => {
      // Arrange: mock http.post to fail with the server's mismatch error
      mockHttpClient.post.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { error: 'identity_mismatch' },
            }),
        ),
      );
      // PKCE verifier must be retrievable (seed sessionStorage as the spec's other
      // exchange tests do, or mock pkceService.retrieveVerifier).

      let result: boolean | undefined;
      service
        .handleOAuthCallback({ code: 'auth-code', state: validStoredState })
        .subscribe(r => (result = r));

      expect(result).toBe(false);
      expect(service.lastAuthError?.code).toBe('identity_mismatch');
      // logout must NOT have been called — the original session is still valid
      expect(mockHttpClient.post).not.toHaveBeenCalledWith(
        expect.stringContaining('/oauth2/logout'),
        expect.anything(),
      );
    });
  });
```

Note: `validStoredState` means a state string whose CSRF matches `localStorage.oauth_state` — copy the arrangement from the spec's existing `handleOAuthCallback` tests.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm run test src/app/auth/services/auth.service.spec.ts`
Expected: new tests FAIL; pre-existing PASS.

- [ ] **Step 3: Implement the three changes**

(a) **`decodeState`** (currently private, ~line 772): make it public and step-up aware:

```typescript
  /**
   * Decode state parameter and extract CSRF token, return URL, and step-up flag.
   * Public: AuthCallbackComponent uses it to detect step-up callbacks.
   * @param state State parameter from OAuth callback
   */
  decodeState(state: string): { csrf: string; returnUrl?: string; stepUp?: boolean } {
    try {
      if (this.isBase64(state)) {
        const decoded = JSON.parse(atob(state)) as {
          csrf: string;
          returnUrl?: string;
          stepUp?: boolean;
        };
        return {
          csrf: decoded.csrf,
          returnUrl: decoded.returnUrl,
          stepUp: decoded.stepUp,
        };
      }
    } catch {
      // Not structured state; fall through to plain CSRF handling
    }
    return { csrf: state };
  }
```

(b) **`lastAuthError`**: add a field and set it in the existing `handleAuthError` method (find it; it broadcasts to the auth error subject):

```typescript
  /** Most recent auth error, readable synchronously (e.g. by AuthCallbackComponent) */
  public lastAuthError: AuthError | null = null;
```

First line inside `handleAuthError(error: AuthError)`: `this.lastAuthError = error;`

(c) **`identity_mismatch` detection** in `exchangeAuthorizationCode` (~line 1070). Replace the existing `catchError` block:

```typescript
        catchError((error: HttpErrorResponse) => {
          this.pkceService.clearVerifier();

          const bodyError = (error.error as { error?: string } | null)?.error;
          if (error.status === 400 && bodyError === 'identity_mismatch') {
            // Step-up re-auth completed as the WRONG identity. The original
            // session cookies were not rotated and remain valid; do not treat
            // this as a destructive auth failure.
            this.logger.warn('Step-up token exchange rejected: identity mismatch');
            this.handleAuthError({
              code: 'identity_mismatch',
              message: 'Re-authentication used a different identity',
              retryable: true,
            });
            return of(false);
          }

          this.logger.error('Authorization code exchange failed (PKCE)', error);
          this.handleAuthError({
            code: 'code_exchange_failed',
            message: `Failed to exchange authorization code: ${error.message}`,
            retryable: true,
          });
          return of(false);
        }),
```

- [ ] **Step 4: Run the full auth service spec**

Run: `pnpm run test src/app/auth/services/auth.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/services/auth.service.ts src/app/auth/services/auth.service.spec.ts
git commit -m "feat(auth): step-up state decoding and identity_mismatch detection (#680)"
```

---

### Task 6: Callback UX — redo snackbar + identity-mismatch dialog

**Files:**
- Create: `src/app/auth/components/step-up-mismatch-dialog/step-up-mismatch-dialog.component.ts`
- Create: `src/app/auth/components/step-up-mismatch-dialog/step-up-mismatch-dialog.component.html`
- Modify: `src/app/auth/components/auth-callback/auth-callback.component.ts`
- Modify: `src/app/auth/components/auth-callback/auth-callback.component.spec.ts`

- [ ] **Step 1: Mismatch dialog component**

```typescript
// src/app/auth/components/step-up-mismatch-dialog/step-up-mismatch-dialog.component.ts
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslocoModule } from '@jsverse/transloco';

export interface StepUpMismatchDialogData {
  email: string;
}

/**
 * Shown when step-up re-authentication completed as a different identity
 * (400 identity_mismatch from /oauth2/token). Closes with true (try again)
 * or undefined (cancel). The original session remains valid.
 */
@Component({
  selector: 'app-step-up-mismatch-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, A11yModule, TranslocoModule],
  templateUrl: './step-up-mismatch-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepUpMismatchDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: StepUpMismatchDialogData) {}
}
```

```html
<!-- src/app/auth/components/step-up-mismatch-dialog/step-up-mismatch-dialog.component.html -->
<h2 mat-dialog-title>{{ 'stepUp.mismatchTitle' | transloco }}</h2>
<mat-dialog-content>
  <p>{{ 'stepUp.mismatchBody' | transloco: { email: data.email } }}</p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
  <button mat-flat-button color="primary" [mat-dialog-close]="true" cdkFocusInitial>
    {{ 'stepUp.tryAgain' | transloco }}
  </button>
</mat-dialog-actions>
```

- [ ] **Step 2: Write the failing callback component tests**

Append to `auth-callback.component.spec.ts` (follow the file's existing mock setup; extend the component's constructor mocks with `snackBar`, `dialog`, `stepUpService`, `transloco` per Step 3's constructor):

```typescript
  describe('step-up callback completion', () => {
    const stepUpState = btoa(
      JSON.stringify({ csrf: 'c'.repeat(32), returnUrl: '/admin/settings', stepUp: true }),
    );

    it('shows the redo snackbar after a successful step-up callback', () => {
      mockAuthService.handleOAuthCallback.mockReturnValue(of(true));
      mockAuthService.decodeState.mockReturnValue({
        csrf: 'c'.repeat(32),
        returnUrl: '/admin/settings',
        stepUp: true,
      });
      setCallbackQueryParams({ code: 'auth-code', state: stepUpState });

      component.ngOnInit();

      expect(mockSnackBar.open).toHaveBeenCalled();
    });

    it('does not show the snackbar for a normal login callback', () => {
      mockAuthService.handleOAuthCallback.mockReturnValue(of(true));
      mockAuthService.decodeState.mockReturnValue({ csrf: 'c'.repeat(32), returnUrl: '/tm' });
      setCallbackQueryParams({ code: 'auth-code', state: 'plainstate' });

      component.ngOnInit();

      expect(mockSnackBar.open).not.toHaveBeenCalled();
    });

    it('on identity_mismatch navigates to returnUrl then opens the mismatch dialog', async () => {
      mockAuthService.handleOAuthCallback.mockReturnValue(of(false));
      mockAuthService.lastAuthError = { code: 'identity_mismatch', message: '', retryable: true };
      mockAuthService.decodeState.mockReturnValue({
        csrf: 'c'.repeat(32),
        returnUrl: '/admin/settings',
        stepUp: true,
      });
      mockAuthService.userEmail = 'admin@example.com';
      mockRouter.navigateByUrl.mockResolvedValue(true);
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      setCallbackQueryParams({ code: 'auth-code', state: stepUpState });

      component.ngOnInit();
      await Promise.resolve(); // flush the navigateByUrl .then()

      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/admin/settings');
      expect(mockDialog.open).toHaveBeenCalled();
      // Generic error path (login redirect) must NOT run
      expect(mockRouter.navigate).not.toHaveBeenCalledWith(['/login']);
    });

    it('mismatch dialog "try again" re-initiates step-up', async () => {
      mockAuthService.handleOAuthCallback.mockReturnValue(of(false));
      mockAuthService.lastAuthError = { code: 'identity_mismatch', message: '', retryable: true };
      mockAuthService.decodeState.mockReturnValue({
        csrf: 'c'.repeat(32),
        returnUrl: '/admin/settings',
        stepUp: true,
      });
      mockAuthService.userProfile = { provider: 'google' };
      mockRouter.navigateByUrl.mockResolvedValue(true);
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      mockStepUpService.beginStepUp.mockReturnValue(of('redirecting'));
      setCallbackQueryParams({ code: 'auth-code', state: stepUpState });

      component.ngOnInit();
      await Promise.resolve();

      expect(mockStepUpService.beginStepUp).toHaveBeenCalledWith('google');
    });
  });
```

(`setCallbackQueryParams` = however the existing spec seeds `route.queryParams`; reuse its helper or pattern. Note the dialog/mismatch tests assume the component decodes state via `authService.decodeState` — the email getter name on AuthService must be verified at ~line 158–162 of `auth.service.ts` and the mock property named to match.)

- [ ] **Step 3: Run to verify the new tests fail, then implement**

Run: `pnpm run test src/app/auth/components/auth-callback/auth-callback.component.spec.ts` — new tests FAIL.

Changes to `auth-callback.component.ts`:

1. New injections (constructor params after `logger`): `private snackBar: MatSnackBar`, `private dialog: MatDialog`, `private stepUpService: StepUpService`, `private transloco: TranslocoService`. Imports accordingly (`MatSnackBar` from `@angular/material/snack-bar`, `MatDialog` from `@angular/material/dialog`, `TranslocoService` from `@jsverse/transloco`).

2. Replace the private `handleOAuthCallback` method:

```typescript
  private handleOAuthCallback(response: OAuthResponse): void {
    const decodedState = response.state ? this.authService.decodeState(response.state) : null;
    const isStepUp = decodedState?.stepUp === true;

    this.authService.handleOAuthCallback(response).subscribe({
      next: success => {
        if (success) {
          if (isStepUp) {
            // Strong-path step-up complete; AuthService navigated to returnUrl.
            // The blocked action did NOT happen — prompt the user to redo it.
            this.snackBar.open(this.transloco.translate('stepUp.redoPrompt'), undefined, {
              duration: 6000,
            });
          }
          // On success, AuthService handles navigation to dashboard/returnUrl
          return;
        }

        if (isStepUp && this.authService.lastAuthError?.code === 'identity_mismatch') {
          this.handleIdentityMismatch(decodedState?.returnUrl);
          return;
        }

        this.handleError({
          code: 'oauth_failed',
          message: 'login.oauthFailed',
          retryable: true,
        });
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'login.unexpectedError';
        this.handleError({
          code: 'oauth_error',
          message,
          retryable: true,
        });
      },
    });
  }

  /**
   * Step-up completed as the wrong identity. The original session is still
   * valid: return the user to where they were, then explain and offer retry.
   * Navigate BEFORE opening the dialog — MatDialog closes on navigation by default.
   */
  private handleIdentityMismatch(returnUrl?: string): void {
    const target = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
      ? returnUrl
      : '/';
    void this.router.navigateByUrl(target).then(() => {
      this.dialog
        .open(StepUpMismatchDialogComponent, {
          data: { email: this.authService.userEmail },
          width: '420px',
        })
        .afterClosed()
        .subscribe((retry: boolean | undefined) => {
          if (retry) {
            this.stepUpService
              .beginStepUp(this.authService.userProfile?.provider ?? '')
              .subscribe();
          }
        });
    });
  }
```

Note: `this.authService.userEmail` — verify the actual email getter name on `AuthService` (~line 158–162; it returns `this.userProfile?.email || ''`) and use that exact name here and in the spec mocks.

- [ ] **Step 4: Run the component spec**

Run: `pnpm run test src/app/auth/components/auth-callback/auth-callback.component.spec.ts`
Expected: PASS (new + pre-existing).

- [ ] **Step 5: Lint, build, commit**

Run: `pnpm run lint:all` and `pnpm run build` — clean.

```bash
git add src/app/auth/
git commit -m "feat(auth): step-up callback completion UX - redo prompt and identity-mismatch dialog (#680)"
```

---

### Task 7: i18n keys + backfill

- [ ] **Step 1: Master locale keys**

Add a top-level `stepUp` object to `src/assets/i18n/en-US.json` (alphabetical placement):

```json
"stepUp": {
  "confirmTitle": "Re-authentication required",
  "confirmBody": "This action requires recent authentication. You'll be redirected to sign in again. Unsaved changes on this page will be lost.",
  "confirmAction": "Re-authenticate",
  "redoPrompt": "Re-authentication complete — please retry your action.",
  "mismatchTitle": "Wrong account",
  "mismatchBody": "You must re-authenticate as {{email}} to complete this action.",
  "tryAgain": "Try again"
}
```

- [ ] **Step 2: Backfill all locales**

Invoke the `localization-backfill` (or `loc:backfill`) skill to translate the new keys into every locale file. Do not hand-translate.

- [ ] **Step 3: Validate and commit**

Run the `check_command` from `.claude/i18n.config.json`; confirm no missing `stepUp.*` keys.

```bash
git add src/assets/i18n/
git commit -m "chore(i18n): localize step-up flow strings (#680)"
```

---

### Task 8: Final verification

- [ ] **Step 1:** `pnpm run lint:all` — fix everything.
- [ ] **Step 2:** `pnpm run build` — fix all errors.
- [ ] **Step 3:** `pnpm test` — full suite, no failures, no skips; troubleshoot to root cause.
- [ ] **Step 4:** Invoke `superpowers:requesting-code-review` before final commit.
- [ ] **Step 5: Manual smoke check** (requires a server with tmi#455 deployed; skip with a note if unavailable): as an admin with a stale `auth_time`, edit a setting on the admin settings page → confirm dialog appears → re-authenticate at the IdP → land back on the settings page with the redo snackbar → redo the edit → succeeds. With a github (weak) account: the edit succeeds with no dialog and no message. Wrong-account flow: pick a different account at the IdP → mismatch dialog names the original email → Try again re-initiates.
- [ ] **Step 6: Close out** — comment on tmi-ux#680 referencing the commits and close the issue explicitly (`gh issue comment 680 --body "..."` then `gh issue close 680`); commits on `dev/1.4.0` do not auto-close.
