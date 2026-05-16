// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.
//
// Scope: this spec covers the Details-tab form and the save/cancel/tab-change
// controller logic. The Notes tab's nested NoteEditorDialog orchestration is
// integration-level and out of scope.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';

import { EditProjectDialogComponent, EditProjectDialogData } from './edit-project-dialog.component';
import type { Project } from '@app/types/project.types';

describe('EditProjectDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockProjectService: Record<string, ReturnType<typeof vi.fn>>;
  let mockTeamService: { list: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let envInjector: EnvironmentInjector;

  function makeProject(overrides: Partial<Project> = {}): Project {
    return {
      id: 'proj-1',
      name: 'Project A',
      description: 'desc',
      team_id: 'team-1',
      ...overrides,
    } as Project;
  }

  function build(data: EditProjectDialogData): EditProjectDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new EditProjectDialogComponent(
          mockDialogRef as never,
          data,
          mockProjectService as never,
          mockTeamService as never,
          new FormBuilder(),
          mockLogger as never,
          mockDialog as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockProjectService = {
      patch: vi.fn(() => of({})),
      listNotes: vi.fn(() => of({ notes: [], total: 0 })),
    };
    mockTeamService = { list: vi.fn(() => of({ teams: [{ id: 'team-1', name: 'Team A' }] })) };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockDialog = { open: vi.fn() };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  describe('initialization', () => {
    it('pre-populates the form from the project', () => {
      const component = build({
        project: makeProject({ name: 'Project X', team_id: 'team-7', status: 'active' }),
      });

      expect(component.form.get('name')?.value).toBe('Project X');
      expect(component.form.get('team_id')?.value).toBe('team-7');
      expect(component.form.get('status')?.value).toBe('active');
    });

    it('loads the team list for the team selector', () => {
      const component = build({ project: makeProject() });

      expect(mockTeamService.list).toHaveBeenCalled();
      expect(component.teams).toEqual([{ id: 'team-1', name: 'Team A' }]);
      expect(component.loadingTeams).toBe(false);
    });
  });

  describe('form validation', () => {
    it('requires a name and a team', () => {
      const component = build({ project: makeProject({ name: '', team_id: '' }) });

      expect(component.form.get('name')?.hasError('required')).toBe(true);
      expect(component.form.get('team_id')?.hasError('required')).toBe(true);
    });

    it('rejects a name longer than 256 characters', () => {
      const component = build({ project: makeProject() });
      component.form.get('name')?.setValue('a'.repeat(257));

      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });
  });

  describe('onSave', () => {
    it('patches the project with trimmed values and closes on success', () => {
      const component = build({ project: makeProject() });
      component.form.patchValue({ name: '  Renamed  ', description: '  new desc  ' });

      component.onSave();

      expect(mockProjectService['patch']).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({ name: 'Renamed', description: 'new desc', team_id: 'team-1' }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('does nothing when the form is invalid', () => {
      const component = build({ project: makeProject({ name: '' }) });

      component.onSave();

      expect(mockProjectService['patch']).not.toHaveBeenCalled();
    });

    it('surfaces the server error message on failure', () => {
      mockProjectService['patch'].mockReturnValue(
        throwError(() => ({ error: { message: 'conflict' } })),
      );
      const component = build({ project: makeProject() });
      component.form.patchValue({ name: 'Renamed' });

      component.onSave();

      expect(component.errorMessage).toBe('conflict');
      expect(component.saving).toBe(false);
    });
  });

  describe('onTabChange', () => {
    it('loads notes the first time the Notes tab is opened', () => {
      const component = build({ project: makeProject() });

      component.onTabChange({ index: 1 });

      expect(component.selectedTabIndex).toBe(1);
      expect(mockProjectService['listNotes']).toHaveBeenCalledTimes(1);
    });

    it('does not reload notes when the Notes tab is re-opened', () => {
      const component = build({ project: makeProject() });

      component.onTabChange({ index: 1 });
      component.onTabChange({ index: 0 });
      component.onTabChange({ index: 1 });

      expect(mockProjectService['listNotes']).toHaveBeenCalledTimes(1);
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with false', () => {
      const component = build({ project: makeProject() });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
