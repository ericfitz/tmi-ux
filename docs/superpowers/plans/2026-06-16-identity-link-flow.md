# Identity-Link Confirmation Flow + Identities Management View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user bind a second OAuth/SAML identity to their TMI account through an explicit, consent-bearing confirmation screen, and manage (list/unlink) their linked identities — GitHub issue #731.

**Architecture:** A new `IdentityLinkService` wraps the five `/me/identities*` server endpoints. The link flow is redirect-based: a "Link another account" action calls `link/start`, then top-level-navigates to the returned `authorization_url`; the IdP round-trip redirects back to a **dedicated** client route `/oauth2/link/callback?link_pending={token}`, which renders the consent confirmation screen (both identities named) and calls `link/confirm`. Three endpoints (`link/start`, `link/confirm`, unlink `DELETE`) require step-up-fresh auth and return `401 insufficient_user_authentication` when the session `auth_time` is stale; we add a **minimal** `AuthService.initiateStepUp(returnUrl)` that top-level-redirects to `/oauth2/step_up` and reuses the existing `/oauth2/callback` token-exchange to refresh `auth_time`, landing the user back at the originating URL to retry. A new "Linked accounts" tab in the user-preferences dialog hosts the list/unlink UI, mirroring the existing `connected-accounts-tab`.

**Tech Stack:** Angular standalone components (OnPush), RxJS, Transloco i18n, Angular Material, Vitest unit tests. Generated API types in `src/app/generated/api-types.d.ts` (already regenerated for these endpoints in commit `2fb99f66`).

---

## Background facts (verified against server `dev/1.4.0`)

Server design spec: `tmi` repo `docs/superpowers/specs/2026-06-11-383-identity-link-design.md` (server side landed, tmi#383 closed 2026-06-12).

**Endpoints (all under `/me/identities`):**

| Method/Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /me/identities/link/start?idp={p}&client_callback={url}` | JWT + **step-up** | query params (POST, empty body) | `200 {link_state, authorization_url, expires_at}` | 400, 401(step-up), 403(service acct), 404(unknown idp), 503 |

> **CORRECTION (post-review):** `link/start` is **POST** with `idp`/`client_callback` as **query** params and an empty body — NOT GET. `ApiService.post(endpoint, body)` takes no params arg, so call it as `api.post(\`me/identities/link/start?${qs}\`, {})` where `qs` is a URL-encoded query string.
| `GET /me/identities/link/pending/{link_id}` | JWT (UUID-matched) | path token | `200 {pending:{provider,provider_user_id,email?,name?}, account:{provider,email,name?}}` | 404(expired/foreign) |
| `POST /me/identities/link/confirm` | JWT + **step-up** | body `{token}` | `201 LinkedIdentity` | 400, 401(step-up), 404(expired), 409(`identity_already_bound`), 503 |
| `GET /me/identities` | JWT | — | `200 {primary:{provider,email,name?}, linked?:LinkedIdentity[]}` | 401, 403(service acct) |
| `DELETE /me/identities/{id}` | JWT + **step-up** | path id | `204` | 401(step-up), 404(not owned), 503 |

`LinkedIdentity = {id, provider, provider_user_id, email?, name?, linked_at, last_used_at?}`.

**Error envelope (RFC6749 style):** `{ error: string, error_description?: string, error_uri?: string }`. So a 409 surfaces as `httpError.error.error === 'identity_already_bound'`.

**Step-up challenge:** the three step-up endpoints return `401` with header `WWW-Authenticate: ... insufficient_user_authentication` when `auth_time` is stale. The client detects `status===401 && WWW-Authenticate contains 'insufficient_user_authentication'`.

> **CORRECTION (post-review) — interceptor must let the step-up 401 through.** `JwtInterceptor` (`src/app/auth/interceptors/jwt.interceptor.ts`) intercepts every 401 on authenticated `/me/*` requests and runs `forceRefreshToken()` → retry → **logout** on the second 401. A step-up 401 has a *valid* JWT (only `auth_time` is stale), so refresh "succeeds", the retry 401s again, and the user is logged out — `IdentityLinkService.mapStepUp` never sees the error. **Fix (decided with user — Option B):** add a branch in `JwtInterceptor.intercept`, BEFORE the refresh path (line ~74), that detects `error.status === 401 && (WWW-Authenticate header).toLowerCase().includes('insufficient_user_authentication')` and propagates the error via `handleError(error, request)` WITHOUT refreshing. Generic 401s still auto-refresh; only the step-up challenge passes through. This is the end-state #680 also wants.

**`/oauth2/step_up` (GET)** params: `client_callback`, `state`, `code_challenge`, `code_challenge_method` — identical to the login authorize flow. Strong providers (Google/OIDC/SAML) → `302` to IdP (works via top-level navigation). Weak providers (GitHub) → `200 {result:"step_up_weak_complete", ...}` JSON short-circuit.

**KNOWN LIMITATION (in scope to document, out of scope to solve):** For a **GitHub-primary** user, a top-level navigation to `/oauth2/step_up` renders raw JSON instead of redirecting. There is no clean client-side fix without server issue **tmi#455** (XHR/JSON content negotiation), which gates #680. The client must **not** hardcode a provider-strength table (that duplication is exactly what tmi#455 exists to avoid). This plan delivers seamless step-up for Google/SAML/OIDC-primary users; GitHub-primary step-up is a documented gap tracked by #680. The link flow's *own* IdP round-trip (e.g. linking a GitHub account *to* a Google-primary account) is unaffected — that is a normal authorize redirect.

## Reference files to mirror (read these before implementing)

- `src/app/core/components/user-preferences-dialog/connected-accounts-tab/connected-accounts-tab.component.ts` — table + connect/unlink UI pattern (mirror for the identities tab)
- `src/app/core/components/user-preferences-dialog/connected-accounts-tab/unlink-confirm-dialog.component.ts` — confirm-dialog pattern
- `src/app/core/components/content-callback/content-callback.component.ts` — OAuth callback component pattern
- `src/app/auth/services/auth.service.ts:658-748` — `initiateTMIOAuthLogin`, `generateRandomState` (reuse for step-up)
- `src/app/types/client-credential.types.ts` — generated-type aliasing pattern (`import type { components } from '@app/generated/api-types'`)
- `src/app/core/services/api.service.ts` — `get`/`post`/`delete<T>(endpoint)` wrappers (base URL prepended; do NOT include leading `/`)

## File Structure

**Create:**
- `src/app/auth/models/identity-link.types.ts` — type aliases + step-up error class + error-code constants
- `src/app/auth/services/identity-link.service.ts` — API wrapper + error mapping
- `src/app/auth/services/identity-link.service.spec.ts`
- `src/app/auth/components/identity-link-callback/identity-link-callback.component.ts` — dedicated callback + confirmation screen
- `src/app/auth/components/identity-link-callback/identity-link-callback.component.html`
- `src/app/auth/components/identity-link-callback/identity-link-callback.component.scss`
- `src/app/auth/components/identity-link-callback/identity-link-callback.component.spec.ts`
- `src/app/core/components/user-preferences-dialog/identities-tab/identities-tab.component.ts` — "Linked accounts" tab (inline template, mirror connected-accounts-tab)
- `src/app/core/components/user-preferences-dialog/identities-tab/identities-tab.component.spec.ts`
- `src/app/core/components/user-preferences-dialog/identities-tab/unlink-identity-dialog.component.ts` — confirm dialog

**Modify:**
- `src/app/auth/services/auth.service.ts` — add `initiateStepUp(returnUrl: string)`
- `src/app/app.routes.ts` — register `/oauth2/link/callback`
- `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts` — add "Linked accounts" `<mat-tab>`, import the tab, add tab-index constant + `initialTab` branch
- `src/assets/i18n/en-US.json` — add `identities.*` keys (then backfill other locales)

---

### Task 1: Identity-link types and error model

**Files:**
- Create: `src/app/auth/models/identity-link.types.ts`

- [ ] **Step 1: Write the type-alias + error model file**

```typescript
import type { components } from '@app/generated/api-types';

/** A single linked (secondary) identity. */
export type LinkedIdentity = components['schemas']['LinkedIdentity'];

/** Response of POST /me/identities/link/start. */
export type IdentityLinkStartResponse = components['schemas']['IdentityLinkStartResponse'];

/** Response of GET /me/identities/link/pending/{link_id}. */
export type PendingIdentityLinkResponse =
  components['schemas']['PendingIdentityLinkResponse'];

/** Response of GET /me/identities (primary + linked). */
export type MyIdentitiesResponse = components['schemas']['MyIdentitiesResponse'];

/** The primary identity sub-object inside MyIdentitiesResponse. */
export type PrimaryIdentity = MyIdentitiesResponse['primary'];

/** Server error codes we branch on (RFC6749 `error` field). */
export const IDENTITY_LINK_ERROR = {
  alreadyBound: 'identity_already_bound',
  identityMismatch: 'identity_mismatch',
} as const;

/**
 * Thrown by IdentityLinkService when a step-up-protected call returns
 * 401 + WWW-Authenticate: insufficient_user_authentication. The caller is
 * expected to invoke AuthService.initiateStepUp(returnUrl) and retry.
 */
export class StepUpRequiredError extends Error {
  constructor() {
    super('insufficient_user_authentication');
    this.name = 'StepUpRequiredError';
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep identity-link.types || echo "OK no errors in file"`
Expected: `OK no errors in file`

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/models/identity-link.types.ts
git commit -m "feat(auth): add identity-link type aliases and step-up error model (#731)"
```

---

### Task 2: IdentityLinkService

Wraps the five endpoints. Detects the step-up 401 and rethrows `StepUpRequiredError`. Lets other HTTP errors pass through (callers branch on `error.error`).

**Files:**
- Create: `src/app/auth/services/identity-link.service.ts`
- Test: `src/app/auth/services/identity-link.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IdentityLinkService } from './identity-link.service';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { StepUpRequiredError } from '../models/identity-link.types';

describe('IdentityLinkService', () => {
  let service: IdentityLinkService;
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        IdentityLinkService,
        { provide: ApiService, useValue: api },
        { provide: LoggerService, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
      ],
    });
    service = TestBed.inject(IdentityLinkService);
  });

  it('listIdentities() calls GET me/identities', async () => {
    api.get.mockReturnValue(of({ primary: { provider: 'google', email: 'a@b.com' }, linked: [] }));
    const res = await firstValueFrom(service.listIdentities());
    expect(api.get).toHaveBeenCalledWith('me/identities');
    expect(res.primary.provider).toBe('google');
  });

  it('startLink() passes idp and the link callback URL', async () => {
    api.get.mockReturnValue(of({ link_state: 's', authorization_url: 'https://idp', expires_at: 'x' }));
    await firstValueFrom(service.startLink('github'));
    expect(api.get).toHaveBeenCalledWith(
      'me/identities/link/start',
      expect.objectContaining({ idp: 'github', client_callback: `${window.location.origin}/oauth2/link/callback` }),
    );
  });

  it('confirmLink() POSTs the token', async () => {
    api.post.mockReturnValue(of({ id: '1', provider: 'github', provider_user_id: 'gh…', linked_at: 'x' }));
    await firstValueFrom(service.confirmLink('tok'));
    expect(api.post).toHaveBeenCalledWith('me/identities/link/confirm', { token: 'tok' });
  });

  it('maps 401 insufficient_user_authentication to StepUpRequiredError', async () => {
    const err = new HttpErrorResponse({
      status: 401,
      headers: new HttpHeaders({ 'WWW-Authenticate': 'Bearer error="insufficient_user_authentication"' }),
    });
    api.post.mockReturnValue(throwError(() => err));
    await expect(firstValueFrom(service.confirmLink('tok'))).rejects.toBeInstanceOf(StepUpRequiredError);
  });

  it('passes a plain 409 through unchanged', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { error: 'identity_already_bound' } });
    api.post.mockReturnValue(throwError(() => err));
    await expect(firstValueFrom(service.confirmLink('tok'))).rejects.toBe(err);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/auth/services/identity-link.service.spec.ts`
Expected: FAIL — cannot find module `./identity-link.service`.

- [ ] **Step 3: Write the service**

```typescript
import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  IdentityLinkStartResponse,
  LinkedIdentity,
  MyIdentitiesResponse,
  PendingIdentityLinkResponse,
  StepUpRequiredError,
} from '../models/identity-link.types';

/**
 * Wraps the /me/identities* endpoints. Step-up-protected calls that return
 * 401 + WWW-Authenticate: insufficient_user_authentication are rethrown as
 * StepUpRequiredError so callers can run AuthService.initiateStepUp and retry.
 * All other HTTP errors pass through unchanged (callers branch on error.error).
 */
@Injectable({ providedIn: 'root' })
export class IdentityLinkService {
  /** Where the IdP round-trip redirects back to with link_pending={token}. */
  readonly linkCallbackUrl = `${window.location.origin}/oauth2/link/callback`;

  constructor(
    private api: ApiService,
    private logger: LoggerService,
  ) {}

  listIdentities(): Observable<MyIdentitiesResponse> {
    return this.api.get<MyIdentitiesResponse>('me/identities').pipe(this.mapStepUp());
  }

  startLink(idp: string): Observable<IdentityLinkStartResponse> {
    // POST with query params + empty body (ApiService.post takes no params arg).
    const qs = new URLSearchParams({ idp, client_callback: this.linkCallbackUrl }).toString();
    return this.api
      .post<IdentityLinkStartResponse>(`me/identities/link/start?${qs}`, {})
      .pipe(this.mapStepUp());
  }

  getPending(token: string): Observable<PendingIdentityLinkResponse> {
    return this.api
      .get<PendingIdentityLinkResponse>(`me/identities/link/pending/${encodeURIComponent(token)}`)
      .pipe(this.mapStepUp());
  }

  confirmLink(token: string): Observable<LinkedIdentity> {
    return this.api
      .post<LinkedIdentity>('me/identities/link/confirm', { token })
      .pipe(this.mapStepUp());
  }

  unlink(id: string): Observable<void> {
    return this.api
      .delete<void>(`me/identities/${encodeURIComponent(id)}`)
      .pipe(this.mapStepUp());
  }

  /** Rethrow the step-up 401 as StepUpRequiredError; pass everything else through. */
  private mapStepUp<T>() {
    return catchError<T, Observable<T>>((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const challenge = err.headers?.get('WWW-Authenticate') ?? '';
        if (challenge.includes('insufficient_user_authentication')) {
          this.logger.info('Identity-link call requires step-up re-authentication');
          return throwError(() => new StepUpRequiredError());
        }
      }
      return throwError(() => err);
    });
  }
}
```

> NOTE: confirm `ApiService.get`'s second argument accepts a plain params object (`Record<string, string>`). It does — see `api.service.ts:78`. If it requires `HttpParams`, adapt by building `new HttpParams({ fromObject: {...} })`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/app/auth/services/identity-link.service.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/services/identity-link.service.ts src/app/auth/services/identity-link.service.spec.ts
git commit -m "feat(auth): add IdentityLinkService wrapping /me/identities endpoints (#731)"
```

---

### Task 3: AuthService.initiateStepUp

Minimal strong-path step-up: build the `/oauth2/step_up` URL (PKCE + state-encoded returnUrl, primary provider recorded for the token exchange) and top-level-navigate. The existing `/oauth2/callback` handler exchanges the returned code, refreshes `auth_time`, and redirects to `returnUrl`. Reuses `generateRandomState`, `pkceService`, and the `oauth_state`/`oauth_provider` localStorage contract used by login.

**Files:**
- Modify: `src/app/auth/services/auth.service.ts` (add method near `initiateTMIOAuthLogin`, ~line 721)
- Test: `src/app/auth/services/auth.service.spec.ts` (add a describe block; if no spec exists, create `src/app/auth/services/auth.service.step-up.spec.ts`)

- [ ] **Step 1: Read the existing `initiateTMIOAuthLogin` and `generateRandomState`**

Read `src/app/auth/services/auth.service.ts:653-748` to match exact field names (`pkceService.generatePkceParameters()` returns `{ codeChallenge, codeChallengeMethod }`; `environment.apiUrl`; `userProfile` getter exposes `.provider`).

- [ ] **Step 2: Write the failing test**

```typescript
// src/app/auth/services/auth.service.step-up.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// This is a focused unit test of URL construction. Adapt the harness to the
// project's existing AuthService spec setup (see auth.service.spec.ts) — reuse
// its TestBed providers and mocks rather than re-mocking everything here.
describe('AuthService.initiateStepUp', () => {
  let hrefSpy: { value: string };

  beforeEach(() => {
    hrefSpy = { value: '' };
    // Stub window.location.href assignment
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test', href: '', assign: (u: string) => (hrefSpy.value = u) },
      writable: true,
    });
  });

  it('builds an /oauth2/step_up URL with state, client_callback, and PKCE params', async () => {
    // Pseudocode — wire to the real AuthService instance from the shared spec harness:
    //   await service.initiateStepUp('/dashboard?openPrefs=identities');
    //   expect(navigatedUrl).toContain('/oauth2/step_up?');
    //   expect(navigatedUrl).toContain('client_callback=' + encodeURIComponent('https://app.test/oauth2/callback'));
    //   expect(navigatedUrl).toContain('code_challenge=');
    //   expect(navigatedUrl).toContain('code_challenge_method=S256');
    expect(true).toBe(true); // replace with real assertions against the AuthService harness
  });
});
```

> NOTE: The repo already has `auth.service.spec.ts`. Prefer adding a `describe('initiateStepUp')` block there using the existing TestBed setup (it already mocks `PkceService`, `ApiService`, etc.). The standalone file above is only a fallback shape — replace its pseudocode with real assertions wired to that harness.

- [ ] **Step 3: Add the method to AuthService**

Insert after `initiateTMIOAuthLogin` (around line 721), before `generateRandomState`:

```typescript
  /**
   * Initiate a step-up (fresh-prompt) re-authentication for the current user.
   *
   * Used by step-up-protected flows (e.g. identity-link start/confirm/unlink)
   * after a 401 insufficient_user_authentication. Builds the /oauth2/step_up
   * URL with PKCE + state-encoded returnUrl and top-level-navigates; the
   * existing /oauth2/callback handler exchanges the returned code, refreshing
   * auth_time, then redirects back to returnUrl where the caller retries.
   *
   * LIMITATION: for a weak-provider primary (e.g. GitHub) the server returns
   * 200 JSON instead of a 302 redirect; this top-level navigation renders that
   * JSON. Seamless weak-provider step-up is tracked by #680 / server tmi#455.
   *
   * @param returnUrl App URL to land on after step-up completes (e.g.
   *   '/dashboard?openPrefs=identities' or the link confirmation route).
   */
  async initiateStepUp(returnUrl: string): Promise<void> {
    try {
      const providerId = this.userProfile?.provider;
      if (!providerId) {
        this.logger.error('Cannot initiate step-up: no current user profile');
        return;
      }

      const pkceParams = await this.pkceService.generatePkceParameters();
      const state = this.generateRandomState(returnUrl);
      localStorage.setItem('oauth_state', state);
      localStorage.setItem('oauth_provider', providerId);

      const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
      const baseUrl = environment.apiUrl.endsWith('/')
        ? environment.apiUrl.slice(0, -1)
        : environment.apiUrl;
      const stepUpUrl =
        `${baseUrl}/oauth2/step_up?` +
        `state=${state}` +
        `&client_callback=${encodeURIComponent(clientCallbackUrl)}` +
        `&code_challenge=${encodeURIComponent(pkceParams.codeChallenge)}` +
        `&code_challenge_method=${pkceParams.codeChallengeMethod}`;

      window.location.href = stepUpUrl;
    } catch (error) {
      this.handleAuthError({
        code: 'step_up_init_error',
        message: 'Failed to initialize step-up re-authentication',
        retryable: true,
      });
      this.logger.error('Error initializing step-up', error);
    }
  }
```

Confirm `environment` is already imported in `auth.service.ts` (it is — `apiUrl` is used elsewhere). If not, add `import { environment } from '../../../environments/environment';`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm exec vitest run src/app/auth/services/auth.service.spec.ts src/app/auth/services/auth.service.step-up.spec.ts`
Expected: PASS. Then `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep auth.service.ts || echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/services/auth.service.ts src/app/auth/services/auth.service*.spec.ts
git commit -m "feat(auth): add AuthService.initiateStepUp strong-path step-up redirect (#731)"
```

---

### Task 4: Identity-link callback + confirmation screen

The dedicated route `/oauth2/link/callback`. Reads `link_pending={token}` (or `error=...`) from query params. On token: fetch pending details, render BOTH identities with the consent copy, Confirm/Cancel. Confirm → `confirmLink`; on `StepUpRequiredError` → `initiateStepUp(thisUrl)`; on 201 → snackbar + navigate to `/dashboard?openPrefs=identities`; on 409 `identity_already_bound` → error state; on 404 → "expired" error state. On an `error` query param → render the matching error state without calling the server.

**Files:**
- Create: `src/app/auth/components/identity-link-callback/identity-link-callback.component.ts` / `.html` / `.scss`
- Test: `src/app/auth/components/identity-link-callback/identity-link-callback.component.spec.ts`
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Write the component**

`identity-link-callback.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

import { IdentityLinkService } from '../../services/identity-link.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  IDENTITY_LINK_ERROR,
  PendingIdentityLinkResponse,
  StepUpRequiredError,
} from '../../models/identity-link.types';

type ViewState = 'loading' | 'confirm' | 'submitting' | 'error';

@Component({
  selector: 'app-identity-link-callback',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslocoModule,
  ],
  templateUrl: './identity-link-callback.component.html',
  styleUrls: ['./identity-link-callback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityLinkCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private identityLink = inject(IdentityLinkService);
  private auth = inject(AuthService);
  private transloco = inject(TranslocoService);
  private logger = inject(LoggerService);

  state: ViewState = 'loading';
  /** i18n key for the error message when state === 'error'. */
  errorKey = 'identities.link.error.generic';
  pending: PendingIdentityLinkResponse | null = null;
  private token = '';

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const error = params['error'] as string | undefined;
      const token = params['link_pending'] as string | undefined;

      if (error) {
        this.errorKey =
          error === IDENTITY_LINK_ERROR.alreadyBound
            ? 'identities.link.error.alreadyBound'
            : 'identities.link.error.generic';
        this.state = 'error';
        return;
      }
      if (!token) {
        this.errorKey = 'identities.link.error.generic';
        this.state = 'error';
        return;
      }

      this.token = token;
      this.loadPending(token);
    });
  }

  private loadPending(token: string): void {
    this.identityLink.getPending(token).subscribe({
      next: details => {
        this.pending = details;
        this.state = 'confirm';
      },
      error: (err: unknown) => {
        this.logger.warn('Failed to load pending identity link', err);
        this.errorKey = 'identities.link.error.expired'; // 404 = expired/foreign
        this.state = 'error';
      },
    });
  }

  onConfirm(): void {
    this.state = 'submitting';
    this.identityLink.confirmLink(this.token).subscribe({
      next: () => {
        this.snackBar.open(this.transloco.translate('identities.link.success'), undefined, {
          duration: 4000,
        });
        void this.router.navigateByUrl('/dashboard?openPrefs=identities');
      },
      error: (err: unknown) => this.handleConfirmError(err),
    });
  }

  onCancel(): void {
    void this.router.navigateByUrl('/dashboard?openPrefs=identities');
  }

  private handleConfirmError(err: unknown): void {
    if (err instanceof StepUpRequiredError) {
      // Re-authenticate fresh, then return here to retry. Token may expire
      // during the round-trip (5-min TTL) -> a subsequent 404 shows 'expired'.
      void this.auth.initiateStepUp(`/oauth2/link/callback?link_pending=${encodeURIComponent(this.token)}`);
      return;
    }
    const code = (err as { error?: { error?: string } })?.error?.error;
    if (code === IDENTITY_LINK_ERROR.alreadyBound) {
      this.errorKey = 'identities.link.error.alreadyBound';
    } else if ((err as { status?: number })?.status === 404) {
      this.errorKey = 'identities.link.error.expired';
    } else {
      this.errorKey = 'identities.link.error.generic';
    }
    this.logger.warn('Identity-link confirm failed', err);
    this.state = 'error';
  }
}
```

`identity-link-callback.component.html`:

```html
<div class="identity-link-callback">
  <mat-card>
    @switch (state) {
      @case ('loading') {
        <div class="centered" data-testid="link-loading">
          <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
          <p [transloco]="'identities.link.loading'">Loading…</p>
        </div>
      }
      @case ('submitting') {
        <div class="centered" data-testid="link-submitting">
          <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
          <p [transloco]="'identities.link.submitting'">Linking…</p>
        </div>
      }
      @case ('error') {
        <div class="centered" data-testid="link-error">
          <h2 [transloco]="'identities.link.error.title'">Could not link account</h2>
          <p>{{ errorKey | transloco }}</p>
          <button mat-flat-button color="primary" (click)="onCancel()" cdkFocusInitial>
            {{ 'common.close' | transloco }}
          </button>
        </div>
      }
      @case ('confirm') {
        <div class="confirm" data-testid="link-confirm">
          <h2 [transloco]="'identities.link.confirm.title'">Confirm account link</h2>
          <p
            [innerHTML]="
              'identities.link.confirm.body'
                | transloco
                  : {
                      linkProvider: pending?.pending?.provider,
                      linkEmail: pending?.pending?.email || pending?.pending?.provider_user_id,
                      accountEmail: pending?.account?.email,
                      accountProvider: pending?.account?.provider
                    }
            "
          ></p>
          <p class="warning" [transloco]="'identities.link.confirm.warning'">
            Whoever controls the linked identity will be able to sign in to your account.
          </p>
          <p class="expiry" [transloco]="'identities.link.confirm.expiry'">
            This confirmation expires in 5 minutes.
          </p>
          <div class="actions">
            <button mat-button (click)="onCancel()" data-testid="link-cancel">
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              mat-flat-button
              color="primary"
              cdkFocusInitial
              (click)="onConfirm()"
              data-testid="link-confirm-button"
            >
              {{ 'identities.link.confirm.confirmButton' | transloco }}
            </button>
          </div>
        </div>
      }
    }
  </mat-card>
</div>
```

> NOTE on `[innerHTML]` + transloco interpolation: the confirm body needs both identities **named** (issue AC). Using `innerHTML` lets the i18n string bold the identities. Sanitize is handled by Angular's default `DomSanitizer` for `innerHTML`. If the project lints against `innerHTML`, fall back to composing the sentence from separate translated spans in the template (no HTML in the i18n value).

`identity-link-callback.component.scss`:

```scss
.identity-link-callback {
  display: flex;
  justify-content: center;
  padding: 48px 16px;

  mat-card {
    max-width: 480px;
    width: 100%;
    padding: 24px;
  }

  .centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }

  .confirm .warning {
    color: var(--theme-text-secondary);
    font-size: 13px;
  }

  .confirm .expiry {
    color: var(--theme-text-secondary);
    font-size: 12px;
  }

  .confirm .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
}
```

- [ ] **Step 2: Register the route**

In `src/app/app.routes.ts`, after the `oauth2/content-callback` route block (around line 47-52), add:

```typescript
  {
    path: 'oauth2/link/callback',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        /* webpackChunkName: "identity-link-callback" */ './auth/components/identity-link-callback/identity-link-callback.component'
      ).then(c => c.IdentityLinkCallbackComponent),
  },
```

(`authGuard` is already imported at the top of the file.)

- [ ] **Step 3: Write the component spec**

```typescript
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IdentityLinkCallbackComponent } from './identity-link-callback.component';
import { IdentityLinkService } from '../../services/identity-link.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import { getTranslocoModule } from '@testing/transloco-testing'; // adjust to the repo's helper
import { StepUpRequiredError } from '../../models/identity-link.types';

function setup(queryParams: Record<string, string>) {
  const identityLink = {
    getPending: vi.fn(),
    confirmLink: vi.fn(),
  };
  const auth = { initiateStepUp: vi.fn() };
  const router = { navigateByUrl: vi.fn() };
  TestBed.configureTestingModule({
    imports: [IdentityLinkCallbackComponent, getTranslocoModule()],
    providers: [
      { provide: IdentityLinkService, useValue: identityLink },
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: LoggerService, useValue: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } },
      { provide: ActivatedRoute, useValue: { queryParams: of(queryParams) } },
    ],
  });
  const fixture = TestBed.createComponent(IdentityLinkCallbackComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, identityLink, auth, router };
}

describe('IdentityLinkCallbackComponent', () => {
  it('renders error state for an error query param without calling the server', () => {
    const { cmp, identityLink } = setup({ error: 'identity_already_bound' });
    expect(cmp.state).toBe('error');
    expect(cmp.errorKey).toBe('identities.link.error.alreadyBound');
    expect(identityLink.getPending).not.toHaveBeenCalled();
  });

  it('loads pending details and shows confirm state', () => {
    const { cmp } = (() => {
      const s = setup({ link_pending: 'tok' });
      s.identityLink.getPending.mockReturnValue(
        of({ pending: { provider: 'github', provider_user_id: 'gh…' }, account: { provider: 'google', email: 'a@b.com' } }),
      );
      s.fixture.componentInstance.ngOnInit();
      return s;
    })();
    expect(cmp.state).toBe('confirm');
  });

  it('confirm StepUpRequiredError triggers initiateStepUp', () => {
    const s = setup({ link_pending: 'tok' });
    s.identityLink.getPending.mockReturnValue(
      of({ pending: { provider: 'github', provider_user_id: 'gh…' }, account: { provider: 'google', email: 'a@b.com' } }),
    );
    s.fixture.componentInstance.ngOnInit();
    s.identityLink.confirmLink.mockReturnValue(throwError(() => new StepUpRequiredError()));
    s.cmp.onConfirm();
    expect(s.auth.initiateStepUp).toHaveBeenCalledWith(
      '/oauth2/link/callback?link_pending=tok',
    );
  });
});
```

> NOTE: adjust the transloco test-module import to the repo's actual helper (search `getTranslocoModule` or `TranslocoTestingModule` under `src/testing/`). If the harness double-runs `ngOnInit`, simplify by driving state directly.

- [ ] **Step 4: Run the spec**

Run: `pnpm exec vitest run src/app/auth/components/identity-link-callback/identity-link-callback.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/components/identity-link-callback src/app/app.routes.ts
git commit -m "feat(auth): add identity-link callback + consent confirmation screen (#731)"
```

---

### Task 5: Unlink confirmation dialog

Mirror `unlink-confirm-dialog.component.ts`. Names the identity being removed.

**Files:**
- Create: `src/app/core/components/user-preferences-dialog/identities-tab/unlink-identity-dialog.component.ts`

- [ ] **Step 1: Write the dialog**

```typescript
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

export interface UnlinkIdentityDialogData {
  /** Display label of the identity being unlinked (email or provider/sub). */
  identityLabel: string;
}

@Component({
  selector: 'app-unlink-identity-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslocoModule],
  template: `
    <h2 mat-dialog-title>
      {{ 'identities.unlink.confirmTitle' | transloco: { identity: data.identityLabel } }}
    </h2>
    <mat-dialog-content>
      <p [transloco]="'identities.unlink.confirmBody'">
        That identity will no longer be able to sign in to this account.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        cdkFocusInitial
        (click)="ref.close(false)"
        [transloco]="'common.cancel'"
        data-testid="unlink-identity-cancel"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="ref.close(true)"
        [transloco]="'identities.unlink.action'"
        data-testid="unlink-identity-confirm"
      >
        Unlink
      </button>
    </mat-dialog-actions>
  `,
})
export class UnlinkIdentityDialogComponent {
  constructor(
    public ref: MatDialogRef<UnlinkIdentityDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: UnlinkIdentityDialogData,
  ) {}
}
```

(`cdkFocusInitial` on Cancel because the primary action is destructive — per CLAUDE.md dialog-ordering exception.)

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep unlink-identity-dialog || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/components/user-preferences-dialog/identities-tab/unlink-identity-dialog.component.ts
git commit -m "feat(auth): add unlink-identity confirmation dialog (#731)"
```

---

### Task 6: "Linked accounts" identities tab

Mirror `connected-accounts-tab`. Lists primary (no unlink) + linked identities (with unlink). "Link another account" → provider menu (reuse `AuthService.getAvailableProviders()`) → `startLink(idp)` → top-level navigate to `authorization_url`; on `StepUpRequiredError` → `initiateStepUp('/dashboard?openPrefs=identities')`. Unlink → confirm dialog → `unlink(id)`; on `StepUpRequiredError` → same step-up.

**Files:**
- Create: `src/app/core/components/user-preferences-dialog/identities-tab/identities-tab.component.ts`
- Test: `src/app/core/components/user-preferences-dialog/identities-tab/identities-tab.component.spec.ts`

- [ ] **Step 1: Write the component** (inline template, mirroring `connected-accounts-tab.component.ts` styles)

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IdentityLinkService } from '@app/auth/services/identity-link.service';
import { AuthService } from '@app/auth/services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  LinkedIdentity,
  MyIdentitiesResponse,
  StepUpRequiredError,
} from '@app/auth/models/identity-link.types';
import type { OAuthProviderInfo } from '@app/auth/models/auth.models';
import {
  UnlinkIdentityDialogComponent,
  type UnlinkIdentityDialogData,
} from './unlink-identity-dialog.component';

@Component({
  selector: 'app-identities-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule,
    TranslocoModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="identities-tab">
      <h3 class="section-header" [transloco]="'identities.tabTitle'">Linked accounts</h3>
      <p class="section-help" [transloco]="'identities.help'">
        Accounts you can use to sign in to TMI.
      </p>

      @if (identities(); as ids) {
        <table mat-table [dataSource]="rows(ids)" class="identities-table">
          <ng-container matColumnDef="provider">
            <th mat-header-cell *matHeaderCellDef>{{ 'identities.columns.provider' | transloco }}</th>
            <td mat-cell *matCellDef="let r" data-testid="identity-row">{{ r.provider }}</td>
          </ng-container>
          <ng-container matColumnDef="account">
            <th mat-header-cell *matHeaderCellDef>{{ 'identities.columns.account' | transloco }}</th>
            <td mat-cell *matCellDef="let r">{{ r.label }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              @if (r.isPrimary) {
                <mat-chip [disabled]="true" color="primary">
                  {{ 'identities.primary' | transloco }}
                </mat-chip>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              @if (!r.isPrimary) {
                <button
                  mat-icon-button
                  color="warn"
                  (click)="onUnlink(r)"
                  [matTooltip]="'identities.unlink.action' | transloco"
                  [attr.aria-label]="'identities.unlink.action' | transloco"
                  [attr.data-testid]="'identity-unlink-' + r.id"
                >
                  <mat-icon>link_off</mat-icon>
                </button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      }

      <div class="identities-actions">
        <button
          mat-flat-button
          color="primary"
          [matMenuTriggerFor]="providerMenu"
          [disabled]="linkableProviders().length === 0"
          data-testid="identities-link-menu"
        >
          <mat-icon>add_link</mat-icon>
          <span [transloco]="'identities.linkNew'">Link another account</span>
        </button>
        <mat-menu #providerMenu="matMenu">
          @for (p of linkableProviders(); track p.id) {
            <button mat-menu-item (click)="onLink(p.id)" [attr.data-testid]="'identities-link-' + p.id">
              {{ p.name }}
            </button>
          }
        </mat-menu>
      </div>
    </div>
  `,
  styles: [
    `
      .identities-tab { padding: 16px 0; }
      .section-header { margin: 0 0 4px 0; font-size: 16px; font-weight: 500; }
      .section-help { margin: 0 0 12px 0; font-size: 13px; color: var(--theme-text-secondary); }
      .identities-table { width: 100%; margin-bottom: 16px; }
      .identities-actions { margin-top: 12px; }
    `,
  ],
})
export class IdentitiesTabComponent implements OnInit {
  private identityLink = inject(IdentityLinkService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private logger = inject(LoggerService);

  readonly displayedColumns = ['provider', 'account', 'role', 'actions'];
  readonly identities = signal<MyIdentitiesResponse | null>(null);
  readonly linkableProviders = signal<OAuthProviderInfo[]>([]);

  ngOnInit(): void {
    this.refresh();
    this.auth
      .getAvailableProviders()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: providers => this.linkableProviders.set(providers),
        error: (err: unknown) => this.logger.warn('Failed to load providers', err),
      });
  }

  /** Flatten primary + linked into display rows. */
  rows(ids: MyIdentitiesResponse): Array<{
    id: string;
    provider: string;
    label: string;
    isPrimary: boolean;
  }> {
    const primary = {
      id: 'primary',
      provider: ids.primary.provider,
      label: ids.primary.email || ids.primary.name || ids.primary.provider,
      isPrimary: true,
    };
    const linked = (ids.linked ?? []).map((l: LinkedIdentity) => ({
      id: l.id,
      provider: l.provider,
      label: l.email || l.name || l.provider_user_id,
      isPrimary: false,
    }));
    return [primary, ...linked];
  }

  private refresh(): void {
    this.identityLink.listIdentities().subscribe({
      next: ids => this.identities.set(ids),
      error: (err: unknown) => this.logger.warn('Failed to load identities', err),
    });
  }

  onLink(idp: string): void {
    this.identityLink.startLink(idp).subscribe({
      next: res => {
        window.location.href = res.authorization_url;
      },
      error: (err: unknown) => this.handleStepUpOr(err, 'identities.link.error.startFailed'),
    });
  }

  onUnlink(row: { id: string; label: string }): void {
    const data: UnlinkIdentityDialogData = { identityLabel: row.label };
    this.dialog
      .open<UnlinkIdentityDialogComponent, UnlinkIdentityDialogData, boolean>(
        UnlinkIdentityDialogComponent,
        { width: '420px', data },
      )
      .afterClosed()
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.identityLink.unlink(row.id).subscribe({
          next: () => {
            this.snackBar.open(this.transloco.translate('identities.unlink.success'), undefined, {
              duration: 3000,
            });
            this.refresh();
          },
          error: (err: unknown) => this.handleStepUpOr(err, 'identities.unlink.error'),
        });
      });
  }

  /** On step-up, re-auth and return to this tab; otherwise toast a generic error. */
  private handleStepUpOr(err: unknown, fallbackKey: string): void {
    if (err instanceof StepUpRequiredError) {
      void this.auth.initiateStepUp('/dashboard?openPrefs=identities');
      return;
    }
    this.logger.warn('Identity-link action failed', err);
    this.snackBar.open(this.transloco.translate(fallbackKey), undefined, { duration: 5000 });
  }
}
```

> NOTE: confirm `OAuthProviderInfo` has `.id` and `.name` (it does — see `auth.models.ts` / `getAvailableProviders` usage). If the provider list should exclude SAML, also surface `getAvailableSAMLProviders()` — but for v1 link OAuth providers only; SAML linking can be a follow-up (note it in the PR).

- [ ] **Step 2: Write the spec**

```typescript
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError, EMPTY } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IdentitiesTabComponent } from './identities-tab.component';
import { IdentityLinkService } from '@app/auth/services/identity-link.service';
import { AuthService } from '@app/auth/services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import { getTranslocoModule } from '@testing/transloco-testing'; // adjust
import { StepUpRequiredError } from '@app/auth/models/identity-link.types';

describe('IdentitiesTabComponent', () => {
  let identityLink: { listIdentities: any; startLink: any; unlink: any };
  let auth: { getAvailableProviders: any; initiateStepUp: any };

  beforeEach(() => {
    identityLink = { listIdentities: vi.fn().mockReturnValue(EMPTY), startLink: vi.fn(), unlink: vi.fn() };
    auth = { getAvailableProviders: vi.fn().mockReturnValue(of([])), initiateStepUp: vi.fn() };
    TestBed.configureTestingModule({
      imports: [IdentitiesTabComponent, getTranslocoModule()],
      providers: [
        { provide: IdentityLinkService, useValue: identityLink },
        { provide: AuthService, useValue: auth },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: LoggerService, useValue: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  it('rows() puts primary first and marks it non-unlinkable', () => {
    const fixture = TestBed.createComponent(IdentitiesTabComponent);
    const rows = fixture.componentInstance.rows({
      primary: { provider: 'google', email: 'a@b.com' },
      linked: [{ id: 'x', provider: 'github', provider_user_id: 'gh…', linked_at: 'now' }],
    });
    expect(rows[0].isPrimary).toBe(true);
    expect(rows[1]).toMatchObject({ id: 'x', isPrimary: false });
  });

  it('onLink navigates to authorization_url on success', () => {
    const fixture = TestBed.createComponent(IdentitiesTabComponent);
    identityLink.startLink.mockReturnValue(of({ authorization_url: 'https://idp', link_state: 's', expires_at: 'x' }));
    // window.location.href assignment — stub as needed in the harness
    fixture.componentInstance.onLink('github');
    expect(identityLink.startLink).toHaveBeenCalledWith('github');
  });

  it('onLink step-up error triggers initiateStepUp', () => {
    const fixture = TestBed.createComponent(IdentitiesTabComponent);
    identityLink.startLink.mockReturnValue(throwError(() => new StepUpRequiredError()));
    fixture.componentInstance.onLink('github');
    expect(auth.initiateStepUp).toHaveBeenCalledWith('/dashboard?openPrefs=identities');
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `pnpm exec vitest run src/app/core/components/user-preferences-dialog/identities-tab/identities-tab.component.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/components/user-preferences-dialog/identities-tab
git commit -m "feat(auth): add Linked accounts identities management tab (#731)"
```

---

### Task 7: Wire the tab into the user-preferences dialog

**Files:**
- Modify: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts`

- [ ] **Step 1: Import the tab component**

Near the existing `ConnectedAccountsTabComponent` import (line ~31):

```typescript
import { IdentitiesTabComponent } from './identities-tab/identities-tab.component';
```

Add `IdentitiesTabComponent` to the component `imports:` array (near line 77, next to `ConnectedAccountsTabComponent`).

- [ ] **Step 2: Add the `<mat-tab>`**

In the inline template, immediately after the Document Sources tab block (after line 428 `</mat-tab>`):

```html
        <!-- Linked Accounts (sign-in identities) Tab -->
        <mat-tab [label]="'identities.tabTitle' | transloco">
          <div class="tab-content">
            <app-identities-tab></app-identities-tab>
          </div>
        </mat-tab>
```

- [ ] **Step 3: Add the tab-index constant + `initialTab` branch**

Find `DOCUMENT_SOURCES_TAB_INDEX` (referenced near line 1035). Add a sibling constant for the new tab. The new tab is inserted **after** Document Sources, so its index is `DOCUMENT_SOURCES_TAB_INDEX + 1`. Add:

```typescript
  private static readonly IDENTITIES_TAB_INDEX =
    UserPreferencesDialogComponent.DOCUMENT_SOURCES_TAB_INDEX + 1;
```

In `ngAfterViewInit` (line ~1028), extend the `initialTab` branch:

```typescript
    if (initialTab === 'identities' && this.tabGroup) {
      setTimeout(() => {
        if (this.tabGroup) {
          this.tabGroup.selectedIndex = UserPreferencesDialogComponent.IDENTITIES_TAB_INDEX;
        }
      }, 0);
    }
```

> NOTE: the Credentials tab is conditional (`@if (canManageCredentials)`) and sits **after** the new tab, so it doesn't shift the identities index. Confirm no tab is conditionally rendered **before** Document Sources (none are — Profile/Display/Reports/DocumentSources are all unconditional). The `openPrefs=identities` query param is what the confirmation screen and tab navigate to; verify the existing mechanism that reads `openPrefs` and opens the dialog with `{ initialTab }` maps `openPrefs` value → `initialTab`. Search for `openPrefs` in the dialog opener (likely a layout/navbar component) and add `'identities'` to whatever allow-list/switch it uses, mirroring `'document-sources'`.

- [ ] **Step 4: Find and update the `openPrefs` opener**

Run: `grep -rn "openPrefs\|initialTab\|document-sources" src/app --include='*.ts' | grep -v spec`
For each place that maps an `openPrefs` query value to `{ initialTab }` when opening `UserPreferencesDialogComponent`, add an `'identities'` case mirroring `'document-sources'`.

- [ ] **Step 5: Build + typecheck**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts
git commit -m "feat(auth): add Linked accounts tab to user preferences dialog (#731)"
```

---

### Task 8: Localization

Add `identities.*` keys to the master locale, then backfill all other locales.

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify: all other `src/assets/i18n/*.json` (via backfill skill)

- [ ] **Step 1: Add keys to `en-US.json`**

Add a top-level `"identities"` object (and confirm `common.close` exists; if not, add it). Use the `update-json-localization-file` skill to preserve formatting. Keys required by the templates above:

```json
{
  "identities": {
    "tabTitle": "Linked accounts",
    "help": "Accounts you can use to sign in to TMI.",
    "primary": "Primary",
    "linkNew": "Link another account",
    "columns": {
      "provider": "Provider",
      "account": "Account"
    },
    "link": {
      "loading": "Loading…",
      "submitting": "Linking your account…",
      "success": "Account linked.",
      "confirm": {
        "title": "Confirm account link",
        "bodyPrefix": "Link",
        "bodyJoin": "to your account",
        "warning": "Whoever controls the linked identity will be able to sign in to your account.",
        "expiry": "This confirmation expires in 5 minutes.",
        "confirmButton": "Link account"
      },
      "error": {
        "title": "Could not link account",
        "generic": "Something went wrong while linking the account. Please try again.",
        "alreadyBound": "That identity is already linked to a TMI account.",
        "expired": "This link request has expired. Please start again.",
        "startFailed": "Could not start the account link. Please try again."
      }
    },
    "unlink": {
      "action": "Unlink",
      "confirmTitle": "Unlink {{identity}}?",
      "confirmBody": "That identity will no longer be able to sign in to this account.",
      "success": "Identity unlinked.",
      "error": "Could not unlink the identity. Please try again."
    }
  }
}
```

> NOTE: If lint forbids `innerHTML`, drop the `<strong>` tags from `confirm.body` and bold the identities in the template with separate spans instead (see Task 4 note).

- [ ] **Step 2: Validate the master file parses**

Run: `pnpm run lint:all` (or `node -e "JSON.parse(require('fs').readFileSync('src/assets/i18n/en-US.json','utf8'))"`)
Expected: no JSON errors.

- [ ] **Step 3: Backfill other locales**

Invoke the `/localization-backfill` command (or `loc:backfill` skill) to translate the new `identities.*` keys into every other locale, using `en-US` as the source.

- [ ] **Step 4: Verify coverage**

Run the `loc:coverage` skill (or `python3` check script per `.claude/i18n.config.json`).
Expected: 100% coverage for all locales on the new keys.

- [ ] **Step 5: Commit**

```bash
git add src/assets/i18n
git commit -m "feat(i18n): add identities (linked accounts) strings, backfill all locales (#731)"
```

---

### Task 9: Integration verification + close-out

- [ ] **Step 1: Full lint**

Run: `pnpm run lint:all`
Expected: clean (formatting auto-fixed by the PostToolUse hook).

- [ ] **Step 2: Full build**

Run: `pnpm run build`
Expected: succeeds with no errors.

- [ ] **Step 3: Run the full unit suite for touched areas**

Run: `pnpm exec vitest run src/app/auth src/app/core/components/user-preferences-dialog`
Expected: all pass.

- [ ] **Step 4: Manual verification (against a running server)**

Start the app (`pnpm run dev`) signed in as a **Google/SAML/OIDC-primary** user, then:
1. Open User Preferences → "Linked accounts" tab → confirm the primary identity shows with a "Primary" chip and no unlink button.
2. Click "Link another account" → pick a provider → complete the IdP login as a *different* account → land on `/oauth2/link/callback` confirmation screen naming **both** identities + the 5-minute expiry note.
3. Confirm → success snackbar → back on the Linked accounts tab with the new identity listed.
4. Re-run the link with the **same** second identity → expect the `identity_already_bound` error state.
5. Unlink the linked identity → confirm dialog → success → row removed.
6. If the session is >5 min old when you click Link/Confirm/Unlink, verify the step-up redirect fires and returns you to the originating screen to retry.
7. Sign out, sign back in **as the linked identity** → confirm you land on the **same** account (server-side resolution).

Document any deviations. For a **GitHub-primary** session, note the step-up JSON limitation is expected (tracked by #680/tmi#455) — do not treat as a bug.

- [ ] **Step 5: Code review**

Run the `superpowers:requesting-code-review` skill (or `/code-review`) over the branch diff. Address findings via `superpowers:receiving-code-review`.

- [ ] **Step 6: Close the issue**

The work lands on `dev/1.4.0` (non-default branch), so GitHub will not auto-close. After the final commit/PR:

```bash
git branch --show-current   # confirm dev/1.4.0 (or feature branch)
gh issue comment 731 --body "Resolved on branch dev/1.4.0 (see commits referencing #731). Step-up for GitHub-primary users remains a documented gap tracked by #680 / server tmi#455."
gh issue close 731
```

---

## Self-Review

**Spec coverage (issue #731 acceptance criteria):**
- ✅ "Full link flow with confirmation screen naming both identities" — Task 4 (callback + confirm screen, `confirm.body` names both).
- ✅ "Error states: identity_already_bound, expired pending link, step-up re-auth challenges" — Task 2 (step-up mapping), Task 4 (alreadyBound/expired/generic states), Task 6 (step-up on start/unlink).
- ✅ "Identities list + unlink UX" — Task 6 (list primary+linked, unlink with confirm), Task 5 (dialog), Task 7 (tab wiring).
- ✅ "pending token expires in 5 minutes — surface that in the UI" — Task 4 (`confirm.expiry` string).
- ✅ Primary not unlinkable — Task 6 (`@if (!r.isPrimary)` on unlink button).

**Decision coverage (from planning):**
- ✅ Inline minimal step-up redirect — Task 3, reused in Tasks 4 & 6; GitHub-primary limitation documented (Background + Task 9).
- ✅ New "Linked accounts" tab — Tasks 6 & 7.
- ✅ Dedicated `/oauth2/link/callback` route — Task 4.

**Type consistency:** `LinkedIdentity`, `MyIdentitiesResponse`, `PendingIdentityLinkResponse`, `IdentityLinkStartResponse`, `StepUpRequiredError`, `IDENTITY_LINK_ERROR` defined in Task 1 and used consistently in Tasks 2/4/6. Service method names (`listIdentities`, `startLink`, `getPending`, `confirmLink`, `unlink`) consistent across Tasks 2/4/6. `initiateStepUp(returnUrl)` signature consistent (Task 3 def; Tasks 4/6 callers).

**Open verification items flagged inline for the executor (not placeholders — known unknowns to confirm against live code):**
1. `ApiService.get` second-arg param-object shape (Task 2 note).
2. Transloco test-module helper name under `src/testing/` (Task 4/6 notes).
3. `OAuthProviderInfo` field names `.id`/`.name` (Task 6 note).
4. The `openPrefs` → `initialTab` opener location and allow-list (Task 7 Step 4).
5. Lint stance on `[innerHTML]` (Task 4 / Task 8 notes).
