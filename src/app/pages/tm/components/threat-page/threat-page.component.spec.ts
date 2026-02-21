// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, BehaviorSubject } from 'rxjs';
import { FormBuilder } from '@angular/forms';

import { ThreatPageComponent } from './threat-page.component';
import { ThreatModel, Threat } from '../../models/threat-model.model';
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

  const mockThreat: Threat = {
    id: 'threat-1',
    name: 'Test Threat',
    description: 'Test description',
    severity: 'high',
    threat_type: ['Spoofing'],
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
    metadata: [],
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

    it('should toggle edit mode for issue URI', () => {
      expect(component.isEditingIssueUri).toBe(false);
      component.editIssueUri();
      expect(component.isEditingIssueUri).toBe(true);
    });

    it('should update initial value on blur', () => {
      component.threatForm.get('issue_uri')?.setValue('https://example.com');
      component.onIssueUriBlur();
      expect(component.initialIssueUriValue).toBe('https://example.com');
      expect(component.isEditingIssueUri).toBe(false);
    });

    it('should show hyperlink when not editing and has value', () => {
      component.initialIssueUriValue = 'https://example.com';
      component.isEditingIssueUri = false;
      expect(component.shouldShowIssueUriHyperlink()).toBe(true);
    });

    it('should not show hyperlink when editing', () => {
      component.initialIssueUriValue = 'https://example.com';
      component.isEditingIssueUri = true;
      expect(component.shouldShowIssueUriHyperlink()).toBe(false);
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
