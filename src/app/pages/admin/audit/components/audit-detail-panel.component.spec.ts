import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { ChangeDetectorRef, DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { AuditDetailPanelComponent } from './audit-detail-panel.component';
import { createTypedMockLoggerService, createTypedMockRouter } from '@testing/mocks';
import type { MockLoggerService, MockRouter } from '@testing/mocks';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminAuditService } from '@app/pages/admin/audit/admin-audit.service';
import type { AuditEntry, SystemAuditEntry } from '@app/pages/admin/audit/models/admin-audit.model';

// ── Fixture data ──────────────────────────────────────────────────────────────

const SYSTEM_ENTRY: SystemAuditEntry = {
  id: 'sys-1',
  actor: {
    email: 'admin@example.com',
    provider: 'google',
    provider_id: 'goog-123',
    display_name: 'Admin User',
  },
  http_method: 'PATCH',
  http_path: '/admin/users/42',
  field_path: 'role',
  old_value_redacted: 'viewer',
  new_value_redacted: 'admin',
  change_summary: 'Role changed',
  created_at: '2026-01-01T12:00:00Z',
};

const TM_ENTRY: AuditEntry = {
  id: 'tm-1',
  threat_model_id: 'tm-uuid-999',
  object_type: 'diagram',
  object_id: 'diag-5',
  version: 3,
  change_type: 'updated',
  actor: {
    email: 'user@example.com',
    provider: 'local',
    provider_id: 'local-7',
    display_name: 'Regular User',
  },
  change_summary: 'Updated diagram',
  created_at: '2026-02-15T08:30:00Z',
};

// ── Shared mock setup helpers ─────────────────────────────────────────────────

function buildMocks(
  options: {
    stream?: 'system' | 'tm';
    entryId?: string;
    systemEntry?: SystemAuditEntry | null;
    tmEntry?: AuditEntry | null;
    systemError?: unknown;
    tmError?: unknown;
  } = {},
): {
  injector: Injector;
  paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  mockRoute: {
    snapshot: { data: Record<string, unknown> };
    paramMap: ReturnType<typeof BehaviorSubject.prototype.asObservable>;
  };
  mockRouter: MockRouter;
  mockAuditService: Partial<AdminAuditService>;
  mockLogger: MockLoggerService;
} {
  const stream = options.stream ?? 'system';
  const entryId = options.entryId ?? 'sys-1';

  const paramMapSubject = new BehaviorSubject(convertToParamMap({ entryId }));

  const mockRoute = {
    snapshot: { data: { stream } },
    paramMap: paramMapSubject.asObservable(),
  };

  const mockRouter = createTypedMockRouter('/admin/audit/system/sys-1') as MockRouter;
  const mockLogger = createTypedMockLoggerService();

  const mockAuditService: Partial<AdminAuditService> = {
    getSystemEntry: options.systemError
      ? vi.fn().mockReturnValue(throwError(() => options.systemError))
      : vi.fn().mockReturnValue(of(options.systemEntry ?? SYSTEM_ENTRY)),
    getTmEntry: options.tmError
      ? vi.fn().mockReturnValue(throwError(() => options.tmError))
      : vi.fn().mockReturnValue(of(options.tmEntry ?? TM_ENTRY)),
  };

  const mockDestroyRef = { onDestroy: vi.fn() };
  const mockCdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };

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

  return { injector, paramMapSubject, mockRoute, mockRouter, mockAuditService, mockLogger };
}

function createComponent(injector: Injector): AuditDetailPanelComponent {
  const comp = runInInjectionContext(injector, () => new AuditDetailPanelComponent());
  comp.ngOnInit();
  return comp;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditDetailPanelComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('(a) stream=system calls getSystemEntry and exposes the entry', () => {
    let comp: AuditDetailPanelComponent;
    let mocks: ReturnType<typeof buildMocks>;

    beforeEach(() => {
      mocks = buildMocks({ stream: 'system', entryId: 'sys-1' });
      comp = createComponent(mocks.injector);
    });

    it('should create the component', () => {
      expect(comp).toBeTruthy();
    });

    it('should call getSystemEntry with the entryId from paramMap', () => {
      expect(mocks.mockAuditService.getSystemEntry).toHaveBeenCalledWith('sys-1');
    });

    it('should NOT call getTmEntry for system stream', () => {
      expect(mocks.mockAuditService.getTmEntry).not.toHaveBeenCalled();
    });

    it('should set entry to the resolved SystemAuditEntry', () => {
      expect(comp.entry).toEqual(SYSTEM_ENTRY);
    });

    it('should set loading to false after the entry is loaded', () => {
      expect(comp.loading).toBe(false);
    });

    it('should expose stream as system', () => {
      expect(comp.stream).toBe('system');
    });

    it('should expose systemEntry getter returning the typed entry', () => {
      expect(comp.systemEntry).toEqual(SYSTEM_ENTRY);
    });

    it('should have notFound=false when entry loads successfully', () => {
      expect(comp.notFound).toBe(false);
    });
  });

  describe('(b) stream=tm calls getTmEntry and exposes the entry', () => {
    let comp: AuditDetailPanelComponent;
    let mocks: ReturnType<typeof buildMocks>;

    beforeEach(() => {
      mocks = buildMocks({ stream: 'tm', entryId: 'tm-1' });
      comp = createComponent(mocks.injector);
    });

    it('should call getTmEntry with the entryId from paramMap', () => {
      expect(mocks.mockAuditService.getTmEntry).toHaveBeenCalledWith('tm-1');
    });

    it('should NOT call getSystemEntry for tm stream', () => {
      expect(mocks.mockAuditService.getSystemEntry).not.toHaveBeenCalled();
    });

    it('should set entry to the resolved AuditEntry', () => {
      expect(comp.entry).toEqual(TM_ENTRY);
    });

    it('should expose tmEntry getter returning the typed entry', () => {
      expect(comp.tmEntry).toEqual(TM_ENTRY);
    });
  });

  describe('(c) re-fetches when paramMap emits a new entryId', () => {
    it('should re-fetch when paramMap emits a second entryId', () => {
      const SECOND_ENTRY: SystemAuditEntry = { ...SYSTEM_ENTRY, id: 'sys-2' };
      const mocks = buildMocks({ stream: 'system', entryId: 'sys-1' });

      // Override the mock to return different entries per call
      let callCount = 0;
      (mocks.mockAuditService.getSystemEntry as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return of(callCount === 1 ? SYSTEM_ENTRY : SECOND_ENTRY);
      });

      const comp = createComponent(mocks.injector);

      // First fetch
      expect(comp.entry).toEqual(SYSTEM_ENTRY);

      // Emit a new paramMap with a different entryId
      mocks.paramMapSubject.next(convertToParamMap({ entryId: 'sys-2' }));

      expect(mocks.mockAuditService.getSystemEntry).toHaveBeenCalledWith('sys-2');
      expect(comp.entry).toEqual(SECOND_ENTRY);
    });
  });

  describe('(d) copyPermalink() writes to clipboard', () => {
    it('should call navigator.clipboard.writeText with the permalink URL', () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText: writeTextMock } });
      vi.stubGlobal('window', {
        location: { origin: 'https://app.example.com' },
      });

      const mocks = buildMocks({ stream: 'system', entryId: 'sys-1' });
      // router.url is set to '/admin/audit/system/sys-1' from createTypedMockRouter
      const comp = createComponent(mocks.injector);

      comp.copyPermalink();

      expect(writeTextMock).toHaveBeenCalledWith(
        'https://app.example.com/admin/audit/system/sys-1',
      );
    });

    it('should set copied=true after calling copyPermalink()', () => {
      vi.stubGlobal('navigator', {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });
      vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });

      const mocks = buildMocks({ stream: 'system', entryId: 'sys-1' });
      const comp = createComponent(mocks.injector);

      comp.copyPermalink();
      expect(comp.copied).toBe(true);
    });
  });

  describe('(e) viewInContext() navigates with around queryParam', () => {
    it('should call router.navigate with around=entryId', () => {
      const mocks = buildMocks({ stream: 'system', entryId: 'sys-1' });
      const comp = createComponent(mocks.injector);

      comp.viewInContext();

      expect(mocks.mockRouter.navigate).toHaveBeenCalledWith(['../'], {
        relativeTo: mocks.mockRoute,
        queryParams: { around: 'sys-1' },
      });
    });
  });

  describe('close()', () => {
    it('should call router.navigate to parent without queryParams', () => {
      const mocks = buildMocks({ stream: 'system', entryId: 'sys-1' });
      const comp = createComponent(mocks.injector);

      comp.close();

      expect(mocks.mockRouter.navigate).toHaveBeenCalledWith(['../'], {
        relativeTo: mocks.mockRoute,
      });
    });
  });

  describe('(f) 404 error sets notFound=true', () => {
    it('should set notFound=true when getSystemEntry throws a 404 HttpErrorResponse', () => {
      const notFoundError = new HttpErrorResponse({ status: 404 });
      const mocks = buildMocks({ stream: 'system', systemError: notFoundError });

      const comp = createComponent(mocks.injector);

      expect(comp.notFound).toBe(true);
      expect(comp.entry).toBeNull();
    });

    it('should set notFound=true when getTmEntry throws a 404 HttpErrorResponse', () => {
      const notFoundError = new HttpErrorResponse({ status: 404 });
      const mocks = buildMocks({ stream: 'tm', tmError: notFoundError });

      const comp = createComponent(mocks.injector);

      expect(comp.notFound).toBe(true);
      expect(comp.entry).toBeNull();
    });

    it('should set notFound=true and log for non-404 errors', () => {
      const serverError = new HttpErrorResponse({ status: 500 });
      const mocks = buildMocks({ stream: 'system', systemError: serverError });

      const comp = createComponent(mocks.injector);

      expect(comp.notFound).toBe(true);
      expect(mocks.mockLogger.error).toHaveBeenCalled();
    });
  });
});
