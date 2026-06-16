# Admin Audit-Log UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only UI (tmi-ux#679) for reading the system audit log and the cross-threat-model audit log, with bidirectional cursor pagination, `around` permalink context, filters, a route-driven detail panel, and CSV/NDJSON export — against the now-fully-published server contract (tmi#464 on tmi `dev/1.4.0`).

**Architecture:** Self-contained feature under `src/app/pages/admin/audit/`. A shell (`AuditLogsPageComponent`) with a `mat-tab-nav-bar` hosts two deep-linkable child views (system, threat-models). Each view composes a config-driven filter bar + a cursor-paged table + a route-driven detail panel rendered in the view's own `<router-outlet>` (child route `:entryId`) so the table stays alive. One `AdminAuditService` wraps the four list/get endpoints plus a blob export. Read-only; no step-up. Existing per-TM audit trail page is untouched.

**Tech Stack:** Angular standalone components, OnPush, Material, Transloco i18n, RxJS, Vitest. Server contract: `GET /admin/audit/system(/{entry_id})` and `GET /admin/audit/threat_models(/{entry_id})`, response `{ entries, total, limit, next_cursor, prev_cursor }`; pagination via opaque `cursor` (direction embedded) **or** `around={entry_id}`; system-only `format=csv|ndjson` streamed export.

---

## Contract reference (verified against tmi `dev/1.4.0` `api-schema/tmi-openapi.json` on 2026-06-15)

**List response (both streams):** `{ entries: T[], total: number, limit: number, next_cursor?: string|null, prev_cursor?: string|null }`.
- `next_cursor` = older page (forward); `prev_cursor` = newer page (backward). `null`/absent = no more pages that direction. Client passes whichever cursor back via `cursor=` without interpreting direction.

**System filters:** `actor_email`, `actor_provider`, `created_after` (RFC3339), `created_before`, `http_method` (enum `POST|PUT|PATCH|DELETE`), `path_prefix`, `field_path`.
**TM filters:** `actor_email`, `actor_provider`, `created_after`, `created_before`, `change_type` (enum `created|updated|patched|deleted|rolled_back|restored`), `object_type` (enum `threat_model|diagram|threat|asset|document|note|repository`), `threat_model_id` (uuid).
**Pagination params (both):** `limit` (1–100, default 50), `cursor` (opaque, mutually exclusive with `around`), `around` (uuid, mutually exclusive with `cursor`).
**Export (system only):** `format=csv|ndjson` — streamed attachment, ignores cursor/limit/around, honors filters.

**`SystemAuditEntry`:** `id` (uuid), `actor` (AuditActor), `http_method`, `http_path`, `field_path`, `created_at` (required); `old_value_redacted`, `new_value_redacted`, `change_summary` (nullable strings).
**`AuditEntry` (TM)** and **`AuditActor`** already exist in `src/app/pages/tm/models/audit-trail.model.ts` — REUSE them. `AuditEntry`: `id, threat_model_id, object_type, object_id, version (number|null), change_type, actor, change_summary (string|null), created_at`.

**Note on generated types:** `src/app/generated/api-types.d.ts` is generated from tmi `main` and does NOT yet contain the audit schemas (the endpoints live only on `dev/1.4.0`). Do NOT regenerate the whole file (it would pull the entire 1.4.0 API diff). Hand-write audit types, mirroring the existing `audit-trail.model.ts` convention.

---

## File structure

Create under `src/app/pages/admin/audit/`:
- `models/admin-audit.model.ts` — types (SystemAuditEntry, list responses, filter/page param types, view-config types). Reuses AuditEntry/AuditActor from tm models.
- `admin-audit.service.ts` (+ `.spec.ts`) — API access.
- `audit-logs-page.component.{ts,html,scss}` (+ `.spec.ts`) — shell: tab-nav-bar + router-outlet.
- `components/audit-filter-bar.component.{ts,html,scss}` (+ `.spec.ts`) — config-driven filters + export menu.
- `components/audit-table.component.{ts,html,scss}` (+ `.spec.ts`) — cursor-paged mat-table, Newer/Older, anchor highlight.
- `components/audit-detail-panel.component.{ts,html,scss}` (+ `.spec.ts`) — route-driven detail, copy-permalink, view-in-context.
- `views/system-audit-view.component.{ts,html,scss}` (+ `.spec.ts`) — system composition.
- `views/tm-audit-view.component.{ts,html,scss}` (+ `.spec.ts`) — TM composition.

Modify:
- `src/app/core/services/api.service.ts` — add `getBlob()`.
- `src/app/shared/utils/blob-download.util.ts` — new tiny helper `downloadBlob(blob, filename)`.
- `src/app/app.routes.ts` — add audit routes under `/admin`.
- `src/app/pages/admin/admin.component.ts` — add "Audit Logs" section card.
- `src/app/pages/admin/settings/admin-settings.component.{ts,html}` — cross-reference "view in audit log" affordance.
- `src/assets/i18n/en-US.json` — all new strings (then backfill all locales).

---

## Conventions (apply to every component)

- Standalone, `changeDetection: ChangeDetectionStrategy.OnPush`. Import from `@app/shared/imports` (`COMMON_IMPORTS`, `CORE_MATERIAL_IMPORTS`, `FORM_MATERIAL_IMPORTS`, `DATA_MATERIAL_IMPORTS`, `FEEDBACK_MATERIAL_IMPORTS`) + `TranslocoModule`; add `MatAutocompleteModule`, `MatDatepickerModule`, `MatNativeDateModule` directly where needed.
- Subscriptions: `private destroyRef = inject(DestroyRef)` + `.pipe(takeUntilDestroyed(this.destroyRef))`. Call `cdr.markForCheck()` after async state updates.
- i18n: `[transloco]="'key'"` directive or `'key' | transloco` pipe. All user-facing strings localized.
- Errors: `catchError` + `LoggerService` (`this.logger.error(...)`), never `console.log`.
- `data-testid` attributes on interactive elements (match existing admin pages).
- Reference exemplars: `admin-users.component` (table, filter, query-param mirroring), `admin-projects.component` (debounced autocomplete), `admin-surveys.component` (OnPush + DestroyRef), `reviewer-assignment-list.component` (date-range pickers).

---

### Task 1: Audit domain types

**Files:**
- Create: `src/app/pages/admin/audit/models/admin-audit.model.ts`

- [ ] **Step 1: Write the types file**

```typescript
/**
 * Types for the admin audit-log UI (tmi-ux#679), matching the server contract
 * published on tmi dev/1.4.0 (tmi#398 + tmi#464). Hand-written because the
 * generated api-types.d.ts is built from tmi main, which lacks these schemas.
 */
import { AuditActor, AuditChangeType, AuditEntry, AuditObjectType } from '@app/pages/tm/models/audit-trail.model';

export { AuditActor, AuditChangeType, AuditEntry, AuditObjectType };

/** HTTP methods recorded by the system audit log. */
export type AuditHttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A system audit entry: an immutable record of a successful /admin/* write. */
export interface SystemAuditEntry {
  id: string;
  actor: AuditActor;
  http_method: string;
  http_path: string;
  field_path: string;
  old_value_redacted: string | null;
  new_value_redacted: string | null;
  change_summary: string | null;
  created_at: string;
}

/** Common cursor-paginated list envelope returned by both audit list endpoints. */
export interface AuditListResponse<T> {
  entries: T[];
  total: number;
  limit: number;
  /** Cursor for the next (older) page; null/absent when exhausted. */
  next_cursor?: string | null;
  /** Cursor for the previous (newer) page; null/absent at the newest end. */
  prev_cursor?: string | null;
}

export type ListSystemAuditResponse = AuditListResponse<SystemAuditEntry>;
export type ListTmAuditResponse = AuditListResponse<AuditEntry>;

/** Active filters for the system audit list. All optional. */
export interface SystemAuditFilter {
  actor_email?: string;
  actor_provider?: string;
  created_after?: string;
  created_before?: string;
  http_method?: AuditHttpMethod;
  path_prefix?: string;
  field_path?: string;
}

/** Active filters for the threat-model audit list. All optional. */
export interface TmAuditFilter {
  actor_email?: string;
  actor_provider?: string;
  created_after?: string;
  created_before?: string;
  change_type?: AuditChangeType;
  object_type?: AuditObjectType;
  threat_model_id?: string;
}

export type AuditFilter = SystemAuditFilter | TmAuditFilter;

/** Pagination request: forward/back cursor traversal OR around-anchor. Mutually exclusive cursor/around. */
export interface AuditPageRequest {
  limit?: number;
  cursor?: string;
  around?: string;
}

export type AuditExportFormat = 'csv' | 'ndjson';

/** Which audit stream a shared component is operating on. */
export type AuditStream = 'system' | 'tm';
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep admin-audit.model || echo "no errors in file"`
Expected: `no errors in file`

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/audit/models/admin-audit.model.ts
git commit -m "feat(admin): add audit-log UI domain types (#679)"
```

---

### Task 2: ApiService.getBlob + blob download util

**Files:**
- Modify: `src/app/core/services/api.service.ts` (add `getBlob` mirroring `getText` at ~line 100)
- Create: `src/app/shared/utils/blob-download.util.ts`
- Test: `src/app/shared/utils/blob-download.util.spec.ts`

- [ ] **Step 1: Add `getBlob` to ApiService** (immediately after the existing `getText` method)

```typescript
  /**
   * GET request that returns a Blob (for streamed file exports).
   * @param endpoint The API endpoint (without the base URL)
   * @param params Optional query parameters
   */
  getBlob(
    endpoint: string,
    params?: Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>,
  ): Observable<Blob> {
    const url = this.buildUrl(endpoint);

    return this.http.get(url, { params, responseType: 'blob' }).pipe(
      retry({
        count: 1,
        delay: (error: HttpErrorResponse) => this.getRetryDelay(error),
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'GET', endpoint)),
    );
  }
```

- [ ] **Step 2: Write the failing test for the download util**

```typescript
import '@angular/compiler';
import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from './blob-download.util';

describe('downloadBlob', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let anchor: HTMLAnchorElement;

  beforeEach(() => {
    clickSpy = vi.fn();
    anchor = document.createElement('a');
    anchor.click = clickSpy;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(node => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(node => node);
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('triggers an anchor download with the given filename and revokes the url', () => {
    const blob = new Blob(['a,b,c'], { type: 'text/csv' });
    downloadBlob(blob, 'export.csv');
    expect(anchor.download).toBe('export.csv');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** (module not found)

Run: `pnpm test -- src/app/shared/utils/blob-download.util.spec.ts`

- [ ] **Step 4: Implement the util**

```typescript
/**
 * Save a Blob to a file via a programmatic anchor download. Used for audit-log
 * exports where the blob arrives asynchronously over HttpClient (so the File
 * System Access picker, which needs a live user gesture, is not viable).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: Run test, expect PASS**

Run: `pnpm test -- src/app/shared/utils/blob-download.util.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/api.service.ts src/app/shared/utils/blob-download.util.ts src/app/shared/utils/blob-download.util.spec.ts
git commit -m "feat(core): add ApiService.getBlob and blob-download util (#679)"
```

---

### Task 3: AdminAuditService

**Files:**
- Create: `src/app/pages/admin/audit/admin-audit.service.ts`
- Test: `src/app/pages/admin/audit/admin-audit.service.spec.ts`

Service injects `ApiService` + `LoggerService`. Uses `buildHttpParams` from `@app/shared/utils/http-params.util` to drop undefined/null. For paginated lists, merge filter + page request into one params object.

- [ ] **Step 1: Write the failing tests** (mock ApiService directly, Vitest)

```typescript
import '@angular/compiler';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { of, throwError, lastValueFrom } from 'rxjs';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let api: { get: ReturnType<typeof vi.fn>; getBlob: ReturnType<typeof vi.fn> };
  let logger: { debug: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn(), getBlob: vi.fn() };
    logger = { debug: vi.fn(), error: vi.fn() };
    service = new AdminAuditService(api as never, logger as never);
  });

  it('lists system entries, passing filter + page params, dropping empties', async () => {
    api.get.mockReturnValue(of({ entries: [], total: 0, limit: 50, next_cursor: null }));
    await lastValueFrom(
      service.listSystem({ actor_email: 'a@b.c', http_method: 'PUT', path_prefix: '' }, { limit: 50, cursor: 'X' }),
    );
    expect(api.get).toHaveBeenCalledWith('admin/audit/system', {
      actor_email: 'a@b.c',
      http_method: 'PUT',
      limit: 50,
      cursor: 'X',
    });
  });

  it('lists system entries in around mode', async () => {
    api.get.mockReturnValue(of({ entries: [], total: 0, limit: 50 }));
    await lastValueFrom(service.listSystem({}, { limit: 50, around: 'uuid-1' }));
    expect(api.get).toHaveBeenCalledWith('admin/audit/system', { limit: 50, around: 'uuid-1' });
  });

  it('gets a single system entry by id', async () => {
    api.get.mockReturnValue(of({ id: 'e1' }));
    await lastValueFrom(service.getSystemEntry('e1'));
    expect(api.get).toHaveBeenCalledWith('admin/audit/system/e1');
  });

  it('lists TM entries against the threat_models endpoint', async () => {
    api.get.mockReturnValue(of({ entries: [], total: 0, limit: 50 }));
    await lastValueFrom(service.listTm({ object_type: 'threat' }, { limit: 50 }));
    expect(api.get).toHaveBeenCalledWith('admin/audit/threat_models', { object_type: 'threat', limit: 50 });
  });

  it('gets a single TM entry by id', async () => {
    api.get.mockReturnValue(of({ id: 't1' }));
    await lastValueFrom(service.getTmEntry('t1'));
    expect(api.get).toHaveBeenCalledWith('admin/audit/threat_models/t1');
  });

  it('exports system audit as a blob with format param', async () => {
    api.getBlob.mockReturnValue(of(new Blob(['x'])));
    await lastValueFrom(service.exportSystem({ actor_email: 'a@b.c' }, 'ndjson'));
    expect(api.getBlob).toHaveBeenCalledWith('admin/audit/system', { actor_email: 'a@b.c', format: 'ndjson' });
  });

  it('logs and rethrows on list error', async () => {
    api.get.mockReturnValue(throwError(() => new Error('boom')));
    await expect(lastValueFrom(service.listSystem({}, {}))).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test -- src/app/pages/admin/audit/admin-audit.service.spec.ts`

- [ ] **Step 3: Implement the service**

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  AuditEntry,
  AuditExportFormat,
  AuditPageRequest,
  ListSystemAuditResponse,
  ListTmAuditResponse,
  SystemAuditEntry,
  SystemAuditFilter,
  TmAuditFilter,
} from './models/admin-audit.model';

const SYSTEM_PATH = 'admin/audit/system';
const TM_PATH = 'admin/audit/threat_models';

@Injectable({ providedIn: 'root' })
export class AdminAuditService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  listSystem(filter: SystemAuditFilter, page: AuditPageRequest): Observable<ListSystemAuditResponse> {
    const params = buildHttpParams({ ...filter, ...page });
    return this.apiService.get<ListSystemAuditResponse>(SYSTEM_PATH, params).pipe(
      tap(r => this.logger.debug('System audit entries loaded', { count: r.entries.length, total: r.total })),
      catchError(error => {
        this.logger.error('Failed to list system audit entries', error);
        throw error;
      }),
    );
  }

  getSystemEntry(entryId: string): Observable<SystemAuditEntry> {
    return this.apiService.get<SystemAuditEntry>(`${SYSTEM_PATH}/${entryId}`).pipe(
      catchError(error => {
        this.logger.error('Failed to get system audit entry', error);
        throw error;
      }),
    );
  }

  listTm(filter: TmAuditFilter, page: AuditPageRequest): Observable<ListTmAuditResponse> {
    const params = buildHttpParams({ ...filter, ...page });
    return this.apiService.get<ListTmAuditResponse>(TM_PATH, params).pipe(
      tap(r => this.logger.debug('TM audit entries loaded', { count: r.entries.length, total: r.total })),
      catchError(error => {
        this.logger.error('Failed to list threat-model audit entries', error);
        throw error;
      }),
    );
  }

  getTmEntry(entryId: string): Observable<AuditEntry> {
    return this.apiService.get<AuditEntry>(`${TM_PATH}/${entryId}`).pipe(
      catchError(error => {
        this.logger.error('Failed to get threat-model audit entry', error);
        throw error;
      }),
    );
  }

  exportSystem(filter: SystemAuditFilter, format: AuditExportFormat): Observable<Blob> {
    const params = buildHttpParams({ ...filter, format });
    return this.apiService.getBlob(SYSTEM_PATH, params).pipe(
      tap(() => this.logger.info('System audit export downloaded', { format })),
      catchError(error => {
        this.logger.error('Failed to export system audit', error);
        throw error;
      }),
    );
  }
}
```

Note: `buildHttpParams` already returns `undefined` when empty and drops null/undefined values; the empty-string `path_prefix` in test 1 — confirm `buildHttpParams` drops empty strings. If it does NOT (it only drops null/undefined per the explored source), adjust the test expectation to include `path_prefix: ''`, OR strip empty strings in the service before building params. **Decision: strip empty strings in the service** so empty filter inputs don't send blank query params. Add a helper:

```typescript
function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>;
}
```
and call `buildHttpParams(clean({ ...filter, ...page }))`. Keep test 1 expecting `path_prefix` absent.

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm test -- src/app/pages/admin/audit/admin-audit.service.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/audit/admin-audit.service.ts src/app/pages/admin/audit/admin-audit.service.spec.ts
git commit -m "feat(admin): add AdminAuditService for audit-log endpoints (#679)"
```

---

### Task 4: Audit filter bar component

**Files:**
- Create: `src/app/pages/admin/audit/components/audit-filter-bar.component.{ts,html,scss}`
- Test: `src/app/pages/admin/audit/components/audit-filter-bar.component.spec.ts`

Config-driven so one component serves both streams. Inputs: `stream: AuditStream`, `initialFilter`. Output: `filterChange = new EventEmitter<AuditFilter>()` (debounced 300ms on text inputs; immediate on selects/dates) and `exportRequested = new EventEmitter<AuditExportFormat>()`. Actor field = debounced autocomplete against `UserAdminService.list({ ... })` (reuse the `admin-projects` autocomplete pattern; the existing admin-users actor search). Date pickers emit `created_after`/`created_before` as ISO strings (`$event.value?.toISOString()`). System shows http_method select + path_prefix + field_path; TM shows change_type select + object_type select + threat_model_id text. Export menu (CSV/NDJSON) visible only when `stream === 'system'`. Clear-filters button resets the form and emits an empty filter.

- [ ] **Step 1: Write tests** covering: (a) emits a filter object combining set fields; (b) debounce on text fields (use fake timers / `vi.useFakeTimers()`); (c) clear-filters emits `{}`; (d) export menu present only for system; `exportRequested` emits the chosen format; (e) actor autocomplete calls the user search service on input. Follow the standalone-component test pattern (`runInInjectionContext` + `Injector.create` with mocked `DestroyRef`), mocking `UserAdminService`, `LoggerService`, `TranslocoService`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** the component (`.ts`, `.html`, `.scss`). Use a reactive form group keyed by stream config. Map http_method enum values `['POST','PUT','PATCH','DELETE']`; change_type `['created','updated','patched','deleted','rolled_back','restored']`; object_type `['threat_model','diagram','threat','asset','document','note','repository']`. All labels via transloco keys under `admin.audit.filters.*`. Emit `filterChange` with only non-empty values (reuse the same `clean` rule). Debounce text inputs via a `Subject<void>` + `debounceTime(300)` + `takeUntilDestroyed`.

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/audit/components/audit-filter-bar.component.*
git commit -m "feat(admin): add audit filter-bar component (#679)"
```

---

### Task 5: Audit table component

**Files:**
- Create: `src/app/pages/admin/audit/components/audit-table.component.{ts,html,scss}`
- Test: `src/app/pages/admin/audit/components/audit-table.component.spec.ts`

Presentational. Inputs: `columns: AuditColumnDef[]` (define `AuditColumnDef { key: string; headerKey: string; cell: (row: unknown) => string }` in `admin-audit.model.ts` — add it in this task), `rows: unknown[]`, `loading: boolean`, `nextCursor: string | null | undefined`, `prevCursor: string | null | undefined`, `anchorId: string | null` (highlight row in around mode), `error: boolean`, `empty: boolean`. Outputs: `older = new EventEmitter<void>()`, `newer = new EventEmitter<void>()`, `rowClick = new EventEmitter<{ id: string }>()`, `retry = new EventEmitter<void>()`.

Template: `mat-table` with dynamic `displayedColumns = columns.map(c => c.key)`; `‹ Newer` button disabled when `!prevCursor`; `Older ›` button disabled when `!nextCursor`; row gets class `anchor-row` when `row.id === anchorId`; distinct empty state ("no entries match these filters") vs error banner + retry (per design). `data-testid` on Newer/Older/rows.

- [ ] **Step 1: Write tests:** (a) renders one row per `rows`; (b) Newer disabled when `prevCursor` null, enabled otherwise → emits `newer`; (c) Older disabled when `nextCursor` null → emits `older`; (d) row click emits `{ id }`; (e) `empty` shows empty message, `error` shows retry which emits `retry`; (f) anchor row gets `anchor-row` class. Use `createComponentFixture` from `@testing/component-test-harness` for DOM assertions.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/audit/components/audit-table.component.* src/app/pages/admin/audit/models/admin-audit.model.ts
git commit -m "feat(admin): add cursor-paged audit table component (#679)"
```

---

### Task 6: Audit detail panel component

**Files:**
- Create: `src/app/pages/admin/audit/components/audit-detail-panel.component.{ts,html,scss}`
- Test: `src/app/pages/admin/audit/components/audit-detail-panel.component.spec.ts`

Route-driven: reads `:entryId` from `ActivatedRoute.paramMap` and `stream` from `ActivatedRoute.snapshot.data['stream']` (set on the route). On param change, fetches via `AdminAuditService.getSystemEntry` or `getTmEntry`. Renders fields per stream (system: timestamp UTC absolute, full actor identity, method + path, field_path, redacted old/new values as-returned, change_summary; TM: timestamp, actor, threat-model link, object type/id, change_type, version, change_summary). Actions: **copy-permalink** (writes `window.location` absolute URL of the current route to clipboard via `navigator.clipboard.writeText`), **view-in-context** (emits/navigates to the parent list with `around={entryId}` — `router.navigate(['../'], { relativeTo, queryParams: { around: entryId } })` then close panel; the view component reacts to the `around` query param). Close button navigates back to the parent list route (`router.navigate(['../'], { relativeTo: route })`). 404 from `getXxxEntry` → show "entry not found" state. Logs errors via LoggerService.

- [ ] **Step 1: Write tests:** (a) fetches system entry when `stream='system'`, renders its fields; (b) fetches TM entry when `stream='tm'`; (c) re-fetches when `:entryId` changes; (d) copy-permalink calls `navigator.clipboard.writeText` with the permalink; (e) view-in-context navigates with `around` query param; (f) 404 error shows not-found state. Mock `AdminAuditService`, `ActivatedRoute` (paramMap as a `BehaviorSubject`/`of`, `snapshot.data`), `Router`, `LoggerService`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/audit/components/audit-detail-panel.component.*
git commit -m "feat(admin): add route-driven audit detail panel (#679)"
```

---

### Task 7: System audit view component

**Files:**
- Create: `src/app/pages/admin/audit/views/system-audit-view.component.{ts,html,scss}`
- Test: `src/app/pages/admin/audit/views/system-audit-view.component.spec.ts`

Composition + state owner for the system stream. Holds current `SystemAuditFilter`, current page request (cursor/around), `rows`, `total`, `next_cursor`, `prev_cursor`, `loading`, `error`, `anchorId`. Wires:
- `<app-audit-filter-bar [stream]="'system'" (filterChange)=... (exportRequested)=...>`
- `<app-audit-table [columns]=systemColumns [rows]=rows ... (older)=... (newer)=... (rowClick)=onRowClick($event)>`
- `<router-outlet>` for the detail panel child route.

Behavior:
- **Load**: call `auditService.listSystem(filter, page)`; on success set rows/total/cursors; `markForCheck`.
- **Filter change** → reset cursor/around (back to newest), reload, mirror filters into query params (`router.navigate([], { relativeTo, queryParams, queryParamsHandling: '', replaceUrl: true })`).
- **Older** → `listSystem(filter, { limit, cursor: next_cursor })`. **Newer** → `{ cursor: prev_cursor }`.
- **Around**: on init and on `around` query-param presence, call `listSystem(filter, { around })`, set `anchorId = around`.
- **Row click** → `router.navigate([row.id], { relativeTo: route })` (opens detail in child outlet; table stays alive).
- **Export** → `auditService.exportSystem(filter, format)` subscribe → `downloadBlob(blob, 'system-audit-<ISO>.<ext>')`; show snackbar on error.
- Restore filters + around from query params on init (`route.queryParams`).
- Column defs (`systemColumns: AuditColumnDef[]`): timestamp (`created_at`, formatted), actor (`actor.display_name` / `actor.email`), method+path (`http_method` + ` ` + `http_path`), field_path, change_summary.

- [ ] **Step 1: Write tests:** (a) loads system entries on init and renders count; (b) filter change resets cursor and reloads + updates URL; (c) Older uses next_cursor, Newer uses prev_cursor; (d) around query param triggers around load and sets anchorId; (e) export calls service + downloadBlob (mock `blob-download.util`'s `downloadBlob`); (f) row click navigates to `[id]`. Mock `AdminAuditService`, `Router`, `ActivatedRoute`, `LoggerService`, `MatSnackBar`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** (`.ts`, `.html`, `.scss`).

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/audit/views/system-audit-view.component.*
git commit -m "feat(admin): add system audit view (#679)"
```

---

### Task 8: Threat-model audit view component

**Files:**
- Create: `src/app/pages/admin/audit/views/tm-audit-view.component.{ts,html,scss}`
- Test: `src/app/pages/admin/audit/views/tm-audit-view.component.spec.ts`

Same structure as Task 7 but: `stream='tm'`, `auditService.listTm`/`getTmEntry`, `TmAuditFilter`, no export menu (filter bar hides it for non-system). Column defs (`tmColumns`): timestamp, actor, threat-model (`threat_model_id`), object type/id (`object_type` + `object_id`), change_type, change_summary. Same cursor/around/query-param/row-click behavior (minus export).

- [ ] **Step 1: Write tests** mirroring Task 7's (a)–(d), (f) for the TM stream (no export test). 

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** To avoid duplication, factor shared list/cursor/around/query-param logic into a small base class or a reusable helper if it reads cleanly; otherwise accept the parallel structure (the two views differ in service calls, filter type, and columns). Prefer readability over premature abstraction (project guidance).

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/audit/views/tm-audit-view.component.*
git commit -m "feat(admin): add threat-model audit view (#679)"
```

---

### Task 9: Shell, routes, and admin section card

**Files:**
- Create: `src/app/pages/admin/audit/audit-logs-page.component.{ts,html,scss}`
- Test: `src/app/pages/admin/audit/audit-logs-page.component.spec.ts`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin.component.ts`

Shell: `mat-tab-nav-bar` with two links (`routerLink="system"`, `routerLink="threat-models"`, `routerLinkActive`) + `<router-outlet>`. Title "Audit Logs". Standalone, OnPush.

Routes — add under the existing `/admin` `children` array in `app.routes.ts`:

```typescript
{
  path: 'audit',
  loadComponent: () =>
    import(/* webpackChunkName: "admin-audit" */ './pages/admin/audit/audit-logs-page.component').then(
      c => c.AuditLogsPageComponent,
    ),
  canActivate: [adminGuard],
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'system' },
    {
      path: 'system',
      loadComponent: () =>
        import('./pages/admin/audit/views/system-audit-view.component').then(c => c.SystemAuditViewComponent),
      children: [
        {
          path: ':entryId',
          loadComponent: () =>
            import('./pages/admin/audit/components/audit-detail-panel.component').then(
              c => c.AuditDetailPanelComponent,
            ),
          data: { stream: 'system' },
        },
      ],
    },
    {
      path: 'threat-models',
      loadComponent: () =>
        import('./pages/admin/audit/views/tm-audit-view.component').then(c => c.TmAuditViewComponent),
      children: [
        {
          path: ':entryId',
          loadComponent: () =>
            import('./pages/admin/audit/components/audit-detail-panel.component').then(
              c => c.AuditDetailPanelComponent,
            ),
          data: { stream: 'tm' },
        },
      ],
    },
  ],
},
```

(Place `audit` BEFORE any catch-all; keep `canActivate: [adminGuard]` consistent with siblings. The parent `/admin` already has `canActivate: [authGuard]`.)

Admin card — add to `adminSections` in `admin.component.ts`:

```typescript
{
  title: 'admin.sections.audit.title',
  description: 'admin.sections.audit.description',
  icon: 'history',
  action: 'audit',
},
```

- [ ] **Step 1: Write a shell spec** verifying it renders the two tab links pointing to `system` and `threat-models`. Use `createComponentFixture` with router testing harness (provide `provideRouter([])` or mock `RouterLink`).

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** shell component + add routes + admin card.

- [ ] **Step 4: Verify** shell test passes AND the app builds the lazy chunks: `pnpm test -- src/app/pages/admin/audit/audit-logs-page.component.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/audit/audit-logs-page.component.* src/app/app.routes.ts src/app/pages/admin/admin.component.ts
git commit -m "feat(admin): wire audit-log shell, routes, and nav card (#679)"
```

---

### Task 10: Cross-reference affordance on admin settings

**Files:**
- Modify: `src/app/pages/admin/settings/admin-settings.component.{ts,html}`

Add a "view in audit log" action button on each settings row that mutates state. The button is a `mat-icon-button` (action-button convention: icon `history` or `fact_check` + `matTooltip` localized `admin.audit.viewInAuditLog`) with `[routerLink]="['/admin/audit/system']"` and `[queryParams]="{ field_path: <settingKey> }"`. The system view already restores `field_path` from query params (Task 7), so this pre-filters automatically.

- [ ] **Step 1:** Read `admin-settings.component.html` to find the per-setting row template and the property holding the setting key/field path.

- [ ] **Step 2:** Add the action button to each row, wired to the setting's key as `field_path`. Add the tooltip i18n key (added in Task 11).

- [ ] **Step 3:** If `admin-settings.component.spec.ts` exists, add/adjust a test asserting the link + queryParams; otherwise add a minimal render assertion. Run it.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/admin/settings/admin-settings.component.*
git commit -m "feat(admin): add 'view in audit log' affordance on settings rows (#679)"
```

---

### Task 11: i18n — English strings + locale backfill

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify: all other `src/assets/i18n/*.json` locale files (via backfill skill)

- [ ] **Step 1:** Add all new keys to `en-US.json`. Required key groups (fill every key referenced in Tasks 4–10):
  - `admin.sections.audit.title` = "Audit Logs", `admin.sections.audit.description` = "View system and threat-model audit logs."
  - `admin.audit.title`, `admin.audit.tabs.system`, `admin.audit.tabs.threatModels`
  - `admin.audit.columns.*`: timestamp, actor, request, fieldPath, changeSummary, threatModel, object, changeType, version
  - `admin.audit.filters.*`: actor (label/placeholder), httpMethod, pathPrefix, fieldPath, changeType, objectType, threatModelId, createdAfter, createdBefore, clear; plus enum value labels for httpMethod/changeType/objectType
  - `admin.audit.pagination.newer` = "Newer", `.older` = "Older"
  - `admin.audit.export.menu`, `.csv`, `.ndjson`, `.error`
  - `admin.audit.detail.*`: title, timestamp, actor, provider, providerId, method, path, fieldPath, oldValue, newValue, changeSummary, threatModel, objectType, objectId, changeType, version, copyPermalink, copied, viewInContext, close, notFound
  - `admin.audit.empty` = "No entries match these filters.", `admin.audit.error` = "Audit query failed.", `admin.audit.retry` = "Retry"
  - `admin.audit.viewInAuditLog` = "View in audit log"

  Keep keys alphabetized within their object if the file is sorted (match existing convention). Reuse `common.*` keys (e.g. `common.close`, `common.clear`, `common.actions`) where they already exist instead of duplicating.

- [ ] **Step 2:** Validate the English file parses and the i18n check passes: `pnpm run lint:all` (or the project's i18n check script) — fix any missing-key/usage errors.

- [ ] **Step 3:** Backfill translations across all locales. Use the `localization-backfill` skill (it reads the project i18n config, translates every missing key from the master locale, preserving placeholders).

- [ ] **Step 4:** Verify coverage with the `validate-localization-coverage` skill; address any gaps.

- [ ] **Step 5: Commit**

```bash
git add src/assets/i18n/
git commit -m "feat(i18n): add audit-log UI strings and backfill locales (#679)"
```

---

### Task 12: Final verification & finish

- [ ] **Step 1: Lint** — `pnpm run lint:all`; fix all issues.
- [ ] **Step 2: Build** — `pnpm run build`; fix ALL build errors (pre-existing or new).
- [ ] **Step 3: Test** — `pnpm test`; all green. Troubleshoot to root cause, never skip.
- [ ] **Step 4: Code review** — run `superpowers:requesting-code-review` over the branch diff; address findings.
- [ ] **Step 5: Manual smoke (optional if server reachable)** — log in as admin, open `/admin/audit/system`, exercise filter, Older/Newer, row→detail permalink, view-in-context (around), CSV + NDJSON export, then `/admin/audit/threat-models`. Confirm non-admin is redirected with `error=admin_required`.
- [ ] **Step 6:** Push branch; open PR against `dev/1.4.0` referencing tmi-ux#679. Note in the PR that this implements the full contract (bidirectional cursors, around, export) now that tmi#464 has landed on the server. Do NOT close #679 until merged.

---

## Self-review notes

- **Spec coverage:** system view ✓ (T7), TM view ✓ (T8), filters ✓ (T4), columns ✓ (T5/T7/T8), row detail + permalink ✓ (T6), export ✓ (T3/T7), bidirectional pagination ✓ (T5/T7/T8), around ✓ (T6/T7/T8), routes/nav/guard ✓ (T9), cross-reference affordance ✓ (T10), empty/error states ✓ (T5), i18n ✓ (T11), tests throughout. Step-up explicitly out of scope per decision.
- **Type consistency:** `AuditListResponse<T>`, `SystemAuditFilter`/`TmAuditFilter`, `AuditPageRequest`, `AuditColumnDef`, `AuditStream`, `AuditExportFormat` defined in T1/T5 and reused verbatim in T3–T10. Service methods `listSystem/getSystemEntry/listTm/getTmEntry/exportSystem` named consistently across T3 and T6–T10.
- **Contract drift handled:** response field is `entries` (not `items`); date params `created_after`/`created_before` (not `from`/`to`); `total`/`limit` present and ignored for display except optional count.
- **Open detail:** the single `AuditDetailPanelComponent` branches on `route.data.stream`; system/TM field sets differ but share the shell. If the branch grows unwieldy during T6, splitting into two presentational sub-templates is acceptable.
