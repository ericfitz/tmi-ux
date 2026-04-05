import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
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

      expect(mockSnackBar.open).toHaveBeenCalledWith('adminSurveys.deleteError', 'common.dismiss', {
        duration: 5000,
      });
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
