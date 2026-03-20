import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { of, throwError, Subject } from 'rxjs';

import { TemplateBuilderComponent } from './template-builder.component';
import { Survey } from '@app/types/survey.types';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../../../testing/mocks';

interface MockActivatedRoute {
  paramMap: Subject<{ get: (key: string) => string | null }>;
  snapshot: {
    paramMap: {
      get: ReturnType<typeof vi.fn>;
    };
  };
}

interface MockSurveyService {
  getByIdAdmin: ReturnType<typeof vi.fn>;
  deleteSurvey: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
}

const createMockSurvey = (overrides?: Partial<Survey>): Survey => ({
  id: 'survey-1',
  name: 'Test Survey',
  description: 'A test survey',
  version: '1.0',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-02T00:00:00Z',
  survey_json: {
    title: 'Test Survey',
    description: '',
    pages: [{ name: 'page1', title: 'Page 1', elements: [] }],
  },
  ...overrides,
});

describe('TemplateBuilderComponent - Delete', () => {
  let component: TemplateBuilderComponent;
  let mockRoute: MockActivatedRoute;
  let mockRouter: MockRouter;
  let mockSurveyService: MockSurveyService;
  let mockLogger: MockLoggerService;
  let mockTransloco: MockTranslocoService;
  let mockSnackBar: MockSnackBar;

  beforeEach(() => {
    mockRoute = {
      paramMap: new Subject(),
      snapshot: {
        paramMap: {
          get: vi.fn(() => null),
        },
      },
    };

    mockRouter = createTypedMockRouter();

    mockSurveyService = {
      getByIdAdmin: vi.fn(),
      deleteSurvey: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    };

    mockLogger = createTypedMockLoggerService();

    mockTransloco = {
      translate: vi.fn((key: string) => key),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    component = new TemplateBuilderComponent(
      mockRoute as never,
      mockRouter as never,
      mockSurveyService as never,
      mockLogger as never,
      mockTransloco as never,
      mockSnackBar as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('deleteSurvey', () => {
    it('should not proceed when surveyId is null', () => {
      component.surveyId = null;
      component.template = createMockSurvey();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );

      component.deleteSurvey();

      expect(mockSurveyService.deleteSurvey).not.toHaveBeenCalled();
    });

    it('should not proceed when template is null', () => {
      component.surveyId = 'survey-1';
      component.template = null;
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );

      component.deleteSurvey();

      expect(mockSurveyService.deleteSurvey).not.toHaveBeenCalled();
    });

    it('should call deleteSurvey and navigate on confirm', () => {
      component.surveyId = 'survey-1';
      component.template = createMockSurvey();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );
      mockSurveyService.deleteSurvey.mockReturnValue(of(undefined));

      component.deleteSurvey();

      expect(mockSurveyService.deleteSurvey).toHaveBeenCalledWith('survey-1');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/surveys']);
    });

    it('should not call deleteSurvey when confirm is cancelled', () => {
      component.surveyId = 'survey-1';
      component.template = createMockSurvey();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      component.deleteSurvey();

      expect(mockSurveyService.deleteSurvey).not.toHaveBeenCalled();
    });

    it('should show snackbar on delete error', () => {
      component.surveyId = 'survey-1';
      component.template = createMockSurvey();
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
      );
      mockSurveyService.deleteSurvey.mockReturnValue(throwError(() => new Error('Server error')));

      component.deleteSurvey();

      expect(mockSnackBar.open).toHaveBeenCalledWith('adminSurveys.deleteError', 'common.dismiss', {
        duration: 5000,
      });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should use transloco to build confirmation message', () => {
      component.surveyId = 'survey-1';
      component.template = createMockSurvey({ name: 'My Survey' });
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false),
      );

      component.deleteSurvey();

      expect(mockTransloco.translate).toHaveBeenCalledWith('common.objectTypes.survey');
      expect(mockTransloco.translate).toHaveBeenCalledWith('common.confirmDelete', {
        item: 'common.objectTypes.survey',
        name: 'My Survey',
      });
    });
  });
});
