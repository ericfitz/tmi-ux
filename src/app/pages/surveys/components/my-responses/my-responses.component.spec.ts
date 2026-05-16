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

import { MyResponsesComponent } from './my-responses.component';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  type MockLoggerService,
  type MockRouter,
} from '../../../../../testing/mocks';
import type { SurveyResponseListItem, ResponseStatus } from '@app/types/survey.types';

describe('MyResponsesComponent', () => {
  let component: MyResponsesComponent;
  let mockResponseService: Record<string, ReturnType<typeof vi.fn>>;
  let mockRouter: MockRouter;
  let mockLogger: MockLoggerService;
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
  let mockTransloco: TranslocoService;
  let envInjector: EnvironmentInjector;

  function makeResponse(
    id: string,
    status: ResponseStatus,
    overrides: Partial<SurveyResponseListItem> = {},
  ): SurveyResponseListItem {
    return {
      id,
      survey_id: `sv-${id}`,
      survey_name: `Survey ${id}`,
      status,
      created_at: '2024-01-01',
      modified_at: '2024-01-02',
      ...overrides,
    } as SurveyResponseListItem;
  }

  function build(): MyResponsesComponent {
    return runInInjectionContext(
      envInjector,
      () =>
        new MyResponsesComponent(
          mockResponseService as never,
          mockRouter as never,
          mockLogger as never,
          mockCdr as never,
          mockTransloco,
        ),
    );
  }

  beforeEach(() => {
    mockResponseService = {
      listMine: vi.fn(() =>
        of({
          survey_responses: [
            makeResponse('1', 'draft'),
            makeResponse('2', 'submitted'),
            makeResponse('3', 'review_created'),
          ],
        }),
      ),
      deleteDraft: vi.fn(() => of(undefined)),
    };
    mockRouter = createTypedMockRouter();
    mockLogger = createTypedMockLoggerService();
    mockCdr = { markForCheck: vi.fn() };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
    component = build();
  });

  afterEach(() => {
    envInjector.destroy();
  });

  describe('loadResponses', () => {
    it('loads the user responses into the data source', () => {
      component.loadResponses();

      expect(component.responses).toHaveLength(3);
      expect(component.dataSource.data).toHaveLength(3);
      expect(component.loading).toBe(false);
    });

    it('records an error when loading fails', () => {
      mockResponseService['listMine'].mockReturnValue(throwError(() => new Error('boom')));

      component.loadResponses();

      expect(component.error).toBeTruthy();
      expect(component.loading).toBe(false);
    });
  });

  describe('applyFilter', () => {
    beforeEach(() => component.loadResponses());

    it('shows all responses when every status is selected', () => {
      // statusFilter defaults to all five statuses.
      component.applyFilter();

      expect(component.dataSource.data).toHaveLength(3);
    });

    it('filters to a single selected status', () => {
      component.statusFilter = ['draft'];

      component.applyFilter();

      expect(component.dataSource.data.map(r => r.id)).toEqual(['1']);
    });

    it('shows all responses when the status filter is empty', () => {
      component.statusFilter = [];

      component.applyFilter();

      expect(component.dataSource.data).toHaveLength(3);
    });
  });

  describe('viewResponse', () => {
    it('navigates to the fill route for an editable (draft) response', () => {
      component.viewResponse(makeResponse('1', 'draft'));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake', 'fill', 'sv-1', '1']);
    });

    it('navigates to the read-only response route for a submitted response', () => {
      component.viewResponse(makeResponse('2', 'submitted'));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake', 'response', '2']);
    });
  });

  describe('deleteDraft', () => {
    it('stops event propagation and deletes the draft', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;

      component.deleteDraft(makeResponse('1', 'draft'), event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockResponseService['deleteDraft']).toHaveBeenCalledWith('1');
    });
  });

  describe('goBack', () => {
    it('navigates to the intake route', () => {
      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
    });
  });

  describe('getStatusInfo', () => {
    it('maps each known status to its label/color/icon', () => {
      expect(component.getStatusInfo('draft').icon).toBe('edit_note');
      expect(component.getStatusInfo('submitted').color).toBe('primary');
      expect(component.getStatusInfo('needs_revision').color).toBe('warn');
      expect(component.getStatusInfo('review_created').icon).toBe('check_circle');
    });
  });

  describe('date formatting', () => {
    it('formatDate returns a date-only string', () => {
      const result = component.formatDate('2024-03-15T13:45:00Z');

      expect(result).toContain('2024');
    });

    it('formatDateTime includes a time component', () => {
      const result = component.formatDateTime('2024-03-15T13:45:00Z');

      expect(result).toContain('2024');
      // hh:mm — formatDate omits this; formatDateTime appends it.
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});
