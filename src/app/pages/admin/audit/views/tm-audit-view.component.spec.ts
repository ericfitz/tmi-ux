import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { ChangeDetectorRef, DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { TmAuditViewComponent } from './tm-audit-view.component';
import { createTypedMockLoggerService, createTypedMockRouter } from '@testing/mocks';
import type { MockLoggerService, MockRouter } from '@testing/mocks';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminAuditService } from '@app/pages/admin/audit/admin-audit.service';
import type { AuditEntry } from '@app/pages/admin/audit/models/admin-audit.model';

// ── Fixture data ──────────────────────────────────────────────────────────────

const ENTRY_1: AuditEntry = {
  id: 'tm-1',
  threat_model_id: 'tm-model-1',
  object_type: 'threat_model',
  object_id: 'obj-1',
  version: 1,
  change_type: 'created',
  actor: {
    email: 'admin@example.com',
    provider: 'google',
    provider_id: 'g1',
    display_name: 'Admin',
  },
  change_summary: 'Threat model created',
  created_at: '2026-01-01T12:00:00Z',
};

const ENTRY_2: AuditEntry = {
  id: 'tm-2',
  threat_model_id: 'tm-model-1',
  object_type: 'diagram',
  object_id: 'obj-2',
  version: 2,
  change_type: 'updated',
  actor: {
    email: 'user@example.com',
    provider: 'local',
    provider_id: 'l1',
    display_name: 'User',
  },
  change_summary: 'Diagram updated',
  created_at: '2026-01-02T08:00:00Z',
};

function makeListResponse(
  entries: AuditEntry[] = [ENTRY_1],
  opts: { total?: number; next_cursor?: string | null; prev_cursor?: string | null } = {},
): {
  entries: AuditEntry[];
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

function buildMocks(
  options: {
    queryParams?: Record<string, string>;
    listResponse?: ReturnType<typeof makeListResponse>;
    listError?: unknown;
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
  mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
} {
  const queryParams = options.queryParams ?? {};
  const queryParamMapSubject = new BehaviorSubject(convertToParamMap(queryParams));

  const mockRoute = {
    snapshot: { queryParams },
    queryParamMap: queryParamMapSubject.asObservable(),
  };

  const mockRouter = createTypedMockRouter('/admin/audit/tm') as MockRouter;
  const mockLogger = createTypedMockLoggerService();

  const listResponse = options.listResponse ?? makeListResponse();
  const mockAuditService: Partial<AdminAuditService> = {
    listTm: options.listError
      ? vi.fn().mockReturnValue(throwError(() => options.listError))
      : vi.fn().mockReturnValue(of(listResponse)),
  };

  const mockDestroyRef = { onDestroy: vi.fn() };
  const mockCdr = { markForCheck: vi.fn() };

  const injector = Injector.create({
    providers: [
      { provide: DestroyRef, useValue: mockDestroyRef },
      { provide: ChangeDetectorRef, useValue: mockCdr },
      { provide: ActivatedRoute, useValue: mockRoute },
      { provide: Router, useValue: mockRouter },
      { provide: AdminAuditService, useValue: mockAuditService },
      { provide: LoggerService, useValue: mockLogger },
    ],
  });

  return {
    injector,
    queryParamMapSubject,
    mockRoute,
    mockRouter,
    mockAuditService,
    mockLogger,
    mockCdr,
  };
}

function createComponent(injector: Injector): TmAuditViewComponent {
  const comp = runInInjectionContext(injector, () => new TmAuditViewComponent());
  comp.ngOnInit();
  return comp;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TmAuditViewComponent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('(a) loads TM entries on init (no around) and sets rows/total/cursors', () => {
    let comp: TmAuditViewComponent;
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

    it('should call listTm with empty filter and limit on init', () => {
      expect(mocks.mockAuditService.listTm).toHaveBeenCalledWith({}, { limit: 50 });
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

    it('should expose the stream as tm', () => {
      expect(comp.stream).toBe('tm');
    });
  });

  describe('(b) onFilterChange sets filter, resets anchorId, reloads and mirrors URL', () => {
    let comp: TmAuditViewComponent;
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

    it('should call listTm with the new filter and limit', () => {
      comp.onFilterChange({ actor_email: 'test@example.com' });
      expect(mocks.mockAuditService.listTm).toHaveBeenCalledWith(
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
    let comp: TmAuditViewComponent;
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

    it('onOlder() calls listTm with cursor = nextCursor', () => {
      comp.onOlder();
      expect(mocks.mockAuditService.listTm).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ cursor: 'next-42' }),
      );
    });

    it('onNewer() calls listTm with cursor = prevCursor', () => {
      comp.onNewer();
      expect(mocks.mockAuditService.listTm).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ cursor: 'prev-42' }),
      );
    });
  });

  describe('(d) around query param on init triggers listTm with { around } and sets anchorId', () => {
    it('should set anchorId from the around param', () => {
      const mocks = buildMocks({ queryParams: { around: 'tm-anchor-1' } });
      const comp = createComponent(mocks.injector);
      expect(comp.anchorId).toBe('tm-anchor-1');
    });

    it('should call listTm with around in page request', () => {
      const mocks = buildMocks({ queryParams: { around: 'tm-anchor-1' } });
      createComponent(mocks.injector);
      expect(mocks.mockAuditService.listTm).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ around: 'tm-anchor-1', limit: 50 }),
      );
    });

    it('should also restore filter keys from query params', () => {
      const mocks = buildMocks({
        queryParams: { actor_email: 'a@b.com', threat_model_id: 'tm-xyz' },
      });
      const comp = createComponent(mocks.injector);
      expect(comp.filter).toEqual({ actor_email: 'a@b.com', threat_model_id: 'tm-xyz' });
    });
  });

  describe('(e) onRowClick navigates to [id] relative to route', () => {
    it('should call router.navigate with [id] relativeTo route', () => {
      const mocks = buildMocks();
      const comp = createComponent(mocks.injector);
      comp.onRowClick({ id: 'tm-99' });
      expect(mocks.mockRouter.navigate).toHaveBeenCalledWith(['tm-99'], {
        relativeTo: mocks.mockRoute,
      });
    });
  });

  describe('(f) service error sets hasError=true', () => {
    it('should set hasError=true when listTm throws', () => {
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
