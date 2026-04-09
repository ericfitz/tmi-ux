// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, BehaviorSubject } from 'rxjs';
import { FormBuilder } from '@angular/forms';

import { ThreatPageComponent } from './threat-page.component';
import { CVSSScore, ThreatModel, Threat } from '../../models/threat-model.model';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../../testing/mocks';

// Mock interfaces
interface MockActivatedRoute {
  snapshot: {
    paramMap: {
      get: ReturnType<typeof vi.fn>;
    };
    data: Record<string, unknown>;
  };
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

interface MockDialog {
  open: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  currentLanguage$: BehaviorSubject<{ code: string; rtl: boolean }>;
  direction$: BehaviorSubject<'ltr' | 'rtl'>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
  getActiveLang: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
}

interface MockThreatModelService {
  updateThreat: ReturnType<typeof vi.fn>;
  deleteThreat: ReturnType<typeof vi.fn>;
}

interface MockAuthorizationService {
  canEdit$: BehaviorSubject<boolean>;
}

interface MockCellDataExtractionService {
  extractFromThreatModel: ReturnType<typeof vi.fn>;
}

interface MockFrameworkService {
  loadAllFrameworks: ReturnType<typeof vi.fn>;
}

interface MockAddonService {
  list: ReturnType<typeof vi.fn>;
}

interface MockCweService {
  loadWeaknesses: ReturnType<typeof vi.fn>;
}

describe('ThreatPageComponent', () => {
  let component: ThreatPageComponent;
  let route: MockActivatedRoute;
  let router: MockRouter;
  let fb: FormBuilder;
  let snackBar: MockSnackBar;
  let dialog: MockDialog;
  let loggerService: MockLoggerService;
  let languageService: MockLanguageService;
  let translocoService: MockTranslocoService;
  let threatModelService: MockThreatModelService;
  let authorizationService: MockAuthorizationService;
  let cellDataExtractionService: MockCellDataExtractionService;
  let frameworkService: MockFrameworkService;
  let addonService: MockAddonService;
  let cweService: MockCweService;

  const mockThreat: Threat = {
    id: 'threat-1',
    name: 'Test Threat',
    description: 'Test description',
    severity: 'high',
    threat_type: ['Spoofing'],
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
    metadata: [],
    cwe_id: ['CWE-79', 'CWE-89'],
    cvss: [{ vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', score: 9.8 }],
  };

  const mockThreatModel: ThreatModel = {
    id: 'tm-1',
    name: 'Test Threat Model',
    description: 'Test description',
    threat_model_framework: 'STRIDE',
    threats: [mockThreat],
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
        paramMap: {
          get: vi.fn((key: string) => {
            if (key === 'id') return 'tm-1';
            if (key === 'threatId') return 'threat-1';
            return null;
          }),
        },
        data: {
          threatModel: mockThreatModel,
        },
      },
    };

    router = createTypedMockRouter();
    fb = new FormBuilder();
    snackBar = { open: vi.fn() };
    dialog = { open: vi.fn() };
    loggerService = createTypedMockLoggerService();
    languageService = {
      currentLanguage$: new BehaviorSubject({ code: 'en-US', rtl: false }),
      direction$: new BehaviorSubject('ltr' as const),
    };
    translocoService = {
      translate: vi.fn((key: string) => key),
      getActiveLang: vi.fn().mockReturnValue('en-US'),
      load: vi.fn().mockReturnValue(of({})),
    };
    threatModelService = {
      updateThreat: vi.fn().mockReturnValue(of(mockThreat)),
      deleteThreat: vi.fn().mockReturnValue(of(true)),
    };
    authorizationService = {
      canEdit$: new BehaviorSubject(true),
    };
    cellDataExtractionService = {
      extractFromThreatModel: vi.fn().mockReturnValue({ diagrams: [], cells: [] }),
    };
    frameworkService = {
      loadAllFrameworks: vi.fn().mockReturnValue(
        of([
          {
            name: 'STRIDE',
            threatTypes: [
              { name: 'Spoofing', appliesTo: [] },
              { name: 'Tampering', appliesTo: [] },
            ],
          },
        ]),
      ),
    };
    addonService = {
      list: vi.fn().mockReturnValue(of({ addons: [], total: 0, limit: 0, offset: 0 })),
    };
    cweService = {
      loadWeaknesses: vi.fn().mockReturnValue(of([])),
    };

    component = new ThreatPageComponent(
      route as any,
      router as any,
      fb,
      snackBar as any,
      dialog as any,
      loggerService as any,
      languageService as any,
      translocoService as any,
      threatModelService as any,
      authorizationService as any,
      cellDataExtractionService as any,
      frameworkService as any,
      addonService as any,
      cweService as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load threat model and threat from route data', () => {
      component.ngOnInit();

      expect(component.threatModelId).toBe('tm-1');
      expect(component.threatId).toBe('threat-1');
      expect(component.threatModel).toBe(mockThreatModel);
      expect(component.threat).toBe(mockThreat);
    });

    it('should navigate to dashboard if threat model is not found', () => {
      route.snapshot.data = {};
      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should navigate to threat model page if threat is not found', () => {
      route.snapshot.data = {
        threatModel: { ...mockThreatModel, threats: [] },
      };
      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1'], {
        queryParams: { error: 'threat_not_found' },
      });
    });

    it('should subscribe to canEdit$ and update form editability', () => {
      component.ngOnInit();
      expect(component.canEdit).toBe(true);

      authorizationService.canEdit$.next(false);
      expect(component.canEdit).toBe(false);
    });
  });

  describe('save', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should not save if form is invalid', () => {
      component.threatForm.get('name')?.setValue('');
      component.save();
      expect(threatModelService.updateThreat).not.toHaveBeenCalled();
    });

    it('should not save if user cannot edit', () => {
      authorizationService.canEdit$.next(false);
      component.threatForm.markAsDirty();
      component.save();
      expect(threatModelService.updateThreat).not.toHaveBeenCalled();
    });

    it('should save threat and navigate back on success', () => {
      component.threatForm.markAsDirty();
      component.save();

      expect(threatModelService.updateThreat).toHaveBeenCalledWith(
        'tm-1',
        'threat-1',
        expect.objectContaining({ name: 'Test Threat' }),
      );
      expect(snackBar.open).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });
  });

  describe('deleteThreat', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should not delete if user cannot edit', () => {
      authorizationService.canEdit$.next(false);
      component.deleteThreat();
      expect(dialog.open).not.toHaveBeenCalled();
      expect(threatModelService.deleteThreat).not.toHaveBeenCalled();
    });

    it('should delete threat and navigate back when confirmed', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: true })),
      };
      dialog.open = vi.fn().mockReturnValue(mockDialogRef);

      component.deleteThreat();

      expect(dialog.open).toHaveBeenCalled();
      expect(threatModelService.deleteThreat).toHaveBeenCalledWith('tm-1', 'threat-1');
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });

    it('should not delete when user cancels confirmation', () => {
      const mockDialogRef = {
        afterClosed: vi.fn().mockReturnValue(of({ confirmed: false })),
      };
      dialog.open = vi.fn().mockReturnValue(mockDialogRef);

      component.deleteThreat();

      expect(dialog.open).toHaveBeenCalled();
      expect(threatModelService.deleteThreat).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should navigate back immediately if form is not dirty', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });

    it('should prompt for confirmation if form is dirty', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      component.threatForm.markAsDirty();
      component.cancel();

      expect(window.confirm).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });

    it('should not navigate if user cancels confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      component.threatForm.markAsDirty();
      component.cancel();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('navigateBack', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should navigate to threat model page', () => {
      component.navigateBack();
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-1']);
    });
  });

  describe('issue URI helpers', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should validate a valid URL', () => {
      expect(component.isValidUrl('https://example.com')).toBe(true);
      expect(component.isValidUrl('http://example.com/issue/123')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(component.isValidUrl('')).toBe(false);
      expect(component.isValidUrl('not-a-url')).toBe(false);
      expect(component.isValidUrl('   ')).toBe(false);
    });

    it('should open valid URI in new tab', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      component.openUriInNewTab('https://example.com');
      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
      openSpy.mockRestore();
    });

    it('should not open invalid URI in new tab', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      component.openUriInNewTab('not-a-url');
      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });
  });

  describe('CWE ID management', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should populate CWE IDs from threat data', () => {
      expect(component.threatForm.get('cwe_id')?.value).toEqual(['CWE-79', 'CWE-89']);
    });

    it('should open CWE picker dialog', () => {
      const mockAfterClosed = { subscribe: vi.fn() };
      dialog.open.mockReturnValue({ afterClosed: () => ({ pipe: () => mockAfterClosed }) });

      component.openCwePicker();

      expect(dialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            existingCweIds: ['CWE-79', 'CWE-89'],
          }),
        }),
      );
    });

    it('should remove a CWE ID', () => {
      component.removeCweId('CWE-79');

      expect(component.threatForm.get('cwe_id')?.value).not.toContain('CWE-79');
      expect(component.threatForm.get('cwe_id')?.value).toContain('CWE-89');
    });

    it('should not remove a CWE ID that does not exist', () => {
      component.removeCweId('CWE-999');

      expect(component.threatForm.get('cwe_id')?.value).toEqual(['CWE-79', 'CWE-89']);
    });

    it('should mark form dirty when removing a CWE ID', () => {
      component.threatForm.markAsPristine();
      component.removeCweId('CWE-79');

      expect(component.threatForm.dirty).toBe(true);
    });

    it('should return CWE name from map via getCweName', () => {
      component['cweNameMap'].set('CWE-79', 'Improper Neutralization of Input');
      expect(component.getCweName('CWE-79')).toBe('Improper Neutralization of Input');
    });

    it('should return CWE ID as fallback when name not in map', () => {
      expect(component.getCweName('CWE-999')).toBe('CWE-999');
    });
  });

  describe('CVSS entry management', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should populate CVSS entries from threat data', () => {
      const cvssValues = component.threatForm.get('cvss')?.value as CVSSScore[];
      expect(cvssValues).toHaveLength(1);
      expect(cvssValues[0].vector).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
      expect(cvssValues[0].score).toBe(9.8);
    });

    it('should open CVSS calculator dialog with existing versions', () => {
      const mockAfterClosed = { subscribe: vi.fn() };
      dialog.open.mockReturnValue({ afterClosed: () => ({ pipe: () => mockAfterClosed }) });

      component.openCvssCalculator();

      expect(dialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            existingVersions: ['3.1'],
          }),
        }),
      );
    });

    it('canAddCvss should be true when only one version exists', () => {
      expect(component.canAddCvss).toBe(true);
    });

    it('canAddCvss should be false when both versions exist', () => {
      const current = component.threatForm.get('cvss')?.value as CVSSScore[];
      component.threatForm.patchValue({
        cvss: [
          ...current,
          {
            vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
            score: 9.3,
          },
        ],
      });
      expect(component.canAddCvss).toBe(false);
    });

    it('canAddCvss should re-enable after removing all entries of a version', () => {
      const current = component.threatForm.get('cvss')?.value as CVSSScore[];
      component.threatForm.patchValue({
        cvss: [
          ...current,
          {
            vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
            score: 9.3,
          },
        ],
      });
      expect(component.canAddCvss).toBe(false);

      // Remove the 4.0 entry (index 1)
      component.removeCvssEntry(1);
      expect(component.canAddCvss).toBe(true);
    });

    it('should open CVSS calculator dialog for editing', () => {
      const mockAfterClosed = { subscribe: vi.fn() };
      dialog.open.mockReturnValue({ afterClosed: () => ({ pipe: () => mockAfterClosed }) });

      component.editCvssEntry(0);

      expect(dialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            existingEntry: expect.objectContaining({
              vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
            }),
            existingIndex: 0,
          }),
        }),
      );
    });

    it('should not edit with invalid index', () => {
      component.editCvssEntry(5);
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('should remove a CVSS entry by index', () => {
      component.removeCvssEntry(0);

      const cvssValues = component.threatForm.get('cvss')?.value as CVSSScore[];
      expect(cvssValues).toHaveLength(0);
    });

    it('should not remove with invalid index', () => {
      component.removeCvssEntry(5);

      const cvssValues = component.threatForm.get('cvss')?.value as CVSSScore[];
      expect(cvssValues).toHaveLength(1);
    });

    it('should mark form dirty when removing a CVSS entry', () => {
      component.threatForm.markAsPristine();
      component.removeCvssEntry(0);

      expect(component.threatForm.dirty).toBe(true);
    });
  });

  describe('save with CWE and CVSS', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should include cwe_id and cvss in save payload', () => {
      component.threatForm.markAsDirty();
      component.save();

      expect(threatModelService.updateThreat).toHaveBeenCalledWith(
        'tm-1',
        'threat-1',
        expect.objectContaining({
          cwe_id: ['CWE-79', 'CWE-89'],
          cvss: [{ vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', score: 9.8 }],
        }),
      );
    });

    it('should send empty array for empty cwe_id array', () => {
      component.threatForm.patchValue({ cwe_id: [] });
      component.threatForm.markAsDirty();
      component.save();

      expect(threatModelService.updateThreat).toHaveBeenCalledWith(
        'tm-1',
        'threat-1',
        expect.objectContaining({
          cwe_id: [],
        }),
      );
    });

    it('should send empty array for empty cvss array', () => {
      component.threatForm.patchValue({ cvss: [] });
      component.threatForm.markAsDirty();
      component.save();

      expect(threatModelService.updateThreat).toHaveBeenCalledWith(
        'tm-1',
        'threat-1',
        expect.objectContaining({
          cvss: [],
        }),
      );
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe from diagram change subscription', () => {
      component.ngOnInit();
      // Set up a mock subscription
      const mockSubscription = { unsubscribe: vi.fn() };
      component['diagramChangeSubscription'] = mockSubscription as any;

      component.ngOnDestroy();

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });
});
