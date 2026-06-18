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

// SEM@96c34d433bdf8694a9679b9d7e88dddcc1d5563f: build a minimal Survey fixture with optional property overrides for tests (pure)
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

describe('TemplateBuilderComponent - Builder', () => {
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
      snapshot: { paramMap: { get: vi.fn(() => null) } },
    };
    mockRouter = createTypedMockRouter();
    mockSurveyService = {
      getByIdAdmin: vi.fn(),
      deleteSurvey: vi.fn(),
      update: vi.fn(() => of(createMockSurvey())),
      create: vi.fn(() => of(createMockSurvey())),
    };
    mockLogger = createTypedMockLoggerService();
    mockTransloco = { translate: vi.fn((key: string) => key) };
    mockSnackBar = { open: vi.fn() };

    component = new TemplateBuilderComponent(
      mockRoute as never,
      mockRouter as never,
      mockSurveyService as never,
      mockLogger as never,
      mockTransloco as never,
      mockSnackBar as never,
    );
  });

  describe('addQuestion', () => {
    it('appends a question to the current page and selects it', () => {
      component.addQuestion('text');

      expect(component.currentPageElements).toHaveLength(1);
      expect(component.currentPageElements[0].type).toBe('text');
      expect(component.selectedQuestion).toBe(component.currentPageElements[0]);
      expect(component.hasUnsavedChanges).toBe(true);
    });

    it('seeds default choices for choice-based question types', () => {
      component.addQuestion('radiogroup');

      expect(component.currentPageElements[0].choices).toEqual([
        'Option 1',
        'Option 2',
        'Option 3',
      ]);
    });

    it('generates sequential question names', () => {
      component.addQuestion('text');
      component.addQuestion('text');

      expect(component.currentPageElements.map(q => q.name)).toEqual(['question1', 'question2']);
    });

    it('avoids collisions with an already-used questionN name', () => {
      component.addQuestion('text'); // question1
      // Rename it to the slot the counter would otherwise pick next.
      component.currentPageElements[0].name = 'question2';

      component.addQuestion('text');

      // The while-guard skips the taken 'question2'.
      const names = component.currentPageElements.map(q => q.name);
      expect(new Set(names).size).toBe(2);
      expect(names).not.toContain(undefined);
    });

    it('initializes a child elements array for a panel question', () => {
      component.addQuestion('panel');

      expect(component.currentPageElements[0].elements).toEqual([]);
    });
  });

  describe('selectQuestion / deleteSelectedQuestion', () => {
    it('selects a question by reference and index', () => {
      component.addQuestion('text');
      const q = component.currentPageElements[0];

      component.selectQuestion(q, 0);

      expect(component.selectedQuestion).toBe(q);
      expect(component.selectedQuestionIndex).toBe(0);
    });

    it('deletes the selected question and clears the selection', () => {
      component.addQuestion('text');
      component.selectQuestion(component.currentPageElements[0], 0);

      component.deleteSelectedQuestion();

      expect(component.currentPageElements).toHaveLength(0);
      expect(component.selectedQuestion).toBeNull();
      expect(component.selectedQuestionIndex).toBe(-1);
    });

    it('does nothing when no question is selected', () => {
      component.addQuestion('text');
      component.selectedQuestionIndex = -1;

      component.deleteSelectedQuestion();

      expect(component.currentPageElements).toHaveLength(1);
    });
  });

  describe('moveQuestionUp / moveQuestionDown', () => {
    // SEM@87bdf21713c98745c8ea939f87881e738726650a: add three text questions to the component under test as a shared test helper (mutates shared state)
    function addThree(): void {
      component.addQuestion('text');
      component.addQuestion('text');
      component.addQuestion('text');
    }

    it('moves the selected question up', () => {
      addThree();
      const second = component.currentPageElements[1];
      component.selectQuestion(second, 1);

      component.moveQuestionUp();

      expect(component.currentPageElements[0]).toBe(second);
      expect(component.selectedQuestionIndex).toBe(0);
    });

    it('does not move the first question up', () => {
      addThree();
      const first = component.currentPageElements[0];
      component.selectQuestion(first, 0);

      component.moveQuestionUp();

      expect(component.currentPageElements[0]).toBe(first);
    });

    it('moves the selected question down', () => {
      addThree();
      const first = component.currentPageElements[0];
      component.selectQuestion(first, 0);

      component.moveQuestionDown();

      expect(component.currentPageElements[1]).toBe(first);
      expect(component.selectedQuestionIndex).toBe(1);
    });

    it('canMoveUp / canMoveDown reflect the selection position', () => {
      addThree();

      component.selectQuestion(component.currentPageElements[0], 0);
      expect(component.canMoveUp).toBe(false);
      expect(component.canMoveDown).toBe(true);

      component.selectQuestion(component.currentPageElements[2], 2);
      expect(component.canMoveUp).toBe(true);
      expect(component.canMoveDown).toBe(false);
    });
  });

  describe('page management', () => {
    it('addPage appends a page and switches to it', () => {
      component.addPage();

      expect(component.surveyJson.pages).toHaveLength(2);
      expect(component.selectedPageIndex).toBe(1);
      expect(component.hasUnsavedChanges).toBe(true);
    });

    it('nextPage / previousPage navigate within bounds', () => {
      component.addPage(); // now 2 pages, index 1

      component.previousPage();
      expect(component.selectedPageIndex).toBe(0);

      component.nextPage();
      expect(component.selectedPageIndex).toBe(1);

      // already on the last page
      component.nextPage();
      expect(component.selectedPageIndex).toBe(1);
    });

    it('deletePage removes the current page', () => {
      component.addPage();

      component.deletePage();

      expect(component.surveyJson.pages).toHaveLength(1);
    });

    it('deletePage does not remove the only remaining page', () => {
      component.deletePage();

      expect(component.surveyJson.pages).toHaveLength(1);
    });
  });

  describe('survey metadata updates', () => {
    it('updateSurveyTitle / updateSurveyDescription set the schema fields', () => {
      component.updateSurveyTitle('My Title');
      component.updateSurveyDescription('My Description');

      expect(component.surveyJson.title).toBe('My Title');
      expect(component.surveyJson.description).toBe('My Description');
      expect(component.hasUnsavedChanges).toBe(true);
    });

    it('updateTemplateName / updateTemplateVersion are no-ops without a template', () => {
      component.template = null;

      expect(() => component.updateTemplateName('x')).not.toThrow();
      expect(() => component.updateTemplateVersion('2')).not.toThrow();
    });

    it('updateTemplateName / updateTemplateVersion update an existing template', () => {
      component.template = createMockSurvey();

      component.updateTemplateName('Renamed');
      component.updateTemplateVersion('2.0');

      expect(component.template.name).toBe('Renamed');
      expect(component.template.version).toBe('2.0');
    });
  });

  describe('choices editing', () => {
    it('getChoicesText joins the choices with newlines', () => {
      component.addQuestion('radiogroup');
      component.selectQuestion(component.currentPageElements[0], 0);

      expect(component.getChoicesText()).toBe('Option 1\nOption 2\nOption 3');
    });

    it('updateChoicesFromText splits text into non-empty choices', () => {
      component.addQuestion('radiogroup');
      component.selectQuestion(component.currentPageElements[0], 0);

      component.updateChoicesFromText('A\nB\n\n  \nC');

      expect(component.currentPageElements[0].choices).toEqual(['A', 'B', 'C']);
    });
  });

  describe('save', () => {
    it('creates a new survey when there is no survey id and clears the unsaved flag', () => {
      component.surveyId = null;
      component.updateSurveyTitle('Brand New Survey');
      // updateSurveyTitle marks the builder dirty; a successful save clears it.
      expect(component.hasUnsavedChanges).toBe(true);

      component.save();

      expect(mockSurveyService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Brand New Survey' }),
      );
      expect(component.isSaving).toBe(false);
      expect(component.hasUnsavedChanges).toBe(false);
    });

    it('updates an existing survey when a survey id is present', () => {
      component.surveyId = 'survey-1';
      component.template = createMockSurvey({ name: 'Existing' });

      component.save();

      expect(mockSurveyService.update).toHaveBeenCalledWith(
        'survey-1',
        expect.objectContaining({ name: 'Existing' }),
      );
    });

    it('records an error message when the save fails', () => {
      mockSurveyService.create.mockReturnValue(throwError(() => new Error('boom')));
      component.surveyId = null;

      component.save();

      expect(component.error).toBeTruthy();
      expect(component.isSaving).toBe(false);
    });
  });
});
