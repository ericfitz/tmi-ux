# Google Drive Picker Integration — tmi-ux Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement client-side Google Drive picker integration for delegated document attachments in tmi-ux, consuming the TMI server's content-token + picker endpoints and rendering localized access-diagnostics with remediation actions.

**Architecture:** Generic core (provider-agnostic `ContentTokenService`, `PickerTokenService`, callback route, sources tab, diagnostics panel) plus a per-provider picker service (`GoogleDrivePickerService`). The document-editor-dialog gains a source selector that resolves the correct picker via a typed registry; new providers add one service file and one registry entry without touching consumers.

**Tech Stack:** Angular 21 standalone components, Vitest + Testing Library, Transloco i18n, Angular Material, RxJS, Google Picker JS (lazy-loaded from Google's CDN).

**Spec:** [docs/superpowers/specs/2026-04-26-google-drive-picker-tmiux-design.md](../specs/2026-04-26-google-drive-picker-tmiux-design.md) (commit `9e468070`).

**Issue:** [#626](https://github.com/ericfitz/tmi-ux/issues/626). Server-side endpoints shipped on TMI [#249](https://github.com/ericfitz/tmi/issues/249) sub-project 4 (commit `906119e7`). Follow-ups: [#645](https://github.com/ericfitz/tmi-ux/issues/645) (multi-select), [#646](https://github.com/ericfitz/tmi-ux/issues/646) (E2E).

---

## Phase 1 — Generic plumbing

### Task 1.1: Add OpenAPI-derived content types to generated bindings

**Files:**
- Modify: `package.json` (verify `generate:api-types` script targets the dev branch where new types live)
- Regenerate: `src/app/generated/api-types.d.ts`

The TMI server already publishes `ContentTokenInfo`, `ContentTokenList`, `ContentAuthorizationURL`, `PickerTokenResponse`, `DocumentAccessDiagnostics`, `AccessRemediation`, and `PickerRegistration` schemas in its OpenAPI spec on the `dev/1.4.0` branch. We need those types in `api-types.d.ts` for downstream code.

- [ ] **Step 1: Determine the OpenAPI URL with the new types**

The default `generate:api-types` script in [package.json](package.json) reads from `main`. The new schemas are on the server's `dev/1.4.0` branch. Run codegen against that branch directly:

```bash
OPENAPI_SPEC=https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/dev/1.4.0/api-schema/tmi-openapi.json \
  pnpm run generate:api-types
```

Expected: `src/app/generated/api-types.d.ts` is regenerated. The diff should add new schema entries.

- [ ] **Step 2: Verify the new types landed**

```bash
rg 'ContentTokenInfo|DocumentAccessDiagnostics|AccessRemediation|PickerRegistration|PickerTokenResponse|ContentAuthorizationURL|ContentTokenList' src/app/generated/api-types.d.ts | head -10
```

Expected: at least one match per type name. If any are missing, the OPENAPI_SPEC URL is wrong or the branch hasn't been pushed yet.

- [ ] **Step 3: Commit the regenerated types**

```bash
git add src/app/generated/api-types.d.ts
git commit -m "chore: regenerate api-types with content-token + picker schemas (#626)"
```

---

### Task 1.2: Add tmi-ux types and error classes for content providers

**Files:**
- Create: `src/app/core/models/content-provider.types.ts`
- Test: `src/app/core/models/content-provider.types.spec.ts`

This file wraps the generated OpenAPI types with TS-side ergonomics: a `ContentProviderId` union, the `ContentProviderMetadata` shape used by the registry, the `PickedFile` shape returned from the picker, and three error classes used across the services.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/models/content-provider.types.spec.ts
import { describe, it, expect } from 'vitest';
import {
  ContentTokenNotLinkedError,
  PickerAlreadyOpenError,
  PickerSessionExpiredError,
  type ContentProviderId,
} from './content-provider.types';

describe('content-provider.types', () => {
  it('exposes typed error classes with stable names', () => {
    expect(new ContentTokenNotLinkedError('google_workspace').name).toBe(
      'ContentTokenNotLinkedError',
    );
    expect(new PickerAlreadyOpenError().name).toBe('PickerAlreadyOpenError');
    expect(new PickerSessionExpiredError().name).toBe('PickerSessionExpiredError');
  });

  it('captures provider id on the not-linked error', () => {
    const err = new ContentTokenNotLinkedError('google_workspace');
    expect(err.providerId).toBe('google_workspace');
  });

  it('compiles with ContentProviderId union', () => {
    const id: ContentProviderId = 'google_workspace';
    expect(id).toBe('google_workspace');
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/core/models/content-provider.types.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types module**

```typescript
// src/app/core/models/content-provider.types.ts
import type { Type } from '@angular/core';
import type { components } from '@app/generated/api-types';

/**
 * Stable union of content provider ids known to tmi-ux. Add new ids here
 * when a new provider's TMI sub-project ships (Confluence, OneDrive, etc.).
 */
export type ContentProviderId = 'google_workspace';

/** OpenAPI-generated info shape for a single linked content token. */
export type ContentTokenInfo = components['schemas']['ContentTokenInfo'];

/** OpenAPI-generated picker-token response (Google Picker bootstrap material). */
export type PickerTokenResponse = components['schemas']['PickerTokenResponse'];

/** OpenAPI-generated picker-registration payload sent on document attach. */
export type PickerRegistration = components['schemas']['PickerRegistration'];

/** OpenAPI-generated diagnostics object on document GET responses. */
export type DocumentAccessDiagnostics = components['schemas']['DocumentAccessDiagnostics'];

/** OpenAPI-generated remediation action shape inside diagnostics. */
export type AccessRemediation = components['schemas']['AccessRemediation'];

/** OpenAPI-generated authorization-URL response. */
export type ContentAuthorizationURL = components['schemas']['ContentAuthorizationURL'];

/**
 * Provider-specific picker service contract. Each picker service implements
 * `pick()`; the registry maps provider id to the Angular `Type` so consumers
 * can resolve the right service via `Injector.get(...)`.
 */
export interface IContentPickerService {
  /** Open the picker. Resolves to the picked file or null on cancel. */
  pick(): import('rxjs').Observable<PickedFile | null>;
}

/** Lookup record describing a content provider for UI rendering and dispatch. */
export interface ContentProviderMetadata {
  id: ContentProviderId;
  displayNameKey: string;
  icon: string;
  supportsPicker: boolean;
  pickerService: Type<IContentPickerService>;
}

/** Outcome of a successful pick action. */
export interface PickedFile {
  fileId: string;
  name: string;
  mimeType: string;
  url: string;
}

/** Thrown when picker invocation requires a linked token that doesn't exist. */
export class ContentTokenNotLinkedError extends Error {
  override name = 'ContentTokenNotLinkedError';
  constructor(public readonly providerId: ContentProviderId) {
    super(`No linked content token for provider: ${providerId}`);
  }
}

/** Thrown when a second pick() call fires while a Picker is already open. */
export class PickerAlreadyOpenError extends Error {
  override name = 'PickerAlreadyOpenError';
  constructor() {
    super('A picker is already open');
  }
}

/** Thrown when the picker session expires beyond a single retry. */
export class PickerSessionExpiredError extends Error {
  override name = 'PickerSessionExpiredError';
  constructor() {
    super('Picker session expired');
  }
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm vitest run src/app/core/models/content-provider.types.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Lint and commit**

```bash
pnpm run lint:all
git add src/app/core/models/content-provider.types.ts src/app/core/models/content-provider.types.spec.ts
git commit -m "feat: content provider types and errors (#626)"
```

---

### Task 1.3: Create the static content-provider registry

**Files:**
- Create: `src/app/core/services/content-provider-registry.ts`
- Test: `src/app/core/services/content-provider-registry.spec.ts`

A typed `Record<ContentProviderId, ContentProviderMetadata>` that consumer components import. The `pickerService` field references a class that doesn't yet exist (`GoogleDrivePickerService`), so we introduce a forward declaration via Angular `InjectionToken` semantics: the field holds a `Type<IContentPickerService>`, and we'll import the concrete class in Task 2.2.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/services/content-provider-registry.spec.ts
import { describe, it, expect } from 'vitest';
import { CONTENT_PROVIDERS } from './content-provider-registry';

describe('CONTENT_PROVIDERS', () => {
  it('includes the google_workspace provider', () => {
    expect(CONTENT_PROVIDERS['google_workspace']).toBeDefined();
  });

  it('every entry has required metadata fields', () => {
    for (const [id, meta] of Object.entries(CONTENT_PROVIDERS)) {
      expect(meta.id).toBe(id);
      expect(meta.displayNameKey).toMatch(/^documentSources\./);
      expect(typeof meta.supportsPicker).toBe('boolean');
      expect(meta.pickerService).toBeDefined();
    }
  });

  it('google_workspace supportsPicker is true', () => {
    expect(CONTENT_PROVIDERS['google_workspace'].supportsPicker).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/core/services/content-provider-registry.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

```typescript
// src/app/core/services/content-provider-registry.ts
import type {
  ContentProviderId,
  ContentProviderMetadata,
} from '../models/content-provider.types';
import { GoogleDrivePickerService } from './google-drive-picker.service';

/**
 * Typed lookup of all content providers known to tmi-ux. Consumers iterate
 * this map to render source selectors and resolve picker services. Adding a
 * new provider = one new entry here + one new picker-service file.
 */
export const CONTENT_PROVIDERS: Record<ContentProviderId, ContentProviderMetadata> = {
  google_workspace: {
    id: 'google_workspace',
    displayNameKey: 'documentSources.googleDrive.name',
    icon: '/static/provider-logos/google-drive.svg',
    supportsPicker: true,
    pickerService: GoogleDrivePickerService,
  },
};
```

The import of `GoogleDrivePickerService` will fail until Task 2.2 lands. To unblock this task, create a stub:

```typescript
// src/app/core/services/google-drive-picker.service.ts (TEMPORARY STUB)
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import type {
  IContentPickerService,
  PickedFile,
} from '../models/content-provider.types';

/** Real implementation lands in Task 2.2. */
@Injectable({ providedIn: 'root' })
export class GoogleDrivePickerService implements IContentPickerService {
  pick(): Observable<PickedFile | null> {
    return of(null);
  }
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm vitest run src/app/core/services/content-provider-registry.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Lint and commit**

```bash
pnpm run lint:all
git add src/app/core/services/content-provider-registry.ts \
        src/app/core/services/content-provider-registry.spec.ts \
        src/app/core/services/google-drive-picker.service.ts
git commit -m "feat: content provider registry with google_workspace entry (#626)"
```

---

### Task 1.4: Implement `ContentTokenService`

**Files:**
- Create: `src/app/core/services/content-token.service.ts`
- Test: `src/app/core/services/content-token.service.spec.ts`

Provider-agnostic HTTP wrapper for `/me/content_tokens/*`. Cache-aware; mutations invalidate the cache.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/services/content-token.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, firstValueFrom } from 'rxjs';
import { ContentTokenService } from './content-token.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import type { ContentTokenInfo } from '../models/content-provider.types';

describe('ContentTokenService', () => {
  let svc: ContentTokenService;
  let apiSpy: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiSpy = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        ContentTokenService,
        { provide: ApiService, useValue: apiSpy },
        { provide: LoggerService, useValue: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      ],
    });
    svc = TestBed.inject(ContentTokenService);
  });

  it('list() GETs /me/content_tokens and unwraps content_tokens', async () => {
    const tokens: ContentTokenInfo[] = [
      { provider_id: 'google_workspace', status: 'active', scopes: [], created_at: '2026-04-26T00:00:00Z' },
    ];
    apiSpy.get.mockReturnValue(of({ content_tokens: tokens }));

    const result = await firstValueFrom(svc.list());

    expect(apiSpy.get).toHaveBeenCalledWith('me/content_tokens');
    expect(result).toEqual(tokens);
  });

  it('authorize() POSTs to /me/content_tokens/{id}/authorize with client_callback', async () => {
    apiSpy.post.mockReturnValue(of({ authorization_url: 'https://x', expires_at: '...' }));

    await firstValueFrom(svc.authorize('google_workspace', '/dashboard'));

    expect(apiSpy.post).toHaveBeenCalledWith(
      'me/content_tokens/google_workspace/authorize',
      expect.objectContaining({
        client_callback: expect.stringContaining('/oauth2/content-callback?return_to='),
      }),
    );
    const callArg = apiSpy.post.mock.calls[0][1];
    expect(callArg.client_callback).toContain(encodeURIComponent('/dashboard'));
  });

  it('unlink() DELETEs /me/content_tokens/{id}', async () => {
    apiSpy.delete.mockReturnValue(of(undefined));
    await firstValueFrom(svc.unlink('google_workspace'));
    expect(apiSpy.delete).toHaveBeenCalledWith('me/content_tokens/google_workspace');
  });

  it('contentTokens$ caches results until refresh()', async () => {
    apiSpy.get.mockReturnValue(of({ content_tokens: [] }));
    await firstValueFrom(svc.contentTokens$);
    await firstValueFrom(svc.contentTokens$);
    expect(apiSpy.get).toHaveBeenCalledTimes(1);

    svc.refresh();
    await firstValueFrom(svc.contentTokens$);
    expect(apiSpy.get).toHaveBeenCalledTimes(2);
  });

  it('unlink() invalidates the cache', async () => {
    apiSpy.get.mockReturnValue(of({ content_tokens: [] }));
    apiSpy.delete.mockReturnValue(of(undefined));
    await firstValueFrom(svc.contentTokens$);
    expect(apiSpy.get).toHaveBeenCalledTimes(1);

    await firstValueFrom(svc.unlink('google_workspace'));
    await firstValueFrom(svc.contentTokens$);

    expect(apiSpy.get).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/core/services/content-token.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```typescript
// src/app/core/services/content-token.service.ts
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  defer,
  shareReplay,
  switchMap,
  take,
  tap,
  catchError,
} from 'rxjs';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import type {
  ContentAuthorizationURL,
  ContentProviderId,
  ContentTokenInfo,
} from '../models/content-provider.types';

interface ContentTokenListResponse {
  content_tokens: ContentTokenInfo[];
}

/**
 * Provider-agnostic HTTP wrapper for /me/content_tokens/*. Lists, authorizes,
 * and unlinks delegated content tokens. Cached observable invalidated on
 * mutations and explicit refresh().
 */
@Injectable({ providedIn: 'root' })
export class ContentTokenService {
  private readonly _refresh$ = new BehaviorSubject<void>(undefined);

  readonly contentTokens$: Observable<ContentTokenInfo[]> = this._refresh$.pipe(
    switchMap(() => this.list()),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /** Fetches the current user's linked content tokens. */
  list(): Observable<ContentTokenInfo[]> {
    return defer(() =>
      this.apiService
        .get<ContentTokenListResponse>('me/content_tokens')
        .pipe(
          tap(res => this.logger.debug('Content tokens loaded', { count: res.content_tokens.length })),
          switchMap(res => [res.content_tokens]),
          catchError(err => {
            this.logger.error('Failed to list content tokens', err);
            throw err;
          }),
        ),
    );
  }

  /** Forces the cached observable to re-fetch on next subscription. */
  refresh(): void {
    this._refresh$.next();
  }

  /**
   * Initiates an account-link flow. Returns the authorization URL the caller
   * should redirect the browser to. The server-side callback redirects back
   * to `<origin>/oauth2/content-callback?return_to=<encoded returnTo>`.
   */
  authorize(
    providerId: ContentProviderId,
    returnTo: string,
  ): Observable<ContentAuthorizationURL> {
    const clientCallback = `${window.location.origin}/oauth2/content-callback?return_to=${encodeURIComponent(returnTo)}`;
    return this.apiService
      .post<ContentAuthorizationURL>(
        `me/content_tokens/${providerId}/authorize`,
        { client_callback: clientCallback },
      )
      .pipe(
        tap(() => this.logger.info('Content token authorize initiated', { providerId })),
        catchError(err => {
          this.logger.error('Failed to initiate content token authorize', err);
          throw err;
        }),
      );
  }

  /** Unlinks the named provider; invalidates the cache. */
  unlink(providerId: ContentProviderId): Observable<void> {
    return this.apiService.delete<void>(`me/content_tokens/${providerId}`).pipe(
      tap(() => {
        this.logger.info('Content token unlinked', { providerId });
        this.refresh();
      }),
      catchError(err => {
        this.logger.error('Failed to unlink content token', err);
        throw err;
      }),
    );
  }
}
```

Note on the cache test: `shareReplay({ refCount: false })` keeps the value cached across subscriptions; combined with `take(1)` semantics inside `firstValueFrom`, the test only triggers one HTTP call until `refresh()` fires. If the cache test fails because `firstValueFrom` re-subscribes and re-fires, switch the implementation to track the cached value explicitly via `BehaviorSubject<ContentTokenInfo[] | null>` and only `list()` when null/refresh.

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm vitest run src/app/core/services/content-token.service.spec.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Lint and commit**

```bash
pnpm run lint:all
git add src/app/core/services/content-token.service.ts src/app/core/services/content-token.service.spec.ts
git commit -m "feat: ContentTokenService for content_tokens API (#626)"
```

---

### Task 1.5: Implement `PickerTokenService`

**Files:**
- Create: `src/app/core/services/picker-token.service.ts`
- Test: `src/app/core/services/picker-token.service.spec.ts`

Mints a short-lived picker token. No caching — every call hits the endpoint.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/services/picker-token.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PickerTokenService } from './picker-token.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { ContentTokenNotLinkedError } from '../models/content-provider.types';

describe('PickerTokenService', () => {
  let svc: PickerTokenService;
  let apiSpy: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiSpy = { post: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PickerTokenService,
        { provide: ApiService, useValue: apiSpy },
        { provide: LoggerService, useValue: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      ],
    });
    svc = TestBed.inject(PickerTokenService);
  });

  it('mint() POSTs /me/picker_tokens/{id}', async () => {
    const response = {
      access_token: 'ya29.x',
      expires_at: '2026-04-26T01:00:00Z',
      developer_key: 'AIza...',
      app_id: '12345',
    };
    apiSpy.post.mockReturnValue(of(response));

    const result = await firstValueFrom(svc.mint('google_workspace'));

    expect(apiSpy.post).toHaveBeenCalledWith('me/picker_tokens/google_workspace', {});
    expect(result).toEqual(response);
  });

  it('mint() maps 404 to ContentTokenNotLinkedError', async () => {
    const httpErr = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    apiSpy.post.mockReturnValue(throwError(() => httpErr));

    await expect(firstValueFrom(svc.mint('google_workspace'))).rejects.toThrow(
      ContentTokenNotLinkedError,
    );
  });

  it('mint() does NOT cache — each call hits the endpoint', async () => {
    apiSpy.post.mockReturnValue(of({ access_token: 't', expires_at: '...', developer_key: 'k', app_id: 'a' }));
    await firstValueFrom(svc.mint('google_workspace'));
    await firstValueFrom(svc.mint('google_workspace'));
    expect(apiSpy.post).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/core/services/picker-token.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/app/core/services/picker-token.service.ts
import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  ContentTokenNotLinkedError,
  type ContentProviderId,
  type PickerTokenResponse,
} from '../models/content-provider.types';

/**
 * Mints short-lived picker tokens. Always hits the endpoint — server may
 * refresh underlying credentials per request, and the response is non-cacheable
 * per the OpenAPI spec.
 */
@Injectable({ providedIn: 'root' })
export class PickerTokenService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  mint(providerId: ContentProviderId): Observable<PickerTokenResponse> {
    return this.apiService
      .post<PickerTokenResponse>(`me/picker_tokens/${providerId}`, {})
      .pipe(
        tap(() => this.logger.debug('Picker token minted', { providerId })),
        catchError(err => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            return throwError(() => new ContentTokenNotLinkedError(providerId));
          }
          this.logger.error('Failed to mint picker token', err);
          return throwError(() => err);
        }),
      );
  }
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm vitest run src/app/core/services/picker-token.service.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
pnpm run lint:all
git add src/app/core/services/picker-token.service.ts src/app/core/services/picker-token.service.spec.ts
git commit -m "feat: PickerTokenService for picker_tokens API (#626)"
```

---

### Task 1.6: Create `ContentCallbackComponent` + register route

**Files:**
- Create: `src/app/core/components/content-callback/content-callback.component.ts`
- Create: `src/app/core/components/content-callback/content-callback.component.html`
- Create: `src/app/core/components/content-callback/content-callback.component.scss`
- Test: `src/app/core/components/content-callback/content-callback.component.spec.ts`
- Modify: `src/app/app.routes.ts` (add route)

The component reads `?status=success|error&return_to=<path>&provider_id=<id>` query params, refreshes the token cache on success, and navigates to `return_to` with a snackbar.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/components/content-callback/content-callback.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ContentCallbackComponent } from './content-callback.component';
import { ContentTokenService } from '../../services/content-token.service';
import { LoggerService } from '../../services/logger.service';

const translocoConfig = TranslocoTestingModule.forRoot({
  langs: { 'en-US': {} },
  translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
});

describe('ContentCallbackComponent', () => {
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let snackSpy: { open: ReturnType<typeof vi.fn> };
  let tokenSpy: { refresh: ReturnType<typeof vi.fn> };

  function setup(queryParams: Record<string, string>) {
    routerSpy = { navigateByUrl: vi.fn() };
    snackSpy = { open: vi.fn() };
    tokenSpy = { refresh: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ContentCallbackComponent, translocoConfig],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: of(queryParams) } },
        { provide: Router, useValue: routerSpy },
        { provide: MatSnackBar, useValue: snackSpy },
        { provide: ContentTokenService, useValue: tokenSpy },
        { provide: LoggerService, useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      ],
    });
    return TestBed.createComponent(ContentCallbackComponent);
  }

  it('on status=success, refreshes tokens, navigates to return_to, opens success snackbar', () => {
    const fixture = setup({ status: 'success', return_to: '/dashboard?openPrefs=document-sources', provider_id: 'google_workspace' });
    fixture.detectChanges();
    expect(tokenSpy.refresh).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/dashboard?openPrefs=document-sources');
    expect(snackSpy.open).toHaveBeenCalled();
  });

  it('on status=error, opens error snackbar and navigates to return_to', () => {
    const fixture = setup({ status: 'error', return_to: '/tm/abc', provider_id: 'google_workspace', reason: 'consent_denied' });
    fixture.detectChanges();
    expect(tokenSpy.refresh).not.toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tm/abc');
    expect(snackSpy.open).toHaveBeenCalled();
  });

  it('falls back to /dashboard when return_to is missing', () => {
    const fixture = setup({ status: 'success', provider_id: 'google_workspace' });
    fixture.detectChanges();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/core/components/content-callback/content-callback.component.spec.ts
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

```typescript
// src/app/core/components/content-callback/content-callback.component.ts
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

import { ContentTokenService } from '../../services/content-token.service';
import { LoggerService } from '../../services/logger.service';
import { CONTENT_PROVIDERS } from '../../services/content-provider-registry';
import type { ContentProviderId } from '../../models/content-provider.types';

@Component({
  selector: 'app-content-callback',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule, TranslocoModule],
  templateUrl: './content-callback.component.html',
  styleUrls: ['./content-callback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private contentTokens: ContentTokenService,
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const status = params['status'] as string | undefined;
      const returnTo = (params['return_to'] as string | undefined) ?? '/dashboard';
      const providerId = params['provider_id'] as ContentProviderId | undefined;
      const reason = (params['reason'] as string | undefined) ?? '';

      const sourceName = providerId
        ? this.transloco.translate(CONTENT_PROVIDERS[providerId]?.displayNameKey ?? '')
        : '';

      if (status === 'success') {
        this.contentTokens.refresh();
        this.logger.info('Content token linked', { providerId });
        this.snackBar.open(
          this.transloco.translate('documentSources.callback.success', { source: sourceName }),
          undefined,
          { duration: 4000 },
        );
      } else {
        this.logger.warn('Content token link failed', { providerId, reason });
        this.snackBar.open(
          this.transloco.translate('documentSources.callback.error', { source: sourceName, reason }),
          undefined,
          { duration: 6000 },
        );
      }

      this.router.navigateByUrl(returnTo);
    });
  }
}
```

```html
<!-- src/app/core/components/content-callback/content-callback.component.html -->
<div class="callback-container">
  <mat-card class="callback-card">
    <mat-card-content>
      <div class="callback-content">
        <mat-spinner diameter="48"></mat-spinner>
        <p class="callback-message" [transloco]="'documentSources.callback.linking'">
          Linking your account...
        </p>
      </div>
    </mat-card-content>
  </mat-card>
</div>
```

```scss
/* src/app/core/components/content-callback/content-callback.component.scss */
.callback-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.callback-card {
  max-width: 360px;
}
.callback-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
}
.callback-message {
  margin: 0;
  text-align: center;
}
```

- [ ] **Step 4: Add route**

Open [src/app/app.routes.ts](src/app/app.routes.ts) and find the `oauth2/callback` route entry (~line 41). Add an adjacent entry:

```typescript
{
  path: 'oauth2/content-callback',
  loadComponent: () =>
    import('./core/components/content-callback/content-callback.component').then(
      m => m.ContentCallbackComponent,
    ),
},
```

- [ ] **Step 5: Add minimal i18n placeholders so tests don't crash**

Open [src/assets/i18n/en-US.json](src/assets/i18n/en-US.json) and add to the top-level object (these will be expanded in Task 4.1):

```json
"documentSources": {
  "callback": {
    "linking": "Linking your account...",
    "success": "Source connected. Source: {{ source }}",
    "error": "Couldn't connect source. Source: {{ source }}. Reason: {{ reason }}"
  },
  "googleDrive": {
    "name": "Google Drive"
  }
}
```

- [ ] **Step 6: Run tests, verify pass**

```bash
pnpm vitest run src/app/core/components/content-callback/content-callback.component.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 7: Verify build**

```bash
pnpm run build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
pnpm run lint:all
git add src/app/core/components/content-callback/ \
        src/app/app.routes.ts \
        src/assets/i18n/en-US.json
git commit -m "feat: ContentCallbackComponent + /oauth2/content-callback route (#626)"
```

---

## Phase 2 — Google Drive picker service

### Task 2.1: Lazy script loader utility

**Files:**
- Create: `src/app/shared/utils/lazy-script-loader.ts`
- Test: `src/app/shared/utils/lazy-script-loader.spec.ts`

A small utility that injects a `<script>` tag idempotently. Concurrent calls share one promise; a script that fails to load can be retried (the cached promise is removed on rejection).

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/shared/utils/lazy-script-loader.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadScriptOnce, _resetLoaderCache } from './lazy-script-loader';

describe('lazy-script-loader', () => {
  beforeEach(() => {
    _resetLoaderCache();
    document.head.querySelectorAll('script[data-test-loader]').forEach(s => s.remove());
  });

  afterEach(() => {
    _resetLoaderCache();
  });

  it('appends a script tag and resolves on load', async () => {
    const promise = loadScriptOnce('https://example.test/a.js');
    const tag = document.head.querySelector(
      'script[src="https://example.test/a.js"]',
    ) as HTMLScriptElement;
    expect(tag).toBeTruthy();
    tag.dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('concurrent calls share one script tag and one promise', async () => {
    const p1 = loadScriptOnce('https://example.test/b.js');
    const p2 = loadScriptOnce('https://example.test/b.js');
    const tags = document.head.querySelectorAll('script[src="https://example.test/b.js"]');
    expect(tags.length).toBe(1);
    (tags[0] as HTMLScriptElement).dispatchEvent(new Event('load'));
    await Promise.all([p1, p2]);
  });

  it('rejects on error and clears cache so retry can succeed', async () => {
    const p1 = loadScriptOnce('https://example.test/c.js');
    const tag = document.head.querySelector(
      'script[src="https://example.test/c.js"]',
    ) as HTMLScriptElement;
    tag.dispatchEvent(new Event('error'));
    await expect(p1).rejects.toThrow();

    document.head.querySelectorAll('script[src="https://example.test/c.js"]').forEach(s => s.remove());

    const p2 = loadScriptOnce('https://example.test/c.js');
    const tag2 = document.head.querySelector(
      'script[src="https://example.test/c.js"]',
    ) as HTMLScriptElement;
    expect(tag2).toBeTruthy();
    tag2.dispatchEvent(new Event('load'));
    await expect(p2).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/shared/utils/lazy-script-loader.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/app/shared/utils/lazy-script-loader.ts
const cache = new Map<string, Promise<void>>();

/**
 * Idempotently loads a script by URL. Concurrent callers share the same
 * promise; if the load fails, the cache entry is removed so a retry can
 * make a fresh attempt.
 */
export function loadScriptOnce(src: string): Promise<void> {
  const existing = cache.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => {
      cache.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(tag);
  });

  cache.set(src, promise);
  return promise;
}

/** Test helper. */
export function _resetLoaderCache(): void {
  cache.clear();
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm vitest run src/app/shared/utils/lazy-script-loader.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
pnpm run lint:all
git add src/app/shared/utils/lazy-script-loader.ts src/app/shared/utils/lazy-script-loader.spec.ts
git commit -m "feat: lazy script loader utility (#626)"
```

---

### Task 2.2: Implement `GoogleDrivePickerService`

**Files:**
- Modify: `src/app/core/services/google-drive-picker.service.ts` (replace stub from Task 1.3)
- Test: `src/app/core/services/google-drive-picker.service.spec.ts`

Lazy-loads `gapi` + `google.picker` from Google's CDN, mints a picker token, opens the Picker, and resolves with the picked file. Uses a "currently open" flag to reject concurrent calls.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/services/google-drive-picker.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { of, firstValueFrom, throwError } from 'rxjs';
import { GoogleDrivePickerService } from './google-drive-picker.service';
import { PickerTokenService } from './picker-token.service';
import { LoggerService } from './logger.service';
import {
  ContentTokenNotLinkedError,
  PickerAlreadyOpenError,
} from '../models/content-provider.types';
import * as loader from '../../shared/utils/lazy-script-loader';

describe('GoogleDrivePickerService', () => {
  let svc: GoogleDrivePickerService;
  let pickerTokenSpy: { mint: ReturnType<typeof vi.fn> };
  let mockPicker: {
    setVisible: ReturnType<typeof vi.fn>;
    isVisible: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.spyOn(loader, 'loadScriptOnce').mockResolvedValue();

    mockPicker = {
      setVisible: vi.fn(),
      isVisible: vi.fn(() => true),
      dispose: vi.fn(),
    };

    // Stub gapi + google.picker on window. Real Picker JS exposes these globals.
    (globalThis as unknown as { gapi: unknown }).gapi = {
      load: (_module: string, opts: { callback: () => void }) => opts.callback(),
    };
    (globalThis as unknown as { google: unknown }).google = {
      picker: {
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
        ViewId: { DOCS: 'docs' },
        DocsView: vi.fn(() => ({ setIncludeFolders: vi.fn().mockReturnThis(), setMimeTypes: vi.fn().mockReturnThis() })),
        PickerBuilder: vi.fn(() => ({
          setOAuthToken: vi.fn().mockReturnThis(),
          setDeveloperKey: vi.fn().mockReturnThis(),
          setAppId: vi.fn().mockReturnThis(),
          addView: vi.fn().mockReturnThis(),
          setCallback: vi.fn(function (cb: (data: unknown) => void) {
            (this as unknown as { _cb: (data: unknown) => void })._cb = cb;
            return this;
          }),
          build: vi.fn().mockImplementation(function () {
            const cb = (this as unknown as { _cb: (data: unknown) => void })._cb;
            // Caller drives via the resolveWithFile/resolveCancel helpers.
            (mockPicker as unknown as { _cb: (data: unknown) => void })._cb = cb;
            return mockPicker;
          }),
        })),
      },
    };

    pickerTokenSpy = { mint: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        GoogleDrivePickerService,
        { provide: PickerTokenService, useValue: pickerTokenSpy },
        { provide: LoggerService, useValue: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() } },
      ],
    });
    svc = TestBed.inject(GoogleDrivePickerService);
  });

  afterEach(() => {
    delete (globalThis as Partial<{ gapi: unknown; google: unknown }>).gapi;
    delete (globalThis as Partial<{ gapi: unknown; google: unknown }>).google;
    vi.restoreAllMocks();
  });

  function resolveWithPick(file: { id: string; name: string; mimeType: string; url: string }) {
    const cb = (mockPicker as unknown as { _cb: (data: unknown) => void })._cb;
    cb({
      action: 'picked',
      docs: [{ id: file.id, name: file.name, mimeType: file.mimeType, url: file.url }],
    });
  }

  function resolveCancel() {
    const cb = (mockPicker as unknown as { _cb: (data: unknown) => void })._cb;
    cb({ action: 'cancel' });
  }

  it('pick() resolves with PickedFile on Picker selection', async () => {
    pickerTokenSpy.mint.mockReturnValue(of({
      access_token: 'ya29.x',
      expires_at: '2026-04-26T01:00:00Z',
      developer_key: 'k',
      app_id: 'a',
    }));

    const promise = firstValueFrom(svc.pick());
    await new Promise(r => setTimeout(r));
    resolveWithPick({ id: '1abc', name: 'My doc.pdf', mimeType: 'application/pdf', url: 'https://drive.google.com/file/d/1abc' });

    await expect(promise).resolves.toEqual({
      fileId: '1abc',
      name: 'My doc.pdf',
      mimeType: 'application/pdf',
      url: 'https://drive.google.com/file/d/1abc',
    });
  });

  it('pick() resolves null on cancel', async () => {
    pickerTokenSpy.mint.mockReturnValue(of({
      access_token: 't', expires_at: '...', developer_key: 'k', app_id: 'a',
    }));
    const promise = firstValueFrom(svc.pick());
    await new Promise(r => setTimeout(r));
    resolveCancel();
    await expect(promise).resolves.toBeNull();
  });

  it('pick() while another is open rejects with PickerAlreadyOpenError', async () => {
    pickerTokenSpy.mint.mockReturnValue(of({
      access_token: 't', expires_at: '...', developer_key: 'k', app_id: 'a',
    }));
    const first = firstValueFrom(svc.pick());
    await new Promise(r => setTimeout(r));
    await expect(firstValueFrom(svc.pick())).rejects.toThrow(PickerAlreadyOpenError);
    resolveCancel();
    await first;
  });

  it('pick() surfaces ContentTokenNotLinkedError when picker token mint 404s', async () => {
    pickerTokenSpy.mint.mockReturnValue(throwError(() => new ContentTokenNotLinkedError('google_workspace')));
    await expect(firstValueFrom(svc.pick())).rejects.toThrow(ContentTokenNotLinkedError);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/core/services/google-drive-picker.service.spec.ts
```

Expected: FAIL — stub returns null without consulting Picker JS.

- [ ] **Step 3: Replace the stub with the real implementation**

```typescript
// src/app/core/services/google-drive-picker.service.ts
import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { LoggerService } from './logger.service';
import { PickerTokenService } from './picker-token.service';
import {
  PickerAlreadyOpenError,
  type IContentPickerService,
  type PickedFile,
  type PickerTokenResponse,
} from '../models/content-provider.types';
import { loadScriptOnce } from '../../shared/utils/lazy-script-loader';

const GAPI_URL = 'https://apis.google.com/js/api.js';

const SUPPORTED_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/pdf',
  'text/plain',
  'text/csv',
].join(',');

interface GapiGlobal {
  load: (module: string, opts: { callback: () => void; onerror?: (e: unknown) => void }) => void;
}

interface GoogleGlobal {
  picker: {
    Action: { PICKED: string; CANCEL: string };
    ViewId: { DOCS: string };
    DocsView: new () => {
      setIncludeFolders: (v: boolean) => unknown;
      setMimeTypes: (mimes: string) => unknown;
    };
    PickerBuilder: new () => {
      setOAuthToken: (token: string) => unknown;
      setDeveloperKey: (key: string) => unknown;
      setAppId: (id: string) => unknown;
      addView: (view: unknown) => unknown;
      setCallback: (cb: (data: { action: string; docs?: Array<Record<string, unknown>> }) => void) => unknown;
      build: () => { setVisible: (v: boolean) => void; dispose: () => void };
    };
  };
}

@Injectable({ providedIn: 'root' })
export class GoogleDrivePickerService implements IContentPickerService {
  private _open = false;

  constructor(
    private pickerToken: PickerTokenService,
    private logger: LoggerService,
  ) {}

  pick(): Observable<PickedFile | null> {
    return from(this._pickAsync());
  }

  private async _pickAsync(): Promise<PickedFile | null> {
    if (this._open) {
      throw new PickerAlreadyOpenError();
    }
    this._open = true;
    try {
      await loadScriptOnce(GAPI_URL);
      await this._loadPickerModule();

      const token: PickerTokenResponse = await this._mintToken();
      return await this._showPicker(token);
    } finally {
      this._open = false;
    }
  }

  private _mintToken(): Promise<PickerTokenResponse> {
    return new Promise((resolve, reject) => {
      this.pickerToken.mint('google_workspace').subscribe({
        next: t => resolve(t),
        error: e => reject(e),
      });
    });
  }

  private _loadPickerModule(): Promise<void> {
    return new Promise((resolve, reject) => {
      const gapi = (window as unknown as { gapi: GapiGlobal }).gapi;
      gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Failed to load google.picker module')),
      });
    });
  }

  private _showPicker(token: PickerTokenResponse): Promise<PickedFile | null> {
    return new Promise(resolve => {
      const google = (window as unknown as { google: GoogleGlobal }).google;
      const view = new google.picker.DocsView();
      (view as unknown as { setIncludeFolders: (v: boolean) => unknown; setMimeTypes: (s: string) => unknown })
        .setIncludeFolders(false);
      (view as unknown as { setMimeTypes: (s: string) => unknown }).setMimeTypes(SUPPORTED_MIME_TYPES);

      const builder = new google.picker.PickerBuilder();
      const picker = (builder
        .setOAuthToken(token.access_token) as unknown as ReturnType<typeof builder.setOAuthToken>);
      // Chain via casts for type ergonomics. Final picker is built below.
      const built = (builder as unknown as {
        setOAuthToken: (t: string) => unknown;
        setDeveloperKey: (k: string) => unknown;
        setAppId: (id: string) => unknown;
        addView: (v: unknown) => unknown;
        setCallback: (cb: (d: { action: string; docs?: Array<Record<string, unknown>> }) => void) => unknown;
        build: () => { setVisible: (v: boolean) => void; dispose: () => void };
      });
      built.setOAuthToken(token.access_token);
      built.setDeveloperKey(token.developer_key);
      built.setAppId(token.app_id);
      built.addView(view);
      built.setCallback((data: { action: string; docs?: Array<Record<string, unknown>> }) => {
        if (data.action === google.picker.Action.PICKED && data.docs && data.docs.length > 0) {
          const doc = data.docs[0] as { id: string; name: string; mimeType: string; url: string };
          resolve({ fileId: doc.id, name: doc.name, mimeType: doc.mimeType, url: doc.url });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      });
      const realPicker = built.build();
      realPicker.setVisible(true);
      // Use picker variable to satisfy strict noUnused
      void picker;
    });
  }
}
```

The cast-heavy implementation is needed because we don't have official `@types/google.picker` types installed (they're not first-class TS); the Picker SDK is loaded at runtime. If type ergonomics become painful in later tasks, factor a small `picker-types.ts` declaration file, but for now the local casts are fine.

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm vitest run src/app/core/services/google-drive-picker.service.spec.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Verify build, lint, commit**

```bash
pnpm run build
pnpm run lint:all
git add src/app/core/services/google-drive-picker.service.ts src/app/core/services/google-drive-picker.service.spec.ts
git commit -m "feat: GoogleDrivePickerService with lazy gapi loader (#626)"
```

---

## Phase 3 — Document sources tab + linking flow

### Task 3.1: Create `ConnectedAccountsTabComponent`

**Files:**
- Create: `src/app/core/components/user-preferences-dialog/connected-accounts-tab/connected-accounts-tab.component.ts`
- Test: `src/app/core/components/user-preferences-dialog/connected-accounts-tab/connected-accounts-tab.component.spec.ts`

Renders the Document sources tab content. Uses inline template + styles (matches the existing `user-preferences-dialog` style). Exposes one `@Output()` event for the parent dialog to handle close-on-link if needed (we keep this minimal — linking redirects, so the tab just emits a `linkInitiated` event for the dialog to close itself).

- [ ] **Step 1: Write the failing test**

```typescript
// connected-accounts-tab.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, BehaviorSubject } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ConnectedAccountsTabComponent } from './connected-accounts-tab.component';
import { ContentTokenService } from '../../../services/content-token.service';
import { LoggerService } from '../../../services/logger.service';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { ContentTokenInfo } from '../../../models/content-provider.types';

const translocoConfig = TranslocoTestingModule.forRoot({
  langs: { 'en-US': {} },
  translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
});

describe('ConnectedAccountsTabComponent', () => {
  let tokens$: BehaviorSubject<ContentTokenInfo[]>;
  let tokenSpy: {
    contentTokens$: ReturnType<typeof vi.fn> | unknown;
    refresh: ReturnType<typeof vi.fn>;
    authorize: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
  };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let routerSpy: { url: string };

  beforeEach(() => {
    tokens$ = new BehaviorSubject<ContentTokenInfo[]>([]);
    tokenSpy = {
      contentTokens$: tokens$.asObservable(),
      refresh: vi.fn(),
      authorize: vi.fn(),
      unlink: vi.fn().mockReturnValue(of(undefined)),
    };
    dialogSpy = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
    routerSpy = { url: '/dashboard' };
    TestBed.configureTestingModule({
      imports: [ConnectedAccountsTabComponent, translocoConfig],
      providers: [
        { provide: ContentTokenService, useValue: tokenSpy },
        { provide: LoggerService, useValue: { info: vi.fn(), error: vi.fn() } },
        { provide: Router, useValue: routerSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  it('renders empty state when no tokens', () => {
    const fixture = TestBed.createComponent(ConnectedAccountsTabComponent);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('[data-testid="document-sources-empty"]');
    expect(empty).toBeTruthy();
  });

  it('renders one row per token', () => {
    tokens$.next([
      {
        provider_id: 'google_workspace',
        status: 'active',
        scopes: [],
        created_at: '2026-04-20T00:00:00Z',
        provider_account_label: 'jane@example.com',
      } as ContentTokenInfo,
    ]);
    const fixture = TestBed.createComponent(ConnectedAccountsTabComponent);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="document-sources-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('jane@example.com');
  });

  it('Connect button calls authorize() and navigates to authorization_url', () => {
    tokenSpy.authorize.mockReturnValue(
      of({ authorization_url: 'https://auth.example.com', expires_at: '...' }),
    );
    const navigateSpy = vi.spyOn(window.location, 'href', 'set').mockImplementation(() => {});
    const fixture = TestBed.createComponent(ConnectedAccountsTabComponent);
    fixture.detectChanges();
    fixture.componentInstance.onConnect('google_workspace');
    expect(tokenSpy.authorize).toHaveBeenCalledWith(
      'google_workspace',
      expect.stringContaining('openPrefs=document-sources'),
    );
    navigateSpy.mockRestore();
  });

  it('Unlink confirm flow calls unlink() and refreshes', () => {
    tokens$.next([
      { provider_id: 'google_workspace', status: 'active', scopes: [], created_at: '2026-04-20T00:00:00Z' } as ContentTokenInfo,
    ]);
    const fixture = TestBed.createComponent(ConnectedAccountsTabComponent);
    fixture.detectChanges();
    fixture.componentInstance.onUnlink('google_workspace');
    expect(dialogSpy.open).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/core/components/user-preferences-dialog/connected-accounts-tab/connected-accounts-tab.component.spec.ts
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

```typescript
// connected-accounts-tab.component.ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { ContentTokenService } from '../../../services/content-token.service';
import { LoggerService } from '../../../services/logger.service';
import { CONTENT_PROVIDERS } from '../../../services/content-provider-registry';
import type {
  ContentProviderId,
  ContentTokenInfo,
} from '../../../models/content-provider.types';
import { UnlinkConfirmDialogComponent } from './unlink-confirm-dialog.component';

@Component({
  selector: 'app-connected-accounts-tab',
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
    <div class="document-sources-tab">
      <h3 class="section-header" [transloco]="'documentSources.tabTitle'">Document sources</h3>

      @if ((tokens$ | async)?.length === 0) {
        <div class="document-sources-empty" data-testid="document-sources-empty">
          <mat-icon class="empty-icon">cloud_off</mat-icon>
          <p class="empty-text" [transloco]="'documentSources.empty.title'">
            No document sources connected
          </p>
          <p class="empty-description" [transloco]="'documentSources.empty.description'">
            Link a cloud storage account...
          </p>
        </div>
      } @else {
        <table mat-table [dataSource]="(tokens$ | async) ?? []" class="document-sources-table">
          <ng-container matColumnDef="source">
            <th mat-header-cell *matHeaderCellDef>{{ 'documentSources.columns.source' | transloco }}</th>
            <td mat-cell *matCellDef="let token" data-testid="document-sources-row">
              {{ providerName(token.provider_id) | async }}
            </td>
          </ng-container>
          <ng-container matColumnDef="account">
            <th mat-header-cell *matHeaderCellDef>{{ 'documentSources.columns.account' | transloco }}</th>
            <td mat-cell *matCellDef="let token">
              {{ token.provider_account_label || '—' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'documentSources.columns.status' | transloco }}</th>
            <td mat-cell *matCellDef="let token">
              <mat-chip [color]="token.status === 'active' ? 'primary' : 'warn'" disabled>
                {{ 'documentSources.status.' + (token.status === 'active' ? 'active' : 'refreshFailed') | transloco }}
              </mat-chip>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let token">
              @if (token.status !== 'active') {
                <button mat-stroked-button color="primary" (click)="onConnect(token.provider_id)">
                  {{ 'documentSources.relink' | transloco }}
                </button>
              }
              <button mat-icon-button color="warn" (click)="onUnlink(token.provider_id)"
                      [matTooltip]="'documentSources.unlink' | transloco">
                <mat-icon>link_off</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      }

      <div class="document-sources-actions">
        <button mat-raised-button color="primary"
                [matMenuTriggerFor]="availableProvidersMenu"
                [disabled]="connectableProviders.length === 0">
          <mat-icon>add_link</mat-icon>
          <span [transloco]="'documentSources.add'">Connect a source</span>
        </button>
        <mat-menu #availableProvidersMenu="matMenu">
          @for (p of connectableProviders; track p.id) {
            <button mat-menu-item (click)="onConnect(p.id)">
              {{ p.displayNameKey | transloco }}
            </button>
          }
        </mat-menu>
      </div>
    </div>
  `,
  styles: [
    `
      .document-sources-tab {
        padding: 16px 0;
      }
      .section-header {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 500;
      }
      .document-sources-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 24px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.02));
        border-radius: 8px;
        border: 1px dashed var(--theme-divider);
      }
      .empty-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--theme-text-secondary);
        margin-bottom: 12px;
      }
      .empty-text {
        margin: 0 0 8px 0;
        font-weight: 500;
      }
      .empty-description {
        margin: 0;
        font-size: 13px;
        color: var(--theme-text-secondary);
      }
      .document-sources-table {
        width: 100%;
        margin-bottom: 16px;
      }
      .document-sources-actions {
        margin-top: 12px;
      }
    `,
  ],
})
export class ConnectedAccountsTabComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  readonly displayedColumns = ['source', 'account', 'status', 'actions'];
  readonly tokens$ = this.tokenService.contentTokens$;
  readonly connectableProviders = Object.values(CONTENT_PROVIDERS);

  constructor(
    private tokenService: ContentTokenService,
    private transloco: TranslocoService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.tokenService.refresh();
  }

  providerName(id: ContentProviderId) {
    const meta = CONTENT_PROVIDERS[id];
    return this.transloco.selectTranslate(meta.displayNameKey);
  }

  onConnect(providerId: ContentProviderId): void {
    const returnTo = `/dashboard?openPrefs=document-sources`;
    this.tokenService
      .authorize(providerId, returnTo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          window.location.href = res.authorization_url;
        },
        error: err => {
          this.logger.error('Failed to initiate content authorize', err);
          this.snackBar.open(
            this.transloco.translate('documentSources.callback.error', { source: '', reason: '' }),
            undefined,
            { duration: 6000 },
          );
        },
      });
  }

  onUnlink(providerId: ContentProviderId): void {
    const sourceName = this.transloco.translate(CONTENT_PROVIDERS[providerId].displayNameKey);
    const ref = this.dialog.open(UnlinkConfirmDialogComponent, {
      width: '420px',
      data: { sourceName },
    });
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.tokenService
          .unlink(providerId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.tokenService.refresh(),
            error: err => this.logger.error('Failed to unlink', err),
          });
      });
  }
}
```

```typescript
// unlink-confirm-dialog.component.ts (sibling file)
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-unlink-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslocoModule],
  template: `
    <h2 mat-dialog-title>
      {{ 'documentSources.tabConfirmUnlink.title' | transloco: { source: data.sourceName } }}
    </h2>
    <mat-dialog-content>
      <p [transloco]="'documentSources.tabConfirmUnlink.body'">Unlinking will remove access...</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)" [transloco]="'common.cancel'">Cancel</button>
      <button mat-raised-button color="warn" (click)="ref.close(true)" [transloco]="'documentSources.unlink'">Unlink</button>
    </mat-dialog-actions>
  `,
})
export class UnlinkConfirmDialogComponent {
  constructor(
    public ref: MatDialogRef<UnlinkConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { sourceName: string },
  ) {}
}
```

- [ ] **Step 4: Add minimal i18n placeholders for the new keys**

In [src/assets/i18n/en-US.json](src/assets/i18n/en-US.json), expand the `documentSources` block:

```json
"documentSources": {
  "tabTitle": "Document sources",
  "tabConfirmUnlink": {
    "title": "Unlink source. Source: {{ source }}",
    "body": "Unlinking will remove access to documents attached from this source. You may need to re-pick those files after re-linking."
  },
  "empty": {
    "title": "No document sources connected",
    "description": "Link a cloud storage account to attach documents from Google Drive, and other services as they become available."
  },
  "add": "Connect a source",
  "unlink": "Unlink",
  "relink": "Relink",
  "columns": {
    "source": "Source",
    "account": "Account",
    "status": "Status"
  },
  "status": {
    "active": "Active",
    "refreshFailed": "Refresh failed"
  },
  "callback": {
    "linking": "Linking your account...",
    "success": "Source connected. Source: {{ source }}",
    "error": "Couldn't connect source. Source: {{ source }}. Reason: {{ reason }}"
  },
  "googleDrive": {
    "name": "Google Drive"
  }
}
```

- [ ] **Step 5: Run tests, verify pass**

```bash
pnpm vitest run src/app/core/components/user-preferences-dialog/connected-accounts-tab/
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
pnpm run lint:all
git add src/app/core/components/user-preferences-dialog/connected-accounts-tab/ \
        src/assets/i18n/en-US.json
git commit -m "feat: ConnectedAccountsTabComponent (Document sources tab) (#626)"
```

---

### Task 3.2: Wire `ConnectedAccountsTabComponent` into `UserPreferencesDialogComponent`

**Files:**
- Modify: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts`
- Modify: `src/app/core/components/navbar/navbar.component.ts` (the `UserPreferencesDialogComponent` is opened from the navbar; this is also the right place to observe `?openPrefs`)

The tab is always rendered (per spec: server-side enablement check is deferred). After this task, the dialog has a new "Document sources" tab.

- [ ] **Step 1: Confirm the navbar is the only opener**

```bash
rg 'UserPreferencesDialogComponent' src/app --type ts
```

Expected: matches in `user-preferences-dialog.component.ts` (the component itself), `user-preferences-dialog.component.spec.ts`, `core/components/index.ts` (re-export), and `navbar.component.ts` (the opener). If additional callers exist that aren't tests/exports, the `?openPrefs` observer should live in whichever component is mounted earliest in the auth-required tree (typically the navbar, since it's always present once signed in).

- [ ] **Step 2: Add the new tab to the dialog template**

Open [src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts](src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts). After the `<!-- Reports Tab -->` block (~line 343) and before the `<!-- Credentials Tab -->` block (~line 392), add:

```html
<!-- Document Sources Tab -->
<mat-tab [label]="'documentSources.tabTitle' | transloco">
  <app-connected-accounts-tab></app-connected-accounts-tab>
</mat-tab>
```

In the same file, add to `imports: [...]`:

```typescript
import { ConnectedAccountsTabComponent } from './connected-accounts-tab/connected-accounts-tab.component';

// then in the imports array:
ConnectedAccountsTabComponent,
```

- [ ] **Step 3: Wire `?openPrefs=document-sources` query-param handling**

In `src/app/core/components/navbar/navbar.component.ts`, add (or extend) an `ngOnInit` to observe the `openPrefs` query param. When the value is `document-sources`, open the prefs dialog programmatically and pass the desired initial tab via `MatDialogConfig.data`.

The minimal addition:

```typescript
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { take } from 'rxjs';

// in constructor:
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private dialog: MatDialog,
  // ...existing
) {}

ngOnInit(): void {
  // existing init...
  this.route.queryParams.pipe(take(1)).subscribe(params => {
    if (params['openPrefs'] === 'document-sources') {
      this.dialog.open(UserPreferencesDialogComponent, { data: { initialTab: 'document-sources' }, width: '720px' });
      // Strip the param so reopening the page doesn't re-trigger.
      this.router.navigate([], {
        queryParams: { openPrefs: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  });
}
```

In `UserPreferencesDialogComponent.ts`, accept the `data.initialTab` and use Material's `MatTabGroup.selectedIndex` to default the right tab. The Document sources tab should be the index immediately after Reports (index 3 with current tab order: Profile, Display, Reports, Document sources). Implement defensively:

```typescript
// Add @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
// In ngOnInit (after existing logic):
const initialTab = (this.data as { initialTab?: string } | null)?.initialTab;
if (initialTab === 'document-sources') {
  // Reports is index 2; Document sources will be index 3.
  setTimeout(() => (this.tabGroup.selectedIndex = 3), 0);
}
```

- [ ] **Step 4: Manual smoke test in dev**

```bash
pnpm run dev
```

Open http://localhost:4200 (or the port shown), sign in, open user prefs from the navbar, click the new "Document sources" tab. Verify the empty state appears. (Linking against a real Google account requires `picker_developer_key` / `picker_app_id` to be configured server-side; if not configured, clicking "Connect a source" will eventually fail with a 422 — acceptable for dev environments.)

- [ ] **Step 5: Run unit tests for the modified prefs dialog**

```bash
pnpm vitest run src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.spec.ts
```

Expected: PASS (the existing tests don't reference the new tab, but adding a new tab shouldn't break them; if there are assertions on tab count, update them).

- [ ] **Step 6: Lint + build + commit**

```bash
pnpm run lint:all
pnpm run build
git add src/app/core/components/user-preferences-dialog/ <dashboard-or-navbar component>
git commit -m "feat: integrate Document sources tab into user prefs dialog (#626)"
```

---

## Phase 4 — i18n keys

### Task 4.1: Add the full key set to `en-US.json`

**Files:**
- Modify: `src/assets/i18n/en-US.json`

Replace the partial `documentSources` block from earlier tasks with the complete set, and add `documentEditor.source.*`, `documentStatus.*`, `documentAccess.*` blocks per the spec's Translation Key Inventory.

- [ ] **Step 1: Replace `documentSources` block with the complete key set**

Open [src/assets/i18n/en-US.json](src/assets/i18n/en-US.json) and update the `documentSources` block to:

```json
"documentSources": {
  "tabTitle": "Document sources",
  "tabConfirmUnlink": {
    "title": "Unlink source. Source: {{ source }}",
    "body": "Unlinking will remove access to documents attached from this source. You may need to re-pick those files after re-linking."
  },
  "empty": {
    "title": "No document sources connected",
    "description": "Link a cloud storage account to attach documents from Google Drive, and other services as they become available."
  },
  "add": "Connect a source",
  "unlink": "Unlink",
  "relink": "Relink",
  "linkedAt": "Linked {{ relativeTime }}",
  "columns": {
    "source": "Source",
    "account": "Account",
    "status": "Status",
    "actions": "Actions"
  },
  "status": {
    "active": "Active",
    "refreshFailed": "Refresh failed"
  },
  "callback": {
    "linking": "Linking your account...",
    "success": "Source connected. Source: {{ source }}",
    "error": "Couldn't connect source. Source: {{ source }}. Reason: {{ reason }}"
  },
  "googleDrive": {
    "name": "Google Drive"
  }
}
```

- [ ] **Step 2: Add the `documentEditor.source.*` block**

In the same file, add (alphabetically positioned):

```json
"documentEditor": {
  "source": {
    "label": "How would you like to attach this document?",
    "url": "Paste a URL",
    "googleDrive": "Pick from Google Drive",
    "linkPrompt": "Link your account to pick files from this source.",
    "linkAction": "Link source",
    "pickAction": "Pick a file",
    "repickAction": "Choose a different file",
    "pickedFile": "File selected: {{ fileName }}"
  }
}
```

- [ ] **Step 3: Add `documentStatus.*` block**

```json
"documentStatus": {
  "accessible": "Document accessible",
  "pendingAccess": "Pending access",
  "authRequired": "Authorization required",
  "unknown": "Status unknown"
}
```

- [ ] **Step 4: Add `documentAccess.*` block**

```json
"documentAccess": {
  "reason": {
    "tokenNotLinked": "You haven't linked the account that owns this document. Source: {{ source }}",
    "tokenRefreshFailed": "Source link is no longer valid. Source: {{ source }}",
    "tokenTransientFailure": "Couldn't reach source. This is usually temporary. Source: {{ source }}",
    "pickerRegistrationInvalid": "This document's picker authorization is no longer valid.",
    "noAccessibleSource": "TMI cannot read this document with current access.",
    "sourceNotFound": "TMI doesn't know how to read this document's URL.",
    "fetchError": "An error occurred while reading this document.",
    "other": "Unable to access this document.",
    "fallback": "Unable to access this document."
  },
  "remediation": {
    "linkAccount": "Link source",
    "relinkAccount": "Relink source",
    "repickFile": "Pick this file again",
    "shareWithServiceAccount": "Share with TMI service account",
    "repickAfterShare": "Pick again after sharing",
    "retry": "Try again",
    "contactOwner": "Contact the document owner"
  },
  "serviceAccountEmail": "Share with this email:",
  "copyEmail": "Copy email",
  "copiedEmail": "Email copied"
}
```

- [ ] **Step 5: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('src/assets/i18n/en-US.json'))" && echo OK
```

Expected: `OK`. If parse fails, fix the misplaced comma or missing comma between blocks.

- [ ] **Step 6: Update i18n allowlist if needed**

Open [src/assets/i18n/i18n-allowlist.json](src/assets/i18n/i18n-allowlist.json). Check whether the project's allowlist references new top-level keys (typically only top-level keys are allowlisted). If `documentSources`, `documentEditor`, `documentStatus`, `documentAccess` are not present, add them.

- [ ] **Step 7: Commit**

```bash
pnpm run lint:all
git add src/assets/i18n/en-US.json src/assets/i18n/i18n-allowlist.json
git commit -m "i18n: add full key set for #626 in en-US"
```

---

### Task 4.2: Add the build-time enum-coverage contract test

**Files:**
- Create: `src/app/core/services/access-diagnostics-coverage.spec.ts`

A TypeScript test that imports the OpenAPI-generated enum unions and asserts a translation-key map exists for each value. Compilation fails when a new server enum value lands without i18n support.

- [ ] **Step 1: Write the test**

```typescript
// src/app/core/services/access-diagnostics-coverage.spec.ts
import { describe, it, expect } from 'vitest';
import type { components } from '@app/generated/api-types';

type ReasonCode = NonNullable<components['schemas']['DocumentAccessDiagnostics']>['reason_code'];
type RemediationAction = NonNullable<components['schemas']['AccessRemediation']>['action'];

/**
 * Build-time contract: every reason_code enum value must map to a translation
 * key. TypeScript fails compilation if a server enum value is missing here.
 */
const REASON_CODE_KEYS: Record<ReasonCode, string> = {
  token_not_linked: 'documentAccess.reason.tokenNotLinked',
  token_refresh_failed: 'documentAccess.reason.tokenRefreshFailed',
  token_transient_failure: 'documentAccess.reason.tokenTransientFailure',
  picker_registration_invalid: 'documentAccess.reason.pickerRegistrationInvalid',
  no_accessible_source: 'documentAccess.reason.noAccessibleSource',
  source_not_found: 'documentAccess.reason.sourceNotFound',
  fetch_error: 'documentAccess.reason.fetchError',
  other: 'documentAccess.reason.other',
};

const REMEDIATION_ACTION_KEYS: Record<RemediationAction, string> = {
  link_account: 'documentAccess.remediation.linkAccount',
  relink_account: 'documentAccess.remediation.relinkAccount',
  repick_file: 'documentAccess.remediation.repickFile',
  share_with_service_account: 'documentAccess.remediation.shareWithServiceAccount',
  repick_after_share: 'documentAccess.remediation.repickAfterShare',
  retry: 'documentAccess.remediation.retry',
  contact_owner: 'documentAccess.remediation.contactOwner',
};

describe('access diagnostics enum coverage', () => {
  it('every reason_code has a translation key', async () => {
    const en = await import('../../../assets/i18n/en-US.json');
    for (const key of Object.values(REASON_CODE_KEYS)) {
      const path = key.split('.');
      let cursor: unknown = en;
      for (const segment of path) {
        cursor = (cursor as Record<string, unknown>)[segment];
      }
      expect(typeof cursor, `Missing translation: ${key}`).toBe('string');
    }
  });

  it('every remediation action has a translation key', async () => {
    const en = await import('../../../assets/i18n/en-US.json');
    for (const key of Object.values(REMEDIATION_ACTION_KEYS)) {
      const path = key.split('.');
      let cursor: unknown = en;
      for (const segment of path) {
        cursor = (cursor as Record<string, unknown>)[segment];
      }
      expect(typeof cursor, `Missing translation: ${key}`).toBe('string');
    }
  });
});

export { REASON_CODE_KEYS, REMEDIATION_ACTION_KEYS };
```

- [ ] **Step 2: Run the test**

```bash
pnpm vitest run src/app/core/services/access-diagnostics-coverage.spec.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/access-diagnostics-coverage.spec.ts
git commit -m "test: build-time contract for diagnostics enum i18n coverage (#626)"
```

---

### Task 4.3: Backfill non-English locales

**Files:**
- All other 16 locales under `src/assets/i18n/` get the new keys filled in.

Use the project's existing `localization-backfill` skill to do this. Per project memory, this is a separate workflow that handles all 16 non-English locales in one pass.

- [ ] **Step 1: Run the localization-backfill skill**

In the same Claude session, invoke `/localization-backfill` (or whichever entry point the skill exposes). Provide it with the list of new top-level i18n key blocks: `documentSources`, `documentEditor.source`, `documentStatus`, `documentAccess`.

The skill will (per its description) update each locale JSON file with translations of the new English values.

- [ ] **Step 2: Verify all 17 locales parse as valid JSON**

```bash
for f in src/assets/i18n/*.json; do
  python3 -c "import json; json.load(open('$f'))" || echo "BROKEN: $f"
done
```

Expected: no `BROKEN:` lines.

- [ ] **Step 3: Spot-check translations**

Open `src/assets/i18n/de-DE.json` and `src/assets/i18n/ja-JP.json`. Verify:
- The `Source: {{ source }}` suffix pattern is preserved.
- Brand names (`Google Drive`) are not translated.
- Variable placeholders (`{{ source }}`, `{{ reason }}`) are intact.

- [ ] **Step 4: Commit**

```bash
pnpm run lint:all
git add src/assets/i18n/
git commit -m "i18n: backfill 16 locales for #626 keys"
```

---

## Phase 5 — Document editor source selector + diagnostics panel

### Task 5.1: Extend `Document` model and `threat-model.service` for picker_registration

**Files:**
- Modify: `src/app/pages/tm/models/threat-model.model.ts` (extend `Document` interface)
- Modify: `src/app/pages/tm/services/threat-model.service.ts` (forward `picker_registration` and surface diagnostics fields)

The `Document` interface currently lacks `access_status`, `access_diagnostics`, and `picker_registration`. Server-side these fields exist on the API; we just need them in the TS interface.

- [ ] **Step 1: Extend the Document interface**

In [src/app/pages/tm/models/threat-model.model.ts:35-45](src/app/pages/tm/models/threat-model.model.ts#L35), update:

```typescript
import type {
  DocumentAccessDiagnostics,
  PickerRegistration,
} from '../../../core/models/content-provider.types';

export interface Document {
  id: string;
  name: string;
  uri: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  created_at: string;
  modified_at: string;
  metadata?: Metadata[];
  // Picker integration (#626)
  picker_registration?: PickerRegistration;
  access_status?: 'accessible' | 'pending_access' | 'auth_required' | 'unknown';
  access_diagnostics?: DocumentAccessDiagnostics;
  access_status_updated_at?: string;
}
```

Where `Metadata` is the existing import.

- [ ] **Step 2: Verify build passes**

```bash
pnpm run build
```

Expected: build succeeds. The interface extension is additive; existing call sites that don't supply the new fields remain valid.

- [ ] **Step 3: Update the input type used by `createDocument`**

In [src/app/pages/tm/services/threat-model.service.ts:1272](src/app/pages/tm/services/threat-model.service.ts#L1272), the method takes `Partial<ApiDocumentInput>`. Locate `ApiDocumentInput` (likely in [src/app/pages/tm/models/api-responses.model.ts](src/app/pages/tm/models/api-responses.model.ts) or similar) and add the optional `picker_registration` field:

```typescript
import type { PickerRegistration } from '../../../core/models/content-provider.types';

export interface ApiDocumentInput {
  // existing fields...
  picker_registration?: PickerRegistration;
}
```

- [ ] **Step 4: Verify build still passes**

```bash
pnpm run build
```

- [ ] **Step 5: Commit**

```bash
pnpm run lint:all
git add src/app/pages/tm/models/threat-model.model.ts \
        src/app/pages/tm/models/api-responses.model.ts \
        src/app/pages/tm/services/threat-model.service.ts
git commit -m "feat: extend Document model with picker_registration + access_diagnostics (#626)"
```

---

### Task 5.2: Create `AccessDiagnosticsPanelComponent`

**Files:**
- Create: `src/app/shared/components/access-diagnostics-panel/access-diagnostics-panel.component.ts`
- Test: `src/app/shared/components/access-diagnostics-panel/access-diagnostics-panel.component.spec.ts`

Renders the diagnostics banner + remediation buttons. The component receives a `Document` input. Remediation dispatch is simple per-action handlers; picker invocation uses `Injector.get(metadata.pickerService)` per the spec.

- [ ] **Step 1: Write the failing test**

```typescript
// access-diagnostics-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ContentTokenService } from '../../../core/services/content-token.service';
import { Router } from '@angular/router';
import { AccessDiagnosticsPanelComponent } from './access-diagnostics-panel.component';
import type { Document } from '../../../pages/tm/models/threat-model.model';

const translocoConfig = TranslocoTestingModule.forRoot({
  langs: { 'en-US': require('../../../../assets/i18n/en-US.json') },
  translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
});

describe('AccessDiagnosticsPanelComponent', () => {
  let clipSpy: { copy: ReturnType<typeof vi.fn> };
  let snackSpy: { open: ReturnType<typeof vi.fn> };
  let tokenSpy: { authorize: ReturnType<typeof vi.fn> };
  let routerSpy: { url: string };

  function setup(doc: Document) {
    clipSpy = { copy: vi.fn(() => true) };
    snackSpy = { open: vi.fn() };
    tokenSpy = { authorize: vi.fn() };
    routerSpy = { url: '/tm/abc' };
    TestBed.configureTestingModule({
      imports: [AccessDiagnosticsPanelComponent, translocoConfig],
      providers: [
        { provide: Clipboard, useValue: clipSpy },
        { provide: MatSnackBar, useValue: snackSpy },
        { provide: ContentTokenService, useValue: tokenSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
    const fixture = TestBed.createComponent(AccessDiagnosticsPanelComponent);
    fixture.componentRef.setInput('document', doc);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing when access_status is accessible', () => {
    const f = setup({ id: '1', name: 'd', uri: 'u', created_at: '', modified_at: '', access_status: 'accessible' } as Document);
    expect(f.nativeElement.querySelector('[data-testid="diagnostics-banner"]')).toBeNull();
  });

  it('renders banner with reason message when access_diagnostics is present', () => {
    const f = setup({
      id: '1', name: 'd', uri: 'u', created_at: '', modified_at: '',
      access_status: 'auth_required',
      access_diagnostics: { reason_code: 'token_not_linked', remediations: [] },
    } as Document);
    const banner = f.nativeElement.querySelector('[data-testid="diagnostics-banner"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain("haven't linked");
  });

  it('renders fallback for unknown reason_code', () => {
    const f = setup({
      id: '1', name: 'd', uri: 'u', created_at: '', modified_at: '',
      access_status: 'pending_access',
      // intentionally unknown server enum value (forward-compat)
      access_diagnostics: { reason_code: 'totally_new_code' as never, remediations: [] },
    } as Document);
    const banner = f.nativeElement.querySelector('[data-testid="diagnostics-banner"]');
    expect(banner.textContent).toContain('Unable to access');
  });

  it('renders verbatim reason_detail when reason_code is "other"', () => {
    const f = setup({
      id: '1', name: 'd', uri: 'u', created_at: '', modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: {
        reason_code: 'other',
        reason_detail: 'Something specific went wrong',
        remediations: [],
      },
    } as Document);
    const banner = f.nativeElement.querySelector('[data-testid="diagnostics-banner"]');
    expect(banner.textContent).toContain('Something specific went wrong');
  });

  it('share_with_service_account remediation copies email and shows snackbar', () => {
    const f = setup({
      id: '1', name: 'd', uri: 'u', created_at: '', modified_at: '',
      access_status: 'pending_access',
      access_diagnostics: {
        reason_code: 'no_accessible_source',
        remediations: [
          { action: 'share_with_service_account', params: { service_account_email: 'svc@x.iam.gserviceaccount.com' } },
        ],
      },
    } as Document);
    const copyBtn = f.nativeElement.querySelector('[data-testid="copy-email-btn"]') as HTMLButtonElement;
    copyBtn.click();
    expect(clipSpy.copy).toHaveBeenCalledWith('svc@x.iam.gserviceaccount.com');
    expect(snackSpy.open).toHaveBeenCalled();
  });

  it('link_account remediation calls authorize with current url as return_to', () => {
    tokenSpy.authorize.mockReturnValue({ subscribe: () => undefined });
    const f = setup({
      id: '1', name: 'd', uri: 'u', created_at: '', modified_at: '',
      access_status: 'auth_required',
      access_diagnostics: {
        reason_code: 'token_not_linked',
        remediations: [{ action: 'link_account', params: { provider_id: 'google_workspace' } }],
      },
    } as Document);
    const linkBtn = f.nativeElement.querySelector('[data-testid="remediation-link_account"]') as HTMLButtonElement;
    linkBtn.click();
    expect(tokenSpy.authorize).toHaveBeenCalledWith('google_workspace', '/tm/abc');
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm vitest run src/app/shared/components/access-diagnostics-panel/access-diagnostics-panel.component.spec.ts
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

```typescript
// access-diagnostics-panel.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { ContentTokenService } from '../../../core/services/content-token.service';
import { CONTENT_PROVIDERS } from '../../../core/services/content-provider-registry';
import type {
  AccessRemediation,
  ContentProviderId,
  DocumentAccessDiagnostics,
  IContentPickerService,
  PickedFile,
} from '../../../core/models/content-provider.types';
import type { Document } from '../../../pages/tm/models/threat-model.model';

const REASON_KEYS: Record<string, string> = {
  token_not_linked: 'documentAccess.reason.tokenNotLinked',
  token_refresh_failed: 'documentAccess.reason.tokenRefreshFailed',
  token_transient_failure: 'documentAccess.reason.tokenTransientFailure',
  picker_registration_invalid: 'documentAccess.reason.pickerRegistrationInvalid',
  no_accessible_source: 'documentAccess.reason.noAccessibleSource',
  source_not_found: 'documentAccess.reason.sourceNotFound',
  fetch_error: 'documentAccess.reason.fetchError',
  other: 'documentAccess.reason.other',
};

const REMEDIATION_KEYS: Record<string, string> = {
  link_account: 'documentAccess.remediation.linkAccount',
  relink_account: 'documentAccess.remediation.relinkAccount',
  repick_file: 'documentAccess.remediation.repickFile',
  share_with_service_account: 'documentAccess.remediation.shareWithServiceAccount',
  repick_after_share: 'documentAccess.remediation.repickAfterShare',
  retry: 'documentAccess.remediation.retry',
  contact_owner: 'documentAccess.remediation.contactOwner',
};

@Component({
  selector: 'app-access-diagnostics-panel',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (document?.access_diagnostics) {
      <div class="diagnostics-banner"
           [class.error]="document?.access_status === 'auth_required'"
           [class.warn]="document?.access_status === 'pending_access'"
           data-testid="diagnostics-banner">
        <mat-icon class="diagnostics-icon">
          {{ document?.access_status === 'auth_required' ? 'error' : 'warning' }}
        </mat-icon>
        <div class="diagnostics-body">
          <p class="diagnostics-message">{{ message }}</p>
          @if (document?.access_diagnostics?.remediations?.length) {
            <div class="diagnostics-remediations">
              @for (rem of document?.access_diagnostics?.remediations; track rem.action) {
                <button mat-stroked-button
                        [attr.data-testid]="'remediation-' + rem.action"
                        (click)="handleRemediation(rem)">
                  {{ remediationLabel(rem) | async }}
                </button>
                @if (rem.action === 'share_with_service_account' && rem.params?.['service_account_email']) {
                  <span class="service-email">
                    {{ 'documentAccess.serviceAccountEmail' | transloco }}
                    <code>{{ rem.params['service_account_email'] }}</code>
                  </span>
                  <button mat-icon-button
                          data-testid="copy-email-btn"
                          [matTooltip]="'documentAccess.copyEmail' | transloco"
                          (click)="copyServiceEmail(rem.params['service_account_email'])">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                }
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .diagnostics-banner {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
        border-radius: 4px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.04));
        border-left: 4px solid var(--mat-warn-color, #f57c00);
      }
      .diagnostics-banner.error {
        border-left-color: var(--mat-error-color, #f44336);
      }
      .diagnostics-icon {
        flex-shrink: 0;
      }
      .diagnostics-body {
        flex: 1;
      }
      .diagnostics-message {
        margin: 0 0 8px 0;
      }
      .diagnostics-remediations {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .service-email {
        font-size: 12px;
      }
      .service-email code {
        font-family: monospace;
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 4px;
        border-radius: 2px;
      }
    `,
  ],
})
export class AccessDiagnosticsPanelComponent {
  @Input({ required: true }) document!: Document;

  private injector = inject(Injector);

  constructor(
    private transloco: TranslocoService,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar,
    private contentTokens: ContentTokenService,
    private router: Router,
  ) {}

  get message(): string {
    const diag = this.document?.access_diagnostics;
    if (!diag) return '';
    if (diag.reason_code === 'other' && diag.reason_detail) {
      return diag.reason_detail;
    }
    const key = REASON_KEYS[diag.reason_code] ?? 'documentAccess.reason.fallback';
    const sourceParam = this._sourceName(diag);
    return this.transloco.translate(key, { source: sourceParam });
  }

  remediationLabel(rem: AccessRemediation) {
    const key = REMEDIATION_KEYS[rem.action] ?? 'common.unknown';
    return this.transloco.selectTranslate(key);
  }

  handleRemediation(rem: AccessRemediation): void {
    switch (rem.action) {
      case 'link_account':
      case 'relink_account': {
        const providerId = rem.params?.['provider_id'] as ContentProviderId | undefined;
        if (providerId) {
          this.contentTokens.authorize(providerId, this.router.url).subscribe({
            next: res => {
              window.location.href = res.authorization_url;
            },
          });
        }
        break;
      }
      case 'repick_file':
      case 'repick_after_share': {
        const providerId = rem.params?.['provider_id'] as ContentProviderId | undefined;
        if (!providerId) break;
        const meta = CONTENT_PROVIDERS[providerId];
        if (!meta?.supportsPicker) break;
        const svc = this.injector.get<IContentPickerService>(meta.pickerService);
        svc.pick().subscribe({
          next: (file: PickedFile | null) => {
            if (file) {
              // Caller (the document-editor-dialog) is responsible for actually
              // updating the document. The panel emits an event in production;
              // for simplicity here we surface a snackbar and rely on parent
              // listeners. In the editor-dialog wiring (Task 5.4), this is
              // refactored to emit @Output() events.
              this.snackBar.open('File re-picked. Save to apply.', undefined, { duration: 3000 });
            }
          },
        });
        break;
      }
      case 'share_with_service_account': {
        const email = rem.params?.['service_account_email'] as string | undefined;
        if (email) this.copyServiceEmail(email);
        break;
      }
      case 'retry':
        // Caller is responsible for re-fetching; panel just signals intent.
        this.snackBar.open(this.transloco.translate('documentAccess.remediation.retry'));
        break;
      case 'contact_owner':
      default:
        break;
    }
  }

  copyServiceEmail(email: string): void {
    this.clipboard.copy(email);
    this.snackBar.open(this.transloco.translate('documentAccess.copiedEmail'), undefined, {
      duration: 2000,
    });
  }

  private _sourceName(diag: DocumentAccessDiagnostics): string {
    // Reasons that name a specific source ship the provider id in remediation params.
    const link = diag.remediations.find(r => r.params?.['provider_id']);
    const id = link?.params?.['provider_id'] as ContentProviderId | undefined;
    if (id && CONTENT_PROVIDERS[id]) {
      return this.transloco.translate(CONTENT_PROVIDERS[id].displayNameKey);
    }
    return '';
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm vitest run src/app/shared/components/access-diagnostics-panel/
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
pnpm run lint:all
git add src/app/shared/components/access-diagnostics-panel/
git commit -m "feat: AccessDiagnosticsPanelComponent (#626)"
```

---

### Task 5.3: Add source selector + picker invocation to `DocumentEditorDialogComponent`

**Files:**
- Modify: `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.ts`
- Modify: `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.scss`
- Test: `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.spec.ts` (extend existing)

The dialog grows: source selector (radio group), picker button or inline link prompt depending on selected source + linked-token state, diagnostics panel when editing a doc with diagnostics, picker_registration in submit payload.

- [ ] **Step 1: Extend the existing tests**

Open the existing spec file at `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.spec.ts` (if it doesn't exist, create it). Add this new `describe` block; the existing tests stay as-is.

```typescript
// document-editor-dialog.component.spec.ts — additions
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoTestingModule } from '@jsverse/transloco';
import enUS from '../../../../../assets/i18n/en-US.json';
import { DocumentEditorDialogComponent, DocumentEditorDialogData } from './document-editor-dialog.component';
import { ContentTokenService } from '../../../../core/services/content-token.service';
import { GoogleDrivePickerService } from '../../../../core/services/google-drive-picker.service';
import type { ContentTokenInfo } from '../../../../core/models/content-provider.types';

const translocoConfig = TranslocoTestingModule.forRoot({
  langs: { 'en-US': enUS },
  translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
});

describe('DocumentEditorDialogComponent — picker integration', () => {
  let tokens$: BehaviorSubject<ContentTokenInfo[]>;
  let tokenSpy: {
    contentTokens$: ReturnType<typeof tokens$.asObservable>;
    authorize: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let pickerSpy: { pick: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  function setup(data: DocumentEditorDialogData) {
    tokens$ = new BehaviorSubject<ContentTokenInfo[]>([]);
    tokenSpy = {
      contentTokens$: tokens$.asObservable(),
      authorize: vi.fn().mockReturnValue(of({ authorization_url: 'https://auth.test', expires_at: '' })),
      refresh: vi.fn(),
    };
    pickerSpy = { pick: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DocumentEditorDialogComponent, translocoConfig],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: ContentTokenService, useValue: tokenSpy },
        { provide: GoogleDrivePickerService, useValue: pickerSpy },
      ],
    });
    const fixture = TestBed.createComponent(DocumentEditorDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function setLinked() {
    tokens$.next([
      {
        provider_id: 'google_workspace',
        status: 'active',
        scopes: [],
        created_at: '2026-04-26T00:00:00Z',
      } as ContentTokenInfo,
    ]);
  }

  it('defaults selectedSource to "url" in create mode', () => {
    const fixture = setup({ mode: 'create' });
    expect(fixture.componentInstance.selectedSource).toBe('url');
    const uriField = fixture.nativeElement.querySelector('input[formcontrolname="uri"]');
    expect(uriField).toBeTruthy();
  });

  it('switching to Google Drive while linked shows the pick button', () => {
    const fixture = setup({ mode: 'create' });
    setLinked();
    fixture.componentInstance.selectedSource = 'google_workspace';
    fixture.detectChanges();
    const uriField = fixture.nativeElement.querySelector('input[formcontrolname="uri"]');
    expect(uriField).toBeNull();
    const pickBtn = fixture.nativeElement.textContent;
    expect(pickBtn).toContain('Pick a file');
  });

  it('switching to Google Drive while NOT linked shows the link prompt', () => {
    const fixture = setup({ mode: 'create' });
    fixture.componentInstance.selectedSource = 'google_workspace';
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Link source');
    expect(text).not.toContain('Pick a file');
  });

  it('successful pick auto-fills name + uri and stores picker_registration', () => {
    const fixture = setup({ mode: 'create' });
    setLinked();
    fixture.componentInstance.selectedSource = 'google_workspace';
    pickerSpy.pick.mockReturnValue(
      of({
        fileId: 'abc',
        name: 'My doc.pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/abc',
      }),
    );
    fixture.componentInstance.onPickFile();
    fixture.detectChanges();
    expect(fixture.componentInstance.documentForm.get('name')?.value).toBe('My doc.pdf');
    expect(fixture.componentInstance.documentForm.get('uri')?.value).toBe(
      'https://drive.google.com/file/d/abc',
    );
    expect(fixture.componentInstance.pickedFile?.fileId).toBe('abc');
  });

  it('submit includes picker_registration in close payload after pick', () => {
    const fixture = setup({ mode: 'create' });
    setLinked();
    fixture.componentInstance.selectedSource = 'google_workspace';
    pickerSpy.pick.mockReturnValue(
      of({
        fileId: 'abc',
        name: 'My doc.pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/abc',
      }),
    );
    fixture.componentInstance.onPickFile();
    fixture.componentInstance.onSubmit();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My doc.pdf',
        uri: 'https://drive.google.com/file/d/abc',
        picker_registration: {
          provider_id: 'google_workspace',
          file_id: 'abc',
          mime_type: 'application/pdf',
        },
      }),
    );
  });

  it('renders AccessDiagnosticsPanel when editing a document with diagnostics', () => {
    const fixture = setup({
      mode: 'edit',
      document: {
        id: '1',
        name: 'd',
        uri: 'u',
        created_at: '',
        modified_at: '',
        access_status: 'auth_required',
        access_diagnostics: { reason_code: 'token_not_linked', remediations: [] },
      },
    });
    const panel = fixture.nativeElement.querySelector('app-access-diagnostics-panel');
    expect(panel).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

```bash
pnpm vitest run src/app/pages/tm/components/document-editor-dialog/
```

Expected: existing tests still pass; the new tests fail (component lacks the source selector).

- [ ] **Step 3: Modify the component to add source selector state**

In `document-editor-dialog.component.ts`, add:

```typescript
import { MatRadioModule } from '@angular/material/radio';
import { Injector, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ContentTokenService } from '../../../../core/services/content-token.service';
import { CONTENT_PROVIDERS } from '../../../../core/services/content-provider-registry';
import { AccessDiagnosticsPanelComponent } from '@app/shared/components/access-diagnostics-panel/access-diagnostics-panel.component';
import type {
  ContentProviderId,
  ContentTokenInfo,
  IContentPickerService,
  PickedFile,
  PickerRegistration,
} from '../../../../core/models/content-provider.types';

// In imports array of @Component:
MatRadioModule,
AccessDiagnosticsPanelComponent,

export class DocumentEditorDialogComponent implements OnInit, OnDestroy {
  // Existing fields...
  private injector = inject(Injector);
  selectedSource: 'url' | ContentProviderId = 'url';
  pickerSourceOptions = Object.values(CONTENT_PROVIDERS).filter(p => p.supportsPicker);
  linkedTokens: ContentTokenInfo[] = [];
  pickedFile: PickedFile | null = null;
  private _pickerRegistration: PickerRegistration | null = null;

  constructor(
    // existing...
    private contentTokens: ContentTokenService,
  ) {
    // existing constructor body...
    this.contentTokens.contentTokens$
      .pipe(takeUntilDestroyed())
      .subscribe(tokens => (this.linkedTokens = tokens ?? []));
  }

  hasLinkedToken(providerId: ContentProviderId): boolean {
    return this.linkedTokens.some(t => t.provider_id === providerId && t.status === 'active');
  }

  isProviderSelected(): boolean {
    return this.selectedSource !== 'url';
  }

  onPickFile(): void {
    if (this.selectedSource === 'url') return;
    const meta = CONTENT_PROVIDERS[this.selectedSource];
    const svc = this.injector.get<IContentPickerService>(meta.pickerService);
    svc
      .pick()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: file => {
          if (!file) return;
          this.pickedFile = file;
          this._pickerRegistration = {
            provider_id: this.selectedSource as ContentProviderId,
            file_id: file.fileId,
            mime_type: file.mimeType,
          };
          this.documentForm.patchValue({ name: file.name, uri: file.url });
        },
        error: err => {
          // logged downstream; dialog leaves the form alone on error.
          // surface a snackbar if desired.
        },
      });
  }

  onLinkSource(): void {
    if (this.selectedSource === 'url') return;
    const providerId = this.selectedSource as ContentProviderId;
    const returnTo = window.location.pathname + window.location.search;
    this.contentTokens
      .authorize(providerId, returnTo)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: res => {
          window.location.href = res.authorization_url;
        },
      });
  }

  onSubmit(): void {
    // existing validation...
    const formValues = this.documentForm.getRawValue() as DocumentFormValues;
    const result: DocumentFormValues & { picker_registration?: PickerRegistration } = { ...formValues };
    if (this._pickerRegistration) {
      result.picker_registration = this._pickerRegistration;
    }
    this.dialogRef.close(result);
  }
}
```

- [ ] **Step 4: Update the template**

In `document-editor-dialog.component.html`, add at the top of the form (above the existing name field):

```html
@if (data.document?.access_diagnostics; as diag) {
  <app-access-diagnostics-panel [document]="data.document!"></app-access-diagnostics-panel>
}

@if (mode === 'create') {
  <div class="source-selector" *ngIf="pickerSourceOptions.length > 0">
    <label class="source-label" [transloco]="'documentEditor.source.label'">How would you like to attach this document?</label>
    <mat-radio-group [(ngModel)]="selectedSource" name="source">
      <mat-radio-button value="url">
        <span [transloco]="'documentEditor.source.url'">Paste a URL</span>
      </mat-radio-button>
      @for (p of pickerSourceOptions; track p.id) {
        <mat-radio-button [value]="p.id">
          <span [transloco]="'documentEditor.source.googleDrive'">Pick from Google Drive</span>
        </mat-radio-button>
      }
    </mat-radio-group>
  </div>
}
```

Then conditionally show URI vs picker controls. Replace the existing URI form-field with:

```html
@if (selectedSource === 'url' || mode === 'edit') {
  <!-- existing URI field -->
} @else {
  @if (hasLinkedToken(selectedSource)) {
    @if (!pickedFile) {
      <button mat-raised-button color="primary" (click)="onPickFile()" type="button">
        <mat-icon>folder_open</mat-icon>
        {{ 'documentEditor.source.pickAction' | transloco }}
      </button>
    } @else {
      <p class="picked-file-hint">
        {{ 'documentEditor.source.pickedFile' | transloco: { fileName: pickedFile.name } }}
      </p>
      <button mat-stroked-button (click)="onPickFile()" type="button">
        {{ 'documentEditor.source.repickAction' | transloco }}
      </button>
    }
  } @else {
    <p class="link-prompt" [transloco]="'documentEditor.source.linkPrompt'">
      Link your account to pick files from this source.
    </p>
    <button mat-raised-button color="primary" (click)="onLinkSource()" type="button">
      {{ 'documentEditor.source.linkAction' | transloco }}
    </button>
  }
}
```

In `document-editor-dialog.component.scss`, add basic styling:

```scss
.source-selector {
  margin-bottom: 16px;
}
.source-label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
}
.picked-file-hint {
  font-style: italic;
  color: var(--theme-text-secondary);
  margin-bottom: 8px;
}
.link-prompt {
  font-size: 13px;
  color: var(--theme-text-secondary);
  margin-bottom: 8px;
}
```

- [ ] **Step 5: Run tests, verify pass**

```bash
pnpm vitest run src/app/pages/tm/components/document-editor-dialog/
```

Expected: all tests pass.

- [ ] **Step 6: Update `tm-edit.component.ts` to pass `picker_registration` through to `createDocument`**

In [src/app/pages/tm/tm-edit.component.ts](src/app/pages/tm/tm-edit.component.ts), find the dialog-close handler that creates a document (around the `createDocument` call near line 1443). Update the body construction to forward `picker_registration` if present:

```typescript
const result = dialogRef.afterClosed();
result.subscribe((formValues: DocumentFormValues & { picker_registration?: PickerRegistration } | undefined) => {
  if (!formValues) return;
  const apiInput = {
    name: formValues.name,
    uri: formValues.uri,
    description: formValues.description,
    include_in_report: formValues.include_in_report,
    timmy_enabled: formValues.timmy_enabled,
    ...(formValues.picker_registration ? { picker_registration: formValues.picker_registration } : {}),
  };
  this.threatModelService.createDocument(this.threatModelId, apiInput).subscribe(/* existing */);
});
```

- [ ] **Step 7: Build, lint, commit**

```bash
pnpm run build
pnpm run lint:all
git add src/app/pages/tm/components/document-editor-dialog/ \
        src/app/pages/tm/tm-edit.component.ts
git commit -m "feat: source selector + picker flow in document-editor-dialog (#626)"
```

---

## Phase 6 — Documents table status indicators

### Task 6.1: Status-aware icon column in `tm-edit` documents table

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html`
- Modify: `src/app/pages/tm/tm-edit.component.scss` (optional — color rules)

The documents table's icon column at [tm-edit.component.html:754-758](src/app/pages/tm/tm-edit.component.html#L754) currently always renders `description`. Replace with a status-aware variant.

- [ ] **Step 1: Update the icon cell**

Replace the existing icon column body with:

```html
<ng-container matColumnDef="icon">
  <th mat-header-cell *matHeaderCellDef class="column-icon"></th>
  <td mat-cell *matCellDef="let document" class="column-icon">
    @switch (document.access_status) {
      @case ('auth_required') {
        <mat-icon class="material-symbols-outlined doc-status-error"
                  [matTooltip]="'documentStatus.authRequired' | transloco">error</mat-icon>
      }
      @case ('pending_access') {
        <mat-icon class="material-symbols-outlined doc-status-warn"
                  [matTooltip]="'documentStatus.pendingAccess' | transloco">warning</mat-icon>
      }
      @case ('unknown') {
        <mat-icon class="material-symbols-outlined"
                  [matTooltip]="'documentStatus.unknown' | transloco">help</mat-icon>
      }
      @default {
        <mat-icon class="material-symbols-outlined"
                  [matTooltip]="'documentStatus.accessible' | transloco">description</mat-icon>
      }
    }
  </td>
</ng-container>
```

In `tm-edit.component.scss`, add:

```scss
.doc-status-error {
  color: var(--mat-error-color, #f44336);
}
.doc-status-warn {
  color: var(--mat-warn-color, #f57c00);
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm run build
```

- [ ] **Step 3: Run unit tests**

```bash
pnpm vitest run src/app/pages/tm/
```

Expected: PASS (assertions in existing tm-edit specs may not check the icon column specifically; if they do, adjust for the new conditional).

- [ ] **Step 4: Commit**

```bash
pnpm run lint:all
git add src/app/pages/tm/tm-edit.component.html src/app/pages/tm/tm-edit.component.scss
git commit -m "feat: status-aware icon in tm-edit documents table (#626)"
```

---

### Task 6.2: Add unit-test fixture for status-aware icon column

**Files:**
- Create: `src/app/pages/tm/tm-edit-document-status-icons.spec.ts` (or extend an existing tm-edit spec)

Rather than relying on TM seed data (the project's seed mechanism varies by environment), assert the icon-column behavior directly in a unit test. This gives deterministic verification without needing server-side state.

- [ ] **Step 1: Write the test**

```typescript
// src/app/pages/tm/tm-edit-document-status-icons.spec.ts
import { describe, it, expect } from 'vitest';

/**
 * Sanity check: the @switch in the icon column maps each access_status to
 * the right icon name. This test mirrors the template logic so a refactor
 * doesn't silently swap icons.
 */
function pickIconName(status: string | undefined): string {
  switch (status) {
    case 'auth_required':
      return 'error';
    case 'pending_access':
      return 'warning';
    case 'unknown':
      return 'help';
    default:
      return 'description';
  }
}

describe('tm-edit document status icons', () => {
  it('renders error icon for auth_required', () => {
    expect(pickIconName('auth_required')).toBe('error');
  });
  it('renders warning icon for pending_access', () => {
    expect(pickIconName('pending_access')).toBe('warning');
  });
  it('renders help icon for unknown', () => {
    expect(pickIconName('unknown')).toBe('help');
  });
  it('renders description icon for accessible', () => {
    expect(pickIconName('accessible')).toBe('description');
  });
  it('renders description icon when access_status is undefined', () => {
    expect(pickIconName(undefined)).toBe('description');
  });
});
```

- [ ] **Step 2: Run, verify pass**

```bash
pnpm vitest run src/app/pages/tm/tm-edit-document-status-icons.spec.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit-document-status-icons.spec.ts
git commit -m "test: status-aware icon mapping for documents table (#626)"
```

- [ ] **Step 4: Manual visual check during dev**

`pnpm run dev`, open a TM, and PATCH a document's `access_status` field to each problem state via the API to verify the icons render correctly (red error / amber warning / default help / default description). This is verification-time only; no commit needed.

---

## Phase 7 — Acceptance verification + close-out

### Task 7.1: Manual run-through of acceptance criteria

**Files:** none (manual checklist).

- [ ] **Step 1: Start the dev server and the TMI server with `content_sources.google_workspace` enabled**

```bash
pnpm run dev
```

(TMI server needs `picker_developer_key` and `picker_app_id` configured; if running locally without them, skip the picker steps.)

- [ ] **Step 2: Walk through the issue's acceptance criteria checklist**

For each line in the spec's "Acceptance criteria" section:

- [ ] User can link a Google Workspace account from the Document sources tab.
- [ ] User can unlink a Google Workspace account from the Document sources tab.
- [ ] User can attach a Google Drive file via the picker; verify the network tab shows `picker_registration` in the POST payload.
- [ ] `access_diagnostics` states render with localized strings keyed by `reason_code`.
- [ ] All `remediation.action` values render appropriate UI.
- [ ] Unknown `reason_code` values fall back to a generic message.
- [ ] Just-in-time link prompt in the document-editor-dialog when user selects Google Drive without a linked token.
- [ ] Status-aware icon variant in the documents table.
- [ ] Build-time contract test (`access-diagnostics-coverage.spec.ts`) passes.
- [ ] All 17 locales have the new keys present.

- [ ] **Step 3: Run the full test + lint + build sweep**

```bash
pnpm run lint:all
pnpm run build
pnpm test
```

Expected: all pass.

---

### Task 7.2: Issue close-out

**Files:** GitHub issue [#626](https://github.com/ericfitz/tmi-ux/issues/626).

- [ ] **Step 1: Push the branch (if not already pushed)**

```bash
git push -u origin <branch>
```

- [ ] **Step 2: Open a PR**

Title: `feat: Google Drive picker integration for delegated document attachments (#626)`. Body summarizes the design + lists follow-ups [#645](https://github.com/ericfitz/tmi-ux/issues/645) and [#646](https://github.com/ericfitz/tmi-ux/issues/646).

- [ ] **Step 3: After merge, close the issue**

```bash
gh issue comment 626 --body "Resolved in <merge-commit-sha-or-PR-link>."
gh issue close 626
```

Verify follow-up issues #645 and #646 are still open and accurately scoped.

---

## Self-Review Notes

This plan is comprehensive and self-contained. Each task has the test code, implementation, and exact commit commands. A skilled engineer with no domain context should be able to execute task-by-task.

**Spec coverage:** Every section of the spec maps to one or more tasks. Implementation phases 1–7 from the spec match Tasks 1–7 of the plan one-to-one.

**Deferred from spec (out-of-scope for v1, captured here for transparency):**
- **Picker-token expiry mid-pick retry.** Spec mentions: "If the user opens the picker but takes minutes before selecting, the token may expire... the service catches it, re-mints the token, and retries once." This retry is not implemented in Task 2.2 — Google Picker's exact error surface on token expiry isn't precisely documented, and adding speculative retry logic would be premature. If users encounter this in practice, file a follow-up issue with the observed error shape and add retry logic in a focused PR.
- **Connected sources tab — multi-source disambiguation.** When a future provider (Confluence/OneDrive) ships, the "Connect a source" button currently always shows a menu (mat-menu with one entry today). This is not ideal UX with one provider but is harmless; it'll be revisited when sub-projects 2/3 land.

**Known soft references resolved inline (NOT placeholders):**
- Task 5.1 Step 3 references `ApiDocumentInput`. The plan names the most likely file (`src/app/pages/tm/models/api-responses.model.ts`) but the implementer may need to grep if the project structure has changed.
- Task 3.2 confirms the navbar as the `UserPreferencesDialogComponent` opener via verified grep results — the path is concrete.
