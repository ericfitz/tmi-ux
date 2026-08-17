// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { TranslocoService } from '@jsverse/transloco';
import { TriageListComponent } from './triage-list.component';
import { SurveyResponseService } from '../../../surveys/services/survey-response.service';
import { SurveyService } from '../../../surveys/services/survey.service';
import { LoggerService } from '@app/core/services/logger.service';
import { LanguageService } from '@app/i18n/language.service';
import { ListSurveyResponsesResponse, SurveyResponseListItem } from '@app/types/survey.types';
import { User } from '../../../tm/models/threat-model.model';

/**
 * Coverage for the triage list's client-side search (issue #821).
 *
 * The API's survey-response listing exposes no search parameter, so the search
 * box filters the loaded page in the browser. These tests pin that behavior:
 * the term must actually narrow the rows, must not trigger a request, and must
 * survive a page reload.
 */
describe('TriageListComponent search filtering', () => {
  let component: TriageListComponent;
  let mockResponseService: { listAll: ReturnType<typeof vi.fn> };
  let mockSurveyService: { listActive: ReturnType<typeof vi.fn> };

  const makeUser = (overrides: Partial<User> = {}): User => ({
    principal_type: 'user',
    provider: 'google',
    provider_id: 'google_1',
    email: 'submitter@example.com',
    display_name: 'Ada Lovelace',
    ...overrides,
  });

  const makeItem = (overrides: Partial<SurveyResponseListItem> = {}): SurveyResponseListItem => ({
    id: 'resp-1',
    survey_id: 'survey-1',
    survey_name: 'Cloud intake',
    status: 'submitted',
    owner: makeUser(),
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  });

  const rows: SurveyResponseListItem[] = [
    makeItem({
      id: 'resp-1',
      survey_name: 'Cloud intake',
      owner: makeUser({ display_name: 'Ada Lovelace', email: 'ada@example.com' }),
    }),
    makeItem({
      id: 'resp-2',
      survey_name: 'Mobile intake',
      owner: makeUser({ display_name: 'Grace Hopper', email: 'grace@example.com' }),
    }),
    makeItem({
      id: 'resp-3',
      survey_name: 'Cloud intake',
      owner: makeUser({ display_name: 'Alan Turing', email: 'alan@example.com' }),
    }),
  ];

  const makeApiResponse = (
    items: SurveyResponseListItem[],
    total?: number,
  ): ListSurveyResponsesResponse => ({
    survey_responses: items,
    total: total ?? items.length,
    limit: 25,
    offset: 0,
  });

  /** Ids of the rows the table would actually render. */
  const visibleIds = (): string[] => component.dataSource.filteredData.map(item => item.id);

  beforeEach(() => {
    mockResponseService = { listAll: vi.fn(() => of(makeApiResponse(rows, 120))) };
    mockSurveyService = { listActive: vi.fn(() => of({ surveys: [], total: 0 })) };

    component = new TriageListComponent(
      { navigate: vi.fn() } as unknown as Router,
      { open: vi.fn() } as unknown as MatSnackBar,
      mockResponseService as unknown as SurveyResponseService,
      mockSurveyService as unknown as SurveyService,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LoggerService,
      { translate: vi.fn((key: string) => key) } as unknown as TranslocoService,
      { open: vi.fn() } as unknown as MatDialog,
      { currentLanguage$: of({ code: 'en-US' }) } as unknown as LanguageService,
    );

    // ngOnInit installs the filter predicate and performs the first load.
    component.ngOnInit();
    component.dataSource.data = rows;
  });

  describe('filterPredicate', () => {
    it('matches on submitter display name, case-insensitively', () => {
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();
      expect(visibleIds()).toEqual(['resp-2']);
    });

    it('matches on submitter email', () => {
      component.filters.searchTerm = 'alan@example.com';
      component.onSearchTermChange();
      expect(visibleIds()).toEqual(['resp-3']);
    });

    it('matches on survey name, returning every row that shares it', () => {
      component.filters.searchTerm = 'cloud';
      component.onSearchTermChange();
      expect(visibleIds()).toEqual(['resp-1', 'resp-3']);
    });

    it('narrows to nothing when no row matches', () => {
      component.filters.searchTerm = 'no-such-submitter';
      component.onSearchTermChange();
      expect(visibleIds()).toEqual([]);
      expect(component.visibleResponseCount).toBe(0);
    });

    it('tolerates rows with a missing survey name', () => {
      component.dataSource.data = [makeItem({ id: 'resp-4', survey_name: undefined })];
      component.filters.searchTerm = 'ada';
      component.onSearchTermChange();
      expect(visibleIds()).toEqual(['resp-4']);
    });
  });

  describe('search term handling', () => {
    it('filters without issuing a request', () => {
      mockResponseService.listAll.mockClear();
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();
      expect(mockResponseService.listAll).not.toHaveBeenCalled();
      expect(visibleIds()).toEqual(['resp-2']);
    });

    it('trims and lowercases the term before filtering', () => {
      component.filters.searchTerm = '  GRACE  ';
      component.onSearchTermChange();
      expect(component.dataSource.filter).toBe('grace');
      expect(visibleIds()).toEqual(['resp-2']);
    });

    it('restores every row when the term is cleared', () => {
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();
      component.filters.searchTerm = '';
      component.onSearchTermChange();
      expect(visibleIds()).toEqual(['resp-1', 'resp-2', 'resp-3']);
    });

    it('reports isSearchActive only for a non-blank term', () => {
      expect(component.isSearchActive).toBe(false);
      component.filters.searchTerm = '   ';
      expect(component.isSearchActive).toBe(false);
      component.filters.searchTerm = 'a';
      expect(component.isSearchActive).toBe(true);
    });
  });

  describe('interaction with server-side paging and filters', () => {
    it('re-applies the search term to a freshly loaded page', () => {
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();
      expect(visibleIds()).toEqual(['resp-2']);

      // A new page arrives (e.g. the reviewer paged forward)
      component.loadResponses();
      expect(visibleIds()).toEqual(['resp-2']);
      expect(component.dataSource.filter).toBe('grace');
    });

    it('does not send the search term to the API', () => {
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();
      component.loadResponses();

      const filter = mockResponseService.listAll.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(Object.keys(filter)).not.toContain('search');
      expect(JSON.stringify(filter)).not.toContain('grace');
    });

    it('keeps the server total separate from the visible count', () => {
      component.loadResponses();
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();

      expect(component.totalResponses).toBe(120);
      expect(component.visibleResponseCount).toBe(1);
    });

    it('clears the search filter along with the other filters', () => {
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();
      component.clearFilters();

      expect(component.filters.searchTerm).toBe('');
      expect(component.dataSource.filter).toBe('');
      expect(visibleIds()).toEqual(['resp-1', 'resp-2', 'resp-3']);
    });

    it('clearSearch drops only the term, leaving server filters and data alone', () => {
      component.filters.status = ['draft'];
      component.filters.surveyId = 'survey-9';
      component.filters.searchTerm = 'grace';
      component.onSearchTermChange();
      mockResponseService.listAll.mockClear();

      component.clearSearch();

      expect(component.filters.searchTerm).toBe('');
      expect(component.dataSource.filter).toBe('');
      expect(visibleIds()).toEqual(['resp-1', 'resp-2', 'resp-3']);
      // Untouched, and no refetch — the rows are already loaded
      expect(component.filters.status).toEqual(['draft']);
      expect(component.filters.surveyId).toBe('survey-9');
      expect(mockResponseService.listAll).not.toHaveBeenCalled();
    });

    it('distinguishes "no rows from the server" from "no matches on this page"', () => {
      // Server returned rows, filter matches none: the no-match state, which
      // keeps the paginator mounted so the reviewer can page on (#821 review).
      component.filters.searchTerm = 'nobody';
      component.onSearchTermChange();
      expect(component.dataSource.data.length).toBeGreaterThan(0);
      expect(component.visibleResponseCount).toBe(0);

      // Server returned nothing: the true empty state
      component.dataSource.data = [];
      component.clearSearch();
      expect(component.dataSource.data.length).toBe(0);
      expect(component.visibleResponseCount).toBe(0);
    });

    it('rebinds sort when the table is created after init', () => {
      // The table sits behind an @if, so MatSort does not exist at init time and
      // arrives (and can arrive again) later.
      expect(component.dataSource.sort).toBeFalsy();

      // MatTableDataSource merges sortChange and initialized, so both have to be
      // real observables rather than bare spies.
      const sort = {
        sortChange: new Subject<void>(),
        initialized: new Subject<void>(),
        sortables: new Map(),
      } as unknown as MatSort;
      component.matSort = sort;
      expect(component.dataSource.sort).toBe(sort);

      // A later teardown must not clear a working binding
      component.matSort = undefined;
      expect(component.dataSource.sort).toBe(sort);
    });

    it('counts a search term as an active filter', () => {
      expect(component.hasActiveFilters).toBe(false);
      component.filters.searchTerm = 'grace';
      expect(component.hasActiveFilters).toBe(true);
    });
  });
});
