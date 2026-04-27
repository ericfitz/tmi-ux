// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, afterEach, beforeEach, describe, it } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';

import { TeamsComponent } from './teams.component';
import { TeamListItem, Team, ListTeamsResponse } from '@app/types/team.types';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';
import { PageEvent } from '@angular/material/paginator';

// --- Mock interfaces ---

interface MockTeamService {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
}

interface MockLocation {
  back: ReturnType<typeof vi.fn>;
}

interface MockRouter {
  navigate: ReturnType<typeof vi.fn>;
}

interface MockActivatedRoute {
  snapshot: {
    queryParams: Record<string, string>;
  };
}

interface MockDialog {
  open: ReturnType<typeof vi.fn>;
}

// --- Fixture factories ---

const makeTeamListItem = (overrides: Partial<TeamListItem> = {}): TeamListItem => ({
  id: 'team-1',
  name: 'Alpha Team',
  status: 'active',
  member_count: 3,
  project_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-02T00:00:00Z',
  ...overrides,
});

const makeFullTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 'team-1',
  name: 'Alpha Team',
  description: 'A team',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-02T00:00:00Z',
  members: [],
  responsible_parties: [],
  related_teams: [],
  metadata: [],
  ...overrides,
});

const makeListResponse = (teams: TeamListItem[], total?: number): ListTeamsResponse => ({
  teams,
  total: total ?? teams.length,
  limit: 25,
  offset: 0,
});

// --- Helper to build component inside an injection context ---

function buildComponent(
  mockTeamService: MockTeamService,
  mockLocation: MockLocation,
  mockRouter: MockRouter,
  mockRoute: MockActivatedRoute,
  mockDialog: MockDialog,
  mockLogger: MockLoggerService,
): TeamsComponent {
  const mockDestroyRef = { onDestroy: vi.fn() };
  const injector = Injector.create({
    providers: [{ provide: DestroyRef, useValue: mockDestroyRef }],
  });

  return runInInjectionContext(injector, () => {
    return new TeamsComponent(
      mockTeamService as never,
      mockLocation as never,
      mockRouter as never,
      mockRoute as never,
      mockDialog as never,
      mockLogger as never,
    );
  });
}

// --- Tests ---

describe('TeamsComponent', () => {
  let component: TeamsComponent;
  let mockTeamService: MockTeamService;
  let mockLocation: MockLocation;
  let mockRouter: MockRouter;
  let mockRoute: MockActivatedRoute;
  let mockDialog: MockDialog;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    mockTeamService = {
      list: vi.fn().mockReturnValue(of(makeListResponse([]))),
      get: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(),
    };
    mockLocation = { back: vi.fn() };
    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
    mockRoute = { snapshot: { queryParams: {} } };
    mockDialog = { open: vi.fn() };
    mockLogger = createTypedMockLoggerService();

    component = buildComponent(
      mockTeamService,
      mockLocation,
      mockRouter,
      mockRoute,
      mockDialog,
      mockLogger,
    );
  });

  // -------------------------------------------------------------------------
  // Component creation
  // -------------------------------------------------------------------------

  describe('creation', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default pagination state', () => {
      expect(component.pageIndex).toBe(0);
      expect(component.pageSize).toBe(25);
      expect(component.totalTeams).toBe(0);
      expect(component.filterText).toBe('');
      expect(component.loading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Loading and displaying teams
  // -------------------------------------------------------------------------

  describe('ngOnInit – loading teams', () => {
    it('should call teamService.list on init', () => {
      component.ngOnInit();
      expect(mockTeamService.list).toHaveBeenCalled();
    });

    it('should populate dataSource from list response', () => {
      const teams = [makeTeamListItem({ id: 'team-a' }), makeTeamListItem({ id: 'team-b' })];
      mockTeamService.list.mockReturnValue(of(makeListResponse(teams, 2)));

      component.ngOnInit();

      expect(component.dataSource.data).toHaveLength(2);
      expect(component.dataSource.data[0].id).toBe('team-a');
      expect(component.totalTeams).toBe(2);
    });

    it('should set loading false after successful load', () => {
      mockTeamService.list.mockReturnValue(of(makeListResponse([])));
      component.ngOnInit();
      expect(component.loading).toBe(false);
    });

    it('should log error and set loading false when list fails', () => {
      mockTeamService.list.mockReturnValue(throwError(() => new Error('network error')));
      component.ngOnInit();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load teams', expect.any(Error));
      expect(component.loading).toBe(false);
    });

    it('should read page/size from URL query params', () => {
      mockRoute.snapshot.queryParams = { page: '3', size: '50' };
      component = buildComponent(
        mockTeamService,
        mockLocation,
        mockRouter,
        mockRoute,
        mockDialog,
        mockLogger,
      );

      component.ngOnInit();

      // parsePaginationFromUrl stores the page param value directly as pageIndex
      expect(component.pageIndex).toBe(3);
      expect(component.pageSize).toBe(50);
    });

    it('should read filter text from URL query params', () => {
      mockRoute.snapshot.queryParams = { filter: 'backend' };
      component = buildComponent(
        mockTeamService,
        mockLocation,
        mockRouter,
        mockRoute,
        mockDialog,
        mockLogger,
      );

      component.ngOnInit();

      expect(component.filterText).toBe('backend');
    });
  });

  // -------------------------------------------------------------------------
  // Filter debounce
  // -------------------------------------------------------------------------

  describe('onFilterChange', () => {
    it('should emit to filterSubject$', () => {
      component.ngOnInit();
      const initialCallCount = mockTeamService.list.mock.calls.length;

      // Directly verify that emitting resets the page and triggers load via debounce
      // Since debounce requires async timing, we test the subject emission instead
      const filterSubject = (component as unknown as { filterSubject$: Subject<string> })[
        'filterSubject$'
      ];
      const nextSpy = vi.spyOn(filterSubject, 'next');

      component.onFilterChange('sec');

      expect(nextSpy).toHaveBeenCalledWith('sec');
      // list call count stays the same until debounce fires
      expect(mockTeamService.list.mock.calls.length).toBe(initialCallCount);
    });

    describe('with fake timers', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should reset pageIndex to 0 when filter fires after debounce', () => {
        component.ngOnInit();
        component.pageIndex = 3;

        component.onFilterChange('alpha');

        // Advance past the 300ms debounce
        vi.advanceTimersByTime(400);

        // The subscriber sets filterText, resets pageIndex, and calls loadTeams
        expect(component.filterText).toBe('alpha');
        expect(component.pageIndex).toBe(0);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  describe('onPageChange', () => {
    it('should update pageIndex and pageSize then reload', () => {
      component.ngOnInit();
      const callsBefore = mockTeamService.list.mock.calls.length;

      const pageEvent: PageEvent = { pageIndex: 2, pageSize: 50, length: 200 };
      component.onPageChange(pageEvent);

      expect(component.pageIndex).toBe(2);
      expect(component.pageSize).toBe(50);
      expect(mockTeamService.list.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('should call list with correct offset on page change', () => {
      component.ngOnInit();

      // Move to page 3, size 10 → offset = 20
      const pageEvent: PageEvent = { pageIndex: 2, pageSize: 10, length: 100 };
      component.onPageChange(pageEvent);

      const lastCall =
        mockTeamService.list.mock.calls[mockTeamService.list.mock.calls.length - 1][0];
      expect(lastCall.offset).toBe(20);
      expect(lastCall.limit).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // Close button
  // -------------------------------------------------------------------------

  describe('onClose', () => {
    it('should call Location.back()', () => {
      component.onClose();
      expect(mockLocation.back).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Add team button → CreateTeamDialogComponent
  // -------------------------------------------------------------------------

  describe('onAddTeam', () => {
    it('should open CreateTeamDialogComponent', () => {
      const afterClosedSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onAddTeam();

      expect(mockDialog.open).toHaveBeenCalledTimes(1);
      const [DialogClass] = mockDialog.open.mock.calls[0];
      expect(DialogClass.name).toContain('CreateTeamDialog');
    });

    it('should call teamService.create when dialog returns a result', () => {
      const result = { name: 'New Team' };
      const afterClosedSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      mockTeamService.create.mockReturnValue(of(makeFullTeam({ name: 'New Team' })));
      component.ngOnInit();

      component.onAddTeam();
      afterClosedSubject.next(result);

      expect(mockTeamService.create).toHaveBeenCalledWith(result);
    });

    it('should not call teamService.create when dialog is cancelled', () => {
      const afterClosedSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onAddTeam();
      afterClosedSubject.next(undefined);

      expect(mockTeamService.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Edit button → EditTeamDialogComponent
  // -------------------------------------------------------------------------

  describe('onEditDetails', () => {
    it('should fetch full team then open EditTeamDialogComponent', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam();
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onEditDetails(team);

      expect(mockTeamService.get).toHaveBeenCalledWith(team.id);
      expect(mockDialog.open).toHaveBeenCalledTimes(1);
      const [DialogClass, config] = mockDialog.open.mock.calls[0];
      expect(DialogClass.name).toContain('EditTeamDialog');
      expect(config.data.team).toEqual(fullTeam);
    });

    it('should log error when get fails', () => {
      const team = makeTeamListItem();
      mockTeamService.get.mockReturnValue(throwError(() => new Error('not found')));
      component.ngOnInit();

      component.onEditDetails(team);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load team details',
        expect.any(Error),
      );
    });

    it('should reload teams when edit dialog returns a result', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam();
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();
      const callsBefore = mockTeamService.list.mock.calls.length;

      component.onEditDetails(team);
      afterClosedSubject.next({ name: 'Updated Name' });

      expect(mockTeamService.list.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // -------------------------------------------------------------------------
  // Members button → TeamMembersDialogComponent
  // -------------------------------------------------------------------------

  describe('onMembers', () => {
    it('should fetch full team then open TeamMembersDialogComponent', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam();
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onMembers(team);

      expect(mockTeamService.get).toHaveBeenCalledWith(team.id);
      expect(mockDialog.open).toHaveBeenCalledTimes(1);
      const [DialogClass, config] = mockDialog.open.mock.calls[0];
      expect(DialogClass.name).toContain('TeamMembersDialog');
      expect(config.data.team).toEqual(fullTeam);
    });

    it('should log error when get fails', () => {
      const team = makeTeamListItem();
      mockTeamService.get.mockReturnValue(throwError(() => new Error('server error')));
      component.ngOnInit();

      component.onMembers(team);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load team for members',
        expect.any(Error),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Kebab menu: Responsible Parties → ResponsiblePartiesDialogComponent
  // -------------------------------------------------------------------------

  describe('onResponsibleParties', () => {
    it('should fetch full team then open ResponsiblePartiesDialogComponent', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam();
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onResponsibleParties(team);

      expect(mockTeamService.get).toHaveBeenCalledWith(team.id);
      const [DialogClass, config] = mockDialog.open.mock.calls[0];
      expect(DialogClass.name).toContain('ResponsiblePartiesDialog');
      expect(config.data.entityId).toBe(fullTeam.id);
      expect(config.data.entityType).toBe('team');
    });

    it('should log error when get fails', () => {
      const team = makeTeamListItem();
      mockTeamService.get.mockReturnValue(throwError(() => new Error('error')));
      component.ngOnInit();

      component.onResponsibleParties(team);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load team for responsible parties',
        expect.any(Error),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Kebab menu: Related Teams → RelatedTeamsDialogComponent
  // -------------------------------------------------------------------------

  describe('onRelatedTeams', () => {
    it('should fetch full team then open RelatedTeamsDialogComponent', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam();
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onRelatedTeams(team);

      expect(mockTeamService.get).toHaveBeenCalledWith(team.id);
      const [DialogClass, config] = mockDialog.open.mock.calls[0];
      expect(DialogClass.name).toContain('RelatedTeamsDialog');
      expect(config.data.team).toEqual(fullTeam);
    });

    it('should log error when get fails', () => {
      const team = makeTeamListItem();
      mockTeamService.get.mockReturnValue(throwError(() => new Error('error')));
      component.ngOnInit();

      component.onRelatedTeams(team);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load team for related teams',
        expect.any(Error),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Kebab menu: Metadata → MetadataDialogComponent
  // -------------------------------------------------------------------------

  describe('onMetadata', () => {
    it('should fetch full team then open MetadataDialogComponent', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam({ metadata: [] });
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onMetadata(team);

      expect(mockTeamService.get).toHaveBeenCalledWith(team.id);
      const [DialogClass, config] = mockDialog.open.mock.calls[0];
      expect(DialogClass.name).toContain('MetadataDialog');
      expect(config.data.objectType).toBe('team');
      expect(config.data.objectName).toBe(fullTeam.name);
      expect(config.data.isReadOnly).toBe(false);
    });

    it('should call teamService.patch when dialog returns metadata', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam();
      const newMetadata = [{ key: 'owner', value: 'alice' }];
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      mockTeamService.patch.mockReturnValue(of(fullTeam));
      component.ngOnInit();

      component.onMetadata(team);
      afterClosedSubject.next(newMetadata);

      expect(mockTeamService.patch).toHaveBeenCalledWith(fullTeam.id, { metadata: newMetadata });
    });

    it('should not patch when dialog is cancelled', () => {
      const team = makeTeamListItem();
      const fullTeam = makeFullTeam();
      const afterClosedSubject = new Subject<unknown>();
      mockTeamService.get.mockReturnValue(of(fullTeam));
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });
      component.ngOnInit();

      component.onMetadata(team);
      afterClosedSubject.next(undefined);

      expect(mockTeamService.patch).not.toHaveBeenCalled();
    });

    it('should log error when get fails', () => {
      const team = makeTeamListItem();
      mockTeamService.get.mockReturnValue(throwError(() => new Error('error')));
      component.ngOnInit();

      component.onMetadata(team);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load team for metadata',
        expect.any(Error),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getStatusLabel
  // -------------------------------------------------------------------------

  describe('getStatusLabel', () => {
    it('should return em-dash for null status', () => {
      expect(component.getStatusLabel(null)).toBe('—');
    });

    it('should return em-dash for undefined status', () => {
      expect(component.getStatusLabel(undefined)).toBe('—');
    });

    it('should return i18n key for non-empty status', () => {
      expect(component.getStatusLabel('active')).toBe('teams.status.active');
    });

    it('should return i18n key for any status string', () => {
      expect(component.getStatusLabel('archived')).toBe('teams.status.archived');
    });
  });
});
