# Admin Audit-Log UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-only UI with two views (system audit log, cross-TM threat-model audit log) featuring cursor pagination, a route-driven detail side panel with permalinks, filters, and CSV/NDJSON export.

**Architecture:** Self-contained feature at `src/app/pages/admin/audit/` per the approved spec (`docs/superpowers/specs/2026-06-11-admin-audit-log-ui-design.md`). Two thin view components compose three shared internals (filter bar, cursor-paged table, detail panel) over a new `AdminAuditService`. Detail panel renders in a nested router outlet so the table survives panel open/close. The existing per-TM audit page is NOT touched.

**Tech Stack:** Angular standalone components (OnPush), Angular Material, Transloco i18n, Vitest (native syntax, no TestBed — direct class instantiation with mocks), RxJS with `takeUntilDestroyed(destroyRef)`.

---

## ⚠️ Pre-flight: server contract check

**Implementation is blocked on the server shipping [tmi#398](https://github.com/ericfitz/tmi/issues/398).** Before Task 1:

1. Fetch the server OpenAPI spec (check `.local-projects.json` for the local `tmi` repo path and read `api-schema/tmi-openapi.json`; fallback URL `https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/dev/1.4.0/api-schema/tmi-openapi.json`).
2. Confirm `/admin/audit/system`, `/admin/audit/system/{entry_id}`, `/admin/audit/threat_models`, `/admin/audit/threat_models/{entry_id}` exist.
3. Diff the published request params and response shapes against the types in Task 1 below (which encode the *proposed* contract: `cursor`/`around`/`limit` params; `{ items, next_cursor, prev_cursor }` responses; `format=csv|ndjson` export). **If they differ, update the types and service params in Tasks 1–3 to match the published spec before proceeding** — the published spec wins. If the endpoints are absent, STOP and report that the work is still blocked.

All unit tests run against mocks, so Tasks 1–11 can technically proceed before the server ships, but the contract check must happen first to avoid building against a stale guess.

## Project conventions you must follow

- Run all commands from the project root. Use pnpm scripts only.
- 2 spaces, single quotes, max 100 chars, strict TS, explicit return types, JSDoc on public members.
- Standalone components, OnPush. Import groups: Angular core → Angular modules → third-party → project.
- Never `console.log` — inject `LoggerService`; errors via `catchError` + `this.logger.error(...)`.
- Buttons: only `mat-flat-button` (primary action), `mat-button` (dismissive/tertiary), `mat-icon-button` (icon-only with `matTooltip` AND `[attr.aria-label]`). No `mat-stroked-button`/`mat-raised-button`/fabs. No local styling of icon buttons.
- Tests: vitest native syntax, `import '@angular/compiler';` first, direct class instantiation with typed mock interfaces (see `src/app/pages/tm/components/audit-trail-page/audit-trail-page.component.spec.ts` for the canonical component-spec pattern and `src/app/pages/tm/services/audit-trail.service.spec.ts` for the service-spec pattern). Run a single file with `pnpm run test <relative-path>`.
- Every test file starts with the standard comment header (copy it from any existing spec).

## File structure (all new unless marked Modify)

```
src/app/pages/admin/audit/
├── admin-audit.routes.ts                          # lazy route tree
├── models/admin-audit.types.ts                    # contract types
├── services/admin-audit.service.ts (+ .spec.ts)   # API access
├── audit-logs-page.component.{ts,html,scss}       # shell: tabs + outlet
├── system-audit-view.component.{ts,html,scss} (+ .spec.ts)
├── tm-audit-view.component.{ts,html,scss} (+ .spec.ts)
└── components/
    ├── audit-filter-bar/audit-filter-bar.component.{ts,html,scss} (+ .spec.ts)
    ├── audit-table/audit-table.component.{ts,html,scss} (+ .spec.ts)
    └── audit-detail-panel/audit-detail-panel.component.{ts,html,scss} (+ .spec.ts)

Modify: src/app/core/services/api.service.ts            # add getBlob()
Modify: src/app/core/services/api.service.spec.ts       # getBlob tests
Create: src/app/shared/utils/file-download.util.ts      # saveBlob helper
Modify: src/app/app.routes.ts                            # admin/audit route
Modify: src/app/pages/admin/admin.component.ts           # adminSections entry
Modify: src/app/pages/admin/settings/admin-settings.component.html  # view-in-audit-log button
Modify: src/app/pages/admin/settings/admin-settings.component.ts    # navigation handler
Modify: src/assets/i18n/en-US.json                       # new keys
```

---

### Task 1: Contract types + AdminAuditService (list/get)

**Files:**
- Create: `src/app/pages/admin/audit/models/admin-audit.types.ts`
- Create: `src/app/pages/admin/audit/services/admin-audit.service.ts`
- Test: `src/app/pages/admin/audit/services/admin-audit.service.spec.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/app/pages/admin/audit/models/admin-audit.types.ts
/**
 * Types for the admin audit-log UI.
 * Contract per docs/superpowers/specs/2026-06-11-admin-audit-log-ui-design.md
 * ("Server contract" section). PROPOSED pending tmi#398 — re-verify against the
 * published OpenAPI spec before implementation (see plan pre-flight).
 */

/** Actor identity attached to every audit entry */
export interface AuditActor {
  email: string;
  provider: string;
  provider_id: string;
  display_name: string;
}

/** One row of the system audit log (admin/* writes) */
export interface SystemAuditEntry {
  id: string;
  created_at: string;
  actor: AuditActor;
  http_method: string;
  path: string;
  field_path: string | null;
  old_value: string | null;
  new_value: string | null;
  change_summary: string;
}

/** One row of the cross-TM threat-model audit log */
export interface TmAuditEntry {
  id: string;
  threat_model_id: string;
  threat_model_name: string | null;
  object_type: string;
  object_id: string;
  change_type: string;
  actor: AuditActor;
  change_summary: string;
  created_at: string;
  /** Version rolled back to, when change_type is rolled_back */
  rolled_back_to_version: number | null;
}

/** Cursor-paginated response envelope */
export interface CursorPage<T> {
  items: T[];
  /** Cursor for the next (older) page; null when at the end */
  next_cursor: string | null;
  /** Cursor for the previous (newer) page; null when at the start */
  prev_cursor: string | null;
}

/** Pagination request: at most one of cursor/around is set */
export interface CursorPageRequest {
  cursor?: string;
  /** Entry id to center the page on (permalink "view in context") */
  around?: string;
  limit?: number;
}

export interface SystemAuditFilter {
  actor_email?: string;
  actor_provider?: string;
  from?: string;
  to?: string;
  http_method?: string;
  path_prefix?: string;
  field_path?: string;
}

export interface TmAuditFilter {
  actor_email?: string;
  actor_provider?: string;
  from?: string;
  to?: string;
  change_type?: string;
  object_type?: string;
  threat_model_id?: string;
}

export type AuditExportFormat = 'csv' | 'ndjson';

/** Which audit stream a shared component is operating on */
export type AuditStream = 'system' | 'tm';
```

- [ ] **Step 2: Write the failing service spec**

```typescript
// src/app/pages/admin/audit/services/admin-audit.service.spec.ts
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { AdminAuditService } from './admin-audit.service';
import { ApiService } from '../../../../core/services/api.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { createMockLoggerService } from '../../../../../testing/mocks';
import { CursorPage, SystemAuditEntry, TmAuditEntry } from '../models/admin-audit.types';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let apiService: ApiService;
  let loggerService: LoggerService;

  const mockSystemEntry: SystemAuditEntry = {
    id: 'sys-1',
    created_at: '2026-06-01T10:00:00Z',
    actor: {
      email: 'admin@example.com',
      provider: 'google',
      provider_id: 'g-1',
      display_name: 'Admin',
    },
    http_method: 'PUT',
    path: '/admin/settings/auth.session_ttl',
    field_path: 'auth.session_ttl',
    old_value: '3600',
    new_value: '7200',
    change_summary: 'auth.session_ttl 3600 -> 7200',
  };

  const mockTmEntry: TmAuditEntry = {
    id: 'tma-1',
    threat_model_id: 'tm-1',
    threat_model_name: 'Payments TM',
    object_type: 'threat',
    object_id: 'threat-1',
    change_type: 'updated',
    actor: {
      email: 'user@example.com',
      provider: 'google',
      provider_id: 'g-2',
      display_name: 'User',
    },
    change_summary: 'Updated threat name',
    created_at: '2026-06-01T11:00:00Z',
    rolled_back_to_version: null,
  };

  const mockSystemPage: CursorPage<SystemAuditEntry> = {
    items: [mockSystemEntry],
    next_cursor: 'cur-next',
    prev_cursor: null,
  };

  const mockTmPage: CursorPage<TmAuditEntry> = {
    items: [mockTmEntry],
    next_cursor: null,
    prev_cursor: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    loggerService = createMockLoggerService();
    apiService = {
      get: vi.fn().mockReturnValue(of(mockSystemPage)),
      getBlob: vi.fn().mockReturnValue(of(new Blob(['x']))),
    } as unknown as ApiService;
    service = new AdminAuditService(apiService, loggerService);
  });

  describe('listSystem', () => {
    it('passes filters and cursor as query params', () => {
      service
        .listSystem({ actor_email: 'admin@example.com', http_method: 'PUT' }, { cursor: 'c1', limit: 20 })
        .subscribe(page => expect(page).toEqual(mockSystemPage));

      expect(apiService.get).toHaveBeenCalledWith('admin/audit/system', {
        actor_email: 'admin@example.com',
        http_method: 'PUT',
        cursor: 'c1',
        limit: 20,
      });
    });

    it('passes around anchor without cursor', () => {
      service.listSystem({}, { around: 'sys-1', limit: 20 }).subscribe();
      expect(apiService.get).toHaveBeenCalledWith('admin/audit/system', {
        around: 'sys-1',
        limit: 20,
      });
    });

    it('omits undefined filters', () => {
      service.listSystem({}, { limit: 20 }).subscribe();
      expect(apiService.get).toHaveBeenCalledWith('admin/audit/system', { limit: 20 });
    });

    it('logs and rethrows on error', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('boom')),
      );
      let caught: unknown;
      service.listSystem({}, {}).subscribe({ error: e => (caught = e) });
      expect(caught).toBeInstanceOf(Error);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('getSystemEntry', () => {
    it('fetches a single entry by id', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(of(mockSystemEntry));
      service.getSystemEntry('sys-1').subscribe(e => expect(e).toEqual(mockSystemEntry));
      expect(apiService.get).toHaveBeenCalledWith('admin/audit/system/sys-1');
    });
  });

  describe('listTm', () => {
    it('passes TM filters as query params', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(of(mockTmPage));
      service
        .listTm({ threat_model_id: 'tm-1', change_type: 'updated' }, { limit: 50 })
        .subscribe(page => expect(page).toEqual(mockTmPage));
      expect(apiService.get).toHaveBeenCalledWith('admin/audit/threat_models', {
        threat_model_id: 'tm-1',
        change_type: 'updated',
        limit: 50,
      });
    });
  });

  describe('getTmEntry', () => {
    it('fetches a single entry by id', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(of(mockTmEntry));
      service.getTmEntry('tma-1').subscribe(e => expect(e).toEqual(mockTmEntry));
      expect(apiService.get).toHaveBeenCalledWith('admin/audit/threat_models/tma-1');
    });
  });
});
```

- [ ] **Step 3: Run the spec to verify it fails**

Run: `pnpm run test src/app/pages/admin/audit/services/admin-audit.service.spec.ts`
Expected: FAIL — cannot resolve `./admin-audit.service`.

- [ ] **Step 4: Implement the service**

```typescript
// src/app/pages/admin/audit/services/admin-audit.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../../../core/services/api.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  CursorPage,
  CursorPageRequest,
  SystemAuditEntry,
  SystemAuditFilter,
  TmAuditEntry,
  TmAuditFilter,
} from '../models/admin-audit.types';

/**
 * API access for the admin audit-log views (system + cross-TM streams).
 * Endpoints per tmi#398; contract re-verified at implementation time (see plan pre-flight).
 */
@Injectable({
  providedIn: 'root',
})
export class AdminAuditService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /** List system audit entries (cursor- or around-anchored) */
  public listSystem(
    filter: SystemAuditFilter,
    page: CursorPageRequest,
  ): Observable<CursorPage<SystemAuditEntry>> {
    const params = buildHttpParams({ ...filter, ...page });
    return this.apiService.get<CursorPage<SystemAuditEntry>>('admin/audit/system', params).pipe(
      catchError(error => {
        this.logger.error('Failed to list system audit entries', error);
        throw error;
      }),
    );
  }

  /** Fetch a single system audit entry by id (permalink target) */
  public getSystemEntry(entryId: string): Observable<SystemAuditEntry> {
    return this.apiService.get<SystemAuditEntry>(`admin/audit/system/${entryId}`).pipe(
      catchError(error => {
        this.logger.error('Failed to load system audit entry', error);
        throw error;
      }),
    );
  }

  /** List threat-model audit entries across all TMs */
  public listTm(
    filter: TmAuditFilter,
    page: CursorPageRequest,
  ): Observable<CursorPage<TmAuditEntry>> {
    const params = buildHttpParams({ ...filter, ...page });
    return this.apiService.get<CursorPage<TmAuditEntry>>('admin/audit/threat_models', params).pipe(
      catchError(error => {
        this.logger.error('Failed to list threat-model audit entries', error);
        throw error;
      }),
    );
  }

  /** Fetch a single threat-model audit entry by id (permalink target) */
  public getTmEntry(entryId: string): Observable<TmAuditEntry> {
    return this.apiService.get<TmAuditEntry>(`admin/audit/threat_models/${entryId}`).pipe(
      catchError(error => {
        this.logger.error('Failed to load threat-model audit entry', error);
        throw error;
      }),
    );
  }
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `pnpm run test src/app/pages/admin/audit/services/admin-audit.service.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/audit/
git commit -m "feat(admin): add audit contract types and AdminAuditService (#679)"
```

---

### Task 2: ApiService.getBlob

**Files:**
- Modify: `src/app/core/services/api.service.ts` (add method after `getText`, ~line 114)
- Test: `src/app/core/services/api.service.spec.ts` (append a describe block)

- [ ] **Step 1: Write the failing test**

Append to the existing spec (inside the top-level `describe`, following the file's existing mock pattern — it builds the service from `createTypedMockHttpClient()` etc.):

```typescript
  describe('getBlob', () => {
    it('requests blob response type and returns the blob', () => {
      const blob = new Blob(['a,b\n1,2'], { type: 'text/csv' });
      mockHttpClient.get.mockReturnValue(of(blob));

      let result: Blob | undefined;
      service.getBlob('admin/audit/system', { format: 'csv' }).subscribe(b => (result = b));

      expect(mockHttpClient.get).toHaveBeenCalledWith('http://localhost:8080/admin/audit/system', {
        params: { format: 'csv' },
        responseType: 'blob',
      });
      expect(result).toBe(blob);
    });
  });
```

Note: match the spec file's actual local variable names (`mockHttpClient`, `service`) — read the top of the file first and reuse its setup exactly.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run test src/app/core/services/api.service.spec.ts`
Expected: FAIL — `service.getBlob is not a function`.

- [ ] **Step 3: Implement getBlob in ApiService**

Insert after the `getText` method (same retry/error pattern):

```typescript
  /**
   * GET request that returns a binary blob (for file downloads, e.g. audit exports)
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

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm run test src/app/core/services/api.service.spec.ts`
Expected: PASS (all tests, including pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/api.service.ts src/app/core/services/api.service.spec.ts
git commit -m "feat(core): add ApiService.getBlob for authenticated file downloads (#679)"
```

---

### Task 3: File-download util + export method

**Files:**
- Create: `src/app/shared/utils/file-download.util.ts`
- Modify: `src/app/pages/admin/audit/services/admin-audit.service.ts`
- Test: `src/app/pages/admin/audit/services/admin-audit.service.spec.ts`

- [ ] **Step 1: Create the download util**

```typescript
// src/app/shared/utils/file-download.util.ts
/**
 * Trigger a browser download of an in-memory Blob via a temporary anchor.
 * Used for authenticated exports where a plain <a href> cannot carry the
 * Authorization header (the blob is fetched through HttpClient first).
 */
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Write the failing export test**

Append inside `describe('AdminAuditService', ...)`:

```typescript
  describe('exportSystem', () => {
    it('requests a blob with filters plus format param', () => {
      const blob = new Blob(['{}'], { type: 'application/x-ndjson' });
      (apiService.getBlob as ReturnType<typeof vi.fn>).mockReturnValue(of(blob));

      let result: Blob | undefined;
      service
        .exportSystem({ actor_email: 'admin@example.com' }, 'ndjson')
        .subscribe(b => (result = b));

      expect(apiService.getBlob).toHaveBeenCalledWith('admin/audit/system', {
        actor_email: 'admin@example.com',
        format: 'ndjson',
      });
      expect(result).toBe(blob);
    });
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm run test src/app/pages/admin/audit/services/admin-audit.service.spec.ts`
Expected: FAIL — `service.exportSystem is not a function`.

- [ ] **Step 4: Add exportSystem to AdminAuditService**

```typescript
  /** Download the full filtered system audit set as CSV or NDJSON */
  public exportSystem(filter: SystemAuditFilter, format: AuditExportFormat): Observable<Blob> {
    const params = buildHttpParams({ ...filter, format });
    return this.apiService.getBlob('admin/audit/system', params).pipe(
      catchError(error => {
        this.logger.error('Failed to export system audit entries', error);
        throw error;
      }),
    );
  }
```

Add `AuditExportFormat` to the existing import from `../models/admin-audit.types`.

- [ ] **Step 5: Run to verify it passes, then commit**

Run: `pnpm run test src/app/pages/admin/audit/services/admin-audit.service.spec.ts` — Expected: PASS.

```bash
git add src/app/shared/utils/file-download.util.ts src/app/pages/admin/audit/
git commit -m "feat(admin): add system audit export (blob download) (#679)"
```

---

### Task 4: Routes, admin section card, and master i18n keys

**Files:**
- Create: `src/app/pages/admin/audit/admin-audit.routes.ts`
- Modify: `src/app/app.routes.ts` (admin children array, after the `surveys/:surveyId` entry ~line 203)
- Modify: `src/app/pages/admin/admin.component.ts` (adminSections array)
- Modify: `src/assets/i18n/en-US.json`

Note: this task references components created in Tasks 5–8; the build will not compile until Task 8 is done. That is expected — Tasks 4–8 commit together at the end of Task 8. (Tests for Tasks 5–8 don't need the build.) If you prefer compiling commits, create placeholder components first — do NOT; just follow the task order and commit at Task 8.

- [ ] **Step 1: Create the route tree**

```typescript
// src/app/pages/admin/audit/admin-audit.routes.ts
import { Routes } from '@angular/router';

/**
 * Admin audit-log routes. Parent path 'admin/audit' (adminGuard applied in app.routes.ts).
 * The :entryId child renders the detail panel in a nested outlet so the
 * list view component (and its cursor state) survives panel open/close.
 */
export const ADMIN_AUDIT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./audit-logs-page.component').then(c => c.AuditLogsPageComponent),
    children: [
      { path: '', redirectTo: 'system', pathMatch: 'full' },
      {
        path: 'system',
        loadComponent: () =>
          import('./system-audit-view.component').then(c => c.SystemAuditViewComponent),
        children: [
          {
            path: ':entryId',
            loadComponent: () =>
              import('./components/audit-detail-panel/audit-detail-panel.component').then(
                c => c.AuditDetailPanelComponent,
              ),
            data: { stream: 'system' },
          },
        ],
      },
      {
        path: 'threat-models',
        loadComponent: () =>
          import('./tm-audit-view.component').then(c => c.TmAuditViewComponent),
        children: [
          {
            path: ':entryId',
            loadComponent: () =>
              import('./components/audit-detail-panel/audit-detail-panel.component').then(
                c => c.AuditDetailPanelComponent,
              ),
            data: { stream: 'tm' },
          },
        ],
      },
    ],
  },
];
```

- [ ] **Step 2: Register in app.routes.ts**

Add to the `admin` route's `children` array (after the `surveys/:surveyId` entry):

```typescript
      {
        path: 'audit',
        loadChildren: () =>
          import(/* webpackChunkName: "admin-audit" */ './pages/admin/audit/admin-audit.routes').then(
            m => m.ADMIN_AUDIT_ROUTES,
          ),
        canActivate: [adminGuard],
      },
```

- [ ] **Step 3: Add the admin section card**

In `src/app/pages/admin/admin.component.ts`, append to `adminSections` (after the surveys entry):

```typescript
    {
      title: 'admin.sections.audit.title',
      description: 'admin.sections.audit.description',
      icon: 'history',
      action: 'audit',
    },
```

- [ ] **Step 4: Add all new keys to the master locale**

In `src/assets/i18n/en-US.json`: under `admin.sections`, add:

```json
"audit": {
  "title": "Audit Logs",
  "description": "View system and threat model audit logs"
}
```

Add a new top-level `adminAudit` object (alphabetical placement after `admin`):

```json
"adminAudit": {
  "title": "Audit Logs",
  "tabs": {
    "system": "System",
    "threatModels": "Threat Models"
  },
  "filters": {
    "actor": "Actor",
    "from": "From",
    "to": "To",
    "httpMethod": "HTTP method",
    "pathPrefix": "Path prefix",
    "fieldPath": "Field path",
    "threatModelId": "Threat model ID",
    "changeType": "Change type",
    "objectType": "Object type",
    "apply": "Apply filters",
    "clear": "Clear filters"
  },
  "columns": {
    "timestamp": "Timestamp",
    "actor": "Actor",
    "request": "Request",
    "fieldPath": "Field path",
    "summary": "Summary",
    "threatModel": "Threat model",
    "objectType": "Object type",
    "changeType": "Change type"
  },
  "pager": {
    "newer": "Newer",
    "older": "Older"
  },
  "export": {
    "button": "Export",
    "csv": "Export as CSV",
    "ndjson": "Export as NDJSON",
    "failed": "Export failed. Narrow the date range and try again."
  },
  "detail": {
    "title": "Audit entry",
    "timestamp": "Timestamp",
    "actor": "Actor",
    "request": "Request",
    "fieldPath": "Field path",
    "oldValue": "Old value",
    "newValue": "New value",
    "summary": "Summary",
    "threatModel": "Threat model",
    "objectType": "Object type",
    "objectId": "Object ID",
    "changeType": "Change type",
    "rolledBackTo": "Rolled back to version",
    "copyPermalink": "Copy permalink",
    "permalinkCopied": "Permalink copied to clipboard",
    "viewInContext": "View in context",
    "close": "Close",
    "loadFailed": "Could not load this audit entry. It may have been pruned or the ID is invalid."
  },
  "empty": {
    "noMatches": "No audit entries match these filters."
  },
  "error": {
    "queryFailed": "The audit query failed.",
    "retry": "Retry"
  }
}
```

Under the existing `admin.settings` object, add:

```json
"viewInAuditLog": "View in audit log"
```

- [ ] **Step 5: Commit deferred** — Tasks 4–8 commit together at the end of Task 8 (the route file references components that don't exist yet).

---

### Task 5: Shell component (tabs + outlet)

**Files:**
- Create: `src/app/pages/admin/audit/audit-logs-page.component.ts`
- Create: `src/app/pages/admin/audit/audit-logs-page.component.html`
- Create: `src/app/pages/admin/audit/audit-logs-page.component.scss`

No spec — the component is pure template (nav links + outlet), nothing to unit test.

- [ ] **Step 1: Component class**

```typescript
// src/app/pages/admin/audit/audit-logs-page.component.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoModule } from '@jsverse/transloco';

import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';

/**
 * Shell for the admin audit-log section: tab navigation between the
 * system and threat-model audit views, each rendered in the outlet.
 */
@Component({
  selector: 'app-audit-logs-page',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoModule,
  ],
  templateUrl: './audit-logs-page.component.html',
  styleUrl: './audit-logs-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogsPageComponent {}
```

- [ ] **Step 2: Template**

```html
<!-- src/app/pages/admin/audit/audit-logs-page.component.html -->
<div class="audit-logs-container">
  <h1 class="page-title">{{ 'adminAudit.title' | transloco }}</h1>

  <nav mat-tab-nav-bar [tabPanel]="tabPanel">
    <a
      mat-tab-link
      routerLink="system"
      routerLinkActive
      #systemActive="routerLinkActive"
      [active]="systemActive.isActive"
    >
      {{ 'adminAudit.tabs.system' | transloco }}
    </a>
    <a
      mat-tab-link
      routerLink="threat-models"
      routerLinkActive
      #tmActive="routerLinkActive"
      [active]="tmActive.isActive"
    >
      {{ 'adminAudit.tabs.threatModels' | transloco }}
    </a>
  </nav>
  <mat-tab-nav-panel #tabPanel>
    <router-outlet></router-outlet>
  </mat-tab-nav-panel>
</div>
```

- [ ] **Step 3: Styles**

```scss
// src/app/pages/admin/audit/audit-logs-page.component.scss
.audit-logs-container {
  padding: 16px 24px;

  .page-title {
    margin-bottom: 8px;
  }
}
```

- [ ] **Step 4: Commit deferred** to end of Task 8.

---

### Task 6: Filter bar component

**Files:**
- Create: `src/app/pages/admin/audit/components/audit-filter-bar/audit-filter-bar.component.ts`
- Create: `.../audit-filter-bar.component.html`
- Create: `.../audit-filter-bar.component.scss`
- Test: `.../audit-filter-bar.component.spec.ts`

Config-driven: each view passes the select/text fields it needs. Actor autocomplete (against `UserAdminService.list({ email })`) and date range are built in; export menu shows when `showExport` is true.

- [ ] **Step 1: Write the failing spec**

```typescript
// src/app/pages/admin/audit/components/audit-filter-bar/audit-filter-bar.component.spec.ts
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

import { AuditFilterBarComponent } from './audit-filter-bar.component';
import { UserAdminService } from '../../../../../core/services/user-admin.service';

interface MockUserAdminService {
  list: ReturnType<typeof vi.fn>;
}

describe('AuditFilterBarComponent', () => {
  let component: AuditFilterBarComponent;
  let userAdminService: MockUserAdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    userAdminService = {
      list: vi.fn().mockReturnValue(of({ users: [], total: 0, limit: 10, offset: 0 })),
    };
    const destroyRef = { onDestroy: vi.fn() };
    component = new AuditFilterBarComponent(
      userAdminService as unknown as UserAdminService,
      destroyRef as never,
    );
  });

  it('emits only non-empty filter values on apply', () => {
    const emitted: Record<string, string>[] = [];
    component.filtersChange.subscribe(f => emitted.push(f));

    component.actorControl.setValue('admin@example.com');
    component.textValues['path_prefix'] = '/admin/settings';
    component.selectValues['http_method'] = '';
    component.apply();

    expect(emitted).toEqual([
      { actor_email: 'admin@example.com', path_prefix: '/admin/settings' },
    ]);
  });

  it('includes ISO date range bounds when set', () => {
    const emitted: Record<string, string>[] = [];
    component.filtersChange.subscribe(f => emitted.push(f));

    component.fromDate = new Date(Date.UTC(2026, 5, 1));
    component.toDate = new Date(Date.UTC(2026, 5, 10));
    component.apply();

    expect(emitted[0]['from']).toBe('2026-06-01T00:00:00.000Z');
    expect(emitted[0]['to']).toBe('2026-06-10T00:00:00.000Z');
  });

  it('clear() resets all fields and emits empty filters', () => {
    const emitted: Record<string, string>[] = [];
    component.filtersChange.subscribe(f => emitted.push(f));

    component.actorControl.setValue('x@y.z');
    component.textValues['field_path'] = 'a.b';
    component.selectValues['http_method'] = 'PUT';
    component.fromDate = new Date();
    component.clear();

    expect(component.actorControl.value).toBe('');
    expect(component.textValues['field_path']).toBe('');
    expect(component.selectValues['http_method']).toBe('');
    expect(component.fromDate).toBeNull();
    expect(emitted).toEqual([{}]);
  });

  it('setFilters seeds field state from external values (URL restore)', () => {
    component.textFields = [{ key: 'field_path', labelKey: 'adminAudit.filters.fieldPath' }];
    component.setFilters({ actor_email: 'a@b.c', field_path: 'auth.ttl' });
    expect(component.actorControl.value).toBe('a@b.c');
    expect(component.textValues['field_path']).toBe('auth.ttl');
  });

  it('emits export format on export menu selection', () => {
    const formats: string[] = [];
    component.exportRequested.subscribe(f => formats.push(f));
    component.onExport('ndjson');
    expect(formats).toEqual(['ndjson']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run test src/app/pages/admin/audit/components/audit-filter-bar/audit-filter-bar.component.spec.ts`
Expected: FAIL — cannot resolve `./audit-filter-bar.component`.

- [ ] **Step 3: Implement the component class**

```typescript
// src/app/pages/admin/audit/components/audit-filter-bar/audit-filter-bar.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoModule } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '../../../../../core/services/user-admin.service';
import { AuditExportFormat } from '../../models/admin-audit.types';

/** Config for a select-type filter field */
export interface AuditFilterSelect {
  key: string;
  labelKey: string;
  /** Option values; rendered via optionLabelPrefix + value when prefix set, else raw value */
  options: string[];
  /** Transloco key prefix for option labels (e.g. 'auditTrail.changeTypes.'); raw value if omitted */
  optionLabelPrefix?: string;
}

/** Config for a free-text filter field */
export interface AuditFilterText {
  key: string;
  labelKey: string;
}

/**
 * Config-driven filter bar shared by the system and TM audit views.
 * Actor autocomplete and date-range are built in; selects/texts are per-view config.
 * Emits a flat Record of non-empty filter values on apply/clear.
 */
@Component({
  selector: 'app-audit-filter-bar',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    TranslocoModule,
  ],
  templateUrl: './audit-filter-bar.component.html',
  styleUrl: './audit-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditFilterBarComponent implements OnInit {
  @Input() selectFields: AuditFilterSelect[] = [];
  @Input() textFields: AuditFilterText[] = [];
  @Input() showExport = false;

  /** Emits the complete current filter set (only non-empty values) */
  @Output() filtersChange = new EventEmitter<Record<string, string>>();
  /** Emits when the user picks an export format */
  @Output() exportRequested = new EventEmitter<AuditExportFormat>();

  readonly actorControl = new FormControl<string>('', { nonNullable: true });
  actorOptions: string[] = [];
  selectValues: Record<string, string> = {};
  textValues: Record<string, string> = {};
  fromDate: Date | null = null;
  toDate: Date | null = null;

  constructor(
    private userAdminService: UserAdminService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    for (const f of this.selectFields) {
      this.selectValues[f.key] = this.selectValues[f.key] ?? '';
    }
    for (const f of this.textFields) {
      this.textValues[f.key] = this.textValues[f.key] ?? '';
    }

    this.actorControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(term => term.length >= 2),
        switchMap(term => this.userAdminService.list({ email: term, limit: 10 })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.actorOptions = response.users.map(u => u.email);
      });
  }

  /** Seed control state from externally-provided filters (URL restore) */
  setFilters(filters: Record<string, string>): void {
    this.actorControl.setValue(filters['actor_email'] ?? '', { emitEvent: false });
    this.fromDate = filters['from'] ? new Date(filters['from']) : null;
    this.toDate = filters['to'] ? new Date(filters['to']) : null;
    for (const f of this.selectFields) {
      this.selectValues[f.key] = filters[f.key] ?? '';
    }
    for (const f of this.textFields) {
      this.textValues[f.key] = filters[f.key] ?? '';
    }
  }

  apply(): void {
    this.filtersChange.emit(this.buildFilters());
  }

  clear(): void {
    this.actorControl.setValue('', { emitEvent: false });
    this.fromDate = null;
    this.toDate = null;
    for (const key of Object.keys(this.selectValues)) {
      this.selectValues[key] = '';
    }
    for (const key of Object.keys(this.textValues)) {
      this.textValues[key] = '';
    }
    this.filtersChange.emit({});
  }

  onExport(format: AuditExportFormat): void {
    this.exportRequested.emit(format);
  }

  private buildFilters(): Record<string, string> {
    const filters: Record<string, string> = {};
    const actor = this.actorControl.value.trim();
    if (actor) {
      filters['actor_email'] = actor;
    }
    if (this.fromDate) {
      filters['from'] = this.fromDate.toISOString();
    }
    if (this.toDate) {
      filters['to'] = this.toDate.toISOString();
    }
    for (const [key, value] of Object.entries(this.selectValues)) {
      if (value) {
        filters[key] = value;
      }
    }
    for (const [key, value] of Object.entries(this.textValues)) {
      if (value.trim()) {
        filters[key] = value.trim();
      }
    }
    return filters;
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm run test src/app/pages/admin/audit/components/audit-filter-bar/audit-filter-bar.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Template + styles**

```html
<!-- src/app/pages/admin/audit/components/audit-filter-bar/audit-filter-bar.component.html -->
<div class="filter-bar">
  <mat-form-field appearance="outline" class="filter-field actor-field">
    <mat-label>{{ 'adminAudit.filters.actor' | transloco }}</mat-label>
    <input matInput [formControl]="actorControl" [matAutocomplete]="actorAuto" />
    <mat-autocomplete #actorAuto="matAutocomplete">
      @for (option of actorOptions; track option) {
        <mat-option [value]="option">{{ option }}</mat-option>
      }
    </mat-autocomplete>
  </mat-form-field>

  <mat-form-field appearance="outline" class="filter-field date-field">
    <mat-label>{{ 'adminAudit.filters.from' | transloco }}</mat-label>
    <input matInput [matDatepicker]="fromPicker" [(ngModel)]="fromDate" />
    <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
    <mat-datepicker #fromPicker></mat-datepicker>
  </mat-form-field>

  <mat-form-field appearance="outline" class="filter-field date-field">
    <mat-label>{{ 'adminAudit.filters.to' | transloco }}</mat-label>
    <input matInput [matDatepicker]="toPicker" [(ngModel)]="toDate" />
    <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
    <mat-datepicker #toPicker></mat-datepicker>
  </mat-form-field>

  @for (field of selectFields; track field.key) {
    <mat-form-field appearance="outline" class="filter-field">
      <mat-label>{{ field.labelKey | transloco }}</mat-label>
      <mat-select [(value)]="selectValues[field.key]">
        <mat-option value="">{{ 'common.all' | transloco }}</mat-option>
        @for (opt of field.options; track opt) {
          <mat-option [value]="opt">
            @if (field.optionLabelPrefix) {
              {{ field.optionLabelPrefix + opt | transloco }}
            } @else {
              {{ opt }}
            }
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  }

  @for (field of textFields; track field.key) {
    <mat-form-field appearance="outline" class="filter-field">
      <mat-label>{{ field.labelKey | transloco }}</mat-label>
      <input matInput [(ngModel)]="textValues[field.key]" (keyup.enter)="apply()" />
    </mat-form-field>
  }

  <button
    mat-icon-button
    color="primary"
    (click)="apply()"
    [matTooltip]="'adminAudit.filters.apply' | transloco"
    [attr.aria-label]="'adminAudit.filters.apply' | transloco"
  >
    <mat-icon>filter_alt</mat-icon>
  </button>

  <button
    mat-icon-button
    (click)="clear()"
    [matTooltip]="'adminAudit.filters.clear' | transloco"
    [attr.aria-label]="'adminAudit.filters.clear' | transloco"
  >
    <mat-icon>filter_list_off</mat-icon>
  </button>

  @if (showExport) {
    <span class="spacer"></span>
    <button
      mat-icon-button
      [matMenuTriggerFor]="exportMenu"
      [matTooltip]="'adminAudit.export.button' | transloco"
      [attr.aria-label]="'adminAudit.export.button' | transloco"
    >
      <mat-icon>download</mat-icon>
    </button>
    <mat-menu #exportMenu="matMenu">
      <button mat-menu-item (click)="onExport('csv')">
        {{ 'adminAudit.export.csv' | transloco }}
      </button>
      <button mat-menu-item (click)="onExport('ndjson')">
        {{ 'adminAudit.export.ndjson' | transloco }}
      </button>
    </mat-menu>
  }
</div>
```

```scss
// src/app/pages/admin/audit/components/audit-filter-bar/audit-filter-bar.component.scss
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;

  .filter-field {
    width: 180px;
  }

  .date-field {
    width: 150px;
  }

  .spacer {
    flex: 1;
  }
}
```

Note: `COMMON_IMPORTS` includes `FormsModule`/`CommonModule` (check `src/app/shared/imports.ts`; if `FormsModule` is not in it, add `FormsModule` to the component's imports array — `[(ngModel)]` requires it).

- [ ] **Step 6: Commit deferred** to end of Task 8.

---

### Task 7: Cursor-paged table component

**Files:**
- Create: `src/app/pages/admin/audit/components/audit-table/audit-table.component.ts`
- Create: `.../audit-table.component.html`
- Create: `.../audit-table.component.scss`
- Test: `.../audit-table.component.spec.ts`

Generic over row type: columns are passed as configs with value-accessor functions; the table renders chrome (loading / error / empty / pager) and emits row clicks and paging intents.

- [ ] **Step 1: Write the failing spec**

```typescript
// src/app/pages/admin/audit/components/audit-table/audit-table.component.spec.ts
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { AuditTableComponent } from './audit-table.component';

interface Row {
  id: string;
  name: string;
}

describe('AuditTableComponent', () => {
  let component: AuditTableComponent<Row>;

  beforeEach(() => {
    component = new AuditTableComponent<Row>();
    component.columns = [
      { key: 'name', headerKey: 'adminAudit.columns.summary', value: r => r.name },
    ];
  });

  it('computes displayed column keys from configs', () => {
    expect(component.displayedColumns).toEqual(['name']);
  });

  it('emits pageOlder only when next cursor exists', () => {
    let count = 0;
    component.pageOlder.subscribe(() => count++);
    component.nextCursor = null;
    component.onOlder();
    expect(count).toBe(0);
    component.nextCursor = 'c1';
    component.onOlder();
    expect(count).toBe(1);
  });

  it('emits pageNewer only when prev cursor exists', () => {
    let count = 0;
    component.pageNewer.subscribe(() => count++);
    component.prevCursor = null;
    component.onNewer();
    expect(count).toBe(0);
    component.prevCursor = 'c0';
    component.onNewer();
    expect(count).toBe(1);
  });

  it('emits clicked row', () => {
    const clicked: Row[] = [];
    component.rowClicked.subscribe(r => clicked.push(r));
    const row: Row = { id: '1', name: 'x' };
    component.onRowClick(row);
    expect(clicked).toEqual([row]);
  });

  it('identifies the anchor row', () => {
    component.rowId = r => r.id;
    component.anchorId = '2';
    expect(component.isAnchor({ id: '2', name: 'y' })).toBe(true);
    expect(component.isAnchor({ id: '3', name: 'z' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run test src/app/pages/admin/audit/components/audit-table/audit-table.component.spec.ts`
Expected: FAIL — cannot resolve `./audit-table.component`.

- [ ] **Step 3: Implement**

```typescript
// src/app/pages/admin/audit/components/audit-table/audit-table.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** Column config: header translation key + cell value accessor */
export interface AuditTableColumn<T> {
  key: string;
  headerKey: string;
  value: (row: T) => string;
  /** Optional tooltip accessor (e.g. absolute timestamp) */
  tooltip?: (row: T) => string;
}

/**
 * Generic cursor-paged table for the audit views. Renders loading / error /
 * empty / data states and a Newer/Older pager driven by cursors. Rows are
 * clickable; the view decides what a click means (opens the detail panel).
 */
@Component({
  selector: 'app-audit-table',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    MatProgressSpinnerModule,
    TranslocoModule,
  ],
  templateUrl: './audit-table.component.html',
  styleUrl: './audit-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTableComponent<T> {
  @Input() columns: AuditTableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() loading = false;
  @Input() error = false;
  @Input() nextCursor: string | null = null;
  @Input() prevCursor: string | null = null;
  /** Row id accessor, used for anchor/selection highlighting */
  @Input() rowId: (row: T) => string = () => '';
  /** Entry id to highlight (around-anchored permalink mode) */
  @Input() anchorId: string | null = null;
  /** Entry id currently open in the detail panel */
  @Input() selectedId: string | null = null;

  @Output() rowClicked = new EventEmitter<T>();
  @Output() pageOlder = new EventEmitter<void>();
  @Output() pageNewer = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();

  get displayedColumns(): string[] {
    return this.columns.map(c => c.key);
  }

  onRowClick(row: T): void {
    this.rowClicked.emit(row);
  }

  onOlder(): void {
    if (this.nextCursor) {
      this.pageOlder.emit();
    }
  }

  onNewer(): void {
    if (this.prevCursor) {
      this.pageNewer.emit();
    }
  }

  isAnchor(row: T): boolean {
    return this.anchorId !== null && this.rowId(row) === this.anchorId;
  }

  isSelected(row: T): boolean {
    return this.selectedId !== null && this.rowId(row) === this.selectedId;
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm run test src/app/pages/admin/audit/components/audit-table/audit-table.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Template + styles**

```html
<!-- src/app/pages/admin/audit/components/audit-table/audit-table.component.html -->
@if (loading) {
  <div class="loading-container">
    <mat-spinner diameter="40"></mat-spinner>
  </div>
} @else if (error) {
  <div class="error-state">
    <mat-icon>error_outline</mat-icon>
    <p>{{ 'adminAudit.error.queryFailed' | transloco }}</p>
    <button mat-button (click)="retry.emit()">
      {{ 'adminAudit.error.retry' | transloco }}
    </button>
  </div>
} @else if (rows.length === 0) {
  <div class="empty-state">
    <mat-icon fontSet="material-symbols-outlined">contract</mat-icon>
    <p>{{ 'adminAudit.empty.noMatches' | transloco }}</p>
    <button mat-button (click)="clearFilters.emit()">
      {{ 'adminAudit.filters.clear' | transloco }}
    </button>
  </div>
} @else {
  <table mat-table [dataSource]="rows" class="audit-table">
    @for (col of columns; track col.key) {
      <ng-container [matColumnDef]="col.key">
        <th mat-header-cell *matHeaderCellDef>{{ col.headerKey | transloco }}</th>
        <td
          mat-cell
          *matCellDef="let row"
          [matTooltip]="col.tooltip ? col.tooltip(row) : ''"
          matTooltipPosition="above"
        >
          {{ col.value(row) }}
        </td>
      </ng-container>
    }

    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    <tr
      mat-row
      *matRowDef="let row; columns: displayedColumns"
      class="clickable-row"
      [class.anchor-row]="isAnchor(row)"
      [class.selected-row]="isSelected(row)"
      (click)="onRowClick(row)"
    ></tr>
  </table>

  <div class="pager-row">
    <button mat-button [disabled]="!prevCursor" (click)="onNewer()">
      <mat-icon>chevron_left</mat-icon>
      {{ 'adminAudit.pager.newer' | transloco }}
    </button>
    <button mat-button [disabled]="!nextCursor" (click)="onOlder()">
      {{ 'adminAudit.pager.older' | transloco }}
      <mat-icon iconPositionEnd>chevron_right</mat-icon>
    </button>
  </div>
}
```

```scss
// src/app/pages/admin/audit/components/audit-table/audit-table.component.scss
.loading-container,
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px;
}

.audit-table {
  width: 100%;
}

.clickable-row {
  cursor: pointer;

  &:hover {
    background: var(--theme-hover-overlay, rgb(0 0 0 / 4%));
  }
}

.anchor-row {
  background: var(--theme-selected-overlay, rgb(0 0 0 / 8%));
}

.selected-row {
  outline: 2px solid var(--theme-primary, currentcolor);
  outline-offset: -2px;
}

.pager-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 0;
}
```

Note: check `src/styles/` for the actual theme CSS variable names (`--theme-*` / `--color-*`) and use existing ones; the names above are indicative. Never hard-code hex.

- [ ] **Step 6: Commit deferred** to end of Task 8.

---

### Task 8: Detail side panel component

**Files:**
- Create: `src/app/pages/admin/audit/components/audit-detail-panel/audit-detail-panel.component.ts`
- Create: `.../audit-detail-panel.component.html`
- Create: `.../audit-detail-panel.component.scss`
- Test: `.../audit-detail-panel.component.spec.ts`

Route-driven: reads `:entryId` from its own route, `stream` from route data, fetches via `AdminAuditService`. Close navigates to the parent route preserving query params. "View in context" merges `around={id}` into query params (parent view reacts and re-anchors the table; panel stays open).

- [ ] **Step 1: Write the failing spec**

```typescript
// src/app/pages/admin/audit/components/audit-detail-panel/audit-detail-panel.component.spec.ts
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { convertToParamMap, ParamMap } from '@angular/router';

import { AuditDetailPanelComponent } from './audit-detail-panel.component';
import { AdminAuditService } from '../../services/admin-audit.service';
import { SystemAuditEntry } from '../../models/admin-audit.types';
import {
  createTypedMockLoggerService,
  type MockLoggerService,
} from '../../../../../../testing/mocks';

interface MockRouter {
  navigate: ReturnType<typeof vi.fn>;
}

interface MockActivatedRoute {
  paramMap: BehaviorSubject<ParamMap>;
  snapshot: { data: Record<string, unknown> };
}

interface MockAdminAuditService {
  getSystemEntry: ReturnType<typeof vi.fn>;
  getTmEntry: ReturnType<typeof vi.fn>;
}

interface MockDestroyRef {
  onDestroy: ReturnType<typeof vi.fn>;
}

describe('AuditDetailPanelComponent', () => {
  let component: AuditDetailPanelComponent;
  let route: MockActivatedRoute;
  let router: MockRouter;
  let service: MockAdminAuditService;
  let logger: MockLoggerService;
  let destroyRef: MockDestroyRef;

  const entry: SystemAuditEntry = {
    id: 'sys-1',
    created_at: '2026-06-01T10:00:00Z',
    actor: {
      email: 'admin@example.com',
      provider: 'google',
      provider_id: 'g-1',
      display_name: 'Admin',
    },
    http_method: 'PUT',
    path: '/admin/settings/auth.session_ttl',
    field_path: 'auth.session_ttl',
    old_value: '3600',
    new_value: '7200',
    change_summary: 'auth.session_ttl 3600 -> 7200',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    route = {
      paramMap: new BehaviorSubject(convertToParamMap({ entryId: 'sys-1' })),
      snapshot: { data: { stream: 'system' } },
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    service = {
      getSystemEntry: vi.fn().mockReturnValue(of(entry)),
      getTmEntry: vi.fn(),
    };
    logger = createTypedMockLoggerService();
    destroyRef = { onDestroy: vi.fn() };
    const snackBar = { open: vi.fn() };
    const transloco = { translate: vi.fn().mockReturnValue('copied') };
    const cdr = { markForCheck: vi.fn() };

    component = new AuditDetailPanelComponent(
      route as never,
      router as never,
      service as unknown as AdminAuditService,
      logger as never,
      destroyRef as never,
      snackBar as never,
      transloco as never,
      cdr as never,
    );
  });

  it('fetches the system entry for the route param', () => {
    component.ngOnInit();
    expect(service.getSystemEntry).toHaveBeenCalledWith('sys-1');
    expect(component.systemEntry).toEqual(entry);
    expect(component.loadFailed).toBe(false);
  });

  it('fetches the TM entry when stream is tm', () => {
    route.snapshot.data['stream'] = 'tm';
    service.getTmEntry.mockReturnValue(of({ id: 'tma-1' }));
    component.ngOnInit();
    expect(service.getTmEntry).toHaveBeenCalledWith('sys-1');
  });

  it('sets loadFailed when the fetch errors', () => {
    service.getSystemEntry.mockReturnValue(throwError(() => new Error('404')));
    component.ngOnInit();
    expect(component.loadFailed).toBe(true);
  });

  it('refetches when the route param changes', () => {
    component.ngOnInit();
    route.paramMap.next(convertToParamMap({ entryId: 'sys-2' }));
    expect(service.getSystemEntry).toHaveBeenCalledWith('sys-2');
  });

  it('close() navigates to the parent preserving query params', () => {
    component.ngOnInit();
    component.close();
    expect(router.navigate).toHaveBeenCalledWith(['..'], {
      relativeTo: route,
      queryParamsHandling: 'preserve',
    });
  });

  it('viewInContext() merges around param without leaving the entry route', () => {
    component.ngOnInit();
    component.viewInContext();
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { around: 'sys-1', cursor: null },
      queryParamsHandling: 'merge',
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run test src/app/pages/admin/audit/components/audit-detail-panel/audit-detail-panel.component.spec.ts`
Expected: FAIL — cannot resolve `./audit-detail-panel.component`.

- [ ] **Step 3: Implement**

```typescript
// src/app/pages/admin/audit/components/audit-detail-panel/audit-detail-panel.component.ts
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../../../core/services/logger.service';
import { AdminAuditService } from '../../services/admin-audit.service';
import { AuditStream, SystemAuditEntry, TmAuditEntry } from '../../models/admin-audit.types';

/**
 * Route-driven detail side panel for a single audit entry.
 * Rendered in the nested outlet of a view component at route :entryId;
 * the stream (system|tm) comes from route data.
 */
@Component({
  selector: 'app-audit-detail-panel',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, RouterLink, TranslocoModule],
  templateUrl: './audit-detail-panel.component.html',
  styleUrl: './audit-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditDetailPanelComponent implements OnInit {
  stream: AuditStream = 'system';
  systemEntry: SystemAuditEntry | null = null;
  tmEntry: TmAuditEntry | null = null;
  loadFailed = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminAuditService: AdminAuditService,
    private logger: LoggerService,
    private destroyRef: DestroyRef,
    private snackBar: MatSnackBar,
    private transloco: TranslocoService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.stream = (this.route.snapshot.data['stream'] as AuditStream) ?? 'system';

    this.route.paramMap
      .pipe(
        switchMap(params => {
          const entryId = params.get('entryId') ?? '';
          this.loadFailed = false;
          const request$ =
            this.stream === 'system'
              ? this.adminAuditService.getSystemEntry(entryId)
              : this.adminAuditService.getTmEntry(entryId);
          return request$.pipe(
            catchError(error => {
              this.logger.error('Failed to load audit entry', error);
              this.loadFailed = true;
              this.cdr.markForCheck();
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(entry => {
        if (this.stream === 'system') {
          this.systemEntry = entry as SystemAuditEntry;
        } else {
          this.tmEntry = entry as TmAuditEntry;
        }
        this.cdr.markForCheck();
      });
  }

  /** Entry id currently shown (from either stream) */
  get entryId(): string {
    return this.systemEntry?.id ?? this.tmEntry?.id ?? '';
  }

  close(): void {
    void this.router.navigate(['..'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }

  /** Re-anchor the parent list centered on this entry; panel stays open */
  viewInContext(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { around: this.entryId, cursor: null },
      queryParamsHandling: 'merge',
    });
  }

  copyPermalink(): void {
    const url = `${window.location.origin}${this.router
      .createUrlTree(['.'], { relativeTo: this.route })
      .toString()}`;
    void navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open(
        this.transloco.translate('adminAudit.detail.permalinkCopied'),
        undefined,
        { duration: 3000 },
      );
    });
  }

  /** Absolute UTC timestamp for display */
  formatTimestamp(isoString: string): string {
    return new Date(isoString).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  }
}
```

Note: `MatSnackBar` requires `MatSnackBarModule` — check whether `CORE_MATERIAL_IMPORTS` includes it (`src/app/shared/imports.ts`); if not, add `MatSnackBarModule` to the imports array.

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm run test src/app/pages/admin/audit/components/audit-detail-panel/audit-detail-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Template + styles**

```html
<!-- src/app/pages/admin/audit/components/audit-detail-panel/audit-detail-panel.component.html -->
<aside class="detail-panel">
  <div class="panel-header">
    <h2>{{ 'adminAudit.detail.title' | transloco }}</h2>
    <span class="spacer"></span>
    <button
      mat-icon-button
      (click)="copyPermalink()"
      [matTooltip]="'adminAudit.detail.copyPermalink' | transloco"
      [attr.aria-label]="'adminAudit.detail.copyPermalink' | transloco"
    >
      <mat-icon>link</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="viewInContext()"
      [matTooltip]="'adminAudit.detail.viewInContext' | transloco"
      [attr.aria-label]="'adminAudit.detail.viewInContext' | transloco"
    >
      <mat-icon>my_location</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="close()"
      [matTooltip]="'adminAudit.detail.close' | transloco"
      [attr.aria-label]="'adminAudit.detail.close' | transloco"
    >
      <mat-icon>close</mat-icon>
    </button>
  </div>

  @if (loadFailed) {
    <p class="load-failed">{{ 'adminAudit.detail.loadFailed' | transloco }}</p>
  } @else if (stream === 'system' && systemEntry) {
    <dl class="detail-fields">
      <dt>{{ 'adminAudit.detail.timestamp' | transloco }}</dt>
      <dd>{{ formatTimestamp(systemEntry.created_at) }}</dd>

      <dt>{{ 'adminAudit.detail.actor' | transloco }}</dt>
      <dd>
        {{ systemEntry.actor.email }}
        <span class="actor-secondary">
          {{ systemEntry.actor.display_name }} · {{ systemEntry.actor.provider }} ·
          {{ systemEntry.actor.provider_id }}
        </span>
      </dd>

      <dt>{{ 'adminAudit.detail.request' | transloco }}</dt>
      <dd class="monospace">{{ systemEntry.http_method }} {{ systemEntry.path }}</dd>

      @if (systemEntry.field_path) {
        <dt>{{ 'adminAudit.detail.fieldPath' | transloco }}</dt>
        <dd class="monospace">{{ systemEntry.field_path }}</dd>
      }

      @if (systemEntry.old_value !== null) {
        <dt>{{ 'adminAudit.detail.oldValue' | transloco }}</dt>
        <dd class="monospace value-block">{{ systemEntry.old_value }}</dd>
      }

      @if (systemEntry.new_value !== null) {
        <dt>{{ 'adminAudit.detail.newValue' | transloco }}</dt>
        <dd class="monospace value-block">{{ systemEntry.new_value }}</dd>
      }

      <dt>{{ 'adminAudit.detail.summary' | transloco }}</dt>
      <dd>{{ systemEntry.change_summary }}</dd>
    </dl>
  } @else if (stream === 'tm' && tmEntry) {
    <dl class="detail-fields">
      <dt>{{ 'adminAudit.detail.timestamp' | transloco }}</dt>
      <dd>{{ formatTimestamp(tmEntry.created_at) }}</dd>

      <dt>{{ 'adminAudit.detail.actor' | transloco }}</dt>
      <dd>
        {{ tmEntry.actor.email }}
        <span class="actor-secondary">
          {{ tmEntry.actor.display_name }} · {{ tmEntry.actor.provider }} ·
          {{ tmEntry.actor.provider_id }}
        </span>
      </dd>

      <dt>{{ 'adminAudit.detail.threatModel' | transloco }}</dt>
      <dd>
        <a [routerLink]="['/tm', tmEntry.threat_model_id]">
          {{ tmEntry.threat_model_name || tmEntry.threat_model_id }}
        </a>
      </dd>

      <dt>{{ 'adminAudit.detail.objectType' | transloco }}</dt>
      <dd>{{ tmEntry.object_type }}</dd>

      <dt>{{ 'adminAudit.detail.objectId' | transloco }}</dt>
      <dd class="monospace">{{ tmEntry.object_id }}</dd>

      <dt>{{ 'adminAudit.detail.changeType' | transloco }}</dt>
      <dd>{{ tmEntry.change_type }}</dd>

      @if (tmEntry.rolled_back_to_version !== null) {
        <dt>{{ 'adminAudit.detail.rolledBackTo' | transloco }}</dt>
        <dd>{{ tmEntry.rolled_back_to_version }}</dd>
      }

      <dt>{{ 'adminAudit.detail.summary' | transloco }}</dt>
      <dd>{{ tmEntry.change_summary }}</dd>
    </dl>
  }
</aside>
```

```scss
// src/app/pages/admin/audit/components/audit-detail-panel/audit-detail-panel.component.scss
.detail-panel {
  height: 100%;
  padding: 12px 16px;
  overflow-y: auto;

  .panel-header {
    display: flex;
    align-items: center;

    h2 {
      margin: 0;
      font-size: 16px;
    }

    .spacer {
      flex: 1;
    }
  }

  .detail-fields {
    dt {
      margin-top: 12px;
      font-size: 12px;
      opacity: 0.7;
    }

    dd {
      margin: 2px 0 0;
    }
  }

  .actor-secondary {
    display: block;
    font-size: 12px;
    opacity: 0.7;
  }

  .monospace {
    font-family: monospace;
  }

  .value-block {
    white-space: pre-wrap;
    word-break: break-all;
  }
}
```

- [ ] **Step 6: Run lint and commit Tasks 4–8 together**

Run: `pnpm run lint:all` — fix any issues.

```bash
git add src/app/pages/admin/audit/ src/app/app.routes.ts src/app/pages/admin/admin.component.ts src/assets/i18n/en-US.json
git commit -m "feat(admin): audit-log routes, shell, filter bar, table, detail panel (#679)"
```

---

### Task 9: System audit view (composition + URL state + export)

**Files:**
- Create: `src/app/pages/admin/audit/system-audit-view.component.ts`
- Create: `src/app/pages/admin/audit/system-audit-view.component.html`
- Create: `src/app/pages/admin/audit/system-audit-view.component.scss`
- Test: `src/app/pages/admin/audit/system-audit-view.component.spec.ts`

The view owns URL state: it treats query params as the single source of truth. Filter-bar emissions and pager clicks navigate (merge/replace query params); a `queryParamMap` subscription loads data. The nested outlet renders the panel; panel open/closed is derived from `route.firstChild`.

- [ ] **Step 1: Write the failing spec**

```typescript
// src/app/pages/admin/audit/system-audit-view.component.spec.ts
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { convertToParamMap, ParamMap } from '@angular/router';

import { SystemAuditViewComponent } from './system-audit-view.component';
import { AdminAuditService } from './services/admin-audit.service';
import { CursorPage, SystemAuditEntry } from './models/admin-audit.types';
import {
  createTypedMockLoggerService,
  type MockLoggerService,
} from '../../../../testing/mocks';

interface MockRouter {
  navigate: ReturnType<typeof vi.fn>;
}

interface MockActivatedRoute {
  queryParamMap: BehaviorSubject<ParamMap>;
  firstChild: unknown;
}

interface MockAdminAuditService {
  listSystem: ReturnType<typeof vi.fn>;
  exportSystem: ReturnType<typeof vi.fn>;
}

interface MockDestroyRef {
  onDestroy: ReturnType<typeof vi.fn>;
}

describe('SystemAuditViewComponent', () => {
  let component: SystemAuditViewComponent;
  let route: MockActivatedRoute;
  let router: MockRouter;
  let service: MockAdminAuditService;
  let logger: MockLoggerService;
  let destroyRef: MockDestroyRef;

  const entry: SystemAuditEntry = {
    id: 'sys-1',
    created_at: '2026-06-01T10:00:00Z',
    actor: {
      email: 'admin@example.com',
      provider: 'google',
      provider_id: 'g-1',
      display_name: 'Admin',
    },
    http_method: 'PUT',
    path: '/admin/settings/auth.session_ttl',
    field_path: 'auth.session_ttl',
    old_value: '3600',
    new_value: '7200',
    change_summary: 'auth.session_ttl 3600 -> 7200',
  };

  const page: CursorPage<SystemAuditEntry> = {
    items: [entry],
    next_cursor: 'cur-next',
    prev_cursor: 'cur-prev',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    route = {
      queryParamMap: new BehaviorSubject(convertToParamMap({})),
      firstChild: null,
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    service = {
      listSystem: vi.fn().mockReturnValue(of(page)),
      exportSystem: vi.fn().mockReturnValue(of(new Blob(['x'], { type: 'text/csv' }))),
    };
    logger = createTypedMockLoggerService();
    destroyRef = { onDestroy: vi.fn() };
    const snackBar = { open: vi.fn() };
    const transloco = { translate: vi.fn().mockReturnValue('failed') };
    const cdr = { markForCheck: vi.fn() };

    component = new SystemAuditViewComponent(
      route as never,
      router as never,
      service as unknown as AdminAuditService,
      logger as never,
      destroyRef as never,
      snackBar as never,
      transloco as never,
      cdr as never,
    );
  });

  it('loads newest page when no query params present', () => {
    component.ngOnInit();
    expect(service.listSystem).toHaveBeenCalledWith({}, { limit: 25 });
    expect(component.rows).toEqual([entry]);
    expect(component.nextCursor).toBe('cur-next');
  });

  it('passes filters and cursor from query params to the service', () => {
    route.queryParamMap.next(
      convertToParamMap({ actor_email: 'a@b.c', cursor: 'c1', http_method: 'PUT' }),
    );
    component.ngOnInit();
    expect(service.listSystem).toHaveBeenCalledWith(
      { actor_email: 'a@b.c', http_method: 'PUT' },
      { cursor: 'c1', limit: 25 },
    );
  });

  it('passes around anchor and exposes anchorId', () => {
    route.queryParamMap.next(convertToParamMap({ around: 'sys-9' }));
    component.ngOnInit();
    expect(service.listSystem).toHaveBeenCalledWith({}, { around: 'sys-9', limit: 25 });
    expect(component.anchorId).toBe('sys-9');
  });

  it('sets error flag when the query fails', () => {
    service.listSystem.mockReturnValue(throwError(() => new Error('500')));
    component.ngOnInit();
    expect(component.error).toBe(true);
  });

  it('onFiltersChange navigates replacing filters and clearing cursor/around', () => {
    component.ngOnInit();
    component.onFiltersChange({ actor_email: 'a@b.c' });
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { actor_email: 'a@b.c' },
    });
  });

  it('onPageOlder navigates merging next cursor and clearing around', () => {
    component.ngOnInit();
    component.onPageOlder();
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { cursor: 'cur-next', around: null },
      queryParamsHandling: 'merge',
    });
  });

  it('onRowClicked navigates to the entry child route preserving query params', () => {
    component.ngOnInit();
    component.onRowClicked(entry);
    expect(router.navigate).toHaveBeenCalledWith(['sys-1'], {
      relativeTo: route,
      queryParamsHandling: 'preserve',
    });
  });

  it('onExport calls exportSystem with current filters', () => {
    route.queryParamMap.next(convertToParamMap({ actor_email: 'a@b.c' }));
    component.ngOnInit();
    component.onExport('csv');
    expect(service.exportSystem).toHaveBeenCalledWith({ actor_email: 'a@b.c' }, 'csv');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run test src/app/pages/admin/audit/system-audit-view.component.spec.ts`
Expected: FAIL — cannot resolve `./system-audit-view.component`.

- [ ] **Step 3: Implement**

```typescript
// src/app/pages/admin/audit/system-audit-view.component.ts
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../core/services/logger.service';
import { saveBlobAsFile } from '@app/shared/utils/file-download.util';
import { AdminAuditService } from './services/admin-audit.service';
import {
  AuditExportFormat,
  SystemAuditEntry,
  SystemAuditFilter,
} from './models/admin-audit.types';
import {
  AuditFilterBarComponent,
  AuditFilterSelect,
  AuditFilterText,
} from './components/audit-filter-bar/audit-filter-bar.component';
import {
  AuditTableComponent,
  AuditTableColumn,
} from './components/audit-table/audit-table.component';

const PAGE_SIZE = 25;
const SYSTEM_FILTER_KEYS = [
  'actor_email',
  'actor_provider',
  'from',
  'to',
  'http_method',
  'path_prefix',
  'field_path',
] as const;

/**
 * System audit-log view: filter bar + cursor-paged table + nested outlet
 * for the detail panel. Query params are the single source of truth for
 * filters, cursor, and around-anchor; all interactions navigate.
 */
@Component({
  selector: 'app-system-audit-view',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    RouterOutlet,
    TranslocoModule,
    AuditFilterBarComponent,
    AuditTableComponent,
  ],
  templateUrl: './system-audit-view.component.html',
  styleUrl: './system-audit-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemAuditViewComponent implements OnInit {
  rows: SystemAuditEntry[] = [];
  loading = true;
  error = false;
  nextCursor: string | null = null;
  prevCursor: string | null = null;
  anchorId: string | null = null;
  currentFilters: SystemAuditFilter = {};

  readonly selectFields: AuditFilterSelect[] = [
    {
      key: 'http_method',
      labelKey: 'adminAudit.filters.httpMethod',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  ];

  readonly textFields: AuditFilterText[] = [
    { key: 'path_prefix', labelKey: 'adminAudit.filters.pathPrefix' },
    { key: 'field_path', labelKey: 'adminAudit.filters.fieldPath' },
  ];

  readonly columns: AuditTableColumn<SystemAuditEntry>[] = [
    {
      key: 'timestamp',
      headerKey: 'adminAudit.columns.timestamp',
      value: row => new Date(row.created_at).toLocaleString(),
      tooltip: row => row.created_at,
    },
    {
      key: 'actor',
      headerKey: 'adminAudit.columns.actor',
      value: row => row.actor.email,
      tooltip: row => row.actor.display_name,
    },
    {
      key: 'request',
      headerKey: 'adminAudit.columns.request',
      value: row => `${row.http_method} ${row.path}`,
    },
    {
      key: 'fieldPath',
      headerKey: 'adminAudit.columns.fieldPath',
      value: row => row.field_path ?? '-',
    },
    {
      key: 'summary',
      headerKey: 'adminAudit.columns.summary',
      value: row => row.change_summary,
    },
  ];

  readonly rowId = (row: SystemAuditEntry): string => row.id;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminAuditService: AdminAuditService,
    private logger: LoggerService,
    private destroyRef: DestroyRef,
    private snackBar: MatSnackBar,
    private transloco: TranslocoService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        tap(() => {
          this.loading = true;
          this.error = false;
        }),
        switchMap(params => {
          const filters: SystemAuditFilter = {};
          for (const key of SYSTEM_FILTER_KEYS) {
            const value = params.get(key);
            if (value) {
              filters[key] = value;
            }
          }
          this.currentFilters = filters;
          this.anchorId = params.get('around');

          const cursor = params.get('cursor');
          const page = this.anchorId
            ? { around: this.anchorId, limit: PAGE_SIZE }
            : cursor
              ? { cursor, limit: PAGE_SIZE }
              : { limit: PAGE_SIZE };

          return this.adminAuditService.listSystem(filters, page).pipe(
            catchError(error => {
              this.logger.error('System audit query failed', error);
              this.error = true;
              this.loading = false;
              this.cdr.markForCheck();
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(page => {
        this.rows = page.items;
        this.nextCursor = page.next_cursor;
        this.prevCursor = page.prev_cursor;
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  onFiltersChange(filters: Record<string, string>): void {
    // Replace query params wholesale: new filters, cursor/around reset
    void this.router.navigate([], { relativeTo: this.route, queryParams: filters });
  }

  onPageOlder(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cursor: this.nextCursor, around: null },
      queryParamsHandling: 'merge',
    });
  }

  onPageNewer(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cursor: this.prevCursor, around: null },
      queryParamsHandling: 'merge',
    });
  }

  onRowClicked(row: SystemAuditEntry): void {
    void this.router.navigate([row.id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }

  onClearFilters(): void {
    this.onFiltersChange({});
  }

  onRetry(): void {
    // Force the queryParamMap pipeline to re-run with an inert cache-buster param
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { retry: Date.now() },
      queryParamsHandling: 'merge',
    });
  }

  onExport(format: AuditExportFormat): void {
    this.adminAuditService
      .exportSystem(this.currentFilters, format)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          saveBlobAsFile(blob, `tmi-system-audit-${stamp}.${format === 'csv' ? 'csv' : 'ndjson'}`);
        },
        error: () => {
          // Already logged by the service; surface the failure to the user
          this.snackBar.open(this.transloco.translate('adminAudit.export.failed'), undefined, {
            duration: 5000,
          });
        },
      });
  }

  /** Whether the detail panel child route is active */
  get panelOpen(): boolean {
    return this.route.firstChild !== null;
  }

  /** Entry id open in the panel, for row highlight */
  get selectedId(): string | null {
    return this.route.firstChild?.snapshot.paramMap.get('entryId') ?? null;
  }
}
```

Implementation note for the executor: the `onRetry` body above is intentionally minimal but the `retry: Date.now()` query param is ugly in the URL. Acceptable alternative if you prefer: extract the load logic into a private `load(params)` method called both from the subscription and from `onRetry()` directly. Either is fine; keep the tests passing.

- [ ] **Step 4: Template + styles**

```html
<!-- src/app/pages/admin/audit/system-audit-view.component.html -->
<div class="audit-view">
  <app-audit-filter-bar
    [selectFields]="selectFields"
    [textFields]="textFields"
    [showExport]="true"
    (filtersChange)="onFiltersChange($event)"
    (exportRequested)="onExport($event)"
  ></app-audit-filter-bar>

  <div class="view-body" [class.panel-open]="panelOpen">
    <div class="table-pane">
      <app-audit-table
        [columns]="columns"
        [rows]="rows"
        [loading]="loading"
        [error]="error"
        [nextCursor]="nextCursor"
        [prevCursor]="prevCursor"
        [rowId]="rowId"
        [anchorId]="anchorId"
        [selectedId]="selectedId"
        (rowClicked)="onRowClicked($event)"
        (pageOlder)="onPageOlder()"
        (pageNewer)="onPageNewer()"
        (retry)="onRetry()"
        (clearFilters)="onClearFilters()"
      ></app-audit-table>
    </div>
    <div class="panel-pane">
      <router-outlet></router-outlet>
    </div>
  </div>
</div>
```

```scss
// src/app/pages/admin/audit/system-audit-view.component.scss
.audit-view {
  padding-top: 12px;
}

.view-body {
  display: flex;
  gap: 12px;

  .table-pane {
    flex: 1;
    min-width: 0;
  }

  .panel-pane {
    width: 0;
    transition: width 150ms ease;
  }

  &.panel-open .panel-pane {
    width: 38%;
    min-width: 320px;
    border-left: 1px solid var(--theme-divider, rgb(0 0 0 / 12%));
  }
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `pnpm run test src/app/pages/admin/audit/system-audit-view.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/audit/
git commit -m "feat(admin): system audit view with URL-driven cursor state and export (#679)"
```

---

### Task 10: Threat-model audit view

**Files:**
- Create: `src/app/pages/admin/audit/tm-audit-view.component.ts`
- Create: `src/app/pages/admin/audit/tm-audit-view.component.html`
- Create: `src/app/pages/admin/audit/tm-audit-view.component.scss`
- Test: `src/app/pages/admin/audit/tm-audit-view.component.spec.ts`

Same shape as Task 9 with TM config; no export. Write the spec first (mirror the system-view spec: load-on-params, filter navigation, paging, row click — replacing `listSystem` with `listTm` and the filter keys with the TM set), verify it fails, then implement.

- [ ] **Step 1: Write the failing spec** — copy `system-audit-view.component.spec.ts`, rename to `TmAuditViewComponent`, mock `listTm` (no `exportSystem`), use this mock entry and these param expectations:

```typescript
  const entry: TmAuditEntry = {
    id: 'tma-1',
    threat_model_id: 'tm-1',
    threat_model_name: 'Payments TM',
    object_type: 'threat',
    object_id: 'threat-1',
    change_type: 'updated',
    actor: {
      email: 'user@example.com',
      provider: 'google',
      provider_id: 'g-2',
      display_name: 'User',
    },
    change_summary: 'Updated threat name',
    created_at: '2026-06-01T11:00:00Z',
    rolled_back_to_version: null,
  };
```

```typescript
  it('passes TM filters from query params to the service', () => {
    route.queryParamMap.next(
      convertToParamMap({ threat_model_id: 'tm-1', change_type: 'updated' }),
    );
    component.ngOnInit();
    expect(service.listTm).toHaveBeenCalledWith(
      { threat_model_id: 'tm-1', change_type: 'updated' },
      { limit: 25 },
    );
  });
```

Drop the export test. Keep load/error/paging/row-click tests identical in structure.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run test src/app/pages/admin/audit/tm-audit-view.component.spec.ts`
Expected: FAIL — cannot resolve `./tm-audit-view.component`.

- [ ] **Step 3: Implement** — copy `system-audit-view.component.ts` with these substitutions (everything else identical, including the query-param state machine):

```typescript
const TM_FILTER_KEYS = [
  'actor_email',
  'actor_provider',
  'from',
  'to',
  'change_type',
  'object_type',
  'threat_model_id',
] as const;
```

```typescript
  readonly selectFields: AuditFilterSelect[] = [
    {
      key: 'change_type',
      labelKey: 'adminAudit.filters.changeType',
      options: ['created', 'updated', 'patched', 'deleted', 'rolled_back', 'restored'],
      optionLabelPrefix: 'auditTrail.changeTypes.',
    },
    {
      key: 'object_type',
      labelKey: 'adminAudit.filters.objectType',
      options: ['threat_model', 'diagram', 'threat', 'asset', 'document', 'note', 'repository'],
    },
  ];

  readonly textFields: AuditFilterText[] = [
    { key: 'threat_model_id', labelKey: 'adminAudit.filters.threatModelId' },
  ];

  readonly columns: AuditTableColumn<TmAuditEntry>[] = [
    {
      key: 'timestamp',
      headerKey: 'adminAudit.columns.timestamp',
      value: row => new Date(row.created_at).toLocaleString(),
      tooltip: row => row.created_at,
    },
    {
      key: 'actor',
      headerKey: 'adminAudit.columns.actor',
      value: row => row.actor.email,
      tooltip: row => row.actor.display_name,
    },
    {
      key: 'threatModel',
      headerKey: 'adminAudit.columns.threatModel',
      value: row => row.threat_model_name ?? row.threat_model_id,
    },
    {
      key: 'objectType',
      headerKey: 'adminAudit.columns.objectType',
      value: row => row.object_type,
    },
    {
      key: 'changeType',
      headerKey: 'adminAudit.columns.changeType',
      value: row => row.change_type,
    },
    {
      key: 'summary',
      headerKey: 'adminAudit.columns.summary',
      value: row => row.change_summary,
    },
  ];
```

Service call is `this.adminAuditService.listTm(filters, page)`; component class is `TmAuditViewComponent`; selector `app-tm-audit-view`; template/scss identical to the system view minus `[showExport]="true"` and `(exportRequested)`; no `onExport` method. Since there is no export, also drop the `snackBar` and `transloco` constructor parameters (and their imports) — unused parameters fail lint. Constructor: `(route, router, adminAuditService, logger, destroyRef, cdr)`; spec passes mocks in that order.

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm run test src/app/pages/admin/audit/tm-audit-view.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Lint, build, commit**

Run: `pnpm run lint:all` then `pnpm run build` — this is the first point the whole feature compiles; fix all errors.

```bash
git add src/app/pages/admin/audit/
git commit -m "feat(admin): cross-TM audit view (#679)"
```

---

### Task 11: "View in audit log" cross-reference on admin settings

**Files:**
- Modify: `src/app/pages/admin/settings/admin-settings.component.html` (actions column, `matColumnDef="actions"` container ~line 142)
- Modify: `src/app/pages/admin/settings/admin-settings.component.ts`

- [ ] **Step 1: Add the navigation handler to the component class**

Read the component first to find the settings-row type (the table's row objects have a `key` property — verify the actual property name in the component's data model and use it). Add:

```typescript
  /** Open the system audit log pre-filtered to this setting's field path */
  viewInAuditLog(key: string): void {
    void this.router.navigate(['/admin/audit/system'], {
      queryParams: { field_path: key },
    });
  }
```

If the component does not already inject `Router`, add `private router: Router` to the constructor and import it from `@angular/router`.

- [ ] **Step 2: Add the action button to the actions column**

Inside the existing `matColumnDef="actions"` cell, alongside the existing icon buttons:

```html
<button
  mat-icon-button
  (click)="viewInAuditLog(row.key)"
  [matTooltip]="'admin.settings.viewInAuditLog' | transloco"
  [attr.aria-label]="'admin.settings.viewInAuditLog' | transloco"
>
  <mat-icon>history</mat-icon>
</button>
```

(Adjust `row.key` to the template's actual row variable name — check the surrounding `*matCellDef="let row"` binding.)

- [ ] **Step 3: Lint, verify, commit**

Run: `pnpm run lint:all` and `pnpm run build` — both clean.

```bash
git add src/app/pages/admin/settings/
git commit -m "feat(admin): link settings rows to pre-filtered system audit log (#679)"
```

---

### Task 12: Localization backfill

- [ ] **Step 1: Backfill all locales**

The new `en-US.json` keys from Task 4 must be translated to every locale in `src/assets/i18n/` (ar-SA, bn-BD, de-DE, es-ES, fr-FR, he-IL, hi-IN, id-ID, ja-JP, ko-KR, pt-BR, ru-RU, th-TH, ur-PK, zh-CN). Invoke the `localization-backfill` skill (or the `loc:backfill` skill) — it reads `.claude/i18n.config.json` and translates all missing keys from the master locale. Do not hand-translate.

- [ ] **Step 2: Validate**

Run the i18n check command from `.claude/i18n.config.json` (the `check_command` entry) and confirm no missing keys remain for the new `adminAudit.*`, `admin.sections.audit.*`, and `admin.settings.viewInAuditLog` keys.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore(i18n): localize admin audit-log UI strings (#679)"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full lint** — `pnpm run lint:all`, fix everything.
- [ ] **Step 2: Full build** — `pnpm run build`, fix all errors (even pre-existing).
- [ ] **Step 3: Full test suite** — `pnpm test`, no failures, no skips. Troubleshoot to root cause; never skip tests.
- [ ] **Step 4: Code review** — invoke the `superpowers:requesting-code-review` skill per project policy before final commit.
- [ ] **Step 5: Manual smoke check** (requires a running server with tmi#398 — skip with a note if unavailable): log in as admin → Admin → Audit Logs → verify system tab loads, filters apply, row opens panel, permalink copies and cold-opens, ‹›/pager works, export downloads, TM tab loads, settings page history button pre-filters.
- [ ] **Step 6: Close out** — comment on tmi-ux#679 referencing the commits and close the issue (`gh issue comment 679 --body "..."` then `gh issue close 679`) — note: commits on `dev/1.4.0` do NOT auto-close issues.
