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

import { EditTeamDialogComponent, EditTeamDialogData } from './edit-team-dialog.component';
import type { Team } from '@app/types/team.types';

describe('EditTeamDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockTeamService: Record<string, ReturnType<typeof vi.fn>>;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let envInjector: EnvironmentInjector;

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: build a stub Team fixture with optional field overrides (pure)
  function makeTeam(overrides: Partial<Team> = {}): Team {
    return {
      id: 'team-1',
      name: 'Team A',
      description: 'desc',
      ...overrides,
    } as Team;
  }

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: build an initialized EditTeamDialogComponent under test injection context (pure)
  function build(data: EditTeamDialogData): EditTeamDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new EditTeamDialogComponent(
          mockDialogRef as never,
          data,
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
    mockTeamService = {
      patch: vi.fn(() => of({})),
      listNotes: vi.fn(() => of({ notes: [], total: 0 })),
    };
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
    it('pre-populates the form from the team', () => {
      const component = build({
        team: makeTeam({ name: 'Team X', email_address: 'team@x.com', status: 'active' }),
      });

      expect(component.form.get('name')?.value).toBe('Team X');
      expect(component.form.get('email_address')?.value).toBe('team@x.com');
      expect(component.form.get('status')?.value).toBe('active');
    });
  });

  describe('form validation', () => {
    it('requires a name', () => {
      const component = build({ team: makeTeam({ name: '' }) });

      expect(component.form.get('name')?.hasError('required')).toBe(true);
    });

    it('rejects a name longer than 256 characters', () => {
      const component = build({ team: makeTeam() });
      component.form.get('name')?.setValue('a'.repeat(257));

      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });

    it('rejects an invalid email address', () => {
      const component = build({ team: makeTeam() });
      component.form.get('email_address')?.setValue('not-an-email');

      expect(component.form.get('email_address')?.hasError('email')).toBe(true);
    });
  });

  describe('onSave', () => {
    it('patches the team with trimmed values and closes on success', () => {
      const component = build({ team: makeTeam() });
      component.form.patchValue({ name: '  Renamed  ', description: '  new desc  ' });

      component.onSave();

      expect(mockTeamService['patch']).toHaveBeenCalledWith(
        'team-1',
        expect.objectContaining({ name: 'Renamed', description: 'new desc' }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('does nothing when the form is invalid', () => {
      const component = build({ team: makeTeam({ name: '' }) });

      component.onSave();

      expect(mockTeamService['patch']).not.toHaveBeenCalled();
    });

    it('surfaces the server error message on failure', () => {
      mockTeamService['patch'].mockReturnValue(throwError(() => ({ error: { message: 'taken' } })));
      const component = build({ team: makeTeam() });
      component.form.patchValue({ name: 'Renamed' });

      component.onSave();

      expect(component.errorMessage).toBe('taken');
      expect(component.saving).toBe(false);
    });
  });

  describe('onTabChange', () => {
    it('loads notes the first time the Notes tab is opened', () => {
      const component = build({ team: makeTeam() });

      component.onTabChange({ index: 1 });

      expect(component.selectedTabIndex).toBe(1);
      expect(mockTeamService['listNotes']).toHaveBeenCalledTimes(1);
    });

    it('does not reload notes when the Notes tab is re-opened', () => {
      const component = build({ team: makeTeam() });

      component.onTabChange({ index: 1 });
      component.onTabChange({ index: 0 });
      component.onTabChange({ index: 1 });

      expect(mockTeamService['listNotes']).toHaveBeenCalledTimes(1);
    });
  });

  describe('onNotesPageChange', () => {
    it('reloads notes with the new page index and size', () => {
      const component = build({ team: makeTeam() });
      mockTeamService['listNotes'].mockClear();

      component.onNotesPageChange({ pageIndex: 2, pageSize: 25 } as never);

      expect(component.notesPageIndex).toBe(2);
      expect(component.notesPageSize).toBe(25);
      expect(mockTeamService['listNotes']).toHaveBeenCalledWith('team-1', 25, 50);
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with false', () => {
      const component = build({ team: makeTeam() });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
