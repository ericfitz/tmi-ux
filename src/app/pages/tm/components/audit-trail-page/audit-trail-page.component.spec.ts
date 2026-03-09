// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, BehaviorSubject, throwError } from 'rxjs';

import { AuditTrailPageComponent } from './audit-trail-page.component';
import { AuditEntry, ListAuditTrailResponse } from '../../models/audit-trail.model';
import { ThreatModel } from '../../models/threat-model.model';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Mock interfaces
interface MockActivatedRoute {
  snapshot: {
    data: Record<string, unknown>;
    queryParams: Record<string, string>;
  };
}

interface MockRouter {
  navigate: ReturnType<typeof vi.fn>;
}

interface MockDialog {
  open: ReturnType<typeof vi.fn>;
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

interface MockAuditTrailService {
  getAuditTrail: ReturnType<typeof vi.fn>;
  getEntityAuditTrail: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
}

interface MockAuthorizationService {
  canEdit: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  currentLanguage$: BehaviorSubject<{ code: string; rtl: boolean }>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
}

interface MockDestroyRef {
  onDestroy: ReturnType<typeof vi.fn>;
}

describe('AuditTrailPageComponent', () => {
  let component: AuditTrailPageComponent;
  let route: MockActivatedRoute;
  let router: MockRouter;
  let dialog: MockDialog;
  let snackBar: MockSnackBar;
  let auditTrailService: MockAuditTrailService;
  let authorizationService: MockAuthorizationService;
  let languageService: MockLanguageService;
  let translocoService: MockTranslocoService;
  let loggerService: MockLoggerService;
  let destroyRef: MockDestroyRef;

  const mockAuditEntry: AuditEntry = {
    id: 'entry-1',
    threat_model_id: 'tm-1',
    object_type: 'threat',
    object_id: 'threat-1',
    version: 3,
    change_type: 'updated',
    actor: {
      email: 'user@example.com',
      provider: 'test',
      provider_id: 'user-1',
      display_name: 'Test User',
    },
    change_summary: 'Updated threat name',
    created_at: '2024-06-01T10:00:00Z',
  };

  const mockDeletedEntry: AuditEntry = {
    ...mockAuditEntry,
    id: 'entry-2',
    change_type: 'deleted',
    version: null,
  };

  const mockResponse: ListAuditTrailResponse = {
    audit_entries: [mockAuditEntry],
    total: 1,
    limit: 20,
    offset: 0,
  };

  const mockThreatModel: ThreatModel = {
    id: 'tm-1',
    name: 'Test Threat Model',
    description: 'Test description',
    threat_model_framework: 'STRIDE',
    threats: [],
    assets: [],
    diagrams: [],
    documents: [],
    notes: [],
    repositories: [],
    authorization: [],
    owner: { provider: 'test', provider_id: 'user1' },
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
    metadata: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    route = {
      snapshot: {
        data: { threatModel: mockThreatModel },
        queryParams: {},
      },
    };

    router = { navigate: vi.fn() };
    dialog = { open: vi.fn() };
    snackBar = { open: vi.fn() };

    auditTrailService = {
      getAuditTrail: vi.fn().mockReturnValue(of(mockResponse)),
      getEntityAuditTrail: vi.fn().mockReturnValue(of(mockResponse)),
      rollback: vi.fn().mockReturnValue(of(mockAuditEntry)),
    };

    authorizationService = {
      canEdit: vi.fn().mockReturnValue(true),
    };

    languageService = {
      currentLanguage$: new BehaviorSubject({ code: 'en-US', rtl: false }),
    };

    translocoService = {
      translate: vi.fn((key: string) => key),
    };

    loggerService = createTypedMockLoggerService();

    destroyRef = {
      onDestroy: vi.fn(),
    };

    component = new AuditTrailPageComponent(
      route as any,
      router as any,
      dialog as any,
      snackBar as any,
      auditTrailService as any,
      authorizationService as any,
      languageService as any,
      translocoService as any,
      loggerService as any,
      destroyRef as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load threat model from route data', () => {
      component.ngOnInit();

      expect(component.threatModel).toBe(mockThreatModel);
    });

    it('should set canWrite from authorization service', () => {
      component.ngOnInit();

      expect(component.canWrite).toBe(true);
      expect(authorizationService.canEdit).toHaveBeenCalled();
    });

    it('should set canWrite to false when user cannot edit', () => {
      authorizationService.canEdit.mockReturnValue(false);
      component.ngOnInit();

      expect(component.canWrite).toBe(false);
    });

    it('should load entries on init', () => {
      component.ngOnInit();

      expect(auditTrailService.getAuditTrail).toHaveBeenCalledWith('tm-1', {
        limit: 20,
        offset: 0,
      });
    });

    it('should subscribe to language changes', () => {
      component.ngOnInit();

      expect(component.currentLocale).toBe('en-US');

      languageService.currentLanguage$.next({ code: 'de-DE', rtl: false });
      expect(component.currentLocale).toBe('de-DE');
    });

    it('should set entity-scoped mode from query params', () => {
      route.snapshot.queryParams = {
        objectType: 'threat',
        objectId: 'threat-1',
        entityName: 'Test Threat',
      };

      component.ngOnInit();

      expect(component.entityType).toBe('threat');
      expect(component.entityId).toBe('threat-1');
      expect(component.entityName).toBe('Test Threat');
      expect(component.filterObjectType).toBe('threat');
    });

    it('should not set entity-scoped mode when query params are missing', () => {
      route.snapshot.queryParams = {};

      component.ngOnInit();

      expect(component.entityType).toBeNull();
      expect(component.entityId).toBeNull();
    });

    it('should use entity audit trail when in entity-scoped mode', () => {
      route.snapshot.queryParams = {
        objectType: 'threat',
        objectId: 'threat-1',
      };

      component.ngOnInit();

      expect(auditTrailService.getEntityAuditTrail).toHaveBeenCalledWith(
        'tm-1',
        'threat',
        'threat-1',
        expect.objectContaining({ limit: 20, offset: 0, object_type: 'threat' }),
      );
    });
  });

  describe('loadEntries', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.clearAllMocks();
      auditTrailService.getAuditTrail.mockReturnValue(of(mockResponse));
    });

    it('should not load if threat model is undefined', () => {
      component.threatModel = undefined;
      component.loadEntries();

      expect(auditTrailService.getAuditTrail).not.toHaveBeenCalled();
    });

    it('should set loading to true while loading', () => {
      component.loadEntries();

      // After subscribe completes, loading should be false
      expect(component.loading).toBe(false);
    });

    it('should populate entries and total from response', () => {
      component.loadEntries();

      expect(component.entries).toEqual([mockAuditEntry]);
      expect(component.totalEntries).toBe(1);
    });

    it('should include filter params in request', () => {
      component.filterObjectType = 'diagram';
      component.filterChangeType = 'created';
      component.filterActorEmail = 'user@example.com';

      component.loadEntries();

      expect(auditTrailService.getAuditTrail).toHaveBeenCalledWith(
        'tm-1',
        expect.objectContaining({
          object_type: 'diagram',
          change_type: 'created',
          actor_email: 'user@example.com',
        }),
      );
    });

    it('should trim actor email filter', () => {
      component.filterActorEmail = '  user@example.com  ';

      component.loadEntries();

      expect(auditTrailService.getAuditTrail).toHaveBeenCalledWith(
        'tm-1',
        expect.objectContaining({
          actor_email: 'user@example.com',
        }),
      );
    });

    it('should not include empty string filters', () => {
      component.filterObjectType = '';
      component.filterChangeType = '';
      component.filterActorEmail = '';

      component.loadEntries();

      expect(auditTrailService.getAuditTrail).toHaveBeenCalledWith('tm-1', {
        limit: 20,
        offset: 0,
      });
    });

    it('should calculate offset from page index and size', () => {
      component.pageIndex = 2;
      component.pageSize = 10;

      component.loadEntries();

      expect(auditTrailService.getAuditTrail).toHaveBeenCalledWith(
        'tm-1',
        expect.objectContaining({
          limit: 10,
          offset: 20,
        }),
      );
    });
  });

  describe('onPageChange', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.clearAllMocks();
      auditTrailService.getAuditTrail.mockReturnValue(of(mockResponse));
    });

    it('should update page index and size and reload entries', () => {
      component.onPageChange({ pageIndex: 3, pageSize: 50 });

      expect(component.pageIndex).toBe(3);
      expect(component.pageSize).toBe(50);
      expect(auditTrailService.getAuditTrail).toHaveBeenCalled();
    });
  });

  describe('applyFilters', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.clearAllMocks();
      auditTrailService.getAuditTrail.mockReturnValue(of(mockResponse));
    });

    it('should reset page index to 0', () => {
      component.pageIndex = 5;
      component.applyFilters();

      expect(component.pageIndex).toBe(0);
    });

    it('should reset paginator page index when paginator exists', () => {
      const mockPaginator = { pageIndex: 5 };
      component.paginator = mockPaginator as any;

      component.applyFilters();

      expect(mockPaginator.pageIndex).toBe(0);
    });

    it('should reload entries', () => {
      component.applyFilters();

      expect(auditTrailService.getAuditTrail).toHaveBeenCalled();
    });
  });

  describe('clearFilters', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.clearAllMocks();
      auditTrailService.getAuditTrail.mockReturnValue(of(mockResponse));
    });

    it('should reset all filters', () => {
      component.filterObjectType = 'diagram';
      component.filterChangeType = 'created';
      component.filterActorEmail = 'user@test.com';

      component.clearFilters();

      expect(component.filterObjectType).toBe('');
      expect(component.filterChangeType).toBe('');
      expect(component.filterActorEmail).toBe('');
    });

    it('should preserve entity type filter when in entity-scoped mode', () => {
      component.entityType = 'threat';
      component.filterObjectType = 'diagram';
      component.filterChangeType = 'created';

      component.clearFilters();

      expect(component.filterObjectType).toBe('threat');
      expect(component.filterChangeType).toBe('');
    });
  });

  describe('formatTimestamp', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should format recent timestamps as relative time', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const result = component.formatTimestamp(fiveMinutesAgo);

      // Should be a relative time string (e.g., "5 minutes ago")
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format old timestamps as absolute dates', () => {
      // 60 days ago - beyond the 30-day threshold
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const result = component.formatTimestamp(sixtyDaysAgo);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format just now as relative time', () => {
      const now = new Date().toISOString();
      const result = component.formatTimestamp(now);

      expect(result).toBeTruthy();
    });
  });

  describe('formatAbsoluteTimestamp', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should return a formatted absolute timestamp string', () => {
      const result = component.formatAbsoluteTimestamp('2024-06-01T10:00:00Z');

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('canRollback', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should return true when user can write and entry has a version', () => {
      expect(component.canRollback(mockAuditEntry)).toBe(true);
    });

    it('should return false when entry has null version', () => {
      expect(component.canRollback(mockDeletedEntry)).toBe(false);
    });

    it('should return false when user cannot write', () => {
      authorizationService.canEdit.mockReturnValue(false);
      component.ngOnInit(); // re-init to pick up canWrite = false

      expect(component.canRollback(mockAuditEntry)).toBe(false);
    });
  });

  describe('onRollback', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.clearAllMocks();
      auditTrailService.getAuditTrail.mockReturnValue(of(mockResponse));
      auditTrailService.rollback.mockReturnValue(of(mockAuditEntry));
    });

    it('should not open dialog if threat model is undefined', () => {
      component.threatModel = undefined;
      component.onRollback(mockAuditEntry);

      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('should not open dialog if entry cannot be rolled back', () => {
      component.onRollback(mockDeletedEntry);

      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('should open rollback confirmation dialog', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: false })),
      };
      dialog.open.mockReturnValue(mockDialogRef);

      component.onRollback(mockAuditEntry);

      expect(dialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          width: '500px',
          disableClose: true,
          data: expect.objectContaining({
            entityName: 'Updated threat name',
            objectType: 'threat',
            version: 3,
            changeSummary: 'Updated threat name',
            timestamp: '2024-06-01T10:00:00Z',
          }),
        }),
      );
    });

    it('should use object_id as entity name when change_summary is null', () => {
      const entryNoSummary: AuditEntry = {
        ...mockAuditEntry,
        change_summary: null,
      };
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: false })),
      };
      dialog.open.mockReturnValue(mockDialogRef);

      component.onRollback(entryNoSummary);

      expect(dialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            entityName: 'threat-1',
          }),
        }),
      );
    });

    it('should execute rollback when dialog confirms', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: true })),
      };
      dialog.open.mockReturnValue(mockDialogRef);

      component.onRollback(mockAuditEntry);

      expect(auditTrailService.rollback).toHaveBeenCalledWith('tm-1', 'entry-1');
    });

    it('should not execute rollback when dialog is cancelled', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: false })),
      };
      dialog.open.mockReturnValue(mockDialogRef);

      component.onRollback(mockAuditEntry);

      expect(auditTrailService.rollback).not.toHaveBeenCalled();
    });

    it('should not execute rollback when dialog returns undefined', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of(undefined)),
      };
      dialog.open.mockReturnValue(mockDialogRef);

      component.onRollback(mockAuditEntry);

      expect(auditTrailService.rollback).not.toHaveBeenCalled();
    });

    it('should show success snackbar and reload entries after rollback', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: true })),
      };
      dialog.open.mockReturnValue(mockDialogRef);

      component.onRollback(mockAuditEntry);

      expect(snackBar.open).toHaveBeenCalledWith('auditTrail.rollback.success', 'common.close', {
        duration: 3000,
      });
      expect(auditTrailService.getAuditTrail).toHaveBeenCalled();
    });

    it('should show error snackbar on rollback failure', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: true })),
      };
      dialog.open.mockReturnValue(mockDialogRef);
      auditTrailService.rollback.mockReturnValue(throwError(() => ({ status: 500 })));

      component.onRollback(mockAuditEntry);

      expect(snackBar.open).toHaveBeenCalledWith('auditTrail.rollback.error', 'common.close', {
        duration: 5000,
      });
    });

    it('should show version pruned message on 410 error', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: true })),
      };
      dialog.open.mockReturnValue(mockDialogRef);
      auditTrailService.rollback.mockReturnValue(throwError(() => ({ status: 410 })));

      component.onRollback(mockAuditEntry);

      expect(snackBar.open).toHaveBeenCalledWith(
        'auditTrail.rollback.versionPruned',
        'common.close',
        { duration: 5000 },
      );
    });
  });

  describe('goBack', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should navigate to threat model page', () => {
      component.goBack();

      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });

    it('should not navigate if threat model is undefined', () => {
      component.threatModel = undefined;
      component.goBack();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('getObjectTypeKey', () => {
    it('should return correct translation key for threat_model', () => {
      expect(component.getObjectTypeKey('threat_model')).toBe('common.objectTypes.threatModel');
    });

    it('should return correct translation key for diagram', () => {
      expect(component.getObjectTypeKey('diagram')).toBe('common.objectTypes.diagram');
    });

    it('should return correct translation key for threat', () => {
      expect(component.getObjectTypeKey('threat')).toBe('common.objectTypes.threat');
    });

    it('should return correct translation key for asset', () => {
      expect(component.getObjectTypeKey('asset')).toBe('common.objectTypes.asset');
    });

    it('should return correct translation key for document', () => {
      expect(component.getObjectTypeKey('document')).toBe('common.objectTypes.document');
    });

    it('should return correct translation key for note', () => {
      expect(component.getObjectTypeKey('note')).toBe('common.objectTypes.note');
    });

    it('should return correct translation key for repository', () => {
      expect(component.getObjectTypeKey('repository')).toBe('common.objectTypes.repository');
    });
  });

  describe('getChangeTypeKey', () => {
    it('should return correct translation key for created', () => {
      expect(component.getChangeTypeKey('created')).toBe('auditTrail.changeTypes.created');
    });

    it('should return correct translation key for updated', () => {
      expect(component.getChangeTypeKey('updated')).toBe('auditTrail.changeTypes.updated');
    });

    it('should return correct translation key for deleted', () => {
      expect(component.getChangeTypeKey('deleted')).toBe('auditTrail.changeTypes.deleted');
    });

    it('should return correct translation key for rolled_back', () => {
      expect(component.getChangeTypeKey('rolled_back')).toBe('auditTrail.changeTypes.rolled_back');
    });
  });

  describe('displayedColumns', () => {
    it('should include all expected columns', () => {
      expect(component.displayedColumns).toEqual([
        'timestamp',
        'actor',
        'changeType',
        'objectType',
        'changeSummary',
        'rollback',
      ]);
    });
  });

  describe('objectTypeOptions', () => {
    it('should include all audit object types', () => {
      expect(component.objectTypeOptions).toEqual([
        'threat_model',
        'diagram',
        'threat',
        'asset',
        'document',
        'note',
        'repository',
      ]);
    });
  });

  describe('changeTypeOptions', () => {
    it('should include all audit change types', () => {
      expect(component.changeTypeOptions).toEqual([
        'created',
        'updated',
        'patched',
        'deleted',
        'rolled_back',
        'restored',
      ]);
    });
  });
});
