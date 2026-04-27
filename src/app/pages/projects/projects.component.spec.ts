// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of, Subject } from 'rxjs';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { PageEvent } from '@angular/material/paginator';

import { ProjectsComponent } from './projects.component';
import { ProjectListItem, Project } from '@app/types/project.types';
import { TeamListItem } from '@app/types/team.types';
import { CreateProjectDialogComponent } from '@app/shared/components/create-project-dialog/create-project-dialog.component';
import { EditProjectDialogComponent } from '@app/shared/components/edit-project-dialog/edit-project-dialog.component';
import { ResponsiblePartiesDialogComponent } from '@app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedProjectsDialogComponent } from '@app/shared/components/related-projects-dialog/related-projects-dialog.component';
import { MetadataDialogComponent } from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../testing/mocks';

// ---------------------------------------------------------------------------
// Mock interfaces
// ---------------------------------------------------------------------------

interface MockProjectService {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
}

interface MockTeamService {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
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

interface MockLocation {
  back: ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const mockProjectListItem: ProjectListItem = {
  id: 'proj-1',
  name: 'Alpha Project',
  status: 'active',
  team_id: 'team-1',
  team_name: 'Alpha Team',
  created_at: '2024-01-01T00:00:00Z',
  modified_at: '2024-06-01T00:00:00Z',
};

const mockProject: Project = {
  id: 'proj-1',
  name: 'Alpha Project',
  team_id: 'team-1',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  responsible_parties: [],
  related_projects: [],
  metadata: [],
};

const mockListResponse = {
  projects: [mockProjectListItem],
  total: 1,
  limit: 25,
  offset: 0,
};

const mockTeamListItem: TeamListItem = {
  id: 'team-1',
  name: 'Alpha Team',
  created_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helper to create a dialog afterClosed Subject and dialog ref stub
// ---------------------------------------------------------------------------
function createDialogRef<T = unknown>(): {
  afterClosed$: Subject<T | undefined>;
  dialogRef: { afterClosed: () => Subject<T | undefined> };
} {
  const afterClosed$ = new Subject<T | undefined>();
  const dialogRef = { afterClosed: () => afterClosed$ };
  return { afterClosed$, dialogRef };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let injector: Injector;
  let mockProjectService: MockProjectService;
  let mockTeamService: MockTeamService;
  let mockRouter: MockRouter;
  let mockRoute: MockActivatedRoute;
  let mockDialog: MockDialog;
  let mockLogger: MockLoggerService;
  let mockLocation: MockLocation;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectService = {
      list: vi.fn().mockReturnValue(of(mockListResponse)),
      get: vi.fn().mockReturnValue(of(mockProject)),
      create: vi.fn().mockReturnValue(of(mockProject)),
      patch: vi.fn().mockReturnValue(of(mockProject)),
    };

    mockTeamService = {
      list: vi
        .fn()
        .mockReturnValue(of({ teams: [mockTeamListItem], total: 1, limit: 10, offset: 0 })),
      get: vi.fn().mockReturnValue(of(mockTeamListItem)),
    };

    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

    mockRoute = { snapshot: { queryParams: {} } };

    mockDialog = { open: vi.fn() };

    mockLogger = createTypedMockLoggerService();

    mockLocation = { back: vi.fn() };

    const mockDestroyRef = { onDestroy: vi.fn() };
    injector = Injector.create({
      providers: [{ provide: DestroyRef, useValue: mockDestroyRef }],
    });

    component = runInInjectionContext(injector, () => {
      return new ProjectsComponent(
        mockProjectService as any,
        mockTeamService as any,
        mockRouter as any,
        mockRoute as any,
        mockDialog as any,
        mockLogger as any,
        mockLocation as any,
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  describe('ngOnInit', () => {
    it('should load projects on init', () => {
      component.ngOnInit();

      expect(mockProjectService.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: expect.any(Number), offset: 0 }),
      );
      expect(component.dataSource.data).toEqual([mockProjectListItem]);
      expect(component.totalProjects).toBe(1);
      expect(component.loading).toBe(false);
    });

    it('should initialise pagination from URL query params', () => {
      mockRoute.snapshot.queryParams = { page: '2', size: '50' };

      component.ngOnInit();

      expect(component.pageIndex).toBe(2);
      expect(component.pageSize).toBe(50);
    });

    it('should initialise name filter from URL query params', () => {
      mockRoute.snapshot.queryParams = { name: 'widget' };

      component.ngOnInit();

      expect(component.filterName).toBe('widget');
    });

    it('should initialise status filter from URL query params', () => {
      mockRoute.snapshot.queryParams = { status: 'active' };

      component.ngOnInit();

      expect(component.filterStatus).toBe('active');
    });

    it('should resolve team name when team_id is in URL query params', () => {
      mockRoute.snapshot.queryParams = { team_id: 'team-1' };

      component.ngOnInit();

      expect(mockTeamService.get).toHaveBeenCalledWith('team-1');
      expect(component.filterTeamId).toBe('team-1');
      expect(component.filterTeamName).toBe('Alpha Team');
    });

    it('should log error when team name resolution fails', () => {
      const error = new Error('not found');
      mockTeamService.get.mockReturnValue({
        pipe: () => ({
          subscribe: (o: any) => {
            o.error(error);
            return { unsubscribe: vi.fn() };
          },
        }),
      });
      mockRoute.snapshot.queryParams = { team_id: 'team-bad' };

      component.ngOnInit();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to resolve team name', error);
    });

    it('should log error when project list fails', () => {
      const error = new Error('server error');
      mockProjectService.list.mockReturnValue({
        pipe: () => ({
          subscribe: (o: any) => {
            o.error(error);
            return { unsubscribe: vi.fn() };
          },
        }),
      });

      component.ngOnInit();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load projects', error);
      expect(component.loading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('name filter', () => {
    it('onNameFilterChange emits to the debounce subject', () => {
      const nextSpy = vi.spyOn((component as any).filterNameSubject$, 'next');

      component.onNameFilterChange('foo');

      expect(nextSpy).toHaveBeenCalledWith('foo');
    });
  });

  // -------------------------------------------------------------------------
  describe('team filter', () => {
    it('onTeamFilterInput updates filterTeamName', () => {
      component.onTeamFilterInput('Alp');

      expect(component.filterTeamName).toBe('Alp');
    });

    it('onTeamFilterInput emits to team search subject when >= 2 chars', () => {
      const nextSpy = vi.spyOn((component as any).teamSearchSubject$, 'next');

      component.onTeamFilterInput('Al');

      expect(nextSpy).toHaveBeenCalledWith('Al');
    });

    it('onTeamFilterInput does not emit when < 2 chars', () => {
      const nextSpy = vi.spyOn((component as any).teamSearchSubject$, 'next');

      component.onTeamFilterInput('A');

      expect(nextSpy).not.toHaveBeenCalled();
    });

    it('onTeamSelected sets team filter and reloads', () => {
      component.ngOnInit();
      vi.clearAllMocks();
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      const event = {
        option: { value: mockTeamListItem },
      } as MatAutocompleteSelectedEvent;
      component.onTeamSelected(event);

      expect(component.filterTeamId).toBe('team-1');
      expect(component.filterTeamName).toBe('Alpha Team');
      expect(component.pageIndex).toBe(0);
      expect(mockProjectService.list).toHaveBeenCalled();
    });

    it('clearTeamFilter clears team filter and reloads', () => {
      component.filterTeamId = 'team-1';
      component.filterTeamName = 'Alpha Team';
      component.ngOnInit();
      vi.clearAllMocks();
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.clearTeamFilter();

      expect(component.filterTeamId).toBeNull();
      expect(component.filterTeamName).toBe('');
      expect(mockProjectService.list).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('status filter', () => {
    it('onStatusFilterChange sets status and reloads', () => {
      component.ngOnInit();
      vi.clearAllMocks();
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.onStatusFilterChange('archived');

      expect(component.filterStatus).toBe('archived');
      expect(component.pageIndex).toBe(0);
      expect(mockProjectService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'archived' }),
      );
    });

    it('onStatusFilterChange clears status when null', () => {
      component.filterStatus = 'active';
      component.ngOnInit();
      vi.clearAllMocks();
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.onStatusFilterChange(null);

      expect(component.filterStatus).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('hasActiveFilters', () => {
    it('returns false when no filters set', () => {
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('returns true when name filter is set', () => {
      component.filterName = 'foo';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('returns true when team filter is set', () => {
      component.filterTeamId = 'team-1';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('returns true when status filter is set', () => {
      component.filterStatus = 'active';
      expect(component.hasActiveFilters()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('clearFilters', () => {
    it('resets all filters and reloads', () => {
      component.filterName = 'foo';
      component.filterTeamId = 'team-1';
      component.filterTeamName = 'Alpha Team';
      component.filterStatus = 'active';
      component.pageIndex = 3;
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.clearFilters();

      expect(component.filterName).toBe('');
      expect(component.filterTeamId).toBeNull();
      expect(component.filterTeamName).toBe('');
      expect(component.filterStatus).toBeNull();
      expect(component.pageIndex).toBe(0);
      expect(mockProjectService.list).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('pagination', () => {
    it('onPageChange updates pageIndex and pageSize then reloads', () => {
      component.ngOnInit();
      vi.clearAllMocks();
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      const pageEvent: PageEvent = { pageIndex: 2, pageSize: 50, length: 100 };
      component.onPageChange(pageEvent);

      expect(component.pageIndex).toBe(2);
      expect(component.pageSize).toBe(50);
      expect(mockProjectService.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 100 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('onClose', () => {
    it('calls location.back()', () => {
      component.onClose();

      expect(mockLocation.back).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('onAddProject', () => {
    it('opens CreateProjectDialogComponent', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);

      component.onAddProject();

      expect(mockDialog.open).toHaveBeenCalledWith(
        CreateProjectDialogComponent,
        expect.objectContaining({ width: '500px' }),
      );

      // Cleanup — close without result so the subscription completes cleanly
      afterClosed$.next(undefined);
    });

    it('creates project and reloads when dialog returns a result', () => {
      const { afterClosed$, dialogRef } = createDialogRef<{ name: string; team_id: string }>();
      mockDialog.open.mockReturnValue(dialogRef);
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.onAddProject();
      afterClosed$.next({ name: 'New Project', team_id: 'team-1' });

      expect(mockProjectService.create).toHaveBeenCalledWith({
        name: 'New Project',
        team_id: 'team-1',
      });
      expect(mockProjectService.list).toHaveBeenCalled();
    });

    it('does not create project when dialog is cancelled', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);

      component.onAddProject();
      afterClosed$.next(undefined);

      expect(mockProjectService.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('onEditDetails', () => {
    it('fetches full project then opens EditProjectDialogComponent', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);

      component.onEditDetails(mockProjectListItem);

      expect(mockProjectService.get).toHaveBeenCalledWith('proj-1');
      expect(mockDialog.open).toHaveBeenCalledWith(
        EditProjectDialogComponent,
        expect.objectContaining({ data: { project: mockProject } }),
      );

      afterClosed$.next(undefined);
    });

    it('reloads when edit dialog returns a truthy result', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.onEditDetails(mockProjectListItem);
      afterClosed$.next(mockProject);

      expect(mockProjectService.list).toHaveBeenCalled();
    });

    it('logs error when project fetch fails', () => {
      const error = new Error('fetch error');
      mockProjectService.get.mockReturnValue({
        pipe: () => ({
          subscribe: (o: any) => {
            o.error(error);
            return { unsubscribe: vi.fn() };
          },
        }),
      });

      component.onEditDetails(mockProjectListItem);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load project details', error);
    });
  });

  // -------------------------------------------------------------------------
  describe('onResponsibleParties (kebab menu)', () => {
    it('opens ResponsiblePartiesDialogComponent after fetching project', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);

      component.onResponsibleParties(mockProjectListItem);

      expect(mockProjectService.get).toHaveBeenCalledWith('proj-1');
      expect(mockDialog.open).toHaveBeenCalledWith(
        ResponsiblePartiesDialogComponent,
        expect.objectContaining({ width: '600px' }),
      );

      afterClosed$.next(undefined);
    });

    it('reloads when responsible parties dialog returns truthy', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.onResponsibleParties(mockProjectListItem);
      afterClosed$.next(true);

      expect(mockProjectService.list).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('onRelatedProjects (kebab menu)', () => {
    it('opens RelatedProjectsDialogComponent after fetching project', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);

      component.onRelatedProjects(mockProjectListItem);

      expect(mockProjectService.get).toHaveBeenCalledWith('proj-1');
      expect(mockDialog.open).toHaveBeenCalledWith(
        RelatedProjectsDialogComponent,
        expect.objectContaining({ data: { project: mockProject } }),
      );

      afterClosed$.next(undefined);
    });

    it('reloads when related projects dialog returns truthy', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.onRelatedProjects(mockProjectListItem);
      afterClosed$.next(true);

      expect(mockProjectService.list).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('onMetadata (kebab menu)', () => {
    it('opens MetadataDialogComponent after fetching project', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);

      component.onMetadata(mockProjectListItem);

      expect(mockProjectService.get).toHaveBeenCalledWith('proj-1');
      expect(mockDialog.open).toHaveBeenCalledWith(
        MetadataDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            objectType: 'project',
            objectName: mockProject.name,
            isReadOnly: false,
          }),
        }),
      );

      afterClosed$.next(undefined);
    });

    it('patches metadata and reloads when dialog returns metadata array', () => {
      const newMetadata = [{ key: 'owner', value: 'alice' }];
      const { afterClosed$, dialogRef } = createDialogRef<typeof newMetadata>();
      mockDialog.open.mockReturnValue(dialogRef);
      mockProjectService.list.mockReturnValue(of(mockListResponse));

      component.onMetadata(mockProjectListItem);
      afterClosed$.next(newMetadata);

      expect(mockProjectService.patch).toHaveBeenCalledWith('proj-1', { metadata: newMetadata });
      expect(mockProjectService.list).toHaveBeenCalled();
    });

    it('does not patch when metadata dialog is cancelled', () => {
      const { afterClosed$, dialogRef } = createDialogRef();
      mockDialog.open.mockReturnValue(dialogRef);

      component.onMetadata(mockProjectListItem);
      afterClosed$.next(undefined);

      expect(mockProjectService.patch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('getStatusLabel', () => {
    it('returns em-dash for null or undefined status', () => {
      expect(component.getStatusLabel(null)).toBe('\u2014');
      expect(component.getStatusLabel(undefined)).toBe('\u2014');
      expect(component.getStatusLabel('')).toBe('\u2014');
    });

    it('returns i18n key for known status', () => {
      expect(component.getStatusLabel('active')).toBe('projects.status.active');
    });
  });

  // -------------------------------------------------------------------------
  describe('displayTeam', () => {
    it('returns team name', () => {
      expect(component.displayTeam(mockTeamListItem)).toBe('Alpha Team');
    });

    it('returns empty string for null/undefined', () => {
      expect(component.displayTeam(null as any)).toBe('');
    });
  });
});
