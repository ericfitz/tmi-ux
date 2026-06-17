// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';

import { ProjectService } from '@app/core/services/project.service';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { ProjectListItem } from '@app/types/project.types';
import { TeamListItem } from '@app/types/team.types';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../testing/mocks';
import { AdminProjectsComponent } from './admin-projects.component';

// ---------------------------------------------------------------------------
// Mock interfaces
// ---------------------------------------------------------------------------

interface MockProjectService {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
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

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
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
// Tests
// ---------------------------------------------------------------------------

describe('AdminProjectsComponent', () => {
  let component: AdminProjectsComponent;
  let injector: Injector;
  let mockProjectService: MockProjectService;
  let mockTeamService: MockTeamService;
  let mockRouter: MockRouter;
  let mockRoute: MockActivatedRoute;
  let mockDialog: MockDialog;
  let mockLogger: MockLoggerService;
  let mockTransloco: MockTranslocoService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectService = {
      list: vi.fn().mockReturnValue(of(mockListResponse)),
      get: vi.fn().mockReturnValue(of(mockProjectListItem)),
      create: vi.fn().mockReturnValue(of(mockProjectListItem)),
      patch: vi.fn().mockReturnValue(of(mockProjectListItem)),
      delete: vi.fn().mockReturnValue(of(undefined)),
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

    mockTransloco = { translate: vi.fn().mockReturnValue('Delete Alpha Project?') };

    const mockDestroyRef = { onDestroy: vi.fn() };
    injector = Injector.create({
      providers: [
        { provide: DestroyRef, useValue: mockDestroyRef },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: TeamService, useValue: mockTeamService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: MatDialog, useValue: mockDialog },
        { provide: LoggerService, useValue: mockLogger },
        { provide: TranslocoService, useValue: mockTransloco },
      ],
    });

    component = runInInjectionContext(injector, () => new AdminProjectsComponent());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Shared base behavior (ProjectsListBase) exercised through the admin subclass
  // -------------------------------------------------------------------------
  describe('shared base behavior', () => {
    it('loads projects on init', () => {
      component.ngOnInit();

      expect(mockProjectService.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: expect.any(Number), offset: 0 }),
      );
      expect(component.dataSource.data).toEqual([mockProjectListItem]);
      expect(component.totalProjects).toBe(1);
      expect(component.loading).toBe(false);
    });

    it('initialises pagination from URL query params', () => {
      mockRoute.snapshot.queryParams = { page: '2', size: '50' };

      component.ngOnInit();

      expect(component.pageIndex).toBe(2);
      expect(component.pageSize).toBe(50);
    });

    it('clears all filters and reloads', () => {
      component.filterName = 'widget';
      component.filterTeamId = 'team-1';
      component.filterTeamName = 'Alpha Team';
      component.filterStatus = 'active';

      component.clearFilters();

      expect(component.filterName).toBe('');
      expect(component.filterTeamId).toBeNull();
      expect(component.filterTeamName).toBe('');
      expect(component.filterStatus).toBeNull();
      expect(component.pageIndex).toBe(0);
      expect(mockProjectService.list).toHaveBeenCalled();
    });

    it('updates page index and size on page change', () => {
      component.onPageChange({ pageIndex: 3, pageSize: 100, length: 0 });

      expect(component.pageIndex).toBe(3);
      expect(component.pageSize).toBe(100);
      expect(mockProjectService.list).toHaveBeenCalled();
    });

    it('reports active filters via hasActiveFilters', () => {
      expect(component.hasActiveFilters()).toBe(false);
      component.filterName = 'widget';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('returns em-dash for null status and i18n key otherwise', () => {
      expect(component.getStatusLabel(null)).toBe('—');
      expect(component.getStatusLabel('active')).toBe('projects.status.active');
    });
  });

  // -------------------------------------------------------------------------
  // Admin-specific overrides
  // -------------------------------------------------------------------------
  describe('onClose', () => {
    it('navigates to the admin landing page', () => {
      component.onClose();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin']);
    });
  });

  describe('onDelete', () => {
    it('deletes after native confirm is accepted and adjusts the page', () => {
      const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
      component.dataSource.data = [mockProjectListItem];
      component.totalProjects = 1;
      component.pageIndex = 0;

      component.onDelete(mockProjectListItem);

      expect(mockTransloco.translate).toHaveBeenCalledWith('projects.deleteDialog.message', {
        name: 'Alpha Project',
      });
      expect(mockProjectService.delete).toHaveBeenCalledWith('proj-1');
      expect(mockProjectService.list).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('does not delete when native confirm is rejected', () => {
      const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

      component.onDelete(mockProjectListItem);

      expect(mockProjectService.delete).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('logs an error when deletion fails', () => {
      const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
      const error = new Error('boom');
      mockProjectService.delete.mockReturnValue({
        pipe: () => ({
          subscribe: (o: { error: (e: unknown) => void }) => {
            o.error(error);
            return { unsubscribe: vi.fn() };
          },
        }),
      });

      component.onDelete(mockProjectListItem);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete project', error);

      confirmSpy.mockRestore();
    });
  });
});
