// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { of, throwError } from 'rxjs';
import type { TranslocoService } from '@jsverse/transloco';

import { SurveyListComponent } from './survey-list.component';
import { environment } from '../../../../../environments/environment';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../../testing/mocks';
import type { SurveyListItem, SurveyResponseListItem } from '@app/types/survey.types';

describe('SurveyListComponent', () => {
  let component: SurveyListComponent;
  let mockSurveyService: { listActive: ReturnType<typeof vi.fn> };
  let mockResponseService: Record<string, ReturnType<typeof vi.fn>>;
  let mockRouter: MockRouter;
  let mockLogger: MockLoggerService;
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
  let mockTransloco: TranslocoService;
  let mockLanguageService: { currentLanguage$: ReturnType<typeof of> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let envInjector: EnvironmentInjector;

  const survey: SurveyListItem = {
    id: 'sv1',
    name: 'Intake Survey',
    description: '',
    version: '1',
    status: 'active',
    created_at: '2024-01-01',
    modified_at: '2024-01-01',
  };

  const draft: SurveyResponseListItem = {
    id: 'r1',
    survey_id: 'sv1',
    status: 'draft',
    created_at: '2024-01-01',
    modified_at: '2024-01-01',
  } as SurveyResponseListItem;

  function build(): SurveyListComponent {
    return runInInjectionContext(
      envInjector,
      () =>
        new SurveyListComponent(
          mockSurveyService as never,
          mockResponseService as never,
          mockRouter as never,
          mockLogger as never,
          mockCdr as never,
          mockTransloco,
          mockLanguageService as never,
          mockDialog as never,
        ),
    );
  }

  beforeEach(() => {
    mockSurveyService = { listActive: vi.fn(() => of({ surveys: [survey] })) };
    mockResponseService = {
      listMine: vi.fn(() => of({ survey_responses: [draft] })),
      createDraft: vi.fn(() => of({ id: 'r9' })),
      deleteDraft: vi.fn(() => of(undefined)),
    };
    mockRouter = createTypedMockRouter();
    mockLogger = createTypedMockLoggerService();
    mockCdr = { markForCheck: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    mockLanguageService = { currentLanguage$: of({ code: 'en-US', rtl: false }) };
    mockDialog = { open: vi.fn() };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
    component = build();
  });

  afterEach(() => {
    envInjector.destroy();
  });

  describe('loadData', () => {
    it('loads active surveys and groups drafts by survey id', () => {
      component.loadData();

      expect(component.surveys).toEqual([survey]);
      expect(component.getDrafts('sv1')).toEqual([draft]);
      expect(component.loading).toBe(false);
    });

    it('records an error when survey loading fails', () => {
      mockSurveyService.listActive.mockReturnValue(throwError(() => new Error('boom')));

      component.loadData();

      expect(component.error).toBeTruthy();
      expect(component.loading).toBe(false);
    });
  });

  describe('getDrafts', () => {
    it('returns an empty array for a survey with no drafts', () => {
      component.loadData();

      expect(component.getDrafts('unknown')).toEqual([]);
    });
  });

  describe('continueDraft', () => {
    it('navigates to the fill route for the draft', () => {
      component.continueDraft(draft);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake', 'fill', 'sv1', 'r1']);
    });
  });

  describe('deleteDraft', () => {
    it('stops event propagation and deletes the draft', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;

      component.deleteDraft(draft, event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockResponseService['deleteDraft']).toHaveBeenCalledWith('r1');
    });
  });

  describe('viewMyResponses', () => {
    it('navigates to the my-responses route', () => {
      component.viewMyResponses();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake', 'my-responses']);
    });
  });

  describe('startSurvey', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      delete (environment as Record<string, unknown>)['enableConfidentialThreatModels'];
    });

    it('creates a draft and navigates to the fill route when the confidential flag is off', () => {
      // Drive the false branch explicitly rather than relying on the base
      // environment file omitting the (optional) flag.
      (environment as Record<string, unknown>)['enableConfidentialThreatModels'] = false;

      component.startSurvey(survey);

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockResponseService['createDraft']).toHaveBeenCalledWith({
        survey_id: 'sv1',
        is_confidential: false,
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake', 'fill', 'sv1', 'r9']);
    });

    it('prompts for confidentiality before creating the draft when the flag is on', () => {
      (environment as Record<string, unknown>)['enableConfidentialThreatModels'] = true;
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });

      component.startSurvey(survey);

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockResponseService['createDraft']).toHaveBeenCalledWith({
        survey_id: 'sv1',
        is_confidential: true,
      });
    });

    it('does not create a draft when the confidentiality prompt is dismissed', () => {
      (environment as Record<string, unknown>)['enableConfidentialThreatModels'] = true;
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.startSurvey(survey);

      expect(mockResponseService['createDraft']).not.toHaveBeenCalled();
    });
  });

  describe('formatRelativeTime', () => {
    it('reports "just now" for a very recent timestamp', () => {
      expect(component.formatRelativeTime(new Date().toISOString())).toBe('collaboration.justNow');
    });

    it('reports a minutes-ago string for a timestamp within the hour', () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();

      expect(component.formatRelativeTime(tenMinAgo)).toContain('10');
    });

    it('reports a days-ago string for an older timestamp', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

      expect(component.formatRelativeTime(threeDaysAgo)).toContain('3');
    });
  });
});
