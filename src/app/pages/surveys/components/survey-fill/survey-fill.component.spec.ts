// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.
//
// Scope: this spec covers survey-fill's controller logic — route parsing,
// the loadSurvey response branches, navigation, project-id patching, and
// formatTime. The SurveyJS Model wiring (initializeSurvey, auto-save,
// onComplete) is integration-level and out of scope.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';

import { SurveyFillComponent } from './survey-fill.component';
import { SurveyDraftService } from '../../services/survey-draft.service';
import { SurveyThemeService } from '../../services/survey-theme.service';
import { ThemeService } from '@app/core/services/theme.service';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../../testing/mocks';

describe('SurveyFillComponent', () => {
  let component: SurveyFillComponent;
  let mockRoute: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let mockRouter: MockRouter;
  let mockSurveyService: { getSurveyJson: ReturnType<typeof vi.fn> };
  let mockResponseService: Record<string, ReturnType<typeof vi.fn>>;
  let mockLogger: MockLoggerService;
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
  let injector: Injector;

  function build(params: Record<string, string | null>): SurveyFillComponent {
    mockRoute = {
      snapshot: { paramMap: { get: vi.fn((key: string) => params[key] ?? null) } },
    };
    return runInInjectionContext(
      injector,
      () =>
        new SurveyFillComponent(
          mockRoute as never,
          mockRouter as never,
          mockSurveyService as never,
          mockResponseService as never,
          mockLogger as never,
          mockCdr as never,
        ),
    );
  }

  beforeEach(() => {
    mockRouter = createTypedMockRouter();
    mockSurveyService = { getSurveyJson: vi.fn(() => of({ title: 'T', pages: [] })) };
    mockResponseService = {
      getById: vi.fn(() => of({ id: 'r1', survey_id: 'sv1', status: 'submitted' })),
      submit: vi.fn(() => of({})),
      patchProjectId: vi.fn(() => of({ project_id: 'p1' })),
    };
    mockLogger = createTypedMockLoggerService();
    mockCdr = { markForCheck: vi.fn() };

    // The component resolves SurveyDraftService / ThemeService /
    // SurveyThemeService / TranslocoService via inject() at field-init time
    // and reads draft-service observables, so they must be real providers.
    const mockDraftService = {
      isSaving$: of(false),
      lastSaved$: of(null),
      saveError$: of(null),
      clearState: vi.fn(),
      queueSave: vi.fn(),
      saveNow: vi.fn(() => of(undefined)),
    };
    injector = Injector.create({
      providers: [
        { provide: SurveyDraftService, useValue: mockDraftService },
        { provide: ThemeService, useValue: { getCurrentTheme: vi.fn(() => 'light') } },
        { provide: SurveyThemeService, useValue: { getTheme: vi.fn(), theme$: of({}) } },
        { provide: TranslocoService, useValue: { translate: vi.fn((k: string) => k) } },
      ],
    });
  });

  describe('ngOnInit route parsing', () => {
    it('errors when the survey URL is missing route params', () => {
      component = build({ surveyId: null, responseId: null });

      component.ngOnInit();

      expect(component.error).toBe('Invalid survey URL');
      expect(component.loading).toBe(false);
      expect(mockResponseService['getById']).not.toHaveBeenCalled();
    });

    it('loads the response when both route params are present', () => {
      component = build({ surveyId: 'sv1', responseId: 'r1' });

      component.ngOnInit();

      expect(mockResponseService['getById']).toHaveBeenCalledWith('r1');
    });
  });

  describe('loadSurvey response branches', () => {
    it('marks a non-editable response as submitted', () => {
      mockResponseService['getById'].mockReturnValue(
        of({ id: 'r1', survey_id: 'sv1', status: 'submitted' }),
      );
      component = build({ surveyId: 'sv1', responseId: 'r1' });

      component.ngOnInit();

      expect(component.submitted).toBe(true);
      expect(component.loading).toBe(false);
    });

    it('records an error when the response fails to load', () => {
      mockResponseService['getById'].mockReturnValue(throwError(() => new Error('boom')));
      component = build({ surveyId: 'sv1', responseId: 'r1' });

      component.ngOnInit();

      expect(component.error).toBe('Failed to load response');
      expect(component.loading).toBe(false);
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      component = build({ surveyId: 'sv1', responseId: 'r1' });
      // ngOnInit captures the private responseId that viewResponse reads.
      component.ngOnInit();
    });

    it('viewResponse navigates to the response detail route', () => {
      component.viewResponse();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake', 'response', 'r1']);
    });

    it('startAnother navigates to the intake route', () => {
      component.startAnother();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
    });

    it('goBack navigates to the intake route', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
    });

    it('saveAndExit navigates straight to intake when there is no survey model', () => {
      // The beforeEach loads a 'submitted' response, so loadSurvey returns
      // early and initializeSurvey never builds surveyModel — exercising the
      // null-guard path of saveAndExit.
      component.saveAndExit();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
    });
  });

  describe('onProjectChange', () => {
    it('does nothing when there is no loaded response', () => {
      component = build({ surveyId: 'sv1', responseId: 'r1' });
      // response is null until loadSurvey runs.
      component.onProjectChange('p1');

      expect(mockResponseService['patchProjectId']).not.toHaveBeenCalled();
    });

    it('patches the project id on the loaded response', () => {
      mockResponseService['getById'].mockReturnValue(
        of({ id: 'r1', survey_id: 'sv1', status: 'submitted', project_id: null }),
      );
      component = build({ surveyId: 'sv1', responseId: 'r1' });
      component.ngOnInit();

      component.onProjectChange('p1');

      expect(mockResponseService['patchProjectId']).toHaveBeenCalledWith('r1', 'p1');
      expect(component.response?.project_id).toBe('p1');
    });
  });

  describe('formatTime', () => {
    it('returns an empty string for a null date', () => {
      component = build({ surveyId: 'sv1', responseId: 'r1' });

      expect(component.formatTime(null)).toBe('');
    });

    it('returns a formatted time string for a real date', () => {
      component = build({ surveyId: 'sv1', responseId: 'r1' });

      const result = component.formatTime(new Date('2024-01-01T14:30:00Z'));

      // hh:mm — locale/timezone vary, but a real time is always present.
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});
