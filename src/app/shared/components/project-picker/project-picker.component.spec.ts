// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of, throwError, Subject } from 'rxjs';
import { ProjectPickerComponent } from './project-picker.component';
import { ProjectService } from '@app/core/services/project.service';
import { LoggerService } from '@app/core/services/logger.service';
import { CreateProjectDialogResult } from '../create-project-dialog/create-project-dialog.component';

describe('ProjectPickerComponent', () => {
  let component: ProjectPickerComponent;
  let envInjector: EnvironmentInjector;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockProjectService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  const mockListResponse = {
    projects: [
      {
        id: 'proj-1',
        name: 'Project Alpha',
        team_id: 'team-1',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'proj-2',
        name: 'Project Beta',
        team_id: 'team-2',
        created_at: '2024-02-01T00:00:00Z',
      },
    ],
    total: 2,
    limit: 200,
    offset: 0,
  };

  beforeEach(() => {
    mockDialog = { open: vi.fn() };
    mockProjectService = {
      list: vi.fn().mockReturnValue(of(mockListResponse)),
      create: vi.fn(),
    };
    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    mockCdr = { markForCheck: vi.fn() };

    envInjector = createEnvironmentInjector([], {
      get: (token: unknown) => {
        if (token === EnvironmentInjector) return envInjector;
        return undefined;
      },
    } as EnvironmentInjector);

    runInInjectionContext(envInjector, () => {
      component = new ProjectPickerComponent(
        mockDialog as any,
        mockProjectService as unknown as ProjectService,
        mockLoggerService as unknown as LoggerService,
        mockCdr as any,
      );
    });
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('default state', () => {
    it('should have null projectId by default', () => {
      expect(component.projectId).toBeNull();
    });

    it('should not be disabled by default', () => {
      expect(component.disabled).toBe(false);
    });

    it('should be loading by default', () => {
      expect(component.loading).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should load projects on init', () => {
      runInInjectionContext(envInjector, () => {
        component.ngOnInit();
      });

      expect(mockProjectService.list).toHaveBeenCalledWith({ limit: 200 });
      expect(component.projects).toHaveLength(2);
      expect(component.loading).toBe(false);
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });

    it('should handle load error gracefully', () => {
      mockProjectService.list.mockReturnValue(throwError(() => new Error('Load failed')));

      runInInjectionContext(envInjector, () => {
        component.ngOnInit();
      });

      expect(component.projects).toHaveLength(0);
      expect(component.loading).toBe(false);
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });
  });

  describe('onSelectionChange', () => {
    it('should emit selected project id', () => {
      const emitSpy = vi.spyOn(component.projectChange, 'emit');

      component.onSelectionChange({ value: 'proj-1' } as any);

      expect(emitSpy).toHaveBeenCalledWith('proj-1');
    });

    it('should emit null when no project selected', () => {
      const emitSpy = vi.spyOn(component.projectChange, 'emit');

      component.onSelectionChange({ value: null } as any);

      expect(emitSpy).toHaveBeenCalledWith(null);
    });
  });

  describe('openCreateProject', () => {
    it('should open create project dialog', () => {
      const afterClosed$ = new Subject<CreateProjectDialogResult | undefined>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      runInInjectionContext(envInjector, () => {
        component.openCreateProject();
      });

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should create project and emit on dialog result', () => {
      const afterClosed$ = new Subject<CreateProjectDialogResult | undefined>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      const emitSpy = vi.spyOn(component.projectChange, 'emit');

      const newProject = {
        id: 'proj-new',
        name: 'New Project',
        team_id: 'team-1',
        created_at: '2024-03-01T00:00:00Z',
      };
      mockProjectService.create.mockReturnValue(of(newProject));

      runInInjectionContext(envInjector, () => {
        component.openCreateProject();
      });
      afterClosed$.next({ name: 'New Project', team_id: 'team-1' });

      expect(mockProjectService.create).toHaveBeenCalledWith({
        name: 'New Project',
        team_id: 'team-1',
      });
      expect(emitSpy).toHaveBeenCalledWith('proj-new');
      expect(component.projectId).toBe('proj-new');
    });

    it('should not create project when dialog cancelled', () => {
      const afterClosed$ = new Subject<CreateProjectDialogResult | undefined>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      runInInjectionContext(envInjector, () => {
        component.openCreateProject();
      });
      afterClosed$.next(undefined);

      expect(mockProjectService.create).not.toHaveBeenCalled();
    });

    it('should log error when project creation fails', () => {
      const afterClosed$ = new Subject<CreateProjectDialogResult | undefined>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      const error = new Error('Create failed');
      mockProjectService.create.mockReturnValue(throwError(() => error));

      runInInjectionContext(envInjector, () => {
        component.openCreateProject();
      });
      afterClosed$.next({ name: 'New Project', team_id: 'team-1' });

      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create project', error);
    });
  });
});
