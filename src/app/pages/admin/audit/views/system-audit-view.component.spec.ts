import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { ChangeDetectorRef, DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';

import { SystemAuditViewComponent } from './system-audit-view.component';
import { createTypedMockLoggerService, createTypedMockRouter } from '@testing/mocks';
import type { MockLoggerService, MockRouter } from '@testing/mocks';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminAuditService } from '@app/pages/admin/audit/admin-audit.service';
import type { SystemAuditEntry } from '@app/pages/admin/audit/models/admin-audit.model';

// ── vi.mock for downloadBlob ──────────────────────────────────────────────────

vi.mock('@app/shared/utils/blob-download.util', () => ({
  downloadBlob: vi.fn(),
}));

// Import after mock so we get the mocked version
import { downloadBlob } from '@app/shared/utils/blob-download.util';

// ── Fixture data ──────────────────────────────────────────────────────────────

const ENTRY_1: SystemAuditEntry = {
  id: 'sys-1',
  actor: {
    email: 'admin@example.com',
    provider: 'google',
    provider_id: 'g1',
    display_name: 'Admin',
  },
  http_method: 'PATCH',
  http_path: '/admin/users/1',
  field_path: 'role',
  old_value_redacted: 'viewer',
  new_value_redacted: 'admin',
  change_summary: 'Role changed',
  created_at: '2026-01-01T12:00:00Z',
};

const ENTRY_2: SystemAuditEntry = {
  id: 'sys-2',
  actor: { email: 'user@example.com', provider: 'local', provider_id: 'l1', display_name: 'User' },
  http_method: 'DELETE',
  http_path: '/admin/users/2',
  field_path: '',
  old_value_redacted: null,
  new_value_redacted: null,
  change_summary: 'User deleted',
  created_at: '2026-01-02T08:00:00Z',
};

// SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: build a stub system audit list response for tests (pure)
function makeListResponse(
  entries: SystemAuditEntry[] = [ENTRY_1],
  opts: { total?: number; next_cursor?: string | null; prev_cursor?: string | null } = {},
): {
  entries: SystemAuditEntry[];
  total: number;
  limit: number;
  next_cursor: string | null;
  prev_cursor: string | null;
} {
  return {
    entries,
    total: opts.total ?? entries.length,
    limit: 50,
    next_cursor: opts.next_cursor ?? null,
    prev_cursor: opts.prev_cursor ?? null,
  };
}

// ── Build mocks / injector helper ─────────────────────────────────────────────

// SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: build a configured Angular injector with audit service mocks for tests (pure)
function buildMocks(
  options: {
    queryParams?: Record<string, string>;
    listResponse?: ReturnType<typeof makeListResponse>;
    listError?: unknown;
    exportResponse?: Blob;
    exportError?: unknown;
  } = {},
): {
  injector: Injector;
  queryParamMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  mockRoute: {
    snapshot: { queryParams: Record<string, string> };
    queryParamMap: ReturnType<typeof BehaviorSubject.prototype.asObservable>;
  };
  mockRouter: MockRouter;
  mockAuditService: Partial<AdminAuditService>;
  mockLogger: MockLoggerService;
  mockSnackBar: { open: ReturnType<typeof vi.fn> };
  mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
} {
  const queryParams = options.queryParams ?? {};
  const queryParamMapSubject = new BehaviorSubject(convertToParamMap(queryParams));

  const mockRoute = {
    snapshot: { queryParams },
    queryParamMap: queryParamMapSubject.asObservable(),
  };

  const mockRouter = createTypedMockRouter('/admin/audit/system') as MockRouter;
  const mockLogger = createTypedMockLoggerService();

  const listResponse = options.listResponse ?? makeListResponse();
  const mockAuditService: Partial<AdminAuditService> = {
    listSystem: options.listError
      ? vi.fn().mockReturnValue(throwError(() => options.listError))
      : vi.fn().mockReturnValue(of(listResponse)),
    exportSystem: options.exportError
      ? vi.fn().mockReturnValue(throwError(() => options.exportError))
      : vi
          .fn()
          .mockReturnValue(of(options.exportResponse ?? new Blob(['data'], { type: 'text/csv' }))),
  };

  const mockDestroyRef = { onDestroy: vi.fn() };
  const mockCdr = { markForCheck: vi.fn() };
  const mockSnackBar = { open: vi.fn() };
  const mockTransloco = { translate: vi.fn((key: string) => key) };

  const injector = Injector.create({
    providers: [
      { provide: DestroyRef, useValue: mockDestroyRef },
      { provide: ChangeDetectorRef, useValue: mockCdr },
      { provide: ActivatedRoute, useValue: mockRoute },
      { provide: Router, useValue: mockRouter },
      { provide: AdminAuditService, useValue: mockAuditService },
      { provide: LoggerService, useValue: mockLogger },
      { provide: MatSnackBar, useValue: mockSnackBar },
      { provide: TranslocoService, useValue: mockTransloco },
    ],
  });

  return {
    injector,
    queryParamMapSubject,
    mockRoute,
    mockRouter,
    mockAuditService,
    mockLogger,
    mockSnackBar,
    mockCdr,
  };
}

// SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: instantiate and initialize SystemAuditViewComponent in an injection context (pure)
function createComponent(injector: Injector): SystemAuditViewComponent {
  const comp = runInInjectionContext(injector, () => new SystemAuditViewComponent());
  comp.ngOnInit();
  return comp;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SystemAuditViewComponent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('(a) loads system entries on init (no around) and sets rows/total/cursors', () => {
    let comp: SystemAuditViewComponent;
    let mocks: ReturnType<typeof buildMocks>;

    beforeEach(() => {
      mocks = buildMocks({
        listResponse: makeListResponse([ENTRY_1, ENTRY_2], {
          total: 2,
          next_cursor: 'cursor-next',
          prev_cursor: 'cursor-prev',
        }),
      });
      comp = createComponent(mocks.injector);
    });

    it('should create the component', () => {
      expect(comp).toBeTruthy();
    });

    it('should call listSystem with empty filter and limit on init', () => {
      expect(mocks.mockAuditService.listSystem).toHaveBeenCalledWith({}, { limit: 50 });
    });

    it('should set rows from service response', () => {
      expect(comp.rows).toEqual([ENTRY_1, ENTRY_2]);
    });

    it('should set total from service response', () => {
      expect(comp.total).toBe(2);
    });

    it('should set nextCursor from service response', () => {
      expect(comp.nextCursor).toBe('cursor-next');
    });

    it('should set prevCursor from service response', () => {
      expect(comp.prevCursor).toBe('cursor-prev');
    });

    it('should set loading=false after load completes', () => {
      expect(comp.loading).toBe(false);
    });

    it('should set hasError=false on successful load', () => {
      expect(comp.hasError).toBe(false);
    });

    it('should not set anchorId when there is no around param', () => {
      expect(comp.anchorId).toBeNull();
    });

    it('should expose the stream as system', () => {
      expect(comp.stream).toBe('system');
    });
  });

  describe('(b) onFilterChange sets filter, resets anchorId, reloads and mirrors URL', () => {
    let comp: SystemAuditViewComponent;
    let mocks: ReturnType<typeof buildMocks>;

    beforeEach(() => {
      mocks = buildMocks();
      comp = createComponent(mocks.injector);
      vi.clearAllMocks();
    });

    it('should set the new filter', () => {
      comp.onFilterChange({ actor_email: 'test@example.com' });
      expect(comp.filter).toEqual({ actor_email: 'test@example.com' });
    });

    it('should reset anchorId to null', () => {
      comp.anchorId = 'some-anchor';
      comp.onFilterChange({ actor_email: 'test@example.com' });
      expect(comp.anchorId).toBeNull();
    });

    it('should call listSystem with the new filter and limit', () => {
      comp.onFilterChange({ actor_email: 'test@example.com' });
      expect(mocks.mockAuditService.listSystem).toHaveBeenCalledWith(
        { actor_email: 'test@example.com' },
        { limit: 50 },
      );
    });

    it('should call router.navigate with [] for URL mirroring', () => {
      comp.onFilterChange({ actor_email: 'test@example.com' });
      expect(mocks.mockRouter.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          relativeTo: mocks.mockRoute,
          replaceUrl: true,
        }),
      );
    });
  });

  describe('(c) onOlder and onNewer pass the correct cursor', () => {
    let comp: SystemAuditViewComponent;
    let mocks: ReturnType<typeof buildMocks>;

    beforeEach(() => {
      mocks = buildMocks({
        listResponse: makeListResponse([ENTRY_1], {
          next_cursor: 'next-42',
          prev_cursor: 'prev-42',
        }),
      });
      comp = createComponent(mocks.injector);
      vi.clearAllMocks();
    });

    it('onOlder() calls listSystem with cursor = nextCursor', () => {
      comp.onOlder();
      expect(mocks.mockAuditService.listSystem).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ cursor: 'next-42' }),
      );
    });

    it('onNewer() calls listSystem with cursor = prevCursor', () => {
      comp.onNewer();
      expect(mocks.mockAuditService.listSystem).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ cursor: 'prev-42' }),
      );
    });
  });

  describe('(d) around query param on init triggers listSystem with { around } and sets anchorId', () => {
    it('should set anchorId from the around param', () => {
      const mocks = buildMocks({ queryParams: { around: 'sys-anchor-1' } });
      const comp = createComponent(mocks.injector);
      expect(comp.anchorId).toBe('sys-anchor-1');
    });

    it('should call listSystem with around in page request', () => {
      const mocks = buildMocks({ queryParams: { around: 'sys-anchor-1' } });
      createComponent(mocks.injector);
      expect(mocks.mockAuditService.listSystem).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ around: 'sys-anchor-1', limit: 50 }),
      );
    });

    it('should also restore filter keys from query params', () => {
      const mocks = buildMocks({
        queryParams: { actor_email: 'a@b.com', http_method: 'PATCH' },
      });
      const comp = createComponent(mocks.injector);
      expect(comp.filter).toEqual({ actor_email: 'a@b.com', http_method: 'PATCH' });
    });
  });

  describe('(e) onExport calls exportSystem and downloadBlob', () => {
    it('should call exportSystem with the current filter and format', () => {
      const mocks = buildMocks();
      const comp = createComponent(mocks.injector);
      comp.onExport('csv');
      expect(mocks.mockAuditService.exportSystem).toHaveBeenCalledWith({}, 'csv');
    });

    it('should call downloadBlob with a .csv filename for csv format', () => {
      const mocks = buildMocks();
      const comp = createComponent(mocks.injector);
      comp.onExport('csv');
      expect(downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.stringMatching(/^system-audit-.*\.csv$/),
      );
    });

    it('should call downloadBlob with a .ndjson filename for ndjson format', () => {
      const mocks = buildMocks({
        exportResponse: new Blob(['{}'], { type: 'application/x-ndjson' }),
      });
      const comp = createComponent(mocks.injector);
      comp.onExport('ndjson');
      expect(downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.stringMatching(/^system-audit-.*\.ndjson$/),
      );
    });

    it('should log and open snackBar on export error', () => {
      const exportErr = new Error('export failed');
      const mocks = buildMocks({ exportError: exportErr });
      const comp = createComponent(mocks.injector);
      comp.onExport('csv');
      expect(mocks.mockLogger.error).toHaveBeenCalled();
      expect(mocks.mockSnackBar.open).toHaveBeenCalled();
    });
  });

  describe('(f) onRowClick navigates to [id] relative to route', () => {
    it('should call router.navigate with [id] relativeTo route', () => {
      const mocks = buildMocks();
      const comp = createComponent(mocks.injector);
      comp.onRowClick({ id: 'sys-99' });
      expect(mocks.mockRouter.navigate).toHaveBeenCalledWith(['sys-99'], {
        relativeTo: mocks.mockRoute,
      });
    });
  });

  describe('(g) service error sets hasError=true', () => {
    it('should set hasError=true when listSystem throws', () => {
      const mocks = buildMocks({ listError: new Error('server error') });
      const comp = createComponent(mocks.injector);
      expect(comp.hasError).toBe(true);
    });

    it('should set loading=false on error', () => {
      const mocks = buildMocks({ listError: new Error('server error') });
      const comp = createComponent(mocks.injector);
      expect(comp.loading).toBe(false);
    });

    it('should log the error', () => {
      const mocks = buildMocks({ listError: new Error('server error') });
      createComponent(mocks.injector);
      expect(mocks.mockLogger.error).toHaveBeenCalled();
    });
  });
});
