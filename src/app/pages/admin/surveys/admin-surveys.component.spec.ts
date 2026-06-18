import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, ElementRef, Injector, runInInjectionContext } from '@angular/core';

import { AdminSurveysComponent } from './admin-surveys.component';
import { SurveyListItem } from '@app/types/survey.types';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../testing/mocks';

interface MockSurveyService {
  listAdmin: ReturnType<typeof vi.fn>;
  deleteSurvey: ReturnType<typeof vi.fn>;
  clone: ReturnType<typeof vi.fn>;
  setStatus: ReturnType<typeof vi.fn>;
  archive: ReturnType<typeof vi.fn>;
  unarchive: ReturnType<typeof vi.fn>;
  patchField: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
}

interface MockDialog {
  open: ReturnType<typeof vi.fn>;
}

interface MockChangeDetectorRef {
  markForCheck: ReturnType<typeof vi.fn>;
}

interface MockAuthService {
  isAdmin: boolean;
}

// SEM@96c34d433bdf8694a9679b9d7e88dddcc1d5563f: build a stub SurveyListItem with default values and optional overrides (pure)
const createMockTemplate = (overrides?: Partial<SurveyListItem>): SurveyListItem => ({
  id: 'survey-1',
  name: 'Test Survey',
  description: 'A test survey',
  version: '1.0',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-02T00:00:00Z',
  ...overrides,
});

describe('AdminSurveysComponent - Delete', () => {
  let component: AdminSurveysComponent;
  let mockSurveyService: MockSurveyService;
  let mockSnackBar: MockSnackBar;
  let mockTransloco: MockTranslocoService;
  let mockLogger: MockLoggerService;
  let mockRouter: MockRouter;
  let mockDialog: MockDialog;
  let mockCdr: MockChangeDetectorRef;
  let mockAuthService: MockAuthService;

  beforeEach(() => {
    mockSurveyService = {
      listAdmin: vi.fn().mockReturnValue(of({ surveys: [] })),
      deleteSurvey: vi.fn(),
      clone: vi.fn(),
      setStatus: vi.fn(),
      archive: vi.fn(),
      unarchive: vi.fn(),
      patchField: vi.fn(),
      create: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockTransloco = {
      translate: vi.fn((key: string) => key),
    };

    mockLogger = createTypedMockLoggerService();
    mockRouter = createTypedMockRouter();
    mockDialog = { open: vi.fn() };
    mockCdr = { markForCheck: vi.fn() };
    mockAuthService = { isAdmin: true };

    const mockElementRef = { nativeElement: document.createElement('div') };
    const mockDestroyRef = { onDestroy: vi.fn() };
    const injector = Injector.create({
      providers: [
        { provide: ElementRef, useValue: mockElementRef },
        { provide: DestroyRef, useValue: mockDestroyRef },
      ],
    });
    component = runInInjectionContext(injector, () => {
      return new AdminSurveysComponent(
        mockAuthService as never,
        mockSurveyService as never,
        mockRouter as never,
        mockDialog as never,
        mockLogger as never,
        mockCdr as never,
        mockTransloco as never,
        mockSnackBar as never,
      );
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('deleteTemplate', () => {
    it('should call deleteSurvey and reload list on confirm', () => {
      const template = createMockTemplate();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );
      mockSurveyService.deleteSurvey.mockReturnValue(of(undefined));

      component.deleteTemplate(template);

      expect(mockSurveyService.deleteSurvey).toHaveBeenCalledWith('survey-1');
      expect(mockSurveyService.listAdmin).toHaveBeenCalled();
    });

    it('should not call deleteSurvey when confirm is cancelled', () => {
      const template = createMockTemplate();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      component.deleteTemplate(template);

      expect(mockSurveyService.deleteSurvey).not.toHaveBeenCalled();
    });

    it('should show snackbar on delete error', () => {
      const template = createMockTemplate();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );
      mockSurveyService.deleteSurvey.mockReturnValue(throwError(() => new Error('Server error')));

      component.deleteTemplate(template);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete survey', expect.anything());
      expect(mockSnackBar.open).toHaveBeenCalledWith('adminSurveys.deleteError', 'common.dismiss', {
        duration: 5000,
      });
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });

    it('should show conflict message on 409 error', () => {
      const template = createMockTemplate();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );
      const conflictError = new HttpErrorResponse({
        status: 409,
        statusText: 'Conflict',
        error: {
          error: 'conflict',
          error_description: 'Cannot delete survey with existing responses',
        },
      });
      mockSurveyService.deleteSurvey.mockReturnValue(throwError(() => conflictError));

      component.deleteTemplate(template);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot delete survey with existing responses',
        expect.anything(),
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'adminSurveys.deleteConflict',
        'common.dismiss',
        {
          duration: 8000,
        },
      );
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });

    it('should use transloco to build confirmation message', () => {
      const template = createMockTemplate({ name: 'My Survey' });
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      component.deleteTemplate(template);

      expect(mockTransloco.translate).toHaveBeenCalledWith('common.objectTypes.survey');
      expect(mockTransloco.translate).toHaveBeenCalledWith('common.confirmDelete', {
        item: 'common.objectTypes.survey',
        name: 'My Survey',
      });
    });
  });
});

describe('AdminSurveysComponent - Filters and inline editing', () => {
  let component: AdminSurveysComponent;
  let mockSurveyService: MockSurveyService;
  let mockSnackBar: MockSnackBar;
  let mockTransloco: MockTranslocoService;
  let mockLogger: MockLoggerService;
  let mockRouter: MockRouter;
  let mockDialog: MockDialog;
  let mockCdr: MockChangeDetectorRef;
  let mockAuthService: MockAuthService & { getLandingPage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSurveyService = {
      listAdmin: vi.fn().mockReturnValue(of({ surveys: [] })),
      deleteSurvey: vi.fn(),
      clone: vi.fn(),
      setStatus: vi.fn(),
      archive: vi.fn(),
      unarchive: vi.fn(),
      patchField: vi.fn(() => of({})),
      create: vi.fn(),
    };
    mockSnackBar = { open: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) };
    mockLogger = createTypedMockLoggerService();
    mockRouter = createTypedMockRouter();
    mockDialog = { open: vi.fn() };
    mockCdr = { markForCheck: vi.fn() };
    mockAuthService = { isAdmin: true, getLandingPage: vi.fn(() => '/home') };

    const mockElementRef = { nativeElement: document.createElement('div') };
    const mockDestroyRef = { onDestroy: vi.fn() };
    const injector = Injector.create({
      providers: [
        { provide: ElementRef, useValue: mockElementRef },
        { provide: DestroyRef, useValue: mockDestroyRef },
      ],
    });
    component = runInInjectionContext(injector, () => {
      return new AdminSurveysComponent(
        mockAuthService as never,
        mockSurveyService as never,
        mockRouter as never,
        mockDialog as never,
        mockLogger as never,
        mockCdr as never,
        mockTransloco as never,
        mockSnackBar as never,
      );
    });

    component.templates = [
      createMockTemplate({ id: 's1', name: 'Onboarding Survey', status: 'active' }),
      createMockTemplate({ id: 's2', name: 'Exit Interview', status: 'archived' }),
      createMockTemplate({
        id: 's3',
        name: 'Risk Review',
        description: 'security questionnaire',
        status: 'active',
      }),
    ];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('applyFilters', () => {
    it('shows all templates when no filter is set', () => {
      component.statusFilter = [];
      component.searchText = '';

      component.applyFilters();

      expect(component.dataSource.data).toHaveLength(3);
    });

    it('hides archived surveys with the default status filter', () => {
      // The component's constructed default is ['active', 'inactive'] — the
      // on-load behavior excludes archived surveys.
      component.searchText = '';

      component.applyFilters();

      expect(component.dataSource.data.map(t => t.id)).toEqual(['s1', 's3']);
    });

    it('filters by status', () => {
      component.statusFilter = ['archived'];
      component.searchText = '';

      component.applyFilters();

      expect(component.dataSource.data.map(t => t.id)).toEqual(['s2']);
    });

    it('filters by a case-insensitive name search', () => {
      component.statusFilter = [];
      component.searchText = 'risk';

      component.applyFilters();

      expect(component.dataSource.data.map(t => t.id)).toEqual(['s3']);
    });

    it('matches the search against the description too', () => {
      component.statusFilter = [];
      component.searchText = 'security';

      component.applyFilters();

      expect(component.dataSource.data.map(t => t.id)).toEqual(['s3']);
    });

    it('combines the status and search filters', () => {
      component.statusFilter = ['active'];
      component.searchText = 'survey';

      component.applyFilters();

      expect(component.dataSource.data.map(t => t.id)).toEqual(['s1']);
    });
  });

  describe('clearSearch', () => {
    it('clears the search text and re-applies the filters', () => {
      component.statusFilter = [];
      component.searchText = 'risk';
      component.applyFilters();
      expect(component.dataSource.data).toHaveLength(1);

      component.clearSearch();

      // Search is cleared; with no status filter, all templates show again.
      expect(component.searchText).toBe('');
      expect(component.dataSource.data).toHaveLength(3);
    });
  });

  describe('inline editing', () => {
    it('startInlineEdit records the cell and original value', () => {
      const tpl = component.templates[0];
      const event = { stopPropagation: vi.fn() } as unknown as Event;

      component.startInlineEdit(tpl, 'name', event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.isEditing('s1', 'name')).toBe(true);
      expect(component.isEditing('s1', 'version')).toBe(false);
    });

    it('saveInlineEdit patches the changed field and clears the editing cell', () => {
      const tpl = component.templates[0];
      component.startInlineEdit(tpl, 'name', { stopPropagation: vi.fn() } as unknown as Event);

      component.saveInlineEdit(tpl, 'name', '  Renamed Survey  ');

      expect(tpl.name).toBe('Renamed Survey');
      expect(mockSurveyService.patchField).toHaveBeenCalledWith('s1', 'name', 'Renamed Survey');
      expect(component.isEditing('s1', 'name')).toBe(false);
    });

    it('saveInlineEdit cancels when the value is unchanged', () => {
      const tpl = component.templates[0];
      component.startInlineEdit(tpl, 'name', { stopPropagation: vi.fn() } as unknown as Event);

      component.saveInlineEdit(tpl, 'name', tpl.name);

      expect(mockSurveyService.patchField).not.toHaveBeenCalled();
    });

    it('cancelInlineEdit restores the original value', () => {
      const tpl = component.templates[0];
      const original = tpl.name;
      component.startInlineEdit(tpl, 'name', { stopPropagation: vi.fn() } as unknown as Event);
      tpl.name = 'half-typed';

      component.cancelInlineEdit(tpl);

      expect(tpl.name).toBe(original);
      expect(component.isEditing('s1', 'name')).toBe(false);
    });

    it('onInlineEditKeydown saves on Enter and cancels on Escape', () => {
      const tpl = component.templates[0];
      component.startInlineEdit(tpl, 'name', { stopPropagation: vi.fn() } as unknown as Event);

      const enter = {
        key: 'Enter',
        preventDefault: vi.fn(),
        target: { value: 'New Name' },
      } as unknown as KeyboardEvent;
      component.onInlineEditKeydown(enter, tpl, 'name');
      expect(tpl.name).toBe('New Name');

      component.startInlineEdit(tpl, 'name', { stopPropagation: vi.fn() } as unknown as Event);
      const escape = { key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      component.onInlineEditKeydown(escape, tpl, 'name');
      expect(component.isEditing('s1', 'name')).toBe(false);
    });
  });

  describe('getStatusIcon', () => {
    it('maps each survey status to its icon', () => {
      expect(component.getStatusIcon('active')).toBe('check_circle');
      expect(component.getStatusIcon('inactive')).toBe('pause_circle');
      expect(component.getStatusIcon('archived')).toBe('archive');
    });
  });

  describe('editTemplate', () => {
    it('navigates to the survey edit route', () => {
      component.editTemplate(component.templates[0]);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin', 'surveys', 's1']);
    });
  });

  describe('onClose', () => {
    it('navigates to /admin for an admin user', () => {
      mockAuthService.isAdmin = true;

      component.onClose();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin']);
    });

    it('navigates to the landing page for a non-admin user', () => {
      mockAuthService.isAdmin = false;

      component.onClose();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
    });
  });
});
